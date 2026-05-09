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
    email: process.env.TEST_USERNAME ?? 'example@example.com',
    password: process.env.TEST_PASSWORD ?? 'password',
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
    /** Used by the "Adding sites and adding data to a site" test case. */
    searchSite: {
      label: 'Palm Avenue San Diego',
      address: '3265 Palm Avenue, San Diego, CA',
      city: 'San Diego',
      state: 'CA',
      lat: 32.583551,
      lng: -117.062927,
    } satisfies SiteLocation,
  },
  /**
   * Field values used when editing a newly created site.
   * Annual gross rent = rent ($/sqft/yr) × size (sqft) = 7.93 × 2500 = 19 825.
   */
  siteInputs: {
    size: '2500',
    rent: '7.93',
    annualGrossRent: '19825',
  } as const,
  /**
   * AG-Grid column IDs used to locate specific cells in the sites table.
   * These match the app's actual col-id values (confirmed via AG-Grid API).
   */
  colIds: {
    size: 'Size',
    rent: 'Rent',
    grossRent: 'Price',
  } as const,
} as const;
