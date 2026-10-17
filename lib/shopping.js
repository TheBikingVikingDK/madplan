import {aggregateIngredients,resolveName,displayName,format} from './ingredients.js';

import {weightedRecipeLines} from './portions.js';

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
    else byName.set(p.name,{name:displayName(p.name),note,
      aliases:Object.keys(state.nameAliases||{}).filter(x=>resolveName(x,state.nameAliases)===p.name),
      gramsPerDl:p.density});
  }
  return [...byName.values()];
}
