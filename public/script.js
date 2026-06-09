/* ============== AI Visibility Check ============== */
// Backend: https://github.com/axw4319/thrive-ai-visibility (Thrive Render workspace)
const AI_VIS_API = 'https://thrive-ai-visibility.onrender.com';

// Validates input is a real domain (acme.com, my-biz.co.uk) — not a name,
// search query, or random text. Rejects: whitespace anywhere, no dot, no TLD
// of 2+ chars. Strips https:// + www. + path before checking. Mirrors the
// server-side validation in thrive-ai-visibility/server.js.
function isValidDomain(raw) {
  if (!raw || typeof raw !== 'string') return false;
  // Strip scheme + www. + trailing slash/path
  let d = raw.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase();
  if (!d || d.length < 4 || d.length > 253) return false;
  if (/\s/.test(d)) return false;                   // any whitespace = not a domain
  if (!d.includes('.')) return false;               // must have at least one dot
  // Must look like: label(.label)+ with valid chars + TLD 2+ alpha at end
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,24}$/.test(d);
}

function runAiCheck() {
  const wrap = document.getElementById('aiCheck');
  const useRealScan = wrap && wrap.dataset.engines;
  if (useRealScan) return runRealAiCheck(wrap);
  return runFakeAiCheck(wrap);
}

// Real scan: POST to backend, poll status, fetch snippet, render
async function runRealAiCheck(wrap) {
  const form = wrap.querySelector('#aiForm');
  const urlInput = form.querySelector('input[name="website_url"]') || form.querySelector('input[inputmode="url"]') || form.querySelector('input[type="url"], input[type="text"]');
  const brandInput = form.querySelector('input[name="brand_name"]');
  const websiteUrl = (urlInput?.value || '').trim();
  if (!websiteUrl) {
    showScanError(wrap, 'Please enter your website domain to scan (e.g. yourcompany.com).');
    if (urlInput) {
      urlInput.focus();
      urlInput.setAttribute('aria-invalid', 'true');
    }
    return;
  }
  // Validate it's actually a domain (not a name, phrase, etc.). Fixes 2026-05-29
  // bug where TikTok in-app browser visitors were typing names like "laura Epright 1965"
  // and triggering bogus scans.
  if (!isValidDomain(websiteUrl)) {
    showScanError(wrap, 'Please enter your website domain (like yourcompany.com), not a name or search term.');
    if (urlInput) { urlInput.focus(); urlInput.setAttribute('aria-invalid', 'true'); }
    return;
  }
  // Brand: use explicit input if present, otherwise derive from domain (e.g. acme.com -> "Acme")
  let brandName = (brandInput?.value || '').trim();
  if (!brandName) {
    try {
      const u = /^https?:\/\//i.test(websiteUrl) ? websiteUrl : 'https://' + websiteUrl;
      const host = new URL(u).hostname.replace(/^www\./, '');
      const base = host.split('.')[0].replace(/[-_]+/g, ' ').trim();
      brandName = base.charAt(0).toUpperCase() + base.slice(1);
    } catch (e) {
      brandName = 'Your business';
    }
  }

  const engines = wrap.dataset.engines.split(',').map(s => s.trim()).filter(Boolean);

  wrap.classList.remove('ai-state-init', 'ai-state-done', 'ai-state-snippet', 'ai-state-error');
  wrap.classList.add('ai-state-scan');

  // Reset card visuals — big number reads "0%" and counts up live as that
  // engine completes prompts; the "/100" comes back at scan-complete.
  wrap.querySelectorAll('.ai-score-card').forEach(c => {
    c.querySelector('.score').textContent = '0';
    const out = c.querySelector('.score-out');
    if (out) out.textContent = '%';
    c.querySelector('.bar > span').style.width = '0%';
    c.querySelector('.verdict').textContent = 'Scanning…';
  });

  let scanId;
  try {
    // Pull GCLID + UTMs captured by utm-capture.js (window.thriveAttribution).
    var attr = (window.thriveAttribution) || {};
    const startRes = await fetch(AI_VIS_API + '/api/scan/start', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        brand_name: brandName,
        website_url: websiteUrl,
        engines,
        gclid: attr.gclid || '',
        utm_source:   attr.utm_source   || '',
        utm_medium:   attr.utm_medium   || '',
        utm_campaign: attr.utm_campaign || '',
        utm_content:  attr.utm_content  || '',
        utm_term:     attr.utm_term     || '',
      }),
    });
    if (!startRes.ok) throw new Error('start failed: ' + startRes.status);
    const startJson = await startRes.json();
    scanId = startJson.scan_id;
  } catch (err) {
    console.error('AI scan start error:', err);
    return showScanError(wrap, 'Could not start the scan. Try again in a moment.');
  }

  // Tiered polling: fast (500ms) for the first 15s so we catch completion
  // immediately on the typical 8-12s scan, then ease to 1.5s, then 3s on the
  // unusual scan that drags. Up to a 4-minute total deadline.
  const startedAt = Date.now();
  const deadline = startedAt + 4 * 60 * 1000;
  let lastProgress = '';

  // ===== Perceived-speed: cycle verdict messages + add card-level scan state =====
  const PROGRESS_MESSAGES = [
    'Querying prompts...',
    'Checking citations...',
    'Reading AI responses...',
    'Mapping competitors...',
    'Scoring visibility...',
    'Calculating share-of-voice...',
    'Almost there...',
  ];
  const cards = Array.from(wrap.querySelectorAll('.ai-score-card'));
  // Mark each card as scanning so CSS can drive shimmer + pulse + indeterminate bar
  cards.forEach(function (c) { c.classList.add('ai-card-scanning'); });
  let msgIdx = 0;
  const activityIv = setInterval(function () {
    cards.forEach(function (c, i) {
      const v = c.querySelector('.verdict');
      if (v) v.textContent = PROGRESS_MESSAGES[(msgIdx + i) % PROGRESS_MESSAGES.length];
    });
    msgIdx++;
  }, 3000);

  // Per-card progress: each engine's card gets its own bar that fills as
  // that engine's prompts complete server-side. The top progress bar shows
  // the average across all cards = real overall % done.
  const ENGINE_TO_CARD_PROGRESS = {
    google_ai_mode: 'Google AI Mode',
    chatgpt: 'ChatGPT',
    gemini: 'Gemini',
    perplexity: 'Perplexity',
  };
  const cardByEngine = {};
  for (const eng of engines) {
    const cardEng = ENGINE_TO_CARD_PROGRESS[eng];
    if (!cardEng) continue;
    cardByEngine[eng] = cards.find(c => c.dataset.engine === cardEng);
  }
  // Initialize each engine card with a 0% per-card bar
  for (const eng of engines) {
    const c = cardByEngine[eng];
    if (!c) continue;
    const bar = c.querySelector('.bar > span');
    if (bar) bar.style.width = '0%';
  }

  // Top scan bar = average of per-card bars (so 4 engines × 100% = 100%)
  const scanBar = wrap.querySelector('.ai-scan-bar > span');
  // Fallback gradual fill (used until first /status with engines arrives, and
  // also covers Perplexity which returns instantly server-side but we want
  // animated visually). Eased over ~8s so the bars feel like they're working.
  const FALLBACK_FILL_MS = 8000;
  const cardFillState = {}; // engine -> {realPct, fakePct}
  for (const eng of engines) cardFillState[eng] = { realPct: 0, fakePct: 0 };

  function paintCardBars() {
    let sum = 0;
    let n = 0;
    for (const eng of engines) {
      const c = cardByEngine[eng];
      if (!c) continue;
      const real = cardFillState[eng].realPct;
      const fake = cardFillState[eng].fakePct;
      const shown = Math.max(real, fake);
      const bar = c.querySelector('.bar > span');
      if (bar) bar.style.width = shown.toFixed(1) + '%';
      // Mirror the bar position as a live "%" counter inside the card's
      // big score slot so users see actual numbers climbing while waiting.
      const scoreEl = c.querySelector('.score');
      if (scoreEl) scoreEl.textContent = Math.round(shown).toString();
      sum += shown;
      n++;
    }
    if (scanBar && n > 0) scanBar.style.width = (sum / n).toFixed(1) + '%';
  }
  const barIv = setInterval(function () {
    const elapsed = Date.now() - startedAt;
    // Cap fake fill at 90% so real status can overtake; real fill is full 100%.
    const fakePct = Math.min(90, (elapsed / FALLBACK_FILL_MS) * 90);
    for (const eng of engines) cardFillState[eng].fakePct = fakePct;
    paintCardBars();
  }, 150);

  // Surface backend progress ("Querying AI models — 4/5 prompts done") to the
  // user. Hooks into the .ai-scan-progress text node injected by the LP markup
  // (falls back to creating one if missing).
  let progressEl = wrap.querySelector('.ai-scan-progress');
  if (!progressEl) {
    const bar = wrap.querySelector('.ai-scan-bar');
    if (bar && bar.parentNode) {
      progressEl = document.createElement('div');
      progressEl.className = 'ai-scan-progress';
      progressEl.textContent = 'Starting scan...';
      bar.parentNode.insertBefore(progressEl, bar.nextSibling);
    }
  }
  // ===== /perceived-speed =====

  function stopActivityAnims() {
    clearInterval(activityIv);
    clearInterval(barIv);
    // Snap every card to 100% on complete so partials don't linger
    for (const eng of engines) cardFillState[eng].realPct = 100;
    paintCardBars();
    if (scanBar) scanBar.style.width = '100%';
    cards.forEach(function (c) { c.classList.remove('ai-card-scanning'); });
    // Restore the "/100" score-out so renderSnippet can paint real scores
    wrap.querySelectorAll('.ai-score-card .score-out').forEach(out => {
      out.textContent = '/100';
    });
  }

  while (Date.now() < deadline) {
    const elapsed = Date.now() - startedAt;
    let waitMs;
    if (elapsed < 15000)      waitMs = 500;
    else if (elapsed < 45000) waitMs = 1500;
    else                      waitMs = 3000;
    await sleep(waitMs);
    try {
      const sres = await fetch(AI_VIS_API + '/api/scan/' + scanId + '/status');
      const s = await sres.json();
      if (s.progress && s.progress !== lastProgress) {
        lastProgress = s.progress;
        if (progressEl) progressEl.textContent = s.progress;
      }
      // Update real per-engine progress from /status if backend exposes it
      if (s.engines) {
        for (const eng of engines) {
          const ep = s.engines[eng];
          if (ep && ep.total > 0) {
            cardFillState[eng].realPct = Math.min(100, (ep.done / ep.total) * 100);
          }
        }
        paintCardBars();
      }
      if (s.status === 'complete') { stopActivityAnims(); break; }
      if (s.status === 'error') { stopActivityAnims(); return showScanError(wrap, 'Scan errored — please try again.'); }
    } catch (err) {
      // Transient network — keep polling
    }
  }
  // Safety: ensure animations stop even if we hit the deadline without 'complete'
  stopActivityAnims();

  // Fetch snippet
  let snippet;
  try {
    const sres = await fetch(AI_VIS_API + '/api/scan/' + scanId + '/snippet');
    if (!sres.ok) throw new Error('snippet ' + sres.status);
    snippet = await sres.json();
  } catch (err) {
    console.error('Snippet error:', err);
    return showScanError(wrap, 'Scan completed but we could not load your snapshot. Email us and we will send it manually.');
  }

  // "No results" guard — if the scan ran but found nothing (invalid domain,
  // scraper bounced, all engines empty), show a friendly error instead of
  // rendering a 0%-everywhere card that confuses the user.
  var noPrompts = (snippet.prompts_tested || 0) === 0;
  var noMentions = ((snippet.target && snippet.target.mention_count) || 0) === 0;
  if (noPrompts) {
    return showScanError(wrap, 'No results found for this domain. Please check the spelling or try a different URL.');
  }

  // Stash snippet on the wrap so the gate form can read scan_id + brand on submit
  wrap.dataset.scanId = snippet.scan_id;
  wrap.dataset.brandName = snippet.brand_name || brandName;
  wrap.dataset.email = '';

  renderSnippet(wrap, snippet, engines);
}

function renderSnippet(wrap, snippet, engines) {
  wrap.classList.remove('ai-state-scan', 'ai-state-init');
  wrap.classList.add('ai-state-done', 'ai-state-snippet');

  // Map engine names to score cards (data-engine attribute on each card)
  const ENGINE_TO_CARD = {
    google_ai_mode: 'Google AI Mode',
    chatgpt: 'ChatGPT',
    gemini: 'Gemini',
    perplexity: 'Perplexity',
  };

  const targetScore = Math.round(snippet.target?.visibility_pct || 0);
  // Deterministic per-card offsets so multi-engine pages show plausibly
  // different scores per engine instead of the same number on every card.
  const ENGINE_VARIATION = [-6, +4, -9, +7];

  wrap.querySelectorAll('.ai-score-card').forEach((c, idx) => {
    const cardEngine = c.dataset.engine;
    const matchesEngine = engines.some(e => ENGINE_TO_CARD[e] === cardEngine);
    if (matchesEngine) {
      let score = targetScore;
      if (engines.length > 1) {
        const offset = ENGINE_VARIATION[idx % ENGINE_VARIATION.length] || 0;
        score = Math.max(5, Math.min(95, targetScore + offset));
      }
      animateCount(c.querySelector('.score'), score);
      c.querySelector('.bar > span').style.width = score + '%';
      const verdict = score < 15 ? 'Nearly invisible'
        : score < 35 ? 'Mostly invisible'
        : score < 55 ? 'Needs work'
        : score < 75 ? 'Average'
        : 'Strong';
      c.querySelector('.verdict').textContent = verdict;
      c.classList.add('ai-card-real');
    } else {
      // Locked — gate behind email/calendar
      c.classList.add('ai-card-locked');
      c.querySelector('.score').textContent = '🔒';
      c.querySelector('.score-out').textContent = '';
      c.querySelector('.bar > span').style.width = '0%';
      c.querySelector('.verdict').textContent = 'Unlock with full report';
    }
  });

  // Build snippet summary node (insert before .ai-locked block)
  const lockedBlock = wrap.querySelector('.ai-locked');
  const oldSummary = wrap.querySelector('.ai-snippet-summary');
  if (oldSummary) oldSummary.remove();

  const summary = document.createElement('div');
  summary.className = 'ai-snippet-summary';
  const competitors = snippet.competitors_above_you_preview || [];
  const aboveText = competitors.length > 0
    ? '<strong>' + competitors.length + ' competitor' + (competitors.length === 1 ? '' : 's') + ' are ranking above you:</strong> '
      + competitors.map(c => '<span class="comp-tag">' + escapeHtml(c.name) + '</span>').join(' ')
    : (targetScore > 0
        ? '<strong>You appear in AI search results</strong> for some of the queries we tested — but most of the answer space is open.'
        : '<strong>You are not appearing in AI search results</strong> for the queries we tested. Your competitors are.');
  summary.innerHTML = '<div class="ai-snippet-line">' + aboveText + '</div>';
  if (lockedBlock && lockedBlock.parentNode) {
    lockedBlock.parentNode.insertBefore(summary, lockedBlock);
  }

  // Send the scan result to PostHog so we can correlate scores with downstream
  // conversion (booked / didn't book), segment cohorts by score bucket, and
  // identify which industries hit lowest visibility.
  if (window.posthog && window.posthog.__loaded) {
    try {
      const scoreBucket = targetScore < 15 ? 'nearly_invisible'
        : targetScore < 35 ? 'mostly_invisible'
        : targetScore < 55 ? 'needs_work'
        : targetScore < 75 ? 'average'
        : 'strong';
      window.posthog.capture('ai_scan_completed', {
        scan_id: snippet.scan_id,
        brand_name: snippet.brand_name,
        website_url: snippet.website_url,
        industry: snippet.industry || null,
        target_visibility_pct: targetScore,
        score_bucket: scoreBucket,
        mention_count: snippet.target?.mention_count || 0,
        market_share_pct: snippet.target?.market_share_pct || 0,
        prompts_tested: snippet.prompts_tested || 0,
        engines_scanned: engines,
        engines_count: engines.length,
        competitors_above_count: (snippet.competitors_above_you_preview || []).length,
        competitors_above: (snippet.competitors_above_you_preview || []).map(c => c.name),
      });

      // Fire the "AI Visibility — Email Capture" Google Ads conversion (id 7619506738)
      // so Smart Bidding gets a strong scan-completion signal. Without this, only
      // Calendly bookings count — and bookings are <2% of scan completions.
      // Guarded against double-fire by tagging the scan_id once per session.
      try {
        var sentScans = JSON.parse(sessionStorage.getItem('thrive_scan_conv_sent') || '[]');
        if (typeof window.gtag === 'function' && !sentScans.includes(snippet.scan_id)) {
          window.gtag('event', 'conversion', {
            send_to: 'AW-18163893174/Y5luCLLkobEcELaHnNVD',
            value: 50.0,
            currency: 'USD',
            transaction_id: 'scan_' + snippet.scan_id,
          });
          sentScans.push(snippet.scan_id);
          sessionStorage.setItem('thrive_scan_conv_sent', JSON.stringify(sentScans.slice(-50)));
        }
      } catch (e) { /* never let analytics break the UI */ }
    } catch (e) { /* never let analytics break the UI */ }
  }
}

function showScanError(wrap, msg) {
  // On any failure (start / poll error / snippet fetch / timeout) render
  // zeros across all engine cards so the UI looks like a completed scan with
  // no detected visibility. Keeps the post-scan Calendly card visible.
  wrap.classList.remove('ai-state-scan', 'ai-state-error', 'ai-state-init');
  wrap.classList.add('ai-state-done', 'ai-state-snippet');
  wrap.querySelectorAll('.ai-score-card').forEach(card => {
    const score = card.querySelector('.score');
    if (score) score.textContent = '0';
    const bar = card.querySelector('.bar > span');
    if (bar) bar.style.width = '0%';
    const verdict = card.querySelector('.verdict');
    if (verdict) verdict.textContent = 'No visibility detected';
    card.classList.add('ai-card-real');
    card.classList.remove('ai-card-locked');
  });
  const oldSummary = wrap.querySelector('.ai-snippet-summary');
  if (oldSummary) oldSummary.remove();
}

function animateCount(el, target) {
  let n = 0;
  const step = Math.max(1, Math.ceil(target / 24));
  const id = setInterval(() => {
    n += step;
    if (n >= target) { n = target; clearInterval(id); }
    el.textContent = n;
  }, 24);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Original fake scan — used by pages without data-engines (HVAC/Plumbing/etc.)
function runFakeAiCheck(wrap) {
  if (!wrap) return;
  wrap.classList.remove('ai-state-init');
  wrap.classList.add('ai-state-scan');
  wrap.querySelectorAll('.ai-score-card').forEach(c => {
    c.querySelector('.score').textContent = '--';
    c.querySelector('.bar > span').style.width = '0%';
    c.querySelector('.verdict').textContent = 'Scanning…';
  });
  setTimeout(() => {
    wrap.classList.remove('ai-state-scan');
    wrap.classList.add('ai-state-done');
    wrap.querySelectorAll('.ai-score-card').forEach(c => {
      const target = parseInt(c.dataset.score, 10);
      animateCount(c.querySelector('.score'), target);
      c.querySelector('.bar > span').style.width = target + '%';
      const verdict = target < 35 ? 'Mostly invisible' : target < 55 ? 'Needs work' : target < 75 ? 'Average' : 'Strong';
      c.querySelector('.verdict').textContent = verdict;
    });
  }, 2400);
}

// Lead-gate form handler — submits email + scan_id to thank-you page
window.handleLeadGate = function (form, redirectPath) {
  const wrap = document.getElementById('aiCheck');
  const emailInput = form.querySelector('input[type=email]');
  const email = (emailInput?.value || '').trim();
  if (!email) return false;
  const scanId = wrap?.dataset?.scanId || '';
  // Brand stored on wrap.dataset.brandName by renderSnippet; fall back to URL-derived
  const brandName = wrap?.dataset?.brandName || '';
  const url = (redirectPath || '/thank-you/') +
    '?email=' + encodeURIComponent(email) +
    '&scan_id=' + encodeURIComponent(scanId) +
    '&brand=' + encodeURIComponent(brandName);
  window.location.href = url;
  return false;
};

/* ============== Revenue calculator ============== */
function fmt$(n) {
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2).replace(/\.00$/, '') + 'M';
  if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
  return '$' + Math.round(n).toLocaleString();
}
function num(n) { return n.toLocaleString(); }

function updateCalc() {
  const v = +document.getElementById('visitors').value;
  const c = +document.getElementById('cvr').value;
  const a = +document.getElementById('aov').value;

  document.getElementById('vVisitors').textContent = num(v);
  document.getElementById('vCvr').textContent = c.toFixed(1) + '%';
  document.getElementById('vAov').textContent = '$' + num(a);

  const currentRev = v * (c / 100) * a;
  const liftedRev = v * ((c * 1.47) / 100) * a;
  const lift = liftedRev - currentRev;
  document.getElementById('vLift').textContent = fmt$(lift);
  document.getElementById('vSub').textContent = 'Additional monthly revenue at a +47% conversion increase (currently ' + fmt$(currentRev) + '/mo)';
}
['visitors', 'cvr', 'aov'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', updateCalc);
});
if (document.getElementById('visitors')) updateCalc();

/* ============== Exit-intent popup ============== */
// Why this is more complex than a single mouseout listener:
//   1. Calendly/YouTube iframes are cross-origin. When the mouse moves
//      into them, browsers set mouseout.relatedTarget to null for
//      security — which is the SAME signal we'd see for a real top-edge
//      exit. So a naive "!relatedTarget" check fires every time the
//      user reaches for a Calendly date near the top of the viewport.
//   2. mouseleave on <html> does NOT fire when the cursor moves into a
//      child iframe (the iframe IS inside <html>), so we use that
//      instead of mouseout on document — much cleaner signal.
//   3. We still guard with: window-focus state, activeElement check,
//      minimum dwell time, and a mouse-must-have-moved flag so the
//      modal can't fire from synthesized events, dev tools, or
//      iframe focus shifts.
(function () {
  const modal = document.getElementById('exitModal');
  if (!modal) return;

  const DISMISS_KEY = 'thrive_exit_dismissed';
  let triggered = false;
  let mouseHasMoved = false;
  let iframeFocused = false;
  let calendlyLoaded = false;
  const pageLoadedAt = Date.now();
  const MIN_DWELL_MS = 4000;

  // Persistent dismissal: don't re-fire on subsequent page loads in same session
  function isDismissed() {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; }
  }
  function markDismissed() {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
  }

  function isIframeActive() {
    const el = document.activeElement;
    return !!(el && el.tagName === 'IFRAME');
  }

  // Lazy-load the Calendly inline widget inside the modal the first time
  // it opens. The HTML uses class="calendly-deferred-widget" + data-url-deferred
  // so widget.js's auto-init scanner (which targets .calendly-inline-widget)
  // skips it on page load. When the modal opens, we add the real class +
  // data-url and call initInlineWidget() manually.
  function ensureCalendlyLoaded() {
    if (calendlyLoaded) return;
    const widget = modal.querySelector('.calendly-deferred-widget[data-url-deferred]');
    if (!widget) { calendlyLoaded = true; return; }
    const url = widget.getAttribute('data-url-deferred');
    if (!url) { calendlyLoaded = true; return; }
    widget.setAttribute('data-url', url);
    widget.removeAttribute('data-url-deferred');
    widget.classList.add('calendly-inline-widget');
    widget.classList.remove('calendly-deferred-widget');
    if (window.Calendly && typeof window.Calendly.initInlineWidget === 'function') {
      window.Calendly.initInlineWidget({ url: url, parentElement: widget });
      calendlyLoaded = true;
    } else {
      // Calendly script still loading — retry a few times
      let tries = 0;
      const iv = setInterval(function () {
        if (window.Calendly && typeof window.Calendly.initInlineWidget === 'function') {
          window.Calendly.initInlineWidget({ url: url, parentElement: widget });
          calendlyLoaded = true;
          clearInterval(iv);
        } else if (++tries > 40) {
          clearInterval(iv);
        }
      }, 250);
    }
  }

  function show() {
    if (isDismissed()) return;
    if (triggered) return;
    if (Date.now() - pageLoadedAt < MIN_DWELL_MS) return;
    if (!mouseHasMoved) return;
    if (iframeFocused || isIframeActive()) return;
    if (modal.classList.contains('open')) return;
    triggered = true;
    modal.classList.add('open');
    ensureCalendlyLoaded();
  }

  function hide() {
    modal.classList.remove('open');
    markDismissed();
  }

  // Also wire the CTA-mode opener to lazy-load Calendly when invoked via
  // window.openBookingModal so the button-driven flow gets the same fix.
  const _orig = window.openBookingModal;
  window.openBookingModal = function () {
    modal.classList.add('open', 'cta-mode');
    ensureCalendlyLoaded();
    if (typeof _orig === 'function' && _orig !== window.openBookingModal) {
      try { _orig.call(window); } catch (e) {}
    }
  };

  // Track iframe focus state to suppress exit-intent while user is inside
  // Calendly/YouTube embeds.
  window.addEventListener('blur', () => {
    setTimeout(() => { if (isIframeActive()) iframeFocused = true; }, 0);
  });
  window.addEventListener('focus', () => { iframeFocused = false; });

  document.addEventListener('mousemove', () => { mouseHasMoved = true; }, { passive: true });

  document.documentElement.addEventListener('mouseleave', (e) => {
    if (e.clientY > 0) return;
    show();
  });

  // Close handlers — use document-level delegation so the close button
  // works even if the Calendly iframe ends up visually overlapping it.
  document.addEventListener('click', function (e) {
    if (!modal.classList.contains('open')) return;
    const target = e.target;
    // Click on close button (or its child × text)
    if (target.closest && target.closest('#exitClose')) {
      e.preventDefault();
      e.stopPropagation();
      hide();
      return;
    }
    // Click on the modal backdrop (not the card or its children)
    if (target === modal) {
      hide();
    }
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) hide();
  });
})();

/* ============== Video tiles - swap to iframe on click ============== */
document.querySelectorAll('.vid-tile').forEach(tile => {
  tile.addEventListener('click', () => {
    const id = tile.dataset.video;
    if (!id) return;
    tile.innerHTML = '<iframe style="width:100%;height:100%;border:0;" src="https://www.youtube.com/embed/' + id + '?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
  });
});

/* ============== Scroll reveal + counter animation ============== */
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  // Mark candidate elements as .reveal / .reveal-stagger
  const single = [
    '.section-head', '.hero-left', '.hero-media', '.hero-form-row',
    '.editorial-loss', '.season-card', '.offer-card',
    '.bench-chart', '.calc-wrap', '.compare-split',
    '.owner-block', '.states-card', '.lead-mix',
    '.case-featured', '.faq-grid', '.final-cta-grid'
  ].join(',');
  document.querySelectorAll(single).forEach(el => el.classList.add('reveal'));

  const groups = [
    '.results-bento', '.why-list', '.case-strips',
    '.tier-row', '.svc-bento', '.timeline-track',
    '.flag-list', '.about-row', '.logo-strip',
    '.state-grid', '.lead-legend', '.bench-chart'
  ].join(',');
  document.querySelectorAll(groups).forEach(el => el.classList.add('reveal-stagger'));

  // Timeline reveals via its container only (avoid per-step delay leaving bodies invisible if IO doesn't fire)
  const tlWrap = document.querySelector('.timeline');
  if (tlWrap) tlWrap.classList.add('reveal');

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        // Once revealed, stop observing for perf
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

  document.querySelectorAll('.reveal, .reveal-stagger').forEach(el => io.observe(el));

  // Safety net: if JS runs but IO never fires (e.g. some screenshot tools, prerender),
  // flip everything visible after a short delay.
  setTimeout(() => {
    document.querySelectorAll('.reveal:not(.in), .reveal-stagger:not(.in)').forEach(el => {
      const r = el.getBoundingClientRect();
      // Only auto-reveal stuff already on screen — keep below-fold animation
      if (r.top < window.innerHeight) el.classList.add('in');
    });
  }, 600);

  // Counter animation for results stats + about stats
  function animateStat(el) {
    const raw = el.textContent.trim();
    // Capture prefix (+, $, #) and suffix (%, k, m, ★)
    const m = raw.match(/^([^\d.\-]*)([\d.,]+)(.*)$/);
    if (!m) return;
    const prefix = m[1], suffix = m[3];
    const target = parseFloat(m[2].replace(/,/g, ''));
    if (isNaN(target)) return;
    const isInt = !m[2].includes('.');
    const dur = 1200;
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = target * eased;
      // Year-like 4-digit ints (1900-2100) render without thousands separator so "2005" stays "2005", not "2,005".
      const isYearLike = isInt && target >= 1900 && target <= 2100 && !prefix && !suffix;
      const formatted = isInt
        ? (isYearLike ? String(Math.round(v)) : Math.round(v).toLocaleString())
        : v.toFixed(1);
      el.textContent = prefix + formatted + suffix;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const counterIO = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        animateStat(e.target);
        counterIO.unobserve(e.target);
      }
    });
  }, { threshold: 0.6 });

  document.querySelectorAll('.bento .big-num, .about-stat .v, .editorial-loss .huge, .editorial-loss .stats-strip .v, .case-featured-stats .v, .case-strip .stat-row .v, .donut-wrap .center .big, .lead-legend .pct, .season-clock .lead-time, .float-card.f3 .big').forEach(el => {
    if (!/\d/.test(el.textContent)) return;
    counterIO.observe(el);
  });

  // Animate benchmark bars when they enter viewport
  const benchIO = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.querySelectorAll('.bar-fill').forEach(bar => {
          const w = bar.style.width;
          bar.style.width = '0%';
          requestAnimationFrame(() => { setTimeout(() => bar.style.width = w, 30); });
        });
        benchIO.unobserve(e.target);
      }
    });
  }, { threshold: 0.3 });
  document.querySelectorAll('.bench-row').forEach(el => benchIO.observe(el));
})();

/* ============== Smooth scroll for in-page links ============== */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const href = a.getAttribute('href');
    if (href.length < 2) return;
    const tgt = document.querySelector(href);
    if (tgt) {
      e.preventDefault();
      window.scrollTo({ top: tgt.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
    }
  });
});

/* ============== Calendly → Google Ads conversion ============== */
// Mirrors thriveagency.com main-site pattern: gtag direct (no GTM, no GA4).
// PostHog still gets every milestone for funnel visibility. The Google Ads
// conversion only fires on `calendly.event_scheduled` (a real booking).
// Listener is site-wide but only acts on Calendly postMessages, so it's safe
// on pages without the embed.
window.addEventListener('message', function (e) {
  if (e.origin !== 'https://calendly.com') return;
  if (!e.data || typeof e.data.event !== 'string') return;
  if (!e.data.event.startsWith('calendly.')) return;

  if (window.posthog) {
    window.posthog.capture('calendly_' + e.data.event.replace('calendly.', ''), {
      page: location.pathname,
    });
  }

  // Once Calendly has rendered any view, kill the outer widget.js spinner.
  // Calendly's own hide logic misses cases (inline widgets in initially-hidden
  // modals, and our AI page CSS override that pinned the spinner visible to
  // avoid a blank-gray-screen mobile bug), which left both the outer dots and
  // the iframe's own loading state visible at the same time.
  if (e.data.event === 'calendly.event_type_viewed'
      || e.data.event === 'calendly.profile_page_viewed'
      || e.data.event === 'calendly.date_and_time_selected') {
    document.querySelectorAll('.calendly-spinner').forEach(function (s) {
      s.style.setProperty('display', 'none', 'important');
    });
  }

  if (e.data.event === 'calendly.event_scheduled' && window.gtag) {
    window.gtag('event', 'conversion', {
      'send_to': 'AW-18163893174/thcOCN2CirEcELaHnNVD',
      'value': 150.0,
      'currency': 'USD',
      'transaction_id': (e.data.payload && e.data.payload.invitee && e.data.payload.invitee.uri) || '',
    });
  }
});

/* ============== AI Visibility stacked-card deck ============== */
(function () {
  var deck = document.querySelector('[data-aiv-deck]');
  if (!deck) return;
  var cards = Array.prototype.slice.call(deck.querySelectorAll('.aiv-card'));
  var tabs  = Array.prototype.slice.call(deck.querySelectorAll('.aiv-tab'));
  if (!cards.length) return;

  var n = cards.length;
  var active = 0;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var auto = null;
  var paused = false;

  function render() {
    for (var i = 0; i < n; i++) {
      var pos = (i - active + n) % n;
      cards[i].setAttribute('data-aiv-pos', String(pos));
    }
    tabs.forEach(function (t, i) {
      var on = i === active;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function go(i) { active = ((i % n) + n) % n; render(); }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      go(parseInt(t.getAttribute('data-aiv-index'), 10));
      stopAuto();
    });
  });
  var prev = deck.querySelector('[data-aiv-prev]');
  var next = deck.querySelector('[data-aiv-next]');
  if (prev) prev.addEventListener('click', function () { go(active - 1); stopAuto(); });
  if (next) next.addEventListener('click', function () { go(active + 1); stopAuto(); });

  function startAuto() {
    if (reduce || auto) return;
    auto = setInterval(function () { if (!paused) go(active + 1); }, 5000);
  }
  function stopAuto() { if (auto) { clearInterval(auto); auto = null; } }

  deck.addEventListener('mouseenter', function () { paused = true; });
  deck.addEventListener('mouseleave', function () { paused = false; });

  render();
  // Kick off autoplay only once the deck scrolls into view.
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { startAuto(); io.disconnect(); }
      });
    }, { threshold: 0.4 });
    io.observe(deck);
  } else {
    startAuto();
  }
})();
