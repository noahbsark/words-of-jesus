(() => {
  'use strict';
  const data=window.READER_DATA;
  if(!data) return; // The complete static reader remains available.
  const $=s=>document.querySelector(s), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const storage={get(k,f){try{return JSON.parse(localStorage.getItem(k))??f;}catch(_){return f;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(_){}}};
  const reviewed=window.REVIEWED_PASSAGES||{};
  const corrected=window.REVIEWED_QUOTE_CORRECTIONS||{};
  const notes=window.REVIEWED_CONTEXT_NOTES||{};
  function normalizeSearch(text){
    return text.normalize('NFKC').toLowerCase()
      .replace(/['’]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  }
  const flat=data.sections.flatMap((s,si)=>s.items.map(x=>{
    const key=String(x.number||x.id);
    const passages=reviewed[key]?.map(([book,chapter,verse,end])=>({book,chapter,verse,end,matched:true,reviewed:true}));
    const text=corrected[key]||x.text;
    const contexts=passages||x.contexts;
    const searchText=normalizeSearch([text,s.title,s.source,...contexts.map(contextLabel)].join(' '));
    return {...x,text,contexts,searchText,si,section:s,era:s.era,key};
  }));
  const savedValue=storage.get('savedJesus',[]), saved=new Set(Array.isArray(savedValue)?savedValue.map(String):[]);
  const state={q:'',era:'all',book:'all',saved:false,limit:24,version:storage.get('bibleVersion','KJV')};
  if(!data.versions[state.version])state.version='KJV';
  const books=[...new Set(flat.flatMap(x=>x.contexts.map(c=>c.book)))].sort();
  const slug=s=>s.toLowerCase().replaceAll(' ','-');
  const notice=$('#readerNotice');
  const reader=$('#reader');
  const openSources=new Set();
  const announce=text=>{notice.textContent=text;};
  data.eras.forEach((n,i)=>$('#eraSelect').add(new Option(n,i)));
  books.forEach(n=>$('#bookSelect').add(new Option(n,n)));
  Object.entries(data.versions).forEach(([v,n])=>$('#versionSelect').add(new Option(n,v)));
  $('#versionSelect').value=state.version;
  function readURL(){
    const p=new URLSearchParams(location.search);
    state.q=p.get('q')||'';state.era=data.eras[p.get('era')]?p.get('era'):'all';
    state.book=books.includes(p.get('book'))?p.get('book'):'all';state.saved=p.get('saved')==='1';
    $('#search').value=state.q;$('#eraSelect').value=state.era;$('#bookSelect').value=state.book;
  }
  function syncURL(){
    const p=new URLSearchParams();if(state.q.trim())p.set('q',state.q.trim());if(state.era!=='all')p.set('era',state.era);if(state.book!=='all')p.set('book',state.book);if(state.saved)p.set('saved','1');
    history.replaceState(null,'','/'+(p.size?'?'+p:'')+location.hash);
  }
  function matches(x,query){
    return (!state.saved||saved.has(x.key))
      &&(state.era==='all'||x.era===+state.era)
      &&(state.book==='all'||x.contexts.some(c=>c.book===state.book))
      &&x.searchText.includes(query);
  }
  function contextURL(x,c,version=state.version){
    const p=new URLSearchParams({book:slug(c.book),chapter:String(c.chapter),version,from:x.id,return:'/'+location.search+'#'+x.id});
    if(c.end>c.verse)p.set('through',c.end);
    return '/bible?'+p+(c.matched?'#v'+c.verse:'');
  }
  function contextLabel(c){return c.book+' '+c.chapter+(c.matched?':'+c.verse+(c.end>c.verse?'–'+c.end:''):'');}
  function contextLinks(x){
    return x.contexts.map((c,i)=>{
      const lead=c.reviewed?(i?'Also read':'Read in context'):c.matched?'Possible verse match':'Related chapter';
      return `<a class="context-link${i===0?' primary-context':''}" href="${esc(contextURL(x,c))}">${lead}: ${esc(contextLabel(c))} →</a>`;
    }).join('');
  }
  function quoteHTML(x){const c=x.contexts[0],long=x.text.length>650;return `<div class="quote${long?' quote-short':''}" id="quote-${esc(x.id)}"><a href="${esc(contextURL(x,c))}">${esc(x.text)}</a></div>${long?`<button class="text-button expand" aria-expanded="false" aria-controls="quote-${esc(x.id)}">Read full excerpt</button>`:''}`;}
  function sourcePreviewHTML(x){
    if (!window.BibleLibrary || !x.contexts.some(c=>c.reviewed)) return '';
    const key=esc(x.key);
    return `<details class="source-preview" data-preview-key="${key}"${openSources.has(x.key)?' open':''}><summary>View Bible text (${esc(state.version)})</summary><div class="source-preview-text" data-preview-text></div></details>`;
  }
  function verseText(row,context){
    const speaker=window.BibleSpeakerNotes?.get(slug(context.book),context.chapter,row.verse,context.verse);
    const label=speaker?` <span class="speaker-label">${esc(speaker.label)}</span>`:'';
    const note=speaker?.detail?` <span class="speaker-detail">${esc(speaker.detail)}</span>`:'';
    return `<p class="preview-verse"><span class="preview-verse-number">${row.verse}</span>${label} ${esc(row.text)}${note}</p>`;
  }
  function previewBlock(x,context,version,result){
    const link=`<a class="context-link" href="${esc(contextURL(x,context,version))}">Open full chapter</a>`;
    const start=context.verse;
    const end=context.end||start;
    const title=`<h4>${esc(contextLabel(context))} · ${version}</h4>`;
    if (result.status==='rejected') {
      return `<section class="source-passage">${title}<p>This source could not load.</p>${link}</section>`;
    }
    const verses=result.value.chapters.find(ch=>ch.chapter===context.chapter)?.verses||[];
    const selection=verses.filter(row=>row.verse>=start&&row.verse<=end);
    const missing=selection.length!==end-start+1
      ? '<p class="resource-note">This edition skips one or more verse numbers in the selected range.</p>':'';
    const first=selection.slice(0,6).map(row=>verseText(row,context)).join('');
    const remaining=selection.slice(6);
    const rest=remaining.length
      ? `<details class="source-more"><summary>Show ${remaining.length} more verses</summary>${remaining.map(row=>verseText(row,context)).join('')}</details>`:'';
    return `<section class="source-passage">${title}${missing}${first}${rest}${link}</section>`;
  }
  async function loadSourcePreview(preview,x){
    if (preview.dataset.previewState==='loading'||preview.dataset.previewState==='ready') return;
    const pane=preview.querySelector('[data-preview-text]');
    const version=state.version;
    const contexts=x.contexts.filter(c=>c.reviewed);
    preview.dataset.previewState='loading';
    pane.setAttribute('aria-busy','true');
    pane.innerHTML='<p role="status">Loading the Bible text…</p>';
    const sources=await Promise.allSettled(contexts.map(c=>window.BibleLibrary.loadBook(version,slug(c.book))));
    if (!preview.isConnected) return;

    const failed=sources.some(source=>source.status==='rejected');
    preview.dataset.previewState=failed?'failed':'ready';
    pane.innerHTML='<p class="resource-note">The Bible verses below can include narration or other speakers.</p>'
      + contexts.map((context,index)=>previewBlock(x,context,version,sources[index])).join('')
      + (failed?'<button class="text-button source-retry">Retry Bible text</button>':'');
    pane.setAttribute('aria-busy','false');
  }
  reader.addEventListener('toggle',event=>{
    const preview=event.target;
    if (!preview.matches('.source-preview')) return;
    const x=flat.find(entry=>entry.key===preview.dataset.previewKey);
    if (!x) return;
    if (preview.open){openSources.add(x.key);loadSourcePreview(preview,x);}
    else openSources.delete(x.key);
  },true);
  function updateSearchRoute(){
    const route=$('#readerSearchRoute'), link=$('#readerSearchLink'), query=state.q.trim();
    route.hidden=query.length<3||query.length>120;
    if(route.hidden)return;
    const isReference=/^(?:[1-3]\s*)?[a-z][a-z .'-]*?\s*\d{1,3}(?:\s*:\s*\d{1,3}(?:\s*[-–—]\s*\d{1,3})?)?$/i.test(query);
    const target=isReference?'/find-a-passage':'/search-bible-phrases';
    const params=new URLSearchParams(isReference?{ref:query}:{q:query});
    link.href=target+'?'+params;
    link.textContent=isReference?'Look up this Bible reference':'Search this wording in four translations';
  }
  function emptyResults(){
    if(state.saved){
      return saved.size
        ? '<div class="empty">No saved sayings match these filters. Clear the filters or choose Show all.</div>'
        : '<div class="empty">No saved sayings on this device yet. Choose Show all, then use the star on a saying to save it here.</div>';
    }
    return '<div class="empty">No sayings match. Try fewer words or clear the filters.</div>';
  }
  function render(target){
    updateSearchRoute();
    const query=normalizeSearch(state.q);
    const results=flat.filter(x=>matches(x,query));if(target){const i=results.findIndex(x=>x.id===target||x.key===target);if(i>=0)state.limit=Math.max(24,Math.ceil((i+1)/24)*24);}
    $('#resultCount').textContent=results.length;$('#total').textContent=flat.length;$('#sectionsCount').textContent=data.sections.length;
    $('#savedBtn').setAttribute('aria-pressed',String(state.saved));$('#savedBtn').textContent=state.saved?'Show all':'Saved';
    let current=-1,out='';
    for(const x of results.slice(0,state.limit)){
      if(current!==x.si){if(current!==-1)out+='</section>';current=x.si;out+=`<section class="section" id="section-${x.si}"><p class="eyebrow">${esc(data.eras[x.era])}</p><h2>${esc(x.section.title)}</h2><p class="section-source">${esc(x.section.source)}</p></section-start>`;}
      out+=`<article class="saying${saved.has(x.key)?' saved':''}" id="${esc(x.id)}" data-key="${esc(x.key)}"><div class="saying-head"><span class="num">${x.number?'Saying '+x.number:'Recorded passage'}</span><div class="actions"><button class="iconbtn save" aria-label="${saved.has(x.key)?'Unsave':'Save'} saying ${esc(x.key)}" aria-pressed="${saved.has(x.key)}">${saved.has(x.key)?'★':'☆'}</button><button class="iconbtn copy">Copy</button><button class="iconbtn share">Share</button></div></div><p class="excerpt-label">${x.number?'KJV-based harmony excerpt':'KJV passage excerpt'}</p>${notes[x.key]?`<p class="reader-caveat">${esc(notes[x.key])}</p>`:''}<div class="excerpt-and-source"><div class="excerpt-body">${quoteHTML(x)}</div>${sourcePreviewHTML(x)}</div><div class="context-links" aria-label="Bible context">${contextLinks(x)}</div></article>`;
    }
    if(current!==-1)out+='</section>';
    reader.innerHTML=out.replaceAll('</section-start>','')||emptyResults();
    for(const preview of reader.querySelectorAll('.source-preview[open]')){
      loadSourcePreview(preview,flat.find(x=>x.key===preview.dataset.previewKey));
    }
    $('#loadMore').hidden=results.length<=state.limit;$('#loadMore').textContent='Show next '+Math.min(24,results.length-state.limit)+' sayings';
    $('#readerPosition').textContent=`Showing ${Math.min(results.length,state.limit)} of ${results.length} matches`;
    $('#clearFilters').hidden=!state.q&&state.era==='all'&&state.book==='all'&&!state.saved;
    if(target)requestAnimationFrame(()=>{const x=flat.find(x=>x.id===target||x.key===target);document.getElementById(x?.id)?.scrollIntoView({block:'center'});});
  }
  function refresh(){state.limit=24;syncURL();render();}
  reader.addEventListener('click',async e=>{
    const button=e.target.closest('button'),card=e.target.closest('.saying');if(!button||!card)return;
    const x=flat.find(x=>x.key===card.dataset.key);if(!x)return;
    if(button.classList.contains('source-retry')){
      const preview=button.closest('.source-preview');
      preview.querySelector('summary').focus();
      loadSourcePreview(preview,x);
      return;
    }
    if(button.classList.contains('save')){saved.has(x.key)?saved.delete(x.key):saved.add(x.key);storage.set('savedJesus',[...saved]);button.textContent=saved.has(x.key)?'★':'☆';button.setAttribute('aria-pressed',String(saved.has(x.key)));button.setAttribute('aria-label',(saved.has(x.key)?'Unsave':'Save')+' saying '+x.key);card.classList.toggle('saved',saved.has(x.key));announce(saved.has(x.key)?'Saying saved on this device.':'Saying removed from saved.');if(state.saved)render();}
    if(button.classList.contains('expand')){const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));card.querySelector('.quote').classList.toggle('quote-short',!open);button.textContent=open?'Show less':'Read full excerpt';}
    try{
      if(button.classList.contains('copy')){await navigator.clipboard.writeText(x.text+(x.number?' - KJV-based harmony excerpt':' - KJV passage excerpt')+'; context: '+x.contexts.map(contextLabel).join('; ')+(notes[x.key]?' '+notes[x.key]:''));announce('Excerpt copied.');}
      if(button.classList.contains('share')){const url=location.origin+'/?saying='+encodeURIComponent(x.key);if(navigator.share)await navigator.share({title:'Every Word of Jesus',url});else{await navigator.clipboard.writeText(url);announce('Link copied.');}}
    }catch(error){if(error.name!=='AbortError')announce('Your browser could not copy or share. You can copy the passage text or page address manually.');}
  });
  let timer;$('#search').addEventListener('input',e=>{state.q=e.target.value;clearTimeout(timer);timer=setTimeout(refresh,180);});
  $('#eraSelect').onchange=e=>{state.era=e.target.value;refresh();};$('#bookSelect').onchange=e=>{state.book=e.target.value;refresh();};
  $('#versionSelect').onchange=e=>{state.version=e.target.value;storage.set('bibleVersion',state.version);render();announce('Bible context links now use '+data.versions[state.version]+'. The harmony excerpts remain KJV-based.');};
  $('#clearFilters').onclick=()=>{state.q='';state.era='all';state.book='all';state.saved=false;$('#search').value='';$('#eraSelect').value='all';$('#bookSelect').value='all';refresh();};
  $('#savedBtn').onclick=()=>{state.saved=!state.saved;refresh();$('#reader').scrollIntoView({block:'start'});};
  document.querySelectorAll('.chip[data-q]').forEach(c=>c.onclick=()=>{state.q=c.dataset.q;$('#search').value=state.q;refresh();$('#reader').scrollIntoView({block:'start'});});
  $('#surprise').onclick=()=>{const x=flat[Math.floor(Math.random()*flat.length)];state.q='';state.era='all';state.book='all';state.saved=false;$('#search').value='';$('#eraSelect').value='all';$('#bookSelect').value='all';syncURL();const p=new URLSearchParams({saying:x.key});history.replaceState(null,'','/?'+p);render(x.key);};
  $('#loadMore').onclick=()=>{const before=document.querySelectorAll('.saying').length;state.limit+=24;render();document.querySelectorAll('.saying')[before]?.scrollIntoView({block:'start'});};
  $('#theme').onclick=()=>{document.body.classList.toggle('dark');storage.set('jesusTheme',document.body.classList.contains('dark')?'dark':'light');};if(storage.get('jesusTheme','light')==='dark')document.body.classList.add('dark');
  $('#timeline').innerHTML=data.eras.map((era,i)=>`<details class="timeline-era"><summary>${esc(era)}</summary>${data.sections.map((s,si)=>s.era===i?`<button class="section-link" data-section="${si}">${esc(s.title)}</button>`:'').join('')}</details>`).join('');
  $('#timeline').onclick=e=>{const b=e.target.closest('[data-section]');if(!b)return;const si=+b.dataset.section;state.era=String(data.sections[si].era);state.q='';state.book='all';state.saved=false;$('#search').value='';$('#eraSelect').value=state.era;$('#bookSelect').value='all';syncURL();const x=flat.find(x=>x.si===si);render(x.id);};
  document.querySelectorAll('.mobile-nav button').forEach(b=>b.onclick=()=>{if(b.dataset.action==='top')$('#reader').scrollIntoView({block:'start'});if(b.dataset.action==='search'){$('#search').scrollIntoView({block:'center'});$('#search').focus({preventScroll:true});}if(b.dataset.action==='saved')$('#savedBtn').click();if(b.dataset.action==='timeline'){$('#timelinePanel').open=true;$('#timelinePanel').scrollIntoView({block:'start'});}});
  addEventListener('popstate',()=>{readURL();render(new URLSearchParams(location.search).get('saying')||location.hash.slice(1));});
  const smallScreen=matchMedia('(max-width:820px)');
  function adaptFilters(){if(smallScreen.matches)$('#timelinePanel').open=false;$('#readerFilters').open=!smallScreen.matches;}
  adaptFilters();smallScreen.addEventListener('change',adaptFilters);
  readURL();render(new URLSearchParams(location.search).get('saying')||location.hash.slice(1));
})();
