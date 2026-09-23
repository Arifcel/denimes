/* Denimes — portfolio page: sector filters for the company grid. */
(function () {
  "use strict";

  var group = document.querySelector("[data-portfolio-filters]");
  var grid = document.querySelector("[data-portfolio-grid]");
  if (!group || !grid) return;

  var buttons = Array.prototype.slice.call(group.querySelectorAll("button[data-filter]"));
  var tiles = Array.prototype.slice.call(grid.querySelectorAll("[data-sector]"));
  var status = document.querySelector("[data-portfolio-status]");
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FADE_MS = 220;
  var timer = null;
  var current = "all";

  function apply(filter) {
    var count = 0;
    tiles.forEach(function (tile) {
      var show = filter === "all" || tile.getAttribute("data-sector") === filter;
      tile.hidden = !show;
      if (show) count++;
    });
    grid.classList.toggle("is-filtered", filter !== "all");
    return count;
  }

  function announce(filter, count, btn) {
    if (!status) return;
    var noun = count === 1 ? "company" : "companies";
    status.textContent = filter === "all"
      ? "Showing all " + count + " " + noun
      : "Showing " + count + " " + noun + " in " + btn.textContent.trim();
  }

  function select(btn) {
    var filter = btn.getAttribute("data-filter");
    if (filter === current) return;
    current = filter;

    buttons.forEach(function (b) {
      b.setAttribute("aria-pressed", b === btn ? "true" : "false");
    });

    window.clearTimeout(timer);
    if (reduceMotion) {
      announce(filter, apply(filter), btn);
      return;
    }

    grid.classList.add("is-switching");
    timer = window.setTimeout(function () {
      announce(filter, apply(filter), btn);
      void grid.offsetWidth;
      grid.classList.remove("is-switching");
    }, FADE_MS);
  }

  group.addEventListener("click", function (event) {
    var btn = event.target.closest("button[data-filter]");
    if (btn) select(btn);
  });
})();
