export const THEME_TARGETS = {
  global: 'global',
  page: 'page',
  component: 'component',
};

export const DEFAULT_THEME_VARIABLES = {
  '--app-bg': 'hsl(var(--background))',
  '--page-bg': 'transparent',
  '--surface-bg': 'hsl(var(--card))',
  '--surface-foreground': 'hsl(var(--card-foreground))',
  '--button-bg': 'hsl(var(--primary))',
  '--button-foreground': 'hsl(var(--primary-foreground))',
  '--button-border': 'transparent',
  '--page-border': 'hsl(var(--border))',
};

export function buildBackgroundStyles(setting) {
  if (!setting || !setting.is_active) return {};
  if (setting.background_type === 'solid' && setting.background_value) {
    return { background: setting.background_value };
  }
  if (setting.background_type === 'gradient' && setting.background_value) {
    return {
      backgroundImage: setting.background_value,
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat',
    };
  }
  if (setting.background_type === 'image' && setting.background_value) {
    return {
      backgroundImage: `url(${setting.background_value})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    };
  }
  return {};
}

export function normalizeVariables(variables = {}) {
  return Object.entries(variables || {}).reduce((acc, [key, value]) => {
    if (!key || value === undefined || value === null || value === '') return acc;
    acc[key] = value;
    return acc;
  }, {});
}

export function mergeThemeSettings(globalSetting, pageSetting) {
  return {
    variables: {
      ...normalizeVariables(globalSetting?.variables),
      ...normalizeVariables(pageSetting?.variables),
    },
    globalBackground: buildBackgroundStyles(globalSetting),
    pageBackground: buildBackgroundStyles(pageSetting),
    globalMode: globalSetting?.theme_mode || 'inherit',
    pageMode: pageSetting?.theme_mode || 'inherit',
  };
}

export function applyRootVariables(variables = {}) {
  const root = document.documentElement;
  Object.entries(variables).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}