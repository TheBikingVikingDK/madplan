import {upgradeSharedFlow} from './flow.js';
import {peopleCount,recipeCount} from './portions.js';
// Data shared by the household. Credentials and unselected saved recipes stay local.
export function sharedDocument(state,step=1,name='Ugens madplan'){
  const selected=[...new Set(state.selected)].filter(id=>state.recipes.some(recipe=>recipe.id===id));
  return {schema:1,flowVersion:5,name,step,state:{recipes:selected.map(id=>state.recipes.find(recipe=>recipe.id===id)),selected,
    people:peopleCount(state),recipeCounts:Object.fromEntries(selected.map(id=>[id,recipeCount(state,id)])),adjustments:state.adjustments,excluded:state.excluded,densities:state.densities,
    hiddenIngredients:state.hiddenIngredients,nameAliases:state.nameAliases,ingredientLabels:state.ingredientLabels||{},ingredientVersion:3},
    progress:state.planProgress||{stage:'planning',sentAt:null,fingerprint:null}};
}
export function applySharedDocument(local,document){
  const remoteIds=new Set(document.state.recipes.map(recipe=>recipe.id));
  return {...local,...document.state,people:document.state.people??4,recipeCounts:document.state.recipeCounts||{},recipes:[...local.recipes.filter(recipe=>!remoteIds.has(recipe.id)),...document.state.recipes],planProgress:document.progress};
}
export function normalizePlanCode(value){return String(value||'').replace(/[\s-]/g,'').toLowerCase();}
export function validPlanCode(value){return /^[a-f0-9]{32}$/.test(value);}
export function formatPlanCode(code){return code.toUpperCase().match(/.{1,4}/g)?.join('-')||code;}
export function validateSharedDocument(input){
  const fail=()=>{throw Object.assign(Error('Madplanens data er ugyldige eller for store.'),{status:400});};
  const str=(value,max=1000)=>{if(typeof value!=='string'||value.length>max)fail();return value;};
  const array=(value,max=500)=>{if(!Array.isArray(value)||value.length>max)fail();return value;};
  const map=(value,check)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>1000)fail();return Object.fromEntries(Object.entries(value).map(([key,v])=>{str(key,250);if(['__proto__','constructor','prototype'].includes(key))fail();return [key,check(v)];}));};
  const number=v=>{if(!Number.isFinite(v)||v<0||v>10000000)fail();return v;};
  const web=value=>{if(value==null||value==='')return '';str(value,2000);try{if(!['https:','http:'].includes(new URL(value).protocol))fail();}catch{fail();}return value;};
  if(!input||JSON.stringify(input).length>250000||input.schema!==1||!Number.isInteger(input.step)||input.step<1||input.step>(input.flowVersion===5?5:4))fail();
  const s=input.state;if(!s)fail();
  const recipes=array(s.recipes,100).map(r=>{
    if(!r||!str(r.id,100)||!str(r.title,300))fail();
    const result={id:r.id,title:r.title,lines:array(r.lines,250).map(v=>str(v)),url:web(r.url)};
    if(r.urls)result.urls=array(r.urls,10).map(web);
    if(r.image)result.image=web(r.image);
    if(r.sourceKey)result.sourceKey=str(r.sourceKey,10000);
    if(r.totalMinutes!=null)result.totalMinutes=number(r.totalMinutes);
    if(r.portionsChecked===true)result.portionsChecked=true;
    if(r.servings!=null){if(!Number.isFinite(r.servings)||r.servings<=0||r.servings>1000)fail();result.servings=r.servings;}
    if(r.extraLines)result.extraLines=array(r.extraLines,100).map(v=>str(v));
    if(r.parts)result.parts=array(r.parts,10).map(part=>{if(!part)fail();const servings=part.servings??null;if(servings!==null&&(!Number.isFinite(servings)||servings<=0||servings>1000))fail();return {title:str(part.title||'',300),url:web(part.url),lines:array(part.lines,250).map(v=>str(v)),servings};});
    return result;
  });
  if(s.people!==undefined&&(!Number.isInteger(s.people)||s.people<1||s.people>100))fail();
  const counts=map(s.recipeCounts||{},v=>{if(!Number.isInteger(v)||v<1||v>30)fail();return v;});
  const selected=array(s.selected,100).map(id=>str(id,100));
  if(new Set(recipes.map(r=>r.id)).size!==recipes.length||new Set(selected).size!==selected.length||selected.some(id=>!recipes.some(r=>r.id===id)))fail();
  if(input.step>1&&!selected.length)fail();
  const progress=input.progress||{stage:'planning'};
  if(!['planning','ready','sent','partial'].includes(progress.stage))fail();
  return {schema:1,flowVersion:5,name:str(input.name,100),step:upgradeSharedFlow(input).step,state:{recipes,selected,people:s.people??4,recipeCounts:counts,adjustments:map(s.adjustments,number),excluded:array(s.excluded).map(v=>str(v,250)),densities:map(s.densities,number),hiddenIngredients:array(s.hiddenIngredients).map(v=>str(v,250)),nameAliases:map(s.nameAliases,v=>str(v,250)),ingredientLabels:map(s.ingredientLabels||{},v=>str(v,150)),ingredientVersion:3},progress:{stage:progress.stage,sentAt:progress.sentAt?str(progress.sentAt,100):null,fingerprint:progress.fingerprint?str(progress.fingerprint,100000):null}};
}
