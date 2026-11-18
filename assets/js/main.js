/* Messing Law — site behaviour (no dependencies) */
(function () {
  "use strict";
  if (window.__messingLawInit) return; // guard: may be included more than once on page builders
  window.__messingLawInit = true;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

function init() {
  var doc = document.documentElement;
  doc.classList.remove("no-js");
  /* Embedded copies (Squarespace/Square/Wix code blocks) live inside .ml-site;
     mark them so scroll-reveal animations only hide content when JS is running. */
  document.querySelectorAll(".ml-site").forEach(function (el) { el.classList.add("ml-js"); });

  /* ---- Mobile menu ---- */
  var toggle = document.querySelector(".menu-toggle");
  var menu = document.getElementById("mobile-menu");
  function setMenu(open) {
    document.body.classList.toggle("menu-open", open);
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
    if (menu) menu.toggleAttribute("inert", !open);
  }
  if (toggle && menu) {
    setMenu(false);
    toggle.addEventListener("click", function () {
      setMenu(!document.body.classList.contains("menu-open"));
    });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("menu-open")) { setMenu(false); toggle.focus(); }
    });
    window.matchMedia("(min-width: 900px)").addEventListener("change", function (mq) { if (mq.matches) setMenu(false); });
  }

  /* ---- Header shadow on scroll ---- */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 8); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---- Reveal on scroll ---- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---- Practice/Industry filter ---- */
  var filter = document.getElementById("practice-filter");
  if (filter) {
    var items = Array.prototype.slice.call(document.querySelectorAll(".accordion details"));
    var groups = Array.prototype.slice.call(document.querySelectorAll(".accordion-group"));
    var empty = document.getElementById("filter-empty");
    filter.addEventListener("input", function () {
      var q = filter.value.trim().toLowerCase();
      var shown = 0;
      items.forEach(function (d) {
        var hit = !q || d.textContent.toLowerCase().indexOf(q) !== -1;
        d.hidden = !hit;
        if (q && hit) d.open = true;
        if (!q) d.open = false;
        if (hit) shown++;
      });
      groups.forEach(function (g) { g.hidden = !g.querySelector("details:not([hidden])"); });
      if (empty) empty.hidden = shown !== 0;
    });
  }

  /* ---- Deep links to a practice area (e.g. practice-industries.html#litigation-adr)
     open that accordion item and bring it into view. ---- */
  function openFromHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    var target = id && document.getElementById(id);
    if (target && target.tagName === "DETAILS") {
      target.open = true;
      target.scrollIntoView({ block: "start" });
    }
  }
  openFromHash();
  window.addEventListener("hashchange", openFromHash);

  /* ---- Team bios ----
     Each person card has a <template class="bio">. A "Learn More" button is
     shown only when that template contains bio content. */
  var dialog = document.getElementById("bio-dialog");
  document.querySelectorAll(".person").forEach(function (card) {
    var tpl = card.querySelector("template.bio");
    var btn = card.querySelector(".person-more");
    if (!btn) return;
    var hasBio = tpl && tpl.content.textContent.trim().length > 0;
    if (!hasBio || !dialog || typeof dialog.showModal !== "function") { btn.hidden = true; return; }
    var photo = card.querySelector(".person-photo");
    if (photo) {
      photo.classList.add("is-clickable");
      photo.addEventListener("click", function () { btn.click(); });
    }
    btn.addEventListener("click", function () {
      var img = card.querySelector(".person-photo img");
      dialog.querySelector(".bio-dialog-photo").innerHTML = img ? '<img src="' + img.getAttribute("src") + '" alt="">' : "";
      var body = dialog.querySelector(".bio-dialog-body");
      body.innerHTML = "";
      var h = document.createElement("h2");
      h.className = "h-display";
      h.id = "bio-dialog-title";
      h.textContent = card.querySelector(".person-name").textContent;
      var t = document.createElement("p");
      t.className = "person-title";
      t.textContent = card.querySelector(".person-title").textContent;
      body.appendChild(h);
      body.appendChild(t);
      body.appendChild(tpl.content.cloneNode(true));
      dialog.showModal();
      dialog.querySelector(".bio-dialog-inner").scrollTop = 0;
      dialog.querySelector(".bio-dialog-close").focus();
    });
  });
  if (dialog) {
    dialog.querySelector(".bio-dialog-close").addEventListener("click", function () { dialog.close(); });
    dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
  }

  /* ---- Scheduler: pick an attorney, show their Calendly ----
     Buttons carry data-calendly="https://calendly.com/<name>". The page loads
     Calendly's widget.js; until it arrives (or if it is blocked) the plain
     links in .calendly-fallback stay visible. schedule.html#alessandra preselects. */
  var scheduler = document.querySelector("[data-scheduler]");
  if (scheduler) {
    var options = Array.prototype.slice.call(scheduler.querySelectorAll("[data-calendly]"));
    var embed = scheduler.querySelector(".calendly-embed");
    var current = null;
    var calendlyParams = "hide_gdpr_banner=1&background_color=ffffff&primary_color=069372";
    var show = function (btn, updateHash) {
      options.forEach(function (o) { o.setAttribute("aria-pressed", String(o === btn)); });
      if (updateHash && history.replaceState) history.replaceState(null, "", "#" + btn.id);
      var url = btn.getAttribute("data-calendly");
      if (url === current) return;
      var tries = 0;
      (function render() {
        if (window.Calendly && typeof window.Calendly.initInlineWidget === "function") {
          current = url;
          embed.innerHTML = "";
          window.Calendly.initInlineWidget({ url: url + (url.indexOf("?") === -1 ? "?" : "&") + calendlyParams, parentElement: embed });
        } else if (tries++ < 100) {
          setTimeout(render, 100); // widget.js loads async; wait up to ~10s, else keep the fallback links
        }
      })();
    };
    options.forEach(function (btn) {
      btn.addEventListener("click", function () { show(btn, true); });
    });
    var fromHash = options.filter(function (o) { return "#" + o.id === location.hash; })[0];
    show(fromHash || options[0], false);
  }

  /* ---- Forms ----
     Set data-endpoint="https://..." on a form (e.g. a Formspree, Netlify,
     or your own endpoint) to enable submission. Until then the form shows a
     notice pointing visitors to email/phone instead of silently failing. */
  document.querySelectorAll("form[data-endpoint]").forEach(function (form) {
    var status = form.querySelector(".form-status");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var endpoint = form.getAttribute("data-endpoint");
      var show = function (msg, state) { if (status) { status.textContent = msg; status.dataset.state = state || ""; status.hidden = false; } };
      if (!endpoint) {
        show(form.getAttribute("data-offline-message") || "Online submissions are not available yet. Please email aaron@messing.law or call 646-450-9460.");
        return;
      }
      var submit = form.querySelector('[type="submit"]');
      if (submit) submit.disabled = true;
      fetch(endpoint, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          form.reset();
          show(form.getAttribute("data-success-message") || "Thank you!", "ok");
        })
        .catch(function () {
          show("Sorry, something went wrong. Please email aaron@messing.law or call 646-450-9460.");
        })
        .then(function () { if (submit) submit.disabled = false; });
    });
  });

  /* ---- Footer year ---- */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
}
})();
