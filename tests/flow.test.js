import test from 'node:test';
import assert from 'node:assert/strict';
import {startNewPlan,canVisitStep,stepFromHash,initialFlowStep,upgradeSharedFlow} from '../lib/flow.js';

test('Starting again clears only the active plan and preserves saved recipes and ingredient preferences',()=>{
  const state={recipes:[{id:'a',lines:['100 g ris']}],selected:['a'],adjustments:{'ris|g':50},excluded:['salt|g'],hiddenIngredients:['vand'],nameAliases:{auberginer:'aubergine'},densities:{ris:80},ingredientVersion:3};
  const before=JSON.stringify(state),next=startNewPlan(state);
  assert.deepEqual(next.selected,[]);assert.deepEqual(next.adjustments,{});assert.deepEqual(next.excluded,[]);
  for(const key of ['recipes','hiddenIngredients','nameAliases','densities','ingredientVersion'])assert.deepEqual(next[key],state[key]);
  assert.equal(JSON.stringify(state),before);
});
test('Saved recipes remain reachable without a selection; shopping and sending require an existing selected recipe',()=>{
  const state={recipes:[{id:'a'}],selected:[]};
  assert.equal(canVisitStep(1,state),true);assert.equal(canVisitStep(2,state),false);
  assert.equal(canVisitStep(3,state),false);assert.equal(canVisitStep(4,state),false);
  state.selected=['deleted'];assert.equal(canVisitStep(4,state),false);
  state.selected=['a'];assert.equal(canVisitStep(2,state),true);assert.equal(canVisitStep(3,state),true);assert.equal(canVisitStep(4,state),true);
  assert.equal(stepFromHash('#trin-3'),3);assert.equal(stepFromHash('#trin-4'),4);
  assert.equal(initialFlowStep('#trin-3','3',null),3);
  assert.equal(initialFlowStep('#trin-4','4',null),4);
  assert.equal(initialFlowStep('#trin-2','2',null),1);
  assert.equal(initialFlowStep('#trin-2','2','3'),3);
  assert.equal(initialFlowStep('#trin-4','4','4-plan'),5);
  assert.equal(initialFlowStep('#trin-4','4','3'),5);
});

test('Five-step flow keeps quantities separate and migrates local and shared saved positions once',()=>{
  const state={recipes:[{id:'a'}],selected:['a']};
  assert.equal(canVisitStep(5,state),true);assert.equal(stepFromHash('#trin-5'),5);
  assert.equal(canVisitStep(5,{...state,selected:[]}),false);
  assert.equal(initialFlowStep('#trin-2','2','5-portions'),2);
  assert.equal(initialFlowStep('#trin-3','3','5-portions'),3);
  assert.equal(initialFlowStep('#trin-3','3','4-plan'),4);
  assert.equal(initialFlowStep('#trin-5',null,null),5);
  const document={schema:1,step:4,state:{selected:['a']}};
  const migrated=upgradeSharedFlow(document);assert.equal(migrated.step,5);
  assert.equal(upgradeSharedFlow(migrated).step,5);assert.equal(document.step,4);
});
