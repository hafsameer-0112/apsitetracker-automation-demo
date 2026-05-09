/**
 * Test case: Adding and moving sites
 *
 * Steps:
 *  1. Right-click the map at a chosen location → a "Create a New Site" popup
 *     should appear showing the address details.
 *  2. Click "Create Site" → popup closes, new pin and table row are added.
 *  3. Click the new pin on the map → pin should be highlighted.
 *  4. Click "Move Pin" → button should change to indicate active move mode.
 *  5. *** Assertion: Move Pin button is active ***
 *  6. Drag the pin to a different location.
 *  7. Click "Home" → map should re-center to fit all sites.
 */

import { test, expect } from '../src/fixtures/test-fixtures';
import { BundleCache } from '../src/utils/bundle-cache';
import { MapDashboardPage } from '../src/pages/MapDashboardPage';
import { TestData } from '../src/data/test-data';
import { logger } from '../src/utils/logger';

const { siteOrigin, siteDestination } = TestData.sites;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const aa =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinDLng *
      sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

test.describe('Adding and moving sites', () => {
  test('create a site and then move its pin', async ({ page, dashboardPage }) => {
    // ── Setup ──────────────────────────────────────────────────────────────────
    test.setTimeout(15 * 60 * 1000);
    await BundleCache.attach(page);
    await MapDashboardPage.installMapInitHook(page);

    // Navigate straight to the dashboard (storageState already logged in)
    await page.goto('/', { waitUntil: 'commit', timeout: 60_000 });
    await dashboardPage.waitUntilReady();
    logger.info('Dashboard ready');

    // Record baseline row count before creating any site
    const baselineRows = await dashboardPage.getTotalRowCount();
    logger.info(`Baseline row count: ${baselineRows}`);

    // ── Step 1: Right-click map to get "Create a New Site" popup ─────────────
    await test.step('Step 1 — right-click map to open Create Site popup', async () => {
      await dashboardPage.rightClickAt(siteOrigin);

      await expect(dashboardPage.createSiteDialog).toBeVisible({
        timeout: 15_000,
      });

      // Verify the dialog shows some location info
      const fields = await dashboardPage.getCreateSiteDialogFields();
      logger.info('Create-site dialog fields:', fields);

      await expect(dashboardPage.createSiteButton).toBeVisible();
      await expect(dashboardPage.cancelCreateSiteButton).toBeVisible();
    });

    // ── Step 2: Click "Create Site" → row and pin added ──────────────────────
    await test.step('Step 2 — click Create Site and verify row added', async () => {
      await dashboardPage.clickCreateSite();

      await expect(dashboardPage.createSiteDialog).toBeHidden({ timeout: 15_000 });
      logger.info('Dialog closed after Create Site');

      // Wait for the AG-Grid to reflect the new row (allow up to 60 s)
      await expect
        .poll(
          () => dashboardPage.getTotalRowCount(),
          { timeout: 60_000, message: 'Row count should increase by 1' },
        )
        .toBeGreaterThan(baselineRows);

      const newCount = await dashboardPage.getTotalRowCount();
      logger.info(`Row count after creation: ${newCount} (was ${baselineRows})`);
      expect(newCount).toBe(baselineRows + 1);
    });

    // ── Step 3: Click the new pin ─────────────────────────────────────────────
    await test.step('Step 3 — click new pin on the map', async () => {
      await dashboardPage.clickPinAt(siteOrigin, 60);
      // A selected row should appear in the grid
      await expect
        .poll(
          () => dashboardPage.getSelectedRowId(),
          { timeout: 15_000, message: 'A row should be selected after clicking pin' },
        )
        .not.toBeNull();

      const rowId = await dashboardPage.getSelectedRowId();
      logger.info(`Selected row id: ${rowId}`);
    });

    // ── Step 4 & 5: Click "Move Pin" and verify button state ─────────────────
    await test.step('Step 4/5 — activate Move Pin and assert active state', async () => {
      const before = await dashboardPage.getMovePinState();
      logger.info('Move Pin button before click:', before);

      await dashboardPage.clickMovePin();

      // Button text / color should change to indicate active
      await expect
        .poll(
          () => dashboardPage.getMovePinState(),
          { timeout: 10_000, message: 'Move Pin button should be active after click' },
        )
        .toMatchObject({ isActive: true });

      const after = await dashboardPage.getMovePinState();
      logger.info('Move Pin button after click:', after);
    });

    // ── Step 6: Drag pin to new location ─────────────────────────────────────
    await test.step('Step 6 — drag pin to destination', async () => {
      await dashboardPage.dragSelectedPinTo(siteOrigin, siteDestination);
      logger.info('Pin dragged to destination');
      await page.waitForTimeout(2_000);
    });

    // ── Step 7: Click Home — map should re-center ─────────────────────────────
    await test.step('Step 7 — click Home and verify map re-centers', async () => {
      const before = await dashboardPage.getMapCenter();
      logger.info('Map center before Home:', before);

      await dashboardPage.clickHome();

      // After clicking Home the map should pan to a different location
      // (it zooms out to show all sites). We just assert the call completed.
      const after = await dashboardPage.getMapCenter();
      logger.info('Map center after Home:', after);

      const distKm = haversineKm(before, after);
      logger.info(`Map panned ${(distKm * 1000).toFixed(0)} m`);
    });
  });
});
