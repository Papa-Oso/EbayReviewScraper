import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scrapeEbayFeedback } from './scraper.js';
import { applyFeedbackHistory, loadFeedbackHistory, resetFeedbackHistory } from './feedbackStore.js';
import { enrichRowsWithProducts, productCatalogStatus } from './productCatalog.js';

const app = express();
const port = process.env.PORT || 4141;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/feedback-history', async (_req, res) => {
  try {
    const rows = await enrichRowsWithProducts(await loadFeedbackHistory());
    const payload = {
      mode: 'history',
      listings: [],
      rows: rows.map((row) => ({ ...row, is_latest: false })),
      latestRows: [],
      warnings: [],
      history: {
        scan_mode: 'history',
        rows_seen: rows.length,
        rows_exported: 0,
        new_rows: 0,
        skipped_existing_rows: 0
      }
    };

    await appendCatalogWarning(payload);
    res.json(payload);
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Saved feedback could not be loaded.'
    });
  }
});

app.post('/api/scrape', async (req, res) => {
  const {
    url,
    mode = 'auto',
    maxItems = 25,
    maxPages = 8,
    allowManualVerification = true,
    useSavedSession = false,
    scanMode = 'full'
  } = req.body ?? {};

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Paste an eBay listing or store URL.' });
    return;
  }

  try {
    const result = await scrapeEbayFeedback({
      inputUrl: url,
      mode,
      maxItems: clampNumber(maxItems, 1, 250, 25),
      maxPages: clampNumber(maxPages, 1, 100, 8),
      allowManualVerification: Boolean(allowManualVerification),
      useSavedSession: Boolean(useSavedSession)
    });

    // Scraped rows are deliberately processed in this order:
    // 1. history filtering decides whether rows are new enough to export,
    // 2. product enrichment maps rows to Judge.me product handles.
    const history = await applyFeedbackHistory(result.rows, { scanMode });
    const latestRows = await enrichRowsWithProducts(history.rows);
    const latestKeys = new Set(latestRows.map((row) => row.feedback_key).filter(Boolean));
    const allRows = await enrichRowsWithProducts(await loadFeedbackHistory());
    result.latestRows = latestRows.map((row) => ({ ...row, is_latest: true }));
    result.rows = allRows.map((row) => ({ ...row, is_latest: latestKeys.has(row.feedback_key) }));
    result.history = history.stats;
    await appendCatalogWarning(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message || 'The scrape failed.',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.post('/api/feedback-history/reset', async (_req, res) => {
  try {
    const stats = await resetFeedbackHistory();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: error.message || 'The incremental history reset failed.'
    });
  }
});

app.use(express.static(path.join(rootDir, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(rootDir, 'dist', 'index.html'), (error) => {
    if (error) res.status(404).send('Run npm run dev to start the app.');
  });
});

app.listen(port, () => {
  console.log(`eBay feedback exporter listening on http://127.0.0.1:${port}`);
});

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

async function appendCatalogWarning(payload) {
  const catalog = await productCatalogStatus();
  if (!catalog.missing) return;

  payload.warnings = [
    ...(payload.warnings || []),
    'Product catalog CSV was not found, so product_handle values are blank.'
  ];
}
