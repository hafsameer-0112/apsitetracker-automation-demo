import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export interface LatLng { lat: number; lng: number; }

/**
 * MapDashboardPage — AbstraPoint SiteTracker dashboard.
 *
 * Key facts discovered via DOM exploration:
 *  - Map: Google Maps, `.gm-style` container
 *  - Right-click on map opens `.create-marker-dialog-overlay` modal with
 *    "Create Site" / "Cancel" buttons
 *  - Move Pin button: `.map-control-button.move-pin-button` (white → orange when active)
 *  - Home button: `.map-control-button.home-button`
 *  - Sites grid: AG-Grid `.ag-root` with row virtualisation
 */
export class MapDashboardPage extends BasePage {
  readonly mapContainer: Locator;
  readonly searchInput: Locator;
  readonly movePinButton: Locator;
  readonly homeButton: Locator;
  readonly grid: Locator;
  readonly createSiteDialog: Locator;
  readonly createSiteButton: Locator;
  readonly cancelCreateSiteButton: Locator;

  constructor(page: Page) {
    super(page);
    this.mapContainer = page.locator('.gm-style').first();
    this.searchInput = page.locator('input.map-search-input');
    this.movePinButton = page.locator('.map-control-button.move-pin-button');
    this.homeButton = page.locator('.map-control-button.home-button');
    this.grid = page.locator('.ag-root').first();
    this.createSiteDialog = page.locator('.create-marker-dialog-overlay');
    this.createSiteButton = this.createSiteDialog.getByRole('button', { name: /^create site$/i });
    this.cancelCreateSiteButton = this.createSiteDialog.getByRole('button', { name: /^cancel$/i });
  }

  // ---------------------------------------------------------------------------
  // Static init hook (call before navigation)
  // ---------------------------------------------------------------------------

  /**
   * Installs a page-init script that patches `google.maps.Map` so every
   * constructed Map instance is cached on `window.__apstMap`.
   */
  static async installMapInitHook(page: Page): Promise<void> {
    await page.addInitScript(() => {
      type W = typeof window & {
        __apstMap?: unknown;
        __apstMapPatched?: boolean;
        google?: { maps?: { Map?: new (...args: unknown[]) => unknown } };
      };
      const w = window as W;
      const tryPatch = (): boolean => {
        if (w.__apstMapPatched) return true;
        const Orig = w.google?.maps?.Map;
        if (!Orig || !w.google?.maps) return false;
        const Patched = function (this: unknown, ...args: unknown[]): unknown {
          const inst = Reflect.construct(
            Orig as new (...a: unknown[]) => unknown,
            args,
            Patched as unknown as new (...a: unknown[]) => unknown,
          );
          w.__apstMap = inst;
          return inst;
        } as unknown as new (...args: unknown[]) => unknown;
        try {
          Patched.prototype = (Orig as unknown as { prototype: object }).prototype;
          Object.setPrototypeOf(Patched, Orig);
          for (const k of Object.getOwnPropertyNames(Orig)) {
            try {
              const desc = Object.getOwnPropertyDescriptor(Orig, k);
              if (desc) Object.defineProperty(Patched, k, desc);
            } catch { /* skip read-only */ }
          }
          w.google.maps.Map = Patched;
          w.__apstMapPatched = true;
          return true;
        } catch { return false; }
      };
      const id = window.setInterval(() => { if (tryPatch()) window.clearInterval(id); }, 5);
    });
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async waitUntilReady(): Promise<void> {
    // Wait for any React element to appear first (the bundle is large)
    await this.page
      .locator('button, .map-control-button')
      .first()
      .waitFor({ state: 'attached', timeout: 240_000 });
    await this.homeButton.waitFor({ state: 'visible', timeout: 240_000 });
    await this.movePinButton.waitFor({ state: 'visible', timeout: 60_000 });
    await this.grid.waitFor({ state: 'attached', timeout: 60_000 });

    // Wait for Google Maps API and the map instance to be fully initialised
    await this.page.waitForFunction(
      () => Boolean((window as unknown as { google?: { maps?: { Map?: unknown } } }).google?.maps?.Map),
      undefined,
      { timeout: 120_000 },
    );
    await this.waitForMapInstance(120_000);
    await this.waitForSitesLoaded();
  }

  /**
   * Wait for AG-Grid data to arrive by monitoring aria-rowcount stability.
   *
   * Strategy:
   *   1. If aria-rowcount > 0 and has been stable for STABLE_MS → done.
   *   2. Only conclude "empty grid" after MIN_EMPTY_MS of stable 0 rows
   *      AND no loading overlay AND at least MIN_ELAPSED have passed.
   *      This prevents premature exit when the API response is slow.
   */
  async waitForSitesLoaded(timeout = 120_000): Promise<void> {
    const STABLE_MS = 5_000;     // count must be stable for this long
    const MIN_ELAPSED = 20_000;  // minimum time before accepting "empty"
    const MIN_EMPTY_MS = 10_000; // must see 0 rows for this long to accept empty
    const start = Date.now();
    let lastCount = -1;
    let stableSince = Date.now();
    let firstNonZeroSeen = false;

    while (Date.now() - start < timeout) {
      const elapsed = Date.now() - start;
      const info = await this.page.evaluate(() => {
        const grid =
          document.querySelector('.ag-root[aria-rowcount]') ??
          document.querySelector('[role="treegrid"][aria-rowcount]');
        const ariaCount = grid
          ? Math.max(0, parseInt(grid.getAttribute('aria-rowcount') ?? '0', 10) - 1)
          : 0;
        const visRows = document.querySelectorAll('.ag-row').length;
        const hasOverlay = !!document.querySelector(
          '[class*="spinner" i]:not(.gm-style *), [class*="loading-overlay" i]',
        );
        return { ariaCount, visRows, hasOverlay };
      });

      if (info.ariaCount > 0) {
        firstNonZeroSeen = true;
        if (info.ariaCount === lastCount) {
          if (Date.now() - stableSince >= STABLE_MS) return; // stable and populated
        } else {
          lastCount = info.ariaCount;
          stableSince = Date.now();
        }
      } else {
        // Count is 0 — only accept as "truly empty" after extended wait
        if (
          firstNonZeroSeen === false &&
          !info.hasOverlay &&
          elapsed >= MIN_ELAPSED &&
          info.visRows === lastCount &&
          Date.now() - stableSince >= MIN_EMPTY_MS
        ) {
          return; // settled at empty
        }
        if (info.visRows !== lastCount) {
          lastCount = info.visRows;
          stableSince = Date.now();
        }
      }
      await this.page.waitForTimeout(500);
    }
  }

  // ---------------------------------------------------------------------------
  // Map helpers
  // ---------------------------------------------------------------------------

  async installMapHelpers(): Promise<void> {
    await this.page.evaluate(() => {
      type W = typeof window & { getMapInstance?: () => unknown; __apstMap?: unknown };
      const w = window as W;

      function isMap(o: unknown): boolean {
        if (!o || typeof o !== 'object') return false;
        const x = o as Record<string, unknown>;
        return (
          typeof x.getCenter === 'function' &&
          typeof x.panTo === 'function' &&
          typeof x.getZoom === 'function' &&
          typeof x.getBounds === 'function' &&
          typeof x.getDiv === 'function'
        );
      }

      function search(): unknown {
        // Fast path: check known window property first
        if (w.__apstMap && isMap(w.__apstMap)) return w.__apstMap;
        const seen = new WeakSet<object>();
        const divs = Array.from(document.querySelectorAll('div'));
        for (const div of divs) {
          const rec = div as unknown as Record<string, unknown>;
          for (const key of Object.getOwnPropertyNames(rec)) {
            try {
              const v = rec[key];
              if (v && typeof v === 'object' && !seen.has(v as object)) {
                seen.add(v as object);
                if (isMap(v)) return v;
                const v2 = v as Record<string, unknown>;
                for (const k2 of Object.keys(v2)) {
                  try { if (isMap(v2[k2])) return v2[k2]; } catch { /* */ }
                }
              }
            } catch { /* */ }
          }
        }
        return null;
      }

      // Always (re-)define so that a stale cached null is refreshed on next call
      w.getMapInstance = () => {
        const m = search();
        if (m) w.__apstMap = m;
        return m;
      };
    });
  }

  /** Wait until `getMapInstance()` returns a valid map object (with projection). */
  async waitForMapInstance(timeout = 60_000): Promise<void> {
    await this.installMapHelpers();
    await this.page.waitForFunction(
      () => {
        type W = typeof window & { getMapInstance?: () => unknown };
        const m = (window as W).getMapInstance?.() as { getBounds?(): unknown; getProjection?(): unknown } | null;
        return Boolean(m && m.getBounds?.() && m.getProjection?.());
      },
      undefined,
      { timeout },
    );
  }

  /** Pan and zoom to `target`, waiting for the map `idle` event. */
  async panTo(target: LatLng, zoom = 18): Promise<void> {
    await this.installMapHelpers();
    const doPan = async () => {
      await this.page.evaluate(async ({ lat, lng, zoom }) => {
        type W = typeof window & {
          getMapInstance?: () => unknown;
          google?: { maps?: { LatLng?: new (lat: number, lng: number) => unknown; event?: { addListenerOnce: (m: unknown, e: string, cb: () => void) => unknown } } };
        };
        const w = window as W;
        const map = w.getMapInstance?.() as { panTo(p: unknown): void; setZoom(z: number): void } | null;
        if (!map) throw new Error('panTo: map not found');
        const ll = w.google?.maps?.LatLng ? new w.google.maps.LatLng(lat, lng) : { lat, lng };
        map.setZoom(zoom);
        map.panTo(ll);
        await new Promise<void>(resolve => {
          if (w.google?.maps?.event) {
            w.google.maps.event.addListenerOnce(map, 'idle', () => resolve());
            setTimeout(() => resolve(), 8_000);
          } else {
            setTimeout(() => resolve(), 2_000);
          }
        });
      }, { ...target, zoom });
      await this.page.waitForFunction(() => {
        type W = typeof window & { getMapInstance?: () => unknown };
        const m = (window as W).getMapInstance?.() as { getBounds(): unknown; getProjection(): unknown } | null;
        return Boolean(m && m.getBounds() && m.getProjection());
      }, undefined, { timeout: 30_000 });
      await this.page.waitForTimeout(400);
    };

    for (let i = 0; i < 3; i++) {
      await doPan();
      const center = await this.getMapCenter();
      const z = await this.getMapZoom();
      if (Math.abs(center.lat - target.lat) < 0.001 && Math.abs(center.lng - target.lng) < 0.001 && z >= zoom - 1) return;
      await this.page.waitForTimeout(800);
    }
  }

  /** Convert lat/lng to page pixel coordinates using the live map projection. */
  async latLngToPagePixel(target: LatLng): Promise<{ x: number; y: number }> {
    await this.installMapHelpers();
    return this.page.evaluate(({ lat, lng }) => {
      type W = typeof window & {
        getMapInstance?: () => unknown;
        google?: { maps?: { LatLng?: new (lat: number, lng: number) => unknown } };
      };
      const w = window as W;
      const map = w.getMapInstance?.() as {
        getProjection(): { fromLatLngToPoint(ll: unknown): { x: number; y: number } } | null;
        getBounds(): { getNorthEast(): unknown; getSouthWest(): unknown } | undefined;
        getZoom(): number;
        getDiv(): HTMLElement;
      } | null;
      if (!map) throw new Error('latLngToPagePixel: map not found');
      const proj = map.getProjection();
      const bounds = map.getBounds();
      if (!proj || !bounds) throw new Error('Map projection/bounds not ready');
      const ll = w.google?.maps?.LatLng ? new w.google.maps.LatLng(lat, lng) : { lat, lng };
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const topRight = proj.fromLatLngToPoint(ne);
      const bottomLeft = proj.fromLatLngToPoint(sw);
      const worldPoint = proj.fromLatLngToPoint(ll);
      const scale = Math.pow(2, map.getZoom());
      const div = map.getDiv();
      const rect = div.getBoundingClientRect();
      return {
        x: rect.left + (worldPoint.x - bottomLeft.x) * scale,
        y: rect.top + (worldPoint.y - topRight.y) * scale,
      };
    }, target);
  }

  // ---------------------------------------------------------------------------
  // Test-case operations
  // ---------------------------------------------------------------------------

  /**
   * Right-click the map at the given lat/lng to open the "Create a New Site"
   * modal. Falls back to a synthetic Google Maps event if the raw DOM
   * right-click doesn't open the dialog.
   */
  async rightClickAt(target: LatLng): Promise<void> {
    await this.panTo(target, 18);
    const point = await this.latLngToPagePixel(target);

    await this.page.mouse.move(point.x, point.y);
    await this.page.waitForTimeout(200);
    await this.page.mouse.click(point.x, point.y, { button: 'right' });
    const opened = await this.createSiteDialog
      .waitFor({ state: 'visible', timeout: 4_000 })
      .then(() => true).catch(() => false);
    if (opened) return;

    // Synthetic GM event fallback
    await this.page.evaluate(({ lat, lng }) => {
      type W = typeof window & {
        getMapInstance?: () => unknown;
        google?: { maps?: { LatLng?: new (lat: number, lng: number) => unknown; event?: { trigger(m: unknown, e: string, p?: unknown): void } } };
      };
      const w = window as W;
      const map = w.getMapInstance?.();
      if (!map || !w.google?.maps?.event || !w.google?.maps?.LatLng) return;
      const latLng = new w.google.maps.LatLng(lat, lng);
      w.google.maps.event.trigger(map, 'rightclick', { latLng });
      w.google.maps.event.trigger(map, 'contextmenu', { latLng });
    }, target);
    await this.createSiteDialog.waitFor({ state: 'visible', timeout: 8_000 }).catch(() => undefined);
  }

  /** Click "Create Site" inside the dialog (JS-click fallback if backdrop intercepts). */
  async clickCreateSite(): Promise<void> {
    await this.createSiteButton.waitFor({ state: 'visible', timeout: 15_000 });
    try {
      await this.createSiteButton.click({ timeout: 5_000 });
    } catch {
      await this.createSiteButton.evaluate((el: HTMLElement) => el.click());
    }
    await this.createSiteDialog.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => undefined);
  }

  /** Read the field values shown inside the create-site dialog. */
  async getCreateSiteDialogFields(): Promise<{ street?: string; city?: string; state?: string; county?: string; lat?: string; lng?: string }> {
    return this.createSiteDialog.evaluate(el => {
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      const grab = (label: string): string | undefined => {
        const re = new RegExp(`${label}:?\\s*([^\\n]+?)\\s*(?:Street|City|State|County|Latitude|Longitude|Create Site|Cancel|$)`, 'i');
        const m = text.match(re);
        return m ? m[1].trim() : undefined;
      };
      return {
        street: grab('Street Address'),
        city: grab('City'),
        state: grab('State'),
        county: grab('County'),
        lat: grab('Latitude'),
        lng: grab('Longitude'),
      };
    });
  }

  /** Click the Move Pin map control (JS-click fallback if an overlay intercepts). */
  async clickMovePin(): Promise<void> {
    await this.movePinButton.waitFor({ state: 'visible', timeout: 15_000 });
    try {
      await this.movePinButton.click({ timeout: 5_000 });
    } catch {
      await this.movePinButton.evaluate((el: HTMLElement) => el.click());
    }
    await this.page.waitForTimeout(500);
  }

  /** Read the live visual state of the Move Pin button. */
  async getMovePinState(): Promise<{ text: string; backgroundColor: string; isActive: boolean }> {
    return this.movePinButton.evaluate(el => ({
      text: (el.textContent ?? '').trim(),
      backgroundColor: window.getComputedStyle(el).backgroundColor,
      isActive: /moving/i.test(el.textContent ?? ''),
    }));
  }

  async assertMovePinActive(): Promise<void> {
    const state = await this.getMovePinState();
    expect(state.text).toMatch(/moving/i);
    expect(state.backgroundColor).not.toBe('rgb(255, 255, 255)');
  }

  /**
   * Click on the site pin near `target`. Tries clicking the closest
   * marker image first, falls back to a raw pixel click.
   */
  async clickPinAt(target: LatLng, tolerancePx = 40): Promise<void> {
    await this.panTo(target, 18);
    const point = await this.latLngToPagePixel(target);
    const markerHandle = await this.page.evaluateHandle(
      ({ x, y, tol }) => {
        const imgs = Array.from(document.querySelectorAll('.gm-style img, .gm-style div[role="button"]')) as HTMLElement[];
        let best: HTMLElement | null = null;
        let bestDist = Infinity;
        for (const el of imgs) {
          const r = el.getBoundingClientRect();
          if (r.width < 10 || r.width > 80) continue;
          if (el.closest('.gmnoprint, .gm-style-cc')) continue;
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const d = Math.hypot(cx - x, cy - y);
          if (d < bestDist && d < tol + r.width) { bestDist = d; best = el; }
        }
        return best;
      },
      { x: point.x, y: point.y, tol: tolerancePx },
    );
    const el = markerHandle.asElement();
    if (el) { await el.click(); await markerHandle.dispose(); return; }
    await markerHandle.dispose();
    await this.page.mouse.click(point.x, point.y);
  }

  /**
   * Drag the selected pin from `from` to `destination` using real mouse
   * events so intermediate `mousemove` handlers fire.
   */
  async dragSelectedPinTo(from: LatLng, destination: LatLng): Promise<void> {
    // Zoom out slightly so both points are visible
    await this.page.evaluate(() => {
      type W = typeof window & { getMapInstance?: () => unknown };
      const m = (window as W).getMapInstance?.() as { setZoom(z: number): void; getZoom(): number } | null;
      if (m) m.setZoom(Math.max(15, m.getZoom() - 1));
    });
    await this.page.waitForTimeout(800);

    const startPx = await this.latLngToPagePixel(from);
    const endPx = await this.latLngToPagePixel(destination);

    await this.page.mouse.move(startPx.x, startPx.y);
    await this.page.mouse.down();
    const steps = 25;
    for (let i = 1; i <= steps; i++) {
      await this.page.mouse.move(
        startPx.x + ((endPx.x - startPx.x) * i) / steps,
        startPx.y + ((endPx.y - startPx.y) * i) / steps,
        { steps: 2 },
      );
      await this.page.waitForTimeout(20);
    }
    await this.page.mouse.up();
    await this.page.waitForTimeout(1_500);
  }

  /** Click the Home button to re-fit the map to all site pins. */
  async clickHome(): Promise<void> {
    await this.homeButton.click();
    await this.page.waitForTimeout(1_500);
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  async getMapCenter(): Promise<LatLng> {
    await this.installMapHelpers();
    return this.page.evaluate(() => {
      type W = typeof window & { getMapInstance?: () => unknown };
      const m = (window as W).getMapInstance?.() as { getCenter(): { lat(): number; lng(): number } } | null;
      if (!m) throw new Error('getMapCenter: map not found');
      const c = m.getCenter();
      return { lat: c.lat(), lng: c.lng() };
    });
  }

  async getMapZoom(): Promise<number> {
    await this.installMapHelpers();
    return this.page.evaluate(() => {
      type W = typeof window & { getMapInstance?: () => unknown };
      const m = (window as W).getMapInstance?.() as { getZoom(): number } | null;
      if (!m) throw new Error('getMapZoom: map not found');
      return m.getZoom();
    });
  }

  async getTotalRowCount(): Promise<number> {
    return this.page.evaluate(() => {
      // Strategy 1: aria-rowcount
      const el = document.querySelector('[aria-rowcount]');
      if (el) {
        const n = parseInt(el.getAttribute('aria-rowcount') ?? '0', 10);
        if (n > 0) return Math.max(0, n - 1);
      }
      // Strategy 2: max aria-rowindex
      let max = 0;
      document.querySelectorAll('[aria-rowindex]').forEach(r => {
        const v = parseInt(r.getAttribute('aria-rowindex') ?? '0', 10);
        if (v > max) max = v;
      });
      if (max > 0) return Math.max(0, max - 1);
      // Strategy 3: rendered rows
      return document.querySelectorAll('.ag-row[row-id]').length;
    });
  }

  async getSelectedRowId(): Promise<string | null> {
    const sel = this.page.locator('.ag-row.ag-row-selected').first();
    if (!(await sel.count())) return null;
    return sel.getAttribute('row-id');
  }

  async getRowCells(rowId: string): Promise<Record<string, string>> {
    const row = this.page.locator(`.ag-row[row-id="${rowId}"]`).first();
    return row.evaluate(r => {
      const out: Record<string, string> = {};
      r.querySelectorAll('[col-id]').forEach(c => {
        const k = c.getAttribute('col-id') ?? '';
        if (k) out[k] = (c.textContent ?? '').trim();
      });
      return out;
    });
  }

  async getVisibleMarkerCount(): Promise<number> {
    return this.page.evaluate(() =>
      Array.from(document.querySelectorAll('.gm-style img, .gm-style div[role="button"]'))
        .filter(el => {
          const e = el as HTMLElement;
          const r = e.getBoundingClientRect();
          if (r.width < 10 || r.height < 10 || r.width > 80 || r.height > 80) return false;
          if (e.closest('.gmnoprint, .gm-style-cc, .gm-svpc, .gm-style-mtc')) return false;
          return true;
        }).length
    );
  }
}
