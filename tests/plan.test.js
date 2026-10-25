import test from 'node:test';
import assert from 'node:assert/strict';
import {planRecipes,movePlanRecipe,recipeLinks} from '../lib/plan.js';
import {shoppingItems} from '../lib/shopping.js';

test('Moving meals persists their selected order without changing shopping quantities',()=>{
  let state={recipes:[{id:'a',title:'A',lines:['100 g ris']},{id:'b',title:'B',lines:['2 dl ris']},{id:'c',title:'C',lines:['1 løg']}],selected:['a','b','c'],adjustments:{},excluded:[],hiddenIngredients:[],densities:{},nameAliases:{}};
  const before=shoppingItems(state),original=[...state.selected];
  const moved=movePlanRecipe(state,'b',-1);assert.deepEqual(state.selected,original);
  state.selected=moved;state=JSON.parse(JSON.stringify(state));
  assert.deepEqual(planRecipes(state).map(recipe=>recipe.title),['B','A','C']);
  assert.deepEqual(shoppingItems(state),before);
  assert.deepEqual(movePlanRecipe(state,'b',-1),['b','a','c']);
  assert.deepEqual(movePlanRecipe(state,'c',1),['b','a','c']);
  assert.deepEqual(movePlanRecipe(state,'missing',1),['b','a','c']);
});
test('Removing a meal preserves remaining order; newly selected meals appear last',()=>{
  const state={recipes:[{id:'a'},{id:'b'},{id:'c'}],selected:['c','a','b']};
  state.selected=state.selected.filter(id=>id!=='a');
  assert.deepEqual(planRecipes(state).map(recipe=>recipe.id),['c','b']);
  state.selected.push('a','deleted','a');
  assert.deepEqual(planRecipes(state).map(recipe=>recipe.id),['c','b','a']);
});
test('Composite and legacy recipes expose every unique web recipe link; unsafe and missing links stay absent',()=>{
  const main='https://sundpaabudget.dk/main/',side='https://sundpaabudget.dk/side/';
  assert.deepEqual(recipeLinks({url:main,sourceKey:JSON.stringify([[main,side],[]])}),[main,side]);
  assert.deepEqual(recipeLinks({url:main,urls:[main,side]}),[main,side]);
  assert.deepEqual(recipeLinks({url:'javascript:alert(1)',urls:['data:text/html,bad','not a URL'],sourceKey:'invalid'}),[]);
  assert.deepEqual(recipeLinks({}),[]);
});
