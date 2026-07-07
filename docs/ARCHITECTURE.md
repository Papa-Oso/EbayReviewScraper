# Architecture

The app has three main layers:

1. React/Vite frontend
2. Express API
3. Local data files under `data/`

## Request Flow

The UI calls `POST /api/scrape` with:

- `url`: eBay listing, store, or seller URL.
- `mode`: currently always sent as `auto`.
- `maxItems`: store listing cap.
- `maxPages`: seller feedback page cap.
- `scanMode`: `full` or `incremental`.
- `useSavedSession`: whether to use the persistent Playwright browser profile.

The server then:

1. Scrapes eBay through `server/scraper.js`.
2. Applies local history through `server/feedbackStore.js`.
3. Enriches rows with product SKU/handle data through `server/productCatalog.js`.
4. Returns enriched rows to the UI.

The browser performs CSV generation client-side from the returned rows.

## Local State

Ignored local state:

- `.env`
- `data/feedback.sqlite`
- `data/browser-profile/`

Tracked data:

- `data/ebay_titles_skus_in_display_order.csv`
- `data/direct_import_sample.csv`

## Saved eBay Login

When saved sessions are enabled, Playwright launches a persistent Chromium profile at `data/browser-profile/`.
The app checks the first loaded eBay page for signed-out wording and only sends the user to sign-in when necessary.

## API Routes

- `GET /api/health`: health check.
- `POST /api/scrape`: scrape, history-filter, and enrich feedback rows.
- `POST /api/feedback-history/reset`: delete all rows from `scanned_feedback`.
