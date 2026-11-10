/* codex reader */
(function () {
  "use strict";
  if (!window.LORE) return;

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

  const flat = [];
  window.LORE.parts.forEach((part, pi) => {
    part.chapters.forEach((ch) => flat.push({ part, ch, pi }));
  });
  const byId = new Map(flat.map((x) => [x.ch.id, x]));

  const treeEl = $(".tree");
  const readerEl = $(".reader-inner");
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
    "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
    "XXI", "XXII", "XXIII", "XXIV", "XXV", "XXVI", "XXVII", "XXVIII",
    "XXIX", "XXX", "XXXI", "XXXII"];

  /* ---------------------------------------------------------- sidebar */
  treeEl.innerHTML = window.LORE.parts.map((part, i) => `
    <details class="tree-part" data-part="${i}">
      <summary>
        <span class="roman">${roman[i] || i + 1}</span>
        <span class="pt">${esc(part.title)}</span>
      </summary>
      <div class="tree-chapters">
        ${part.chapters.map((ch) => `
          <a class="tree-ch" href="#${ch.id}" data-id="${ch.id}">${esc(ch.title)}</a>`).join("")}
      </div>
    </details>`).join("");

  /* ---------------------------------------------------------- render */
  function blocksHtml(blocks) {
    return blocks.map((b) => {
      if (b.kind === "p") return `<p>${esc(b.text)}</p>`;
      if (b.kind === "list") return `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
      if (b.kind === "table") {
        const [head, ...rows] = b.rows;
        return `<div class="table-wrap"><table>
          <thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
          <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table></div>`;
      }
      return "";
    }).join("");
  }

  function childrenHtml(children, depth) {
    if (!children || !children.length) return "";
    const tag = depth === 0 ? "h2" : "h3";
    return children.map((c) => `
      <section class="subsection">
        <${tag}>${esc(c.title)}</${tag}>
        <div class="prose">${blocksHtml(c.blocks)}</div>
        ${childrenHtml(c.children, depth + 1)}
      </section>`).join("");
  }

  function render(id, push) {
    const found = byId.get(id) || flat[0];
    const { part, ch } = found;
    const i = flat.findIndex((x) => x.ch.id === found.ch.id);
    const prev = i > 0 ? flat[i - 1] : null;
    const next = i < flat.length - 1 ? flat[i + 1] : null;

    const hasPlates = (window.ATLAS || []).some((p) => p.sectionId === ch.id);

    readerEl.innerHTML = `
      <nav class="crumbs">
        <a href="index.html">Marailth</a>
        <span class="sep">◆</span>
        <a href="codex.html">Codex</a>
        <span class="sep">◆</span>
        <span>${esc(part.title)}</span>
      </nav>
      <article class="page">
        <header class="page-head">
          <div class="page-part">Book ${roman[flat.find((x) => x.ch.id === id)?.pi ?? 0]} · ${esc(part.title)}</div>
          <h1>${esc(ch.title)}</h1>
          <div class="page-dash"><i></i><b></b><i></i></div>
        </header>
        <div class="prose">${blocksHtml(ch.blocks)}</div>
        ${childrenHtml(ch.children, 0)}
        <footer class="page-foot">
          <span>Source · p. ${ch.page}</span>
          ${hasPlates ? '<span><a href="atlas.html">See the plates ↗</a></span>' : "<span>Marailth Codex</span>"}
        </footer>
      </article>
      <nav class="pager">
        ${prev ? `<a href="#${prev.ch.id}" class="prev"><span class="dir">← Previous</span><span class="ttl">${esc(prev.ch.title)}</span></a>` : "<span></span>"}
        ${next ? `<a href="#${next.ch.id}" class="next"><span class="dir">Next →</span><span class="ttl">${esc(next.ch.title)}</span></a>` : "<span></span>"}
      </nav>`;

    $$(".tree-ch").forEach((a) => a.classList.toggle("active", a.dataset.id === ch.id));
    const details = $(".tree-part[data-part=\"" + found.pi + "\"]");
    if (details) {
      details.open = true;
      const active = $(".tree-ch.active");
      if (active) active.scrollIntoView({ block: "nearest" });
    }
    document.title = `${ch.title} · Marailth Codex`;
    if (push) history.pushState(null, "", "#" + ch.id);
    window.scrollTo({ top: 0, behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
    closeSidebar();
  }

  /* ---------------------------------------------------------- routing */
  function route() {
    const raw = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (raw === "search") {
      const btn = $("[data-search-open]");
      if (btn) btn.click();
      return;
    }
    render(raw && byId.has(raw) ? raw : flat[0].ch.id, false);
  }

  window.addEventListener("hashchange", route);

  /* ---------------------------------------------------------- filter */
  const filter = $(".sidebar-search input");
  if (filter) {
    filter.addEventListener("input", () => {
      const q = filter.value.trim().toLowerCase();
      $$(".tree-part").forEach((part) => {
        let shown = 0;
        $$(".tree-ch", part).forEach((a) => {
          const hit = !q || a.textContent.toLowerCase().includes(q);
          a.style.display = hit ? "" : "none";
          if (hit) shown++;
        });
        part.style.display = shown ? "" : "none";
        if (q) part.open = shown > 0;
      });
    });
  }

  /* ---------------------------------------------------------- mobile sidebar */
  const sidebar = $(".sidebar");
  const burger = $(".burger");
  let backdrop = null;
  function closeSidebar() {
    if (sidebar) sidebar.classList.remove("open");
    if (backdrop) backdrop.remove();
    backdrop = null;
  }
  if (burger && sidebar) {
    const setOpen = (open) => {
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      if (!open) closeSidebar();
    };
    burger.addEventListener("click", () => {
      if (sidebar.classList.contains("open")) return setOpen(false);
      sidebar.classList.add("open");
      burger.setAttribute("aria-expanded", "true");
      backdrop = document.createElement("div");
      backdrop.style.cssText = "position:fixed;inset:0;top:var(--nav-h);background:rgba(0,0,0,.55);z-index:80";
      backdrop.addEventListener("click", () => setOpen(false));
      document.body.appendChild(backdrop);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && sidebar.classList.contains("open")) setOpen(false);
    });
  }

  route();
})();
