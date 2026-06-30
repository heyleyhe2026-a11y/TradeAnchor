import logger from '../lib/logger';

// --- Types ---

export interface CalendarEvent {
  /** Event name, e.g. "Non-Farm Payrolls", "FOMC Rate Decision" */
  event: string;
  /** Full date string for display, e.g. "2026-06-05 20:30" */
  date: string;
  /** ISO date only, e.g. "2026-06-05" */
  isoDate: string;
  /** Time only, e.g. "20:30" or "" if time unknown */
  time: string;
  /** Country/region code, e.g. "US", "EU", "CN" */
  country: string;
  /** Currency involved, e.g. "USD", "EUR" */
  currency?: string;
  /** Expected impact level: "high", "medium", "low" */
  impact: 'high' | 'medium' | 'low';
  /** Consensus/forecast value (if available) */
  consensus?: string;
  /** Previous value (if available) */
  previous?: string;
}

export type CalendarProvider = 'finnhub' | 'alpha_vantage';

// --- Provider implementations ---

interface CalendarProviderFetchFn {
  (fromDate: string, toDate: string): Promise<CalendarEvent[]>;
}

/** Finnhub free tier: 60 calls/min. Register at https://finnhub.io for API key */
async function fetchFromFinnhub(
  fromDate: string,
  toDate: string,
): Promise<CalendarEvent[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return [];

  const url = `https://finnhub.io/api/v1/calendar/economic?from=${fromDate}&to=${toDate}&token=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn(`Finnhub calendar API error: ${res.status}`);
      return [];
    }
    const data = await res.json() as Record<string, unknown>[];

    if (!Array.isArray(data)) return [];

    const impactMap: Record<string, CalendarEvent['impact']> = { high: 'high', medium: 'medium', low: 'low' };

    return data.map((item) => ({
      event: String(item.event ?? ''),
      date: `${String(item.time ?? '')} ${String(item.time ?? '')}`.trim()
        ? `${String(item.date ?? '')} ${String(item.time ?? '')}`
        : String(item.date ?? ''),
      isoDate: String(item.date ?? ''),
      time: String(item.time ?? ''),
      country: String(item.country ?? ''),
      currency: String(item.currency ?? ''),
      impact: impactMap[String(item.impact ?? '') as keyof typeof impactMap] || 'medium',
      consensus: item.actual != null ? String(item.actual) : undefined,
      previous: item.previous != null ? String(item.previous) : undefined,
    })).filter((e) => e.event.length > 0 && e.isoDate.length > 0);
  } catch (err) {
    logger.error('Failed to fetch economic calendar from Finnhub', err as Error);
    return [];
  }
}

/** Alpha Vantage ECONOMIC_CALENDAR endpoint */
async function fetchFromAlphaVantage(
  fromDate: string,
  toDate: string,
): Promise<CalendarEvent[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return [];

  const url = `https://www.alphavantage.co/query?function=ECONOMIC_CALENDAR&from=${fromDate}&to=${toDate}&apikey=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn(`AlphaVantage calendar API error: ${res.status}`);
      return [];
    }
    const json = await res.json() as Record<string, unknown>;
    // Alpha Vantage returns { "data": [...] } format
    const raw = (json.data || []) as Record<string, unknown>[];

    if (!Array.isArray(raw) || raw.length === 0) return [];

    return raw.map((item) => {
      const geo = String(item.geo ?? item.geo_region ?? '');
      const impRaw = String(item.impact ?? '').toLowerCase();
      let impact: CalendarEvent['impact'] = 'medium';
      if (impRaw.includes('high') || impRaw.includes('-')) impact = 'high';
      else if (impRaw.includes('low') || impRaw.includes('+')) impact = 'low';

      return {
        event: String(item.description ?? item.event ?? ''),
        date: `${String(item.date_local_time ?? item.date ?? '')} ${String(item.time ?? '')}`.trim(),
        isoDate: String(item.date ?? String(item.date_local_time).split(' ')[0] ?? ''),
        time: String(item.time ?? ''),
        country: geo,
        currency: String(item.country_code ?? ''),
        impact,
        consensus: item.consensus != null ? String(item.consensus) : undefined,
        previous: item.actual_previous_value != null
          ? String(item.actual_previous_value)
          : undefined,
      };
    }).filter((e) => e.event.length > 0 && e.isoDate.length > 0);
  } catch (err) {
    logger.error('Failed to fetch economic calendar from Alpha Vantage', err as Error);
    return [];
  }
}

// --- Main Service ---

const PROVIDERS: Record<CalendarProvider, CalendarProviderFetchFn> = {
  finnhub: fetchFromFinnhub,
  alpha_vantage: fetchFromAlphaVantage,
};

class EconomicCalendarService {
  private cache: { events: CalendarEvent[]; fetchedAt: number } | null = null;
  private readonly CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

  /**
   * Get economic events for a date range.
   * Results are cached for 6 hours to reduce API calls.
   *
   * @param daysForward - number of days from today to look ahead (default 7)
   * @returns Array of calendar events (empty array if no provider configured / errors)
   */
  async getUpcomingEvents(daysForward: number = 7): Promise<CalendarEvent[]> {
    // Check cache
    if (this.cache && Date.now() - this.cache.fetchedAt < this.CACHE_TTL_MS) {
      logger.debug('Economic calendar: returning cached result');
      return this.cache.events;
    }

    const now = new Date();
    const from = this.formatISO(now);
    const to = this.formatISO(this.addDays(now, daysForward));

    // Determine which provider(s) to use
    const provider = (process.env.ECONOMIC_CALENDAR_PROVIDER as CalendarProvider) || 'finnhub';
    const fallbackProvider: CalendarProvider = provider === 'finnhub' ? 'alpha_vantage' : 'finnhub';

    // Try primary provider
    let events = await PROVIDERS[provider](from, to);

    // Fallback to secondary provider if primary returned empty
    if (events.length === 0 && provider !== fallbackProvider) {
      logger.info(`${provider} returned empty, trying fallback: ${fallbackProvider}`);
      events = await PROVIDERS[fallbackProvider](from, to);
    }

    // Sort by date ascending
    events.sort((a, b) => a.isoDate.localeCompare(b.isoDate));

    if (events.length > 0) {
      logger.info(`Economic calendar: loaded ${events.length} events (${from} ~ ${to})`);
    } else {
      logger.info('Economic calendar: no events found — check FINNHUB_API_KEY or ALPHA_VANTAGE_API_KEY');
    }

    // Update cache
    this.cache = { events, fetchedAt: Date.now() };

    return events;
  }

  /**
   * Format events into a text block suitable for injection into AI prompt.
   * This is the main method called by ai-report.service.ts.
   */
  async getPromptText(isZh: boolean): Promise<string> {
    const events = await this.getUpcomingEvents(7);

    if (events.length === 0) {
      return isZh
        ? '\n【📅 实时经济日历】暂无可用数据（未配置经济日历API密钥）。请将不确定的事件日期标记为"TBD"。'
        : '\n[📅 Real-Time Economic Calendar] No data available (no API key configured). Mark uncertain event dates as "TBD".';
    }

    // Filter to high + medium impact events only, keep at most 10 most important
    const important = events
      .filter((e) => e.impact === 'high' || e.impact === 'medium')
      .slice(0, 15);

    if (isZh) {
      const lines = important.map((e) => {
        const flag = this.getCountryFlag(e.country);
        const impactLabel = e.impact === 'high' ? '🔴 高影响' : e.impact === 'medium' ? '🟡 中影响' : '🟢 低影响';
        const extra = [e.consensus && `预期: ${e.consensus}`, e.previous && `前值: ${e.previous}`].filter(Boolean).join(', ');
        return `  - ${e.isoDate}${e.time ? ' ' + e.time : ''} | ${flag} ${e.event} | ${impactLabel}${extra ? ' (' + extra + ')' : ''}`;
      });
      return `\n【📅 实时经济日历数据（来自外部API）— 请直接使用以下真实日期，不要推算或编造】：\n${lines.join('\n')}\n\n⚠️ 以上为已确认的真实事件日期。如果需要补充其他不在列表中的事件，请将date字段标记为"TBD(待确认)"。`;
    }

    const lines = important.map((e) => {
      const flag = this.getCountryFlag(e.country);
      const impactLabel = e.impact === 'high' ? '🔴 High' : e.impact === 'medium' ? '🟡 Medium' : '🟢 Low';
      const extra = [e.consensus && `Consensus: ${e.consensus}`, e.previous && `Previous: ${e.previous}`].filter(Boolean).join(', ');
      return `  - ${e.isoDate}${e.time ? ' ' + e.time : ''} | ${flag} ${e.event} | ${impactLabel}${extra ? ' (' + extra + ')' : ''}`;
    });
    return `\n[📅 Real-Time Economic Calendar Data (from external API) — use these confirmed dates directly, do NOT calculate or fabricate]:\n${lines.join('\n')}\n\n⚠️ These are confirmed real dates. For any additional events not listed above, mark the date field as "TBD".`;
  }

  /**
   * Check if the service has any configured API key available.
   */
  isAvailable(): boolean {
    return !!(process.env.FINNHUB_API_KEY || process.env.ALPHA_VANTAGE_API_KEY);
  }

  /** Clear cached data (useful for testing or force-refresh) */
  clearCache(): void {
    this.cache = null;
  }

  // --- Private helpers ---

  private addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  private formatISO(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private getCountryFlag(countryCode: string): string {
    const flags: Record<string, string> = {
      US: '🇺🇸', EU: '🇪🇺', GB: '🇬🇧', CN: '🇨🇳', JP: '🇯🇵',
      DE: '🇩🇪', FR: '🇫🇷', IT: '🇮🇹', CA: '🇨🇦', AU: '🇦🇺',
      CH: '🇨🇭', IN: '🇮🇳', KR: '🇰🇷', BR: '🇧🇷', RU: '🇷🇺',
      NZ: '🇳🇿', ZA: '🇿🇦', MX: '🇲🇽', ES: '🇪🇸', NL: '🇳🇱',
    };
    const upper = countryCode.toUpperCase();
    return flags[upper] || countryCode;
  }
}

// Singleton export (follows project pattern like aiProviderService)
export const economicCalendarService = new EconomicCalendarService();
