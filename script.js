(function () {
  "use strict";

  /* ---- manifest: only files that exist in the project folders ---- */

  var SYMBOL_SETS = [
    { folder: "2_symbols/balanced", label: "Balanced",  files: ["B1.JPG","B2.JPG","B3.JPG","B4.JPG","B5.JPG","B6.JPG","B7.JPG","B8.JPG","B9.JPG","B10.JPG","B11.JPG","B12.JPG"] },
    { folder: "2_symbols/dyamic",   label: "Dynamic",   files: ["D1.svg","D2.svg","D3.svg","D4.svg","D5.svg","D6.svg","D7.svg","D8.svg","D9.svg","D10.svg","D11.svg","D12.svg"] },
    { folder: "2_symbols/flexible", label: "Flexible",  files: ["Fl1.JPG","Fl2.JPG","Fl3.JPG","Fl4.JPG","Fl5.JPG","Fl6.JPG","Fl7.JPG","Fl8.JPG","Fl9.JPG","Fl10.JPG","Fl11.JPG","Fl12.JPG"] },
    { folder: "2_symbols/freedom",  label: "Freedom",   files: ["F1.JPG","F2.JPG","F3.JPG","F4.JPG","F5.JPG","F6.JPG","F7.JPG","F8.JPG","F9.JPG","F10.JPG","F11.JPG","F12.JPG"] },
    { folder: "2_symbols/reative",  label: "Creative",  files: ["R1.JPG","R2.JPG","R3.JPG","R4.JPG","R5.JPG","R6.JPG","R7.JPG","R8.JPG","R9.JPG","R10.JPG","R11.JPG","R12.JPG"] }
  ];

  var METHODS_A = { folder: "3_methodologies_A", label: "Methodologies A", items: ["A_1", "A_2", "A_3", "A_4"] };
  var METHODS_B = { folder: "4_methodologies_B", label: "Methodologies B", items: ["B_1", "B_2", "B_3", "B_4"] };
  var IMAGES_20 = { folder: "20%20image", label: "20 image", items: ["20_1.svg", "20_2.svg"] };

  var ALT = "From the Object Project";

  /* ---- flat list powering the lightbox ---- */

  var views = [];

  function addView(v) {
    views.push({
      src: v.src,
      name: v.name,
      file: v.file,
      svg: /\.svg$/i.test(v.src),
      scan: v.scan || null
    });
    return views.length - 1;
  }

  /* ---- small builders ---- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function baseName(file) {
    return file.replace(/\.[^.]+$/, "");
  }

  /* ---- p5 + p5.svgkit plate ----------------------------------------
     Every .svg in the project is loaded through svgkit and drawn on a
     p5 canvas, so the vector stays vector (and can be exported again).
     Canvases are created lazily, sized to their host, and redrawn on
     resize. A single host can be re-pointed at another file, which is
     what the lightbox uses. */

  function contain(bw, bh, iw, ih) {
    if (!iw || !ih) return { x: 0, y: 0, w: bw, h: bh };
    var s = Math.min(bw / iw, bh / ih);
    var w = iw * s;
    var h = ih * s;
    return { x: (bw - w) / 2, y: (bh - h) / 2, w: w, h: h };
  }

  function createPlate(host, opts) {
    opts = opts || {};

    var ctrl = { p: null, rec: null, art: null, pending: null, token: 0 };

    function fit(p) {
      var w = Math.max(1, Math.round(host.clientWidth));
      var h = Math.max(1, Math.round(host.clientHeight));
      if (w !== p.width || h !== p.height) p.resizeCanvas(w, h);
    }

    function loadInto(path) {
      if (!ctrl.rec || !ctrl.p) {
        ctrl.pending = path;
        return null;
      }

      ctrl.token += 1;
      var token = ctrl.token;

      ctrl.art = null;
      host.classList.remove("is-ready", "is-error");
      ctrl.rec.clear();
      ctrl.p.clear();

      if (opts.onState) opts.onState("loading");

      return ctrl.rec.load(path).then(function (img) {
        if (token !== ctrl.token) return;
        ctrl.art = img;
        if (opts.autoRatio !== false) {
          host.style.aspectRatio = img.width + " / " + img.height;
        }
        fit(ctrl.p);
        /* svgkit keeps a single active recorder — make it ours before drawing */
        svgkit.record(ctrl.p);
        ctrl.p.redraw();
        host.classList.add("is-ready");
        if (opts.onState) opts.onState("ready");
        if (opts.onLoad) opts.onLoad(ctrl.p, ctrl.rec);
      }).catch(function (err) {
        if (token !== ctrl.token) return;
        console.error("[p5.svgkit] could not load " + path, err);
        host.classList.add("is-error");
        if (opts.onState) opts.onState("error");
      });
    }

    ctrl.show = function (path) { return loadInto(path); };

    ctrl.p = new p5(function (p) {
      p.setup = function () {
        p.createCanvas(
          Math.max(1, Math.round(host.clientWidth)),
          Math.max(1, Math.round(host.clientHeight))
        );
        p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
        p.noLoop();

        ctrl.rec = svgkit.record(p);

        if (window.ResizeObserver) {
          new ResizeObserver(function () {
            fit(p);
            svgkit.record(p);
            p.redraw();
          }).observe(host);
        }

        var start = ctrl.pending || host.getAttribute("data-svg");
        if (start) loadInto(start);
      };

      p.draw = function () {
        p.clear();
        if (!ctrl.art) return;
        var box = contain(p.width, p.height, ctrl.art.width, ctrl.art.height);
        p.image(ctrl.art, box.x, box.y, box.w, box.h);
      };
    }, host);

    return ctrl;
  }

  /* ---- lazy mounting of cell plates ---- */

  var plateObserver = null;

  if ("IntersectionObserver" in window) {
    plateObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var host = en.target;
        obs.unobserve(host);
        host.setAttribute("data-mounted", "1");
        createPlate(host);
      });
    }, { rootMargin: "400px 0px" });
  }

  function buildCell(src, name, index) {
    var view = views[index];

    var btn = el("button", "cell");
    btn.type = "button";
    btn.setAttribute("data-view", String(index));
    btn.setAttribute("aria-label", "View " + name + " full size");

    var fig = el("span", "cell-figure");

    if (view.svg) {
      fig.className = "cell-figure cell-plate";
      fig.setAttribute("data-svg", src);
      if (plateObserver) plateObserver.observe(fig);
      else createPlate(fig);
    } else {
      var img = el("img");
      img.src = src;
      img.alt = name + " — " + ALT;
      img.loading = "lazy";
      img.decoding = "async";
      fig.appendChild(img);
    }

    var lab = el("span", "cell-label", name);
    btn.appendChild(fig);
    btn.appendChild(lab);
    return btn;
  }

  /* ---- section builders ---- */

  function buildSymbols(mount) {
    SYMBOL_SETS.forEach(function (set) {
      var group = el("div", "group");

      var gh = el("div", "group-head");
      var h3 = el("h3", "group-name", set.label);
      var meta = el("p", "group-meta", set.folder + "  ·  " + set.files.length + " files");
      gh.appendChild(h3);
      gh.appendChild(meta);

      var grid = el("div", "grid grid-6");
      set.files.forEach(function (file) {
        var name = baseName(file);
        var src = set.folder + "/" + file;
        var index = addView({ src: src, name: set.label + " " + name, file: src });
        grid.appendChild(buildCell(src, name, index));
      });

      group.appendChild(gh);
      group.appendChild(grid);
      mount.appendChild(group);
    });
  }

  function buildMethodologies(mount, set) {
    set.items.forEach(function (stem) {
      var jpg = stem + ".JPG";
      var svg = stem + ".svg";
      var full = set.folder + "/" + svg;
      var scan = set.folder + "/" + jpg;
      var name = set.label + " " + stem.replace("_", " ");
      var index = addView({
        src: full,
        name: name,
        file: svg + "  ·  " + jpg,
        scan: scan
      });
      /* the cell shows the vector plate; the scan stays one click away */
      mount.appendChild(buildCell(full, stem.replace("_", " "), index));
    });
  }

  function buildTwenty(mount) {
    IMAGES_20.items.forEach(function (file) {
      var name = baseName(file);
      var src = IMAGES_20.folder + "/" + file;
      var index = addView({ src: src, name: IMAGES_20.label + " " + name, file: src });
      mount.appendChild(buildCell(src, name, index));
    });
  }

  /* ---- lightbox ---- */

  var lb = {
    root: document.getElementById("lightbox"),
    image: document.getElementById("lb-image"),
    plate: document.getElementById("lb-plate"),
    caption: document.getElementById("lb-caption"),
    close: document.getElementById("lb-close"),
    prev: document.getElementById("lb-prev"),
    next: document.getElementById("lb-next"),
    toggle: document.getElementById("lb-toggle"),
    exportBtn: document.getElementById("lb-export"),
    plateCtrl: null,
    at: 0,
    mode: "vector",
    opener: null
  };

  function lbPlate() {
    if (!lb.plateCtrl) {
      lb.plateCtrl = createPlate(lb.plate, {
        autoRatio: true,
        onState: function (state) {
          lb.exportBtn.disabled = state !== "ready";
          if (state === "error") lb.exportBtn.hidden = true;
        }
      });
    }
    return lb.plateCtrl;
  }

  /* mode: "vector" -> p5.svgkit plate, "scan" -> plain <img> of the JPG */
  function lbRender(v, mode) {
    lb.mode = mode;

    if (v.svg && mode === "vector") {
      lb.image.hidden = true;
      lb.image.removeAttribute("src");
      lb.plate.hidden = false;
      lb.exportBtn.hidden = false;
      lb.exportBtn.disabled = true;
      lbPlate().show(v.src);
    } else {
      lb.plate.hidden = true;
      lb.exportBtn.hidden = true;
      lb.image.hidden = false;
      lb.image.src = (mode === "scan" ? v.scan : v.src);
      lb.image.alt = v.name + (mode === "scan" ? " (scan)" : "") + " — " + ALT;
    }

    if (v.scan) {
      lb.toggle.hidden = false;
      lb.toggle.textContent = mode === "vector" ? "Show scan" : "Show vector";
    } else {
      lb.toggle.hidden = true;
    }
  }

  function lbShow(i) {
    var v = views[i];
    if (!v) return;
    lb.at = i;

    /* unhide first so the plate can be measured */
    lb.root.hidden = false;
    document.body.style.overflow = "hidden";

    lb.caption.textContent = v.name;
    lb.caption.appendChild(document.createTextNode("  "));
    lb.caption.appendChild(el("b", null, v.file));

    lbRender(v, "vector");
  }

  function lbHide() {
    lb.root.hidden = true;
    lb.image.removeAttribute("src");
    lb.plate.hidden = true;
    document.body.style.overflow = "";
    if (lb.opener) {
      lb.opener.focus();
      lb.opener = null;
    }
  }

  function lbStep(d) {
    var i = (lb.at + d + views.length) % views.length;
    lbShow(i);
  }

  document.addEventListener("click", function (e) {
    var cell = e.target.closest ? e.target.closest(".cell") : null;
    if (cell) {
      lb.opener = cell;
      lbShow(parseInt(cell.getAttribute("data-view"), 10));
      lb.close.focus();
      return;
    }
    if (lb.root.hidden) return;
    if (e.target === lb.root || !e.target.closest(".lb-figure")) lbHide();
  });

  lb.close.addEventListener("click", lbHide);

  lb.prev.addEventListener("click", function () { lbStep(-1); });
  lb.next.addEventListener("click", function () { lbStep(1); });

  lb.toggle.addEventListener("click", function () {
    var v = views[lb.at];
    if (!v || !v.scan) return;
    lbRender(v, lb.mode === "vector" ? "scan" : "vector");
  });

  lb.exportBtn.addEventListener("click", function () {
    if (!lb.plateCtrl || !lb.plateCtrl.rec) return;
    var v = views[lb.at];
    lb.exportBtn.disabled = true;
    lb.plateCtrl.rec.export(baseName(v.name.replace(/\s+/g, "-")));
    window.setTimeout(function () { lb.exportBtn.disabled = false; }, 600);
  });

  document.addEventListener("keydown", function (e) {
    if (lb.root.hidden) return;
    if (e.key === "Escape") lbHide();
    else if (e.key === "ArrowLeft") lbStep(-1);
    else if (e.key === "ArrowRight") lbStep(1);
    else if (e.key === "Tab") {
      var f = Array.prototype.slice.call(lb.root.querySelectorAll("button"))
        .filter(function (n) { return !n.hidden && n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0];
      var last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  /* ---- build ---- */

  buildSymbols(document.getElementById("symbol-groups"));
  buildMethodologies(document.getElementById("methods-a"), METHODS_A);
  buildMethodologies(document.getElementById("methods-b"), METHODS_B);
  buildTwenty(document.getElementById("images-20-grid"));

  /* ---- nav current-section marker ---- */

  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-list a"));
  var sections = navLinks
    .map(function (a) { return document.querySelector(a.getAttribute("href")); })
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    var seen = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        seen[en.target.id] = en.isIntersecting ? en.intersectionRatio : 0;
      });
      var best = null;
      var bestVal = -1;
      sections.forEach(function (s) {
        if (seen[s.id] > bestVal) { bestVal = seen[s.id]; best = s; }
      });
      if (best && bestVal > 0) {
        navLinks.forEach(function (a) {
          a.setAttribute("aria-current", a.getAttribute("href") === "#" + best.id ? "true" : "false");
        });
      }
    }, { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.15, 0.4, 0.75, 1] });

    sections.forEach(function (s) { io.observe(s); });
  }
})();
