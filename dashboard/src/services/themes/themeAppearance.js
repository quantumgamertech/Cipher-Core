export const DEFAULT_THEME_APPEARANCE = Object.freeze({
  themeId: 'Default',
  colors: Object.freeze(['#24eaff', '#477bff']),
  locked: false,
});

export const THEME_APPEARANCE_STORAGE_KEY = 'cipher.themeAppearance';

export function normalizeThemeAppearance(value) {
  const colors = Array.isArray(value?.colors)
    && value.colors.length === 2
    && value.colors.every((color) => /^#[0-9a-f]{6}$/i.test(String(color)))
    ? value.colors.map(String)
    : [...DEFAULT_THEME_APPEARANCE.colors];

  return {
    themeId: String(value?.themeId || DEFAULT_THEME_APPEARANCE.themeId),
    colors,
    locked: Boolean(value?.locked),
  };
}

export function previewThemeAppearance(current, theme) {
  const active = normalizeThemeAppearance(current);
  if (active.locked) return active;
  return normalizeThemeAppearance({
    themeId: theme.id,
    colors: theme.colors,
    locked: false,
  });
}

export function readThemeAppearance(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage?.getItem(THEME_APPEARANCE_STORAGE_KEY) || 'null');
    return saved?.locked
      ? normalizeThemeAppearance(saved)
      : { ...DEFAULT_THEME_APPEARANCE, colors: [...DEFAULT_THEME_APPEARANCE.colors] };
  } catch {
    return { ...DEFAULT_THEME_APPEARANCE, colors: [...DEFAULT_THEME_APPEARANCE.colors] };
  }
}

export function storeThemeAppearance(appearance, storage = globalThis.localStorage) {
  const normalized = normalizeThemeAppearance(appearance);
  if (!normalized.locked) {
    storage?.removeItem(THEME_APPEARANCE_STORAGE_KEY);
    return normalized;
  }
  storage?.setItem(THEME_APPEARANCE_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function resetThemeAppearance(storage = globalThis.localStorage) {
  storage?.removeItem(THEME_APPEARANCE_STORAGE_KEY);
  return { ...DEFAULT_THEME_APPEARANCE, colors: [...DEFAULT_THEME_APPEARANCE.colors] };
}
