// Headless runner for the ERU swarm validation tests.
// Usage: node scripts/runEruSwarmTests.mjs

import { runSwarm, HAPPY_PATH_MISSION, CONTROLLED_FAILURE_MISSION } from '../src/lib/eruSwarm.js';
import {
  validateEvents,
  HAPPY_PATH_SPEC,
  CONTROLLED_FAILURE_SPEC,
} from '../src/lib/eruSwarmValidator.js';

function fmtStage(stage) {
  const verdict = stage.pass ? 'PASS' : 'FAIL';
  const header = `  [${verdict}] ${stage.name}: actual=${stage.actual} expected=${stage.expected}`;
  if (stage.pass) return header;
  const lines = stage.failures.map((f) => `        - ${f.indicator}: ${f.detail}`);
  return [header, ...lines].join('\n');
}

function printReport(report) {
  console.log(`\n=== ${report.run_id} (target_space=${report.target_space}) ===`);
  console.log(`overall: ${report.pass ? 'PASS' : 'FAIL'}`);
  console.log(
    `events: ${report.total_events} / expected ${report.expected_total_events}  elapsed_ms=${report.elapsed_ms}`,
  );
  if (report.suspicious_timing) console.log(`timing note: ${report.suspicious_timing}`);
  for (const stage of Object.values(report.stages)) {
    console.log(fmtStage(stage));
  }
}

async function main() {
  const t1Events = await runSwarm(HAPPY_PATH_MISSION);
  const t1Report = validateEvents(t1Events, HAPPY_PATH_SPEC);
  printReport(t1Report);

  const t2Events = await runSwarm(CONTROLLED_FAILURE_MISSION, { blockedWorkers: ['W7'] });
  const t2Report = validateEvents(t2Events, CONTROLLED_FAILURE_SPEC);
  printReport(t2Report);

  // Sanity: the same T2 event stream, judged against the HAPPY-PATH spec, MUST fail.
  // Proves the validator is actually catching missing-worker conditions.
  const sanity = validateEvents(t2Events, HAPPY_PATH_SPEC);
  console.log(`\n[sanity] failure-stream vs happy-spec: ${sanity.pass ? 'PASS (BUG!)' : 'FAIL (good)'}`);
  console.log(
    `[sanity] triggered indicators: ${Object.values(sanity.stages)
      .flatMap((s) => s.failures.map((f) => f.indicator))
      .join(', ') || '(none)'}`,
  );

  const exit = t1Report.pass && t2Report.pass && !sanity.pass ? 0 : 1;
  console.log(`\nexit=${exit}`);
  process.exit(exit);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
