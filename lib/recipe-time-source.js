import {durationMinutes} from './recipe-time.js';
export function extractRecipeMinutes(recipe,$){
  const read=(selector)=>{
    const node=$(selector).first();
    return durationMinutes(node.attr('content')||node.attr('datetime')||node.text());
  };
  const total=durationMinutes(recipe.totalTime)||read('.wprm-recipe-total_time-container')||read('[itemprop="totalTime"]');
  if(total)return total;
  // Combine preparation and cooking only when both are explicitly supplied.
  const prep=durationMinutes(recipe.prepTime)||read('.wprm-recipe-prep_time-container')||read('[itemprop="prepTime"]');
  const cook=durationMinutes(recipe.cookTime)||read('.wprm-recipe-cook_time-container')||read('[itemprop="cookTime"]');
  const hasZero=value=>typeof value==='string'&&/^PT0[MS]$/i.test(value);
  if((prep||hasZero(recipe.prepTime))&&(cook||hasZero(recipe.cookTime)))return (prep||0)+(cook||0)||null;
  const card=$('.wprm-recipe-container, .wprm-recipe, .recipe-card').first();
  const text=card.clone();text.find('script,style').remove();
  const match=text.text().replace(/\s+/g,' ').match(/(?:samlet tid|tid i alt|total time)\s*:?\s*((?:\d+(?:[.,]\d+)?\s*(?:timer?|t\b|hours?|h\b|minutter?|min\.?|minutes?)\s*){1,2})/i);
  return match?durationMinutes(match[1]):null;
}
