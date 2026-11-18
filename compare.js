(() => {
  'use strict';
  const find = id => document.getElementById(id);
  const form = find('compareForm');
  const columns = find('comparison');
  const status = find('compareStatus');
  const bookField = find('compareBook');
  const chapterField = find('compareChapter');
  const firstField = find('compareFirst');
  const lastField = find('compareLast');
  const editionFields = [find('compareLeft'), find('compareRight')];
  const cache = new Map();
  let catalog;
  let request = 0;

  function selectedBook() {
    return catalog.books.find(book => book.id === bookField.value);
  }

  function setChapters(chapter) {
    const count = selectedBook().chapters;
    chapterField.replaceChildren(...Array.from({length: count}, (_, i) => new Option(i + 1, i + 1)));
    chapterField.value = Math.max(1, Math.min(count, chapter));
  }

  function readLocation() {
    const query = new URLSearchParams(location.search);
    bookField.value = catalog.books.some(book => book.id === query.get('book')) ? query.get('book') : 'matthew';
    const chapter = Number(query.get('chapter'));
    setChapters(Number.isInteger(chapter) && chapter > 0 ? chapter : 6);
    const defaults = query.has('book') ? ['', ''] : ['9', '13'];
    for (const [i, field] of [firstField, lastField].entries()) {
      const value = query.get(i === 0 ? 'from' : 'to');
      field.value = /^[1-9]\d{0,2}$/.test(value || '') ? value : defaults[i];
    }
    for (const [i, field] of editionFields.entries()) {
      const code = query.get(i === 0 ? 'left' : 'right');
      field.value = Object.hasOwn(catalog.versions, code) ? code : ['KJV', 'BSB'][i];
    }
  }

  async function fetchBook(code, id) {
    const key = code + '/' + id;
    if (!cache.has(key)) {
      const pending = (async () => {
        const response = await fetch('/bible-data/' + key + '.json');
        if (!response.ok) throw new Error('Missing Bible data');
        const {gzip} = await response.json();
        const bytes = Uint8Array.from(atob(gzip), character => character.charCodeAt(0));
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        return JSON.parse(await new Response(stream).text());
      })();
      cache.set(key, pending);
      pending.catch(() => cache.delete(key));
    }
    return cache.get(key);
  }

  async function render(updateUrl = false) {
    const token = ++request;
    const book = selectedBook();
    const chapter = Number(chapterField.value);
    const first = firstField.valueAsNumber || 1;
    const last = lastField.valueAsNumber || Infinity;
    const editions = editionFields.map(field => field.value);
    form.setAttribute('aria-busy', 'false');
    if (last < first) {
      status.textContent = 'The last verse must come at or after the first.';
      return;
    }
    if (editions[0] === editions[1]) {
      status.textContent = 'Choose two different translations to compare.';
      return;
    }
    const query = new URLSearchParams({book: book.id, chapter, left: editions[0], right: editions[1]});
    if (firstField.value) query.set('from', first);
    if (lastField.value) query.set('to', last);

    form.setAttribute('aria-busy', 'true');
    status.textContent = 'Loading passages…';
    try {
      const loaded = await Promise.all(editions.map(code => fetchBook(code, book.id)));
      if (token !== request) return;
      const readings = loaded.map(data => new Map(data.chapters.find(row => row.chapter === chapter).verses.map(v => [v.verse, v.text])));
      const verseNumbers = [...new Set(readings.flatMap(reading => [...reading.keys()]))].sort((a, b) => a - b);
      const selected = verseNumbers.filter(v => v >= first && v <= last);
      if (!selected.length) {
        status.textContent = 'No verses in that range. This chapter ends at verse ' + verseNumbers.at(-1) + '.';
        return;
      }

      const result = document.createDocumentFragment();
      const header = document.createElement('div');
      header.className = 'compare-row compare-head';
      for (const code of editions) {
        const element = document.createElement('h2');
        element.textContent = catalog.versions[code];
        header.append(element);
      }
      result.append(header);

      for (const verse of selected) {
        const row = document.createElement('div');
        row.className = 'compare-row';
        for (const [i, reading] of readings.entries()) {
          const passage = document.createElement('p');
          const number = document.createElement('strong');
          number.className = 'compare-number';
          number.textContent = verse;
          passage.setAttribute('aria-label', editions[i] + ', verse ' + verse);
          passage.append(number, document.createTextNode(reading.get(verse) || 'This edition skips this verse number.'));
          row.append(passage);
        }
        result.append(row);
      }

      columns.replaceChildren(result);
      const label = selected[0] === selected.at(-1) ? selected[0] : selected[0] + '–' + selected.at(-1);
      find('compareTitle').textContent = book.name + ' ' + chapter + ':' + label;
      for (const [i, code] of editions.entries()) {
        const link = find('compareContext' + i);
        const params = new URLSearchParams({book: book.id, chapter, version: code, return: '/compare?' + query + '#compareTitle'});
        if (selected.length > 1) params.set('through', selected.at(-1));
        link.href = '/bible?' + params + '#v' + selected[0];
        link.textContent = 'Open chapter in ' + code;
      }
      if (updateUrl) history.pushState(null, '', '/compare?' + query);
      status.textContent = '';
    } catch (_) {
      if (token === request) status.textContent = 'Couldn’t load that comparison. Try again or open the Bible reader.';
    } finally {
      if (token === request) form.setAttribute('aria-busy', 'false');
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    render(true);
  });
  bookField.addEventListener('change', () => {
    setChapters(1);
    firstField.value = '';
    lastField.value = '';
  });
  chapterField.addEventListener('change', () => {
    firstField.value = '';
    lastField.value = '';
  });

  fetch('/bible-data/catalog.json').then(response => {
    if (!response.ok) throw new Error('Missing Bible catalog');
    return response.json();
  }).then(data => {
    catalog = data;
    bookField.replaceChildren(...data.books.map(book => new Option(book.name, book.id)));
    for (const field of editionFields) field.replaceChildren(...Object.entries(data.versions).map(([key, label]) => new Option(label, key)));
    readLocation();
    find('compareInputs').disabled = false;
    render();
    addEventListener('popstate', () => {readLocation();render();});
  }).catch(() => {status.textContent = 'The interactive comparison is unavailable. You can still read the example below.';});
})();
