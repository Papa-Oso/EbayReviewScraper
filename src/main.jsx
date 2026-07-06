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
  Search,
  Store,
  Tag,
  Volume2,
  VolumeX
} from 'lucide-react';
import './styles.css';

const columns = [
  'feedback_id',
  'source_item_id',
  'source_item_title',
  'seller_username',
  'matched_item_id',
  'matched_item_title',
  'match_type',
  'rating',
  'buyer_username',
  'feedback_date',
  'feedback_text',
  'source_listing_url',
  'matched_item_url',
  'feedback_profile_url'
];

function App() {
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState('auto');
  const [maxItems, setMaxItems] = useState(25);
  const [maxPages, setMaxPages] = useState(8);
  const [allowManualVerification, setAllowManualVerification] = useState(true);
  const [loading, setLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [log, setLog] = useState([]);
  const chiptuneRef = useRef(null);

  const exactCount = useMemo(() => {
    return (result?.rows ?? []).filter((row) => row.match_type !== 'seller-profile').length;
  }, [result]);

  useEffect(() => {
    if (muted) {
      chiptuneRef.current?.stop();
      chiptuneRef.current = null;
    }
  }, [muted]);

  async function runScrape(event) {
    event.preventDefault();
    if (!muted && !chiptuneRef.current) {
      chiptuneRef.current = createChiptuneLoop();
      chiptuneRef.current.start();
    }
    setLoading(true);
    setError('');
    setResult(null);
    setLog([
      allowManualVerification ? 'Starting visible browser session' : 'Starting background browser session',
      allowManualVerification ? 'Solve any eBay verification in Chromium' : 'Reading eBay page structure'
    ]);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, mode, maxItems, maxPages, allowManualVerification })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Scrape failed.');
      setResult(payload);
      setLog((entries) => [
        ...entries,
        `Resolved ${payload.listings.length} listing${payload.listings.length === 1 ? '' : 's'}`,
        `Collected ${payload.rows.length} feedback row${payload.rows.length === 1 ? '' : 's'}`
      ]);
    } catch (caught) {
      setError(caught.message);
      setLog((entries) => [...entries, 'Stopped before export']);
    } finally {
      setLoading(false);
    }
  }

  function toggleMute() {
    setMuted((current) => {
      if (!current) {
        chiptuneRef.current?.stop();
        chiptuneRef.current = null;
        return true;
      }

      chiptuneRef.current = createChiptuneLoop();
      chiptuneRef.current.start();
      return false;
    });
  }

  function downloadCsv() {
    if (!result?.rows?.length) return;
    const csv = toCsv(result.rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ebay-feedback-${new Date().toISOString().slice(0, 10)}.csv`;
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
            <button
              type="button"
              className={`sound-toggle ${muted ? 'muted' : ''}`}
              onClick={toggleMute}
              title={muted ? 'Unmute chiptune' : 'Mute chiptune'}
              aria-label={muted ? 'Unmute chiptune' : 'Mute chiptune'}
            >
              {muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
            </button>
          </div>

          <form onSubmit={runScrape} className="form">
            <label className="field">
              <span>eBay URL</span>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://www.ebay.com/itm/..."
                required
              />
            </label>

            <div className="segmented" aria-label="Scrape mode">
              {[
                ['auto', Search, 'Auto'],
                ['listing', Tag, 'Listing'],
                ['store', Store, 'Store']
              ].map(([value, Icon, label]) => (
                <button
                  type="button"
                  key={value}
                  className={mode === value ? 'active' : ''}
                  onClick={() => setMode(value)}
                  title={label}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div className="range-grid">
              <label className="field">
                <span>Max items</span>
                <input
                  type="number"
                  min="1"
                  max="250"
                  value={maxItems}
                  onChange={(event) => setMaxItems(event.target.value)}
                />
              </label>
              <label className="field">
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

            <label className="check-row">
              <input
                type="checkbox"
                checked={allowManualVerification}
                onChange={(event) => setAllowManualVerification(event.target.checked)}
              />
              <span>Open browser for eBay verification</span>
            </label>

            <button className="primary" disabled={loading}>
              {loading ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
              <span>{loading ? 'Scraping' : 'Scrape feedback'}</span>
            </button>
          </form>

          <div className="status-list">
            <div className={`status-row music ${muted ? 'muted' : ''}`}>
              <Music2 size={15} aria-hidden="true" />
              <span>{muted ? 'Chiptune muted' : 'Chiptune armed'}</span>
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
            <Metric label="Listings" value={result?.listings?.length ?? 0} />
            <button className="export" onClick={downloadCsv} disabled={!result?.rows?.length}>
              <Download size={18} aria-hidden="true" />
              <span>CSV</span>
            </button>
          </div>

          {result?.warnings?.length > 0 && (
            <div className="warning-strip">
              <AlertCircle size={17} aria-hidden="true" />
              <span>{result.warnings.join(' ')}</span>
            </div>
          )}

          <div className="table-shell">
            {result?.rows?.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Seller</th>
                    <th>Match</th>
                    <th>Rating</th>
                    <th>Date</th>
                    <th>Feedback</th>
                    <th>Link</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 100).map((row, index) => (
                    <tr key={`${row.seller_username}-${row.feedback_date}-${index}`}>
                      <td>
                        <strong>{row.matched_item_title || row.source_item_title || 'Untitled item'}</strong>
                        <span>{row.matched_item_id || row.source_item_id}</span>
                      </td>
                      <td>{row.seller_username}</td>
                      <td><Badge value={row.match_type} /></td>
                      <td>{row.rating || 'Unknown'}</td>
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
  return [columns.join(','), ...rows.map((row) => columns.map((column) => escape(row[column])).join(','))].join('\n');
}

function createChiptuneLoop() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return { start() {}, stop() {} };
  }

  const context = new AudioContext();
  const output = context.createGain();
  const delay = context.createDelay();
  const feedback = context.createGain();
  let timer = null;
  let step = 0;

  output.gain.value = 0.055;
  delay.delayTime.value = 0.135;
  feedback.gain.value = 0.23;
  delay.connect(feedback);
  feedback.connect(delay);
  output.connect(delay);
  delay.connect(context.destination);
  output.connect(context.destination);

  const melody = [659, 784, 988, 784, 523, 659, 784, 1046, 988, 784, 659, 587, 659, 784, 880, 784];
  const bass = [131, 131, 196, 196, 165, 165, 220, 247];
  const beatMs = 145;

  function blip(frequency, duration, type, gainValue) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(gainValue, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(output);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.02);
  }

  function tick() {
    blip(melody[step % melody.length], 0.07, 'square', 0.75);
    if (step % 2 === 0) blip(bass[(step / 2) % bass.length], 0.11, 'triangle', 0.45);
    if (step % 4 === 3) blip(1760, 0.025, 'square', 0.25);
    step += 1;
  }

  return {
    async start() {
      await context.resume();
      tick();
      timer = window.setInterval(tick, beatMs);
    },
    stop() {
      if (timer) window.clearInterval(timer);
      output.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.03);
      window.setTimeout(() => context.close(), 80);
    }
  };
}

createRoot(document.getElementById('root')).render(<App />);
