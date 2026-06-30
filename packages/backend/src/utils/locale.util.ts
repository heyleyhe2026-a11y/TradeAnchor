import { Request } from 'express';
import { PreferencesService } from '../services/preferences.service';

/** Normalized UGC content locale — only en / zh supported in MVP */
export type ContentLocale = 'en' | 'zh';

export function normalizeContentLocale(locale?: string | null): ContentLocale {
  if (!locale) return 'en';
  const lower = locale.toLowerCase();
  if (lower.startsWith('zh')) return 'zh';
  return 'en';
}

/** API locale string sent by frontend */
export function toApiLocale(locale: ContentLocale): string {
  return locale === 'zh' ? 'zh-CN' : 'en';
}

/**
 * Resolve display locale for UGC: query param → user preferences → default en.
 */
export async function resolveRequestLocale(req: Request): Promise<ContentLocale> {
  const queryLocale = req.query.locale;
  if (typeof queryLocale === 'string' && queryLocale.trim()) {
    return normalizeContentLocale(queryLocale);
  }

  const userId = (req as Request & { user?: { id: string } }).user?.id;
  if (userId) {
    try {
      const prefs = await PreferencesService.get(userId);
      return normalizeContentLocale(prefs.locale);
    } catch {
      return 'en';
    }
  }

  return 'en';
}
