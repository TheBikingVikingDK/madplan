export function planRecipes(state){
  const recipes=new Map(state.recipes.map(recipe=>[recipe.id,recipe]));
  return [...new Set(state.selected)].map(id=>recipes.get(id)).filter(Boolean);
}

export function movePlanRecipe(state,id,direction){
  const selected=planRecipes(state).map(recipe=>recipe.id),index=selected.indexOf(id);
  const target=index+direction;
  if(![-1,1].includes(direction)||index<0||target<0||target>=selected.length)return selected;
  [selected[index],selected[target]]=[selected[target],selected[index]];
  return selected;
}

export function recipeLinks(recipe){
  let original=[];
  try{const source=JSON.parse(recipe.sourceKey||'null');if(Array.isArray(source?.[0]))original=source[0];}catch{}
  const candidates=[recipe.url,...(Array.isArray(recipe.urls)?recipe.urls:[]),...original];
  const links=[];
  for(const value of candidates){
    if(typeof value!=='string'||!value.trim())continue;
    try{const url=new URL(value);if(['http:','https:'].includes(url.protocol)&&!links.includes(url.href))links.push(url.href);}catch{}
  }
  return links;
}
