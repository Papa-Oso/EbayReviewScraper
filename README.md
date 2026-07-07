# eBay Feedback Exporter

Local web app for collecting eBay seller/listing feedback and exporting it as a Judge.me review import CSV.

## What It Does

- Scrapes eBay listing, seller profile, or store URLs.
- Keeps a local scan history in `data/feedback.sqlite` so incremental scans can skip feedback already seen.
- Maps eBay item titles to Shopify product handles through an ignored local catalog at `data/Item_SKU_X_Ref.csv`.
- Exports Judge.me-ready CSV columns based on `data/Judgeme_Reviews_direct_import_example.csv`.
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

Optional product handle matching uses a private local CSV. Start from the public example and keep your real SKU catalog untracked:

```bash
cp data/Item_SKU_X_Ref_example.csv data/Item_SKU_X_Ref.csv
```

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

- `src/main.jsx`: React UI and Judge.me CSV generation.
- `src/styles.css`: dashboard layout and theme.
- `server/index.js`: Express API routes.
- `server/scraper.js`: Playwright/Cheerio eBay scraping and row parsing.
- `server/feedbackStore.js`: local SQLite history and incremental reset.
- `server/productCatalog.js`: SKU/product-handle enrichment.
- `data/Item_SKU_X_Ref_example.csv`: public template for the private title-to-SKU catalog.
- `data/Item_SKU_X_Ref.csv`: ignored local title-to-SKU catalog.
- `data/Judgeme_Reviews_direct_import_example.csv`: Judge.me import CSV shape.

## Validation

```bash
npm test
npm run build
```

## More Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Judge.me CSV Export](docs/CSV_EXPORT.md)
- [Product Catalog Matching](docs/PRODUCT_CATALOG.md)
- [Operational Notes](docs/OPERATIONS.md)
