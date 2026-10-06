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

// The paragraph is text plus the odd <img> for a glyph that has no Unicode
// code point. Keep exactly those two things: {t: text} and {img: absolute url}.
export function parseNaritachi(html) {
  const li = html.match(/<li class="naritachi">([\s\S]*?)<\/li>/);
  if (!li) return null;
  const block = li[1];
  const src = block.match(/<div class="hArea">[\s\S]*?<p>([\s\S]*?)<\/p>/);
  const body = block.match(/<\/div>\s*<div>\s*<p>([\s\S]*?)<\/p>/);
  if (!body) return null;
  const parts = [];
  const re = /<img[^>]*?src="(\/common\/images\/naritachi\/[A-Za-z0-9_.-]+)"[^>]*>|<[^>]+>|([^<]+)/g;
  let m;
  while ((m = re.exec(body[1]))) {
    if (m[1]) parts.push({ img: KP + m[1] });
    else if (m[2] !== undefined) {
      const t = decode(m[2]).replace(/\s+/g, " ");
      if (t.trim() || (parts.length && t)) parts.push({ t });
    }
  }
  while (parts.length && parts[0].t !== undefined && !parts[0].t.trim()) parts.shift();
  const last = parts[parts.length - 1];
  if (last && last.t !== undefined) last.t = last.t.replace(/\s+$/, "");
  const first = parts[0];
  if (first && first.t !== undefined) first.t = first.t.replace(/^\s+/, "");
  const source = src ? decode(src[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim() : "";
  return parts.length ? { source, parts } : null;
}

async function get(url) {
  const r = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html", "accept-language": "ja" },
    cf: { cacheTtl: 0, cacheEverything: false },
  });
  if (!r.ok) throw Object.assign(new Error(`kanjipedia ${r.status}`), { upstream: r.status });
  return r.text();
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
      const search = await get(`${KP}/search?k=${q}&kt=1&sk=leftHand`);
      const hit = search.match(/href="(\/kanji\/\d+)"/);
      if (!hit) return json({ found: false, char: c }, 200, okOrigin);
      const entryUrl = KP + hit[1];
      const page = await get(entryUrl);
      const shown = (page.match(/<title>\s*(.*?)\s*[|｜]/s) || [])[1] || c;
      const n = parseNaritachi(page);
      if (!n) return json({ found: true, char: c, shown, url: entryUrl, naritachi: null }, 200, okOrigin);
      return json({ found: true, char: c, shown, url: entryUrl, naritachi: n }, 200, okOrigin);
    } catch (e) {
      return json({ error: "upstream", detail: e.upstream || String(e.message || e) }, 502, okOrigin);
    }
  },
};
