# Judge.me CSV Export

The browser exports the CSV in `src/main.jsx`.

The UI has two export scopes:

- **Latest CSV**: rows from the latest scrape export set. In incremental mode, these are the newly discovered rows highlighted in the table.
- **All CSV**: every saved row currently visible in the table.

## Columns

The output columns intentionally match `data/Judgeme_Reviews_direct_import_example.csv`:

```csv
title,body,rating,review_date,reviewer_name,reviewer_email,product_id,product_handle,reply,picture_urls
```

## Field Mapping

- `title`: first sentence of eBay feedback text, capped for readability.
- `body`: full eBay feedback text.
- `rating`: numeric star value derived from eBay rating text.
- `review_date`: eBay date when parseable, otherwise a rough UTC date derived from relative text.
- `reviewer_name`: cleaned eBay buyer username.
- `reviewer_email`: blank.
- `product_id`: blank.
- `product_handle`: SKU-derived handle from product catalog matching.
- `reply`: blank.
- `picture_urls`: buyer-uploaded feedback photo URLs only.

## Picture URL Rules

Only buyer-uploaded feedback images are exported. Product/listing photos are deliberately ignored.

Accepted buyer photo URLs are eBay image paths like:

```text
https://i.ebayimg.com/00/s/OTAwWDE2MDA=/z/z0IAAeSwS4JqIOGy/$_1.JPG?set_id=8800005007
```

Before export, the scraper:

- removes query strings and hashes,
- URL-encodes `$` as `%24`,
- keeps only the image file URL.

Final CSV value:

```text
https://i.ebayimg.com/00/s/OTAwWDE2MDA=/z/z0IAAeSwS4JqIOGy/%24_1.JPG
```

## Buyer Name Cleanup

The scraper removes feedback counts, prices, and verification labels from reviewer names.

Example:

```text
jumppilotross (823)US $29.99
```

exports as:

```text
jumppilotross
```
