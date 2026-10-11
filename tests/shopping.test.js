import test from 'node:test';
import assert from 'node:assert/strict';
import {shoppingItems,selectedIngredients} from '../lib/shopping.js';
import {mergeNames,aggregateIngredients,resolveName,canonicalName,migrateAdjustments,displayName,parse} from '../lib/ingredients.js';
import {mergeQuantityNotes,classify,transfer} from '../lib/etilbudsavis.js';
const initial=()=>({recipes:[{id:'a',lines:['200 g ris','1 alm. løg']},{id:'b',lines:['2 dl ris','2 store løg']}],selected:['a'],adjustments:{},excluded:[],densities:{},hiddenIngredients:[],nameAliases:{}});
test('Adding, removing and reselecting recipes recomputes shopping quantities and pantry reductions',()=>{
  const state=initial();const rice=()=>shoppingItems(state).find(x=>x.name==='Ris').note;
  assert.equal(rice(),'200 g');state.selected.push('b');assert.equal(rice(),'ca. 360 g');
  state.adjustments['ris|g']=100;assert.equal(rice(),'ca. 260 g');
  state.selected=state.selected.filter(id=>id!=='a');assert.equal(rice(),'ca. 60 g');
  state.selected.push('a');assert.equal(rice(),'ca. 260 g');
  state.selected=[];assert.deepEqual(shoppingItems(state),[]);
});
test('Saved custom groups work on future recipes, chain without cycles and retain compatible units',()=>{
  let aliases=mergeNames({},['aubergine','auberginer'],'aubergine');
  aliases=mergeNames(aliases,['aubergine','eggplant'],'eggplant');
  assert.equal(resolveName('auberginer',aliases),'eggplant');
  const [p]=aggregateIngredients(['200 g auberginer','300 g eggplant','100 g aubergine'],{},aliases);
  assert.equal(p.qty,600);assert.equal(p.name,'eggplant');
  assert.equal(aggregateIngredients(['1 stk aubergine','200 g eggplant'],{},aliases).length,2);
  const state=initial();state.nameAliases=aliases;state.recipes=[{id:'a',lines:['200 g auberginer']}];
  const item=shoppingItems(JSON.parse(JSON.stringify(state)))[0];
  assert.equal(item.name,'Eggplant');assert.deepEqual(new Set(item.aliases),new Set(['aubergine','auberginer']));
  state.hiddenIngredients=['aubergine'];assert.deepEqual(shoppingItems(state),[]);
});
test('Group migration keeps pantry amounts and requires all variants to be excluded',()=>{
  const aliases=mergeNames({},['aubergine','auberginer'],'aubergine');
  const p=migrateAdjustments({'aubergine|g':100,'auberginer|g':50},['auberginer|g'],{},aliases);
  assert.equal(p.adjustments['aubergine|g'],150);assert.deepEqual(p.excluded,[]);
});
test('Unknown quantities stay explicit without hiding changes to known quantities',()=>{
  const [p]=aggregateIngredients(['100 g salt','salt']);
  assert.equal(p.qty,100);assert.equal(p.unknownSources,1);
  const state=initial();state.recipes=[{id:'a',lines:['100 g salt','salt']},{id:'b',lines:['20 g salt']}];
  assert.equal(shoppingItems(state)[0].note,'100 g + mængde: se opskrift');
  state.selected.push('b');assert.equal(shoppingItems(state)[0].note,'120 g + mængde: se opskrift');
});
test('Safe spelling and preparation variants match while varieties stay distinct',()=>{
  assert.equal(canonicalName('olie til stegning'),'olie');
  assert.equal(canonicalName('tomatpure'),'tomatpuré');
  assert.equal(canonicalName('peberfrugt,'),'peberfrugt');
  assert.equal(canonicalName('kyllingebryst, -lårfilet eller -inderfilet'),'kyllingebryst');
  assert.equal(canonicalName('kyllingebryst, inderfilet eller lårfilet'),'kyllingebryst');
  assert.notEqual(canonicalName('rød peber'),canonicalName('grøn peber'));
  assert.deepEqual(parse('0,5 ds hakkede tomater'),{name:'hakkede tomater',qty:.5,unit:'dåse'});
  assert.equal(displayName('æg'),'Æg');
});
test('Quantity notes add weights, Danish thousand separators and compatible rice volumes',()=>{
  assert.equal(mergeQuantityNotes(['200 g','400 g'],'ris'),'600 g');
  assert.equal(mergeQuantityNotes(['1.600 g','400 g'],'kyllingebryst'),'2.000 g');
  assert.equal(mergeQuantityNotes(['500 ml','1 l'],'ukendt råvare'),'1.500 ml');
  assert.equal(mergeQuantityNotes(['200 g','2 dl'],'ris',80),'ca. 360 g');
  assert.equal(mergeQuantityNotes(['200 g + 1 stk','300 g'],'løg'),'500 g + 1 stk');
  assert.equal(mergeQuantityNotes(['Økologisk','400 g'],'ris'),'400 g + Økologisk');
});
test('Transfer updates saved aliases and preserves upstream metadata; checked-off items are added again',async()=>{
  const existing=[{clientId:'a',name:'Eggplant',shortDescription:'300 g',count:1,ticked:false,estimatedPrice:12,departmentSlug:'vegetables',businessPublicId:'shop'},
    {clientId:'b',name:'Ris',shortDescription:'100 g',count:1,ticked:true}];
  const writes=[];const fetcher=async(url,options)=>{
    if(url.endsWith('/'))return Response.json([{value:existing}]);
    writes.push({url,body:JSON.parse(options.body)});return Response.json({ok:true});
  };
  const items=[{name:'Aubergine',aliases:['eggplant'],note:'200 g'},{name:'Ris',note:'400 g'}];
  const preview=classify(items,existing);assert.equal(preview[0].nextNote,'500 g');assert.equal(preview[1].duplicate,false);
  const result=await transfer(7,items,'token',fetcher);
  assert.deepEqual(result.updated,['Aubergine']);assert.deepEqual(result.added,['Ris']);
  assert.match(writes[0].url,/shopping-list-update-item$/);assert.equal(writes[0].body.item.clientId,'a');
  assert.equal(writes[0].body.item.shortDescription,'500 g');assert.equal(writes[0].body.item.estimatedPrice,12);
  assert.equal(writes[0].body.item.departmentSlug,'vegetables');assert.equal(writes[0].body.item.businessPublicId,'shop');
  assert.equal(writes[1].body.item.comment,'400 g');
});
test('An existing piece counter increases; unknown weight is preserved rather than invented',()=>{
  const p=classify([{name:'Løg',note:'2 stk'},{name:'Ris',note:'200 g'}],[{name:'løg',count:3,ticked:false},{name:'ris',count:2,ticked:false}]);
  assert.equal(p[0].nextCount,5);assert.equal(p[0].nextNote,'5 stk');
  assert.equal(p[1].nextCount,2);assert.match(p[1].nextNote,/200 g/);assert.match(p[1].nextNote,/mængde ukendt/);
});
test('Ambiguous update failure stops without retrying or adding later items',async()=>{
  let calls=0;const fetcher=async(url)=>{
    if(url.endsWith('/'))return Response.json([{value:[{clientId:'a',name:'Ris',shortDescription:'200 g',count:1,ticked:false}]}]);
    calls++;throw Error('lost response');
  };
  const result=await transfer(7,[{name:'Ris',note:'400 g'},{name:'Pasta',note:'200 g'}],'token',fetcher);
  assert.equal(calls,1);assert.equal(result.uncertain,'Ris');assert.deepEqual(result.updated,[]);assert.deepEqual(result.added,[]);
});
