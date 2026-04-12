export const DEMO_SQUADS = [
  {
    name: 'Alpha Research Wing',
    farm_group: 'core-ops',
    specialization_focus: ['research', 'analysis', 'reporting'],
    coordination_quality: 84,
    security_overhead: 12,
    status: 'active',
    throughput_score: 81,
  },
  {
    name: 'Sentinel Security Net',
    farm_group: 'oversight',
    specialization_focus: ['security', 'verification', 'monitoring'],
    coordination_quality: 79,
    security_overhead: 18,
    status: 'active',
    throughput_score: 74,
  }
];

export const DEMO_BOTS = [
  {
    bot_id: 'BF-001',
    name: 'Harbor',
    role: 'research operator',
    farm_group: 'core-ops',
    specialty: 'research',
    level: 4,
    efficiency: 88,
    integrity: 92,
    confidence: 86,
    fatigue: 24,
    load: 58,
    uptime: 98,
    maintenance_status: 'healthy',
    output_quality: 87,
    risk_level: 'low',
    communication_status: 'clear',
    status: 'active',
    bandwidth: 82,
    coordination_efficiency: 84,
    max_concurrent_tasks: 2,
    system_health: 90
  },
  {
    bot_id: 'BF-002',
    name: 'Vector',
    role: 'monitoring agent',
    farm_group: 'oversight',
    specialty: 'monitoring',
    level: 3,
    efficiency: 79,
    integrity: 73,
    confidence: 75,
    fatigue: 61,
    load: 81,
    uptime: 94,
    maintenance_status: 'scheduled',
    output_quality: 68,
    risk_level: 'medium',
    communication_status: 'delayed',
    status: 'overloaded',
    bandwidth: 61,
    coordination_efficiency: 66,
    max_concurrent_tasks: 1,
    system_health: 70
  },
  {
    bot_id: 'BF-003',
    name: 'Ledger',
    role: 'verification unit',
    farm_group: 'oversight',
    specialty: 'verification',
    level: 5,
    efficiency: 91,
    integrity: 95,
    confidence: 90,
    fatigue: 16,
    load: 32,
    uptime: 99,
    maintenance_status: 'healthy',
    output_quality: 93,
    risk_level: 'low',
    communication_status: 'clear',
    status: 'idle',
    bandwidth: 87,
    coordination_efficiency: 88,
    max_concurrent_tasks: 2,
    system_health: 94
  },
  {
    bot_id: 'BF-004',
    name: 'Relay',
    role: 'communications relay',
    farm_group: 'support-grid',
    specialty: 'communications',
    level: 2,
    efficiency: 72,
    integrity: 64,
    confidence: 69,
    fatigue: 47,
    load: 43,
    uptime: 89,
    maintenance_status: 'required',
    output_quality: 63,
    risk_level: 'medium',
    communication_status: 'congested',
    status: 'maintenance',
    bandwidth: 54,
    coordination_efficiency: 59,
    max_concurrent_tasks: 1,
    system_health: 61
  },
  {
    bot_id: 'BF-005',
    name: 'Prism',
    role: 'analysis engine',
    farm_group: 'core-ops',
    specialty: 'analysis',
    level: 6,
    efficiency: 94,
    integrity: 88,
    confidence: 91,
    fatigue: 33,
    load: 67,
    uptime: 97,
    maintenance_status: 'healthy',
    output_quality: 90,
    risk_level: 'low',
    communication_status: 'clear',
    status: 'assigned',
    bandwidth: 85,
    coordination_efficiency: 86,
    max_concurrent_tasks: 2,
    system_health: 89
  }
];

export const DEMO_MISSIONS = [
  {
    title: 'Market anomaly surveillance',
    objective: 'Detect pricing irregularities, verify their source, and publish a compact alert package.',
    status: 'active',
    priority: 'high',
    progress: 62,
    mission_value: 180,
    coordination_complexity: 58,
    security_pressure: 34,
  },
  {
    title: 'Operations backlog stabilization',
    objective: 'Reduce queue depth across monitoring, sorting, and reporting tasks before next cycle.',
    status: 'planned',
    priority: 'medium',
    progress: 18,
    mission_value: 120,
    coordination_complexity: 46,
    security_pressure: 20,
  }
];

export const DEMO_TASKS = [
  {
    title: 'Gather cross-exchange spread data',
    description: 'Collect current spreads from priority venues and normalize the data.',
    work_type: 'data_gathering',
    priority: 'high',
    status: 'active',
    urgency: 82,
    risk: 28,
    expected_output_value: 86,
    bot_fit_score: 88,
    queue_bucket: 'research',
    estimated_load: 36,
    progress: 72
  },
  {
    title: 'Verify flagged transaction clusters',
    description: 'Run a verification pass on flagged wallet activity and detect contradictions.',
    work_type: 'verification',
    priority: 'critical',
    status: 'review',
    urgency: 91,
    risk: 69,
    expected_output_value: 92,
    bot_fit_score: 81,
    queue_bucket: 'security',
    estimated_load: 41,
    progress: 54
  },
  {
    title: 'Summarize overnight monitoring logs',
    description: 'Prepare a short report for command support with action recommendations.',
    work_type: 'reporting',
    priority: 'medium',
    status: 'pending',
    urgency: 55,
    risk: 15,
    expected_output_value: 58,
    bot_fit_score: 77,
    queue_bucket: 'reporting',
    estimated_load: 18,
    progress: 0
  },
  {
    title: 'Support queue sorting pass',
    description: 'Sort incoming requests by urgency, value, and escalation risk.',
    work_type: 'sorting',
    priority: 'medium',
    status: 'assigned',
    urgency: 64,
    risk: 18,
    expected_output_value: 51,
    bot_fit_score: 73,
    queue_bucket: 'support',
    estimated_load: 22,
    progress: 26
  }
];

export const DEMO_OUTPUTS = [
  {
    output_type: 'processed_intelligence',
    quality_score: 88,
    value_score: 84,
    summary: 'Prism consolidated high-signal market anomalies into a verified intelligence packet with low contradiction risk.'
  },
  {
    output_type: 'report',
    quality_score: 74,
    value_score: 66,
    summary: 'Harbor produced a concise overnight queue report with three recommended operator actions.'
  },
  {
    output_type: 'alert',
    quality_score: 81,
    value_score: 78,
    summary: 'Vector triggered a monitoring alert after sustained coordination delay in the security pipeline.'
  }
];

export const DEMO_RISKS = [
  {
    flag_type: 'integrity_drop',
    severity: 'warning',
    status: 'open',
    details: 'Relay integrity has fallen below the healthy threshold after repeated congested communication cycles.'
  },
  {
    flag_type: 'low_confidence',
    severity: 'warning',
    status: 'reviewing',
    details: 'Vector is producing lower-confidence monitoring judgments under overload conditions.'
  },
  {
    flag_type: 'anomaly',
    severity: 'critical',
    status: 'open',
    details: 'Verification stream detected a contradiction cluster requiring command review before mission completion.'
  }
];

export const DEMO_UPGRADES = [
  {
    name: 'Queue Throughput Bus',
    upgrade_type: 'capacity',
    level: 2,
    effect_value: 10,
    applied_to: 'farm'
  },
  {
    name: 'Verification Matrix',
    upgrade_type: 'verification_quality',
    level: 1,
    effect_value: 8,
    applied_to: 'squad'
  },
  {
    name: 'Fatigue Dampener',
    upgrade_type: 'fatigue_reduction',
    level: 1,
    effect_value: 7,
    applied_to: 'farm'
  }
];

export const DEMO_ACTIVITY = [
  {
    actor_type: 'farm',
    event_type: 'queue_rebalanced',
    summary: 'Operations queue rebalanced after overload threshold exceeded in oversight lane.',
    impact_score: 11
  },
  {
    actor_type: 'bot',
    event_type: 'maintenance_started',
    summary: 'Relay entered maintenance after repeated communication congestion.',
    impact_score: -6
  },
  {
    actor_type: 'system',
    event_type: 'upgrade_applied',
    summary: 'Queue Throughput Bus upgrade raised effective queue capacity across core farm lanes.',
    impact_score: 14
  }
];