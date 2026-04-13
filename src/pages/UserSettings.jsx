import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronRight, Globe, LogOut, Mail, Shield, SlidersHorizontal, User2, Workflow, Fingerprint } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage, LANGUAGES } from '@/context/LanguageContext';
import SoundSettings from '@/components/SoundSettings';

const DEFAULT_PREFS = {
  productUpdates: true,
  marketAlerts: true,
  emailNotifications: false,
  telegramNotifications: true,
};

function getInitials(name = '', email = '') {
  const source = name || email || 'U';
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';
}

function SectionCard({ title, subtitle, children }) {
  return (
    <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function ToggleRow({ icon: Icon, title, description, checked, onChange }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/20 px-3 py-3">
      <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${checked ? 'bg-primary' : 'bg-secondary border border-border'}`}
        aria-pressed={checked}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

export default function UserSettings() {
  const { currentUser, logout } = useAuth();
  const { lang, setLang } = useLanguage();
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profile, setProfile] = useState(() => ({
    displayName: currentUser?.full_name || '',
  }));

  const userEmail = currentUser?.email || '';
  const initials = useMemo(() => getInitials(currentUser?.full_name, currentUser?.email), [currentUser]);

  const handleProfileSave = async () => {
    setSavingProfile(true);
    await base44.auth.updateMe({ display_name: profile.displayName });
    setSavingProfile(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 py-4 border-b border-border bg-card/80 backdrop-blur-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Account</p>
        <h1 className="text-xl font-semibold text-foreground mt-1">User Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile, alerts, language, and connected tools.</p>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-3xl mx-auto">
        <SectionCard title="Profile" subtitle="Update how your account appears across the app.">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/20 p-3">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-lg font-semibold text-primary shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{currentUser?.full_name || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail || 'No email available'}</p>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Display name</span>
            <div className="relative">
              <User2 className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={profile.displayName}
                onChange={(e) => setProfile((prev) => ({ ...prev, displayName: e.target.value }))}
                placeholder="Your display name"
                className="w-full h-11 rounded-xl border border-border bg-card pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Email</span>
            <div className="relative">
              <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={userEmail}
                disabled
                className="w-full h-11 rounded-xl border border-border bg-secondary/40 pl-10 pr-3 text-sm text-muted-foreground"
              />
            </div>
          </label>

          <button
            onClick={handleProfileSave}
            disabled={savingProfile}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            {savingProfile ? 'Saving…' : 'Save profile'}
          </button>
        </SectionCard>

        <SectionCard title="Notification preferences" subtitle="Control how you hear from the app.">
          <div className="space-y-3">
            <ToggleRow icon={Bell} title="Market alerts" description="Price alerts, watchlist changes, and market triggers." checked={prefs.marketAlerts} onChange={(value) => setPrefs((prev) => ({ ...prev, marketAlerts: value }))} />
            <ToggleRow icon={Mail} title="Email notifications" description="Receive summaries and important account messages by email." checked={prefs.emailNotifications} onChange={(value) => setPrefs((prev) => ({ ...prev, emailNotifications: value }))} />
            <ToggleRow icon={Workflow} title="Telegram notifications" description="Keep bot-linked and mini-app updates active for Telegram use." checked={prefs.telegramNotifications} onChange={(value) => setPrefs((prev) => ({ ...prev, telegramNotifications: value }))} />
            <ToggleRow icon={SlidersHorizontal} title="Product updates" description="Hear about new tools, releases, and feature improvements." checked={prefs.productUpdates} onChange={(value) => setPrefs((prev) => ({ ...prev, productUpdates: value }))} />
          </div>
        </SectionCard>

        <SectionCard title="Language" subtitle="Choose the language used throughout the app.">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(LANGUAGES).map(([code, name]) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                className={`h-11 rounded-xl border text-sm font-medium transition-colors ${lang === code ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/30'}`}
              >
                {name}
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Integrations" subtitle="Access connected tools and app-linked services.">
          <div className="space-y-2">
            <Link to="/tgapps" className="flex items-center gap-3 rounded-xl border border-border bg-secondary/20 px-3 py-3 hover:bg-secondary/40 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Workflow className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Telegram integrations</p>
                <p className="text-xs text-muted-foreground">Manage bot-linked app connections and deployment tools.</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <Link to="/settings" className="flex items-center gap-3 rounded-xl border border-border bg-secondary/20 px-3 py-3 hover:bg-secondary/40 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">System settings</p>
                <p className="text-xs text-muted-foreground">Open advanced app, privacy, visual, and admin controls.</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          </div>
        </SectionCard>

        <SectionCard title="Security & experience" subtitle="Quick access to the tools most users need often.">
          <div className="grid gap-2 sm:grid-cols-2">
            <Link to="/performance" className="flex items-center gap-3 rounded-xl border border-border bg-secondary/20 px-3 py-3 hover:bg-secondary/40 transition-colors">
              <Shield className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm text-foreground">Performance</span>
            </Link>
            <Link to="/compliance" className="flex items-center gap-3 rounded-xl border border-border bg-secondary/20 px-3 py-3 hover:bg-secondary/40 transition-colors">
              <Fingerprint className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm text-foreground">Privacy & compliance</span>
            </Link>
          </div>
          <div className="rounded-xl border border-border bg-secondary/20 p-3">
            <SoundSettings />
          </div>
        </SectionCard>

        <button
          onClick={() => logout(true)}
          className="w-full h-11 rounded-xl border border-red-400/20 text-red-400 text-sm font-medium hover:bg-red-400/5 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}