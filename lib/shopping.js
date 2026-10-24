import {aggregateIngredients,resolveName,displayName,format} from './ingredients.js';

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
export function selectedIngredients(state){
  const selected=new Set(state.selected);
  return aggregateIngredients(state.recipes.filter(r=>selected.has(r.id)).flatMap(r=>weightedRecipeLines(state,r)),state.densities,state.nameAliases);
}
export function quantityText(p,qty=p.qty){
  if(qty===null)return 'Mængde: se opskrift';
  return (p.approximate?'ca. ':'')+format(qty)+' '+p.unit+(p.unknownSources?' + mængde: se opskrift':'');
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
