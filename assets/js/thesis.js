/* ==========================================================================
   Denimes — thesis page
   Builds the fixed section dots beside the essay and tracks the section
   being read. Optional: the page reads fine without it.
   ========================================================================== */

(function () {
  "use strict";

  var essay = document.querySelector(".thesis-essay");
  var hero = document.querySelector(".thesis-hero");
  var next = document.querySelector(".thesis-next");
  if (!essay) return;

  var targets = Array.prototype.slice.call(essay.querySelectorAll("[data-thesis-label][id]"));
  if (targets.length < 2) return;

  var nav = document.createElement("nav");
  nav.className = "thesis-progress";
  nav.setAttribute("aria-label", "Essay sections");

  var list = document.createElement("ol");
  var links = targets.map(function (target) {
    var item = document.createElement("li");
    var link = document.createElement("a");
    var dot = document.createElement("span");
    var label = document.createElement("span");

    link.href = "#" + target.id;
    dot.className = "thesis-progress__dot";
    dot.setAttribute("aria-hidden", "true");
    label.className = "thesis-progress__label";
    label.textContent = target.getAttribute("data-thesis-label");

    link.appendChild(dot);
    link.appendChild(label);
    item.appendChild(link);
    list.appendChild(item);
    return link;
  });

  nav.appendChild(list);
  essay.parentNode.insertBefore(nav, essay);

  // Active section: the last one whose top has passed the middle of the screen
  var active = -1;
  var ticking = false;

  function update() {
    ticking = false;
    var mid = window.innerHeight * 0.5;
    var index = -1;
    targets.forEach(function (target, i) {
      if (target.getBoundingClientRect().top <= mid) index = i;
    });
    if (index === active) return;
    if (active > -1) links[active].removeAttribute("aria-current");
    if (index > -1) links[index].setAttribute("aria-current", "true");
    active = index;
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();

  // Show the dots only between the hero and the closing link
  if (!("IntersectionObserver" in window)) {
    nav.classList.add("is-visible");
    return;
  }

  var heroGone = false;
  var nextShown = false;

  function toggle() {
    nav.classList.toggle("is-visible", heroGone && !nextShown);
  }

  if (hero) {
    new IntersectionObserver(function (entries) {
      var entry = entries[0];
      heroGone = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      toggle();
    }).observe(hero);
  } else {
    heroGone = true;
  }

  if (next) {
    new IntersectionObserver(function (entries) {
      nextShown = entries[0].isIntersecting;
      toggle();
    }).observe(next);
  }

  toggle();
})();
