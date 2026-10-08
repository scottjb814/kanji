// Private proxy for one thing: the なりたち paragraph of a Kanjipedia entry.
//
//   GET /kp?c=牛        with   Authorization: Bearer <KP_TOKEN>
//
// Nothing is stored or cached. Each request makes two live requests to
// kanjipedia.jp (a search, then the entry page) and returns only the
// なりたち text, its 出典 line and the entry URL. It refuses any request that
// lacks the token, and answers browsers only for ALLOWED_ORIGIN.
//
// Settings (see wrangler.toml / README.md):
//   KP_TOKEN        secret   long random string; the page sends it as a bearer token
//   ALLOWED_ORIGIN  var      https://scottjb814.github.io

const UA = "KanjiLookupPersonal/1.0 (personal, single user; https://github.com/scottjb814/kanji)";
const KP = "https://www.kanjipedia.jp";

const json = (obj, status, origin) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...cors(origin),
    },
  });

function cors(origin) {
  return origin
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-headers": "authorization",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-max-age": "600",
        vary: "origin",
      }
    : {};
}

// Constant-time comparison, so response time doesn't leak the token.
function same(a, b) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] || 0) ^ (y[i] || 0);
  return d === 0;
}

const decode = s =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => {
    e = e.toLowerCase();
    if (e[0] === "#") {
      const n = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
    }
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[e];
  });

// Parse only the tiny subset of HTML that we actually need. Cloudflare Workers
// do not offer a DOMParser, and Kanjipedia does not have a documented API.
// Always require an exact headword match before following a search result.
const textOnly = html => decode(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
const normalized = c => c.normalize("NFC");

export function findExactEntry(html, char) {
  const wanted = normalized(char);
  const anchors = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let match;
  while ((match = anchors.exec(html))) {
    const href = match[1].match(/\bhref\s*=\s*(["'])(\/kanji\/[0-9]+)\1/i);
    if (!href) continue;
    // A prefix search can return a completely different headword first.
    // Compare the visible anchor text instead of trusting result order.
    if (normalized(textOnly(match[2])) === wanted) return KP + href[2];
  }
  return null;
}

export function entryHeadword(html) {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  return match ? normalized(textOnly(match[1]).split(/[|｜]/)[0].trim()) : null;
}

// The paragraph is text plus occasional images for non-Unicode glyphs.
// Never pass through HTML from the third-party site to our browser.
export function parseNaritachi(html) {
  const open = /<li\b[^>]*\bclass\s*=\s*(["'])(?:(?!\1)[\s\S])*?\bnaritachi\b(?:(?!\1)[\s\S])*?\1[^>]*>/i.exec(html);
  if (!open) return null;
  const end = html.indexOf("</li>", open.index + open[0].length);
  if (end === -1) return null;
  const block = html.slice(open.index + open[0].length, end);
  const src = block.match(/<div\b[^>]*\bclass\s*=\s*(["'])[^"']*\bhArea\b[^"']*\1[^>]*>[\s\S]*?<p\b[^>]*>([\s\S]*?)<\/p>/i);
  const body = block.match(/<\/div>\s*<div\b[^>]*>\s*<p\b[^>]*>([\s\S]*?)<\/p>/i);
  if (!body) return null;
  const parts = [];
  const re = /<img\b[^>]*>|<[^>]+>|([^<]+)/gi;
  let m;
  while ((m = re.exec(body[1]))) {
    if (/^<img\b/i.test(m[0])) {
      const attr = m[0].match(/\bsrc\s*=\s*(["'])(\/common\/images\/naritachi\/[A-Za-z0-9_.-]+)\1/i);
      if (attr) parts.push({ img: KP + attr[2] });
    } else if (m[1] !== undefined) {
      const txt = decode(m[1]).replace(/\s+/g, " ");
      if (txt) {
        const prev = parts[parts.length - 1];
        if (prev && prev.t !== undefined) prev.t += txt;
        else parts.push({ t: txt });
      }
    }
  }
  while (parts.length && parts[0].t !== undefined && !parts[0].t.trim()) parts.shift();
  while (parts.length && parts.at(-1).t !== undefined && !parts.at(-1).t.trim()) parts.pop();
  if (parts[0]?.t !== undefined) parts[0].t = parts[0].t.trimStart();
  if (parts.at(-1)?.t !== undefined) parts.at(-1).t = parts.at(-1).t.trimEnd();
  return parts.length ? { source: src ? textOnly(src[2]) : "", parts } : null;
}

const REQUEST_TIMEOUT_MS = 10000;

async function get(url) {
  let r;
  try {
    r = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html", "accept-language": "ja" },
      cf: { cacheTtl: 0, cacheEverything: false },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const timeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    throw Object.assign(new Error(timeout ? "timeout" : "upstream"), { kind: timeout ? "timeout" : "upstream" });
  }
  if (!r.ok) throw Object.assign(new Error("upstream"), { kind: "upstream" });
  try {
    return await r.text();
  } catch {
    throw Object.assign(new Error("upstream"), { kind: "upstream" });
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get("origin");
    const okOrigin = origin && origin === env.ALLOWED_ORIGIN ? origin : null;

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { "cache-control": "no-store", ...cors(okOrigin) } });
    }
    if (url.pathname !== "/kp" || req.method !== "GET") return json({ error: "not found" }, 404, okOrigin);
    // A browser from any other origin gets nothing, token or not.
    if (origin && !okOrigin) return json({ error: "forbidden" }, 403, null);

    const auth = req.headers.get("authorization") || "";
    const tok = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!env.KP_TOKEN || !same(tok, env.KP_TOKEN)) return json({ error: "unauthorized" }, 401, okOrigin);

    const c = url.searchParams.get("c") || "";
    const cps = Array.from(c);
    if (cps.length !== 1 || !/^\p{Script=Han}$/u.test(c)) return json({ error: "give one kanji in c" }, 400, okOrigin);

    try {
      const q = encodeURIComponent(c);
      const search = await get(KP + "/search?k=" + q + "&kt=1&sk=leftHand");
      const entryUrl = findExactEntry(search, c);
      if (!entryUrl) {
        // If a page claims results but has no recognizable entries, do not
        // confuse an upstream markup change with "this kanji does not exist".
        if (/漢字一字\s*[：:]\s*[1-9]/.test(textOnly(search)) &&
            !/<a\b[^>]*\bhref\s*=\s*["']\/kanji\/[0-9]+["']/i.test(search)) {
          return json({ error: "search_format" }, 502, okOrigin);
        }
        return json({ found: false, char: c }, 200, okOrigin);
      }
      const page = await get(entryUrl);
      const shown = entryHeadword(page);
      // Fail closed: a redirect or bad search result must never be attributed
      // to another character (traditional/modern forms can have distinct URLs).
      if (!shown || shown !== normalized(c)) {
        return json({ error: "entry_mismatch" }, 502, okOrigin);
      }
      const naritachi = parseNaritachi(page);
      if (!naritachi && /<li\b[^>]*\bnaritachi\b/i.test(page)) {
        return json({ error: "parse" }, 502, okOrigin);
      }
      return json({ found: true, char: c, shown, url: entryUrl, naritachi }, 200, okOrigin);
    } catch (err) {
      const kind = err?.kind === "timeout" ? "timeout" : "upstream";
      return json({ error: kind }, kind === "timeout" ? 504 : 502, okOrigin);
    }
  },
};
