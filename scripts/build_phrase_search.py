"""Build compact phrase-search shards from the reviewed Bible destinations."""
import base64
import gzip
import json
from functools import lru_cache
from pathlib import Path

from render_context_cards import registry

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'bible-data'
OUT = DATA / 'phrase-search-v1'


@lru_cache
def read_book(version, slug):
    packed = json.loads((DATA / version / f'{slug}.json').read_text(encoding='utf-8'))
    return json.loads(gzip.decompress(base64.b64decode(packed['gzip'])))['chapters']


def indexes():
    catalog = json.loads((DATA / 'catalog.json').read_text(encoding='utf-8'))
    reviewed, _ = registry()
    selected = {}
    for passages in reviewed.values():
        for book, chapter, first, last in passages:
            slug = book.lower().replace(' ', '-')
            selected.setdefault((slug, chapter), set()).update(range(first, last + 1))

    for version in catalog['versions']:
        records = []
        for book in catalog['books']:
            slug = book['id']
            for number in range(1, book['chapters'] + 1):
                verses = selected.get((slug, number))
                if not verses:
                    continue
                chapter = read_book(version, slug)[number - 1]
                rows = [[row['verse'], row['text']] for row in chapter['verses'] if row['verse'] in verses]
                if rows:
                    records.append([book['name'], slug, number, rows])
        yield version, records


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for version, records in indexes():
        raw = json.dumps(records, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        encoded = base64.b64encode(gzip.compress(raw, mtime=0)).decode('ascii')
        (OUT / f'{version}.json').write_text(json.dumps({'gzip': encoded}, separators=(',', ':')) + '\n',
                                             encoding='utf-8', newline='\n')
        print(version, sum(len(record[3]) for record in records), 'verse rows,', len(encoded), 'encoded bytes')


if __name__ == '__main__':
    main()
