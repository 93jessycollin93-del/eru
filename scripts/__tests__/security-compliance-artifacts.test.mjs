// Tests for the Phase 1 security compliance data/config artifacts added in
// this PR:
//   - package.json (compliance:security script wiring)
//   - .github/workflows/ci.yml (blocking CI gate wiring)
//   - src/security/PHASE1_CONTROL_MATRIX.json
//   - src/security/ACCEPTANCE_TEST_GATES.json
//   - src/security/FEATURE_COMPLIANCE_REGISTRY.json
//   - src/security/*.md documentation files
//
// These assertions are intentionally independent from
// scripts/validate-security-compliance.mjs's own logic (covered separately
// in validate-security-compliance.test.mjs) so a regression in either the
// validator script or the data files themselves will be caught.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..', '..');
const SECURITY_DIR = path.join(REPO_ROOT, 'src', 'security');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

describe('package.json wiring', () => {
  const pkg = readJson('package.json');

  test('defines the compliance:security script', () => {
    assert.equal(
      pkg.scripts['compliance:security'],
      'node scripts/validate-security-compliance.mjs',
    );
  });

  test('is an ES module project (required for the .mjs validator script)', () => {
    assert.equal(pkg.type, 'module');
  });
});

describe('.github/workflows/ci.yml wiring', () => {
  const workflow = readText('.github/workflows/ci.yml');

  test('runs the security compliance gate', () => {
    assert.match(workflow, /name:\s*Security compliance gate/);
    assert.match(workflow, /run:\s*npm run compliance:security/);
  });

  test('the security compliance gate step is blocking (no continue-on-error)', () => {
    const stepIndex = workflow.indexOf('Security compliance gate');
    assert.notEqual(stepIndex, -1, 'Security compliance gate step not found');

    const nextStepIndex = workflow.indexOf('- name:', stepIndex + 1);
    const stepBlock = workflow.slice(
      stepIndex,
      nextStepIndex === -1 ? workflow.length : nextStepIndex,
    );

    // Match an actual `continue-on-error:` YAML key line, not just any
    // mention of the phrase (e.g. within a comment about a different step).
    assert.ok(
      !/^\s*continue-on-error:/m.test(stepBlock),
      `Expected the security compliance gate step to be blocking:\n${stepBlock}`,
    );
  });

  test('the security compliance gate runs before the informational i18n lint step', () => {
    const complianceIndex = workflow.indexOf('Security compliance gate');
    const i18nIndex = workflow.indexOf('i18n lint');
    assert.notEqual(complianceIndex, -1);
    assert.notEqual(i18nIndex, -1);
    assert.ok(complianceIndex < i18nIndex);
  });
});

describe('src/security/PHASE1_CONTROL_MATRIX.json', () => {
  const matrix = readJson('src/security/PHASE1_CONTROL_MATRIX.json');
  const REQUIRED_FRAMEWORKS = ['NIST SP 800-171', 'FIPS 140-3', 'FedRAMP IL5', 'DoD SRG'];

  test('declares all required compliance frameworks', () => {
    for (const framework of REQUIRED_FRAMEWORKS) {
      assert.ok(matrix.frameworks.includes(framework), `Missing framework: ${framework}`);
    }
  });

  test('has at least one control', () => {
    assert.ok(Array.isArray(matrix.controls) && matrix.controls.length > 0);
  });

  test('every control id is unique', () => {
    const ids = matrix.controls.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, 'Duplicate control ids found');
  });

  test('every control has an acceptance_gate_id and at least one framework mapping', () => {
    for (const control of matrix.controls) {
      assert.ok(control.id, 'Control is missing an id');
      assert.ok(control.acceptance_gate_id, `Control ${control.id} missing acceptance_gate_id`);
      assert.ok(
        Array.isArray(control.framework_mappings) && control.framework_mappings.length > 0,
        `Control ${control.id} missing framework_mappings`,
      );
      for (const mapping of control.framework_mappings) {
        assert.ok(mapping.framework, `Control ${control.id} has a mapping with no framework`);
        assert.ok(mapping.control, `Control ${control.id} has a mapping with no control`);
      }
    }
  });

  test('every control references a gate that exists in ACCEPTANCE_TEST_GATES.json', () => {
    const gatesDoc = readJson('src/security/ACCEPTANCE_TEST_GATES.json');
    const gateIds = new Set(gatesDoc.gates.map((g) => g.id));
    for (const control of matrix.controls) {
      assert.ok(
        gateIds.has(control.acceptance_gate_id),
        `Control ${control.id} references unknown gate ${control.acceptance_gate_id}`,
      );
    }
  });
});

describe('src/security/ACCEPTANCE_TEST_GATES.json', () => {
  const gatesDoc = readJson('src/security/ACCEPTANCE_TEST_GATES.json');

  test('has at least one gate', () => {
    assert.ok(Array.isArray(gatesDoc.gates) && gatesDoc.gates.length > 0);
  });

  test('every gate id is unique', () => {
    const ids = gatesDoc.gates.map((g) => g.id);
    assert.equal(new Set(ids).size, ids.length, 'Duplicate gate ids found');
  });

  test('every gate is release-blocking with automated checks and evidence requirements', () => {
    for (const gate of gatesDoc.gates) {
      assert.equal(gate.blocking, true, `Gate ${gate.id} is not blocking`);
      assert.ok(
        Array.isArray(gate.automated_checks) && gate.automated_checks.length > 0,
        `Gate ${gate.id} missing automated_checks`,
      );
      assert.ok(
        Array.isArray(gate.evidence_required) && gate.evidence_required.length > 0,
        `Gate ${gate.id} missing evidence_required`,
      );
    }
  });

  test('every control in the control matrix maps to a gate defined here', () => {
    const matrix = readJson('src/security/PHASE1_CONTROL_MATRIX.json');
    const gateIds = new Set(gatesDoc.gates.map((g) => g.id));
    const referencedGateIds = new Set(matrix.controls.map((c) => c.acceptance_gate_id));
    for (const gateId of referencedGateIds) {
      assert.ok(gateIds.has(gateId), `Referenced gate ${gateId} does not exist`);
    }
  });
});

describe('src/security/FEATURE_COMPLIANCE_REGISTRY.json', () => {
  const featureRegistry = readJson('src/security/FEATURE_COMPLIANCE_REGISTRY.json');
  const matrix = readJson('src/security/PHASE1_CONTROL_MATRIX.json');
  const controlIds = new Set(matrix.controls.map((c) => c.id));

  test('has at least one feature', () => {
    assert.ok(Array.isArray(featureRegistry.features) && featureRegistry.features.length > 0);
  });

  test('every feature maps only to controls that exist in the control matrix', () => {
    for (const feature of featureRegistry.features) {
      assert.ok(feature.id, 'Feature is missing an id');
      assert.ok(
        Array.isArray(feature.controls) && feature.controls.length > 0,
        `Feature ${feature.id} missing controls`,
      );
      for (const controlId of feature.controls) {
        assert.ok(
          controlIds.has(controlId),
          `Feature ${feature.id} references unknown control ${controlId}`,
        );
      }
    }
  });

  test('release-blocking features are marked compliant and have evidence', () => {
    for (const feature of featureRegistry.features) {
      if (feature.release_blocking === true) {
        assert.equal(feature.compliant, true, `Release-blocking feature ${feature.id} is not compliant`);
      }
      assert.ok(
        Array.isArray(feature.evidence) && feature.evidence.length > 0,
        `Feature ${feature.id} missing evidence`,
      );
    }
  });
});

describe('src/security markdown documentation', () => {
  const docs = [
    {
      file: 'src/security/CRYPTO_ARCHITECTURE_DECISIONS.md',
      headings: [
        '# Phase 1 Cryptography Architecture Decisions',
        '## 1. Approved Cryptographic Profile',
        '## 2. Key Lifecycle Policy',
        '## 3. HSM / TEE Integration Points',
        '## 4. Side-Channel and Implementation Controls',
      ],
    },
    {
      file: 'src/security/INCIDENT_RESPONSE_AND_DESTRUCTION_CONTROLS.md',
      headings: [
        '# Phase 1 Incident Response and Destruction Controls',
        '## 1. Incident Response Control Set',
        '## 2. Evidence Preservation Requirements',
        '## 3. Destruction and Sanitization Control Set',
        '## 4. Enforcement Baselines',
      ],
    },
    {
      file: 'src/security/SYSTEM_BOUNDARIES_AND_DATA_FLOWS.md',
      headings: [
        '# Phase 1 System Boundaries and Data Classification Flows',
        '## 1. Security Domains',
        '## 2. Trust Boundaries',
        '## 3. Data Classes and Handling Rules',
        '## 4. Data Flow Map (Phase 1)',
        '## 5. Boundary Enforcement Requirements',
      ],
    },
  ];

  for (const { file, headings } of docs) {
    test(`${file} exists and contains its expected section headings`, () => {
      const content = readText(file);
      assert.ok(content.length > 0, `${file} is empty`);
      for (const heading of headings) {
        assert.ok(content.includes(heading), `${file} missing heading: ${heading}`);
      }
    });
  }
});

describe('directory listing', () => {
  test('all expected Phase 1 security artifacts are present', () => {
    const expected = [
      'ACCEPTANCE_TEST_GATES.json',
      'CRYPTO_ARCHITECTURE_DECISIONS.md',
      'FEATURE_COMPLIANCE_REGISTRY.json',
      'INCIDENT_RESPONSE_AND_DESTRUCTION_CONTROLS.md',
      'PHASE1_CONTROL_MATRIX.json',
      'SYSTEM_BOUNDARIES_AND_DATA_FLOWS.md',
    ];
    const actual = fs.readdirSync(SECURITY_DIR).sort();
    for (const file of expected) {
      assert.ok(actual.includes(file), `Missing expected file: ${file}`);
    }
  });
});