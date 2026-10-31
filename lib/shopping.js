import {aggregateIngredients,resolveName,displayName,format,parse,canonicalAmount,unitLabel} from './ingredients.js';

import {weightedRecipeLines} from './portions.js';

export function ingredientLabel(state,name){
  const resolved=resolveName(name,state.nameAliases);
  return displayName(state.ingredientLabels?.[resolved]||resolved);
}
export function setIngredientLabel(state,name,value){
  const label=String(value).trim().replace(/\s+/g,' ');
  if(!label||label.length>150)throw Error('Skriv et navn på mellem 1 og 150 tegn.');
  return {...(state.ingredientLabels||{}),[resolveName(name,state.nameAliases)]:displayName(label)};
}
export function expandIngredientLine(item){
  return [{...item,line:parse(item.line).qty===null?'1 stk '+item.line:item.line}];
}
export function selectedIngredients(state){
  const selected=new Set(state.selected);
  const entries=aggregateIngredients(state.recipes.filter(r=>selected.has(r.id)).flatMap(r=>weightedRecipeLines(state,r).flatMap(expandIngredientLine)),state.densities,state.nameAliases);
  return entries.map(p=>{
    const override=state.quantityOverrides?.[p.key]||state.quantityOverrides?.[p.name+'|'];
    if(!override)return p;
    const amount=canonicalAmount({...parse(override+' '+p.name),name:p.name},state.densities,state.nameAliases);
    return amount.qty===null?p:{...p,qty:amount.qty,unit:amount.unit,approximate:amount.approximate,unknownSources:0};
  });
}
export function quantityText(p,qty=p.qty){
  if(qty===null)return 'Mængde: se opskrift';
  return (p.approximate?'ca. ':'')+format(qty)+' '+unitLabel(p.unit,qty)+(p.unknownSources?' + mængde: se opskrift':'');
}
export function shoppingItems(state){
  const byName=new Map();
  const hidden=new Set(state.hiddenIngredients.map(x=>resolveName(x,state.nameAliases)));
  for(const p of selectedIngredients(state)){
    if(state.excluded.includes(p.key)||hidden.has(p.name))continue;
    const need=p.qty===null?null:Math.max(0,p.qty-(Number(state.adjustments[p.key])||0));
    if(need===0&&!p.unknownSources)continue;
    const note=quantityText(p,need);
    if(byName.has(p.name))byName.get(p.name).note+=' + '+note;
    else byName.set(p.name,{name:ingredientLabel(state,p.name),note,
      aliases:[p.name,...Object.keys(state.nameAliases||{}).filter(x=>resolveName(x,state.nameAliases)===p.name)],
      gramsPerDl:p.density});
  }
  return [...byName.values()];
}
