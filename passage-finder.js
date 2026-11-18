(() => {
  'use strict';
  const get = id => document.getElementById(id);
  const form = get('passageForm');
  const input = get('passageQuery');
  const status = get('passageStatus');
  const result = get('passageResult');
  const examples = get('passageExamples');
  const aliases = new Map();
  const cache = new Map();
  let request = 0;

  function key(text) {
    return text.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function addBook(book) {
    for (const name of [book.name, book.id]) aliases.set(key(name), book);
  }

  function parse(text) {
    const parts = text.trim().match(/^((?:[1-3]\s*)?[a-z][a-z .'-]*?)\s*(\d{1,3})(?:\s*:\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?)?$/i);
    if (!parts) throw new Error('Enter a reference like John 4:14 or Matthew 5:3–12. Use one chapter at a time.');
    const book = aliases.get(key(parts[1]));
    if (!book) throw new Error('That book name wasn’t recognized. Try its full name, such as 1 Corinthians.');
    const chapter = Number(parts[2]);
    const first = parts[3] === undefined ? null : Number(parts[3]);
    const last = parts[4] === undefined ? first : Number(parts[4]);
    if (chapter < 1 || chapter > book.chapters) throw new Error(book.name + ' has ' + book.chapters + ' chapters.');
    if (first !== null && (first < 1 || last < first)) throw new Error('Enter positive verse numbers in reading order.');
    return {book, chapter, first, last};
  }

  async function loadKJV(book) {
    if (!cache.has(book)) {
      const pending = (async () => {
        const response = await fetch('/bible-data/KJV/' + book + '.json');
        if (!response.ok) throw new Error('Could not check that chapter. Please try again.');
        const {gzip} = await response.json();
        const bytes = Uint8Array.from(atob(gzip), char => char.charCodeAt(0));
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        return JSON.parse(await new Response(stream).text());
      })();
      cache.set(book, pending);
      pending.catch(() => cache.delete(book));
    }
    return cache.get(book);
  }

  function appendLink(list, text, href) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.textContent = text;
    link.href = href;
    item.append(link);
    list.append(item);
  }

  async function lookup(updateUrl) {
    const token = ++request;
    result.hidden = true;
    status.textContent = '';
    try {
      const {book, chapter, first, last} = parse(input.value);
      if (first !== null) {
        status.textContent = 'Checking the reference…';
        const data = await loadKJV(book.id);
        if (token !== request) return;
        const verses = data.chapters.find(row => row.chapter === chapter).verses;
        if (last > verses.at(-1).verse) throw new Error(book.name + ' ' + chapter + ' ends at verse ' + verses.at(-1).verse + ' in the KJV.');
      }
      const selection = first === null ? '' : ':' + first + (last > first ? '–' + last : '');
      const title = book.name + ' ' + chapter + selection;
      const returnPath = '/find-a-passage?' + new URLSearchParams({ref:title}) + '#passageResult';
      const bibleParams = new URLSearchParams({book:book.id, chapter, return:returnPath});
      const compareParams = new URLSearchParams({book:book.id, chapter});
      if (first !== null) {
        compareParams.set('from',first);
        compareParams.set('to',last);
        if (last > first) bibleParams.set('through',last);
      }
      get('passageTitle').textContent = title;
      get('passageBible').href = '/bible?' + bibleParams + (first !== null ? '#v' + first : '');
      get('passageCompare').href = '/compare?' + compareParams;

      const matches = get('passageSayings');
      matches.replaceChildren();
      const sorted = Object.entries(window.REVIEWED_PASSAGES || {}).flatMap(([key,ranges]) =>
        ranges.filter(([name,ch,from,to]) => name === book.name && ch === chapter &&
          (first === null || (from <= last && to >= first))
        ).map(([, , from, to]) => ({key,from,to}))
      ).sort((a,b) => a.from-b.from);
      const seen = new Set();
      for (const {key,from,to} of sorted) {
        if (seen.has(key)) continue;
        seen.add(key);
        const range = chapter + ':' + from + (to>from?'-'+to:'');
        const numbered = /^\d+$/.test(key);
        const title = numbered ? 'Saying '+key : 'Passage excerpt';
        const anchor = numbered ? 'saying-'+key : key;
        appendLink(matches,title+' · '+book.name+' '+range,'/?saying='+encodeURIComponent(key)+'#'+anchor);
      }
      get('passageMatchNote').textContent = seen.size
        ? 'These entries have reviewed references that overlap this passage. Open the chapter to see the complete text.'
        : 'No reviewed sayings are linked to this selection yet. The full Bible chapter is available above.';
      status.textContent = '';
      result.hidden = false;
      if (updateUrl) {
        history.pushState(null,'',returnPath);
        get('passageTitle').focus();
      } else if (location.hash === '#passageResult') {
        result.scrollIntoView({block:'start'});
      }
    } catch (error) {
      if (token === request) status.textContent = error.message || 'Could not find that passage.';
    }
  }

  function readAddress() {
    input.value = new URLSearchParams(location.search).get('ref') || '';
    if (input.value) lookup(false);
    else {
      ++request;
      result.hidden = true;
      status.textContent = '';
    }
  }

  fetch('/bible-data/catalog.json').then(response => {
    if (!response.ok) throw new Error('Catalog unavailable');
    return response.json();
  }).then(data => {
    data.books.forEach(addBook);
    const short = {gen:'genesis',ps:'psalms',psalm:'psalms',matt:'matthew',mt:'matthew',mk:'mark',lk:'luke',jn:'john',
      jhn:'john',rom:'romans','1cor':'1-corinthians','2cor':'2-corinthians','1jn':'1-john','2jn':'2-john','3jn':'3-john',rev:'revelation'};
    for (const [name,id] of Object.entries(short)) {
      aliases.set(name, aliases.get(key(id)));
    }
    form.querySelector('fieldset').disabled = false;
    form.addEventListener('submit', event => {
      event.preventDefault();
      lookup(true);
    });
    examples.querySelectorAll('a[data-reference]').forEach(link=>link.addEventListener('click', event=>{
      if(event.button!==0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
      event.preventDefault();
      input.value = link.dataset.reference;
      lookup(true);
    }));
    addEventListener('popstate', readAddress);
    readAddress();
  }).catch(() => {status.textContent = 'The lookup is unavailable. Pick a book and chapter in the Bible reader or use an example below.';});
})();
