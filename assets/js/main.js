/* ==========================================================================
   Denimes — shared behaviour
   - Overlay menu
   - Reveal-on-scroll
   - Dotted globe (canvas[data-globe])
   - Flat dotted world map (canvas[data-worldmap])
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  root.classList.add("js");

  /* ------------------------------------------------------------------------
     Current year in the footer
     ------------------------------------------------------------------------ */
  var year = String(new Date().getFullYear());
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = year;
  });

  /* ------------------------------------------------------------------------
     Overlay menu
     ------------------------------------------------------------------------ */
  var toggle = document.querySelector(".menu-toggle");
  var overlay = document.getElementById("site-menu");

  function currentFile() {
    var file = window.location.pathname.split("/").pop();
    return file === "" ? "index.html" : file;
  }

  if (overlay) {
    var here = currentFile();
    overlay.querySelectorAll("a[href]").forEach(function (a) {
      var target = a.getAttribute("href").split("#")[0].split("?")[0];
      if (target === here) a.setAttribute("aria-current", "page");
    });
  }

  function setMenu(open) {
    if (!toggle || !overlay) return;
    root.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    overlay.setAttribute("aria-hidden", open ? "false" : "true");
    if ("inert" in overlay) overlay.inert = !open;
    if (open) {
      var first = overlay.querySelector("a");
      if (first) window.setTimeout(function () { first.focus({ preventScroll: true }); }, 60);
    }
  }

  if (toggle && overlay) {
    setMenu(false);

    toggle.addEventListener("click", function () {
      setMenu(!root.classList.contains("menu-open"));
    });

    overlay.addEventListener("click", function (e) {
      var link = e.target.closest("a");
      if (link) {
        setMenu(false);
      } else if (e.target === overlay) {
        setMenu(false);
      }
    });

    document.addEventListener("keydown", function (e) {
      if (!root.classList.contains("menu-open")) return;
      if (e.key === "Escape") {
        setMenu(false);
        toggle.focus();
        return;
      }
      if (e.key === "Tab") {
        // keep focus inside header + menu while open
        var focusables = Array.prototype.slice.call(
          document.querySelectorAll(".site-header a, .site-header button, #site-menu a")
        );
        var i = focusables.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) {
          e.preventDefault();
          focusables[focusables.length - 1].focus();
        } else if (!e.shiftKey && i === focusables.length - 1) {
          e.preventDefault();
          focusables[0].focus();
        }
      }
    });
  }

  /* ------------------------------------------------------------------------
     Reveal on scroll
     ------------------------------------------------------------------------ */
  var revealables = document.querySelectorAll(".reveal, .reveal-fade, .reveal-line");

  if (!("IntersectionObserver" in window) || reduceMotion) {
    revealables.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    revealables.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ------------------------------------------------------------------------
     Shared helpers for the canvases
     ------------------------------------------------------------------------ */
  function decodeMask(b64) {
    var bin = window.atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function bitSet(bytes, i) {
    return (bytes[i >> 3] >> (i & 7)) & 1;
  }

  // Small deterministic PRNG so the stipple looks the same on every load
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function num(el, name, fallback) {
    var v = parseFloat(el.getAttribute("data-" + name));
    return isFinite(v) ? v : fallback;
  }

  function rgb(el, name, fallback) {
    var v = el.getAttribute("data-" + name);
    return v ? v.replace(/\s+/g, "") : fallback;
  }

  /* ------------------------------------------------------------------------
     Dotted globe
     Land points sit on a Fibonacci lattice; DENIMES_LAND.mask marks the ones
     on land. Points are jittered, rotated and lit from a fixed direction.

     <canvas data-globe
             data-color="148,158,184"   dot colour (r,g,b)
             data-alpha="0.9"           overall opacity
             data-scale="0.36"          radius as share of viewport height
             data-scale-w="0.56"        radius cap as share of width
             data-x="0.5" data-y="0.5"  centre, as share of the canvas
             data-speed="0.045"         radians per second
             data-tilt="0.32"           north pole tilted towards the viewer
             data-start="-2.1"          starting rotation (Atlantic in front)
             data-rim="0.5"             opacity of the lit rim
             data-hover="1"             cursor effect strength (0 turns it off)
             data-hover-color="238,230,178"  colour of dots pushed by the cursor
             data-hover-linger="1.5">   seconds a hole stays open before closing

     Dots near the cursor are pushed aside and light up. The holes they leave
     stay open for a moment after the pointer has passed, then slowly close.
     ------------------------------------------------------------------------ */
  var LAND = window.DENIMES_LAND;
  var globePoints = null;

  // The globe layer ignores pointer events (content sits on top of it), so
  // the cursor is tracked on the window and mapped onto each canvas.
  var pointer = { x: 0, y: 0, vx: 0, vy: 0, t: 0, active: false };

  function trackPointer(e) {
    var now = e.timeStamp || window.performance.now();
    if (pointer.active && pointer.t && now > pointer.t) {
      var span = Math.max(8, now - pointer.t) / 1000;
      pointer.vx = pointer.vx * 0.5 + ((e.clientX - pointer.x) / span) * 0.5;
      pointer.vy = pointer.vy * 0.5 + ((e.clientY - pointer.y) / span) * 0.5;
    } else {
      pointer.vx = pointer.vy = 0;
    }
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.t = now;
    pointer.active = true;
  }

  function releasePointer() {
    pointer.active = false;
    pointer.vx = pointer.vy = 0;
  }

  // Touch is followed with touch events: once a drag turns into a page
  // scroll the browser cancels the pointer, but touchmove keeps firing.
  function trackMouse(e) {
    if (e.pointerType !== "touch") trackPointer(e);
  }

  function trackTouch(e) {
    var t = e.touches[0];
    if (t) trackPointer({ clientX: t.clientX, clientY: t.clientY, timeStamp: e.timeStamp });
  }

  if (!reduceMotion) {
    window.addEventListener("pointermove", trackMouse, { passive: true });
    window.addEventListener("pointerdown", trackMouse, { passive: true });
    window.addEventListener("pointerup", function (e) {
      if (e.pointerType === "pen") releasePointer();
    });
    window.addEventListener("pointercancel", function (e) {
      if (e.pointerType !== "touch") releasePointer();
    });
    window.addEventListener("touchstart", trackTouch, { passive: true });
    window.addEventListener("touchmove", trackTouch, { passive: true });
    window.addEventListener("touchend", function (e) {
      if (!e.touches.length) releasePointer();
    });
    window.addEventListener("touchcancel", releasePointer);
    window.addEventListener("blur", releasePointer);
    document.addEventListener("mouseout", function (e) {
      if (!e.relatedTarget) releasePointer();
    });
  }

  function buildGlobePoints() {
    if (globePoints || !LAND) return globePoints;
    var mask = decodeMask(LAND.mask);
    var n = LAND.n;
    var golden = Math.PI * (3 - Math.sqrt(5));
    var spacing = Math.sqrt((4 * Math.PI) / n);
    var rand = mulberry32(20240917);
    var list = [];

    for (var i = 0; i < n; i++) {
      if (!bitSet(mask, i)) continue;
      var y = 1 - (2 * (i + 0.5)) / n;
      var r = Math.sqrt(1 - y * y);
      var theta = i * golden;
      var x = Math.cos(theta) * r;
      var z = Math.sin(theta) * r;

      // several stipple dots per lattice point for a fine, grainy texture
      var copies = 2 + (rand() < 0.5 ? 1 : 0);
      for (var c = 0; c < copies; c++) {
        var jx = x + (rand() - 0.5) * spacing * 1.25;
        var jy = y + (rand() - 0.5) * spacing * 1.25;
        var jz = z + (rand() - 0.5) * spacing * 1.25;
        var len = Math.sqrt(jx * jx + jy * jy + jz * jz);
        list.push(jx / len, jy / len, jz / len, 0.35 + rand() * 0.65, rand());
      }
    }
    globePoints = new Float32Array(list);
    return globePoints;
  }

  function Globe(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.color = rgb(canvas, "color", "148,158,184");
    this.alpha = num(canvas, "alpha", 0.9);
    this.scale = num(canvas, "scale", 0.36);
    this.scaleW = num(canvas, "scale-w", 0.56);
    this.cxRatio = num(canvas, "x", 0.5);
    this.cyRatio = num(canvas, "y", 0.5);
    this.speed = num(canvas, "speed", 0.045);
    this.tilt = num(canvas, "tilt", 0.32);
    this.rim = num(canvas, "rim", 0.5);
    // lattice longitude L faces the viewer when angle = L - PI/2 (radians)
    this.angle = num(canvas, "start", -2.1);
    this.points = buildGlobePoints();
    this.running = false;
    this.visible = true;
    this.last = 0;
    this.buckets = 8;
    this.bucketFill = [];
    for (var b = 0; b < this.buckets; b++) {
      var a = ((b + 1) / this.buckets) * this.alpha;
      this.bucketFill.push("rgba(" + this.color + "," + a.toFixed(3) + ")");
    }
    // cursor effect: per-dot screen offset, velocity and seconds since the
    // cursor last touched it (ox, oy, vx, vy, age)
    this.hover = Math.max(0, num(canvas, "hover", 1));
    this.hoverColor = rgb(canvas, "hover-color", "238,230,178");
    this.linger = Math.max(0, num(canvas, "hover-linger", 1.5));
    this.hoverAmt = 0;
    this.live = 0;
    this.state = this.points ? new Float32Array(this.points.length) : null;
    this.hotBuckets = 6;
    this.hotFill = [];
    for (b = 0; b < this.hotBuckets; b++) {
      a = ((b + 1) / this.hotBuckets) * 0.95;
      this.hotFill.push("rgba(" + this.hoverColor + "," + a.toFixed(3) + ")");
    }
    this.frame = this.frame.bind(this);
    this.resize();
  }

  Globe.prototype.resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.w = Math.max(1, Math.round(rect.width));
    this.h = Math.max(1, Math.round(rect.height));
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    var vh = Math.min(this.h, window.innerHeight || this.h);
    this.radius = Math.min(vh * this.scale, this.w * this.scaleW);
    this.cx = this.w * this.cxRatio;
    this.cy = this.h * this.cyRatio;
    if (!this.running) this.draw();
  };

  // Eases the cursor effect in and out and returns the cursor position in
  // canvas coordinates, or null when it has nothing to act on.
  Globe.prototype.cursor = function (dt, t) {
    var target = pointer.active && this.hover > 0 ? 1 : 0;
    this.hoverAmt += (target - this.hoverAmt) * (1 - Math.exp(-dt * 8));
    if (this.hoverAmt < 0.01 || !pointer.t) return null;
    var rect = this.canvas.getBoundingClientRect();
    // cursor velocity fades once the mouse stops moving
    var still = Math.max(0, (t || 0) - pointer.t);
    var fade = Math.exp(-still / 60);
    return {
      x: pointer.x - rect.left,
      y: pointer.y - rect.top,
      vx: pointer.vx * fade,
      vy: pointer.vy * fade,
      amt: this.hoverAmt * this.hover
    };
  };

  Globe.prototype.draw = function (dt, t) {
    var ctx = this.ctx;
    var pts = this.points;
    var dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    if (!pts) return;

    dt = dt || 0;
    var R = this.radius, cx = this.cx, cy = this.cy;
    var ca = Math.cos(this.angle), sa = Math.sin(this.angle);
    var ct = Math.cos(this.tilt), st = Math.sin(this.tilt);
    // light from the lower right, slightly in front
    var lx = 0.52, ly = -0.46, lz = 0.72;
    var nb = this.buckets, nh = this.hotBuckets;
    var sx = [], sy = [], sz = [];
    var hx = [], hy = [], hz = [];
    for (var b = 0; b < nb; b++) { sx.push([]); sy.push([]); sz.push([]); }
    for (b = 0; b < nh; b++) { hx.push([]); hy.push([]); hz.push([]); }

    var dot = Math.max(0.8, R / 300);

    // cursor physics, in CSS pixels and seconds
    var state = this.state;
    var cur = dt > 0 && state ? this.cursor(dt, t) : null;
    var physics = dt > 0 && state && (cur || this.live > 0);
    var reach = Math.max(28, R * 0.17);
    var reach2 = reach * reach;
    var push = reach * 110;              // outward acceleration at the centre
    var drag = 7;                        // how much of the cursor's motion is passed on
    var spring = 15;                     // holds pushed dots against the cursor
    var hold = this.linger;              // then the hole stays open this long
    var ramp = 0.8;                      // before the pull back fades in over this long
    var back = 5;                        // pull back to the rest position
    var damping = Math.exp(-dt * 4.2);   // slightly under-damped, so dots settle with a wobble
    var maxV = reach * 45;
    var glowAt = reach * 0.45;
    var mx = 0, my = 0, mvx = 0, mvy = 0, amt = 0;
    if (cur) {
      mx = cur.x; my = cur.y; mvx = cur.vx; mvy = cur.vy; amt = cur.amt;
      // skip the distance test when the cursor is nowhere near the globe
      if (mx < cx - R - reach || mx > cx + R + reach || my < cy - R - reach || my > cy + R + reach) amt = 0;
    }
    var live = 0;

    for (var i = 0, j = 0; i < pts.length; i += 5, j += 5) {
      var x = pts[i], y = pts[i + 1], z = pts[i + 2];
      // screen x is mirrored so east sits to the right
      var x1 = -(x * ca + z * sa);
      var z1 = -x * sa + z * ca;
      var y2 = y * ct - z1 * st;
      var z2 = y * st + z1 * ct;
      if (z2 <= 0.02) {
        // dots rotating out of view drop their offset
        if (physics && (state[j] !== 0 || state[j + 1] !== 0 || state[j + 2] !== 0 || state[j + 3] !== 0)) {
          state[j] = state[j + 1] = state[j + 2] = state[j + 3] = state[j + 4] = 0;
        }
        continue;
      }

      var light = x1 * lx + y2 * ly + z2 * lz;
      var shade = 0.3 + 0.7 * Math.max(0, light);
      var limb = Math.min(1, z2 * 2.6);
      var a = shade * limb * pts[i + 3];
      var px = cx + x1 * R;
      var py = cy - y2 * R;
      var size = dot * (0.75 + pts[i + 4] * 0.9);

      if (state) {
        var ox = state[j], oy = state[j + 1];
        if (physics) {
          var vx = state[j + 2], vy = state[j + 3], age = state[j + 4];
          if (amt > 0) {
            var dx = px + ox - mx, dy = py + oy - my;
            if (dx < reach && dx > -reach && dy < reach && dy > -reach) {
              var d2 = dx * dx + dy * dy;
              if (d2 < reach2) {
                var d = Math.sqrt(d2) || 0.001;
                // each dot has its own reach, so the edge of the hole is ragged
                var own = reach * (0.62 + ((pts[i + 3] * 97.31) % 1) * 0.38);
                var f = 1 - d / own;
                if (f < 0) f = 0;
                else age = 0;
                var kick = push * f * amt * dt;
                vx += (dx / d) * kick + mvx * f * drag * amt * dt;
                vy += (dy / d) * kick + mvy * f * drag * amt * dt;
              }
            }
          }
          if (ox !== 0 || oy !== 0 || vx !== 0 || vy !== 0) {
            age += dt;
            var k;
            if (age < 0.15) {
              k = spring;
            } else if (age < hold) {
              k = 0;
            } else {
              var r = (age - hold) / ramp;
              k = r >= 1 ? back : back * r * r * (3 - 2 * r);
            }
            vx = (vx - ox * k * dt) * damping;
            vy = (vy - oy * k * dt) * damping;
            var sp = vx * vx + vy * vy;
            if (sp > maxV * maxV) {
              sp = maxV / Math.sqrt(sp);
              vx *= sp; vy *= sp;
            }
            ox += vx * dt;
            oy += vy * dt;
            if (ox * ox + oy * oy < 0.0025 && vx * vx + vy * vy < 0.25) {
              ox = oy = vx = vy = age = 0;
            } else {
              live++;
            }
            state[j] = ox; state[j + 1] = oy; state[j + 2] = vx; state[j + 3] = vy; state[j + 4] = age;
          }
        }
        if (ox !== 0 || oy !== 0) {
          px += ox;
          py += oy;
          // displaced dots light up and swell, then fade back as they return
          var e = Math.min(1, Math.sqrt(ox * ox + oy * oy) / glowAt);
          if (e > 0.12) {
            var hb = Math.min(nh - 1, Math.floor((0.3 + 0.7 * e) * Math.max(0.55, limb) * nh));
            hx[hb].push(px);
            hy[hb].push(py);
            hz[hb].push(size * (0.6 + e * 0.9));
            continue;
          }
        }
      }

      var bucket = Math.min(nb - 1, Math.floor(a * nb));
      if (bucket < 0) continue;
      sx[bucket].push(px);
      sy[bucket].push(py);
      sz[bucket].push(size);
    }
    if (physics) this.live = live;

    for (b = 0; b < nb; b++) {
      var xs = sx[b], ys = sy[b], ss = sz[b];
      if (!xs.length) continue;
      ctx.fillStyle = this.bucketFill[b];
      for (var k = 0; k < xs.length; k++) {
        var s = ss[k];
        ctx.fillRect(xs[k] - s / 2, ys[k] - s / 2, s, s);
      }
    }

    // pushed dots are drawn round, on top of the rest
    for (b = 0; b < nh; b++) {
      xs = hx[b]; ys = hy[b]; ss = hz[b];
      if (!xs.length) continue;
      ctx.fillStyle = this.hotFill[b];
      ctx.beginPath();
      for (k = 0; k < xs.length; k++) {
        ctx.moveTo(xs[k] + ss[k], ys[k]);
        ctx.arc(xs[k], ys[k], ss[k], 0, 6.2832);
      }
      ctx.fill();
    }

    // lit rim: a thin crescent on the lower right, fading out at both ends
    if (this.rim > 0) {
      var steps = 48, from = -0.35, to = 2.3;
      var mid = (from + to) / 2, half = (to - from) / 2;
      ctx.lineWidth = Math.max(1.2, R / 150);
      for (var seg = 0; seg < steps; seg++) {
        var a0 = from + ((to - from) * seg) / steps;
        var a1 = from + ((to - from) * (seg + 1)) / steps;
        var d = Math.abs((a0 + a1) / 2 - mid) / half;
        var fade = Math.pow(Math.max(0, 1 - d * d), 1.6);
        ctx.strokeStyle = "rgba(" + this.color + "," + (this.rim * fade).toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(cx, cy, R + ctx.lineWidth * 0.5, a0, a1 + 0.002);
        ctx.stroke();
      }
    }
  };

  Globe.prototype.frame = function (t) {
    if (!this.running) return;
    var dt = this.last ? Math.min(0.05, (t - this.last) / 1000) : 0;
    this.last = t;
    this.angle -= this.speed * dt;
    this.draw(dt, t);
    window.requestAnimationFrame(this.frame);
  };

  Globe.prototype.start = function () {
    if (this.running || reduceMotion) return;
    this.running = true;
    this.last = 0;
    window.requestAnimationFrame(this.frame);
  };

  Globe.prototype.stop = function () {
    this.running = false;
  };

  var globes = [];

  document.querySelectorAll("canvas[data-globe]").forEach(function (canvas) {
    if (!canvas.getContext || !LAND) return;
    var g = new Globe(canvas);
    globes.push(g);
    g.draw();
    window.requestAnimationFrame(function () { canvas.classList.add("is-ready"); });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) g.start();
          else g.stop();
        });
      }).observe(canvas);
    } else {
      g.start();
    }
  });

  /* ------------------------------------------------------------------------
     Flat dotted world map
     <canvas data-worldmap
             data-color="255,255,255"      land dots
             data-alpha="0.28"
             data-accent="176,52,66"       highlighted regions
             data-regions="na,sa,eu,af,as,oc">
     Regions are rough lon/lat boxes; tune REGIONS below if needed.
     ------------------------------------------------------------------------ */
  var REGIONS = {
    na: [[-168, 15, -52, 72]],
    ca: [[-118, 7, -60, 24]],
    sa: [[-82, -56, -34, 13]],
    eu: [[-11, 36, 40, 71]],
    me: [[34, 12, 60, 38]],
    af: [[-18, -35, 51, 36]],
    as: [[60, 5, 146, 55], [40, 38, 60, 55]],
    oc: [[112, -45, 180, -10]]
  };

  function inRegions(lon, lat, keys) {
    for (var i = 0; i < keys.length; i++) {
      var boxes = REGIONS[keys[i]];
      if (!boxes) continue;
      for (var j = 0; j < boxes.length; j++) {
        var bx = boxes[j];
        if (lon >= bx[0] && lat >= bx[1] && lon <= bx[2] && lat <= bx[3]) return true;
      }
    }
    return false;
  }

  function drawWorldMap(canvas) {
    if (!LAND || !LAND.grid) return;
    var g = LAND.grid;
    var mask = decodeMask(g.mask);
    var ctx = canvas.getContext("2d");
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, rect.width), h = Math.max(1, rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var color = rgb(canvas, "color", "255,255,255");
    var alpha = num(canvas, "alpha", 0.28);
    var accent = rgb(canvas, "accent", "176,52,66");
    var keys = (canvas.getAttribute("data-regions") || "").split(",").filter(Boolean);
    var cell = Math.min(w / g.w, h / g.h);
    var ox = (w - cell * g.w) / 2;
    var oy = (h - cell * g.h) / 2;
    var size = Math.max(1, cell * 0.62);
    var base = "rgba(" + color + "," + alpha + ")";
    var hot = "rgba(" + accent + ",0.95)";

    for (var r = 0; r < g.h; r++) {
      for (var c = 0; c < g.w; c++) {
        if (!bitSet(mask, r * g.w + c)) continue;
        var lon = -180 + g.step * (c + 0.5);
        var lat = g.top - g.step * (r + 0.5);
        ctx.fillStyle = keys.length && inRegions(lon, lat, keys) ? hot : base;
        ctx.fillRect(ox + c * cell + (cell - size) / 2, oy + r * cell + (cell - size) / 2, size, size);
      }
    }
  }

  var maps = Array.prototype.slice.call(document.querySelectorAll("canvas[data-worldmap]"));
  maps.forEach(drawWorldMap);

  /* ------------------------------------------------------------------------
     Resize
     ------------------------------------------------------------------------ */
  var resizeTimer = 0;
  var lastWidth = window.innerWidth;
  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      // redraw a globe only when its own box changed, so mobile browser bars
      // showing and hiding do not make the globe jump
      var widthChanged = window.innerWidth !== lastWidth;
      lastWidth = window.innerWidth;
      globes.forEach(function (g) {
        if (widthChanged || Math.round(g.canvas.getBoundingClientRect().height) !== g.h) g.resize();
      });
      maps.forEach(drawWorldMap);
    }, 120);
  });
})();
