import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  Music2,
  RotateCcw,
  Search,
  Volume2,
  VolumeX
} from 'lucide-react';
import './styles.css';

// Judge.me review import columns. Keep this list aligned with
// data/Judgeme_Reviews_direct_import_example.csv and docs/CSV_EXPORT.md.
const columns = [
  'title',
  'body',
  'rating',
  'review_date',
  'reviewer_name',
  'reviewer_email',
  'product_id',
  'product_handle',
  'reply',
  'picture_urls'
];

const defaultSettings = {
  defaultEbayUrl: import.meta.env.VITE_DEFAULT_EBAY_URL || '',
  muted: true,
};
const SETTINGS_KEY = 'ebay-review-scraper-settings';

function App() {
  const [settings, setSettings] = useState(() => readSettings());
  const [url, setUrl] = useState(() => readSettings().defaultEbayUrl);
  const [maxItems, setMaxItems] = useState(25);
  const [maxPages, setMaxPages] = useState(100);
  const [scanMode, setScanMode] = useState('incremental');
  const [allowManualVerification, setAllowManualVerification] = useState(true);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);
  const [muted, setMuted] = useState(() => readSettings().muted);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [log, setLog] = useState([]);
  const musicRef = useRef(null);

  const updateSetting = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const updateUrl = (nextUrl) => {
    setUrl(nextUrl);
    updateSetting('defaultEbayUrl', nextUrl);
  };

  useEffect(() => {
    persistSettings(settings);
  }, [settings]);

  useEffect(() => {
    document.documentElement.dataset.theme = 'dark';
    document.documentElement.style.colorScheme = 'dark';
  }, []);

  useEffect(() => {
    loadSavedReviews();
  }, []);

  const exactCount = useMemo(() => {
    return (result?.rows ?? []).filter((row) => row.match_type !== 'seller-profile').length;
  }, [result]);

  const latestCount = result?.latestRows?.length ?? 0;

  useEffect(() => {
    syncMusicState(muted);
  }, [muted]);

  useEffect(() => {
    setSettings((current) => ({ ...current, muted }));
  }, [muted]);

  async function loadSavedReviews() {
    setHistoryLoading(true);

    try {
      const response = await fetch('/api/feedback-history');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Saved feedback could not be loaded.');
      setResult(payload);
      if (payload.rows.length) {
        setLog((entries) => [
          ...entries,
          `Loaded ${payload.rows.length} saved review${payload.rows.length === 1 ? '' : 's'}`
        ]);
      }
    } catch (caught) {
      setError(caught.message);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function runScrape(event) {
    event.preventDefault();
    syncMusicState(muted);
    setLoading(true);
    setError('');
    setResult(null);
    setLog(['Starting saved eBay browser session', 'Checking eBay login before scraping']);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, mode: 'auto', maxItems, maxPages, scanMode, allowManualVerification, useSavedSession: true })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Scrape failed.');
      setResult(payload);
      setLog((entries) => [
        ...entries,
        `Resolved ${payload.listings.length} listing${payload.listings.length === 1 ? '' : 's'}`,
        `Showing ${payload.rows.length} saved review${payload.rows.length === 1 ? '' : 's'}`,
        `Collected ${payload.latestRows?.length ?? 0} latest export row${payload.latestRows?.length === 1 ? '' : 's'}`,
        payload.history
          ? `${payload.history.new_rows} new, ${payload.history.skipped_existing_rows} already scanned`
          : ''
      ].filter(Boolean));
    } catch (caught) {
      setError(caught.message);
      setLog((entries) => [...entries, 'Stopped before export']);
    } finally {
      setLoading(false);
    }
  }

  async function resetIncrementalHistory() {
    const confirmed = window.confirm('Reset incremental scan history? This clears scanned_feedback so the next incremental scan treats every feedback row as new.');
    if (!confirmed) return;

    setResetLoading(true);
    setError('');

    try {
      const response = await fetch('/api/feedback-history/reset', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Incremental reset failed.');

      setResult((current) => current ? {
        ...current,
        rows: [],
        latestRows: [],
        history: {
          ...current.history,
          rows_seen: 0,
          rows_exported: 0,
          new_rows: 0,
          skipped_existing_rows: 0
        }
      } : current);
      setLog((entries) => [
        ...entries,
        `Reset incremental history: removed ${payload.deleted_rows} scanned row${payload.deleted_rows === 1 ? '' : 's'}`
      ]);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setResetLoading(false);
    }
  }

  function toggleMute() {
    setMuted((currentMuted) => {
      const nextMuted = !currentMuted;
      setSettings((current) => ({ ...current, muted: nextMuted }));
      return nextMuted;
    });
  }

  function syncMusicState(isMuted) {
    if (isMuted) {
      musicRef.current?.stop();
      musicRef.current = null;
      return;
    }

    if (!musicRef.current) {
      musicRef.current = createMusicLoop();
      musicRef.current.start().catch(() => {
        musicRef.current?.stop();
        musicRef.current = null;
        setMuted(true);
      });
    }
  }

  function downloadCsv(rows, scope) {
    if (!rows?.length) return;
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = csvFilename(result, scope);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <main className="app">
      <section className="workspace">
        <aside className="panel controls">
          <div className="brand">
            <div className="brand-mark">
              <FileSpreadsheet size={28} aria-hidden="true" />
            </div>
            <div>
              <h1>eBay Feedback Exporter</h1>
              <p>Listing and store feedback to CSV</p>
            </div>
            <div className="brand-actions">
              <button
                type="button"
                className={`sound-toggle ${muted ? 'muted' : ''}`}
                onClick={toggleMute}
                title={muted ? 'Unmute music' : 'Mute music'}
                aria-label={muted ? 'Unmute music' : 'Mute music'}
              >
                {muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
              </button>
            </div>
          </div>

          <form onSubmit={runScrape} className="form">
            <div className="form-row primary-row">
              <label className="field url-field">
                <span>eBay URL</span>
                <input
                  value={url}
                  onChange={(event) => updateUrl(event.target.value)}
                  placeholder="https://www.ebay.com/itm/..."
                  required
                />
              </label>

              <button className="primary" disabled={loading}>
                {loading ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
                <span>{loading ? 'Scraping' : 'Scrape feedback'}</span>
              </button>
            </div>

            <div className="form-row options-row">
              <div className="range-grid">
                <label className="field compact-field">
                  <span>Max items</span>
                  <input
                    type="number"
                    min="1"
                    max="250"
                    value={maxItems}
                    onChange={(event) => setMaxItems(event.target.value)}
                  />
                </label>
                <label className="field compact-field">
                  <span>Feedback pages</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={maxPages}
                    onChange={(event) => setMaxPages(event.target.value)}
                  />
                </label>
              </div>

              <div className="control-group">
                <span className="group-label">Scan history</span>
                <div className="segmented two-part" aria-label="Scan history mode">
                  {[
                    ['full', CheckCircle2, 'Full'],
                    ['incremental', Search, 'Incremental']
                  ].map(([value, Icon, label]) => (
                    <button
                      type="button"
                      key={value}
                      className={scanMode === value ? 'active' : ''}
                      onClick={() => setScanMode(value)}
                      title={label}
                    >
                      <Icon size={16} aria-hidden="true" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="secondary-danger"
                onClick={resetIncrementalHistory}
                disabled={loading || resetLoading}
                title="Reset incremental scan history"
              >
                {resetLoading ? <Loader2 className="spin" size={18} /> : <RotateCcw size={18} />}
                <span>{resetLoading ? 'Resetting history' : 'Reset incremental history'}</span>
              </button>
            </div>
          </form>

          <div className="status-list">
            <div className={`status-row music ${muted ? 'muted' : ''}`}>
              <Music2 size={15} aria-hidden="true" />
              <span>{muted ? 'Music muted' : 'Music armed'}</span>
            </div>
            {log.map((entry) => (
              <div className="status-row" key={entry}>
                <CheckCircle2 size={15} aria-hidden="true" />
                <span>{entry}</span>
              </div>
            ))}
            {error && (
              <div className="status-row error">
                <AlertCircle size={15} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </aside>

        <section className="results">
          <div className="summary-band">
            <Metric label="Rows" value={result?.rows?.length ?? 0} />
            <Metric label="Exact item matches" value={exactCount} />
            <Metric label="Latest export" value={latestCount} />
            <Metric label="Skipped" value={result?.history?.skipped_existing_rows ?? 0} />
            <button className="export" onClick={() => downloadCsv(result?.latestRows, 'latest')} disabled={!latestCount}>
              <Download size={18} aria-hidden="true" />
              <span>Latest CSV</span>
            </button>
            <button className="export secondary-export" onClick={() => downloadCsv(result?.rows, 'all')} disabled={!result?.rows?.length}>
              <Download size={18} aria-hidden="true" />
              <span>All CSV</span>
            </button>
          </div>

          {result?.warnings?.length > 0 && (
            <div className="warning-strip">
              <AlertCircle size={17} aria-hidden="true" />
              <span>{result.warnings.join(' ')}</span>
            </div>
          )}

          <div className="table-shell">
            {historyLoading ? (
              <div className="empty">
                <Loader2 className="spin" size={40} aria-hidden="true" />
                <p>Loading saved reviews.</p>
              </div>
            ) : result?.rows?.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Seller</th>
                    <th>Match</th>
                    <th>Rating</th>
                    <th>Stars</th>
                    <th>Date</th>
                    <th>Feedback</th>
                    <th>Link</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, index) => (
                    <tr className={row.is_latest ? 'latest-row' : ''} key={row.feedback_key || `${row.seller_username}-${row.feedback_date}-${index}`}>
                      <td>
                        <strong>{row.matched_item_title || row.source_item_title || 'Untitled item'}</strong>
                        <span>{row.matched_item_id || row.source_item_id}</span>
                      </td>
                      <td>{row.seller_username}</td>
                      <td>
                        <Badge value={row.match_type} />
                        {row.is_latest && <span className="latest-pill">Latest</span>}
                      </td>
                      <td>{row.rating || 'Unknown'}</td>
                      <td>{row.star_rating === '' || row.star_rating == null ? 'Unknown' : Number(row.star_rating).toFixed(0)}</td>
                      <td>{row.feedback_date || 'Unknown'}</td>
                      <td>{row.feedback_text}</td>
                      <td>
                        {(row.matched_item_url || row.feedback_profile_url) && (
                          <a href={row.matched_item_url || row.feedback_profile_url} target="_blank" rel="noreferrer" title="Open source">
                            <ExternalLink size={17} />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">
                <FileSpreadsheet size={40} aria-hidden="true" />
                <p>Paste an eBay listing or store URL to build a CSV-ready feedback table.</p>
              </div>
            )}
          </div>
        </section>
      </section>

    </main>
  );
}

function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return defaultSettings;
    return {
      ...defaultSettings,
      defaultEbayUrl: typeof saved.defaultEbayUrl === 'string' ? saved.defaultEbayUrl : defaultSettings.defaultEbayUrl,
      muted: Boolean(saved.muted)
    };
  } catch {
    return defaultSettings;
  }
}

function persistSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage failures in constrained environments.
  }
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Badge({ value }) {
  const label = value || 'seller-profile';
  return <span className={`badge ${label}`}>{label}</span>;
}

function toCsv(rows) {
  const escape = (value) => {
    const text = String(value ?? '');
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => escape(directImportValue(row, column))).join(','))
  ].join('\n');
}

function directImportValue(row, column) {
  // Convert rich scraper rows into Judge.me's lean CSV shape at download time.
  // Internal scraper fields can change without leaking into the exported file.
  const values = {
    title: reviewTitle(row.feedback_text),
    body: row.feedback_text || '',
    rating: row.star_rating || '',
    review_date: reviewDate(row.feedback_date),
    reviewer_name: row.buyer_username || 'eBay buyer',
    reviewer_email: '',
    product_id: '',
    product_handle: row.product_handle || row.product_sku || '',
    reply: '',
    picture_urls: row.feedback_image_urls || ''
  };

  return values[column];
}

function reviewTitle(text = '') {
  const firstSentence = String(text).split(/[.!?]/)[0]?.trim();
  if (!firstSentence) return 'eBay Review';
  return firstSentence.length > 80 ? `${firstSentence.slice(0, 77)}...` : firstSentence;
}

function reviewDate(value = '') {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const date = new Date();

  if (/past\s+6\s+months/i.test(value)) date.setMonth(date.getMonth() - 6);
  else if (/past\s+month/i.test(value)) date.setMonth(date.getMonth() - 1);
  else if (/past\s+year/i.test(value)) date.setFullYear(date.getFullYear() - 1);

  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

function csvFilename(result, scope = 'latest') {
  const date = new Date().toISOString().slice(0, 10);
  const firstListing = result?.listings?.[0] ?? {};
  const firstRow = result?.rows?.[0] ?? {};
  const isListing = result?.mode === 'listing' || Boolean(firstListing.itemId);
  const label = isListing
    ? firstListing.title || firstListing.itemId || firstRow.source_item_title || firstRow.source_item_id
    : firstListing.sellerUsername || firstRow.seller_username || 'seller-feedback';

  const suffix = scope === 'all' ? 'all' : 'latest';
  return `ebay-feedback-${slugForFilename(label)}-${suffix}-${date}.csv`;
}

function slugForFilename(value = '') {
  const slug = String(value)
    .replace(/\| eBay.*/i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .toLowerCase();

  return slug || 'export';
}

function createMusicLoop() {
  const audio = new Audio('/shred-loop.mp3');
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = 0.42;

  return {
    async start() {
      audio.currentTime = 0;
      await audio.play();
    },
    stop() {
      audio.pause();
      audio.currentTime = 0;
    }
  };
}

createRoot(document.getElementById('root')).render(<App />);
