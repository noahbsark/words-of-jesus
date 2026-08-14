(async()=>{
 const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
 const state={q:'',era:'all',book:'all',saved:new Set(JSON.parse(localStorage.getItem('savedJesus')||'[]')),data:null};
 const parts=window.__WORDS_PARTS__||[];
 try{
   const b64=parts.join(''); const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
   const ds=new DecompressionStream('gzip'); const text=await new Response(new Blob([bin]).stream().pipeThrough(ds)).text();
   state.data=JSON.parse(text);
 }catch(e){ $('#reader').innerHTML='<div class="empty">The sayings library could not load in this browser. Try a current Chrome, Edge, Firefox, or Safari browser.</div>'; return; }
 const ERA_NAMES=['Childhood & Preparation','Early Ministry','Galilean Ministry','Teachings & Miracles','Journey to Jerusalem','Final Week','Last Supper','Passion & Crucifixion','Resurrection & Ascension','Post-Ascension','Revelation & Hebrews'];
 const majors=[...new Set(state.data.sections.map(s=>s.major))];
 const eraFor=i=>Math.min(10,Math.floor(i*11/state.data.sections.length));
 const normalizeRef=s=>(s||'').replace(/,\s*(\d)/g,':$1').replace(/\.(\s*)$/,'').replace(/(\d)-(\d)/g,'$1–$2');
 const flat=[]; state.data.sections.forEach((sec,si)=>sec.items.forEach(it=>flat.push({...it,section:sec,si,era:eraFor(si)})));
 $('#total').textContent=flat.length; $('#sectionsCount').textContent=state.data.sections.length;
 function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 function hl(s,q){ if(!q)return esc(s); const e=q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); return esc(s).replace(new RegExp('('+e+')','ig'),'<mark>$1</mark>'); }
 function bookOf(sec,it){const r=(it.reference||sec.source||'').trim(); return (r.match(/^(Matthew|Mark|Luke|John|Acts|Revelation|Hebrews|1 Corinthians|2 Corinthians)/)||[])[1]||'Other';}
 function matches(x){const q=state.q.trim().toLowerCase(); const book=bookOf(x.section,x); if(state.era!=='all'&&x.era!==+state.era)return false;if(state.book!=='all'&&book!==state.book)return false;if(!q)return true;return (x.text+' '+x.section.title+' '+x.section.source+' '+(x.reference||'')).toLowerCase().includes(q)}
 function render(){
   const bySec=new Map(); flat.filter(matches).forEach(x=>{if(!bySec.has(x.si))bySec.set(x.si,[]);bySec.get(x.si).push(x)});
   $('#resultCount').textContent=[...bySec.values()].reduce((n,a)=>n+a.length,0);
   const out=[];
   for(const [si,items] of bySec){const sec=state.data.sections[si];out.push(`<section class="section" id="section-${si}"><h2>${esc(sec.title)}</h2><div class="section-source">${esc(normalizeRef(sec.source))}</div>`);for(const x of items){const saved=state.saved.has(String(x.number||x.id));const ref=normalizeRef(x.reference||sec.source);out.push(`<article class="saying ${saved?'saved':''}" id="${esc(x.id||'entry-'+si)}" data-key="${esc(String(x.number||x.id))}"><div class="saying-head"><span class="num">${x.number?'Saying '+x.number:'Recorded saying'}</span><div class="actions"><button class="iconbtn save" title="Save">${saved?'★':'☆'}</button><button class="iconbtn copy" title="Copy">Copy</button><button class="iconbtn share" title="Share">Share</button></div></div><div class="quote">“${hl(x.text,state.q)}”</div><div class="ref">${esc(ref)}</div></article>`)}out.push('</section>')}
   $('#reader').innerHTML=out.join('')||'<div class="empty">No sayings match those filters.</div>';
   bindCards();
 }
 function bindCards(){
   $$('.saying').forEach(card=>{
    $('.save',card).onclick=()=>{const k=card.dataset.key;state.saved.has(k)?state.saved.delete(k):state.saved.add(k);localStorage.setItem('savedJesus',JSON.stringify([...state.saved]));render();};
    $('.copy',card).onclick=async()=>{await navigator.clipboard.writeText($('.quote',card).innerText+' — '+$('.ref',card).innerText);$('.copy',card).textContent='Copied';setTimeout(()=>$('.copy',card)&&($('.copy',card).textContent='Copy'),1000)};
    $('.share',card).onclick=async()=>{const url=location.origin+location.pathname+'?saying='+encodeURIComponent(card.dataset.key);const txt=$('.quote',card).innerText; if(navigator.share)await navigator.share({title:'Every Word of Jesus',text:txt,url});else{await navigator.clipboard.writeText(url);$('.share',card).textContent='Link copied'}};
   });
 }
 function buildSidebar(){
   const box=$('#timeline'); let h=''; for(let e=0;e<11;e++){h+=`<div class="era"><button data-era="${e}">${ERA_NAMES[e]}</button>`;state.data.sections.forEach((s,i)=>{if(eraFor(i)===e)h+=`<button class="section-link" data-sec="${i}">${esc(s.title.replace(/^Part \d+\.\s*/,''))}</button>`});h+='</div>'}box.innerHTML=h;$$('[data-era]',box).forEach(b=>b.onclick=()=>{state.era=b.dataset.era;$('#eraSelect').value=state.era;render();window.scrollTo({top:$('#reader').offsetTop-70,behavior:'smooth'})});$$('[data-sec]',box).forEach(b=>b.onclick=()=>$('#section-'+b.dataset.sec)?.scrollIntoView({behavior:'smooth'}));
 }
 const eraSelect=$('#eraSelect');ERA_NAMES.forEach((n,i)=>eraSelect.insertAdjacentHTML('beforeend',`<option value="${i}">${n}</option>`));
 const books=[...new Set(flat.map(x=>bookOf(x.section,x)))].sort();books.forEach(b=>$('#bookSelect').insertAdjacentHTML('beforeend',`<option>${esc(b)}</option>`));
 $('#search').oninput=e=>{state.q=e.target.value;render();};eraSelect.onchange=e=>{state.era=e.target.value;render();};$('#bookSelect').onchange=e=>{state.book=e.target.value;render();};
 $$('.chip').forEach(c=>c.onclick=()=>{$('#search').value=c.dataset.q;state.q=c.dataset.q;render();});
 $('#surprise').onclick=()=>{const x=flat[Math.floor(Math.random()*flat.length)];state.q='';state.era='all';state.book='all';$('#search').value='';eraSelect.value='all';$('#bookSelect').value='all';render();setTimeout(()=>document.getElementById(x.id)?.scrollIntoView({behavior:'smooth',block:'center'}),20)};
 $('#theme').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('jesusTheme',document.body.classList.contains('dark')?'dark':'light')};if(localStorage.getItem('jesusTheme')==='dark')document.body.classList.add('dark');
 $('#savedBtn').onclick=()=>{const keys=state.saved;state.q='';state.era='all';state.book='all';render();$$('.saying').forEach(c=>{if(!keys.has(c.dataset.key))c.remove()});$('#resultCount').textContent=$$('.saying').length;window.scrollTo({top:$('#reader').offsetTop-70,behavior:'smooth'})};
 buildSidebar();render();
 const params=new URLSearchParams(location.search);const target=params.get('saying');if(target)setTimeout(()=>{const c=$(`.saying[data-key="${CSS.escape(target)}"]`);c?.scrollIntoView({block:'center'});c?.animate([{outline:'3px solid var(--accent)'},{outline:'0 solid transparent'}],{duration:1800})},100);
 addEventListener('scroll',()=>{$('#progress').style.width=(scrollY/(document.documentElement.scrollHeight-innerHeight)*100||0)+'%'});
 $$('.mobile-nav button').forEach(b=>b.onclick=()=>{const a=b.dataset.action;if(a==='search'){$('#search').focus();scrollTo({top:$('#search').getBoundingClientRect().top+scrollY-80,behavior:'smooth'})}if(a==='top')scrollTo({top:0,behavior:'smooth'});if(a==='saved')$('#savedBtn').click();if(a==='timeline')scrollTo({top:$('#reader').offsetTop-70,behavior:'smooth'})});
})();