import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { Page, Route } from '@playwright/test';
import { logger } from './logger';

const CACHE_DIR = path.resolve(__dirname, '../../.cache/bundles');

const CACHE_PATTERNS = [
  /\.js(\?|$)/,
  /\.css(\?|$)/,
  /maps\.googleapis\.com\/maps\/api\/js/,
  /maps\.gstatic\.com\//,
];

const SKIP_PATTERNS = [
  /\/sockjs-node\//,
  /hot-update/,
  /webpack-hmr/,
  /\/__webpack_hmr/,
  /localhost/,
];

function shouldCache(url: string): boolean {
  if (SKIP_PATTERNS.some(p => p.test(url))) return false;
  return CACHE_PATTERNS.some(p => p.test(url));
}

function urlToCachePath(url: string): string {
  const hash = crypto.createHash('sha1').update(url).digest('hex');
  const ext = url.includes('.css') ? '.css' : '.js';
  return path.join(CACHE_DIR, `${hash}${ext}`);
}

function contentTypeFor(url: string): string {
  if (url.includes('.css')) return 'text/css; charset=utf-8';
  return 'application/javascript; charset=utf-8';
}

async function handleRoute(route: Route): Promise<void> {
  const url = route.request().url();
  if (route.request().method() !== 'GET' || !shouldCache(url)) {
    return route.fallback();
  }
  const cachePath = urlToCachePath(url);
  if (fs.existsSync(cachePath)) {
    const body = fs.readFileSync(cachePath);
    return route.fulfill({
      status: 200,
      headers: {
        'content-type': contentTypeFor(url),
        'cache-control': 'public, max-age=31536000, immutable',
      },
      body,
    });
  }
  try {
    const response = await route.fetch({ timeout: 240_000 });
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      const body = await response.body();
      fs.writeFileSync(cachePath, body);
      logger.info(`BundleCache: cached ${url.slice(0, 80)}`);
    } catch { /* best-effort */ }
    await route.fulfill({ response });
  } catch {
    await route.fallback();
  }
}

export const BundleCache = {
  async attach(page: Page): Promise<void> {
    await page.route('**/*', handleRoute);
  },
  clear(): void {
    if (fs.existsSync(CACHE_DIR)) fs.rmSync(CACHE_DIR, { recursive: true, force: true });
    logger.info('BundleCache cleared');
  },
};
