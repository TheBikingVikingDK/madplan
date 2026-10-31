import {favoriteKey,toggleFavorite} from './lib/favorites.js';
let currentWeek=null,weekPage=1,weekRequest=0,importingDish=null;
import {openDialog,closeDialog} from './lib/dialogs.js';
import {peopleCount,recipeCount,baseServings,recipeMultiplier} from './lib/portions.js';
import {connectCloud} from './lib/cloud.js';
import {sharedDocument,applySharedDocument} from './lib/shared-plan.js';
import {format,migrateAdjustments,displayName,resolveName,mergeNames,unitLabel} from './lib/ingredients.js';
import {selectedIngredients,shoppingItems,quantityText,ingredientLabel,setIngredientLabel} from './lib/shopping.js';
import {totalRecipeMinutes,recipeTimeLabel} from './lib/recipe-time.js';
import {planRecipes,movePlanRecipe,recipeLinks} from './lib/plan.js';
import {FLOW_STEPS,stepFromHash,canVisitStep,startNewPlan,initialFlowStep,migrateSharedStep} from './lib/flow.js';
import {REMINDERS_SHORTCUT_NAME,reminderTitles,remindersShortcutUrl} from './lib/reminders.js';

const recipeRequests=new Map(),portionRequests=new Set();
let previewRequest=0;
const incomingPlanCode=new URLSearchParams(location.hash.slice(1)).get('plan');
let sharedController=null;
const KEY='madplan-mvp-v1';
const FAVORITES_KEY='madplan-favorites-v1';
let favorites;try{favorites=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]');if(!Array.isArray(favorites))favorites=[];}catch{favorites=[];}
const defaults={people:4,recipeCounts:{},recipes:[],selected:[],adjustments:{},excluded:[],densities:{},hiddenIngredients:[],nameAliases:{},ingredientLabels:{},quantityOverrides:{}};
let state;try{state={...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{state={...defaults}};
const $=id=>document.getElementById(id);
const save=()=>{localStorage.setItem(KEY,JSON.stringify(state));sharedController?.changed();};
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
let mergeMode=false;
let wizardStep=initialFlowStep(location.hash,localStorage.getItem('madplan-step'),localStorage.getItem('madplan-flow-version')),restartSnapshot=null;
if(!canVisitStep(wizardStep,state))wizardStep=1;
localStorage.setItem('madplan-flow-version','5-portions');
history.replaceState(null,'','#trin-'+wizardStep);
function aggregate(){return selectedIngredients(state)}
function el(tag,txt,cls){const e=document.createElement(tag);if(txt!==undefined)e.textContent=txt;if(cls)e.className=cls;return e}
function render(){
  renderFavorites();
  $('people').value=peopleCount(state);$('people-minus').disabled=peopleCount(state)<=1;$('people-plus').disabled=peopleCount(state)>=100;
  $('portion-people').textContent='Madplanen er til '+peopleCount(state)+' personer. Ændr antal personer på trin 1.';renderPortionChoices();ensurePortionData();
  const count=state.recipes.filter(r=>state.selected.includes(r.id)).length;
  $('selected-count').textContent=count+' '+(count===1?'ret valgt':'retter valgt');
  $('saved-recipes-summary').textContent='Gemte retter ('+state.recipes.length+')';
  const root=$('recipes');root.replaceChildren();
  if(!state.recipes.length)root.append(el('p','Tilføj din første opskrift på trin 1.','muted'));
  state.recipes.forEach(r=>{
    const wrap=el('div',undefined,'recipe row'),check=el('input');check.type='checkbox';check.setAttribute('aria-label','Vælg '+r.title);check.checked=state.selected.includes(r.id);
    check.addEventListener('change',()=>{state.selected=check.checked?[...new Set([...state.selected,r.id])]:state.selected.filter(id=>id!==r.id);save();invalidatePreview();render();});
    const info=el('div',undefined,'grow');info.append(recipePreviewButton(r),el('div',r.lines.length+' ingredienser','muted'));
    addRecipeThumbnail(info,r);
    if(r.url){const a=el('a','Åbn opskrift');a.href=r.url;a.target='_blank';a.rel='noopener noreferrer';info.append(a);}
    const remove=el('button','Slet','danger');remove.addEventListener('click',()=>{if(!confirm('Slet opskriften?'))return;state.recipes=state.recipes.filter(x=>x.id!==r.id);state.selected=state.selected.filter(x=>x!==r.id);save();invalidatePreview();render();});
    wrap.append(check,info,remove);root.append(wrap);
  });
  const list=$('ingredients');list.replaceChildren();
  const entries=aggregate().filter(p=>!state.hiddenIngredients.includes(p.name));
  if(!entries.length)list.append(el('p',count?'Alle ingredienser er skjult. De kan vises igen nederst.':'Vælg retter for at se ingredienser.','muted'));
  entries.forEach(p=>{
    const name=ingredientLabel(state,p.name),wrap=el('div',undefined,'ingredient'),label=el('label');label.style.margin='0';
    const cb=el('input');cb.type='checkbox';cb.checked=mergeMode?mergeSelection.has(p.name):!state.excluded.includes(p.key);cb.setAttribute('aria-label',(mergeMode?'Sammenlæg ':'Medtag ')+name);
    cb.addEventListener('change',()=>{if(mergeMode){if(cb.checked)mergeSelection.add(p.name);else mergeSelection.delete(p.name);render();return;}state.excluded=cb.checked?state.excluded.filter(k=>k!==p.key):[...state.excluded,p.key];save();invalidatePreview();render();});
    label.append(cb,document.createTextNode(' '+name),el('div',quantityText(p),'muted'));
    const have=el('input');have.type='number';have.min='0';have.step='any';have.setAttribute('aria-label','Har hjemme: '+name);have.value=state.adjustments[p.key]??0;have.disabled=mergeMode||p.qty===null;
    const need=el('strong');
    const update=()=>{need.textContent=(mergeMode?!state.excluded.includes(p.key):cb.checked)?quantityText(p,p.qty===null?null:Math.max(0,p.qty-(Number(have.value)||0))):'Udeladt';};
    have.addEventListener('input',()=>{state.adjustments[p.key]=Math.max(0,Number(have.value)||0);save();invalidatePreview();update();});
    update();wrap.append(label,have,need);ingredientDetails(wrap,p);list.append(wrap);
  });
  renderMergeIngredients(entries);renderHiddenIngredients();renderWeekDishes();renderReminders();renderMealPlan();renderWizard();
}
$('import').addEventListener('click',async()=>{const url=$('url').value.trim();if(!url){$('message').textContent='Indsæt et opskriftslink først.';return}const btn=$('import');btn.disabled=true;renderWizard();$('message').textContent='Henter opskrift...';try{const response=await fetch('/api/import?url='+encodeURIComponent(url));const data=await response.json();if(!response.ok)throw Error(data.error||'Import mislykkedes');$('title').value=data.title;$('manual-servings').value=data.servings||4;$('lines').value=data.lines.join('\n');$('message').textContent='Opskriften er hentet. Gennemgå ingredienserne og tryk Gem opskrift.'}catch(e){$('message').textContent=e.message}finally{btn.disabled=false;renderWizard()}});
$('save').addEventListener('click',()=>{if(!$('manual-servings').checkValidity()){$('manual-servings').reportValidity();return;}const title=$('title').value.trim(),lines=$('lines').value.split('\n').map(x=>x.trim()).filter(Boolean);if(!title||!lines.length){$('message').textContent='Udfyld navn og mindst én ingrediens.';return}const url=$('url').value.trim();if(url&&!/^https?:\/\//i.test(url)){$('message').textContent='Link skal begynde med https://';return}const id=crypto.randomUUID();state.recipes.push({id,title,url,lines,servings:Number($('manual-servings').value)||4,portionsChecked:true});state.selected.push(id);save();invalidatePreview();$('title').value=$('url').value=$('lines').value='';$('message').textContent='Opskrift gemt på denne enhed.';render()});
$('copy').addEventListener('click',async()=>{const lines=neededItems().map(p=>p.name+' – '+p.note);if(!lines.length){alert('Ingen varer at kopiere');return;}try{await navigator.clipboard.writeText(lines.join('\n'));alert('Indkøbsbehov kopieret');}catch{prompt('Kopiér listen:',lines.join('\n'));}});
$('reset').addEventListener('click',()=>{state.adjustments={};save();invalidatePreview();render()});render();

function invalidatePreview(){shoppingRevision++;previewItems=[];$('preview').hidden=true;renderReminders();if(currentWeek&&!importingDish){const count=state.recipes.filter(r=>state.selected.includes(r.id)).length;$('week-message').textContent=count+' '+(count===1?'ret valgt':'retter valgt')+'. Vælg eller fravælg retter nedenfor.';}}
function neededItems(){return shoppingItems(state);}
function shoppingFingerprint(){return JSON.stringify(neededItems().map(({name,note})=>({name,note})).sort((a,b)=>a.name.localeCompare(b.name,'da')));}
window.addEventListener('storage',event=>{if(sharedController?.isConnected())return;if(event.key===KEY&&event.newValue){try{state={...defaults,...JSON.parse(event.newValue)};migratePreferences();invalidatePreview();render();}catch{}}});
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
  previewItems.forEach(item=>{const row=el('div',undefined,'preview-item');const label=el('label'),cb=el('input');cb.type='checkbox';cb.checked=true;item.selected=cb.checked;cb.addEventListener('change',()=>item.selected=cb.checked);label.append(cb,document.createTextNode(' '+item.name+' — '+item.note));row.append(label);if(item.duplicate)row.append(el('div','Mængden lægges til den eksisterende vare. Nyt antal: '+item.nextCount+' ×'+(item.nextNote?' — '+item.nextNote:''),'muted'));$('preview-items').append(row)});
  $('existing-items').replaceChildren();data.existing.forEach(item=>$('existing-items').append(el('p',displayName(item.name)+(item.note?' — '+item.note:''))));
  if(!data.existing.length)$('existing-items').append(el('p','Listen har ingen aktive varer.','muted'));
  $('preview').hidden=false;$('connection-message').textContent='Gennemgå varerne og tryk Tilføj valgte varer.';
}));
$('transfer-button').addEventListener('click',()=>busy($('transfer-button'),async()=>{
  if(transferBusy)return;
  const items=previewItems.filter(x=>x.selected).map(({name,note,aliases,gramsPerDl})=>({name,note,aliases,gramsPerDl}));
  if(!items.length)throw Error('Vælg mindst én vare.');
  transferBusy=true;renderWizard();$('shopping-list').disabled=true;$('preview-button').disabled=true;$('refresh-lists').disabled=true;
  $('connection-message').textContent='Tilføjer varer til eTilbudsavis...';
  try{
    const result=await api('transfer',{listId:$('shopping-list').value,items});
    invalidatePreview();
    state.planProgress={stage:result.uncertain?'partial':'sent',sentAt:new Date().toISOString(),fingerprint:shoppingFingerprint()};save();
    $('connection-message').textContent=result.added.length+' varer tilføjet. '+result.updated.length+' eksisterende varer opdateret.'+(result.uncertain?' Overførslen stoppede ved '+result.uncertain+'. '+result.error+' Gennemgå varerne igen før næste forsøg.':' Se varerne i eTilbudsavis.');
  }catch(error){invalidatePreview();throw Error(error.message+' Kontrollér listen i eTilbudsavis og gennemgå varerne igen før næste forsøg.');}
  finally{transferBusy=false;renderWizard();$('shopping-list').disabled=false;$('preview-button').disabled=false;$('refresh-lists').disabled=false;}
}));
if(window.navigator.standalone||window.matchMedia('(display-mode: standalone)').matches)$('install').hidden=true;
api('status').then(async data=>{showConnected(data.connected);if(!data.configured)$('connection-message').textContent='Login mangler serveropsætning.';else if(data.connected)await loadLists();}).catch(error=>$('connection-message').textContent=error.message);
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});

function dishKey(dish){return JSON.stringify([dish.urls,dish.extraLines]);}
function savedDish(dish){return state.recipes.find(r=>favoriteKey(r)===favoriteKey(dish)||r.sourceKey===dishKey(dish)||(!dish.extraLines.length&&dish.urls.length===1&&r.url===dish.urls[0]));}
function renderWeekDishes(){
  if(!currentWeek)return;
  const root=$('week-dishes');root.replaceChildren();
  currentWeek.dishes.forEach(dish=>{
    const saved=savedDish(dish),selected=saved&&state.selected.includes(saved.id);
    const row=el('div',undefined,'recipe row'),info=el('div',undefined,'grow');
    info.append(recipePreviewButton(dish));
    addRecipeThumbnail(info,dish);
    if(dish.notes)info.append(el('p',dish.notes,'muted'));
    const button=el('button',importingDish===dishKey(dish)?'Henter…':selected?'Valgt ✓':'Vælg ret',selected?'secondary':undefined);
    button.disabled=Boolean(importingDish)||!dish.urls.length;
    button.setAttribute('aria-label',(selected?'Fravælg ':'Vælg ')+dish.title);
    row.classList.add('week-recipe');button.classList.add('choose-recipe');button.addEventListener('click',()=>chooseDish(dish));row.append(info,button);root.append(row);
  });
}
async function chooseDish(dish){
  if(importingDish)return;
  let recipe=savedDish(dish);
  if(recipe&&state.selected.includes(recipe.id)){
    state.selected=state.selected.filter(id=>id!==recipe.id);save();invalidatePreview();render();return;
  }
  importingDish=dishKey(dish);renderWeekDishes();renderWizard();$('week-message').textContent='Henter ingredienser til '+dish.title+'…';
  try{
    if(!recipe){
      const lines=[],parts=[];let image=null;
      for(const url of dish.urls){
        const data=await fetchRecipe(url);parts.push(data);image ||= data.image;lines.push(...data.lines);
      }
      lines.push(...dish.extraLines);
      recipe={id:crypto.randomUUID(),title:dish.title,url:dish.urls[0],urls:[...dish.urls],servings:parts[0]?.servings||null,parts:parts.map(({title,url,servings,lines})=>({title,url,servings,lines})),extraLines:[...dish.extraLines],portionsChecked:true,image,totalMinutes:totalRecipeMinutes(parts),lines,sourceKey:dishKey(dish)};
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
  if(!mergeMode){
    const quantity=el('button',p.qty===null||p.unknownSources?'Angiv mængde':'Ret mængde','secondary');quantity.type='button';
    quantity.addEventListener('click',()=>{
      const form=el('form',undefined,'row'),amount=el('input'),unit=el('select');amount.type='number';amount.min='0.001';amount.step='any';amount.required=true;amount.placeholder='Mængde';amount.setAttribute('aria-label','Ønsket mængde');amount.style.width='110px';
      for(const u of ['stk','pakke','dåse','pose','g','kg','ml','dl','l','spsk','tsk','fed','bundt','skive','portion']){const plural=unitLabel(u,2);const option=el('option',u+(plural!==u?' / '+plural:''));option.value=u;unit.append(option);}unit.setAttribute('aria-label','Mængdeenhed');unit.style.width='120px';
      const submit=el('button','Gem mængde');submit.type='submit';const cancel=el('button','Annuller','secondary');cancel.type='button';cancel.addEventListener('click',()=>render());
      const reset=el('button','Brug opskriftens mængde','secondary');reset.type='button';reset.addEventListener('click',()=>{delete state.quantityOverrides[p.key];save();invalidatePreview();render();});
      const info=el('p','Samlet behov til den aktuelle madplan, før fradrag for det I har hjemme. Ret igen, hvis personer eller retter ændres.','muted');
      form.addEventListener('submit',event=>{event.preventDefault();state.quantityOverrides={...state.quantityOverrides,[p.key]:amount.value+' '+unit.value};save();invalidatePreview();render();});
      form.append(amount,unit,submit,cancel,reset,info);actions.append(form);quantity.disabled=true;amount.focus();
    });actions.append(quantity);
    for(const recipe of state.recipes.filter(r=>state.selected.includes(r.id))){
      if(!selectedIngredients({...state,recipes:[recipe],selected:[recipe.id]}).some(x=>x.name===p.name))continue;
      const source=el('button','Se opskrift','secondary');source.type='button';source.title=recipe.title;source.addEventListener('click',()=>openRecipePreview(recipe));actions.append(source);
    }
    const edit=el('button','Ret navn','secondary');edit.type='button';edit.setAttribute('aria-label','Ret navn på '+ingredientLabel(state,p.name));
    edit.addEventListener('click',()=>{
      actions.replaceChildren();
      const form=el('form',undefined,'row'),input=el('input');input.value=ingredientLabel(state,p.name);input.maxLength=150;input.required=true;input.setAttribute('aria-label','Ingrediensnavn');
      const submit=el('button','Gem navn');submit.type='submit';const cancel=el('button','Annuller','secondary');cancel.type='button';cancel.addEventListener('click',()=>render());
      const original=el('button','Brug oprindeligt navn','secondary');original.type='button';original.addEventListener('click',()=>{delete state.ingredientLabels[p.name];save();invalidatePreview();render();});
      form.addEventListener('submit',event=>{event.preventDefault();try{state.ingredientLabels=setIngredientLabel(state,p.name,input.value);save();invalidatePreview();render();$('merge-message').textContent='Navnet er gemt og bruges fremover.';}catch(error){input.setCustomValidity(error.message);input.reportValidity();}});
      input.addEventListener('input',()=>input.setCustomValidity(''));form.append(input,submit,cancel,original);actions.append(form);input.focus();input.select();
    });actions.append(edit);
  }
  const hide=el('button','Skjul fremover','secondary');hide.type='button';hide.setAttribute('aria-label','Skjul '+displayName(p.name)+' fremover');
  hide.addEventListener('click',()=>{state.hiddenIngredients=[...new Set([...state.hiddenIngredients,p.name])];save();invalidatePreview();render();});
  if(!mergeMode){actions.append(hide);const menu=el('details');menu.style.gridColumn='1 / -1';menu.append(el('summary','Ret ingrediens'),actions);wrap.append(menu);}
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
    const row=el('div',undefined,'recipe row');row.append(el('span',ingredientLabel(state,name),'grow'));
    const button=el('button','Vis igen','secondary');button.type='button';button.setAttribute('aria-label','Vis '+displayName(name)+' igen');
    button.addEventListener('click',()=>{state.hiddenIngredients=state.hiddenIngredients.filter(x=>x!==name);save();invalidatePreview();render();});
    row.append(button);root.append(row);
  });
}

function updateMergeChoice(){
  const select=$('merge-name'),previous=select.value;select.replaceChildren();
  for(const name of mergeSelection){const option=el('option',ingredientLabel(state,name));option.value=name;select.append(option);}
  if(mergeSelection.has(previous))select.value=previous;
  select.disabled=mergeSelection.size<2;$('merge-button').disabled=mergeSelection.size<2;
}
function renderMergeIngredients(entries){
  const names=[...new Set(entries.map(p=>p.name))];
  mergeSelection=new Set([...mergeSelection].filter(x=>names.includes(x)));
  $('merge-panel').hidden=!mergeMode;$('merge-toggle').textContent=mergeMode?'Afslut sammenlægning':'Slå ens ingredienser sammen';$('merge-toggle').setAttribute('aria-pressed',String(mergeMode));
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
$('merge-toggle').addEventListener('click',()=>{mergeMode=!mergeMode;mergeSelection.clear();$('merge-message').textContent='';render();});
$('merge-button').addEventListener('click',()=>{
  try{const target=$('merge-name').value;const remembered=[target,...mergeSelection].map(name=>state.ingredientLabels[name]).find(Boolean);state.nameAliases=mergeNames(state.nameAliases,[...mergeSelection],$('merge-name').value);if(remembered)state.ingredientLabels[target]=remembered;migratePreferences();mergeSelection.clear();mergeMode=false;save();invalidatePreview();render();$('merge-message').textContent='Ingredienserne er sammenlagt og huskes fremover.';}
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

function wizardBusy(){return transferBusy||Boolean(importingDish)||$('import').disabled;}
function renderWizard(){
  if(!canVisitStep(wizardStep,state)){
    wizardStep=1;sharedController?.stepChanged(1);history.replaceState(null,'','#trin-1');
  }
  const installed=window.navigator.standalone||window.matchMedia('(display-mode: standalone)').matches;
  document.querySelectorAll('[data-step]').forEach(panel=>panel.hidden=Number(panel.dataset.step)!==wizardStep||(panel.id==='install'&&installed));
  const count=state.recipes.filter(recipe=>state.selected.includes(recipe.id)).length;
  $('wizard-progress').textContent='Trin '+wizardStep+' af '+FLOW_STEPS.length+' · '+FLOW_STEPS[wizardStep-1];
  const blocked=wizardBusy();
  document.querySelectorAll('[data-step-target]').forEach(button=>{
    const target=Number(button.dataset.stepTarget);
    if(target===wizardStep)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
    button.disabled=blocked||!canVisitStep(target,state);
  });
  $('wizard-back').hidden=wizardStep===1;$('wizard-back').disabled=blocked;
  $('wizard-next').hidden=wizardStep===FLOW_STEPS.length;
  $('wizard-next').disabled=blocked||!canVisitStep(wizardStep+1,state);
  $('wizard-next').textContent='Videre: '+(FLOW_STEPS[wizardStep]||'');
  $('restart-plan').disabled=blocked;$('restart-plan').hidden=wizardStep===1;
  if(!blocked&&wizardStep===1&&count===0)$('wizard-message').textContent='Vælg mindst én ret for at gå videre til indkøbslisten.';
  else if(!blocked)$('wizard-message').textContent='';
  document.title=FLOW_STEPS[wizardStep-1]+' – Madplan';
  localStorage.setItem('madplan-step',String(wizardStep));
}
function goToStep(step,{replace=false,focus=true}={}){
  if(wizardBusy()){$('wizard-message').textContent='Vent, til den igangværende overførsel eller import er færdig.';return;}
  if(!canVisitStep(step,state))return;
  wizardStep=step;
  sharedController?.stepChanged(step);
  const hash='#trin-'+step;
  if(location.hash!==hash)history[replace?'replaceState':'pushState'](null,'',hash);
  renderWizard();
  if(focus){window.scrollTo(0,0);$('step-title-'+wizardStep).focus({preventScroll:true});}
}
document.querySelectorAll('[data-step-target]').forEach(button=>button.addEventListener('click',()=>goToStep(Number(button.dataset.stepTarget))));
$('wizard-back').addEventListener('click',()=>goToStep(wizardStep-1));
$('wizard-next').addEventListener('click',()=>goToStep(wizardStep+1));
window.addEventListener('hashchange',()=>{
  const step=stepFromHash(location.hash)||1;
  if(wizardBusy()){history.replaceState(null,'','#trin-'+wizardStep);return;}
  goToStep(canVisitStep(step,state)?step:1,{replace:true});
});
$('restart-plan').addEventListener('click',()=>{if(!wizardBusy())openDialog($('restart-dialog'));});
$('cancel-restart').addEventListener('click',()=>closeDialog($('restart-dialog')));
$('confirm-restart').addEventListener('click',()=>{
  if(wizardBusy())return;
  restartSnapshot={selected:[...state.selected],adjustments:{...state.adjustments},excluded:[...state.excluded],planProgress:state.planProgress,recipeCounts:{...state.recipeCounts},step:wizardStep,
    draft:{title:$('title').value,url:$('url').value,lines:$('lines').value}};
  state=startNewPlan(state);state.planProgress={stage:'planning',sentAt:null,fingerprint:null};mergeSelection.clear();save();invalidatePreview();
  $('title').value=$('url').value=$('lines').value='';$('message').textContent='';$('merge-message').textContent='';
  closeDialog($('restart-dialog'));$('restart-notice').hidden=false;
  wizardStep=1;render();goToStep(1,{replace:true});
  if($('week-select').options.length&&!$('week-select').disabled){$('week-select').selectedIndex=0;fetchWeek();}
});
$('undo-restart').addEventListener('click',()=>{
  if(!restartSnapshot||wizardBusy())return;
  const snapshot=restartSnapshot;restartSnapshot=null;
  state={...state,selected:snapshot.selected.filter(id=>state.recipes.some(recipe=>recipe.id===id)),adjustments:snapshot.adjustments,excluded:snapshot.excluded,planProgress:snapshot.planProgress,recipeCounts:snapshot.recipeCounts||{}};
  for(const [key,value] of Object.entries(snapshot.draft))$(key).value=value;
  migratePreferences();save();invalidatePreview();$('restart-notice').hidden=true;render();
  goToStep(canVisitStep(snapshot.step,state)?snapshot.step:1,{replace:true});
});
const initialStep=stepFromHash(location.hash)||Number(localStorage.getItem('madplan-step'))||1;
goToStep(canVisitStep(initialStep,state)?initialStep:1,{replace:true,focus:false});

function renderMealPlan(){
  const recipes=planRecipes(state),root=$('plan-recipes');root.replaceChildren();$('plan-message').textContent='';
  $('plan-count').textContent=recipes.length+' '+(recipes.length===1?'ret i din madplan':'retter i din madplan');
  if(!recipes.length){root.append(el('li','Vælg retter på trin 1 for at se din madplan.','muted'));return;}
  recipes.forEach((recipe,index)=>{
    const card=el('li',undefined,'plan-card'),heading=el('div',undefined,'row');
    const title=el('h3',recipe.title,'grow');title.id='plan-recipe-'+recipe.id;title.tabIndex=-1;
    heading.append(el('span',String(index+1),'plan-number'),title);card.append(heading);addRecipeThumbnail(card,recipe);card.append(el('p',peopleCount(state)+' personer · '+recipeCount(state,recipe.id)+' '+(recipeCount(state,recipe.id)===1?'gang':'gange')+' · '+peopleCount(state)*recipeCount(state,recipe.id)+' portioner','muted'));
    const actions=el('div',undefined,'actions'),links=recipeLinks(recipe);
    links.forEach((url,i)=>{
      const link=el('a',links.length===1?'Åbn opskrift':'Åbn opskrift '+(i+1),'button-link');
      link.href=url;link.target='_blank';link.rel='noopener noreferrer';
      link.setAttribute('aria-label','Åbn opskrift'+(links.length>1?' '+(i+1):'')+' til '+recipe.title);actions.append(link);
    });
    for(const [direction,text] of [[-1,'↑ Op'],[1,'↓ Ned']]){
      const button=el('button',text,'secondary');button.type='button';
      button.disabled=direction===-1?index===0:index===recipes.length-1;
      button.setAttribute('aria-label','Flyt '+recipe.title+(direction===-1?' op':' ned'));
      button.addEventListener('click',()=>{
        state.selected=movePlanRecipe(state,recipe.id,direction);save();renderMealPlan();
        document.getElementById('plan-recipe-'+recipe.id)?.focus({preventScroll:true});
        $('plan-message').textContent=recipe.title+' er flyttet til plads '+(state.selected.indexOf(recipe.id)+1)+'. Rækkefølgen er gemt.';
      });
      actions.append(button);
    }
    card.append(actions);
    if(!links.length)card.append(el('p','Der er ikke gemt et link til denne opskrift. Se ingredienserne nedenfor.','muted'));
    const details=el('details'),summary=el('summary','Se ingredienser');details.append(summary);
    const ingredients=el('ul');recipe.lines.forEach(line=>ingredients.append(el('li',line)));details.append(ingredients);card.append(details);
    root.append(card);
  });
}


function fetchRecipe(url){
  if(!recipeRequests.has(url)){
    const request=fetch('/api/import?url='+encodeURIComponent(url)).then(async response=>{
      const data=await response.json();if(!response.ok)throw Error(data.error||'Opskriften kunne ikke hentes.');return data;
    });
    recipeRequests.set(url,request);request.catch(()=>recipeRequests.delete(url));
  }
  return recipeRequests.get(url);
}
function previewLinks(recipe){return recipeLinks(recipe);}
function favoriteButton(recipe){
  const button=el('button',undefined,'secondary favorite-toggle');button.type='button';
  const update=()=>{const active=favorites.some(r=>favoriteKey(r)===favoriteKey(recipe));button.textContent=active?'★':'☆';button.setAttribute('aria-label',(active?'Fjern favorit: ':'Gem favorit: ')+recipe.title);button.setAttribute('aria-pressed',String(active));};update();
  button.addEventListener('click',async()=>{
    button.disabled=true;
    try{
      let saved=recipe;
      if(!favorites.some(r=>favoriteKey(r)===favoriteKey(recipe))&&!recipe.lines){
        const parts=await Promise.all(previewLinks(recipe).map(fetchRecipe));
        saved={...recipe,id:crypto.randomUUID(),servings:parts[0]?.servings||4,parts:parts.map(({title,url,servings,lines})=>({title,url,servings,lines})),lines:[...parts.flatMap(p=>p.lines),...(recipe.extraLines||[])],image:parts.find(p=>p.image)?.image,totalMinutes:totalRecipeMinutes(parts),portionsChecked:true};
      }
      favorites=toggleFavorite(favorites,saved);localStorage.setItem(FAVORITES_KEY,JSON.stringify(favorites));render();update();
    }catch(error){button.textContent='Prøv igen';button.title=error.message;}finally{button.disabled=false;}
  });return button;
}
function renderFavorites(){
  $('favorites-summary').textContent='Favoritter ('+favorites.length+')';const root=$('favorite-recipes');root.replaceChildren();
  if(!favorites.length)root.append(el('p','Tryk på ☆ ved en ret for at gemme den her. Favoritter huskes på denne enhed.','muted'));
  for(const recipe of favorites){
    const row=el('div',undefined,'recipe row'),info=el('div',undefined,'grow');info.append(recipePreviewButton(recipe));addRecipeThumbnail(info,recipe);
    const current=state.recipes.find(r=>favoriteKey(r)===favoriteKey(recipe));const selected=current&&state.selected.includes(current.id);
    const choose=el('button',selected?'Valgt ✓':'Vælg ret',selected?'secondary':undefined);choose.type='button';choose.setAttribute('aria-label',(selected?'Fravælg ':'Vælg ')+recipe.title);
    choose.addEventListener('click',()=>{let saved=current;if(!saved){saved={...recipe,id:crypto.randomUUID()};state.recipes.push(saved);}state.selected=selected?state.selected.filter(id=>id!==saved.id):[...state.selected,saved.id];save();invalidatePreview();render();});
    row.append(info,choose);root.append(row);
  }
}
function recipePreviewButton(recipe){
  const button=el('button',recipe.title,'recipe-title');button.type='button';
  button.setAttribute('aria-label','Se opskrift: '+recipe.title);
  button.addEventListener('click',()=>openRecipePreview(recipe));return button;
}
function addRecipeThumbnail(root,recipe){
  const urls=previewLinks(recipe).filter(url=>new URL(url).hostname==='sundpaabudget.dk');
  const time=el('div',recipe.totalMinutes?recipeTimeLabel(recipe.totalMinutes):urls.length?'Henter tid…':'Tid ikke oplyst','muted recipe-time');root.append(time);
  const media=el('div',undefined,'recipe-media');const button=el('button',undefined,'recipe-thumbnail');button.type='button';
  button.setAttribute('aria-label','Se billede og opskrift: '+recipe.title);
  const image=el('img');image.alt='';image.width=88;image.height=70;
  image.addEventListener('error',()=>button.hidden=true);
  image.addEventListener('load',()=>button.hidden=false);
  button.append(image);button.addEventListener('click',()=>openRecipePreview(recipe));media.append(button,favoriteButton(recipe));root.prepend(media);
  if(recipe.image)image.src=recipe.image;
  if(!urls.length)return;
  const observer=new IntersectionObserver(entries=>{
    if(!entries.some(entry=>entry.isIntersecting))return;
    observer.disconnect();
    Promise.all(urls.map(fetchRecipe)).then(parts=>{
      const minutes=totalRecipeMinutes(parts);time.textContent=recipeTimeLabel(minutes)+(minutes&&parts.length>1?' (flere opskrifter)':'');
      if(!recipe.image){const first=parts.find(part=>part.image);if(first)image.src=first.image;}
    }).catch(()=>{time.textContent=recipe.totalMinutes?recipeTimeLabel(recipe.totalMinutes):'Tid kunne ikke hentes';});
  },{rootMargin:'150px'});
  observer.observe(root);
}
async function openRecipePreview(recipe){
  const request=++previewRequest,body=$('recipe-preview-body'),links=previewLinks(recipe);
  $('recipe-preview-title').textContent=recipe.title;body.replaceChildren();
  const actions=el('div',undefined,'actions');

  links.forEach((url,index)=>{const link=el('a',links.length>1?'Åbn opskrift '+(index+1):'Åbn hele opskriften','button-link');link.href=url;link.target='_blank';link.rel='noopener noreferrer';actions.append(link);});
  body.append(actions);
  const content=el('div');body.append(content);
  if(!$('recipe-preview').open)openDialog($('recipe-preview'));
  const show=(parts)=>{
    content.replaceChildren();
    content.append(el('p',recipeTimeLabel(totalRecipeMinutes(parts)),'notice recipe-time'));
    if(parts.length>1)content.append(el('p','Tiden er summen af opskrifternes tider. Nogle dele kan muligvis laves samtidig.','muted'));
    let favoriteShown=false;
    for(const part of parts){
      if(part.image){const image=el('img',undefined,'recipe-preview-image');image.src=part.image;image.alt=part.title||recipe.title;image.addEventListener('error',()=>image.remove());const media=el('div',undefined,'preview-media');media.append(image);if(!favoriteShown){media.append(favoriteButton(recipe));favoriteShown=true;}content.append(media);}
      if(parts.length>1){content.append(el('h3',part.title),el('p',recipeTimeLabel(part.totalMinutes),'muted'));}
      if(part.lines?.length){content.append(el('p',part.servings?'Original opskrift: '+part.servings+' personer':'Antal personer er ikke oplyst i kilden.','muted'),el('h3','Ingredienser i original opskrift'));const list=el('ul');part.lines.forEach(line=>list.append(el('li',line)));content.append(list);}
    }
    if(!favoriteShown)content.prepend(favoriteButton(recipe));
    if(recipe.extraLines?.length){content.append(el('h3','Tilbehør / ekstra'));const list=el('ul');recipe.extraLines.forEach(line=>list.append(el('li',line)));content.append(list);}
  };
  if(recipe.lines)show([recipe]);else content.append(el('p','Henter billede og ingredienser…','muted'));
  const importLinks=links.filter(url=>new URL(url).hostname==='sundpaabudget.dk');
  if(!importLinks.length)return;
  try{
    const parts=await Promise.all(importLinks.map(fetchRecipe));
    if(request===previewRequest&&$('recipe-preview').open)show(parts);
  }catch{
    if(request!==previewRequest||!$('recipe-preview').open)return;
    if(!recipe.lines)content.replaceChildren(el('p','Forhåndsvisningen kunne ikke hentes. Åbn hele opskriften via linket ovenfor.','muted'));
  }
}
$('close-recipe-preview').addEventListener('click',()=>closeDialog($('recipe-preview')));
$('recipe-preview').addEventListener('close',()=>previewRequest++);


function renderSharedStatus(){
  const progress=state.planProgress||{stage:'planning'},count=state.selected.filter(id=>state.recipes.some(recipe=>recipe.id===id)).length;
  $('plan-progress').value=progress.stage;
  const labels={planning:'Vælger retter og tilpasser indkøb',ready:'Klar til indkøb',sent:'Indkøbslisten er sendt',partial:'Indkøbslisten er delvist sendt'};
  const changed=progress.fingerprint&&progress.fingerprint!==shoppingFingerprint();
  $('shared-plan-status').textContent=sharedController?.isConnected()?
    (count?count+' retter valgt':'Ingen retter valgt endnu')+' · '+(labels[progress.stage]||labels.planning)+(changed?' · Indkøbsbehov ændret siden overførslen':''):'';
}
$('plan-progress').addEventListener('change',()=>{
  const stage=$('plan-progress').value;
  state.planProgress={stage,sentAt:['sent','partial'].includes(stage)?new Date().toISOString():null,fingerprint:['sent','partial'].includes(stage)?shoppingFingerprint():null};save();renderSharedStatus();
});
function backupLocalPlan(){localStorage.setItem('madplan-before-cloud',JSON.stringify({state,step:wizardStep,flowVersion:5}));}
$('restore-local-plan').addEventListener('click',()=>{
  let backup;try{backup=JSON.parse(localStorage.getItem('madplan-before-cloud')||'null');}catch{}
  if(!backup?.state){$('cloud-message').textContent='Der er ingen lokal sikkerhedskopi endnu.';return;}
  if(sharedController?.isConnected()){$('cloud-message').textContent='Vælg Fortsæt lokalt, før du gendanner sikkerhedskopien.';return;}
  if(!confirm('Gendan den tidligere lokale plan? Den aktuelle lokale plan erstattes.'))return;
  state={...defaults,...backup.state};save();invalidatePreview();render();goToStep(canVisitStep(migrateSharedStep(backup.step,backup.flowVersion),state)?migrateSharedStep(backup.step,backup.flowVersion):1,{replace:true});renderSharedStatus();
});
sharedController=connectCloud({
  incoming:incomingPlanCode,
  getDocument:step=>sharedDocument(state,canVisitStep(step,state)?step:1),
  currentStep:()=>wizardStep,
  backup:backupLocalPlan,
  applyDocument:document=>{state=applySharedDocument(state,document);localStorage.setItem(KEY,JSON.stringify(state));invalidatePreview();render();renderSharedStatus();},
  navigate:step=>goToStep(canVisitStep(step,state)?step:1,{replace:true,focus:false}),
  canApply:()=>!wizardBusy()&&!document.querySelector('dialog[open]')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName),
  renderStatus:()=>{renderSharedStatus();ensurePortionData();}
});
renderSharedStatus();ensurePortionData();


$('people').addEventListener('change',()=>{
  if(!$('people').checkValidity()){$('people').reportValidity();return;}
  state.people=Number($('people').value);save();invalidatePreview();render();
});
function renderPortionChoices(){
  const root=$('portion-choices');root.replaceChildren();const recipes=planRecipes(state);
  $('portion-panel').hidden=!recipes.length;
  recipes.forEach(recipe=>{
    const row=el('div',undefined,'portion-card'),heading=el('div',undefined,'row'),info=el('div',undefined,'grow');
    info.append(recipePreviewButton(recipe));addRecipeThumbnail(info,recipe);
    const count=recipeCount(state,recipe.id),people=peopleCount(state);
    info.append(el('div',people+' personer × '+count+' '+(count===1?'gang':'gange')+' = '+people*count+' portioner i alt','muted'));
    const controls=el('div',undefined,'portion-controls');controls.setAttribute('aria-label','Antal gange: '+recipe.title);
    for(const direction of [-1,1]){
      const button=el('button',direction===-1?'−':'+','secondary');button.type='button';button.id='portion-'+(direction===-1?'minus-':'plus-')+recipe.id;
      button.setAttribute('aria-label',(direction===-1?'Færre':'Flere')+' gange: '+recipe.title);button.disabled=direction===-1?count<=1:count>=30;
      button.addEventListener('click',()=>{
        const next=Math.max(1,Math.min(30,recipeCount(state,recipe.id)+direction));state.recipeCounts={...state.recipeCounts,[recipe.id]:next};save();invalidatePreview();render();
        document.getElementById(button.id)?.focus({preventScroll:true});
      });
      if(direction===1){const value=el('span',count+'×');value.setAttribute('aria-label',count+' gange');controls.append(value);}
      controls.append(button);
    }
    heading.append(info);row.append(heading);
    const parts=recipe.parts?.length?recipe.parts:[recipe];
    row.append(el('div',parts.length===1?'Original: '+baseServings(parts[0])+' personer · ingredienser × '+format(recipeMultiplier(state,recipe,parts[0])):'Tilbehør og hovedret omregnes hver for sig efter deres portionsantal.','muted'));
    if(parts.some(part=>!part.servings))row.append(el('p','Portionsantal mangler'+(portionRequests.has(recipe.id)?' eller hentes':'')+'. Der regnes foreløbigt med 4 personer pr. opskrift; ret det nedenfor, hvis det ikke passer.','muted'));
    const details=el('details');details.append(el('summary','Ret originalens portionsantal'));
    parts.forEach((part,index)=>{
      const label=el('label',parts.length>1?part.title:'Opskriften er oprindeligt til'),input=el('input');input.type='number';input.min='0.5';input.max='1000';input.step='0.5';input.value=baseServings(part);
      input.setAttribute('aria-label','Originalt antal personer: '+(part.title||recipe.title));
      input.addEventListener('change',()=>{
        if(!input.checkValidity()){input.reportValidity();return;}
        part.servings=Number(input.value);recipe.portionsChecked=true;if(index===0)recipe.servings=part.servings;save();invalidatePreview();render();
      });label.append(input,document.createTextNode(' personer'));details.append(label);
    });row.append(details,controls);root.append(row);
  });
}
function ensurePortionData(){
  if(!sharedController||sharedController.isOpening())return;
  for(const recipe of planRecipes(state)){
    if(recipe.portionsChecked||portionRequests.has(recipe.id))continue;
    const urls=recipeLinks(recipe).filter(url=>new URL(url).hostname==='sundpaabudget.dk');
    if(!urls.length)continue;
    portionRequests.add(recipe.id);
    Promise.all(urls.map(fetchRecipe)).then(parts=>{
      if(!state.recipes.includes(recipe)||recipe.portionsChecked)return;
      recipe.servings=parts[0]?.servings||null;recipe.portionsChecked=true;
      const originalLines=parts.flatMap(part=>part.lines);
      let extras=[];try{extras=JSON.parse(recipe.sourceKey||'null')?.[1]||[];}catch{}
      if(parts.length>1&&JSON.stringify([...originalLines,...extras])===JSON.stringify(recipe.lines)){
        recipe.parts=parts.map(({title,url,servings,lines})=>({title,url,servings,lines}));recipe.extraLines=extras;
      }
      save();invalidatePreview();
    }).catch(()=>{recipe.portionsChecked=true;}).finally(()=>{portionRequests.delete(recipe.id);render();});
  }
}

for(const [id,change] of [['people-minus',-1],['people-plus',1]]){
  $(id).addEventListener('click',()=>{
    state.people=Math.max(1,Math.min(100,peopleCount(state)+change));save();invalidatePreview();render();$(id).focus({preventScroll:true});
  });
}
