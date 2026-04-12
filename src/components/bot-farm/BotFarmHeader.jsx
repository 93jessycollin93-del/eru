import { Factory, ShieldAlert, Activity } from 'lucide-react';

export default function BotFarmHeader({ metrics }) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Factory className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Bot Farm Command</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage a working bot workforce with real throughput, strain, integrity, and queue pressure.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-background px-3 py-2">
            <p className="text-[10px] text-muted-foreground">Output rate</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{metrics.output_rate}</p>
          </div>

          <div className="rounded-xl border border-border bg-background px-3 py-2">
            <p className="text-[10px] text-muted-foreground">Efficiency</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{metrics.system_efficiency}%</p>
          </div>

          <div className="col-span-2 rounded-xl border border-border bg-background px-3 py-2 sm:col-span-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <ShieldAlert className="w-3 h-3" />
              Alerts
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {metrics.security_alert_count + metrics.integrity_warning_count}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <Activity className="w-3.5 h-3.5 text-primary" />
        <span>
          Queue depth {metrics.task_queue_depth} · Mission progress {metrics.mission_progress}%
        </span>
      </div>
    </div>
  );
}