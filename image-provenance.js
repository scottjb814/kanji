/* Source metadata is text, never executable upstream HTML. No historical
 * dating or photographic/tracing classification is inferred from a filename. */
((scope) => {
  "use strict";
  const HOST = /^(commons\.wikimedia\.org|(?:en|ja|zh)\.(?:wiktionary|wikipedia)\.org)$/;
  const safeUrl = value => {
    try { const u = new URL(value); return u.protocol === "https:" ? u.href : null; }
    catch { return null; }
  };
  const fileUrl = file => file && HOST.test(file.host)
    ? "https://" + file.host + "/wiki/" + encodeURIComponent(file.title.replace(/ /g, "_")) : null;
  function plain(value) {
    const doc = new DOMParser().parseFromString(String(value || ""), "text/html");
    doc.querySelectorAll("script,style").forEach(n => n.remove());
    return doc.body.textContent.replace(/\s+/g, " ").trim();
  }
  function metadata(page, checkedAt) {
    const info = page?.imageinfo?.[0];
    if (!info) return null;
    const m = info.extmetadata || {};
    const text = key => plain(m[key]?.value);
    return {
      title: page.title, hostUrl: safeUrl(info.descriptionurl), original: safeUrl(info.url),
      creator: text("Artist"), credit: text("Credit"), license: text("LicenseShortName"),
      licenseUrl: safeUrl(m.LicenseUrl?.value), source: text("Source"), description: text("ImageDescription"),
      digitalTimestamp: info.timestamp || null, checkedAt,
    };
  }
  function createResolver(apiGet) {
    const cache = new Map(), pending = new Map();
    let scheduled = false;
    async function flush() {
      scheduled = false;
      const groups = [...pending]; pending.clear();
      await Promise.all(groups.map(async ([host, jobs]) => {
        for (let start = 0; start < jobs.length; start += 50) {
          const batch = jobs.slice(start, start + 50);
          try {
            const response = await apiGet(host, {
              action: "query", titles: batch.map(j => j.file.title).join("|"), prop: "imageinfo", redirects: "1",
              iiprop: "url|timestamp|extmetadata", iiextmetadatafilter: "Artist|Credit|LicenseShortName|LicenseUrl|Source|ImageDescription"
            });
            const checkedAt = new Date().toISOString();
            const normalize = t => t.replace(/_/g, " ").normalize("NFC");
            const pages = new Map(Object.values(response.query?.pages || {}).map(p => [normalize(p.title), p]));
            const aliases = new Map([...(response.query?.normalized || []), ...(response.query?.redirects || [])]
              .map(r => [normalize(r.from), normalize(r.to)]));
            for (const job of batch) {
              let title = normalize(job.file.title); const seen = new Set();
              while (aliases.has(title) && !seen.has(title)) { seen.add(title); title = aliases.get(title); }
              job.resolve(metadata(pages.get(title), checkedAt));
            }
          } catch (error) {
            for (const job of batch) { cache.delete(job.key); job.reject(error); }
          }
        }
      }));
    }
    return file => {
      if (!fileUrl(file)) return Promise.resolve(null);
      const key = file.host + "|" + file.title;
      if (!cache.has(key)) {
        cache.set(key, new Promise((resolve, reject) => {
          const jobs = pending.get(file.host) || [];
          jobs.push({ file, key, resolve, reject }); pending.set(file.host, jobs);
        }));
        if (!scheduled) { scheduled = true; Promise.resolve().then(flush); }
      }
      return cache.get(key);
    };
  }
  function sourceUrl(source, character, revision = false) {
    const host = /^(en|ja|zh)$/.test(source.edition) ? source.edition + ".wiktionary.org" : null;
    if (!host) return null;
    const anchor = source.anchor ? "#" + encodeURIComponent(source.anchor) : "";
    return revision && Number.isSafeInteger(source.revision) && source.revision > 0
      ? "https://" + host + "/w/index.php?oldid=" + source.revision + anchor
      : "https://" + host + "/wiki/" + encodeURIComponent(source.page || character) + anchor;
  }
  function modificationText(dark) {
    return "Resized to fit the card. " + (dark ? "Colors inverted for dark mode." : "Colors unchanged.") + " Original file is linked separately.";
  }
  function attribution(item, info, character, dark) {
    const lines = [info?.title || item.file?.title || "Historical-form image for " + character];
    lines.push("Hosting file: " + (info?.hostUrl || fileUrl(item.file) || "Not resolved"));
    const original = info?.original || (item.identity?.startsWith("URL:") ? safeUrl(item.identity.slice(4)) : null);
    if (original) lines.push("Original digital image: " + original);
    lines.push("Digital image creator: " + (info?.creator || "Not identified in the retrieved metadata"));
    if (info?.credit) lines.push("Credit: " + info.credit);
    lines.push("License reported by host: " + (info?.license || "Reuse information not verified") + (info?.licenseUrl ? " — " + info.licenseUrl : ""));
    if (info?.source) lines.push("Uploader's source statement: " + info.source);
    if (info?.description) lines.push("Uploader's description: " + info.description);
    if (info?.digitalTimestamp) lines.push("Digital file version timestamp (not artifact date): " + info.digitalTimestamp);
    if (info?.checkedAt) lines.push("File metadata retrieved: " + info.checkedAt);
    for (const source of item.sources) {
      lines.push("Found in: " + sourceUrl(source, character));
      if (source.revision) lines.push("Wiktionary revision: " + sourceUrl(source, character, true));
      if (source.checkedAt) lines.push("Entry retrieved: " + source.checkedAt);
    }
    lines.push("Classification supplied by source table: " + (item.context || "Unclassified"));
    lines.push("Image type (photograph, tracing, transcription, or rendering): not independently verified. See uploader's description.");
    lines.push(modificationText(dark));
    return lines.join("\n");
  }
  function details(item, character, { el, resolve, isDark, clipboard }) {
    const status = el("p", { class: "hg-attribution", text: "Reuse information not verified" });
    const body = el("div", { class: "hg-detail-body" });
    const panel = el("details", { class: "hg-details" }, el("summary", { text: "Image details" }), body);
    let info = null, loading = false, failed = false;
    const link = (label, href) => href ? el("a", { href, target: "_blank", rel: "noopener", text: label }) : null;
    const field = (label, value) => el("p", {}, el("strong", { text: label + ": " }), value || "Not identified in retrieved metadata");
    const modifications = el("p");
    const updateModifications = () => { modifications.textContent = modificationText(isDark()); };
    const feedback = el("p", { role: "status", class: "hg-copy-status" });
    const copy = el("button", { type: "button", text: "Copy attribution" });
    copy.addEventListener("click", async () => {
      try { await clipboard.writeText(attribution(item, info, character, isDark())); feedback.textContent = "Attribution copied."; }
      catch { feedback.textContent = "Could not copy. Select the details text to copy it manually."; }
    });
    function render() {
      body.replaceChildren(field("File", info?.title || item.file?.title || "Hosting file not resolved"));
      const hostLink = link("Hosting file & history", info?.hostUrl || fileUrl(item.file));
      if (hostLink) body.append(el("p", {}, hostLink));
      const originalLink = link("Original digital image", info?.original || (item.identity?.startsWith("URL:") ? safeUrl(item.identity.slice(4)) : null));
      if (originalLink) body.append(el("p", {}, originalLink));
      body.append(field("Digital image creator", info?.creator), field("Credit", info?.credit));
      body.append(field("License reported by host", info?.license || "Reuse information not verified"));
      const licenseLink = link("License terms", info?.licenseUrl);
      if (licenseLink) body.append(el("p", {}, licenseLink));
      body.append(field("Uploader’s source statement", info?.source), field("Uploader’s description", info?.description));
      body.append(el("p", { text: "Image type: not independently verified. The description may identify a photograph, tracing, transcription, or modern rendering." }));
      if (info?.digitalTimestamp) body.append(field("Digital file version timestamp (not artifact date)", info.digitalTimestamp));
      if (info?.checkedAt) body.append(field("File metadata retrieved", info.checkedAt));
      for (const source of item.sources) {
        const p = el("p", {}, link(source.edition.toUpperCase() + " source entry", sourceUrl(source, character)));
        const revision = source.revision ? link("Referenced revision", sourceUrl(source, character, true)) : null;
        if (revision) p.append(" · ", revision);
        if (source.checkedAt) p.append(" · Retrieved " + source.checkedAt);
        if (!source.revision) p.append(" · Revision not recorded");
        body.append(p);
      }
      body.append(field("Source table classification", item.context || "Unclassified"));
      body.append(el("p", { text: "Compilation dates and digital-file timestamps do not establish the date of an ancient inscription. Creator and license information concerns the digital image." }));
      updateModifications(); body.append(modifications);
      if (failed) {
        const retry = el("button", { type: "button", text: "Retry credits" });
        retry.addEventListener("click", load); body.append(retry);
      }
      body.append(copy, feedback);
    }
    async function load() {
      if (loading) return;
      loading = true; failed = false;
      status.textContent = "Checking image credits…";
      try {
        info = await resolve(item.file);
        status.textContent = info?.license ? "Credits available · " + info.license : "Reuse information not verified";
      } catch {
        failed = true; status.textContent = "Credits unavailable · reuse information not verified";
      } finally { loading = false; render(); }
    }
    panel.addEventListener("toggle", () => { if (panel.open) updateModifications(); });
    render();
    // The resolver batches all visible images by host and caches identical files.
    load();
    return [status, panel];
  }
  scope.KanjiImageProvenance = Object.freeze({ fileUrl, metadata, createResolver, sourceUrl, attribution, details, modificationText });
})(globalThis);
