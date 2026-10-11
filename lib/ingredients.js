export const norm = s => s.trim().toLocaleLowerCase('da-DK').replace(/\s+/g,' ');
const aliases = {'stk':'stk','stk.':'stk','styk':'stk','stykker':'stk','dåse':'dåse','dåser':'dåse','ds':'dåse','ds.':'dåse','pakke':'pakke','pakker':'pakke','ps':'pose','pose':'pose','poser':'pose','bundt':'bundt','skiver':'skive','skive':'skive','portion':'portion','skvæt':'skvæt','håndfuld':'håndfuld','fed':'fed','dl':'ml','l':'ml','kg':'g','kilogram':'g','g':'g','gr':'g','gram':'g','ml':'ml','milliliter':'ml','liter':'ml','deciliter':'ml','cl':'ml','spsk':'spsk','spsk.':'spsk','tsk':'tsk','tsk.':'tsk'};
export function parse(line) {
  const fractions = {'½':'1/2','¼':'1/4','¾':'3/4','⅓':'1/3','⅔':'2/3'};
  const s = line.trim().replace(/[½¼¾⅓⅔]/g,(x,offset)=> (offset > 0 && /\d/.test(line[offset-1]) ? ' ' : '')+fractions[x]);
  const numberPattern='(?:\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d+(?:[.,]\\d+)?)';
  const m = s.match(new RegExp('^('+numberPattern+')\\s*(?:[–—-]\\s*('+numberPattern+')\\s*)?(.*)$'));
  if (!m) return {name:line.trim(),qty:null,unit:''};
  const number=value=>{
    if(value.includes('/')){const parts=value.split(/\s+/);const [a,b]=parts.pop().split('/').map(Number);return (Number(parts[0])||0)+a/b;}
    return Number(value.replace(',','.'));
  };
  let qty=Math.max(number(m[1]),m[2]?number(m[2]):0);
  if (!Number.isFinite(qty) || qty <= 0) return {name:line.trim(),qty:null,unit:''};
  const remainder=m[3];
  const u=remainder.match(/^(kilogram|milliliter|deciliter|liter|gram|kg|gr|g|ml|cl|dl|l|stk\.?|stykker|styk|dåser?|ds\.?|pakker?|poser?|ps|bundt|skiver?|portion|skvæt|håndfuld|fed|spsk\.?|tsk\.?)\s+(.+)$/i);
  const raw=u?norm(u[1]):'stk';
  const name=(u?u[2]:remainder).trim();
  if (!name) return {name:line.trim(),qty:null,unit:''};
  if (raw==='kg'||raw==='kilogram'||raw==='l'||raw==='liter') qty*=1000;
  if (raw==='dl'||raw==='deciliter') qty*=100;
  if(raw==='cl')qty*=10;
  return {name,qty,unit:aliases[raw] || 'stk'};
}
export const format = n => new Intl.NumberFormat('da-DK',{maximumFractionDigits:2}).format(n);
export const displayName = name => name.charAt(0).toLocaleUpperCase('da-DK')+name.slice(1);
// Approximate kitchen bulk densities in grams per decilitre (dry ingredients).
// Sources: DTU Fødevareinstituttet, Mål, vægt og portionsstørrelser (2013),
// and Arla's kitchen weight tables. Users can override each factor.
export const GRAMS_PER_DL={
  'ris':80,'basmatiris':80,'jasminris':80,'brune ris':85,'fuldkornsris':85,
  'grødris':90,'risottoris':90,'vilde ris':65,
  'hvedemel':60,'fuldkornsmel':60,'grahamsmel':60,'rugmel':50,
  'havregryn':35,'havreklid':35,'bulgur':75,'couscous':75,'quinoa':70,
  'perlebyg':70,'perlespelt':70,'kartoffelmel':70,'majsmel':65,'majsstivelse':50,
  'sukker':85,'flormelis':50,
  'olie':90,'olivenolie':90,'rapsolie':90,'solsikkeolie':90,
  'mælk':100,'vand':100,'yoghurt':100,'creme fraiche':100,'tomatpuré':120,'tomatketchup':120
};
const NAME_ALIASES={
  'alm løg':'løg','almindeligt løg':'løg','almindelige løg':'løg','gult løg':'løg','gule løg':'løg','zittauerløg':'løg',
  'rødløget':'rødløg','forårsløget':'forårsløg','hvidløgsfed':'hvidløg',
  'gulerødder':'gulerod','guleroden':'gulerod','kartofler':'kartoffel','kartoflen':'kartoffel',
  'agurker':'agurk','agurken':'agurk','peberfrugter':'peberfrugt','tomater':'tomat',
  'cherrytomater':'cherrytomat','champignoner':'champignon','ægget':'æg',
  'basmati ris':'basmatiris','jasmin ris':'jasminris','brune ris':'brune ris',
  'fuldkorns ris':'fuldkornsris','grød ris':'grødris','risotto ris':'risottoris',
  'cous cous':'couscous','mel':'hvedemel','hvidt sukker':'sukker','alm sukker':'sukker',
  'maizena':'majsstivelse','maizena majsstivelse':'majsstivelse',
  'oliven olie':'olivenolie','raps olie':'rapsolie','solsikke olie':'solsikkeolie','raps':'rapsolie',
  'tomatpure':'tomatpuré','tomat pure':'tomatpuré','tomat puré':'tomatpuré',
  'kokos mælk':'kokosmælk','broccolihoved':'broccoli','broccolihoveder':'broccoli',
  'bouillonterninger':'bouillonterning','rød peber':'rød peberfrugt','røde peberfrugter':'rød peberfrugt',
  'gul peber':'gul peberfrugt','gule peberfrugter':'gul peberfrugt','grøn peber':'grøn peberfrugt','grønne peberfrugter':'grøn peberfrugt'
};
export function canonicalName(value){
  let name=norm(value).replace(/\u00a0/g,' ').replace(/\balm\./g,'alm');
  // Cooking instructions and optional alternatives do not change the primary item.
  name=name.replace(/\((?:el\.?|eller|evt\.?|gerne|valgfrit|f\.eks\.|finthakket|hakket|skåret|revet|alm\.?|almindelig|stor|lille|ca\.)[^)]*\)/g,'');
  name=name.replace(/\s+til (?:stegning|servering|pynt).*$/,'');
  // Recipe alternatives describe choices; retain the first named ingredient.
  name=name.split(/\s+(?:el\.?|eller)\s+/)[0];
  if(/^kyllingebryst[,\s]/.test(name))name='kyllingebryst';
  name=name.replace(/^(?:(?:stort?|store|små|lille|mellemstore?|mellemstort|alm\.?|almindelig(?:e|t)?)\s+)+/,'');
  name=name.replace(/^(?:finthakket|finthakkede|hakket|hakkede|revet|revne)\s+(?=(?:løg|rødløg|hvidløg|gulerod|gulerødder|kartoffel|kartofler|agurk|peberfrugt)\b)/,'');
  name=name.replace(/,?\s+(?:finthakket|finthakkede|hakket|hakkede|revet|revne|skåret i (?:tern|skiver|strimler)).*$/,'');
  name=norm(name).replace(/[.,;]+$/,'');
  return NAME_ALIASES[name]||name;
}
export function resolveName(value,userAliases={}){
  let name=canonicalName(value);const seen=new Set();
  while(Object.hasOwn(userAliases,name)&&!seen.has(name)){
    seen.add(name);name=canonicalName(userAliases[name]);
  }
  return name;
}
export function mergeNames(userAliases,names,target){
  const selected=new Set(names.map(name=>resolveName(name,userAliases)));
  target=resolveName(target,userAliases);
  if(selected.size<2||!selected.has(target))throw Error('Vælg mindst to ingredienser og et fælles navn.');
  const result={};
  for(const [name,value] of Object.entries(userAliases)){
    const resolved=resolveName(value,userAliases);result[name]=selected.has(resolved)?target:resolved;
  }
  for(const name of selected)if(name!==target)result[name]=target;
  delete result[target];return result;
}
export function canonicalAmount(item,factors={},userAliases={}){
  const name=resolveName(item.name,userAliases),density=Number(factors[name]??GRAMS_PER_DL[name])||null;
  let qty=item.qty,unit=item.unit,approximate=false;
  if(qty!==null){
    if(unit==='spsk'){qty*=15;unit='ml';}
    if(unit==='tsk'){qty*=5;unit='ml';}
    if(unit==='ml'&&density){qty=qty*density/100;unit='g';approximate=true;}
  }
  return {...item,name,qty,unit,density,approximate};
}
export function aggregateIngredients(lines,factors={},userAliases={}){
  const map=new Map();
  for(const line of lines){
    const original=parse(line),p=canonicalAmount(original,factors,userAliases),key=p.name+'|'+p.unit;
    if(!map.has(key))map.set(key,{...p,key,qty:0,sources:[],hasVolume:false,approximate:false,unknownSources:0});
    const total=map.get(key);total.sources.push(line);total.hasVolume||=['ml','spsk','tsk'].includes(original.unit);
    total.approximate||=p.approximate;
    if(p.qty===null)total.unknownSources++;else total.qty+=p.qty;
  }
  // Keep known quantities visible, with an explicit warning for unquantified lines.
  for(const [key,p] of map)if(!p.unit){
    const known=[...map.values()].filter(x=>x.name===p.name&&x.unit);
    if(known.length===1){known[0].unknownSources+=p.unknownSources;known[0].sources.push(...p.sources);map.delete(key);}
    else p.qty=null;
  }
  return [...map.values()].map(x=>({...x,qty:x.qty===null?null:Math.round(x.qty*1e6)/1e6})).sort((a,b)=>a.name.localeCompare(b.name,'da'));
}
export function migrateAdjustments(adjustments,excluded,factors={},userAliases={}){
  const result={},oldToNew=new Map();
  for(const key of new Set([...Object.keys(adjustments),...excluded])){
    const separator=key.lastIndexOf('|');if(separator<0)continue;
    const p=canonicalAmount({name:key.slice(0,separator),unit:key.slice(separator+1),qty:Math.max(0,Number(adjustments[key])||0)},factors,userAliases);
    const newKey=p.name+'|'+p.unit;oldToNew.set(key,newKey);result[newKey]=(result[newKey]||0)+p.qty;
  }
  // A merged ingredient is excluded only when every recorded variant was excluded.
  const excludedNew=[...new Set(oldToNew.values())].filter(k=>[...oldToNew].filter(([,v])=>v===k).every(([old])=>excluded.includes(old)));
  return {adjustments:result,excluded:excludedNew};
}
