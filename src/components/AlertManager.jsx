import { useState, useEffect, useMemo } from 'react';
import { Bell, Plus, Trash2, Check, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useDashboardEvents } from '@/context/DashboardEventsContext';

export default function AlertManager() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ asset_symbol: '', alert_type: 'above', threshold_price: '' });
  const [creating, setCreating] = useState(false);
  const [pulse, setPulse] = useState(false);
  const { subscribe, emit, rules } = useDashboardEvents();
  const activeRules = useMemo(() => rules.filter((rule) => rule.enabled && rule.target === 'alerts'), [rules]);

  useEffect(() => {
    fetchAlerts();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribe('alert-manager', (dashboardEvent) => {
      const matched = activeRules.some((rule) => rule.source === dashboardEvent.source && rule.event === dashboardEvent.event);
      if (!matched) return;
      setPulse(true);
      window.setTimeout(() => setPulse(false), 1200);
      fetchAlerts();

      if (dashboardEvent.source === 'market' && dashboardEvent.event === 'priceChange') {
        const matchedAlerts = alerts.filter((alert) => {
          const marketItem = (dashboardEvent.payload?.prices || []).find((price) => price.symbol === alert.asset_symbol);
          if (!marketItem) return false;
          return alert.alert_type === 'above'
            ? marketItem.price >= alert.threshold_price
            : marketItem.price <= alert.threshold_price;
        });

        if (matchedAlerts.length > 0) {
          emit('alerts', 'thresholdTriggered', { matchedAlerts });
          toast.success(`${matchedAlerts.length} alert rule${matchedAlerts.length > 1 ? 's' : ''} matched live market data`);
        }
      }
    });
    return unsubscribe;
  }, [subscribe, activeRules, alerts, emit]);

  const fetchAlerts = async () => {
    try {
      const user = await base44.auth.me();
      if (!user) return;
      const data = await base44.entities.PriceAlert.filter({ created_by: user.email });
      setAlerts(data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAlert = async () => {
    if (!formData.asset_symbol || !formData.threshold_price) {
      toast.error('Please fill all fields');
      return;
    }

    setCreating(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.PriceAlert.create({
        asset_symbol: formData.asset_symbol.toUpperCase(),
        alert_type: formData.alert_type,
        threshold_price: parseFloat(formData.threshold_price),
        is_active: true,
        user_email: user.email,
      });
      setFormData({ asset_symbol: '', alert_type: 'above', threshold_price: '' });
      setShowForm(false);
      toast.success('Price alert created');
      fetchAlerts();
    } catch (error) {
      toast.error('Failed to create alert');
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAlert = async (id) => {
    try {
      await base44.entities.PriceAlert.delete(id);
      toast.success('Alert deleted');
      fetchAlerts();
    } catch (error) {
      toast.error('Failed to delete alert');
    }
  };

  const handleToggleAlert = async (id, isActive) => {
    try {
      await base44.entities.PriceAlert.update(id, { is_active: !isActive });
      fetchAlerts();
    } catch (error) {
      toast.error('Failed to update alert');
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-card border border-border rounded-xl flex items-center justify-center h-32">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`bg-card border rounded-xl p-4 transition-all ${pulse ? 'border-primary shadow-[0_0_0_1px_hsl(var(--primary))]' : 'border-border'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Price Alerts</h3>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{alerts.filter(a => a.is_active).length}</span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20"
        >
          <Plus className="w-3 h-3" /> New Alert
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-3 bg-secondary rounded-lg border border-border/50 space-y-2">
          <input
            type="text"
            placeholder="BTC, ETH, DOGE..."
            value={formData.asset_symbol}
            onChange={e => setFormData({ ...formData, asset_symbol: e.target.value })}
            className="w-full px-3 py-2 bg-card border border-border rounded text-xs text-foreground placeholder-muted-foreground"
          />
          <div className="flex gap-2">
            <select
              value={formData.alert_type}
              onChange={e => setFormData({ ...formData, alert_type: e.target.value })}
              className="flex-1 px-3 py-2 bg-card border border-border rounded text-xs text-foreground"
            >
              <option value="above">Price Above</option>
              <option value="below">Price Below</option>
            </select>
            <input
              type="number"
              placeholder="Threshold ($)"
              value={formData.threshold_price}
              onChange={e => setFormData({ ...formData, threshold_price: e.target.value })}
              className="flex-1 px-3 py-2 bg-card border border-border rounded text-xs text-foreground placeholder-muted-foreground"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateAlert}
              disabled={creating}
              className="flex-1 py-2 bg-primary text-primary-foreground rounded text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 py-2 bg-secondary border border-border rounded text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {alerts.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No price alerts yet. Create one to monitor assets.</p>
      ) : (
        <div className="space-y-2">
          {alerts.map(alert => (
            <div key={alert.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${alert.is_active ? 'bg-green-500/5 border-green-500/20' : 'bg-secondary/50 border-border/50'}`}>
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">
                  {alert.asset_symbol} <span className="text-muted-foreground text-[9px]">{alert.alert_type === 'above' ? '↑' : '↓'}</span>
                </p>
                <p className="text-[10px] text-muted-foreground">${alert.threshold_price.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {alert.notification_sent && <Check className="w-3.5 h-3.5 text-green-400" />}
                <button
                  onClick={() => handleToggleAlert(alert.id, alert.is_active)}
                  className={`w-8 h-6 rounded transition-colors ${alert.is_active ? 'bg-green-500/20' : 'bg-secondary'}`}
                />
                <button
                  onClick={() => handleDeleteAlert(alert.id)}
                  className="p-1.5 hover:bg-red-500/10 rounded transition-colors"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}