import { useEffect } from 'react';

const SITE_ORIGIN = 'https://mytradewiseoc.com';

function upsertMeta(attr: 'name' | 'property', key: string, content: string): () => void {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.querySelector(selector) as HTMLMetaElement | null;
  const created = !el;
  const prev = el?.getAttribute('content') ?? '';
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
  return () => {
    if (created && el?.parentNode) {
      el.parentNode.removeChild(el);
    } else {
      el?.setAttribute('content', prev);
    }
  };
}

function upsertCanonical(href: string): () => void {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  const created = !el;
  const prev = el?.getAttribute('href') ?? '';
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
  return () => {
    if (created && el?.parentNode) {
      el.parentNode.removeChild(el);
    } else {
      el?.setAttribute('href', prev);
    }
  };
}

function upsertJsonLd(id: string, data: Record<string, unknown>): () => void {
  const selector = `script[data-seo-jsonld="${id}"]`;
  let el = document.querySelector(selector) as HTMLScriptElement | null;
  const created = !el;
  const prev = el?.textContent ?? '';
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.setAttribute('data-seo-jsonld', id);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
  return () => {
    if (created && el?.parentNode) {
      el.parentNode.removeChild(el);
    } else {
      el!.textContent = prev;
    }
  };
}

export interface JsonLdScript {
  id: string;
  data: Record<string, unknown>;
}

export interface PageSeoOptions {
  title: string;
  description?: string;
  /** Path only, e.g. `/refund` */
  path: string;
  ogType?: 'website' | 'article';
  lang?: 'en' | 'zh-CN';
  keywords?: string;
  jsonLd?: JsonLdScript[];
}

export function usePageSeo({
  title,
  description,
  path,
  ogType = 'website',
  lang,
  keywords,
  jsonLd,
}: PageSeoOptions): void {
  useEffect(() => {
    const prevTitle = document.title;
    const prevLang = document.documentElement.lang;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const pageUrl = `${SITE_ORIGIN}${normalizedPath}`;

    document.title = title;
    if (lang) {
      document.documentElement.lang = lang;
    }

    const cleanups = [
      ...(description ? [upsertMeta('name', 'description', description)] : []),
      ...(keywords ? [upsertMeta('name', 'keywords', keywords)] : []),
      upsertCanonical(pageUrl),
      upsertMeta('property', 'og:type', ogType),
      upsertMeta('property', 'og:title', title),
      ...(description ? [upsertMeta('property', 'og:description', description)] : []),
      upsertMeta('property', 'og:url', pageUrl),
      upsertMeta('property', 'og:site_name', 'TradeAnchor'),
      upsertMeta('property', 'og:image', `${SITE_ORIGIN}/og-image.png`),
      upsertMeta('property', 'og:image:alt', 'TradeAnchor AI trading journal dashboard preview'),
      upsertMeta('name', 'twitter:card', 'summary_large_image'),
      upsertMeta('name', 'twitter:title', title),
      ...(description ? [upsertMeta('name', 'twitter:description', description)] : []),
      upsertMeta('name', 'twitter:image', `${SITE_ORIGIN}/og-image.png`),
      ...(jsonLd?.map(({ id, data }) => upsertJsonLd(id, data)) ?? []),
    ];

    return () => {
      document.title = prevTitle;
      document.documentElement.lang = prevLang;
      cleanups.forEach((fn) => fn());
    };
  }, [title, description, path, ogType, lang, keywords, jsonLd]);
}
