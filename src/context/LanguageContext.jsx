import { createContext, useContext, useState, useEffect } from 'react';
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

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    // Try localStorage first
    const saved = localStorage.getItem('app_language');
    if (saved && translations[saved]) return saved;
    
    // Auto-detect from browser
    const browserLang = navigator.language.split('-')[0];
    if (translations[browserLang]) return browserLang;
    
    // Fallback to English
    return 'en';
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('app_language', lang);
  }, [lang]);

  const t = (key) => {
    const keys = key.split('.');
    let value = translations[lang];
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}