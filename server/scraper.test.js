import test from 'node:test';
import assert from 'node:assert/strict';
import { scraperInternals } from './scraper.js';

test('test runner is wired', () => {
  assert.equal(1 + 1, 2);
});

test('seller urls are recognized without store listing discovery', () => {
  assert.equal(scraperInternals.inferMode('https://www.ebay.com/usr/joshswidgets'), 'seller');
  assert.equal(
    scraperInternals.extractSellerUsernameFromUrl('https://www.ebay.com/usr/joshswidgets?_tab=feedback'),
    'joshswidgets'
  );
});

test('ebay error pages stop with a clear message', () => {
  assert.throws(
    () =>
      scraperInternals.throwIfEbayErrorPage(
        '<title>Error Page | eBay</title><body>SORRY Something went wrong on our end Please go back and try again or go to eBay Homepage.</body>',
        'https://www.ebay.com/itm/326840154179'
      ),
    /eBay returned an error page/
  );
});

test('listing error pages explain that seller cannot be read', () => {
  assert.throws(
    () =>
      scraperInternals.throwIfEbayErrorPage(
        '<title>Error Page | eBay</title><body>SORRY Something went wrong on our end Please go back and try again or go to eBay Homepage.</body>',
        'https://www.ebay.com/itm/324744573584'
      ),
    /could not read the seller/
  );
});

test('closed browser errors are user readable', () => {
  const error = scraperInternals.normalizeScrapeError(
    new Error('page.goto: Target page, context or browser has been closed')
  );
  assert.match(error.message, /browser window was closed/);
});

test('feedback page urls use explicit page ids', () => {
  const url = scraperInternals.feedbackPageUrl(
    'https://feedback.ebay.com/fdbk/feedback_profile/joshswidgets?limit=25&page_id=1',
    7
  );
  const parsed = new URL(url);

  assert.equal(parsed.hostname, 'feedback.ebay.com');
  assert.equal(parsed.searchParams.get('filter'), 'feedback_page:RECEIVED_AS_SELLER');
  assert.equal(parsed.searchParams.get('limit'), '200');
  assert.equal(parsed.searchParams.get('page_id'), '7');
  assert.equal(parsed.searchParams.get('sort'), 'TIME');
});

test('feedback total pages are parsed from visible pagination', () => {
  assert.equal(
    scraperInternals.extractFeedbackTotalPages('<body><span>Page 1 of 27</span></body>'),
    27
  );
});

test('listing page feedback cards are exported as item rows', () => {
  const rows = scraperInternals.parseListingPageFeedbackRows(
    `
      <section>
        <h2>Seller feedback</h2>
        <button>This item (2)</button>
        <div class="card__feedback">
          <div class="card__comment"><span aria-label="Perfect fit and fast shipping">Perfect fit and fast shipping</span></div>
          <div class="card__item">Widget bracket (#324744573584)</div>
          <span>Past month</span>
        </div>
        <div class="card__feedback">
          <div class="card__comment"><span aria-label="Exactly as described">Exactly as described</span></div>
          <div class="card__item">Widget bracket (#324744573584)</div>
          <span>Past 6 months</span>
        </div>
      </section>
    `,
    {
      url: 'https://www.ebay.com/itm/324744573584',
      itemId: '324744573584',
      title: 'Widget bracket',
      sellerUsername: 'joshswidgets',
      feedbackUrl: 'https://feedback.ebay.com/fdbk/feedback_profile/joshswidgets'
    }
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0].match_type, 'listing-page');
  assert.equal(rows[0].matched_item_id, '324744573584');
  assert.equal(rows[1].feedback_text, 'Exactly as described');
});
