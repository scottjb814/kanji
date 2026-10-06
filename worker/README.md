# Kanjipedia proxy (private)

One Cloudflare Worker that fetches the なりたち paragraph of a single Kanjipedia
entry on request, for one person. It stores nothing, caches nothing, and answers
only requests that carry a secret token from the allowed origin.

## Set up (Cloudflare dashboard, no command line)

1. Workers & Pages > Create > Worker. Name it `kanji-kp`, deploy the starter, then Edit code.
2. Replace the code with the contents of `worker.js` and deploy.
3. Settings > Variables and Secrets:
   - `ALLOWED_ORIGIN` (Text) = `https://scottjb814.github.io`
   - `KP_TOKEN` (Secret) = a long random string (32+ characters; a password manager will generate one)
4. Check: opening `https://kanji-kp.<your-subdomain>.workers.dev/kp?c=牛` in a browser should show `{"error":"unauthorized"}`.
5. On the page, open any character, find the Kanjipedia card, paste the Worker address and the token, press Connect.

## Behaviour (tested against saved Kanjipedia pages)

- Requests without the token get 401 and cause no request to Kanjipedia.
- Browsers from any other origin get 403.
- One kanji per request; anything else gets 400.
- Two live requests to kanjipedia.jp per lookup (search, then entry page); response is `Cache-Control: no-store`.
- Returns only: the なりたち text (with any glyph-image URLs), its 出典 line, and the entry URL.

To switch it off: set `KP_INLINE = false` in `index.html`, and delete the Worker.
