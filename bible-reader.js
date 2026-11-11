(() => {
  'use strict';
  const $=s=>document.querySelector(s), content=$('#bibleText'), versions=['KJV','BSB','ASV','YLT'];
  const cache=new Map();let catalog,request=0;
  function stored(){try{return JSON.parse(localStorage.getItem('bibleVersion'))||'KJV';}catch(_){return 'KJV';}}
  function remember(v){try{localStorage.setItem('bibleVersion',JSON.stringify(v));}catch(_){}}
  function backLink(params){
    const link=$('#backToSaying'),raw=params.get('return');let target='/';
    try{const u=new URL(raw||'/',location.origin);if(u.origin===location.origin&&u.pathname==='/')target=u.pathname+u.search+u.hash;}catch(_){}
    if(target==='/'&&/^saying-\d+$|^passage-\d+-\d+$/.test(params.get('from')||''))target='/#'+params.get('from');
    link.href=target;link.textContent=target==='/'?'Back to the sayings':'Back to your saying';
  }
  function current(){
    const p=new URLSearchParams(location.search),v=p.get('version')||stored();let book=catalog.books.find(b=>b.id===p.get('book'))||catalog.books.find(b=>b.id==='john');
    let chapter=Number(p.get('chapter')||1);if(!Number.isInteger(chapter)||chapter<1||chapter>book.chapters)chapter=1;
    return {book,chapter,version:versions.includes(v)?v:'KJV',params:p};
  }
  function url(book,chapter,version,verse=1){const p=new URLSearchParams(location.search);p.set('book',book.id);p.set('chapter',chapter);p.set('version',version);return '/bible?'+p+'#v'+verse;}
  function neighbor(s,direction){let i=catalog.books.indexOf(s.book),chapter=s.chapter+direction;if(chapter<1){i--;chapter=catalog.books[i]?.chapters;}if(chapter>s.book.chapters){i++;chapter=1;}return catalog.books[i]?{book:catalog.books[i],chapter}:null;}
  function highlight(){const id=/^#v\d+$/.test(location.hash)?location.hash.slice(1):null;document.querySelectorAll('.bible-verse').forEach(p=>p.classList.toggle('selected-verse',p.id===id));}
  async function loadBook(version,book){
    const key=version+'/'+book.id;if(cache.has(key))return cache.get(key);
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch('/bible-data/'+key+'.json',{signal:controller.signal});if(!response.ok)throw Error('Book unavailable');
      const packed=await response.json();if(!window.DecompressionStream)throw Error('Browser update required');
      const bytes=Uint8Array.from(atob(packed.gzip),c=>c.charCodeAt(0));const text=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      const data=JSON.parse(text);cache.set(key,data);return data;
    }finally{clearTimeout(timeout);}
  }
  async function render(scroll=false){
    const token=++request,s=current();backLink(s.params);$('#bibleBook').value=s.book.id;$('#bibleVersion').value=s.version;
    $('#bibleChapter').replaceChildren(...Array.from({length:s.book.chapters},(_,i)=>new Option('Chapter '+(i+1),i+1)));$('#bibleChapter').value=s.chapter;
    document.title=s.book.name+' '+s.chapter+' — '+s.version+' | Every Word of Jesus';$('#chapterTitle').textContent=s.book.name+' '+s.chapter;
    $('#translationName').textContent=catalog.versions[s.version];remember(s.version);
    for(const [id,d]of [['previousChapter',-1],['nextChapter',1],['previousBottom',-1],['nextBottom',1]]){const n=neighbor(s,d),link=$('#'+id);link.hidden=!n;if(n){link.href=url(n.book,n.chapter,s.version);link.textContent=(d<0?'← ':'')+n.book.name+' '+n.chapter+(d>0?' →':'');}}
    $('#externalBible').href='https://www.biblegateway.com/passage/?'+new URLSearchParams({search:s.book.name+' '+s.chapter,version:s.version});
    content.setAttribute('aria-busy','true');content.textContent='Loading chapter…';
    try{
      const data=await loadBook(s.version,s.book);if(token!==request)return;const chapter=data.chapters.find(c=>c.chapter===s.chapter);if(!chapter)throw Error('Missing chapter');
      const fragment=document.createDocumentFragment();for(const verse of chapter.verses){const row=document.createElement('p');row.id='v'+verse.verse;row.className='bible-verse';const num=document.createElement('a');num.className='verse-number';num.href='#v'+verse.verse;num.textContent=verse.verse;num.setAttribute('aria-label','Verse '+verse.verse);row.append(num,document.createTextNode(' '+verse.text));fragment.append(row);}
      content.replaceChildren(fragment);highlight();const requested=Number(location.hash.replace('#v',''));const absent=requested&&!chapter.verses.some(v=>v.verse===requested);$('#bibleStatus').textContent=chapter.verses.length+' verses · '+s.version+' · full chapter, including narration'+(absent?' · Verse '+requested+' is not numbered in this edition; read the surrounding text.':'');
      if(scroll||location.hash)requestAnimationFrame(()=>{const target=document.getElementById(location.hash.slice(1))||$('#chapterTitle');target.scrollIntoView({block:'center'});});
    }catch(_){if(token===request){content.textContent='This chapter could not load. Check your connection or use a current browser. Your place is kept in the address bar.';const retry=document.createElement('button');retry.className='btn';retry.textContent='Try again';retry.onclick=()=>render();content.append(document.createElement('br'),retry);$('#bibleStatus').textContent='You can also read this chapter on Bible Gateway using the link below.';}}
    finally{if(token===request)content.setAttribute('aria-busy','false');}
  }
  function go(path){history.pushState(null,'',path);render(true);}
  $('#bibleControls').addEventListener('change',e=>{const s=current(),book=catalog.books.find(b=>b.id===$('#bibleBook').value),chapter=e.target.id==='bibleBook'?1:Number($('#bibleChapter').value),version=$('#bibleVersion').value;const verse=e.target.id==='bibleVersion'?Number(location.hash.replace('#v',''))||1:1;go(url(book,chapter,version,verse));});
  document.querySelectorAll('[data-chapter-nav]').forEach(link=>link.onclick=e=>{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&e.button===0){e.preventDefault();go(link.getAttribute('href'));}});
  addEventListener('popstate',()=>render(true));addEventListener('hashchange',highlight);
  fetch('/bible-data/catalog.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{catalog=d;$('#bibleBook').replaceChildren(...d.books.map(b=>new Option(b.name,b.id)));$('#bibleVersion').replaceChildren(...Object.entries(d.versions).map(([v,n])=>new Option(n,v)));$('#bibleControls').disabled=false;render();}).catch(()=>{content.textContent='The Bible library could not load. Please try again later, or use the external chapter link below.';});
})();
