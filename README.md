# Every Word of Jesus

Source for https://everywordofjesus.com. Static site, no application secrets.

## Cloudflare Pages

Connect `noahbsark/words-of-jesus`, production branch `main`, framework None,
no build command, output directory `/` (repository root). Add both the apex
and www domains in Pages > Custom domains. Verify the Pages preview before
replacing GitHub Pages DNS. Preserve mail/TXT records. Both hostnames must
have active HTTPS. Existing .html pages redirect automatically to clean URLs.

Do not disable GitHub Pages until the Cloudflare custom domain works. No new
site address or Search Console Change of Address is needed when the domain stays.

## Reader

486 KJV-based historical harmony excerpts are pre-rendered in index.html.
JavaScript adds filters, saved sayings, incremental display and context links.
The Bible reader offers KJV, BSB, ASV and YLT in all 66 books. It downloads only
the selected local compressed book, rather than calling an external verse API.
Modern browsers with DecompressionStream are supported; a Bible Gateway link
and an explicit retry/error state are available if a book cannot load.

The translation selector changes the context reader, not the historical harmony
excerpt. Full chapter text contains narration and other speakers. A matched
verse is a navigation hint, not automatic red-letter identification.

## Regenerate data

Download the unchanged JSON files KJV, BSB, ASV and YLT from Scrollmapper's
formats/json directory. Run `python scripts/build_reader.py --inputs PATH`.
Input hashes and verse totals are published in bible-data/provenance.json.
The source collection is source-data.json. Existing data-00.js through data-05.js
are retired. The root source data and generated local books are versioned.

Run `python scripts/check_site.py` and the JavaScript syntax checks before release.
Do not rerun one-off upgrade scripts from a scratch workspace as part of deployment.

## AdSense and privacy

ads.txt and the ownership meta tag use ca-pub-6136525087204092.
No ad placeholders or speculative ad slots are displayed. Before enabling
Google ad serving, configure the certified AdSense consent message for this
domain and check Auto Ads placements around reader controls. Do not send
religious searches, selected verses or saved items to advertising/analytics.
Google Analytics is disabled. Preferences and saved sayings remain local.

## Content

This is a useful reading tool with original study guidance, not a guarantee
of AdSense approval. Avoid publishing hundreds of duplicated quote pages.
Review source and attribution problems first; read /sources for current limits.
There is no scheduled content publisher in this repository. IndexNow notifies
changed public URLs; it does not publish articles or guarantee Google indexing.
