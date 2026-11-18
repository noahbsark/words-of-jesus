(() => {
  'use strict';
  const books = new Map();

  function loadBook(version, book) {
    const key = version + '/' + book;
    if (!books.has(key)) {
      const pending = (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
          if (typeof DecompressionStream === 'undefined') throw new Error('Browser update required');
          const response = await fetch('/bible-data/' + key + '.json', {signal: controller.signal});
          if (!response.ok) throw new Error('Bible book unavailable');
          const {gzip} = await response.json();
          const bytes = Uint8Array.from(atob(gzip), character => character.charCodeAt(0));
          const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
          return JSON.parse(await new Response(stream).text());
        } finally {
          clearTimeout(timeout);
        }
      })();
      books.set(key, pending);
      pending.catch(() => books.delete(key));
    }
    return books.get(key);
  }

  window.BibleLibrary = {loadBook};
})();
