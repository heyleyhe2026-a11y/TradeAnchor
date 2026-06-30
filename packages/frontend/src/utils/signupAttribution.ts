const STORAGE_KEY = 'tw_signup_attribution';
const STORAGE_TS_KEY = 'tw_signup_attribution_ts';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SignupAttribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referrer?: string;
  landingPage?: string;
}

function readStorage(): SignupAttribution | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const ts = localStorage.getItem(STORAGE_TS_KEY);
    if (!raw || !ts) return null;
    if (Date.now() - Number(ts) > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_TS_KEY);
      return null;
    }
    return JSON.parse(raw) as SignupAttribution;
  } catch {
    return null;
  }
}

function writeStorage(data: SignupAttribution) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  localStorage.setItem(STORAGE_TS_KEY, String(Date.now()));
}

function pickUtm(search: URLSearchParams): SignupAttribution {
  const get = (snake: string, camel: string) => search.get(snake) || search.get(camel) || undefined;
  return {
    utmSource: get('utm_source', 'utmSource'),
    utmMedium: get('utm_medium', 'utmMedium'),
    utmCampaign: get('utm_campaign', 'utmCampaign'),
    utmTerm: get('utm_term', 'utmTerm'),
    utmContent: get('utm_content', 'utmContent'),
  };
}

function hasUtm(data: SignupAttribution): boolean {
  return Boolean(
    data.utmSource ||
    data.utmMedium ||
    data.utmCampaign ||
    data.utmTerm ||
    data.utmContent,
  );
}

/** Capture UTM + landing page on first visit; refresh UTM if new campaign params appear. */
export function captureSignupAttribution(): void {
  if (typeof window === 'undefined') return;

  const search = new URLSearchParams(window.location.search);
  const fromUrl = pickUtm(search);
  const existing = readStorage() ?? {};
  const merged: SignupAttribution = { ...existing };

  if (hasUtm(fromUrl)) {
    Object.assign(merged, fromUrl);
  }

  if (!merged.landingPage) {
    merged.landingPage = `${window.location.pathname}${window.location.search}`;
  }

  const docReferrer = document.referrer?.trim();
  if (docReferrer && !docReferrer.includes(window.location.hostname)) {
    merged.referrer = docReferrer;
  }

  writeStorage(merged);
}

export function getStoredSignupAttribution(): SignupAttribution {
  captureSignupAttribution();
  return readStorage() ?? {};
}

export function buildAttributionQueryParams(): URLSearchParams {
  const data = getStoredSignupAttribution();
  const params = new URLSearchParams();
  if (data.utmSource) params.set('utm_source', data.utmSource);
  if (data.utmMedium) params.set('utm_medium', data.utmMedium);
  if (data.utmCampaign) params.set('utm_campaign', data.utmCampaign);
  if (data.utmTerm) params.set('utm_term', data.utmTerm);
  if (data.utmContent) params.set('utm_content', data.utmContent);
  if (data.referrer) params.set('referrer', data.referrer);
  if (data.landingPage) params.set('landing_page', data.landingPage);
  return params;
}

export function getAttributionForRegister(): SignupAttribution {
  return getStoredSignupAttribution();
}
