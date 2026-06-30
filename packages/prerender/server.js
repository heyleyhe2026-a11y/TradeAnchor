import express from 'express';
import puppeteer from 'puppeteer';

const app = express();
const PORT = process.env.PORT || 3002;

// ─── Configuration ───────────────────────────────
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://frontend:8080';
const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || 'https://mytradewiseoc.com';
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '3600000', 10); // default 1 hour
const RENDER_TIMEOUT = parseInt(process.env.RENDER_TIMEOUT || '30000', 10); // 30s

// Paths that should be prerendered for SEO (marketing + public pages)
const PRERENDER_PATHS = new Set([
  '/',
  '/pricing',
  '/login',
  '/register',
  '/zh',
  '/terms',
  '/privacy',
  '/refund',
  '/trading-journal',
  '/trade-diary',
  '/forex-trading-journal',
  '/crypto-trading-journal',
  '/ai-trading-journal',
  '/blog/monday-gap-breakout-xauusd-ea',
  '/blog/twinklestar-kdj-bollinger-ea-mt4',
  '/blog/turtle-system-donchian-breakout-ea-mt4',
  '/blog/the-one-eurusd-volatility-scalper-mt4',
  '/blog/gold-dashboard-ai-m1-scalper-mt4',
  '/blog/xauusd-one-candle-ny-session-scalper-mt4',
  '/blog/aquilagold-h1-dual-sma-breakout-mt4',
]);

// Bot user-agent patterns (case-insensitive)
const BOT_PATTERNS = [
  'googlebot',
  'google-inspectiontool',
  'googleother',
  'bingbot',
  'slurp',          // Yahoo
  'baiduspider',
  'duckduckbot',
  'yandexbot',
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'whatsapp',
  'telegrambot',
  'applebot',
  'semrushbot',
  'ahrefsbot',
  'mj12bot',
  // AI / LLM crawlers
  'gptbot',
  'chatgpt',
  'oai-searchbot',
  'claudebot',
  'anthropic',
  'perplexitybot',
  'cohere-ai',
  'bytespider',
  'meta-externalagent',
  'amazonbot',
  'youbot',
  'ccbot',
  'diffbot',
  'ia_archiver',
];

// ─── Cache ───────────────────────────────────────
class RenderCache {
  constructor(ttl) {
    this.store = new Map();
    this.ttl = ttl;
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > this.ttl) {
      this.store.delete(key);
      return null;
    }
    return entry.html;
  }

  set(key, html) {
    this.store.set(key, { html, ts: Date.now() });
    // Limit cache size to prevent memory leak
    if (this.store.size > 200) {
      const oldest = [...this.store.entries()].sort((a, b) => a[1].ts - b[1].ts);
      this.store.delete(oldest[0][0]);
    }
  }

  clear(key) {
    this.store.delete(key);
  }

  size() {
    return this.store.size;
  }
}

const cache = new RenderCache(CACHE_TTL);

// ─── Browser Management ──────────────────────────
let browser = null;

async function getBrowser() {
  if (!browser || !browser.connected) {
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
          '--no-zygote',
          // Reduce memory usage
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-sync',
          '--no-first-run',
          '--metrics-recording-only',
          '--password-store=basic',
          '--use-mock-keychain',
          '--hide-scrollbars',
          '--mute-audio',
        ],
        timeout: 15000,
      });
      console.log('[Prerender] Browser launched successfully');
    } catch (err) {
      console.error('[Prerender] Failed to launch browser:', err.message);
      throw err;
    }
  }
  return browser;
}

// Graceful shutdown
async function shutdown() {
  console.log('[Prerender] Shutting down...');
  if (browser) {
    try { await browser.close(); } catch {}
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ─── Helpers ─────────────────────────────────────

function isBot(ua) {
  if (!ua) return false;
  const uaLower = ua.toLowerCase();
  return BOT_PATTERNS.some(pattern => uaLower.includes(pattern));
}

function shouldPrerender(path) {
  const normalized = path.replace(/\/$/, '') || '/';
  if (PRERENDER_PATHS.has(normalized)) return true;
  return false;
}

function getTargetUrl(path) {
  return `${FRONTEND_URL}${path}`;
}

function getPublicUrl(path) {
  const normalized = path.replace(/\/$/, '') || '/';
  return normalized === '/' ? `${PUBLIC_SITE_URL}/` : `${PUBLIC_SITE_URL}${normalized}`;
}

function getExpectedCanonical(path) {
  const normalized = (path.replace(/\/$/, '') || '/');
  if (normalized === '/') return 'https://mytradewiseoc.com/';
  return `https://mytradewiseoc.com${normalized}`;
}

async function waitForPageSeo(page, path) {
  const expectedCanonical = getExpectedCanonical(path);
  if (expectedCanonical === 'https://mytradewiseoc.com/') return;

  try {
    await page.waitForFunction(
      (expected) => {
        const href = document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '';
        const title = document.title || '';
        return href === expected && title.length > 0 && !title.includes('Free AI Trading Journal with Insights | Forex');
      },
      { timeout: 15000 },
      expectedCanonical,
    );
  } catch {
    console.warn(`[Prerender] SEO wait timeout for ${path} (expected canonical: ${expectedCanonical})`);
  }
}

// ─── Middleware: Request Logging ─────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[Prerender] ${req.method} ${req.path} → ${res.statusCode} (${ms}ms) [cache=${cache.size()} entries]`);
  });
  next();
});

// ─── Health Check ────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    cacheSize: cache.size(),
    browserConnected: browser?.connected ?? false,
    uptime: process.uptime().toFixed(0) + 's',
  });
});

// ─── Main Prerender Handler ──────────────────────
app.get('*', async (req, res) => {
  const ua = req.headers['user-agent'] || '';
  const path = req.path;

  // Non-bot requests: redirect to public site (never expose internal Docker hostname)
  if (!isBot(ua)) {
    return res.redirect(302, getPublicUrl(path));
  }

  // Path not in prerender list: pass through to public site
  if (!shouldPrerender(path)) {
    return res.redirect(302, getPublicUrl(path));
  }

  // Check cache first
  const cacheKey = `${path}`;
  const cachedHtml = cache.get(cacheKey);
  if (cachedHtml) {
    console.log(`[Prerender] Cache HIT: ${path}`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Prerender-Cache', 'HIT');
    return res.send(cachedHtml);
  }

  console.log(`[Prerender] Rendering: ${path} (target: ${getTargetUrl(path)})`);

  let page = null;
  try {
    const br = await getBrowser();
    page = await br.newPage();

    await page.setViewport({ width: 1280, height: 800 });
    
    // Block unnecessary resources to speed up rendering
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
        // Allow critical resources but skip heavy ones
        req.continue();
      } else {
        req.continue();
      }
    });

    const targetUrl = getTargetUrl(path);
    
    // Navigate and wait for page to be ready
    await page.goto(targetUrl, {
      waitUntil: 'networkidle2',
      timeout: RENDER_TIMEOUT,
    });

    // Wait for React useEffect to set per-page title + canonical
    await waitForPageSeo(page, path);
    await new Promise(r => setTimeout(r, 500));

    const html = await page.content();

    // Store in cache
    cache.set(cacheKey, html);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Prerender-Cache', 'MISS');
    res.send(html);
  } catch (err) {
    console.error(`[Prerender] Error rendering ${path}:`, err.message);
    
    // Fallback: redirect to original service
    const targetUrl = getTargetUrl(path);
    res.status(503).setHeader('Retry-After', '5');
    res.send(
      `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${targetUrl}"></head>` +
      `<body><p>Redirecting...</p></body></html>`
    );
  } finally {
    if (page) {
      try { await page.close(); } catch {}
    }
  }
});

// ─── Start Server ───────────────────────────────
app.listen(PORT, () => {
  console.log(`╔════════════════════════════════════════════╗`);
  console.log(`║     TradeAnchor Prerender Service v1.0       ║`);
  console.log(`╠════════════════════════════════════════════╣`);
  console.log(`║  Port:         ${String(PORT).padEnd(28)} ║`);
  console.log(`║  Frontend URL:  ${(FRONTEND_URL).padEnd(28)} ║`);
  console.log(`║  Cache TTL:    ${(CACHE_TTL / 1000 + 's').padEnd(28)} ║`);
  console.log(`║  Timeout:      ${(RENDER_TIMEOUT / 1000 + 's').padEnd(28)} ║`);
  console.log(`╚════════════════════════════════════════════╝`);
});
