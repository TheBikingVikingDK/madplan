import test from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import {parseServings,extractServings} from '../lib/recipe-servings.js';
import {selectedIngredients,shoppingItems} from '../lib/shopping.js';
import {sharedDocument,applySharedDocument,validateSharedDocument} from '../lib/shared-plan.js';
const state=()=>({people:4,recipeCounts:{a:2},recipes:[{id:'a',title:'Risret',servings:1,portionsChecked:true,lines:['100 g ris','½ løg','350-400 g kyllingebryst','salt']}],selected:['a'],adjustments:{},excluded:[],densities:{},hiddenIngredients:[],nameAliases:{}});
test('1-person recipe scales to 4 people and 2 meals with ranges and fractions before aggregation',()=>{
  const s=state(),items=selectedIngredients(s);
  assert.equal(items.find(p=>p.name==='ris').qty,800);
  assert.equal(items.find(p=>p.name==='løg').qty,4);
  assert.equal(items.find(p=>p.name==='kyllingebryst').qty,3200);
  assert.equal(items.find(p=>p.name==='salt').qty,null);
  s.adjustments['ris|g']=100;assert.equal(shoppingItems(s).find(p=>p.name==='Ris').note,'700 g');
  s.recipeCounts.a=1;assert.equal(shoppingItems(s).find(p=>p.name==='Ris').note,'300 g');
  s.people=2;assert.equal(shoppingItems(s).find(p=>p.name==='Ris').note,'100 g');
  assert.equal(s.recipes[0].lines[0],'100 g ris');
});
test('Composite recipes scale each component using its own yield, with extras scaled once',()=>{
  const s=state();s.recipes[0]={id:'a',title:'Ret med tilbehør',servings:2,lines:['100 g ris','1 løg','2 tomater'],parts:[{servings:2,lines:['100 g ris']},{servings:1,lines:['1 løg']}],extraLines:['2 tomater']};
  const items=selectedIngredients(s);
  assert.equal(items.find(p=>p.name==='ris').qty,400);
  assert.equal(items.find(p=>p.name==='løg').qty,8);
  assert.equal(items.find(p=>p.name==='tomat').qty,8);
});
test('Legacy recipes default to four people and one meal without changing existing quantities',()=>{
  const s=state();delete s.people;delete s.recipeCounts;delete s.recipes[0].servings;
  assert.equal(selectedIngredients(s).find(p=>p.name==='ris').qty,100);
});
test('Yield parsing supports structured numbers, arrays, Danish people and visible recipe cards',()=>{
  assert.equal(parseServings(['4','4 personer'],{structured:true}),4);
  assert.equal(parseServings('2–4 personer'),4);
  assert.equal(parseServings(1,{structured:true}),1);
  assert.equal(parseServings('12 muffins',{structured:true}),null);
  assert.equal(parseServings('4 stk',{structured:true}),null);
  assert.equal(extractServings({},cheerio.load('<div class="wprm-recipe-servings-container">Antal <span class="wprm-recipe-servings">2</span> <span class="wprm-recipe-servings-unit">personer</span></div>')),2);
});
test('People, meal counts and source yields survive cloud validation and reopening; invalid values are rejected',()=>{
  const s=state(),document=validateSharedDocument(sharedDocument(s,2));
  const remote=applySharedDocument({...s,people:8,recipeCounts:{}},JSON.parse(JSON.stringify(document)));
  assert.equal(remote.people,4);assert.equal(remote.recipeCounts.a,2);assert.equal(remote.recipes[0].servings,1);assert.equal(remote.recipes[0].portionsChecked,true);
  assert.equal(selectedIngredients(remote).find(p=>p.name==='ris').qty,800);
  for(const n of [0,-1,1.5,101]){const bad=structuredClone(document);bad.state.people=n;assert.throws(()=>validateSharedDocument(bad));}
  const bad=structuredClone(document);bad.state.recipeCounts.a=0;assert.throws(()=>validateSharedDocument(bad));
  const legacy=structuredClone(document);delete legacy.state.people;delete legacy.state.recipeCounts;
  assert.equal(validateSharedDocument(legacy).state.people,4);
});
