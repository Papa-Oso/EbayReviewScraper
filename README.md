# eBay Feedback Exporter

Local web app for collecting eBay seller/listing feedback and exporting it as a Shopify review import CSV.

## What It Does

- Scrapes eBay listing, seller profile, or store URLs.
- Keeps a local scan history in `data/feedback.sqlite` so incremental scans can skip feedback already seen.
- Maps eBay item titles to Shopify product handles through `data/ebay_titles_skus_in_display_order.csv`.
- Exports Shopify-ready CSV columns based on `data/direct_import_sample.csv`.
- Includes buyer-uploaded feedback photo URLs in `picture_urls` when eBay exposes them in the feedback row.

## Setup

```bash
npm install
```

Create a local `.env` file from the example:

```bash
cp .env.example .env
```

Set your private default URL locally:

```env
VITE_DEFAULT_EBAY_URL=https://www.ebay.com/usr/YOUR_SELLER_NAME
```

`.env`, browser profile data, and the SQLite database are ignored by Git.

## Run

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

The API runs on:

```text
http://127.0.0.1:4141
```

## Export Flow

1. Paste an eBay listing, store, or seller feedback URL.
2. Choose scan history mode:
   - `Incremental`: skip rows already saved in SQLite.
   - `Full`: include all rows seen during this scan.
3. Scrape feedback.
4. Download CSV.

Use **Reset incremental history** when you want old rows treated as new again, or after changing parsing/export behavior.

## Important Files

- `src/main.jsx`: React UI and Shopify CSV generation.
- `src/styles.css`: dashboard layout and theme.
- `server/index.js`: Express API routes.
- `server/scraper.js`: Playwright/Cheerio eBay scraping and row parsing.
- `server/feedbackStore.js`: local SQLite history and incremental reset.
- `server/productCatalog.js`: SKU/product-handle enrichment.
- `data/ebay_titles_skus_in_display_order.csv`: source title-to-SKU mapping.
- `data/direct_import_sample.csv`: Shopify import CSV shape.

## Validation

```bash
npm test
npm run build
```

## More Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Shopify CSV Export](docs/CSV_EXPORT.md)
- [Product Catalog Matching](docs/PRODUCT_CATALOG.md)
- [Operational Notes](docs/OPERATIONS.md)
