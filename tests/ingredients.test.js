import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateIngredients,canonicalName,migrateAdjustments,parse} from '../lib/ingredients.js';
test('Onion descriptions and sizes aggregate into one line',()=>{
  const result=aggregateIngredients(['1 løg','2 alm. løg','1 stort løg','2 store gule løg','1 finthakket løg']);
  assert.equal(result.length,1);assert.equal(result[0].name,'løg');assert.equal(result[0].qty,7);assert.equal(result[0].unit,'stk');
  assert.equal(result[0].sources.length,5);
});
test('Volume and weight of rice aggregate with dry-rice density',()=>{
  const [rice]=aggregateIngredients(['2 dl ris','100 ml ris','200 g ris','0,1 kg ris']);
  assert.equal(rice.qty,540);assert.equal(rice.unit,'g');assert.equal(rice.approximate,true);
  assert.equal(rice.density,80);
});
test('Exact unit conversions and ingredient-specific densities differ',()=>{
  assert.equal(aggregateIngredients(['1 spsk olie','1 tsk olie','30 ml olie'])[0].qty,45);
  assert.equal(aggregateIngredients(['2 dl mel','60 gram hvedemel'])[0].qty,180);
  assert.equal(aggregateIngredients(['2 dl sukker','100 g sukker'])[0].qty,270);
  assert.equal(parse('1 liter vand').qty,1000);assert.equal(parse('5 cl vand').qty,50);
});
test('Varieties and materially different ingredients remain separate',()=>{
  assert.equal(aggregateIngredients(['1 løg','1 rødløg','1 forårsløg']).length,3);
  assert.equal(aggregateIngredients(['100 g ris','100 g kogte ris']).length,2);
  assert.notEqual(canonicalName('hakket oksekød'),canonicalName('oksekød'));
  assert.notEqual(canonicalName('hakkede tomater'),canonicalName('tomater'));
  assert.notEqual(canonicalName('hvedemel'),canonicalName('rugmel'));
});
test('Unknown density is not guessed; custom factor enables aggregation',()=>{
  const lines=['1 dl ukendt råvare','100 g ukendt råvare'];
  assert.equal(aggregateIngredients(lines).length,2);
  const result=aggregateIngredients(lines,{'ukendt råvare':70});
  assert.equal(result.length,1);assert.equal(result[0].qty,170);
});
test('Unknown quantities do not erase a known requirement',()=>{
  const result=aggregateIngredients(['100 g ris','ris efter behov']);
  assert.equal(result.find(x=>x.name==='ris').qty,100);
  assert.equal(result.find(x=>x.name==='ris efter behov').qty,null);
});
test('Pantry and excluded values migrate to canonical names and units',()=>{
  const result=migrateAdjustments({'stort løg|stk':1,'alm løg|stk':2,'ris|ml':100,'ris|g':20},['stort løg|stk','ris|ml']);
  assert.equal(result.adjustments['løg|stk'],3);assert.equal(result.adjustments['ris|g'],100);
  assert.deepEqual(result.excluded,[]);
  assert.deepEqual(migrateAdjustments({},['alm løg|stk']).excluded,['løg|stk']);
});
test('Quantity ranges use the maximum including embedded recipe-name quantities',()=>{
  assert.deepEqual(parse('350-400 g kyllingebryst, -lårfilet eller -inderfilet'),{name:'kyllingebryst, -lårfilet eller -inderfilet',qty:400,unit:'g'});
  assert.equal(parse('350–400g kylling').qty,400);
  assert.equal(parse('400 — 350 gram kylling').qty,400);
  assert.equal(parse('0,5-0,75 kg ris').qty,750);
  assert.equal(parse('½–¾ dl mælk').qty,75);
  assert.equal(aggregateIngredients(['350-400 g kylling','200 g kylling'])[0].qty,600);
  assert.equal(parse('1-2 løg').qty,2);
});
