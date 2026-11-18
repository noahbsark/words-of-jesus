"""Refresh static sayings cards from the reviewed-passage registry."""
import html
import json
import re
from pathlib import Path
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[1]

def registry():
    source = (ROOT / 'reviewed-passages.js').read_text(encoding='utf-8')
    mappings = re.search(r'REVIEWED_PASSAGES = \{(.*?)\};', source, re.S)[1]
    reviewed = {int(key): json.loads(value) for key, value in
                re.findall(r'^  (\d+): (.+?)(?:,)?$', mappings, re.M)}
    raw = re.search(r'REVIEWED_QUOTE_CORRECTIONS = \{(.*?)\};', source, re.S)[1]
    corrections = {int(key): json.loads(value) for key, value in
                   re.findall(r'^  (\d+): (.+?)(?:,)?$', raw, re.M)}
    return reviewed, corrections

def passage_url(book, chapter, first=None, last=None, **extra):
    params = {'book': book.lower().replace(' ', '-'), 'chapter': chapter, **extra}
    if first and last and last > first:
        params['through'] = last
    return '/bible?' + urlencode(params) + (f'#v{first}' if first else '')

def reference(book, chapter, first=None, last=None):
    label = f'{book} {chapter}'
    if first:
        label += f':{first}'
    if first and last and last > first:
        label += f'–{last}'
    return label

def refresh_static_cards():
    reviewed, corrections = registry()
    raw = (ROOT / 'sayings.js').read_text(encoding='utf-8')
    data = json.loads(raw.strip().removeprefix('window.READER_DATA=').removesuffix(';'))
    sections = []
    for si, section in enumerate(data['sections']):
        cards = []
        for entry in section['items']:
            ident = entry['id']
            number = entry.get('number')
            passages = reviewed.get(number)
            if passages:
                links = [(('Read in context' if i == 0 else 'Also read'), *row)
                         for i, row in enumerate(passages)]
            else:
                links = [('Possible verse match' if c['matched'] else 'Related chapter',
                          c['book'], c['chapter'], c['verse'] if c['matched'] else None, None)
                         for c in entry['contexts']]
            paths = [passage_url(book, chapter, first, last, version='KJV', **{'from': ident})
                     for _, book, chapter, first, last in links]
            buttons = ''.join(
                f'<a class="context-link{" primary-context" if i == 0 else ""}" href="{html.escape(paths[i])}">{lead}: {html.escape(reference(book, chapter, first, last))} →</a>'
                for i, (lead, book, chapter, first, last) in enumerate(links))
            title = f'Saying {number}' if number else 'Recorded saying'
            quote = html.escape(corrections.get(number, entry['text']))
            cards.append(f'<article class="saying" id="{ident}"><p class="num">{title} · KJV-based harmony excerpt</p>'
                         f'<blockquote class="quote"><a href="{html.escape(paths[0])}">{quote}</a></blockquote>'
                         f'<div class="context-links" aria-label="Bible context">{buttons}</div></article>')
        sections.append(f'<section class="section" id="section-{si}"><h2>{html.escape(section["title"])}</h2>'
                        f'<p class="section-source">{html.escape(section["source"])}</p>' + ''.join(cards) + '</section>')
    path = ROOT / 'index.html'
    source = path.read_text(encoding='utf-8')
    updated, count = re.subn(r'<!-- SAYINGS START -->.*?<!-- SAYINGS END -->',
                            lambda _: '<!-- SAYINGS START -->' + ''.join(sections) + '<!-- SAYINGS END -->',
                            source, flags=re.S)
    if count != 1:
        raise ValueError('Expected one static sayings region.')
    path.write_text(updated, encoding='utf-8')

if __name__ == '__main__':
    refresh_static_cards()
