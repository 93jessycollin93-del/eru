import { useState } from 'react';
import BiometricAuth from '../components/BiometricAuth';
import { useAuth } from '@/lib/AuthContext';
import { Shield, FileText, Bell, Download, ChevronRight, Lock, AlertTriangle, ExternalLink, Blocks, Fingerprint, Activity, ClipboardList, Volume2, Scale } from 'lucide-react';
import SoundSettings from '../components/SoundSettings';
import { useLanguage, LANGUAGES } from '@/context/LanguageContext';
import { Link } from 'react-router-dom';
import TelegramSettings from '../components/TelegramSettings';

const SECTIONS = [
  { icon: Shield, label: 'Security & 2FA', badge: 'Active' },
  { icon: Bell, label: 'Notifications', badge: null },
  { icon: Download, label: 'Export Trade History', badge: null },
  { icon: FileText, label: 'Documents & Disclaimers', badge: null },
  { icon: Lock, label: 'Session Timeout', badge: '15 min' },
];

function SettingsSheet({ type, onClose }) {
  const [tab, setTab] = useState('disclaimer');

  if (type === 'telegram') {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <button onClick={onClose} className="text-muted-foreground text-sm">← Back</button>
          <h3 className="font-medium text-sm">Telegram</h3>
          <span/>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <TelegramSettings />
        </div>
      </div>
    );
  }

  if (type === 'disclaimer') {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <button onClick={onClose} className="text-muted-foreground text-sm">← Back</button>
          <h3 className="font-medium text-sm">Legal Documents</h3>
          <span/>
        </div>
        <div className="flex border-b border-border overflow-x-auto">
          {['disclaimer','terms','privacy','tax'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2.5 text-xs font-medium capitalize whitespace-nowrap ${tab===t?'text-primary border-b-2 border-primary':'text-muted-foreground'}`}>
              {t === 'disclaimer' ? 'Non-Liability' : t === 'tax' ? 'Tax Notice' : t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 text-sm text-muted-foreground leading-relaxed space-y-4">
          {tab === 'disclaimer' && <>
            <h4 className="text-foreground font-semibold">Non-Liability Disclaimer</h4>
            <p>This platform does not provide financial, investment, or legal advice. All trading and investment decisions are made solely by the user and at their own risk. Past performance of any asset does not guarantee future results.</p>
            <p>The platform is not responsible for any losses, damages, or adverse outcomes resulting from the use of this service. Cryptocurrency markets are highly volatile and speculative. You may lose some or all of your invested capital.</p>
            <div className="flex items-center gap-2 text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0"/>
              <p className="text-xs">Trading involves significant risk. Only invest what you can afford to lose.</p>
            </div>
          </>}
          {tab === 'terms' && <>
            <h4 className="text-foreground font-semibold">Terms of Use</h4>
            <p>By using this platform, you agree to comply with all applicable laws and regulations in your jurisdiction. Misuse of the platform, including fraudulent transactions or market manipulation, is strictly prohibited and may result in account suspension.</p>
            <p>We reserve the right to update these terms at any time. Continued use of the platform following updates constitutes acceptance of the revised terms.</p>
          </>}
          {tab === 'privacy' && <>
            <h4 className="text-foreground font-semibold">Privacy Policy</h4>
            <p>We collect only the information necessary to provide our services. We do not sell your personal data to third parties. All data is encrypted in transit and at rest.</p>
            <p>Transaction data is retained for regulatory compliance purposes. You may request export or deletion of your personal data at any time.</p>
          </>}
          {tab === 'tax' && <>
            <h4 className="text-foreground font-semibold">Tax Disclaimer</h4>
            <p>Users are solely responsible for reporting and paying any applicable taxes on gains from cryptocurrency trading, NFT sales, or other transactions conducted on this platform.</p>
            <p>We provide transaction history export to assist with tax reporting, but this does not constitute tax advice. Consult a qualified tax professional in your jurisdiction.</p>
          </>}
          <p className="text-xs text-muted-foreground/50 border-t border-border pt-4">Last updated: April 2026 · All documents are tied to your account and timestamped.</p>
        </div>
      </div>
    );
  }
}

export default function Settings() {
  const { lang, setLang } = useLanguage();
  const { currentUser } = useAuth();
  const [showSheet, setShowSheet] = useState(null);
  const [biometricOpen, setBiometricOpen] = useState(false);
  const [biometricAction, setBiometricAction] = useState('');
  const [showSoundSettings, setShowSoundSettings] = useState(false);

  const requireBiometric = (action, fn) => {
    setBiometricAction(action);
    setBiometricOpen(true);
    // fn stored via callback in onSuccess
    window._biometricCallback = fn;
  };

  if (showSheet) return <SettingsSheet type={showSheet} onClose={() => setShowSheet(null)} />;

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold">Settings</h2>
      </div>

      <div className="px-4 py-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-lg font-bold text-primary">T</div>
          <div>
            <p className="font-medium">Trader</p>
            <p className="text-xs text-muted-foreground">Premium Account</p>
          </div>
          <div className="ml-auto bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">PRO</div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Language</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(LANGUAGES).map(([code, name]) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                  lang === code
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card hover:border-primary/30'
                }`}>
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {SECTIONS.map((s, i) => (
            <button key={i} onClick={s.label.includes('Documents') ? () => setShowSheet('disclaimer') : undefined}
              className="w-full flex items-center px-4 py-3.5 gap-3 hover:bg-secondary/40 transition-colors">
              <s.icon className="w-4 h-4 text-muted-foreground"/>
              <span className="flex-1 text-sm text-left">{s.label}</span>
              {s.badge && <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{s.badge}</span>}
              <ChevronRight className="w-4 h-4 text-muted-foreground"/>
            </button>
          ))}
        </div>

        <div className="mt-4 bg-yellow-400/5 border border-yellow-400/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-yellow-400"/>
            <p className="text-sm font-medium text-yellow-400">Risk Warning</p>
          </div>
          <p className="text-xs text-muted-foreground">Cryptocurrency trading carries significant risk. This platform does not provide financial advice. All trading is at your own risk.</p>
        </div>

        {/* Biometric & security quick links */}
        <div className="mt-4 bg-card border border-border rounded-xl divide-y divide-border">
          <button onClick={() => requireBiometric('wallet access', () => {})} className="w-full flex items-center px-4 py-3.5 gap-3 hover:bg-secondary/40 transition-colors">
            <Fingerprint className="w-4 h-4 text-primary" />
            <span className="flex-1 text-sm text-left">Biometric Authentication</span>
            <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">FaceID / Touch</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
          <Link to="/audit" className="flex items-center px-4 py-3.5 gap-3 hover:bg-secondary/40 transition-colors">
            <ClipboardList className="w-4 h-4 text-muted-foreground" />
            <span className="flex-1 text-sm">Activity Audit Log</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
          <Link to="/performance" className="flex items-center px-4 py-3.5 gap-3 hover:bg-secondary/40 transition-colors">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <span className="flex-1 text-sm">Performance Monitor</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
          <Link to="/compliance" className="flex items-center px-4 py-3.5 gap-3 hover:bg-secondary/40 transition-colors">
            <Scale className="w-4 h-4 text-muted-foreground" />
            <span className="flex-1 text-sm">Compliance & Privacy</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        </div>

        {/* Sound & Haptics */}
        <div className="mt-4 space-y-2">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Sound & Haptics</p>
          {showSoundSettings ? (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Sound Settings</span>
                </div>
                <button onClick={() => setShowSoundSettings(false)} className="text-xs text-muted-foreground">Done</button>
              </div>
              <SoundSettings />
            </div>
          ) : (
            <button onClick={() => setShowSoundSettings(true)}
              className="w-full flex items-center px-4 py-3.5 gap-3 bg-card border border-border rounded-xl hover:bg-secondary/40 transition-colors">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1 text-sm text-left">Sound & Haptics</span>
              <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">3 Packs</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {currentUser?.role === 'admin' && (
          <div className="space-y-2 mt-4">
            <Link to="/admin/blockchain"
              className="w-full flex items-center gap-2 px-4 py-3 text-primary text-sm font-medium border border-primary/20 bg-primary/5 rounded-xl">
              <Blocks className="w-4 h-4" /> Blockchain Admin Panel
              <ChevronRight className="w-4 h-4 ml-auto" />
            </Link>
            <Link to="/security-dashboard"
              className="w-full flex items-center gap-2 px-4 py-3 text-orange-500 text-sm font-medium border border-orange-500/20 bg-orange-500/5 rounded-xl">
              <Activity className="w-4 h-4" /> Security Audit Log
              <ChevronRight className="w-4 h-4 ml-auto" />
            </Link>
          </div>
        )}
        <button className="w-full mt-3 py-3 text-red-400 text-sm font-medium border border-red-400/20 rounded-xl hover:bg-red-400/5 transition-colors">
          Sign Out
        </button>
      </div>
      <BiometricAuth
        open={biometricOpen}
        onClose={() => setBiometricOpen(false)}
        onSuccess={() => { window._biometricCallback?.(); }}
        action={biometricAction}
        userEmail={currentUser?.email}
      />
    </div>
  );
}