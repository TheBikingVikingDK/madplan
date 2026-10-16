export const FLOW_STEPS=['Vælg retter','Tilpas indkøb','Send listen'];
export function stepFromHash(hash){
  const match=/^#trin-([1-3])$/.exec(hash);
  return match?Number(match[1]):null;
}
export function canVisitStep(step,state){
  return Number.isInteger(step)&&step>=1&&step<=FLOW_STEPS.length
    &&(step===1||state.recipes.some(recipe=>state.selected.includes(recipe.id)));
}
export function startNewPlan(state){
  return {...state,selected:[],adjustments:{},excluded:[]};
}

export function initialFlowStep(hash,savedStep,version){
  const match=/^#trin-([1-4])$/.exec(hash),saved=Number(savedStep);
  let step=match?Number(match[1]):saved||1;
  if(version!=='3'&&saved>=1&&saved<=4)step=Math.max(1,step-1);
  else if(step===4)step=3;
  return Number.isInteger(step)&&step>=1&&step<=3?step:1;
}
