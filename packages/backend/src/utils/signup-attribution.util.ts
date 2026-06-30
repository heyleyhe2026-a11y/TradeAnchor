import { z } from 'zod';

const MAX_FIELD = 120;
const MAX_URL = 500;

export const signupAttributionSchema = z.object({
  utmSource: z.string().max(MAX_FIELD).trim().optional(),
  utmMedium: z.string().max(MAX_FIELD).trim().optional(),
  utmCampaign: z.string().max(MAX_FIELD).trim().optional(),
  utmTerm: z.string().max(MAX_FIELD).trim().optional(),
  utmContent: z.string().max(MAX_FIELD).trim().optional(),
  referrer: z.string().max(MAX_URL).trim().optional(),
  landingPage: z.string().max(MAX_URL).trim().optional(),
});

export type SignupAttributionInput = z.infer<typeof signupAttributionSchema>;

export interface SignupAttributionData {
  signupChannel: string;
  signupUtmSource?: string;
  signupUtmMedium?: string;
  signupUtmCampaign?: string;
  signupUtmTerm?: string;
  signupUtmContent?: string;
  signupReferrer?: string;
  signupLandingPage?: string;
}

function emptyToUndefined(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Classify signup channel for reporting (organic, direct, referral, paid, social, email). */
export function deriveSignupChannel(input: SignupAttributionInput): string {
  const utmMedium = emptyToUndefined(input.utmMedium)?.toLowerCase();
  const utmSource = emptyToUndefined(input.utmSource)?.toLowerCase();
  const referrerHost = input.referrer ? hostFromUrl(input.referrer) : null;

  if (utmMedium === 'cpc' || utmMedium === 'ppc' || utmMedium === 'paid') {
    return 'paid';
  }
  if (utmMedium === 'email') {
    return 'email';
  }
  if (utmMedium === 'social' || ['facebook', 'twitter', 'x', 'reddit', 'linkedin', 'instagram', 'tiktok'].includes(utmSource || '')) {
    return 'social';
  }
  if (utmMedium === 'organic' || utmMedium === 'referral') {
    return utmMedium === 'organic' ? 'organic_search' : 'referral';
  }
  if (referrerHost) {
    if (referrerHost.includes('google.') || referrerHost.includes('bing.') || referrerHost.includes('yahoo.') || referrerHost.includes('duckduckgo.')) {
      return 'organic_search';
    }
    if (referrerHost.includes('facebook.') || referrerHost.includes('twitter.') || referrerHost.includes('t.co') || referrerHost.includes('reddit.') || referrerHost.includes('linkedin.')) {
      return 'social';
    }
    if (referrerHost.includes('mytradewiseoc.com')) {
      return 'direct';
    }
    return 'referral';
  }
  return 'direct';
}

export function normalizeSignupAttribution(input?: SignupAttributionInput | null): SignupAttributionData | null {
  if (!input) return null;

  const parsed = signupAttributionSchema.safeParse(input);
  if (!parsed.success) return null;

  const data = parsed.data;
  const hasAny =
    data.utmSource ||
    data.utmMedium ||
    data.utmCampaign ||
    data.utmTerm ||
    data.utmContent ||
    data.referrer ||
    data.landingPage;

  if (!hasAny) {
    return { signupChannel: 'direct' };
  }

  return {
    signupChannel: deriveSignupChannel(data),
    signupUtmSource: emptyToUndefined(data.utmSource),
    signupUtmMedium: emptyToUndefined(data.utmMedium),
    signupUtmCampaign: emptyToUndefined(data.utmCampaign),
    signupUtmTerm: emptyToUndefined(data.utmTerm),
    signupUtmContent: emptyToUndefined(data.utmContent),
    signupReferrer: emptyToUndefined(data.referrer),
    signupLandingPage: emptyToUndefined(data.landingPage),
  };
}

export function parseAttributionFromQuery(query: Record<string, unknown>): SignupAttributionInput {
  const get = (key: string) => {
    const value = query[key];
    return typeof value === 'string' ? value : undefined;
  };

  return {
    utmSource: get('utm_source') ?? get('utmSource'),
    utmMedium: get('utm_medium') ?? get('utmMedium'),
    utmCampaign: get('utm_campaign') ?? get('utmCampaign'),
    utmTerm: get('utm_term') ?? get('utmTerm'),
    utmContent: get('utm_content') ?? get('utmContent'),
    referrer: get('referrer'),
    landingPage: get('landing_page') ?? get('landingPage'),
  };
}

export function encodeAttributionState(input: SignupAttributionInput): string {
  return Buffer.from(JSON.stringify(input)).toString('base64url');
}

export function decodeAttributionState(state?: string | null): SignupAttributionInput | null {
  if (!state?.trim()) return null;
  try {
    const json = Buffer.from(state, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as SignupAttributionInput;
    return signupAttributionSchema.safeParse(parsed).success ? parsed : null;
  } catch {
    return null;
  }
}

export function attributionToAuditMetadata(attribution: SignupAttributionData | null): Record<string, string> {
  if (!attribution) return {};
  return Object.fromEntries(
    Object.entries(attribution).filter(([, value]) => value !== undefined && value !== null),
  ) as Record<string, string>;
}
