/* ==========================================================================
   Denimes — blog
   Reading-progress bar for post.html. Purely decorative: the article
   reads fine without it.
   ========================================================================== */

(function () {
  "use strict";

  // Thin reading-progress bar across the top of an article
  var article = document.querySelector(".page-post .post-body");
  if (!article) return;

  var bar = document.createElement("div");
  bar.className = "post-progress";
  bar.setAttribute("aria-hidden", "true");
  document.body.appendChild(bar);

  var ticking = false;

  function update() {
    ticking = false;
    var rect = article.getBoundingClientRect();
    var total = rect.height - window.innerHeight * 0.6;
    var read = -rect.top + window.innerHeight * 0.2;
    var progress = total > 0 ? Math.min(Math.max(read / total, 0), 1) : 1;
    bar.style.transform = "scaleX(" + progress.toFixed(4) + ")";
  }

  function requestUpdate() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  update();
})();
