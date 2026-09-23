/* ==========================================================================
   Denimes — legal
   The document tabs switch with CSS (:target). This only mirrors the
   active tab into aria-current for assistive tech; the page works without it.
   ========================================================================== */

(function () {
  "use strict";

  var links = Array.prototype.slice.call(document.querySelectorAll(".legal-tabs__link"));
  if (!links.length) return;

  function sync() {
    var hash = window.location.hash;
    var active = links.filter(function (a) { return a.getAttribute("href") === hash; })[0] || links[0];
    links.forEach(function (a) {
      if (a === active) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  }

  sync();
  window.addEventListener("hashchange", sync);
})();
