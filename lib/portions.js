export function peopleCount(state){return Number.isInteger(state.people)&&state.people>=1&&state.people<=100?state.people:4;}
export function recipeCount(state,id){const n=state.recipeCounts?.[id];return Number.isInteger(n)&&n>=1&&n<=30?n:1;}
export function baseServings(recipe){return Number.isFinite(recipe.servings)&&recipe.servings>0?recipe.servings:4;}
export function recipeMultiplier(state,recipe,part=recipe){return peopleCount(state)/baseServings(part)*recipeCount(state,recipe.id);}
export function weightedRecipeLines(state,recipe){
  if(recipe.parts?.length){
    return [...recipe.parts.flatMap(part=>part.lines.map(line=>({line,multiplier:recipeMultiplier(state,recipe,part)}))),...(recipe.extraLines||[]).map(line=>({line,multiplier:recipeMultiplier(state,recipe)}))];
  }
  return recipe.lines.map(line=>({line,multiplier:recipeMultiplier(state,recipe)}));
}
