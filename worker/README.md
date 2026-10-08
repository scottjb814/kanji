# Kanjipedia proxy (private)

This optional Cloudflare Worker retrieves one なりたち entry on demand and
returns structured text plus approved glyph-image URLs. GitHub Pages stays
unchanged. The Worker requires a secret token and does not persist or cache
dictionary content.

## Set up or update

1. In Cloudflare Workers, create or open `kanji-kp`.
2. Copy `worker/worker.js` into the Worker editor and deploy that code. A GitHub
   commit **does not** automatically deploy the Cloudflare Worker.
3. In Cloudflare's settings, configure:
   - `ALLOWED_ORIGIN` (text): `https://scottjb814.github.io`
   - `KP_TOKEN` (secret): a random token of at least 32 characters.
4. In the site, provide your Worker URL and token when prompted. They remain
   in your browser's localStorage; never commit or post the token.
5. Without sending a token, visiting the Worker endpoint should return
   HTTP 401. This is only a basic authentication check, not a complete test.

For Wrangler-based deployment, `worker/wrangler.toml` is included, but the
GitHub Pages workflow does not deploy this Worker.

## Matching and safe failures

- Prefix-search results are checked for an **exact visible-character match**.
  The first search link is never trusted without verification.
- The entry's own title must match the requested character. A mismatch returns
  HTTP 502 with `entry_mismatch`; no other character's explanation is shown.
- The parser keeps only text and images under Kanjipedia's
  `/common/images/naritachi/` path. All other markup is discarded.
- Missing なりたち returns a successful result with `naritachi: null`.
  A malformed recognizable なりたち block returns HTTP 502 with `parse`.
- Upstream errors return HTTP 502 (`upstream`) and timeouts return HTTP 504
  (`timeout`), without echoing upstream HTML or internal exception details.
- Origin checks restrict browser use; the bearer token supplies authentication
  because non-browser clients can forge the Origin header.
- Nothing is cached or stored on the server. Requests are made only after
  successful authentication and one-character input validation.

## Testing

Run `node --test tests/worker.test.mjs` locally. GitHub Actions runs these
network-free regression tests on pull requests.

The fixtures are synthetic and include no copied dictionary entries. They
cover search-result ordering, lookalike characters, parser layout variants,
authentication, timeouts, malformed responses and misattributed results.
Because Kanjipedia has no documented API, successful fixture tests **do not**
guarantee that current live pages still use compatible HTML. Smoke-test a few
lookup characters manually after deploying a Worker update.

To disable inline access, set `KP_INLINE = false` in `index.html` and
remove the Worker after confirming it is no longer needed.
