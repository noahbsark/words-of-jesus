# Every Word of Jesus — Chronological KJV

Static, mobile-first GitHub Pages site for **https://everywordofjesus.com**.

## Target repository
`noahbsark/words-of-jesus`

## Deploy on GitHub Pages
1. Put the files in this directory at the root of the repository's `main` branch.
2. GitHub → Settings → Pages → deploy from `main` / root.
3. The included `CNAME` targets `everywordofjesus.com`.
4. Point the Cloudflare DNS records to GitHub Pages and enable HTTPS after GitHub verifies the domain.

## AdSense
Ad containers stay hidden until valid IDs are configured, so visitors never see fake ad placeholders. After AdSense is ready, edit `config.js` with the publisher ID and slot IDs for `hero`, `inContent`, and `footer`. Replace `ads.txt` with the exact line Google provides.

## SEO / launch files
- `CNAME`
- `robots.txt`
- `sitemap.xml`
- canonical and Open Graph URL metadata
- About, Privacy, Terms, and Contact pages

## Local preview
Run `python3 -m http.server` in this folder and open `http://localhost:8000`.


## Robust rendering
The complete sayings are pre-rendered into `index.html`, so the reader also works when `index.html` is opened directly from disk. JavaScript is progressive enhancement only.


## Study UX upgrade
- Visible normalized event-passage references
- On-demand KJV context from bible-api.com (no API key; public-domain KJV)
- Verse-level text matching inside the listed event passages
- 486 focused reading pages under `/read/<entry>/` for numbered Gospel speaking turns and corresponding numbered entries
- Nearby sayings from the same event
- Optional KJV vocabulary helper
- Collapsible timeline groups

The site remains readable without the external context service: quotations and event references are statically embedded. Context is progressive enhancement only.

- Corrects an earlier grouping bug by separating the undated Hebrews quotations from Revelation 22.
