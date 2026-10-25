export function parseServings(value,{structured=false}={}){
  for(const entry of Array.isArray(value)?value:[value]){
    if(typeof entry==='number'&&structured&&Number.isFinite(entry)&&entry>0&&entry<=1000)return entry;
    if(typeof entry!=='string')continue;
    const text=entry.trim().replace(/,/g,'.');
    const match=text.match(/^(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))?\s*(person(?:er)?|portion(?:er)?|servings?)?\s*$/i);
    if(!match||(!match[3]&&!structured))continue;
    const n=Number(match[2]||match[1]);if(n>0&&n<=1000)return n;
  }
  return null;
}
export function extractServings(recipe,$){
  const structured=parseServings(recipe.recipeYield,{structured:true});if(structured)return structured;
  const container=$('.wprm-recipe-servings-container').first();
  const label=container.text().replace(/^\s*(?:antal|servings?)\s*:?\s*/i,'').trim();
  const number=container.find('.wprm-recipe-servings').first().text().trim();
  const unit=container.find('.wprm-recipe-servings-unit').first().text().trim();
  return parseServings(label)||parseServings(number+' '+unit)||parseServings($('[itemprop="recipeYield"]').first().attr('content'),{structured:true})||null;
}
