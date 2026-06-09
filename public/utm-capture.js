(function () {
  'use strict';
  var STORAGE_KEY = 'thrive_attribution';
  var TTL_DAYS = 90;
  var PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    // Google sends a DIFFERENT click ID per context: gclid (desktop/Android),
    // wbraid (iOS/Safari web), gbraid (iOS app). Capturing only gclid loses a
    // large share of paid iOS traffic. gad_campaignid is added by auto-tagging.
    'gclid', 'wbraid', 'gbraid', 'gad_campaignid', 'msclkid', 'fbclid', 'li_fat_id',
    // OpenAI Ads (ChatGPT chat_card) — oppref is appended by ChatGPT itself on landing;
    // oai_* IDs are baked into ad target_urls so we can join back to campaign/ad_group/ad.
    'oppref', 'oai_campaign_id', 'oai_ad_group_id', 'oai_ad_id',
  ];

  function readCookie(name) {
    var m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return m ? decodeURIComponent(m[2]) : '';
  }
  function writeCookie(name, value) {
    document.cookie = name + '=' + encodeURIComponent(value) +
      '; max-age=' + (TTL_DAYS * 86400) + '; path=/; SameSite=Lax';
  }

  try {
    // Cookie persists across return visits (sessionStorage is per-tab only).
    var stored = JSON.parse(readCookie(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY) || '{}');
    var url = new URLSearchParams(window.location.search);
    var changed = false;

    PARAMS.forEach(function (key) {
      var fromUrl = url.get(key);
      if (fromUrl && stored[key] !== fromUrl) {
        stored[key] = fromUrl;
        changed = true;
      }
    });

    // Fallback: oppref from __oppref cookie (set by OpenAI Ads pixel, 30-day TTL).
    // Catches return visits where the URL no longer has ?oppref but the user still has the cookie.
    if (!stored.oppref) {
      var cookieOppref = readCookie('__oppref');
      if (cookieOppref) { stored.oppref = cookieOppref; changed = true; }
    }

    if (!stored.landing_page_url) {
      stored.landing_page_url = window.location.origin + window.location.pathname;
      changed = true;
    }
    if (!stored.referrer && document.referrer) {
      stored.referrer = document.referrer;
      changed = true;
    }

    if (changed) {
      var packed = JSON.stringify(stored);
      sessionStorage.setItem(STORAGE_KEY, packed);
      writeCookie(STORAGE_KEY, packed);
    }

    window.thriveAttribution = stored;

    window.thriveStampAttribution = function (form) {
      if (!form) return;
      var attribution = window.thriveAttribution || {};
      Object.keys(attribution).forEach(function (key) {
        var input = form.querySelector('input[name="' + key + '"]');
        if (!input) {
          input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          form.appendChild(input);
        }
        input.value = attribution[key] || '';
      });
    };

    if (window.console && console.log) {
      console.log('[Thrive] attribution captured:', stored);
    }
  } catch (e) {
    if (window.console && console.warn) console.warn('[Thrive] attribution capture failed:', e);
  }
})();
