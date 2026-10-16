let currentWeek=null,weekPage=1,weekRequest=0,importingDish=null;
import {format,migrateAdjustments,displayName,resolveName,mergeNames} from './lib/ingredients.js';
import {selectedIngredients,shoppingItems,quantityText} from './lib/shopping.js';
import {REMINDERS_SHORTCUT_NAME,reminderTitles,remindersShortcutUrl} from './lib/reminders.js';

const KEY='madplan-mvp-v1';
const defaults={recipes:[],selected:[],adjustments:{},excluded:[],densities:{},hiddenIngredients:[],nameAliases:{}};
let state;try{state={...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{state={...defaults}};
const $=id=>document.getElementById(id);
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
function migratePreferences(){
  const factors={...state.densities};
  for(const [name,value] of Object.entries(factors)){const resolved=resolveName(name,state.nameAliases);if(factors[resolved]===undefined)factors[resolved]=value;}
  state.densities=factors;
  Object.assign(state,migrateAdjustments(state.adjustments,state.excluded,state.densities,state.nameAliases));
  state.hiddenIngredients=[...new Set(state.hiddenIngredients.map(x=>resolveName(x,state.nameAliases)))];
  state.ingredientVersion=3;
}
if(state.ingredientVersion!==3){migratePreferences();save();}
let previewItems=[],shoppingRevision=0,transferBusy=false;
let mergeSelection=new Set();
function aggregate(){return selectedIngredients(state)}
function el(tag,txt,cls){const e=document.createElement(tag);if(txt!==undefined)e.textContent=txt;if(cls)e.className=cls;return e}
function render(){
  const count=state.recipes.filter(r=>state.selected.includes(r.id)).length;
  $('selected-count').textContent=count+' '+(count===1?'ret valgt':'retter valgt');
  const root=$('recipes');root.replaceChildren();
  if(!state.recipes.length)root.append(el('p','Tilføj din første opskrift ovenfor.','muted'));
  state.recipes.forEach(r=>{
    const wrap=el('div',undefined,'recipe row'),check=el('input');check.type='checkbox';check.setAttribute('aria-label','Vælg '+r.title);check.checked=state.selected.includes(r.id);
    check.addEventListener('change',()=>{state.selected=check.checked?[...new Set([...state.selected,r.id])]:state.selected.filter(id=>id!==r.id);save();invalidatePreview();render();});
    const info=el('div',undefined,'grow');info.append(el('strong',r.title),el('div',r.lines.length+' ingredienser','muted'));
    if(r.url){const a=el('a','Åbn opskrift');a.href=r.url;a.target='_blank';a.rel='noopener noreferrer';info.append(a);}
    const remove=el('button','Slet','danger');remove.addEventListener('click',()=>{if(!confirm('Slet opskriften?'))return;state.recipes=state.recipes.filter(x=>x.id!==r.id);state.selected=state.selected.filter(x=>x!==r.id);save();invalidatePreview();render();});
    wrap.append(check,info,remove);root.append(wrap);
  });
  const list=$('ingredients');list.replaceChildren();
  const entries=aggregate().filter(p=>!state.hiddenIngredients.includes(p.name));
  if(!entries.length)list.append(el('p',count?'Alle ingredienser er skjult. De kan vises igen nederst.':'Vælg retter for at se ingredienser.','muted'));
  entries.forEach(p=>{
    const name=displayName(p.name),wrap=el('div',undefined,'ingredient'),label=el('label');label.style.margin='0';
    const cb=el('input');cb.type='checkbox';cb.checked=!state.excluded.includes(p.key);cb.setAttribute('aria-label','Medtag '+name);
    cb.addEventListener('change',()=>{state.excluded=cb.checked?state.excluded.filter(k=>k!==p.key):[...state.excluded,p.key];save();invalidatePreview();render();});
    label.append(cb,document.createTextNode(' '+name),el('div',quantityText(p),'muted'));
    const have=el('input');have.type='number';have.min='0';have.step='any';have.setAttribute('aria-label','Har hjemme: '+name);have.value=state.adjustments[p.key]??0;have.disabled=p.qty===null;
    const need=el('strong');
    const update=()=>{need.textContent=cb.checked?quantityText(p,p.qty===null?null:Math.max(0,p.qty-(Number(have.value)||0))):'Udeladt';};
    have.addEventListener('input',()=>{state.adjustments[p.key]=Math.max(0,Number(have.value)||0);save();invalidatePreview();update();});
    update();wrap.append(label,have,need);ingredientDetails(wrap,p);list.append(wrap);
  });
  renderMergeIngredients(entries);renderHiddenIngredients();renderWeekDishes();renderReminders();
}
$('import').addEventListener('click',async()=>{const url=$('url').value.trim();if(!url){$('message').textContent='Indsæt et opskriftslink først.';return}const btn=$('import');btn.disabled=true;$('message').textContent='Henter opskrift...';try{const response=await fetch('/api/import?url='+encodeURIComponent(url));const data=await response.json();if(!response.ok)throw Error(data.error||'Import mislykkedes');$('title').value=data.title;$('lines').value=data.lines.join('\n');$('message').textContent='Opskriften er hentet. Gennemgå ingredienserne og tryk Gem opskrift.'}catch(e){$('message').textContent=e.message}finally{btn.disabled=false}});
$('save').addEventListener('click',()=>{const title=$('title').value.trim(),lines=$('lines').value.split('\n').map(x=>x.trim()).filter(Boolean);if(!title||!lines.length){$('message').textContent='Udfyld navn og mindst én ingrediens.';return}const url=$('url').value.trim();if(url&&!/^https?:\/\//i.test(url)){$('message').textContent='Link skal begynde med https://';return}const id=crypto.randomUUID();state.recipes.push({id,title,url,lines});state.selected.push(id);save();invalidatePreview();$('title').value=$('url').value=$('lines').value='';$('message').textContent='Opskrift gemt på denne enhed.';render()});
$('copy').addEventListener('click',async()=>{const lines=neededItems().map(p=>p.name+' – '+p.note);if(!lines.length){alert('Ingen varer at kopiere');return;}try{await navigator.clipboard.writeText(lines.join('\n'));alert('Indkøbsbehov kopieret');}catch{prompt('Kopiér listen:',lines.join('\n'));}});
$('reset').addEventListener('click',()=>{state.adjustments={};save();invalidatePreview();render()});render();

function invalidatePreview(){shoppingRevision++;previewItems=[];$('preview').hidden=true;renderReminders();if(currentWeek&&!importingDish){const count=state.recipes.filter(r=>state.selected.includes(r.id)).length;$('week-message').textContent=count+' '+(count===1?'ret valgt':'retter valgt')+'. Vælg eller fravælg retter nedenfor.';}}
function neededItems(){return shoppingItems(state);}
window.addEventListener('storage',event=>{if(event.key===KEY&&event.newValue){try{state={...defaults,...JSON.parse(event.newValue)};migratePreferences();invalidatePreview();render();}catch{}}});
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
  const revision=shoppingRevision;
  const data=await api('preview',{listId,items});
  if(revision!==shoppingRevision||listId!==$('shopping-list').value){$('connection-message').textContent='Indkøbsbehovet er ændret. Gennemgå varerne igen.';return;}
  previewItems=data.items;
  $('preview-items').replaceChildren();
  previewItems.forEach(item=>{const row=el('div',undefined,'preview-item');const label=el('label'),cb=el('input');cb.type='checkbox';cb.checked=true;item.selected=cb.checked;cb.addEventListener('change',()=>item.selected=cb.checked);label.append(cb,document.createTextNode(' '+item.name+' — '+item.note));row.append(label);if(item.duplicate)row.append(el('div','Mængden lægges til den eksisterende vare. Ny samlet note: '+item.nextNote,'muted'));$('preview-items').append(row)});
  $('existing-items').replaceChildren();data.existing.forEach(item=>$('existing-items').append(el('p',displayName(item.name)+(item.note?' — '+item.note:''))));
  if(!data.existing.length)$('existing-items').append(el('p','Listen har ingen aktive varer.','muted'));
  $('preview').hidden=false;$('connection-message').textContent='Gennemgå varerne og tryk Tilføj valgte varer.';
}));
$('transfer-button').addEventListener('click',()=>busy($('transfer-button'),async()=>{
  if(transferBusy)return;
  const items=previewItems.filter(x=>x.selected).map(({name,note,aliases,gramsPerDl})=>({name,note,aliases,gramsPerDl}));
  if(!items.length)throw Error('Vælg mindst én vare.');
  transferBusy=true;$('shopping-list').disabled=true;$('preview-button').disabled=true;$('refresh-lists').disabled=true;
  $('connection-message').textContent='Tilføjer varer til eTilbudsavis...';
  try{
    const result=await api('transfer',{listId:$('shopping-list').value,items});
    invalidatePreview();
    $('connection-message').textContent=result.added.length+' varer tilføjet. '+result.updated.length+' eksisterende varer opdateret.'+(result.uncertain?' Overførslen stoppede ved '+result.uncertain+'. '+result.error+' Gennemgå varerne igen før næste forsøg.':' Se varerne i eTilbudsavis.');
  }catch(error){invalidatePreview();throw Error(error.message+' Kontrollér listen i eTilbudsavis og gennemgå varerne igen før næste forsøg.');}
  finally{transferBusy=false;$('shopping-list').disabled=false;$('preview-button').disabled=false;$('refresh-lists').disabled=false;}
}));
if(window.navigator.standalone||window.matchMedia('(display-mode: standalone)').matches)$('install').hidden=true;
api('status').then(async data=>{showConnected(data.connected);if(!data.configured)$('connection-message').textContent='Login mangler serveropsætning.';else if(data.connected)await loadLists();}).catch(error=>$('connection-message').textContent=error.message);
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});

function dishKey(dish){return JSON.stringify([dish.urls,dish.extraLines]);}
function savedDish(dish){return state.recipes.find(r=>r.sourceKey===dishKey(dish)||(!dish.extraLines.length&&dish.urls.length===1&&r.url===dish.urls[0]));}
function renderWeekDishes(){
  if(!currentWeek)return;
  const root=$('week-dishes');root.replaceChildren();
  currentWeek.dishes.forEach(dish=>{
    const saved=savedDish(dish),selected=saved&&state.selected.includes(saved.id);
    const row=el('div',undefined,'recipe row'),info=el('div',undefined,'grow');
    info.append(el('div',dish.day,'muted'),el('strong',dish.title));
    if(dish.notes)info.append(el('p',dish.notes,'muted'));
    const button=el('button',importingDish===dishKey(dish)?'Henter…':selected?'Valgt ✓':'Vælg ret',selected?'secondary':undefined);
    button.disabled=Boolean(importingDish)||!dish.urls.length;
    button.setAttribute('aria-label',(selected?'Fravælg ':'Vælg ')+dish.title);
    button.addEventListener('click',()=>chooseDish(dish));row.append(info,button);root.append(row);
  });
}
async function chooseDish(dish){
  if(importingDish)return;
  let recipe=savedDish(dish);
  if(recipe&&state.selected.includes(recipe.id)){
    state.selected=state.selected.filter(id=>id!==recipe.id);save();invalidatePreview();render();return;
  }
  importingDish=dishKey(dish);renderWeekDishes();$('week-message').textContent='Henter ingredienser til '+dish.title+'…';
  try{
    if(!recipe){
      const lines=[];
      for(const url of dish.urls){
        const response=await fetch('/api/import?url='+encodeURIComponent(url));const data=await response.json();
        if(!response.ok)throw Error(data.error||'Opskriften kunne ikke hentes.');lines.push(...data.lines);
      }
      lines.push(...dish.extraLines);
      recipe={id:crypto.randomUUID(),title:dish.title,url:dish.urls[0],lines,sourceKey:dishKey(dish)};
      state.recipes.push(recipe);
    }
    if(!state.selected.includes(recipe.id))state.selected.push(recipe.id);
    save();invalidatePreview();$('week-message').textContent='Retten er hentet. '+state.selected.length+' retter valgt. Tilpas indkøbsbehovet nedenfor.';
  }catch(error){$('week-message').textContent=error.message+' Du kan prøve igen eller bruge et opskriftslink.';}
  finally{importingDish=null;render();}
}
async function fetchWeek(){
  const id=$('week-select').value;if(!id)return;
  const request=++weekRequest;currentWeek=null;$('week-dishes').replaceChildren();$('week-source').replaceChildren();$('week-message').textContent='Henter ugens retter…';
  try{
    const response=await fetch('/api/mealplans?id='+encodeURIComponent(id)),data=await response.json();
    if(!response.ok)throw Error(data.error||'Ugens retter kunne ikke hentes.');if(request!==weekRequest)return;
    currentWeek=data;renderWeekDishes();const link=el('a','Se hele madplanen hos Sund på Budget');link.href=data.url;link.target='_blank';link.rel='noopener noreferrer';$('week-source').append(link);
    $('week-message').textContent='Vælg en eller flere retter. Du kan også hente retter fra en anden uge.';
  }catch(error){if(request===weekRequest){$('week-message').textContent=error.message;$('retry-weeks').hidden=false;}}
}
async function loadWeeks(append=false){
  $('older-weeks').disabled=true;$('retry-weeks').hidden=true;
  try{
    const page=append?weekPage+1:1;
    const response=await fetch('/api/mealplans?page='+page),data=await response.json();
    if(!response.ok)throw Error(data.error||'Ugelisten kunne ikke hentes.');
    const select=$('week-select');if(!append)select.replaceChildren();
    const ids=new Set([...select.options].map(x=>x.value));
    data.weeks.forEach(week=>{if(ids.has(String(week.id)))return;const option=el('option','Uge '+week.week+' · '+week.year);option.value=String(week.id);select.append(option)});
    weekPage=page;select.disabled=!select.options.length;$('older-weeks').hidden=!data.hasMore;
    if(!select.options.length)throw Error('Der blev ikke fundet nogen almindelige sunde madplaner.');
    if(!append){select.selectedIndex=0;await fetchWeek();}
  }catch(error){$('week-message').textContent=error.message;$('retry-weeks').hidden=false;}
  finally{$('older-weeks').disabled=false;}
}
$('week-select').addEventListener('change',fetchWeek);
$('older-weeks').addEventListener('click',()=>loadWeeks(true));
$('retry-weeks').addEventListener('click',()=>!$('week-select').disabled&&$('week-select').value?fetchWeek():loadWeeks());
loadWeeks();

function ingredientDetails(wrap,p){
  const actions=el('div',undefined,'actions');actions.style.gridColumn='1 / -1';
  const hide=el('button','Skjul fremover','secondary');hide.type='button';hide.setAttribute('aria-label','Skjul '+displayName(p.name)+' fremover');
  hide.addEventListener('click',()=>{state.hiddenIngredients=[...new Set([...state.hiddenIngredients,p.name])];save();invalidatePreview();render();});
  actions.append(hide);wrap.append(actions);
  if(p.sources.length<2&&!p.hasVolume)return;
  const details=el('details');details.style.gridColumn='1 / -1';
  details.append(el('summary',p.sources.length+' ingredienslinje'+(p.sources.length===1?'':'r')+' · se sammenlægning'+(p.hasVolume?' og omregning':'')));
  p.sources.forEach(line=>details.append(el('div',line,'muted')));
  if(p.hasVolume){
    const row=el('div',undefined,'row');const label=el('label','Gram pr. dl (ca.)');
    const input=el('input');input.type='number';input.min='0.01';input.max='1000';input.step='any';input.value=p.density||'';input.placeholder='Angiv vægt';input.style.width='110px';input.setAttribute('aria-label','Gram pr. dl for '+displayName(p.name));
    const button=el('button','Gem omregning','secondary');button.type='button';
    button.addEventListener('click',()=>{
      const density=Number(input.value);if(!Number.isFinite(density)||density<=0||density>1000){input.reportValidity();return;}
      state.densities[p.name]=density;
      // Existing pantry weights in grams remain weights; only volume values need conversion.
      const oldKey=p.name+'|ml',newKey=p.name+'|g';
      if(state.adjustments[oldKey]!==undefined){state.adjustments[newKey]=(Number(state.adjustments[newKey])||0)+Number(state.adjustments[oldKey])*density/100;delete state.adjustments[oldKey];}
      if(state.excluded.includes(oldKey)){state.excluded=state.excluded.filter(x=>x!==oldKey);if(!state.excluded.includes(newKey))state.excluded.push(newKey);}
      save();invalidatePreview();render();
    });
    label.append(input);row.append(label,button);details.append(row);
    details.append(el('p',p.density?'Volumen omregnes med ca. '+format(p.density)+' g pr. dl. Du kan rette faktoren for din vare.':'Denne råvare har ingen kendt vægtfylde. Angiv gram pr. dl for at lægge volumen og vægt sammen.','muted'));
  }
  wrap.append(details);
}

function renderHiddenIngredients(){
  const names=[...state.hiddenIngredients].sort((a,b)=>a.localeCompare(b,'da'));
  $('hidden-summary').textContent='Skjulte ingredienser ('+names.length+')';
  const root=$('hidden-ingredients');root.replaceChildren();
  if(!names.length)root.append(el('p','Brug “Skjul fremover” ved en ingrediens for at skjule den i kommende indkøbslister.','muted'));
  names.forEach(name=>{
    const row=el('div',undefined,'recipe row');row.append(el('span',displayName(name),'grow'));
    const button=el('button','Vis igen','secondary');button.type='button';button.setAttribute('aria-label','Vis '+displayName(name)+' igen');
    button.addEventListener('click',()=>{state.hiddenIngredients=state.hiddenIngredients.filter(x=>x!==name);save();invalidatePreview();render();});
    row.append(button);root.append(row);
  });
}

function updateMergeChoice(){
  const select=$('merge-name'),previous=select.value;select.replaceChildren();
  for(const name of mergeSelection){const option=el('option',displayName(name));option.value=name;select.append(option);}
  if(mergeSelection.has(previous))select.value=previous;
  select.disabled=mergeSelection.size<2;$('merge-button').disabled=mergeSelection.size<2;
}
function renderMergeIngredients(entries){
  const names=[...new Set(entries.map(p=>p.name))];
  mergeSelection=new Set([...mergeSelection].filter(x=>names.includes(x)));
  const root=$('merge-options');root.replaceChildren();
  if(names.length<2)root.append(el('p','Vælg retter med mindst to forskellige ingredienser for at sammenlægge dem.','muted'));
  for(const name of names){
    const label=el('label',undefined,'merge-option'),cb=el('input');cb.type='checkbox';cb.checked=mergeSelection.has(name);cb.setAttribute('aria-label','Sammenlæg '+displayName(name));
    cb.addEventListener('change',()=>{if(cb.checked)mergeSelection.add(name);else mergeSelection.delete(name);updateMergeChoice();});
    label.append(cb,document.createTextNode(' '+displayName(name)));root.append(label);
  }
  updateMergeChoice();
  const groups=new Map();
  for(const name of Object.keys(state.nameAliases)){const target=resolveName(name,state.nameAliases);if(!groups.has(target))groups.set(target,[target]);groups.get(target).push(name);}
  $('groups-summary').textContent='Gemte sammenlægninger ('+groups.size+')';
  const saved=$('saved-groups');saved.replaceChildren();
  if(!groups.size)saved.append(el('p','Ingen gemte sammenlægninger endnu.','muted'));
  for(const [target,variants] of groups){
    const row=el('div',undefined,'recipe row');row.append(el('span',variants.map(displayName).join(' = '),'grow'));
    const button=el('button','Ophæv gruppe','secondary');button.type='button';button.setAttribute('aria-label','Ophæv sammenlægning for '+displayName(target));
    button.addEventListener('click',()=>{const aliases={};for(const [name,value] of Object.entries(state.nameAliases))if(resolveName(name,state.nameAliases)!==target)aliases[name]=value;state.nameAliases=aliases;mergeSelection.clear();save();invalidatePreview();render();});
    row.append(button);saved.append(row);
  }
}
$('merge-button').addEventListener('click',()=>{
  try{state.nameAliases=mergeNames(state.nameAliases,[...mergeSelection],$('merge-name').value);migratePreferences();mergeSelection.clear();save();invalidatePreview();render();$('merge-message').textContent='Ingredienserne er sammenlagt og huskes på denne enhed.';}
  catch(error){$('merge-message').textContent=error.message;}
});

function renderReminders(){
  const items=neededItems(),titles=reminderTitles(items),ready=localStorage.getItem('madplan-reminders-ready')==='true';
  $('reminders-ready').checked=ready;
  $('reminders-count').textContent=titles.length+' '+(titles.length===1?'påmindelse':'påmindelser');
  const list=$('reminders-items');list.replaceChildren();
  titles.forEach(title=>list.append(el('li',title)));
  if(!titles.length)list.append(el('li','Ingen varer at sende. Vælg retter og tilpas indkøbsbehovet.','muted'));
  const link=$('reminders-export'),enabled=ready&&titles.length>0;
  link.setAttribute('aria-disabled',String(!enabled));link.tabIndex=enabled?0:-1;
  if(enabled)link.href=remindersShortcutUrl(items);else link.removeAttribute('href');
  $('reminders-message').textContent=!ready?'Følg engangsopsætningen ovenfor for at aktivere overførslen.':'';
}
function showExportTarget(){
  const reminders=$('export-target').value==='reminders';
  $('reminders-panel').hidden=!reminders;$('etilbudsavis-export').hidden=reminders;
  if(reminders){$('reminders-setup').open=localStorage.getItem('madplan-reminders-ready')!=='true';renderReminders();}
}
$('export-target').value=localStorage.getItem('madplan-export-target')==='reminders'?'reminders':'etilbudsavis';
$('export-target').addEventListener('change',()=>{localStorage.setItem('madplan-export-target',$('export-target').value);showExportTarget();});
$('reminders-ready').addEventListener('change',()=>{
  localStorage.setItem('madplan-reminders-ready',String($('reminders-ready').checked));
  $('reminders-setup').open=!$('reminders-ready').checked;renderReminders();
});
$('reminders-export').addEventListener('click',event=>{
  const items=neededItems();
  if(localStorage.getItem('madplan-reminders-ready')!=='true'||!items.length){event.preventDefault();renderReminders();return;}
  // Refresh directly in the user gesture so Safari can hand off to the native app.
  $('reminders-export').href=remindersShortcutUrl(items);
  $('reminders-message').textContent='Genveje åbnes med '+items.length+' '+(items.length===1?'vare':'varer')+'. Gennemfør genvejen, og kontrollér listen i Påmindelser.';
});
$('copy-shortcut-name').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(REMINDERS_SHORTCUT_NAME);$('reminders-message').textContent='Genvejsnavnet er kopieret.';}
  catch{$('reminders-message').textContent='Kopiér navnet manuelt: '+REMINDERS_SHORTCUT_NAME;}
});
showExportTarget();
