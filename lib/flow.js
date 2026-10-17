export const FLOW_STEPS=['Vælg retter','Tilpas mængder','Tilpas indkøb','Send listen','Ugens madplan'];
export function stepFromHash(hash){
  const match=/^#trin-([1-5])$/.exec(hash);
  return match?Number(match[1]):null;
}
export function canVisitStep(step,state){
  return Number.isInteger(step)&&step>=1&&step<=FLOW_STEPS.length
    &&(step===1||state.recipes.some(recipe=>state.selected.includes(recipe.id)));
}
export function startNewPlan(state){
  return {...state,selected:[],recipeCounts:{},adjustments:{},excluded:[]};
}

export function migrateSharedStep(step,version){
  return version===5?step:step>=2&&step<=4?step+1:step;
}
export function upgradeSharedFlow(document){
  return {...document,step:migrateSharedStep(document.step,document.flowVersion),flowVersion:5};
}
export function initialFlowStep(hash,savedStep,version){
  const match=/^#trin-([1-5])$/.exec(hash),saved=Number(savedStep);
  let step=match?Number(match[1]):saved||1;
  if(!['3','4-plan','5-portions'].includes(version)&&saved>=1&&saved<=4)step=Math.max(1,step-1);
  if(version!=='5-portions')step=migrateSharedStep(step,4);
  return Number.isInteger(step)&&step>=1&&step<=FLOW_STEPS.length?step:1;
}
