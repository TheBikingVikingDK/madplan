export const FLOW_STEPS=['Vælg retter','Gennemgå retter','Tilpas indkøb','Send listen'];
export function stepFromHash(hash){
  const match=/^#trin-([1-4])$/.exec(hash);
  return match?Number(match[1]):null;
}
export function canVisitStep(step,state){
  return Number.isInteger(step)&&step>=1&&step<=FLOW_STEPS.length
    &&(step<=2||state.recipes.some(recipe=>state.selected.includes(recipe.id)));
}
export function startNewPlan(state){
  return {...state,selected:[],adjustments:{},excluded:[]};
}
