export interface ContentCardTheme {
  accent: string;
  accentSoft: string;
  chipBg: string;
  chipColor: string;
  gradient: string;
}

export const AUTO_ACCENT_PALETTE = [
  '#00d4aa',
  '#38bdf8',
  '#a78bfa',
  '#f59e0b',
  '#fb923c',
  '#34d399',
  '#f472b6',
  '#22d3ee',
] as const;

export function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function buildAutoTheme(key: string): ContentCardTheme {
  const accent = AUTO_ACCENT_PALETTE[hashString(key) % AUTO_ACCENT_PALETTE.length];
  return {
    accent,
    accentSoft: hexToRgba(accent, 0.14),
    chipBg: hexToRgba(accent, 0.16),
    chipColor: accent,
    gradient: `linear-gradient(135deg, ${hexToRgba(accent, 0.22)} 0%, ${hexToRgba(accent, 0.04)} 100%)`,
  };
}

/** Shared card shell styles (Blog + Community Plaza). */
export function getContentCardSx(theme: ContentCardTheme) {
  return {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    bgcolor: 'rgba(15,23,42,0.55)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 2.5,
    overflow: 'hidden',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
    '&:hover': {
      transform: 'translateY(-3px)',
      borderColor: `${theme.accent}55`,
      boxShadow: `0 12px 32px rgba(0,0,0,0.35), 0 0 0 1px ${theme.accentSoft}`,
      '& .content-card-title': { color: theme.accent },
    },
  } as const;
}

export function getThemedChipSx(theme: ContentCardTheme) {
  return {
    height: 24,
    fontSize: 11,
    fontWeight: 600,
    bgcolor: theme.chipBg,
    color: theme.chipColor,
    border: `1px solid ${theme.accent}33`,
  } as const;
}

/** Derive accent from first tag, or playbook id for variety. */
export function getPlaybookCardTheme(playbook: { id: string; tags?: string[] }): ContentCardTheme {
  const key = playbook.tags?.[0] || playbook.id;
  return buildAutoTheme(key);
}
