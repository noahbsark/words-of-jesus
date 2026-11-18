"""Check source consistency, public routes and all four local Bible editions."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote,parse_qs
import json,re,gzip,base64,xml.etree.ElementTree as ET
from render_context_cards import registry
ROOT=Path(__file__).resolve().parents[1]
class Page(HTMLParser):
    def __init__(self):super().__init__();self.links=[];self.assets=[];self.ids=[];self.canonical=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if tag=='a' and 'href' in a:self.links.append(a['href'])
        if tag=='script' and 'src' in a:self.assets.append(a['src'])
        if tag=='link' and a.get('rel')=='stylesheet':self.assets.append(a['href'])
        if tag=='link' and a.get('rel')=='canonical':self.canonical.append(a['href'])
def target(path):
    p=ROOT/path.lstrip('/')
    if not path or path=='/':return ROOT/'index.html'
    if p.is_dir():return p/'index.html'
    return p if p.suffix else p.with_suffix('.html')
def main():
    pages={p:Page() for p in ROOT.rglob('*.html')}
    for p,v in pages.items():
        v.feed(p.read_text(encoding='utf-8'));assert len(v.ids)==len(set(v.ids)),(p,'duplicate ids')
        assert 'main-content' in v.ids,(p,'missing skip-link target')
        assert len(v.canonical)==1,(p,'canonical count')
        assert 'analytics.js' not in p.read_text(encoding='utf-8'),(p,'unwanted analytics loader')
    checked=0
    for p,v in pages.items():
        for href in v.links+v.assets:
            u=urlsplit(href)
            if u.scheme or u.netloc:
                if u.netloc!='everywordofjesus.com':continue
            dest=target(u.path) if u.path else p
            assert dest.is_file(),(p,href,'missing target')
            if u.fragment and dest in pages and not (dest.name=='bible.html' and re.fullmatch(r'v\d+',u.fragment)):
                assert unquote(u.fragment) in pages[dest].ids,(p,href,'missing anchor')
            checked+=1
    data=json.loads((ROOT/'sayings.js').read_text(encoding='utf-8').removeprefix('window.READER_DATA=').strip().removesuffix(';'))
    flat=[x for s in data['sections'] for x in s['items']]
    assert len(flat)==486 and len({x['id'] for x in flat})==486
    assert all(x['id'] in pages[ROOT/'index.html'].ids for x in flat)
    catalog=json.loads((ROOT/'bible-data/catalog.json').read_text());assert len(catalog['books'])==66
    totals={};book_data={}
    for version in catalog['versions']:
        verses=0;chapters=0
        for book in catalog['books']:
            packed=json.loads((ROOT/'bible-data'/version/(book['id']+'.json')).read_text());raw=json.loads(gzip.decompress(base64.b64decode(packed['gzip'])))
            assert raw['name']==book['name'];assert len(raw['chapters'])==book['chapters']
            for chapter in raw['chapters']:
                nums=[v['verse'] for v in chapter['verses']]
                assert nums==sorted(set(nums));assert all(isinstance(v['text'],str) and v['text'].strip() for v in chapter['verses'])
                verses+=len(nums);chapters+=1
            if version=='KJV':book_data[book['name']]=raw
        assert chapters==1189,(version,chapters)
        totals[version]=verses
    for x in flat:
        assert x['contexts']
        for c in x['contexts']:
            b=book_data[c['book']];ch=b['chapters'][c['chapter']-1];assert c['verse'] in [v['verse'] for v in ch['verses']]
    reviewed, corrections=registry()
    entries={x.get('number'):x for x in flat if x.get('number')}
    assert reviewed.keys()<=entries.keys() and corrections.keys()<=reviewed.keys()
    chapters={(b['name'].lower().replace(' ','-'),c['chapter']):{v['verse'] for v in c['verses']}
              for b in book_data.values() for c in b['chapters']}
    for rows in reviewed.values():
        for book,ch,start,end in rows:
            available=chapters[book.lower().replace(' ','-'),ch]
            assert set(range(start,end+1))<=available,(book,ch,start,end)
    for page in pages.values():
        for href in page.links:
            u=urlsplit(href)
            if u.path!='/bible' or u.netloc or not u.query:continue
            q=parse_qs(u.query)
            available=chapters[q['book'][0],int(q['chapter'][0])]
            if re.fullmatch(r'v\d+',u.fragment):
                first=int(u.fragment[1:]);last=int(q.get('through',[first])[0])
                assert first<=last and set(range(first,last+1))<=available,href
    print(f'Checked range endpoints for {len(reviewed)} reviewed sayings and every static Bible link.')
    assert data['sections'][50]['era']==3 and data['sections'][73]['era']==5
    urls={x.text for x in ET.parse(ROOT/'sitemap.xml').findall('.//{*}loc')}
    expected={v.canonical[0] for p,v in pages.items() if p.name not in ('404.html','bible.html')}
    assert urls==expected,(urls^expected)
    print(f'Passed: {len(pages)} HTML pages, {checked} local destinations, all 486 context routes, 264 Bible books and sitemap. Verse counts: {totals}')
if __name__=='__main__':main()
