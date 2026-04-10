import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { PERMISSIONS } from '@/lib/rbac';
import RoleGate from '@/components/RoleGate';
import EconomicTrendChart from '../components/EconomicTrendChart';
import { Download, BarChart3, AlertCircle } from 'lucide-react';

export default function EconomicDashboard() {
  const { currentUser } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportStartDate, setExportStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [exportEndDate, setExportEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const handleExportPDF = async () => {
    if (!currentUser) return;

    setExporting(true);
    try {
      const result = await base44.functions.invoke('exportEconomicReportPDF', {
        startDate: new Date(exportStartDate).toISOString(),
        endDate: new Date(exportEndDate).toISOString(),
        includeAuditLog: true,
      });

      if (result.data.html) {
        const newWindow = window.open('', '_blank');
        newWindow.document.write(result.data.html);
        newWindow.document.close();
      }
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" /> Economic Dashboard
        </h2>
        <p className="text-xs text-muted-foreground mt-1">Real-time trends and reporting</p>
      </div>

      <div className="flex-1 px-4 py-4 space-y-6">
        {/* Charts Section */}
        <RoleGate permission={PERMISSIONS.VIEW_ECONOMY_LOGS}>
          <div>
            <h3 className="text-sm font-semibold mb-4">Transaction Trends</h3>
            <EconomicTrendChart userEmail={currentUser?.email} />
          </div>
        </RoleGate>

        {/* Export Section */}
        <RoleGate permission={PERMISSIONS.EXPORT_REPORTS}>
          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Download className="w-4 h-4" /> Export Report
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Start Date</label>
                <input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">End Date</label>
                <input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
              {exporting ? 'Exporting...' : 'Export as PDF'}
            </button>

            <p className="text-xs text-muted-foreground">
              Includes transaction history, audit trail, and professional formatting.
            </p>
          </div>
        </RoleGate>

        {/* Info Section */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Real-time Monitoring Active</p>
            <p>Your portfolio thresholds are being monitored. You'll receive notifications when values hit your configured limits.</p>
          </div>
        </div>
      </div>
    </div>
  );
}