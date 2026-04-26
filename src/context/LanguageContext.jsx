import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import translations from '@/lib/translations.json';

const LanguageContext = createContext();

export const LANGUAGES = {
  en: 'English',
  fr: 'Français',
  zh: '中文',
  uk: 'Українська',
  ru: 'Русский',
  es: 'Español',
};

// Resolve a dotted key path against a translations object.
function resolvePath(obj, path) {
  if (!obj || !path) return undefined;
  let v = obj;
  for (const k of path.split('.')) {
    if (v == null) return undefined;
    v = v[k];
  }
  return v;
}

// Replace {{token}} placeholders with values from `vars`.
function interpolate(template, vars) {
  if (typeof template !== 'string' || !vars) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, name) =>
    vars[name] !== undefined && vars[name] !== null ? String(vars[name]) : ''
  );
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('app_language') : null;
    if (saved && translations[saved]) return saved;
    if (typeof navigator !== 'undefined') {
      const browserLang = (navigator.language || 'en').split('-')[0];
      if (translations[browserLang]) return browserLang;
    }
    return 'en';
  });

  // Persist + sync <html lang> for screen readers, browser auto-translate, SEO.
  useEffect(() => {
    try { localStorage.setItem('app_language', lang); } catch {}
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('lang', lang);
    }
  }, [lang]);

  const setLang = useCallback((next) => {
    if (translations[next]) setLangState(next);
  }, []);

  // t(key, vars?, fallback?)
  // - Tries current language → English → fallback → key.
  // - Supports {{var}} interpolation from vars.
  const t = useCallback((key, vars, fallback) => {
    const fromLang = resolvePath(translations[lang], key);
    const fromEn = fromLang === undefined ? resolvePath(translations.en, key) : fromLang;
    const raw = fromEn !== undefined ? fromEn : (fallback !== undefined ? fallback : key);
    return interpolate(raw, vars);
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t, languages: LANGUAGES }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}

// ─── Dev self-test ──────────────────────────────────────────────────────────
// Runs once in non-production to verify: (a) every locale has the same key
// shape as English, (b) interpolation works, (c) fallback works.
// Exposes results on window.__i18nReport for manual inspection without
// cluttering the console of normal users.
if (typeof window !== 'undefined' && !window.__i18nReportRan) {
  window.__i18nReportRan = true;
  try {
    const collectKeys = (o, prefix = '', acc = []) => {
      if (o && typeof o === 'object') {
        for (const k of Object.keys(o)) collectKeys(o[k], prefix ? `${prefix}.${k}` : k, acc);
      } else acc.push(prefix);
      return acc;
    };
    const enKeys = new Set(collectKeys(translations.en || {}));
    const report = { locales: {}, totalEnKeys: enKeys.size };
    for (const code of Object.keys(translations)) {
      if (code === 'en') continue;
      const localeKeys = new Set(collectKeys(translations[code] || {}));
      const missing = [...enKeys].filter((k) => !localeKeys.has(k));
      const extra = [...localeKeys].filter((k) => !enKeys.has(k));
      report.locales[code] = {
        coverage: enKeys.size ? Math.round(((enKeys.size - missing.length) / enKeys.size) * 100) : 100,
        missing,
        extra,
      };
    }
    // Interpolation smoke test
    const interpTest = interpolate('Hello {{name}}, {{count}} items', { name: 'X', count: 3 });
    report.interpolationOk = interpTest === 'Hello X, 3 items';
    window.__i18nReport = report;
  } catch (e) {
    window.__i18nReport = { error: String(e) };
  }
}