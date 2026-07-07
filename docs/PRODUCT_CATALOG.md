# Product Catalog Matching

Product matching lives in `server/productCatalog.js` and uses:

```text
data/Item_SKU_X_Ref.csv
```

That file is intentionally ignored by Git because it can contain private SKU data. Use `data/Item_SKU_X_Ref_example.csv` as the public template.

The CSV is expected to contain:

```csv
Title,Custom label (SKU)
```

## Matching Order

`findSkuForTitle` tries matches in this order:

1. Exact normalized title match.
2. Contains match, where either title contains the other.
3. Fuzzy fallback using token overlap and character bigram similarity.

The fuzzy fallback only accepts matches above the configured threshold, so unrelated products remain blank.

## Shopify Handle

Matched SKU values become Shopify product handles by lowercasing and replacing non-alphanumeric characters with hyphens.

Example:

```text
JW-SCORPION-FREECOM-001
```

becomes:

```text
jw-scorpion-freecom-001
```

## When To Update The Catalog

Update `data/Item_SKU_X_Ref.csv` when:

- a new eBay listing title should map to a Shopify product,
- a SKU changes,
- fuzzy matching finds no reasonable result.

If the private catalog is missing, the app still exports reviews and leaves `product_handle` blank.

Run tests after catalog/matching changes:

```bash
npm test
```
