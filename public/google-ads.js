// Google Ads gtag loader. Mirrors the gtag setup on thriveagency.com main site
// so conversions land in the existing Google Ads conversion buckets.
// Deferred to window 'load' so it doesn't affect LCP — matches the analytics.js
// PostHog pattern.
//
// AW-18163893174 = Thrive Agency - DG (active campaigns' account)
// AW-17302085170 = old parent thriveagency.com account — REMOVED 2026-05-28 per
// Aaron (no longer tracked; was double-firing conversions + remarketing to a
// pool we don't act on).
window.addEventListener('load', function () {
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=AW-18163893174';
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', 'AW-18163893174');
});
