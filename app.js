import {norm,parse,format} from './lib/ingredients.js';

const KEY='madplan-mvp-v1';
const defaults={recipes:[],selected:[],adjustments:{},excluded:[]};
let state;try{state={...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{state={...defaults}};
const $=id=>document.getElementById(id);
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
function aggregate(){const map=new Map();state.recipes.filter(r=>state.selected.includes(r.id)).forEach(r=>r.lines.forEach(line=>{const p=parse(line),key=norm(p.name)+'|'+p.unit;if(!map.has(key))map.set(key,{...p,key,qty:0});if(p.qty===null)map.get(key).qty=null;else if(map.get(key).qty!==null)map.get(key).qty+=p.qty}));return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'da'))}
function el(tag,txt,cls){const e=document.createElement(tag);if(txt!==undefined)e.textContent=txt;if(cls)e.className=cls;return e}
function render(){const root=$('recipes');root.replaceChildren();if(!state.recipes.length)root.append(el('p','Tilføj din første opskrift ovenfor.','muted'));state.recipes.forEach(r=>{const wrap=el('div',undefined,'recipe row'),check=el('input');check.type='checkbox';check.setAttribute('aria-label','Vælg '+r.title);check.checked=state.selected.includes(r.id);check.disabled=!check.checked&&state.selected.length>=3;check.addEventListener('change',()=>{state.selected=check.checked?[...state.selected,r.id]:state.selected.filter(id=>id!==r.id);save();invalidatePreview();render()});wrap.append(check);const info=el('div',undefined,'grow');info.append(el('strong',r.title),el('div',r.lines.length+' ingredienser','muted'));if(r.url){const a=el('a','Åbn opskrift');a.href=r.url;a.target='_blank';a.rel='noopener noreferrer';info.append(a)}wrap.append(info);const remove=el('button','Slet','danger');remove.addEventListener('click',()=>{if(!confirm('Slet opskriften?'))return;state.recipes=state.recipes.filter(x=>x.id!==r.id);state.selected=state.selected.filter(x=>x!==r.id);save();invalidatePreview();render()});wrap.append(remove);root.append(wrap)});const list=$('ingredients');list.replaceChildren();const entries=aggregate();if(!entries.length)list.append(el('p','Vælg retter for at se ingredienser.','muted'));entries.forEach(p=>{const wrap=el('div',undefined,'ingredient');const label=el('label');label.style.margin='0';const cb=el('input');cb.type='checkbox';cb.checked=!state.excluded.includes(p.key);cb.addEventListener('change',()=>{state.excluded=cb.checked?state.excluded.filter(k=>k!==p.key):[...state.excluded,p.key];save();invalidatePreview();render()});label.append(cb,document.createTextNode(' '+p.name));label.append(el('div',p.qty===null?'Tjek mængde i opskriften':format(p.qty)+' '+p.unit,'muted'));const have=el('input');have.type='number';have.min='0';have.step='any';have.setAttribute('aria-label','Har hjemme: '+p.name);have.value=state.adjustments[p.key]??0;have.disabled=p.qty===null;const need=el('strong');const update=()=>{const n=cb.checked?Math.max(0,p.qty-(Number(have.value)||0)):0;need.textContent=p.qty===null?(cb.checked?'Tjek opskrift':'Udeladt'):format(n)+' '+p.unit};have.addEventListener('input',()=>{state.adjustments[p.key]=Math.max(0,Number(have.value)||0);save();invalidatePreview();update()});update();wrap.append(label,have,need);list.append(wrap)})}
$('import').addEventListener('click',async()=>{const url=$('url').value.trim();if(!url){$('message').textContent='Indsæt et opskriftslink først.';return}const btn=$('import');btn.disabled=true;$('message').textContent='Henter opskrift...';try{const response=await fetch('/api/import?url='+encodeURIComponent(url));const data=await response.json();if(!response.ok)throw Error(data.error||'Import mislykkedes');$('title').value=data.title;$('lines').value=data.lines.join('\n');$('message').textContent='Opskriften er hentet. Gennemgå ingredienserne og tryk Gem opskrift.'}catch(e){$('message').textContent=e.message}finally{btn.disabled=false}});
$('save').addEventListener('click',()=>{const title=$('title').value.trim(),lines=$('lines').value.split('\n').map(x=>x.trim()).filter(Boolean);if(!title||!lines.length){$('message').textContent='Udfyld navn og mindst én ingrediens.';return}const url=$('url').value.trim();if(url&&!/^https?:\/\//i.test(url)){$('message').textContent='Link skal begynde med https://';return}const id=crypto.randomUUID();state.recipes.push({id,title,url,lines});if(state.selected.length<3)state.selected.push(id);save();invalidatePreview();$('title').value=$('url').value=$('lines').value='';$('message').textContent='Opskrift gemt på denne enhed.';render()});
$('copy').addEventListener('click',async()=>{const lines=aggregate().filter(p=>!state.excluded.includes(p.key)).map(p=>({...p,need:Math.max(0,p.qty-(Number(state.adjustments[p.key])||0))})).filter(p=>p.need>0||p.qty===null).map(p=>p.name+' – '+(p.qty===null?'se opskrift':format(p.need)+' '+p.unit));if(!lines.length){alert('Ingen varer at kopiere');return}try{await navigator.clipboard.writeText(lines.join('\n'));alert('Indkøbsbehov kopieret')}catch{prompt('Kopiér listen:',lines.join('\n'))}});
$('reset').addEventListener('click',()=>{state.adjustments={};save();invalidatePreview();render()});render();

let previewItems=[];
let transferBusy=false;
function invalidatePreview(){previewItems=[];$('preview').hidden=true;}
function neededItems(){const items=aggregate().filter(p=>!state.excluded.includes(p.key)).map(p=>({...p,need:Math.max(0,p.qty-(Number(state.adjustments[p.key])||0))})).filter(p=>p.need>0||p.qty===null).map(p=>({name:p.name,note:p.qty===null?'Mængde: se opskrift':format(p.need)+' '+p.unit}));const byName=new Map();for(const item of items){const key=norm(item.name);if(byName.has(key))byName.get(key).note+=' + '+item.note;else byName.set(key,{...item});}return [...byName.values()];}
async function api(action,payload={}){
  if(!navigator.onLine)throw Error('Du er offline. Forbind til internettet for at bruge eTilbudsavis.');
  const response=await fetch('/api/etilbudsavis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
  let data;try{data=await response.json()}catch{throw Error('Serveren svarede ikke som forventet. Prøv igen senere.')}
  if(!response.ok){if(response.status===401&& !['login','verify'].includes(action))showConnected(false);throw Error(data.error||'Forespørgslen mislykkedes.');}
  return data;
}
function showConnected(connected){$('connected-panel').hidden=!connected;$('login-panel').hidden=connected;if(!connected)invalidatePreview();}
async function busy(button,work){if(button.disabled)return;button.disabled=true;try{await work()}catch(error){$('connection-message').textContent=error.message}finally{button.disabled=false}}
async function loadLists(){
  invalidatePreview();const data=await api('lists');const select=$('shopping-list');select.replaceChildren();
  const placeholder=el('option','Vælg liste');placeholder.value='';select.append(placeholder);
  data.lists.forEach(list=>{const option=el('option',list.name);option.value=String(list.id);select.append(option)});
  const saved=localStorage.getItem('madplan-list-id');if(data.lists.some(x=>String(x.id)===saved))select.value=saved;
  else if(data.lists.length===1)select.value=String(data.lists[0].id);
  $('connection-message').textContent=data.lists.length?'Vælg liste og gennemgå varerne.':'Der blev ikke fundet nogen indkøbslister. Opret en liste i eTilbudsavis og tryk Opdatér lister.';
}
$('login-form').addEventListener('submit',event=>{event.preventDefault();busy($('send-code'),async()=>{
  await api('login',{email:$('email').value.trim()});$('verify-form').hidden=false;$('code').focus();$('connection-message').textContent='Login-koden er sendt. Indtast den fra e-mailen.';
})});
$('verify-form').addEventListener('submit',event=>{event.preventDefault();busy($('verify-code'),async()=>{
  await api('verify',{code:$('code').value.trim()});$('code').value='';$('verify-form').hidden=true;showConnected(true);await loadLists();
})});
$('logout').addEventListener('click',()=>busy($('logout'),async()=>{await api('logout');showConnected(false);$('connection-message').textContent='Du er logget ud på denne enhed.'}));
$('refresh-lists').addEventListener('click',()=>busy($('refresh-lists'),loadLists));
$('shopping-list').addEventListener('change',()=>{localStorage.setItem('madplan-list-id',$('shopping-list').value);invalidatePreview()});
$('preview-button').addEventListener('click',()=>busy($('preview-button'),async()=>{
  const listId=$('shopping-list').value,items=neededItems();
  if(!listId)throw Error('Vælg indkøbslisten først.');if(!items.length)throw Error('Ingen varer at overføre. Vælg retter og tilpas indkøbsbehovet.');
  $('connection-message').textContent='Kontrollerer eksisterende varer...';
  const data=await api('preview',{listId,items});previewItems=data.items;
  $('preview-items').replaceChildren();
  previewItems.forEach(item=>{const row=el('div',undefined,'preview-item');const label=el('label'),cb=el('input');cb.type='checkbox';cb.checked=!item.duplicate;cb.disabled=item.duplicate;item.selected=cb.checked;cb.addEventListener('change',()=>item.selected=cb.checked);label.append(cb,document.createTextNode(' '+item.name+' — '+item.note));row.append(label);if(item.duplicate)row.append(el('div','Findes allerede på listen. Kontrollér selv mængden i eTilbudsavis.','muted'));$('preview-items').append(row)});
  $('existing-items').replaceChildren();data.existing.forEach(item=>$('existing-items').append(el('p',item.name+(item.note?' — '+item.note:''))));
  if(!data.existing.length)$('existing-items').append(el('p','Listen har ingen aktive varer.','muted'));
  $('preview').hidden=false;$('connection-message').textContent='Gennemgå varerne og tryk Tilføj valgte varer.';
}));
$('transfer-button').addEventListener('click',()=>busy($('transfer-button'),async()=>{
  if(transferBusy)return;
  const items=previewItems.filter(x=>x.selected&&!x.duplicate).map(({name,note})=>({name,note}));
  if(!items.length)throw Error('Vælg mindst én ny vare.');
  transferBusy=true;$('shopping-list').disabled=true;$('preview-button').disabled=true;$('refresh-lists').disabled=true;
  $('connection-message').textContent='Tilføjer varer til eTilbudsavis...';
  try{
    const result=await api('transfer',{listId:$('shopping-list').value,items});
    invalidatePreview();
    $('connection-message').textContent=result.added.length+' varer tilføjet. '+result.skipped.length+' dubletter sprunget over.'+(result.uncertain?' Overførslen stoppede ved '+result.uncertain+'. '+result.error+' Gennemgå varerne igen før næste forsøg.':' Se varerne i eTilbudsavis.');
  }catch(error){invalidatePreview();throw Error(error.message+' Kontrollér listen i eTilbudsavis og gennemgå varerne igen før næste forsøg.');}
  finally{transferBusy=false;$('shopping-list').disabled=false;$('preview-button').disabled=false;$('refresh-lists').disabled=false;}
}));
if(window.navigator.standalone||window.matchMedia('(display-mode: standalone)').matches)$('install').hidden=true;
api('status').then(async data=>{showConnected(data.connected);if(!data.configured)$('connection-message').textContent='Login mangler serveropsætning.';else if(data.connected)await loadLists();}).catch(error=>$('connection-message').textContent=error.message);
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
