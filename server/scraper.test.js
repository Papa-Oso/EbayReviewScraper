import test from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
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

test('listing page feedback parser ignores rating summaries', () => {
  const html = `
    <section>
      <div class="card__feedback">Detailed seller ratings Average for the last 12 monthsAccurate description5.0Reasonable shipping cost5.0Shipping speed5.0Communication5.0</div>
      <div class="card__feedback" aria-label="Positive feedback rating"></div>
      <div class="card__feedback">
        <span class="card__comment">Shipped fast and fit perfectly.</span>
        <a href="/usr/z3buyer">z3buyer</a>
        <a href="/itm/324744573584">BMW Z3 and M Roadster Sun Visor Delete Block off / Blank Plates (2x, Pair)</a>
      </div>
    </section>
  `;

  const rows = scraperInternals.parseListingPageFeedbackRows(html, {
    url: 'https://www.ebay.com/itm/324744573584',
    itemId: '324744573584',
    title: 'BMW Z3 and M Roadster Sun Visor Delete Block off / Blank Plates (2x, Pair)',
    sellerUsername: 'joshswidgets',
    feedbackUrl: 'https://feedback.ebay.com/fdbk/feedback_profile/joshswidgets'
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].feedback_text, 'Shipped fast and fit perfectly.');
});

test('listing page feedback rows do not use product images as review photos', () => {
  const rows = scraperInternals.parseListingPageFeedbackRows(
    `
      <section>
        <div class="card__feedback">
          <span class="card__comment">Fits exactly as expected.</span>
          <a href="/usr/z3buyer">z3buyer</a>
          <a href="/itm/324744573584">BMW Z3 and M Roadster Sun Visor Delete Block off / Blank Plates (2x, Pair)</a>
        </div>
      </section>
    `,
    {
      url: 'https://www.ebay.com/itm/324744573584',
      itemId: '324744573584',
      title: 'BMW Z3 and M Roadster Sun Visor Delete Block off / Blank Plates (2x, Pair)',
      imageUrl: 'https://i.ebayimg.com/images/g/example/s-l1600.jpg',
      sellerUsername: 'joshswidgets',
      feedbackUrl: 'https://feedback.ebay.com/fdbk/feedback_profile/joshswidgets'
    }
  );

  assert.equal(rows[0].source_item_image_url, '');
  assert.equal(rows[0].matched_item_image_url, '');
  assert.equal(rows[0].feedback_image_urls, '');
});

test('buyer uploaded feedback photos are exported as feedback image urls', () => {
  const buyerPhotoUrl = 'https://i.ebayimg.com/00/s/OTAwWDE2MDA=/z/z0IAAeSwS4JqIOGy/$_1.JPG?set_id=8800005007';
  const cleanBuyerPhotoUrl = 'https://i.ebayimg.com/00/s/OTAwWDE2MDA=/z/z0IAAeSwS4JqIOGy/%24_1.JPG';
  const rows = scraperInternals.parseListingPageFeedbackRows(
    `
      <section>
        <div class="card__feedback">
          <span class="card__comment">Good quality product and fits perfectly.</span>
          <span>Item photo(s) from verified buyer</span>
          <img src="${buyerPhotoUrl}" alt="Item photo from verified buyer">
          <a href="/usr/nabna_30">nabna_30 (1)</a>
          <a href="/itm/327099360080">Scorpion Helmet Adapter Mount for Cardo Freecom 2X / 4X, Spirit, or Spirit HD</a>
        </div>
      </section>
    `,
    {
      url: 'https://www.ebay.com/itm/327099360080',
      itemId: '327099360080',
      title: 'Scorpion Helmet Adapter Mount for Cardo Freecom 2X / 4X, Spirit, or Spirit HD',
      imageUrl: 'https://i.ebayimg.com/images/g/product/s-l1600.jpg',
      sellerUsername: 'joshswidgets',
      feedbackUrl: 'https://feedback.ebay.com/fdbk/feedback_profile/joshswidgets'
    }
  );

  assert.equal(rows[0].feedback_image_urls, cleanBuyerPhotoUrl);
  assert.equal(rows[0].buyer_username, 'nabna_30');
});

test('reviewer names drop feedback counts and prices', () => {
  assert.equal(scraperInternals.normalizeFeedbackFrom('jumppilotross (823)US $29.99'), 'jumppilotross');
  assert.equal(scraperInternals.normalizeFeedbackFrom('Buyer: grizz1975 (52) US $29.99 Verified purchase'), 'grizz1975');
});

test('listing page feedback buyer names are export ready', () => {
  const rows = scraperInternals.parseListingPageFeedbackRows(
    `
      <section>
        <div class="card__feedback">
          <span class="card__comment">Excellent product quick delivery.</span>
          <a href="/usr/jumppilotross">jumppilotross (823)US $29.99</a>
          <a href="/itm/327029277067">HJC Helmet Adapter Mount for Cardo Packtalk Edge / Neo / Pro / Custom</a>
        </div>
      </section>
    `,
    {
      url: 'https://www.ebay.com/itm/327029277067',
      itemId: '327029277067',
      title: 'HJC Helmet Adapter Mount for Cardo Packtalk Edge / Neo / Pro / Custom',
      imageUrl: 'https://i.ebayimg.com/images/g/hjc/s-l1600.jpg',
      sellerUsername: 'joshswidgets',
      feedbackUrl: 'https://feedback.ebay.com/fdbk/feedback_profile/joshswidgets'
    }
  );

  assert.equal(rows[0].buyer_username, 'jumppilotross');
});

test('feedback image extractor ignores product listing image urls', () => {
  const buyerPhotoUrl = 'https://i.ebayimg.com/00/s/OTAwWDE2MDA=/z/z0IAAeSwS4JqIOGy/$_1.JPG?set_id=8800005007';
  const cleanBuyerPhotoUrl = 'https://i.ebayimg.com/00/s/OTAwWDE2MDA=/z/z0IAAeSwS4JqIOGy/%24_1.JPG';
  const $ = cheerio.load(`
    <div class="row">
      <img src="https://i.ebayimg.com/images/g/product/s-l1600.jpg">
      <img src="${buyerPhotoUrl}">
    </div>
  `);

  assert.equal(scraperInternals.extractFeedbackImageUrls($, $('.row'), 'https://www.ebay.com/'), cleanBuyerPhotoUrl);
});

test('saved sessions use a persistent visible browser', () => {
  assert.equal(
    scraperInternals.browserLaunchMode({ allowManualVerification: false, useSavedSession: true }),
    'persistent-headed'
  );
  assert.equal(
    scraperInternals.browserLaunchMode({ allowManualVerification: false, useSavedSession: false }),
    'headless'
  );
});

test('logged out ebay pages are detected before scraping', () => {
  assert.equal(
    scraperInternals.isLoggedOutEbayPage('<body>Hi! Sign in or register</body>', 'https://www.ebay.com/'),
    true
  );
  assert.equal(
    scraperInternals.isLoggedOutEbayPage('<body><a href="https://signin.ebay.com/ws/eBayISAPI.dll?SignIn">Sign in</a> or register</body>', 'https://www.ebay.com/'),
    true
  );
  assert.equal(
    scraperInternals.isLoggedOutEbayPage('<body>Hi josh <a href="https://signin.ebay.com/ws/eBayISAPI.dll?SignOut">Sign out</a></body>', 'https://www.ebay.com/'),
    false
  );
  assert.equal(
    scraperInternals.isLoggedOutEbayPage('<body>My eBay Summary</body>', 'https://www.ebay.com/'),
    false
  );
});

test('aborted ebay navigations are retryable and readable', () => {
  const error = new Error('page.goto: net::ERR_ABORTED at https://feedback.ebay.com/fdbk/feedback_profile/joshswidgets');
  assert.equal(scraperInternals.isRetryableNavigationError(error), true);
  assert.match(scraperInternals.normalizeScrapeError(error).message, /aborted a page navigation/);
});
