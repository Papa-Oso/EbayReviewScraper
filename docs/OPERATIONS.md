# Operations

## Reset Incremental History

Incremental scans use `data/feedback.sqlite` to avoid exporting rows already seen.

Use **Reset incremental history** in the UI when:

- parser logic changes,
- CSV mapping changes,
- buyer photo extraction changes,
- you want to re-export everything.

The reset calls:

```text
POST /api/feedback-history/reset
```

and deletes rows from:

```text
scanned_feedback
```

## Saved Browser Session

With saved sessions enabled, Chromium stores eBay login state under:

```text
data/browser-profile/
```

This folder is ignored by Git.

If eBay expires the session, the app opens the eBay sign-in page and waits for login.

## Runtime Files

Ignored runtime files:

- `.env`
- `data/feedback.sqlite`
- `data/browser-profile/`
- `dist/`
- `node_modules/`
- `*.log`

## Common Fixes

If the CSV is missing rows after a code change, reset incremental history and scrape again.

If product handles are blank, check the title/SKU catalog and fuzzy matching tests.

If `picture_urls` is blank, the feedback row likely did not expose buyer-uploaded photos.
