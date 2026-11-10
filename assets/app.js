/* shared behaviour: nav, reveals, hero parallax, search, lightbox */
(function () {
  "use strict";

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ---------------------------------------------------------- nav */
  const nav = $(".nav");
  if (nav) {
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const burger = $(".burger");
    if (burger && !document.body.classList.contains("codex-body")) {
      burger.addEventListener("click", () => {
        const open = nav.classList.toggle("menu-open");
        document.body.classList.toggle("menu-locked", open);
        burger.setAttribute("aria-expanded", open ? "true" : "false");
      });
      $$(".navlinks a").forEach((a) => {
        a.addEventListener("click", () => {
          nav.classList.remove("menu-open");
          document.body.classList.remove("menu-locked");
          burger.setAttribute("aria-expanded", "false");
        });
      });
    }
    $$(".navlinks a").forEach((a) => {
      if (a.getAttribute("href") === location.pathname.split("/").pop()) a.classList.add("active");
    });
  }

  /* ---------------------------------------------------------- reveals */
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 })
    : null;
  $$("[data-reveal]").forEach((el, i) => {
    el.style.transitionDelay = (i % 4) * 70 + "ms";
    if (io) io.observe(el); else el.classList.add("in");
  });

  /* ---------------------------------------------------------- hero parallax */
  const heroImg = $(".hero-media img");
  const canParallax = window.matchMedia("(min-width: 901px) and (prefers-reduced-motion: no-preference)").matches;
  if (heroImg && canParallax) {
    let raf = null;
    const move = () => {
      const y = Math.min(window.scrollY, window.innerHeight);
      heroImg.style.transform = `scale(1.06) translateY(${y * 0.16}px)`;
      raf = null;
    };
    window.addEventListener("scroll", () => {
      if (!raf) raf = requestAnimationFrame(move);
    }, { passive: true });
  }

  /* ---------------------------------------------------------- search */
  const searchBtn = $("[data-search-open]");
  let overlay = null;
  let index = null;

  function buildIndex() {
    if (index || !window.LORE) return;
    index = [];
    window.LORE.parts.forEach((part) => {
      part.chapters.forEach((ch) => {
        const bits = [];
        (function walk(n) {
          n.blocks.forEach((b) => {
            if (b.kind === "p") bits.push(b.text);
            else if (b.kind === "list") bits.push(b.items.join(" "));
            else if (b.kind === "table") bits.push(b.rows.map((r) => r.join(" ")).join(" "));
          });
          n.children.forEach(walk);
        })(ch);
        index.push({
          id: ch.id,
          title: ch.title,
          part: part.title,
          text: bits.join(" "),
        });
      });
    });
  }

  function highlight(text, q) {
    const esc = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return text.replace(new RegExp(esc, "ig"), (m) => `<mark>${m}</mark>`);
  }

  function snippet(text, q) {
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return text.slice(0, 130) + "…";
    const s = Math.max(0, i - 55);
    let out = (s > 0 ? "…" : "") + text.slice(s, i + 130);
    return highlight(out, q) + "…";
  }

  function runSearch(q) {
    const results = $(".results", overlay);
    const query = q.trim();
    if (query.length < 2) {
      results.innerHTML = '<div class="search-empty">Type at least two letters.</div>';
      return;
    }
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = [];
    index.forEach((item) => {
      const title = item.title.toLowerCase();
      const text = item.text.toLowerCase();
      let score = 0;
      let ok = true;
      terms.forEach((t) => {
        const tHit = title.includes(t);
        const bHit = text.includes(t);
        if (!tHit && !bHit) ok = false;
        score += tHit ? 12 : 0;
        if (bHit) score += 1 + Math.min(6, (text.split(t).length - 1));
      });
      if (!ok) return;
      if (title === query.toLowerCase()) score += 40;
      hits.push({ item, score });
    });
    hits.sort((a, b) => b.score - a.score);
    const top = hits.slice(0, 24);
    if (!top.length) {
      results.innerHTML = '<div class="search-empty">Nothing in the codex matches that.</div>';
      return;
    }
    results.innerHTML = top.map(({ item }) => `
      <a class="result" href="codex.html#${item.id}">
        <div class="rt">${highlight(item.title, query)}</div>
        <div class="rp">${item.part}</div>
        <div class="rs">${snippet(item.text, query)}</div>
      </a>`).join("");
  }

  if (searchBtn) {
    searchBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (!window.LORE) {
        location.href = "codex.html#search";
        return;
      }
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "overlay";
        overlay.innerHTML = `
          <div class="search-box" role="dialog" aria-label="Search the codex">
            <div class="search-top">
              <button class="search-back" type="button" aria-label="Back to page">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>
              </button>
              <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/></svg>
              <input type="text" placeholder="Search the codex…" aria-label="Search">
              <kbd>ESC</kbd>
            </div>
            <div class="results"></div>
            <div class="search-hint"><span>↵ open first result</span><span>esc close</span></div>
          </div>`;
        document.body.appendChild(overlay);
        const input = $("input", overlay);
        $(".search-back", overlay).addEventListener("click", closeSearch);
        input.addEventListener("input", () => runSearch(input.value));
        input.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            const first = $(".result", overlay);
            if (first) location.href = first.getAttribute("href");
          }
        });
        overlay.addEventListener("click", (ev) => {
          if (ev.target === overlay) closeSearch();
        });
      }
      buildIndex();
      overlay.classList.add("open");
      document.body.style.overflow = "hidden";
      const input = $("input", overlay);
      input.value = "";
      runSearch("");
      setTimeout(() => input.focus(), 30);
    });
  }

  function closeSearch() {
    if (!overlay) return;
    overlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav && nav.classList.contains("menu-open")) {
      nav.classList.remove("menu-open");
      document.body.classList.remove("menu-locked");
      const b = $(".burger");
      if (b) b.setAttribute("aria-expanded", "false");
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (searchBtn) searchBtn.click();
    }
    if (e.key === "Escape") closeSearch();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1000 && nav && nav.classList.contains("menu-open")) {
      nav.classList.remove("menu-open");
      document.body.classList.remove("menu-locked");
      const b = $(".burger");
      if (b) b.setAttribute("aria-expanded", "false");
    }
  }, { passive: true });

  /* ---------------------------------------------------------- lightbox */
  const gallery = $(".gallery");
  if (gallery && window.ATLAS) {
    const plates = window.ATLAS;
    let lb = null;
    let idx = 0;

    function show(i) {
      idx = (i + plates.length) % plates.length;
      const p = plates[idx];
      $(".lb-stage img", lb).src = p.src;
      $(".lb-stage img", lb).alt = p.caption;
      $(".lb-cap", lb).textContent = `${p.caption} — p. ${p.page}`;
      $(".lb-count", lb).textContent = `${idx + 1} / ${plates.length}`;
    }

    function open(i) {
      if (!lb) {
        lb = document.createElement("div");
        lb.className = "lightbox";
        lb.innerHTML = `
          <div class="lb-top">
            <span class="lb-count"></span>
            <button type="button" data-close aria-label="Close">×</button>
          </div>
          <div class="lb-stage">
            <button class="lb-nav prev" type="button" aria-label="Previous">‹</button>
            <img alt="">
            <button class="lb-nav next" type="button" aria-label="Next">›</button>
          </div>
          <div class="lb-cap"></div>`;
        document.body.appendChild(lb);
        $("[data-close]", lb).addEventListener("click", close);
        $(".lb-nav.prev", lb).addEventListener("click", () => show(idx - 1));
        $(".lb-nav.next", lb).addEventListener("click", () => show(idx + 1));
        lb.addEventListener("click", (e) => { if (e.target === lb) close(); });

        // Swipe through plates on touch screens.
        let sx = 0, sy = 0;
        lb.addEventListener("touchstart", (e) => {
          if (e.target.closest("button")) return;
          const t = e.changedTouches[0];
          sx = t.clientX; sy = t.clientY;
        }, { passive: true });
        lb.addEventListener("touchend", (e) => {
          if (e.target.closest("button")) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - sx, dy = t.clientY - sy;
          if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4) {
            show(idx + (dx < 0 ? 1 : -1));
          }
        }, { passive: true });

        document.addEventListener("keydown", (e) => {
          if (!lb.classList.contains("open")) return;
          if (e.key === "ArrowLeft") show(idx - 1);
          if (e.key === "ArrowRight") show(idx + 1);
          if (e.key === "Escape") close();
        });
      }
      show(i);
      lb.classList.add("open");
      document.body.style.overflow = "hidden";
    }

    function close() {
      lb.classList.remove("open");
      document.body.style.overflow = "";
    }

    gallery.addEventListener("click", (e) => {
      const plate = e.target.closest(".plate");
      if (plate) open(Number(plate.dataset.i));
    });
  }

  /* ---------------------------------------------------------- misc */
  const yr = $("[data-year]");
  if (yr) yr.textContent = new Date().getFullYear();
})();
