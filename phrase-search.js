(() => {
  'use strict';

  const route = '/search-bible-phrases';
  const editions = ['BSB', 'KJV', 'ASV', 'YLT'];
  const cache = new Map();
  const get = id => document.getElementById(id);
  const form = get('phraseForm');
  const input = get('phraseQuery');
  const edition = get('phraseEdition');
  const status = get('phraseStatus');
  const results = get('phraseResults');
  const heading = get('phraseResultsTitle');
  const list = get('phraseMatches');
  const limit = 24;
  let request = 0;

  function normalize(text) {
    return text.normalize('NFKC').toLowerCase()
      .replace(/['’]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }

  function buildSegments(records) {
    const segments = [];
    for (const [name, book, chapter, verses] of records) {
      let segment;
      let previous = 0;
      for (const [verse, text] of verses) {
        if (!segment || verse !== previous + 1) {
          segment = {name, book, chapter, text: ' ', rows: []};
          segments.push(segment);
        }
        const start = segment.text.length;
        const words = normalize(text);
        segment.text += words + ' ';
        segment.rows.push({verse, text, start, end: start + words.length});
        previous = verse;
      }
    }
    return segments;
  }

  function load(code) {
    if (!cache.has(code)) {
      const pending = (async () => {
        const response = await fetch('/bible-data/phrase-search-v1/' + code + '.json');
        if (!response.ok) throw new Error('Could not load ' + code);
        const {gzip} = await response.json();
        const bytes = Uint8Array.from(atob(gzip), char => char.charCodeAt(0));
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        const records = JSON.parse(await new Response(stream).text());
        return buildSegments(records);
      })();
      cache.set(code, pending);
      pending.catch(() => cache.delete(code));
    }
    return cache.get(code);
  }

  function addMatch(grouped, segment, code, beginning, end, missing = 0, width = 0) {
    const {name, book, chapter, rows} = segment;
    const excerpt = rows.filter(row => row.start < end && row.end > beginning);
    const first = excerpt[0].verse;
    const last = excerpt.at(-1).verse;
    const key = [book, chapter, first, last].join(':');
    let match = grouped.get(key);
    if (!match) {
      match = {name, book, chapter, first, last, editions: new Map(), missing, width};
      grouped.set(key, match);
    }
    if (missing < match.missing || (missing === match.missing && width < match.width)) {
      match.missing = missing;
      match.width = width;
    }
    match.editions.set(code, excerpt.map(row => row.text).join(' '));
  }

  function collect(sources, codes, phrase) {
    const grouped = new Map();
    const needle = ' ' + phrase + ' ';
    sources.forEach((segments, index) => {
      for (const segment of segments) {
        const {text} = segment;
        for (let match = text.indexOf(needle); match !== -1; match = text.indexOf(needle, match + 1)) {
          addMatch(grouped, segment, codes[index], match + 1, match + 1 + phrase.length);
        }
      }
    });
    return [...grouped.values()];
  }

  const commonWords = new Set(('about all and are but can did doe for from had has have him his how into its let may ' +
    'not now one our out shall she some than that the their them then there these they this those thou ' +
    'thy unto upon was were what when where which who whom will with would you your').split(' '));

  function suggestions(sources, codes, phrase) {
    const words = phrase.split(' ');
    const terms = new Set(words.filter(word => word.length >= 3 && !commonWords.has(word)));
    if (words.length < 3 || terms.size < 2) return [];
    const minimum = Math.max(2, Math.ceil(terms.size * .75), terms.size - 1);
    const maxWidth = Math.min(22, words.length + 4);
    const grouped = new Map();

    sources.forEach((segments, index) => {
      for (const segment of segments) {
        segment.tokens ??= [...segment.text.matchAll(/\S+/g)];
        const tokens = segment.tokens;
        for (let first = 0; first < tokens.length; first++) {
          if (!terms.has(tokens[first][0])) continue;
          const seen = new Set();
          let best;
          for (let last = first; last < Math.min(tokens.length, first + maxWidth); last++) {
            const token = tokens[last];
            if (!terms.has(token[0]) || seen.has(token[0])) continue;
            seen.add(token[0]);
            if (seen.size < minimum) continue;
            best = {end: token.index + token[0].length, missing: terms.size - seen.size, width: last - first + 1};
            if (best.missing === 0) break;
          }
          if (best) addMatch(grouped, segment, codes[index], tokens[first].index, best.end, best.missing, best.width);
        }
      }
    });
    return [...grouped.values()]
      .sort((a,b) => a.missing - b.missing || a.width - b.width)
      .slice(0, 6);
  }

  function element(tag, text) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function link(text, href) {
    const node = element('a', text);
    node.className = 'context-link';
    node.href = href;
    return node;
  }

  function card(match, returnPath, similar = false) {
    const {name, book, chapter, first, last} = match;
    const codeList = [...match.editions.keys()];
    const primary = codeList[0];
    const citation = name + ' ' + chapter + ':' + first + (last > first ? '–' + last : '');
    const item = element('article');
    item.className = 'verse-card';
    const actions = element('div');
    actions.className = 'context-links';

    const quote = element('blockquote', match.editions.get(primary));
    const versionNames = element('p', 'Shown in ' + primary +
      (similar ? ' · Similar wording in ' : ' · Matches in ') + codeList.join(', '));
    versionNames.className = 'resource-note';

    for (const code of codeList) {
      const params = new URLSearchParams({book, chapter, version: code, return: returnPath});
      if (last > first) params.set('through', last);
      actions.append(link('Read in ' + code, '/bible?' + params + '#v' + first));
    }

    const right = codeList[1] || (primary === 'KJV' ? 'BSB' : 'KJV');
    const compare = new URLSearchParams({book, chapter, from: first, to: last, left: primary, right});
    actions.append(link('Compare translations', '/compare?' + compare));
    item.append(element('h3', citation), quote, versionNames, actions);
    return item;
  }

  async function search(updateUrl) {
    const token = ++request;
    results.hidden = true;
    list.replaceChildren();
    const raw = input.value.trim();
    const phrase = normalize(raw);

    if (!raw && !updateUrl) {
      status.textContent = '';
      return;
    }
    if (phrase.length < 3 || raw.length > input.maxLength) {
      status.textContent = 'Enter a word or phrase between 3 and 120 characters.';
      return;
    }

    const params = new URLSearchParams({q: raw});
    if (edition.value !== 'all') params.set('version', edition.value);
    const returnPath = route + '?' + params + '#phraseResults';
    if (updateUrl && returnPath !== location.pathname + location.search + location.hash) {
      history.pushState(null, '', returnPath);
    }

    const codes = edition.value === 'all' ? editions : [edition.value];
    status.textContent = 'Searching the reviewed source passages…';
    try {
      const sources = await Promise.all(codes.map(load));
      if (token !== request) return;

      const matches = collect(sources, codes, phrase);
      heading.textContent = matches.length + (matches.length === 1 ? ' matching passage' : ' matching passages');
      if (matches.length) {
        list.replaceChildren(...matches.slice(0, limit).map(match => card(match, returnPath)));
        status.textContent = matches.length > limit ? 'Showing the first ' + limit + '. Use a longer phrase to narrow the results.' : '';
      } else {
        const nearby = suggestions(sources, codes, phrase);
        if (nearby.length) {
          heading.textContent = 'Similar wording';
          list.append(element('p', 'No exact phrase matched. These passages share several words with your search.'),
            ...nearby.map(match => card(match, returnPath, true)));
        } else {
          list.append(element('p', 'Try fewer words or choose all four translations.'));
        }
        const help = element('p');
        help.append(link('Check familiar sayings and their sources', '/did-jesus-say-that'));
        list.append(help);
        status.textContent = '';
      }
      results.hidden = false;
      if (updateUrl || location.hash === '#phraseResults') heading.focus();
    } catch (_) {
      if (token === request) status.textContent = 'The search data could not load. Try the search again.';
    }
  }

  function readUrl() {
    const params = new URLSearchParams(location.search);
    const version = params.get('version');
    input.value = (params.get('q') || '').slice(0, input.maxLength);
    edition.value = editions.includes(version) ? version : 'all';
    search(false);
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    search(true);
  });
  form.querySelector('fieldset').disabled = false;
  addEventListener('popstate', readUrl);
  readUrl();
})();
