/**
 * Centralised test data. Keep credentials out of git — load secrets from .env.
 */
export interface SiteLocation {
  readonly label: string;
  readonly address: string;
  readonly city: string;
  readonly state: string;
  readonly lat: number;
  readonly lng: number;
}

export const TestData = {
  validUser: {
    email: process.env.TEST_USERNAME ?? 'mikejansen1999@hotmail.com',
    password: process.env.TEST_PASSWORD ?? 'a8pBsuCi835VU6z',
  },
  invalidUser: {
    email: 'invalid_user@example.com',
    password: 'invalid_pass',
  },
  /**
   * Coordinates from the "Adding and moving sites" test case.
   * `siteOrigin` is where the new site is created (Step 1–2).
   * `siteDestination` is where the pin is moved to (Step 6).
   */
  sites: {
    siteOrigin: {
      label: 'New Chula Vista site',
      address: '1403 3rd Avenue',
      city: 'Chula Vista',
      state: 'CA',
      lat: 32.603144,
      lng: -117.064744,
    } satisfies SiteLocation,
    siteDestination: {
      label: 'Moved Chula Vista site',
      address: '5227 University Avenue',
      city: 'Chula Vista',
      state: 'CA',
      lat: 32.602253,
      lng: -117.064313,
    } satisfies SiteLocation,
  },
} as const;
