// Tests for scripts/validate-security-compliance.mjs
//
// The script under test runs its `main()` function as a side effect of being
// imported (it calls `main()` at the bottom of the module and may call
// `process.exit()`), so it cannot be safely `import`-ed from a test process.
// Instead these tests spawn it as a child process against fixture project
// directories, which exercises the exact same code path used in CI
// (`npm run compliance:security`).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.join(__dirname, '..', 'validate-security-compliance.mjs');
const REPO_ROOT = path.join(__dirname, '..', '..');

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Returns a minimal, mutually-consistent set of fixtures that pass validation. */
function baseFixtures() {
  return {
    matrix: {
      frameworks: ['NIST SP 800-171', 'FIPS 140-3', 'FedRAMP IL5', 'DoD SRG'],
      controls: [
        {
          id: 'CTRL-1',
          acceptance_gate_id: 'GATE-1',
          framework_mappings: [{ framework: 'NIST SP 800-171', control: '3.1.1' }],
        },
      ],
    },
    gates: {
      gates: [
        {
          id: 'GATE-1',
          blocking: true,
          automated_checks: ['check-1'],
          evidence_required: ['evidence-1'],
        },
      ],
    },
    features: {
      features: [
        {
          id: 'FEATURE-1',
          controls: ['CTRL-1'],
          release_blocking: false,
          compliant: false,
          evidence: ['evidence item'],
        },
      ],
    },
  };
}

/**
 * Writes a temporary project directory with a `src/security` folder
 * containing whichever of the three fixture documents are provided.
 * Omitting a key simulates that file being missing entirely.
 */
function writeProject({ matrix, gates, features } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'security-compliance-'));
  const securityDir = path.join(dir, 'src', 'security');
  fs.mkdirSync(securityDir, { recursive: true });

  if (matrix !== undefined) {
    fs.writeFileSync(path.join(securityDir, 'PHASE1_CONTROL_MATRIX.json'), JSON.stringify(matrix));
  }
  if (gates !== undefined) {
    fs.writeFileSync(path.join(securityDir, 'ACCEPTANCE_TEST_GATES.json'), JSON.stringify(gates));
  }
  if (features !== undefined) {
    fs.writeFileSync(path.join(securityDir, 'FEATURE_COMPLIANCE_REGISTRY.json'), JSON.stringify(features));
  }

  return dir;
}

function runValidator(cwd) {
  return spawnSync(process.execPath, [SCRIPT_PATH], { cwd, encoding: 'utf8' });
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function assertFailureContains(result, message) {
  assert.equal(
    result.status,
    1,
    `Expected exit code 1 but got ${result.status}.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  assert.ok(
    result.stderr.includes(message),
    `Expected stderr to include: ${message}\nActual stderr:\n${result.stderr}`,
  );
}

describe('scripts/validate-security-compliance.mjs', () => {
  test('passes against the real repository compliance artifacts', () => {
    const result = runValidator(REPO_ROOT);
    assert.equal(result.status, 0, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
    assert.match(result.stdout, /\[security compliance\] OK/);
  });

  test('passes with a minimal, internally-consistent fixture set', () => {
    const { matrix, gates, features } = baseFixtures();
    const dir = writeProject({ matrix, gates, features });
    try {
      const result = runValidator(dir);
      assert.equal(result.status, 0, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
      assert.match(
        result.stdout,
        /OK — controls, gates, and feature compliance registry are valid\./,
      );
      assert.equal(result.stderr, '');
    } finally {
      cleanup(dir);
    }
  });

  test('exits non-zero with an uncaught error when a required file is missing', () => {
    const { matrix, gates } = baseFixtures();
    // Intentionally omit `features` so FEATURE_COMPLIANCE_REGISTRY.json is absent.
    const dir = writeProject({ matrix, gates });
    try {
      const result = runValidator(dir);
      assert.notEqual(result.status, 0);
      assert.ok(
        result.stderr.includes('Missing required file:') &&
          result.stderr.includes('FEATURE_COMPLIANCE_REGISTRY.json'),
        `Expected stderr to report the missing file.\nActual stderr:\n${result.stderr}`,
      );
    } finally {
      cleanup(dir);
    }
  });

  describe('control matrix validation', () => {
    test('fails when a required framework is missing', () => {
      const fixtures = baseFixtures();
      fixtures.matrix.frameworks = fixtures.matrix.frameworks.filter((f) => f !== 'FIPS 140-3');
      const dir = writeProject(fixtures);
      try {
        assertFailureContains(
          runValidator(dir),
          'Control matrix missing required framework: FIPS 140-3',
        );
      } finally {
        cleanup(dir);
      }
    });

    test('fails when frameworks is not an array', () => {
      const fixtures = baseFixtures();
      fixtures.matrix.frameworks = 'NIST SP 800-171';
      const dir = writeProject(fixtures);
      try {
        assertFailureContains(
          runValidator(dir),
          'Control matrix missing required framework: NIST SP 800-171',
        );
      } finally {
        cleanup(dir);
      }
    });

    test('fails when there are no controls', () => {
      const fixtures = baseFixtures();
      fixtures.matrix.controls = [];
      const dir = writeProject(fixtures);
      try {
        assertFailureContains(runValidator(dir), 'Control matrix must include one or more controls.');
      } finally {
        cleanup(dir);
      }
    });

    test('fails when a control is missing an id', () => {
      const fixtures = baseFixtures();
      delete fixtures.matrix.controls[0].id;
      const dir = writeProject(fixtures);
      try {
        assertFailureContains(runValidator(dir), 'Control id is required.');
      } finally {
        cleanup(dir);
      }
    });

    test('fails when two controls share the same id', () => {
      const fixtures = baseFixtures();
      fixtures.matrix.controls.push(deepClone(fixtures.matrix.controls[0]));
      const dir = writeProject(fixtures);
      try {
        assertFailureContains(runValidator(dir), 'Duplicate control id: CTRL-1');
      } finally {
        cleanup(dir);
      }
    });

    test('fails when a control has no acceptance_gate_id', () => {
      const fixtures = baseFixtures();
      delete fixtures.matrix.controls[0].acceptance_gate_id;
      const dir = writeProject(fixtures);
      try {
        assertFailureContains(runValidator(dir), 'Control missing acceptance_gate_id: CTRL-1');
      } finally {
        cleanup(dir);
      }
    });

    test('fails when a control references an unknown acceptance gate', () => {
      const fixtures = baseFixtures();
      fixtures.matrix.controls[0].acceptance_gate_id = 'GATE-DOES-NOT-EXIST';
      const dir = writeProject(fixtures);
      try {
        assertFailureContains(
          runValidator(dir),
          'Control references unknown acceptance gate: CTRL-1 -> GATE-DOES-NOT-EXIST',
        );
      } finally {
        cleanup(dir);
      }
    });

    test('fails when a control has no framework mappings', () => {
      const fixtures = baseFixtures();
      fixtures.matrix.controls[0].framework_mappings = [];
      const dir = writeProject(fixtures);
      try {
        assertFailureContains(runValidator(dir), 'Control missing framework mappings: CTRL-1');
      } finally {
        cleanup(dir);
      }
    });

    test('fails when a framework mapping is missing the framework or control field', () => {
      const fixtures = baseFixtures();
      fixtures.matrix.controls[0].framework_mappings = [{ framework: 'NIST SP 800-171' }];
      const dir = writeProject(fixtures);
      try {
        assertFailureContains(runValidator(dir), 'Invalid framework mapping in control: CTRL-1');
      } finally {
        cleanup(dir);
      }
    });
  });

  describe('acceptance gates validation', () => {
    test('fails when there are no gates', () => {
      const fixtures = baseFixtures();
      fixtures.gates.gates = [];
      const dir = writeProject(fixtures);
      try {
        assertFailureContains(
          runValidator(dir),
          'Acceptance gates document must include one or more gates.',
        );
      } finally {
        cleanup(dir);
      }
    });

    test('fails when a gate is missing an id', () => {
      const fixtures = baseFixtures();
      delete fixtures.gates.gates[0].id;
      const dir = writeProject(fixtures);
      try {
        assertFailureContains(runValidator(dir), 'Gate id is required.');
      } finally {
        cleanup(dir);
      }
    });

    test('fails when two gates share the same id', () => {
      const fixtures = baseFixtures();
      fixtures.gates.gates.push(deepClone(fixtures.gates.gates[0]));
      const dir = writeProject(fixtures);
      try {
        assertFailureContains(runValidator(dir), 'Duplicate gate id: GATE-1');
      } finally {
        cleanup(dir);
      }
    });

    test('fails when a gate is not marked release-blocking', () => {
      const fixtures = baseFixtures();
      fixtures.gates.gates[0].blocking = false;
      const dir = writeProject(fixtures);
      try {
        assertFailureContains(runValidator(dir), 'Gate must be release-blocking: GATE-1');
      } finally {
        cleanup(dir);
      }
    });

    test('fails when a gate has no automated checks', () => {
      const fixtures = baseFixtures();
      fixtures.gates.gates[0].automated_checks = [];
      const dir = writeProject(fixtures);
      try {
        assertFailureContains(runValidator(dir), 'Gate missing automated checks: GATE-1');
      } finally {
        cleanup(dir);
      }
    });

    test('fails when a gate has no evidence requirements', () => {
      const fixtures = baseFixtures();
      fixtures.gates.gates[0].evidence_required = [];
      const dir = writeProject(fixtures);
      try {
        assertFailureContains(runValidator(dir), 'Gate missing evidence requirements: GATE-1');
      } finally {
        cleanup(dir);
      }
    });
  });

  describe('feature compliance registry validation', () => {
    test('fails when there are no features', () => {
      const fixtures = baseFixtures();
      fixtures.features.features = [];
      const dir = writeProject(fixtures);
      try {
        assertFailureContains(
          runValidator(dir),
          'Feature compliance registry must include one or more features.',
        );
      } finally {
        cleanup(dir);
      }
    });

    test('fails when a feature is missing an id', () => {
      const fixtures = baseFixtures();
      delete fixtures.features.features[0].id;
      const dir = writeProject(fixtures);
      try {
        assertFailureContains(runValidator(dir), 'Feature id is required.');
      } finally {
        cleanup(dir);
      }
    });

    test('fails when a feature has no mapped controls', () => {
      const fixtures = baseFixtures();
      fixtures.features.features[0].controls = [];
      const dir = writeProject(fixtures);
      try {
        assertFailureContains(runValidator(dir), 'Feature missing mapped controls: FEATURE-1');
      } finally {
        cleanup(dir);
      }
    });

    test('fails when a feature references an unknown control', () => {
      const fixtures = baseFixtures();
      fixtures.features.features[0].controls = ['CTRL-DOES-NOT-EXIST'];
      const dir = writeProject(fixtures);
      try {
        assertFailureContains(
          runValidator(dir),
          'Feature references unknown control: FEATURE-1 -> CTRL-DOES-NOT-EXIST',
        );
      } finally {
        cleanup(dir);
      }
    });

    test('fails when a release-blocking feature is not marked compliant', () => {
      const fixtures = baseFixtures();
      fixtures.features.features[0].release_blocking = true;
      fixtures.features.features[0].compliant = false;
      const dir = writeProject(fixtures);
      try {
        assertFailureContains(
          runValidator(dir),
          'Release-blocking feature is not compliant: FEATURE-1',
        );
      } finally {
        cleanup(dir);
      }
    });

    test('passes when a release-blocking feature is marked compliant', () => {
      const fixtures = baseFixtures();
      fixtures.features.features[0].release_blocking = true;
      fixtures.features.features[0].compliant = true;
      const dir = writeProject(fixtures);
      try {
        const result = runValidator(dir);
        assert.equal(result.status, 0, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
      } finally {
        cleanup(dir);
      }
    });

    test('fails when a feature has no evidence list', () => {
      const fixtures = baseFixtures();
      fixtures.features.features[0].evidence = [];
      const dir = writeProject(fixtures);
      try {
        assertFailureContains(runValidator(dir), 'Feature missing evidence list: FEATURE-1');
      } finally {
        cleanup(dir);
      }
    });
  });

  test('accumulates and reports every failure found in a single run', () => {
    const fixtures = baseFixtures();
    fixtures.matrix.frameworks = [];
    fixtures.gates.gates[0].blocking = false;
    fixtures.features.features[0].evidence = [];
    const dir = writeProject(fixtures);
    try {
      const result = runValidator(dir);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /\[security compliance\] FAIL/);
      assert.ok(result.stderr.includes('Control matrix missing required framework: NIST SP 800-171'));
      assert.ok(result.stderr.includes('Control matrix missing required framework: FIPS 140-3'));
      assert.ok(result.stderr.includes('Control matrix missing required framework: FedRAMP IL5'));
      assert.ok(result.stderr.includes('Control matrix missing required framework: DoD SRG'));
      assert.ok(result.stderr.includes('Gate must be release-blocking: GATE-1'));
      assert.ok(result.stderr.includes('Feature missing evidence list: FEATURE-1'));
    } finally {
      cleanup(dir);
    }
  });
});