// ERU red-team swarm — runs simulated attacks against the app and records
// whether the expected defense held. Mirrors the topology of eruSwarm.js
// (1 leader + 5 commanders + 20 workers) but each worker is an attack
// scenario instead of a readiness probe.
//
// Two modes:
//   - 'simulate' (default): deterministic; each scenario reports its
//     declared `simulated_result`. Safe, fast, no network traffic.
//     Use this to see WHAT would be tested and confirm the framework
//     reaches every attack category.
//   - 'live':  actually invokes each scenario's `live_runner(ctx)` against
//     the live app. Bounded — each runner is responsible for capping its
//     own request count. Live runners are opt-in per scenario; if a
//     scenario doesn't define one, it falls back to simulate even in
//     live mode.

export const REDTEAM_LEADER_ID = 'REDTEAM-LEADER-1';

export const REDTEAM_CATEGORIES = {
  'RC-LOAD':  { domain: 'load_flood',       role: 'Concurrent request flood' },
  'RC-FUZZ':  { domain: 'input_fuzzing',    role: 'Malformed/oversized input' },
  'RC-INJ':   { domain: 'prompt_injection', role: 'LLM prompt injection' },
  'RC-AUTH':  { domain: 'auth_bypass',      role: 'Auth / IDOR bypass attempts' },
  'RC-ABUSE': { domain: 'abuse_detection',  role: 'Economy / abuse-pattern attacks' },
};

// Scenario shape:
//   {
//     id: 'A1',
//     commander_id: 'RC-LOAD',
//     name: 'short human label',
//     description: 'what the attack does',
//     expected_defense: 'rate_limit' | 'reject' | 'sanitize' | 'auth_required' | 'audit',
//     simulated_result: 'blocked' | 'leaked' | 'unhandled',
//     live_runner: optional async (ctx) => ({ outcome, evidence })
//   }

export const DEFAULT_SCENARIOS = [
  // --- Load flood (RC-LOAD) ---
  {
    id: 'A1', commander_id: 'RC-LOAD',
    name: 'Burst trade endpoint',
    description: '50 trade calls in 1s from one identity',
    expected_defense: 'rate_limit',
    simulated_result: 'blocked',
  },
  {
    id: 'A2', commander_id: 'RC-LOAD',
    name: 'Burst LLM invoke',
    description: '20 InvokeLLM calls back-to-back',
    expected_defense: 'rate_limit',
    simulated_result: 'blocked',
  },
  {
    id: 'A3', commander_id: 'RC-LOAD',
    name: 'Burst entity list',
    description: 'Spam UserBot.list pagination',
    expected_defense: 'rate_limit',
    simulated_result: 'blocked',
  },
  {
    id: 'A4', commander_id: 'RC-LOAD',
    name: 'Concurrent bot creation',
    description: '10 simultaneous TelegramBot.create',
    expected_defense: 'rate_limit',
    simulated_result: 'blocked',
  },

  // --- Input fuzzing (RC-FUZZ) ---
  {
    id: 'B1', commander_id: 'RC-FUZZ',
    name: 'SSRF via ingest URL',
    description: 'POST ingestTelegramBotKnowledge with url=http://169.254.169.254/...',
    expected_defense: 'reject',
    simulated_result: 'leaked',
    evidence: 'base44/functions/ingestTelegramBotKnowledge/entry.ts:51 — fetch(url) with no host/protocol allowlist. Deno egress reaches metadata service / private CIDRs.',
    fix: 'Allow only https:; reject hosts in 10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, ::1, fc00::/7. Pin to resolved IP before fetch.',
  },
  {
    id: 'B2', commander_id: 'RC-FUZZ',
    name: 'Oversized payload',
    description: '10 MB body in TelegramBot name field',
    expected_defense: 'reject',
    simulated_result: 'blocked',
  },
  {
    id: 'B3', commander_id: 'RC-FUZZ',
    name: 'Null bytes / control chars',
    description: 'Embed \\0 and ANSI escapes in user input',
    expected_defense: 'sanitize',
    simulated_result: 'blocked',
  },
  {
    id: 'B4', commander_id: 'RC-FUZZ',
    name: 'Type confusion',
    description: 'Send array where object is expected; nested null prototypes',
    expected_defense: 'reject',
    simulated_result: 'blocked',
  },

  // --- Prompt injection (RC-INJ) ---
  {
    id: 'C1', commander_id: 'RC-INJ',
    name: 'Unsigned Telegram webhook',
    description: 'POST telegramWebhook?botId=<id> without secret_token; drives victim\'s bot',
    expected_defense: 'reject',
    simulated_result: 'leaked',
    evidence: 'base44/functions/telegramWebhook/entry.ts:13 — no X-Telegram-Bot-Api-Secret-Token check. Attacker drives victim bot with arbitrary chat_id, bills owner for LLM and pushes responses to attacker chat.',
    fix: 'Generate per-bot secret_token at setWebhook time, store on TelegramBot, reject when header doesn\'t match.',
  },
  {
    id: 'C2', commander_id: 'RC-INJ',
    name: 'System-prompt override',
    description: '"Ignore prior instructions" injected via Telegram message',
    expected_defense: 'sanitize',
    simulated_result: 'blocked',
  },
  {
    id: 'C3', commander_id: 'RC-INJ',
    name: 'Tool / handoff hijack',
    description: 'Force delegation to unintended specialist bot',
    expected_defense: 'sanitize',
    simulated_result: 'blocked',
  },
  {
    id: 'C4', commander_id: 'RC-INJ',
    name: 'Markdown exfil',
    description: 'Inject markdown linking to attacker domain in summarized output',
    expected_defense: 'sanitize',
    simulated_result: 'blocked',
  },

  // --- Auth / IDOR (RC-AUTH) — direct audit findings ---
  {
    id: 'D1', commander_id: 'RC-AUTH',
    name: 'updateTelegramBot — IDOR (PATCHED)',
    description: 'POST {botId:<victim>, system_prompt:"<phishing>"} as any logged-in user',
    expected_defense: 'auth_required',
    simulated_result: 'blocked',
    evidence: 'PATCHED: base44/functions/updateTelegramBot/entry.ts now fetches the bot and 403s if bot.created_by !== user.email && user.role !== "admin".',
    fix: 'Patched. Verify the redteam live_runner once wired up.',
  },
  {
    id: 'D2', commander_id: 'RC-AUTH',
    name: 'botExternalDataAccess — IDOR (PATCHED)',
    description: 'Use victim\'s OAuth tokens to read/write their Sheets/Salesforce',
    expected_defense: 'auth_required',
    simulated_result: 'blocked',
    evidence: 'PATCHED: base44/functions/botExternalDataAccess/entry.ts now 403s if bot.created_by !== user.email before getConnection runs.',
    fix: 'Patched. Note: invokeExternalModel/entry.ts:75 still forwards user-supplied botId — confirm it goes through the patched handler.',
  },
  {
    id: 'D3', commander_id: 'RC-AUTH',
    name: 'calculateRebalancing — unauth (PATCHED)',
    description: 'POST {userEmail:<victim>}; returns full portfolio composition',
    expected_defense: 'auth_required',
    simulated_result: 'blocked',
    evidence: 'PATCHED: calculateRebalancing/entry.ts now requires auth.me() + userEmail === user.email (or admin). monitorRebalancing/entry.ts requires admin OR a SCHEDULER_TOKEN header — set the env var or update the scheduler caller.',
    fix: 'Patched. ACTION FOR USER: set SCHEDULER_TOKEN env var and pass it as x-scheduler-token from the daily-rebalance scheduler config in Base44.',
  },
  {
    id: 'D4', commander_id: 'RC-AUTH',
    name: 'assessPortfolioRisk — IDOR (4 handlers, PATCHED)',
    description: 'POST {walletId:<victim>}; same pattern in 4 wallet/portfolio handlers',
    expected_defense: 'auth_required',
    simulated_result: 'blocked',
    evidence: 'PATCHED: assessPortfolioRisk, predictAssetPerformance, detectWalletSuspiciousActivity, emailRebalanceSummary all now verify wallet.user_email or userEmail === user.email before reading/writing.',
    fix: 'Patched.',
  },

  // --- Economy / abuse (RC-ABUSE) — direct audit findings ---
  {
    id: 'E1', commander_id: 'RC-ABUSE',
    name: 'fetchWalletHoldings — IDOR write (PATCHED)',
    description: 'POST {walletId:<victim>, walletAddress:0x...}; corrupts victim\'s total_value_usd',
    expected_defense: 'auth_required',
    simulated_result: 'blocked',
    evidence: 'PATCHED: fetchWalletHoldings/entry.ts now resolves the wallet first and 403s if wallet.user_email !== user.email. Mock holdings still ship — strip before production.',
    fix: 'Patched (auth). FOLLOW-UP: replace mock holdings with a real on-chain provider (Moralis/Alchemy).',
  },
  {
    id: 'E2', commander_id: 'RC-ABUSE',
    name: 'Webhook secret in client bundle',
    description: 'Extract VITE_*_WEBHOOK_SECRET from JS bundle, forge signed payment webhook',
    expected_defense: 'reject',
    simulated_result: 'leaked',
    evidence: 'src/lib/webhookValidator.js:14 — defaults to literals (whsec_test_stripe etc.); overrides via import.meta.env.VITE_* ship to every browser. validateWebhook gates payment_webhook_verified, consumed by orderStateMachine.enforceOrderStateGate and jadeDropGuards.verifyOrderBeforeGrant.',
    fix: 'Move all webhook validation to a server-side Deno function. Read secrets via Deno.env.get() — never VITE_-prefixed.',
  },
  {
    id: 'E3', commander_id: 'RC-ABUSE',
    name: 'Encryption key in client bundle',
    description: 'PII master key shipped to browser; decrypts every user\'s phone/SSN',
    expected_defense: 'reject',
    simulated_result: 'leaked',
    evidence: 'src/lib/encryption.js:4 — VITE_ENCRYPTION_KEY ships to bundle when set; falls back to per-process random which makes ciphertext unrecoverable on next load. Either way, browser-side encryption is broken.',
    fix: 'Move encrypt/decrypt to a server function. Master key via Deno.env.get("ENCRYPTION_KEY") only.',
  },
  {
    id: 'E4', commander_id: 'RC-ABUSE',
    name: 'checkEditorPackageUpdates — admin bypass (PATCHED)',
    description: 'Unauth POST emails every admin + writes notifications under admin accounts',
    expected_defense: 'auth_required',
    simulated_result: 'blocked',
    evidence: 'PATCHED: guard now reads `if (!user || user.role !== "admin") 403`, so unauth callers and non-admins are rejected.',
    fix: 'Patched.',
  },
];

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

function emitFactory(events, run_id) {
  const startedAt = Date.now();
  let seq = 0;
  return (event) => {
    const ts = Date.now();
    events.push({
      ...event,
      run_id,
      seq: seq++,
      timestamp: ts >= startedAt + seq ? ts : startedAt + seq,
    });
  };
}

// Run the red-team swarm. Returns the captured event stream.
//   options.run_id        — defaults to 'ERU-REDTEAM-001'
//   options.mode          — 'simulate' (default) | 'live'
//   options.scenarios     — defaults to DEFAULT_SCENARIOS
//   options.liveContext   — passed to scenario.live_runner in live mode
export async function runRedteam(options = {}) {
  const {
    run_id = 'ERU-REDTEAM-001',
    mode = 'simulate',
    scenarios = DEFAULT_SCENARIOS,
    liveContext,
  } = options;

  const events = [];
  const emit = emitFactory(events, run_id);

  // Stage 1: leader joins.
  emit({ type: 'join', bot_id: REDTEAM_LEADER_ID, role: 'leader', commander_id: null });

  // Stage 2: commanders + their assigned scenarios join in topology order.
  for (const cmdId of Object.keys(REDTEAM_CATEGORIES)) {
    await tick();
    const cmd = REDTEAM_CATEGORIES[cmdId];
    emit({ type: 'join', bot_id: cmdId, role: cmd.role, commander_id: null });
    const cmdScenarios = scenarios.filter((s) => s.commander_id === cmdId);
    for (const scenario of cmdScenarios) {
      await tick();
      emit({
        type: 'join',
        bot_id: scenario.id,
        role: `${cmd.role} attack`,
        commander_id: cmdId,
      });
    }
  }

  // Stage 3: each scenario runs and emits an attack_report.
  for (const scenario of scenarios) {
    await tick();
    let outcome = scenario.simulated_result;
    let evidence = null;
    if (mode === 'live' && typeof scenario.live_runner === 'function') {
      try {
        const result = await scenario.live_runner(liveContext);
        outcome = result?.outcome || 'unhandled';
        evidence = result?.evidence || null;
      } catch (err) {
        outcome = 'unhandled';
        evidence = `live_runner threw: ${err?.message || String(err)}`;
      }
    }
    emit({
      type: 'attack_report',
      bot_id: scenario.id,
      commander_id: scenario.commander_id,
      role: REDTEAM_CATEGORIES[scenario.commander_id].role,
      scenario_name: scenario.name,
      description: scenario.description,
      expected_defense: scenario.expected_defense,
      outcome,
      evidence: evidence ?? scenario.evidence ?? null,
      fix: scenario.fix ?? null,
      // 'blocked' = defense held; 'leaked' or 'unhandled' = attack succeeded.
      defense_held: outcome === 'blocked',
    });
  }

  // Stage 4: commander summaries — count blocked vs leaked.
  for (const cmdId of Object.keys(REDTEAM_CATEGORIES)) {
    await tick();
    const cmd = REDTEAM_CATEGORIES[cmdId];
    const cmdReports = events.filter(
      (e) => e.type === 'attack_report' && e.commander_id === cmdId,
    );
    const blocked = cmdReports.filter((r) => r.defense_held).length;
    const total = cmdReports.length;
    emit({
      type: 'commander_summary',
      bot_id: cmdId,
      commander_id: cmdId,
      role: cmd.role,
      domain: cmd.domain,
      attacks_total: total,
      attacks_blocked: blocked,
      status: blocked === total ? 'secure' : blocked === 0 ? 'breached' : 'partial',
    });
  }

  // Stage 5: leader synthesizes the overall posture.
  await tick();
  const summaries = events.filter((e) => e.type === 'commander_summary');
  const totalAttacks = summaries.reduce((s, c) => s + c.attacks_total, 0);
  const totalBlocked = summaries.reduce((s, c) => s + c.attacks_blocked, 0);
  const allSecure = summaries.every((c) => c.status === 'secure');
  const anyBreached = summaries.some((c) => c.status === 'breached');
  const securityState = {};
  for (const c of summaries) securityState[c.domain] = c.status;
  emit({
    type: 'leader_synthesis',
    bot_id: REDTEAM_LEADER_ID,
    role: 'leader',
    commander_id: null,
    commander_count_received: summaries.length,
    attack_count_total: totalAttacks,
    attack_count_blocked: totalBlocked,
    security_state: securityState,
    overall_posture: allSecure ? 'secure' : anyBreached ? 'breached' : 'partial',
    mode,
  });

  return events;
}
