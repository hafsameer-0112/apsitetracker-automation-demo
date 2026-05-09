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
 *
 * Additional UI elements (search → add-site → edit-screen flow):
 *  - "Add Site" button: appears next to the search bar after a successful search
 *  - Edit screen: panel/modal that opens when double-clicking a grid cell;
 *    contains size/rent inputs, a gross-rent display, and an attachment section
 *  NOTE: CSS class selectors for the edit screen and its inner fields are
 *  best-effort guesses. Inspect the live DOM and update them if needed.
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

  // ── Search / Add-site flow ──────────────────────────────────────────────────
  /** "Add Site" button that appears next to the search bar after a search. */
  readonly addSiteButton: Locator;

  // ── Edit screen ─────────────────────────────────────────────────────────────
  /**
   * Container of the site edit panel / modal that opens when a grid cell is
   * double-clicked.
   * NOTE: Update the selector list below to match the app's actual class name.
   */
  readonly editScreen: Locator;
  /** Close / dismiss button for the edit screen. */
  readonly editScreenCloseButton: Locator;
  /**
   * Size (square footage) input inside the edit screen.
   * NOTE: Update selector to match the actual input element.
   */
  readonly sizeInput: Locator;
  /**
   * Rent-per-sqft input inside the edit screen.
   * NOTE: Update selector to match the actual input element.
   */
  readonly rentInput: Locator;
  /**
   * Read-only display element that shows the auto-calculated gross rent.
   * NOTE: Update selector to match the actual element.
   */
  readonly grossRentValue: Locator;

  // ── Attachments ─────────────────────────────────────────────────────────────
  /** Button that opens the OS file chooser to add a new attachment. */
  readonly addNewAttachmentButton: Locator;
  /** Container that lists all uploaded attachments. */
  readonly attachmentList: Locator;
  /** Error/alert element shown when an unsupported file type is uploaded. */
  readonly attachmentError: Locator;

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

    // ── Search / Add-site flow ────────────────────────────────────────────────
    this.addSiteButton = page.getByRole('button', { name: /^add site$/i });

    // ── Edit screen ──────────────────────────────────────────────────────────
    // The edit panel slides in from the right of the grid area.  Its outermost
    // wrapper has class "absractor-values" (note: APSiteTracker's own spelling).
    this.editScreen = page.locator('.absractor-values, .edit-workspace').first();
    // The "Close" button lives inside a footer element with class "edit-footer".
    this.editScreenCloseButton = page.locator('.edit-footer').getByRole('button', { name: /^close$/i });
    // Each field in the panel is a ".fields-pair" div that contains a label and
    // a ".value-textbox-container" with a "textarea.value" inside.
    // We use :has-text() to find the pair whose label contains "Size" / "Rent".
    this.sizeInput = page.locator('.fields-pair').filter({ hasText: /\bSize\b/i }).locator('textarea.value').first();
    this.rentInput = page.locator('.fields-pair').filter({ hasText: /\bRent\b/i }).locator('textarea.value').first();
    // "Annual Gross" is the calculated annual rent field (auto-updates).
    // Use the textarea inside the field pair whose text starts with "Annual".
    this.grossRentValue = page.locator('.fields-pair').filter({ hasText: /Annual/i }).locator('textarea.value').first();

    // ── Attachments ──────────────────────────────────────────────────────────
    // The add-attachment button is an icon button with class "attachment-item add" (no visible text).
    this.addNewAttachmentButton = page.locator('button.attachment-item.add').first();
    // The attachment list is inside .attachments-section > .attachments-list
    this.attachmentList = page.locator('.attachments-list').first();
    // Attachment upload errors may appear as a toast, modal, or inline alert.
    this.attachmentError = page.locator(
      '[class*="error"], [class*="alert"], [class*="toast"], [role="alert"], [role="dialog"]',
    ).first();
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

  /**
   * Traverse the React fiber tree attached to the AG-Grid root element using
   * a proper stack-based DFS (child + sibling only — never `return`, which
   * would cycle back to already-visited ancestors).
   *
   * Returns all row IDs reported by `gridApi.forEachNode`, or an empty array
   * if the API cannot be reached.
   */
  async getAllGridRowIds(): Promise<string[]> {
    return this.page.evaluate((): string[] => {
      const gridEl = document.querySelector('.ag-root-wrapper');
      if (!gridEl) return [];

      const fiberKey = Object.keys(gridEl).find(k =>
        k.startsWith('__reactFiber') || k.startsWith('__reactInternals'),
      );
      if (!fiberKey) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rootNode = (gridEl as any)[fiberKey];
      const visited = new WeakSet<object>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stack: any[] = [rootNode];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tryGetIds = (api: any): string[] | null => {
        if (typeof api?.forEachNode !== 'function') return null;
        const ids: string[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        api.forEachNode((n: any) => { if (n.id != null) ids.push(String(n.id)); });
        return ids.length > 0 ? ids : null;
      };

      while (stack.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const node: any = stack.pop();
        if (!node || typeof node !== 'object') continue;
        if (visited.has(node)) continue;
        visited.add(node);

        const p = node.memoizedProps;
        if (p) {
          const r =
            tryGetIds(p.api) ??
            tryGetIds(p.columnApi) ??
            tryGetIds(p.gridOptions?.api) ??
            tryGetIds(p.gridOptions?.columnApi);
          if (r !== null) return r;
        }
        // stateNode holds class component instances (e.g. AgGridReact)
        const s = node.stateNode;
        if (s && typeof s === 'object') {
          const r = tryGetIds(s.api) ?? tryGetIds(s.columnApi) ?? tryGetIds(s.gridApi);
          if (r !== null) return r;
        }

        // DFS: push sibling then child so child is processed first
        if (node.sibling) stack.push(node.sibling);
        if (node.child) stack.push(node.child);
      }
      return [];
    });
  }

  /**
   * Find the row ID of the most recently created site.
   *
   * Strategy 0 (primary): diff — compare current row IDs against
   *   `preCreationIds` captured before site creation and return the new one.
   *
   * Strategy 1: scroll the grid body to the bottom and return the row with
   *   the highest `aria-rowindex` (new rows are appended at the end).
   *
   * Strategy 2: AG-Grid `forEachNode` via React fiber (proper DFS) — finds
   *   the "New"-status row with the most recent "Added" timestamp.
   *
   * Strategy 3: DOM class `ag-after-created` — AG-Grid temporarily adds this
   *   class to rows that were just added.
   *
   * After finding the row the grid viewport is scrolled so it is visible.
   */
  async findNewlyCreatedRowId(preCreationIds: string[] = []): Promise<string | null> {
    await this.page.waitForTimeout(600);

    // ── Strategy 0: diff ─────────────────────────────────────────────────────
    if (preCreationIds.length > 0) {
      const allIds = await this.getAllGridRowIds();
      if (allIds.length > 0) {
        const existingSet = new Set(preCreationIds);
        const newIds = allIds.filter(id => !existingSet.has(id));
        if (newIds.length > 0) {
          const rowId = newIds[newIds.length - 1];
          await this.ensureRowVisible(rowId);
          return rowId;
        }
      }
    }

    // ── Strategy 1: scroll to bottom of grid, read highest aria-rowindex ─────
    const lastRowId = await this.page.evaluate(async (): Promise<string | null> => {
      const bodyViewport =
        document.querySelector<HTMLElement>('.ag-body-viewport') ??
        document.querySelector<HTMLElement>('.ag-center-cols-viewport');
      if (bodyViewport) {
        bodyViewport.scrollTop = bodyViewport.scrollHeight;
        await new Promise(r => setTimeout(r, 400));
      }
      let maxIdx = 0;
      let rowId: string | null = null;
      document.querySelectorAll('.ag-row[row-id][aria-rowindex]').forEach(row => {
        const idx = parseInt(row.getAttribute('aria-rowindex') ?? '0', 10);
        const id = row.getAttribute('row-id');
        if (idx > maxIdx && id) { maxIdx = idx; rowId = id; }
      });
      return rowId;
    });
    if (lastRowId) {
      await this.page.waitForTimeout(300);
      return lastRowId;
    }

    // ── Strategy 2: AG-Grid forEachNode via React fiber (proper DFS) ─────────
    const rowIdFromApi = await this.page.evaluate((): string | null => {
      const gridEl = document.querySelector('.ag-root-wrapper');
      if (!gridEl) return null;

      const fiberKey = Object.keys(gridEl).find(k =>
        k.startsWith('__reactFiber') || k.startsWith('__reactInternals'),
      );
      if (!fiberKey) return null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rootNode = (gridEl as any)[fiberKey];
      const visited = new WeakSet<object>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stack: any[] = [rootNode];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const processApi = (api: any): string | null => {
        if (typeof api?.forEachNode !== 'function') return null;
        const candidates: { id: string; ms: number }[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        api.forEachNode((n: any) => {
          const d = n.data;
          if (!d) return;
          const status = String(d.Status ?? d.status ?? '').trim();
          if (status !== 'New') return;
          const raw = d.Added ?? d.added ?? d.createdAt ?? d.created_at ?? '';
          candidates.push({ id: String(n.id), ms: raw ? new Date(raw).getTime() : 0 });
        });
        if (!candidates.length) return null;
        candidates.sort((a, b) => b.ms - a.ms);
        return candidates[0].id;
      };

      while (stack.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const node: any = stack.pop();
        if (!node || typeof node !== 'object') continue;
        if (visited.has(node)) continue;
        visited.add(node);
        const p = node.memoizedProps;
        if (p) {
          const r =
            processApi(p.api) ??
            processApi(p.columnApi) ??
            processApi(p.gridOptions?.api) ??
            processApi(p.gridOptions?.columnApi);
          if (r !== null) return r;
        }
        if (node.sibling) stack.push(node.sibling);
        if (node.child) stack.push(node.child);
      }
      return null;
    });

    if (rowIdFromApi) {
      await this.page.evaluate((rId) => {
        document.querySelector(`.ag-row[row-id="${rId}"]`)?.scrollIntoView({ block: 'center' });
      }, rowIdFromApi);
      await this.page.waitForTimeout(300);
      return rowIdFromApi;
    }

    // ── Strategy 3: DOM ag-after-created class ────────────────────────────────
    const rowIdFromDom = await this.page.evaluate((): string | null => {
      const rows = Array.from(
        document.querySelectorAll('.ag-row.ag-after-created[row-id][aria-rowindex]'),
      );
      if (!rows.length) return null;
      const best = rows.reduce<{ id: string; idx: number } | null>((acc, row) => {
        const idx = parseInt(row.getAttribute('aria-rowindex') ?? '0', 10);
        if (!acc || idx > acc.idx) return { id: row.getAttribute('row-id') ?? '', idx };
        return acc;
      }, null);
      return best?.id ?? null;
    });

    if (rowIdFromDom) {
      await this.page.evaluate((rId) => {
        document.querySelector(`.ag-row[row-id="${rId}"]`)?.scrollIntoView({ block: 'center' });
      }, rowIdFromDom);
      await this.page.waitForTimeout(300);
    }
    return rowIdFromDom;
  }

  /**
   * Scroll the AG-Grid so the row with `rowId` is in the visible viewport.
   *
   * Tries AG-Grid `ensureNodeVisible` first (via React fiber), then falls back
   * to scrolling the grid body to the bottom (where new rows are appended).
   */
  async ensureRowVisible(rowId: string): Promise<void> {
    // Strategy 1: AG-Grid ensureNodeVisible via React fiber
    const scrolled = await this.page.evaluate((rId): boolean => {
      const gridEl = document.querySelector('.ag-root-wrapper');
      if (!gridEl) return false;
      const fiberKey = Object.keys(gridEl).find(k =>
        k.startsWith('__reactFiber') || k.startsWith('__reactInternals'),
      );
      if (!fiberKey) return false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rootNode = (gridEl as any)[fiberKey];
      const visited = new WeakSet<object>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stack: any[] = [rootNode];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tryEnsure = (api: any): boolean => {
        if (typeof api?.ensureNodeVisible !== 'function') return false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        api.ensureNodeVisible((n: any) => String(n.id) === rId, 'middle');
        return true;
      };
      while (stack.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const node: any = stack.pop();
        if (!node || typeof node !== 'object') continue;
        if (visited.has(node)) continue;
        visited.add(node);
        const p = node.memoizedProps;
        if (p) {
          if (
            tryEnsure(p.api) || tryEnsure(p.columnApi) ||
            tryEnsure(p.gridOptions?.api) || tryEnsure(p.gridOptions?.columnApi)
          ) return true;
        }
        const s = node.stateNode;
        if (s && typeof s === 'object') {
          if (tryEnsure(s.api) || tryEnsure(s.columnApi)) return true;
        }
        if (node.sibling) stack.push(node.sibling);
        if (node.child) stack.push(node.child);
      }
      return false;
    }, rowId);

    await this.page.waitForTimeout(400);

    // Strategy 2: if row still not in DOM, scroll grid body to the bottom
    const inDom = await this.page.evaluate((rId) =>
      !!document.querySelector(`.ag-row[row-id="${rId}"]`), rowId,
    );
    if (!inDom) {
      await this.page.evaluate(() => {
        const vp =
          document.querySelector<HTMLElement>('.ag-body-viewport') ??
          document.querySelector<HTMLElement>('.ag-center-cols-viewport');
        if (vp) vp.scrollTop = vp.scrollHeight;
      });
      await this.page.waitForTimeout(500);
    }
    if (!scrolled && inDom) {
      await this.page.evaluate((rId) => {
        document.querySelector(`.ag-row[row-id="${rId}"]`)?.scrollIntoView({ block: 'center' });
      }, rowId);
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Select a row in the AG-Grid by clicking its Status cell. This mimics the
   * user clicking a row to highlight it (equivalent to clicking the map pin).
   */
  async selectRowInGrid(rowId: string): Promise<void> {
    await this.ensureRowVisible(rowId);
    const row = this.page.locator(`.ag-row[row-id="${rowId}"]`).first();
    await row.waitFor({ state: 'visible', timeout: 10_000 });
    const cell = this.page
      .locator(`.ag-row[row-id="${rowId}"] .ag-cell[col-id="Status"]`)
      .first();
    if (await cell.count() > 0) {
      await cell.click();
    } else {
      await row.click();
    }
    await this.page.waitForTimeout(300);
  }

  /**
   * Wait until the Google Maps instance is alive and can return a valid
   * center + bounds. Call this after any operation that may cause the map
   * to reload (e.g. after site creation completes).
   */
  async waitForMapReady(timeout = 30_000): Promise<void> {
    await this.installMapHelpers();
    await this.page.waitForFunction(
      () => {
        type W = typeof window & { getMapInstance?: () => unknown };
        const m = (window as W).getMapInstance?.();
        if (!m) return false;
        try {
          const map = m as { getCenter(): unknown; getBounds(): unknown };
          return Boolean(map.getCenter() && map.getBounds());
        } catch {
          return false;
        }
      },
      undefined,
      { timeout },
    );
  }

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
    // Ensure the map is alive before attempting to pan
    await this.waitForMapReady(30_000);
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

  // ---------------------------------------------------------------------------
  // Search → Add-site flow
  // ---------------------------------------------------------------------------

  /**
   * Type `address` into the search bar and press Enter to trigger the search.
   * The map will re-center and the "Add Site" button will become visible.
   */
  async searchForAddress(address: string): Promise<void> {
    await this.searchInput.click();
    await this.searchInput.fill('');
    await this.searchInput.pressSequentially(address, { delay: 30 });
    await this.searchInput.press('Enter');
  }

  /**
   * Click the "Add Site" button that appears after a successful search.
   * Falls back to a JS-click if the button is obscured.
   */
  async clickAddSite(): Promise<void> {
    await this.addSiteButton.waitFor({ state: 'visible', timeout: 20_000 });
    try {
      await this.addSiteButton.click({ timeout: 5_000 });
    } catch {
      await this.addSiteButton.evaluate((el: HTMLElement) => el.click());
    }
  }

  // ---------------------------------------------------------------------------
  // Grid cell interaction
  // ---------------------------------------------------------------------------

  /**
   * Return every col-id currently rendered in the AG-Grid DOM (header + body).
   * Only columns inside the current viewport buffer are returned.
   */
  async getGridColumnIds(): Promise<string[]> {
    return this.page.evaluate(() => {
      const ids = new Set<string>();
      document
        .querySelectorAll('.ag-cell[col-id], .ag-header-cell[col-id]')
        .forEach(el => {
          const id = el.getAttribute('col-id');
          if (id) ids.add(id);
        });
      return Array.from(ids).sort();
    });
  }

  /**
   * Try to retrieve ALL column definitions from the AG-Grid instance via the
   * React fiber tree. Returns null if the API cannot be reached.
   *
   * The result can be used to find the correct `col-id` for any named column
   * without having to scroll the grid first.
   */
  async getAllColumnDefinitions(): Promise<{ id: string; header: string }[] | null> {
    return this.page.evaluate((): { id: string; header: string }[] | null => {
      const gridEl = document.querySelector('.ag-root-wrapper');
      if (!gridEl) return null;

      // Locate the React fiber key attached to this DOM element
      const fiberKey = Object.keys(gridEl).find(k =>
        k.startsWith('__reactFiber') || k.startsWith('__reactInternals'),
      );
      if (!fiberKey) return null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let node = (gridEl as any)[fiberKey];
      let maxIter = 400;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function extractCols(api: any): { id: string; header: string }[] | null {
        try {
          if (typeof api?.getAllGridColumns === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return api.getAllGridColumns().map((c: any) => ({
              id: c.getColId(),
              header: (c.getColDef().headerName as string) ?? c.getColId(),
            }));
          }
          if (typeof api?.getAllColumns === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return api.getAllColumns().map((c: any) => ({
              id: c.getColId(),
              header: (c.getColDef().headerName as string) ?? c.getColId(),
            }));
          }
        } catch { /* */ }
        return null;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function tryNode(n: any): { id: string; header: string }[] | null {
        if (!n) return null;
        const p = n.memoizedProps;
        if (p) {
          const r = extractCols(p.api) ?? extractCols(p.columnApi) ?? extractCols(p.gridOptions?.api) ?? extractCols(p.gridOptions?.columnApi);
          if (r) return r;
          // Column defs array on the component props
          if (Array.isArray(p.columnDefs) && p.columnDefs.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return p.columnDefs.map((d: any) => ({
              id: (d.colId ?? d.field ?? d.headerName ?? '') as string,
              header: (d.headerName ?? d.field ?? d.colId ?? '') as string,
            }));
          }
        }
        return null;
      }

      while (node && maxIter-- > 0) {
        const result = tryNode(node);
        if (result) return result;
        node = node.child ?? node.sibling ?? node.return;
      }
      return null;
    });
  }

  /**
   * Scroll the AG-Grid horizontal viewport so that the column with `colId`
   * becomes visible. Tries the AG-Grid API first (via React fiber), then
   * performs a pixel-by-pixel scan across the full grid width.
   */
  async scrollGridToColumn(colId: string): Promise<boolean> {
    // Step 1 – Try AG-Grid's ensureColumnVisible via React fiber
    const found = await this.page.evaluate((targetId) => {
      const gridEl = document.querySelector('.ag-root-wrapper');
      if (!gridEl) return false;
      const fiberKey = Object.keys(gridEl).find(k =>
        k.startsWith('__reactFiber') || k.startsWith('__reactInternals'),
      );
      if (!fiberKey) return false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let node = (gridEl as any)[fiberKey];
      let maxIter = 400;
      while (node && maxIter-- > 0) {
        const p = node.memoizedProps;
        if (p) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tryEnsure = (api: any) => {
            if (typeof api?.ensureColumnVisible === 'function') {
              api.ensureColumnVisible(targetId, 'start');
              return true;
            }
            return false;
          };
          if (tryEnsure(p.api) || tryEnsure(p.columnApi) || tryEnsure(p.gridOptions?.api) || tryEnsure(p.gridOptions?.columnApi)) return true;
        }
        node = node.child ?? node.sibling ?? node.return;
      }
      return false;
    }, colId);
    if (found) { await this.page.waitForTimeout(400); return true; }

    // Step 2 – Pixel scan: scroll the center viewport in 150-px increments
    // and check whether the col-id appears in the DOM after each step.
    const totalWidth: number = await this.page.evaluate(() => {
      return (document.querySelector('.ag-center-cols-container') as HTMLElement | null)?.scrollWidth ?? 0;
    });

    for (let scrollLeft = 0; scrollLeft <= totalWidth; scrollLeft += 150) {
      await this.page.evaluate((sl) => {
        for (const sel of ['.ag-center-cols-viewport', '.ag-body-horizontal-scroll-viewport']) {
          const el = document.querySelector(sel);
          if (el) el.scrollLeft = sl;
        }
      }, scrollLeft);
      await this.page.waitForTimeout(200);
      const ids = await this.getGridColumnIds();
      if (ids.includes(colId)) return true;
    }
    return false;
  }

  /**
   * Open the site Edit Screen for the row identified by `rowId`.
   *
   * The app shows a ">" chevron/arrow indicator inside the Status cell of each
   * row. Clicking it opens the side-panel Edit Screen for that site.
   *
   * Tries multiple strategies in order until the edit panel becomes visible:
   *  1. Click the ">" indicator button/element inside the Status cell.
   *  2. Click the Status cell itself (entire cell may be the trigger).
   *  3. Click col-id="1" (right-pinned column, may be the detail trigger).
   *  4. Double-click the row itself as a last resort.
   */
  /**
   * Open the site Edit Screen for the row identified by `rowId`.
   *
   * The right-pinned cell with `col-id="1"` is the row-detail trigger in
   * APSiteTracker.  Clicking it slides in the edit panel (`absractor-values`).
   *
   * Falls back to double-clicking the row if the dedicated cell is not found.
   */
  async openSiteEditScreen(rowId: string): Promise<void> {
    await this.ensureRowVisible(rowId);
    const row = this.page.locator(`.ag-row[row-id="${rowId}"]`).first();
    await row.waitFor({ state: 'visible', timeout: 10_000 });

    const panelVisible = async () =>
      (await this.editScreen.count()) > 0 &&
      (await this.editScreen.first().isVisible().catch(() => false));

    // Strategy 1 (primary): click the right-pinned col-id="1" detail trigger
    const col1 = this.page
      .locator(`.ag-row[row-id="${rowId}"] .ag-cell[col-id="1"]`)
      .first();
    if (await col1.count() > 0) {
      await col1.click().catch(() => undefined);
      await this.page.waitForTimeout(1_200);
      if (await panelVisible()) return;
    }

    // Strategy 2: double-click the row itself as a fallback
    await row.dblclick({ timeout: 5_000 }).catch(() => undefined);
    await this.page.waitForTimeout(800);
  }

  /**
   * Scroll the AG-Grid row into view and double-click the cell identified by
   * `rowId` (the `row-id` attribute) and `colId` (the `col-id` attribute).
   * Double-clicking a cell opens the site Edit Screen in this application.
   *
   * The method first tries `ensureColumnVisible` via the AG-Grid / React API,
   * then falls back to a pixel-scan scroll so that even virtualised columns
   * are brought into the DOM before the click.
   */
  async doubleClickCell(rowId: string, colId: string): Promise<void> {
    const scrolled = await this.scrollGridToColumn(colId);

    const cell = this.page
      .locator(`.ag-row[row-id="${rowId}"] .ag-cell[col-id="${colId}"]`)
      .first();

    const present = await cell.count();
    if (!present) {
      const available = await this.getGridColumnIds();
      const allDefs = await this.getAllColumnDefinitions();
      throw new Error(
        `doubleClickCell: col-id="${colId}" not found in row "${rowId}" ` +
        `(scrolled=${scrolled}). ` +
        `DOM col-ids: ${JSON.stringify(available)}. ` +
        `All column defs: ${JSON.stringify(allDefs)}`,
      );
    }

    await cell.waitFor({ state: 'visible', timeout: 15_000 });

    // AG-Grid pinned left/right columns sit above the scrollable center cells
    // and intercept pointer events. We compute the visible (non-covered) region
    // of the target cell and double-click there via page.mouse to avoid the
    // overlay, using a JS event-dispatch fallback if the cell has no safe area.
    const clickPos = await cell.evaluate((el) => {
      const cellRect = el.getBoundingClientRect();
      const leftPinned = document.querySelector('.ag-pinned-left-cols-container');
      const rightPinned = document.querySelector('.ag-pinned-right-cols-container');
      const leftEdge = leftPinned ? leftPinned.getBoundingClientRect().right : 0;
      const rightEdge = rightPinned
        ? rightPinned.getBoundingClientRect().left
        : window.innerWidth;
      const visibleLeft = Math.max(cellRect.left, leftEdge);
      const visibleRight = Math.min(cellRect.right, rightEdge);
      if (visibleLeft >= visibleRight) return null;
      return {
        x: (visibleLeft + visibleRight) / 2,
        y: cellRect.top + cellRect.height / 2,
      };
    });

    if (clickPos) {
      await this.page.mouse.dblclick(clickPos.x, clickPos.y);
    } else {
      // Cell has no visible region — fire synthetic events directly
      await cell.evaluate((el) => {
        const opts: MouseEventInit = { bubbles: true, cancelable: true, view: window };
        for (const t of ['mousedown','mouseup','click','mousedown','mouseup','click','dblclick']) {
          el.dispatchEvent(new MouseEvent(t, opts));
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Edit screen
  // ---------------------------------------------------------------------------

  /** Wait for the site Edit Screen to become visible. */
  async waitForEditScreen(timeout = 15_000): Promise<void> {
    await this.editScreen.waitFor({ state: 'visible', timeout });
  }

  /**
   * Click an input/textarea, clear its current value, type `value`
   * character-by-character, then press Tab to move to the next field (which
   * triggers the app's save handler for the current field).
   *
   * The APSiteTracker edit panel hides textareas with a CSS `hide` class until
   * the field is focused; this method removes that class if present so that
   * Playwright can interact with the element.
   */
  async fillInputAndConfirm(input: Locator, value: string): Promise<void> {
    // Remove the `hide` class from the parent container if present, so the
    // textarea becomes interactable.
    await input.evaluate((el) => {
      let p = el.parentElement;
      while (p && p !== document.body) {
        if (p.classList.contains('hide')) p.classList.remove('hide');
        p = p.parentElement;
      }
    }).catch(() => undefined);
    await input.waitFor({ state: 'visible', timeout: 10_000 }).catch(async () => {
      // Force visibility via JS as a last resort
      await input.evaluate((el) => {
        (el as HTMLElement).style.display = 'block';
        (el as HTMLElement).style.visibility = 'visible';
      });
    });
    await input.click();
    await input.fill('');
    await input.pressSequentially(value, { delay: 30 });
    // Use keyboard.press on the currently focused element rather than the
    // locator — the app may re-render the field after typing, making the
    // original locator reference stale.
    await this.page.keyboard.press('Tab');
    await this.page.waitForTimeout(500);
  }

  /**
   * Return the value of the auto-calculated annual gross rent field,
   * stripped of leading/trailing whitespace and formatting characters.
   */
  async getGrossRentText(): Promise<string> {
    // Remove hide class so the textarea is interactable
    await this.grossRentValue.evaluate((el) => {
      let p = el.parentElement;
      while (p && p !== document.body) {
        if (p.classList.contains('hide')) p.classList.remove('hide');
        p = p.parentElement;
      }
    }).catch(() => undefined);
    await this.grossRentValue.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
    // Try inputValue first (textarea/input), fall back to textContent
    const val = await this.grossRentValue.inputValue().catch(
      async () => (await this.grossRentValue.textContent() ?? '').trim(),
    );
    return val.trim();
  }

  /**
   * Click the Close button on the Edit Screen and wait for it to be hidden.
   */
  async closeEditScreen(): Promise<void> {
    await this.editScreenCloseButton.waitFor({ state: 'visible', timeout: 10_000 });
    try {
      await this.editScreenCloseButton.click({ timeout: 5_000 });
    } catch {
      await this.editScreenCloseButton.evaluate((el: HTMLElement) => el.click());
    }
    await this.editScreen.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => undefined);
  }

  // ---------------------------------------------------------------------------
  // Attachments
  // ---------------------------------------------------------------------------

  /**
   * Click "Add New Attachment", intercept the OS file chooser, and upload the
   * file at `filePath`. Waits 2 s after upload for the UI to process the file.
   */
  async addAttachment(filePath: string): Promise<void> {
    // Scroll the edit panel body so the attachment area at the bottom is visible.
    await this.page.evaluate(() => {
      const panel = document.querySelector('.absractor-values, .edit-workspace');
      if (panel) panel.scrollTop = panel.scrollHeight;
    }).catch(() => undefined);
    await this.page.waitForTimeout(400);

    // Wait for the icon-button with class "attachment-item add" to be visible.
    await this.addNewAttachmentButton.waitFor({ state: 'visible', timeout: 10_000 });

    const fileChooserPromise = this.page.waitForEvent('filechooser', { timeout: 15_000 });
    await this.addNewAttachmentButton.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);
    await this.page.waitForTimeout(2_000);
  }

  /**
   * Return the displayed names of all files currently in the attachment list.
   * Looks for common filename element patterns; update the inner selector if
   * the app uses a different structure.
   */
  async getAttachmentNames(): Promise<string[]> {
    const isVisible = await this.attachmentList.isVisible().catch(() => false);
    if (!isVisible) return [];
    const items = this.attachmentList.locator(
      '[class*="attachment-name"], [class*="file-name"], [class*="filename"], li, tr',
    );
    const count = await items.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = (await items.nth(i).textContent() ?? '').trim();
      if (text) names.push(text);
    }
    return names;
  }

  /**
   * Return the visible error text when an unsupported file type is uploaded,
   * or `null` if no error element is currently visible.
   */
  async getAttachmentErrorText(): Promise<string | null> {
    const visible = await this.attachmentError.isVisible().catch(() => false);
    if (!visible) return null;
    return (await this.attachmentError.textContent() ?? '').trim() || null;
  }
}
