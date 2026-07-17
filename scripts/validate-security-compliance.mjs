#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MATRIX_PATH = path.resolve(ROOT, 'src/security/PHASE1_CONTROL_MATRIX.json');
const GATES_PATH = path.resolve(ROOT, 'src/security/ACCEPTANCE_TEST_GATES.json');
const FEATURES_PATH = path.resolve(ROOT, 'src/security/FEATURE_COMPLIANCE_REGISTRY.json');

const REQUIRED_FRAMEWORKS = [
  'NIST SP 800-171',
  'FIPS 140-3',
  'FedRAMP IL5',
  'DoD SRG',
];

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${path.relative(ROOT, filePath)}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fail(message, failures) {
  failures.push(message);
}

function main() {
  const failures = [];
  const matrix = readJson(MATRIX_PATH);
  const gatesDoc = readJson(GATES_PATH);
  const featureRegistry = readJson(FEATURES_PATH);

  for (const framework of REQUIRED_FRAMEWORKS) {
    if (!Array.isArray(matrix.frameworks) || !matrix.frameworks.includes(framework)) {
      fail(`Control matrix missing required framework: ${framework}`, failures);
    }
  }

  if (!Array.isArray(matrix.controls) || matrix.controls.length === 0) {
    fail('Control matrix must include one or more controls.', failures);
  }

  const gateIds = new Set();
  if (!Array.isArray(gatesDoc.gates) || gatesDoc.gates.length === 0) {
    fail('Acceptance gates document must include one or more gates.', failures);
  } else {
    for (const gate of gatesDoc.gates) {
      if (!gate.id) fail('Gate id is required.', failures);
      if (gateIds.has(gate.id)) fail(`Duplicate gate id: ${gate.id}`, failures);
      gateIds.add(gate.id);
      if (gate.blocking !== true) fail(`Gate must be release-blocking: ${gate.id}`, failures);
      if (!Array.isArray(gate.automated_checks) || gate.automated_checks.length === 0) {
        fail(`Gate missing automated checks: ${gate.id}`, failures);
      }
      if (!Array.isArray(gate.evidence_required) || gate.evidence_required.length === 0) {
        fail(`Gate missing evidence requirements: ${gate.id}`, failures);
      }
    }
  }

  const controlIds = new Set();
  for (const control of matrix.controls || []) {
    if (!control.id) fail('Control id is required.', failures);
    if (controlIds.has(control.id)) fail(`Duplicate control id: ${control.id}`, failures);
    controlIds.add(control.id);

    if (!control.acceptance_gate_id) {
      fail(`Control missing acceptance_gate_id: ${control.id}`, failures);
    } else if (!gateIds.has(control.acceptance_gate_id)) {
      fail(`Control references unknown acceptance gate: ${control.id} -> ${control.acceptance_gate_id}`, failures);
    }

    if (!Array.isArray(control.framework_mappings) || control.framework_mappings.length === 0) {
      fail(`Control missing framework mappings: ${control.id}`, failures);
    }

    for (const mapping of control.framework_mappings || []) {
      if (!mapping.framework || !mapping.control) {
        fail(`Invalid framework mapping in control: ${control.id}`, failures);
      }
    }
  }

  if (!Array.isArray(featureRegistry.features) || featureRegistry.features.length === 0) {
    fail('Feature compliance registry must include one or more features.', failures);
  } else {
    for (const feature of featureRegistry.features) {
      if (!feature.id) fail('Feature id is required.', failures);
      if (!Array.isArray(feature.controls) || feature.controls.length === 0) {
        fail(`Feature missing mapped controls: ${feature.id}`, failures);
      }
      for (const controlId of feature.controls || []) {
        if (!controlIds.has(controlId)) {
          fail(`Feature references unknown control: ${feature.id} -> ${controlId}`, failures);
        }
      }
      if (feature.release_blocking === true && feature.compliant !== true) {
        fail(`Release-blocking feature is not compliant: ${feature.id}`, failures);
      }
      if (!Array.isArray(feature.evidence) || feature.evidence.length === 0) {
        fail(`Feature missing evidence list: ${feature.id}`, failures);
      }
    }
  }

  if (failures.length > 0) {
    console.error('\n[security compliance] FAIL\n');
    failures.forEach((msg) => console.error(` - ${msg}`));
    process.exit(1);
  }

  console.log('[security compliance] OK — controls, gates, and feature compliance registry are valid.');
}

main();
