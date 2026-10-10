/*
 * Historical-form discovery for Wiktionary HTML.
 * Plain browser script, intentionally independent of presentation and network
 * access; consumed by index.html and by Node regression tests.
 *
 * Each record retains a source, heading path, original table node, and file
 * identities.  Cross-edition deduplication is performed at *image* level,
 * never by assuming two different inscriptions are the same just because
 * they share the same script label.
 */
((scope) => {
  "use strict";
  const SCRIPT_LABEL = /oracle.bone|bronze inscription|seal script|ancient script|slip (?:and silk )?script|甲骨|金文|銅器|小篆|篆文|篆書|古文|楚簡|秦簡|隸書|隶书|六書通/i;
  const HISTORICAL_CAPTION = /historical forms|歷代字形|历代字形|字形演變|字形演变|古文字形/i;
  const ORIGIN_SECTION = /glyph origin|字源|字形|字形演變|字形演变|字形の変遷/i;
  const NON_HISTORICAL = /stroke order|筆順|笔顺|筆画順|書き順/i;

  function headingOf(node) {
    if (/^H[2-6]$/.test(node.tagName)) return node;
    if (node.classList?.contains("mw-heading"))
      return node.querySelector("h2,h3,h4,h5,h6");
    return null;
  }

  function fileReference(img, edition = "en") {
    const src = img.getAttribute("src") || img.getAttribute("data-src") || "";
    try {
      const url = new URL(src, "https://" + edition + ".wiktionary.org");
      if (/^(upload|thumb)\.wikimedia\.org$/.test(url.hostname)) {
        const bits = url.pathname.split("/");
        const project = bits[1], language = bits[2];
        const filename = bits[3] === "thumb" ? bits[6] : bits[5];
        const host = project === "wikipedia" && language === "commons" ? "commons.wikimedia.org"
          : /^(wikipedia|wiktionary)$/.test(project) && /^(en|ja|zh)$/.test(language) ? language + "." + project + ".org" : null;
        if (host && filename) return { host, title: "File:" + decodeURIComponent(filename).replace(/_/g, " ").normalize("NFC") };
      }
      const href = img.closest("a[href]")?.getAttribute("href");
      if (href) {
        const link = new URL(href, "https://" + edition + ".wiktionary.org");
        const match = decodeURIComponent(link.pathname).match(/^\/wiki\/(?:File:|Image:|文件:|檔案:|ファイル:)(.+)$/i);
        if (match && /^(commons\.wikimedia\.org|(?:en|ja|zh)\.(?:wiktionary|wikipedia)\.org)$/.test(link.hostname))
          return { host: link.hostname, title: "File:" + match[1].replace(/_/g, " ").normalize("NFC") };
      }
    } catch { /* Unknown/malformed file locations stay unresolved. */ }
    return null;
  }

  // A hosting-file label identifies the catalogue label, not an independently
  // established historical relationship. Never infer script or date from it.
  function fileCharacter(file) {
    return file?.title?.match(/^File:(\p{Script=Han})(?:[- _]|\.[a-z])/u)?.[1] || null;
  }

  function imageIdentity(img, edition = "en") {
    const reference = fileReference(img, edition);
    if (reference) return reference.host === "commons.wikimedia.org" ? reference.title : "WikiFile:" + reference.host + ":" + reference.title;
    const src = img.getAttribute("src") || img.getAttribute("data-src") || "";
    if (!src) return null;
    try {
      const url = new URL(src.startsWith("//") ? "https:" + src : src, "https://upload.wikimedia.org");
      if (/^(upload|thumb)\.wikimedia\.org$/.test(url.hostname)) {
        const bits = url.pathname.split("/");
        if (bits[1] === "wikipedia" && bits[2] === "commons") {
          const file = bits[3] === "thumb" ? bits[6] : bits[5];
          if (file) return "File:" + decodeURIComponent(file).replace(/_/g, " ").normalize("NFC");
        }
      }
      // Non-Commons images still have a stable identity if URLs agree.
      if (url.protocol === "https:") return "URL:" + url.href;
    } catch { /* Ignore incomplete/malformed image addresses. */ }
    return null;
  }

  function isHistoricalTable(table, path) {
    if (NON_HISTORICAL.test(path.join(" > "))) return false;
    if (table.matches("table.zh-glyph,table#jigen,#jigen table")) return true;
    const heading = path.join(" > ");
    const upper = table.querySelector("caption,th");
    const caption = upper?.textContent?.trim() || "";
    const text = table.textContent || "";
    if (HISTORICAL_CAPTION.test(caption)) return true;
    if (!ORIGIN_SECTION.test(heading)) return false;
    return !!table.querySelector("img") && SCRIPT_LABEL.test(text);
  }

  // Derive labels from the same logical table column as the image, not from
  // arbitrary headings elsewhere in a table (which could misdate the glyph).
  function imageContext(img, table) {
    const caption = img.closest(".gallerybox")?.querySelector(".gallerytext")?.textContent?.trim() || "";
    const cell = img.closest("td,th");
    const imageRow = cell?.closest("tr");
    if (!cell || !imageRow || !table.contains(imageRow)) return caption;

    const expanded = row => {
      const result = [];
      for (const c of row.children) {
        if (!/^(TD|TH)$/.test(c.tagName)) continue;
        const width = Math.min(24, Math.max(1, Number.parseInt(c.getAttribute("colspan") || "1", 10) || 1));
        for (let i = 0; i < width; i++) result.push(c);
      }
      return result;
    };
    const index = expanded(imageRow).indexOf(cell);
    const labels = [];
    for (const row of table.querySelectorAll("tr")) {
      if (row === imageRow) break;
      const sameColumn = expanded(row)[index];
      if (!sameColumn || sameColumn.tagName !== "TH") continue;
      const label = sameColumn.textContent.trim().replace(/\s+/g, " ");
      if (!label || label.length > 65 || HISTORICAL_CAPTION.test(label)) continue;
      if (!labels.includes(label)) labels.push(label);
    }
    if (caption && caption.length < 90) labels.push(caption);
    return labels.slice(-2).join(" · ");
  }

  function scriptGroup(context) {
    if (/oracle.bone|甲骨|甲骨文/i.test(context)) return "Oracle bone";
    if (/bronze|金文|金字|銅器|钟鼎/i.test(context)) return "Bronze";
    if (/slip|bamboo|silk|楚簡|秦簡|简帛|簡帛/i.test(context)) return "Bamboo and silk";
    if (/seal script|小篆|篆文|篆書|大篆/i.test(context)) return "Seal";
    if (/clerical|隸書|隶书/i.test(context)) return "Clerical";
    return "Other forms";
  }

  function collect(root, edition = "en") {
    if (!root) return [];
    const output = [], stack = [];
    const visited = new Set();
    for (let node = root.firstElementChild; node; node = node.nextElementSibling) {
      const heading = headingOf(node);
      if (heading) {
        const level = Number(heading.tagName.slice(1));
        while (stack.length && stack.at(-1).level >= level) stack.pop();
        stack.push({ level, text: heading.textContent.trim().replace(/\s+/g, " "), anchor: heading.id || null });
        continue;
      }
      const path = stack.map(s => s.text);
      const tables = node.matches("table") ? [node, ...node.querySelectorAll("table")] : [...node.querySelectorAll("table")];
      for (const table of tables) {
        if (visited.has(table) || !isHistoricalTable(table, path)) continue;
        visited.add(table);
        const images = [...table.querySelectorAll("img")]
          .map(img => ({ identity: imageIdentity(img, edition), file: fileReference(img, edition), img, context: imageContext(img, table) }))
          .filter(item => item.identity);
        // Empty tables aren't evidence of glyph images. Historical text-only
        // cells remain eligible for the old renderer, but not image dedup.
        if (!images.length && !table.textContent.trim()) continue;
        output.push({ edition, sections: [...path], sectionIds: stack.map(s => s.anchor), table, images });
      }
    }
    return output;
  }

  function merge(collections) {
    const byIdentity = new Map(), records = [];
    for (const record of collections.flat()) {
      records.push(record);
      for (const item of record.images) {
        let found = byIdentity.get(item.identity);
        if (!found) {
          found = { identity: item.identity, file: item.file, img: item.img, context: item.context, group: scriptGroup(item.context || ""), sources: [] };
          byIdentity.set(item.identity, found);
        }
        if (found.group === "Other forms" && scriptGroup(item.context || "") !== "Other forms") {
          found.context = item.context;
          found.group = scriptGroup(item.context);
        }
        const lastAnchor = (record.sectionIds || []).filter(Boolean).at(-1) || null;
        const source = { edition: record.edition, sections: [...record.sections], anchor: lastAnchor, page: record.page, revision: record.revision, checkedAt: record.checkedAt };
        if (!found.sources.some(s => s.edition === source.edition && s.page === source.page && s.sections.join("\u001f") === source.sections.join("\u001f"))) {
          found.sources.push(source);
        }
      }
    }
    return { records, images: [...byIdentity.values()] };
  }

  scope.KanjiHistoricalForms = Object.freeze({ collect, merge, imageIdentity, fileReference, fileCharacter, headingOf, imageContext, scriptGroup });
})(globalThis);

