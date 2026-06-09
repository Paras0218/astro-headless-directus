// Fraud Blocker — bot/click-fraud detection for paid traffic.
// SID: registered to get.thriveagency.com in Fraud Blocker.
// Loaded deferred from every LP via <script src="/fraud-blocker.js" defer>.
(function () {
  var FB_SID = "XyA-dNMcQyzmox2s7K14D";
  var h = document.getElementsByTagName("head")[0];
  if (!h) return;
  var s = document.createElement("script");
  s.async = 1;
  s.src = "https://monitor.fraudblocker.com/fbt.js?sid=" + FB_SID;
  h.appendChild(s);
})();
