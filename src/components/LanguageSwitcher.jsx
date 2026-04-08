import { useLanguage, LANGUAGES } from '@/context/LanguageContext';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="relative group">
      <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground hover:bg-border transition-colors text-xs font-medium">
        <Globe className="w-3.5 h-3.5" />
        {lang.toUpperCase()}
      </button>
      <div className="absolute right-0 mt-1 w-40 bg-card border border-border rounded-lg shadow-lg z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
        {Object.entries(LANGUAGES).map(([code, name]) => (
          <button
            key={code}
            onClick={() => setLang(code)}
            className={`w-full text-left px-3 py-2 text-xs transition-colors first:rounded-t-lg last:rounded-b-lg ${
              lang === code
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-secondary text-foreground'
            }`}>
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}