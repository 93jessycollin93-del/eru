import { useLocation } from 'react-router-dom';
import { useTheme } from '@/context/ThemeContext';

export default function PageThemeLayer({ children }) {
  const location = useLocation();
  const { pageThemeStyles, pageThemeMap } = useTheme();
  const scopedStyles = pageThemeMap?.[location.pathname] || {};

  return (
    <div
      data-theme-page={location.pathname}
      className="min-h-full"
      style={{
        background: 'var(--page-bg)',
        ...pageThemeStyles,
        ...scopedStyles,
      }}
    >
      {children}
    </div>
  );
}