"""Build the context index, local Bible books and readable HTML fallback.

Run from the repository root. Bible inputs are the unchanged Scrollmapper JSON
exports named KJV.json, ASV.json, BSB.json and YLT.json in --inputs.
"""
from pathlib import Path
import argparse,base64,gzip,hashlib,html,json,re

ROOT=Path(__file__).resolve().parents[1]
VERSIONS={'KJV':'King James Version (1769)','BSB':'Berean Standard Bible','ASV':'American Standard Version (1901)','YLT':"Young’s Literal Translation (1898)"}
ERAS=['Childhood and preparation','Early ministry','Galilee and teaching','Journey toward Jerusalem','Jerusalem and final week','Last Supper and farewell','Arrest and crucifixion','Resurrection and ascension','Other New Testament settings','Revelation','Hebrews: literary quotations']
def era(i):
    if i==89:return 8
    for end,n in [(2,0),(10,1),(44,2),(60,3),(71,4),(77,5),(84,6),(90,7),(96,8),(107,9),(108,10)]:
        if i<=end:return n
def slug(book):return book.lower().replace(' ','-')
def norm(s):return re.sub(r'[^a-z0-9 ]','',s.lower().replace('’',"'")).replace('  ',' ').strip()
def dump(path,d):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--inputs',type=Path,required=True);args=parser.parse_args()
    bibles={v:json.loads((args.inputs/(v+'.json')).read_text(encoding='utf-8')) for v in VERSIONS}
    for bible in bibles.values():
        for b in bible['books']:
            b['name']=b['name'].replace('Revelation of John','Revelation')
            b['name']=re.sub(r'^(III|II|I) ',lambda m:{'I':'1','II':'2','III':'3'}[m[1]]+' ',b['name'])
            for chapter in b['chapters']:
                chapter['verses']=[v for v in chapter['verses'] if v['text'].strip()]
    books={b['name']:b for b in bibles['KJV']['books']}
    catalog={'versions':VERSIONS,'books':[{'name':n,'id':slug(n),'chapters':len(b['chapters'])} for n,b in books.items()]}
    assert len(books)==66
    for v in VERSIONS:
        for old in (ROOT/'bible-data'/v).glob('*.json'):
            if old.stem not in {slug(n) for n in books}:old.unlink()
    provenance=[]
    for v,bible in bibles.items():
        assert len(bible['books'])==66
        for book in bible['books']:
            assert book['name'] in books
            assert len(book['chapters'])==len(books[book['name']]['chapters'])
            payload=json.dumps(book,ensure_ascii=False,separators=(',',':')).encode()
            encoded=base64.b64encode(gzip.compress(payload,mtime=0)).decode()
            dump(ROOT/'bible-data'/v/(slug(book['name'])+'.json'),{'gzip':encoded})
        provenance.append({'version':v,'source':'https://github.com/scrollmapper/bible_databases/blob/master/formats/json/'+v+'.json','sha256':hashlib.sha256((args.inputs/(v+'.json')).read_bytes()).hexdigest(),'books':66,'verses':sum(len(c['verses']) for b in bible['books'] for c in b['chapters'])})
    dump(ROOT/'bible-data/catalog.json',catalog);dump(ROOT/'bible-data/provenance.json',provenance)
    data=json.loads((ROOT/'source-data.json').read_text(encoding='utf-8'))
    book_pattern=re.compile(r'\b(1 Corinthians|2 Corinthians|Matthew|Matt\.|Mark|Luke|John|Acts|Revelation|Hebrews)\s+(\d+)')
    fixes={6:'John 3:22–36; John 4:1–42',26:'Matthew 13:31–53; Mark 4:30–41; Luke 8:22–25',28:'Luke 8:40–56; Mark 5:21–43; Matthew 9:18–34',61:'John 11:55–57; Matthew 21:1–11; Mark 11:1–11; Luke 19:28–44',88:'Matthew 28:16–20; Mark 16:14–20; Luke 24:44–53; Acts 1:1–11'}
    corrections=[];total=0
    for si,sec in enumerate(data['sections']):
        if si in fixes:
            corrections.append({'section':si,'previous':sec['source'],'corrected':fixes[si]});sec['source']=fixes[si]
        sec['era']=era(si)
        sec['title']=re.sub(r'^Part \d+\.\s*','',sec['title'])
        for wrong,right in {'Strait Gatee':'Strait Gate','Ordrained':'Ordained','Goldren':'Golden','Heares':'Hearers','Greatful':'Grateful','Bathany':'Bethany','Martha Servers':'Martha Serves','Bretrayal':'Betrayal','Forsooker':'Forsook'}.items():sec['title']=sec['title'].replace(wrong,right)
        for item in sec['items']:
            ref=item.get('reference') or sec['source']
            candidates=[]
            # Book/chapter context, not a claim that the entire harmony quote is
            # a verbatim verse. Never infer chapter numbers from loose commas.
            for name,ch in book_pattern.findall(ref):
                name='Matthew' if name=='Matt.' else name;ch=int(ch)
                if name in books and 1<=ch<=len(books[name]['chapters']) and (name,ch) not in candidates:candidates.append((name,ch))
            if not candidates:
                for name,ch in book_pattern.findall(sec['source']):
                    name='Matthew' if name=='Matt.' else name;ch=int(ch)
                    if name in books and 1<=ch<=len(books[name]['chapters']):candidates.append((name,ch))
            # Explicit further chapters in an event source (e.g. John 9; 10).
            if not item.get('reference'):
                parts=re.split(r'(?=\b(?:1 Corinthians|2 Corinthians|Matthew|Matt\.|Mark|Luke|John|Acts|Revelation|Hebrews)\s+\d)',sec['source'])
                for part in parts:
                    m=book_pattern.search(part)
                    if not m:continue
                    name='Matthew' if m[1]=='Matt.' else m[1]
                    for ch in re.findall(r'(?:^|;)\s*(\d+)\s*[:,]',part[m.end(1):]):
                        pair=(name,int(ch))
                        if 1<=pair[1]<=len(books[name]['chapters']) and pair not in candidates:candidates.append(pair)
            assert candidates,(si,item['id'])
            contexts=[];text=norm(item['text'])
            for name,ch in candidates:
                verses=books[name]['chapters'][ch-1]['verses'];matches=[]
                for verse in verses:
                    t=norm(verse['text'])
                    if (len(text.split())>=3 and text in t) or (len(t.split())>=6 and t in text):matches.append(verse['verse'])
                contexts.append({'book':name,'chapter':ch,'verse':matches[0] if matches else 1,'matched':bool(matches)})
            contexts.sort(key=lambda c:not c['matched'])
            item['contexts']=contexts;total+=1
    data['eras']=ERAS;data['versions']=VERSIONS
    (ROOT/'sayings.js').write_text('window.READER_DATA='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    dump(ROOT/'reference-corrections.json',corrections)
    # A complete static fallback, also directly crawlable without JavaScript.
    sections=[]
    for si,s in enumerate(data['sections']):
        cards=[]
        for x in s['items']:
            c=x['contexts'][0];ref=f"{c['book']} {c['chapter']}";url=f"/bible?book={slug(c['book'])}&chapter={c['chapter']}&version=KJV&from={x['id']}#v{c['verse']}"
            cards.append(f'<article class="saying" id="{x["id"]}"><p class="num">{("Saying "+str(x["number"])) if x.get("number") else "Recorded saying"} · KJV-based harmony excerpt</p><blockquote class="quote"><a href="{html.escape(url)}">{html.escape(x["text"])}</a></blockquote><a class="context-link" href="{html.escape(url)}">Read Bible context: {html.escape(ref)} →</a></article>')
        sections.append(f'<section class="section" id="section-{si}"><h2>{html.escape(s["title"])}</h2><p class="section-source">{html.escape(s["source"])}</p>'+''.join(cards)+'</section>')
    template=(ROOT/'index.html').read_text(encoding='utf-8')
    template=re.sub(r'<!-- SAYINGS START -->.*?<!-- SAYINGS END -->','<!-- SAYINGS START -->'+''.join(sections)+'<!-- SAYINGS END -->',template,flags=re.S)
    (ROOT/'index.html').write_text(template,encoding='utf-8')
    print(f'Built {total} sayings in {len(data["sections"])} sections; 264 local Bible books; {len(corrections)} corrected source headings.')
if __name__=='__main__':main()
