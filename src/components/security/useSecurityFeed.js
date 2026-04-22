import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

const SEVERITY_RANK = { info: 0, caution: 1, warning: 2, critical: 3 };
const SOURCE_LABELS = {
  audit: 'Audit Log',
  alert: 'Command Alert',
  risk: 'Risk Report',
  botflag: 'Bot Flag',
  integrity: 'Integrity',
};

function normaliseSeverity(raw) {
  if (!raw) return 'info';
  const s = String(raw).toLowerCase();
  if (s === 'high') return 'warning';
  if (s === 'low') return 'info';
  if (s === 'medium') return 'caution';
  if (SEVERITY_RANK[s] !== undefined) return s;
  return 'info';
}

function toIso(d) {
  if (!d) return new Date().toISOString();
  try { return new Date(d).toISOString(); } catch { return new Date().toISOString(); }
}

function mapAudit(r) {
  return {
    id: `audit:${r.id}`,
    source: 'audit',
    sourceLabel: SOURCE_LABELS.audit,
    severity: normaliseSeverity(r.severity),
    status: r.status || 'info',
    title: (r.event_type || 'security_event').replace(/_/g, ' '),
    description: r.details ? (typeof r.details === 'string' ? r.details : JSON.stringify(r.details)) : '',
    event_type: r.event_type,
    user_email: r.user_email,
    ip_address: r.ip_address,
    entity_id: null,
    created_date: toIso(r.created_date),
    actionable: false,
    raw: r,
  };
}

function mapAlert(r) {
  return {
    id: `alert:${r.id}`,
    source: 'alert',
    sourceLabel: SOURCE_LABELS.alert,
    severity: normaliseSeverity(r.severity),
    status: r.status || 'open',
    title: r.title || r.alert_type || 'alert',
    description: r.details ? (typeof r.details === 'string' ? r.details : JSON.stringify(r.details)) : '',
    event_type: r.alert_type,
    user_email: null,
    ip_address: null,
    entity_id: r.target_bot_code || r.target_squad || r.mission_id,
    created_date: toIso(r.created_date),
    actionable: true,
    raw: r,
  };
}

function mapRisk(r) {
  return {
    id: `risk:${r.id}`,
    source: 'risk',
    sourceLabel: SOURCE_LABELS.risk,
    severity: normaliseSeverity(r.risk_level),
    status: r.status || 'open',
    title: r.summary || 'risk report',
    description: r.recommended_action || '',
    event_type: 'risk_report',
    user_email: r.reported_by,
    ip_address: null,
    entity_id: r.target_bot_code || r.target_squad || r.mission_id,
    created_date: toIso(r.created_date),
    actionable: true,
    raw: r,
  };
}

function mapBotFlag(r) {
  return {
    id: `botflag:${r.id}`,
    source: 'botflag',
    sourceLabel: SOURCE_LABELS.botflag,
    severity: normaliseSeverity(r.severity),
    status: r.status || 'open',
    title: (r.flag_type || 'bot_flag').replace(/_/g, ' '),
    description: r.details ? (typeof r.details === 'string' ? r.details : JSON.stringify(r.details)) : '',
    event_type: r.flag_type,
    user_email: null,
    ip_address: null,
    entity_id: r.bot_id || r.squad_id || r.mission_id,
    created_date: toIso(r.created_date),
    actionable: true,
    raw: r,
  };
}

function mapIntegrity(r) {
  const score = Number.isFinite(r.integrity_score) ? r.integrity_score : 100;
  const sev = score < 50 ? 'critical' : score < 70 ? 'warning' : score < 90 ? 'caution' : 'info';
  return {
    id: `integrity:${r.id}`,
    source: 'integrity',
    sourceLabel: SOURCE_LABELS.integrity,
    severity: sev,
    status: 'open',
    title: r.anomaly_type ? `integrity: ${String(r.anomaly_type).replace(/_/g, ' ')}` : 'integrity check',
    description: r.details ? (typeof r.details === 'string' ? r.details : JSON.stringify(r.details)) : `score ${score}`,
    event_type: r.anomaly_type || 'integrity_check',
    user_email: null,
    ip_address: null,
    entity_id: r.bot_code || r.squad_name || r.mission_id,
    created_date: toIso(r.created_date),
    actionable: false,
    raw: r,
  };
}

async function safeFetch(fn) {
  try {
    const v = await fn();
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function useSecurityFeed({ live = true, intervalMs = 10000, windowLimit = 200 } = {}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isLive, setIsLive] = useState(live);
  const [sources, setSources] = useState({ audit: 0, alert: 0, risk: 0, botflag: 0, integrity: 0 });
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [audit, alert, risk, botflag, integrity] = await Promise.all([
        safeFetch(() => base44.entities.SecurityAuditLog?.list?.('-created_date', windowLimit)),
        safeFetch(() => base44.entities.CommandAlert?.list?.('-created_date', windowLimit)),
        safeFetch(() => base44.entities.RiskReport?.list?.('-created_date', windowLimit)),
        safeFetch(() => base44.entities.BotFarmRiskFlag?.list?.('-created_date', windowLimit)),
        safeFetch(() => base44.entities.IntegrityReport?.list?.('-created_date', windowLimit)),
      ]);

      const merged = [
        ...audit.map(mapAudit),
        ...alert.map(mapAlert),
        ...risk.map(mapRisk),
        ...botflag.map(mapBotFlag),
        ...integrity.map(mapIntegrity),
      ].sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());

      setEvents(merged);
      setSources({
        audit: audit.length,
        alert: alert.length,
        risk: risk.length,
        botflag: botflag.length,
        integrity: integrity.length,
      });
      setLastUpdate(new Date());
      setError(null);
    } catch (e) {
      setError(e?.message || 'Failed to load security feed');
    } finally {
      setLoading(false);
    }
  }, [windowLimit]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    clearInterval(timerRef.current);
    if (!isLive) return undefined;
    timerRef.current = setInterval(load, intervalMs);
    return () => clearInterval(timerRef.current);
  }, [isLive, intervalMs, load]);

  const applyAction = useCallback(async (event, action, extra = {}) => {
    const raw = event?.raw;
    if (!raw?.id) throw new Error('Event has no writable id');

    const statusFor = {
      acknowledge: 'acknowledged',
      resolve: 'resolved',
      reopen: 'open',
      review: 'reviewing',
    }[action];

    const payload = statusFor ? { ...extra, status: statusFor } : { ...extra };

    const target = {
      alert: base44.entities.CommandAlert,
      risk: base44.entities.RiskReport,
      botflag: base44.entities.BotFarmRiskFlag,
    }[event.source];

    if (!target?.update) throw new Error(`${event.source} is not writable`);

    await target.update(raw.id, payload);

    // Write an audit breadcrumb for the action — best-effort, never fatal.
    try {
      await base44.entities.SecurityAuditLog?.create?.({
        event_type: `soc_action_${action}`,
        severity: 'info',
        status: 'success',
        details: { source: event.source, target_id: raw.id, action, extra },
      });
    } catch { /* audit is best-effort */ }

    await load();
  }, [load]);

  const setLive = useCallback((v) => setIsLive(Boolean(v)), []);

  return useMemo(() => ({
    events,
    loading,
    error,
    lastUpdate,
    isLive,
    setLive,
    sources,
    refresh: load,
    applyAction,
  }), [events, loading, error, lastUpdate, isLive, setLive, sources, load, applyAction]);
}

export { SEVERITY_RANK, SOURCE_LABELS };
