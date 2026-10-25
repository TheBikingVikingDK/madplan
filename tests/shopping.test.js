import test from 'node:test';
import assert from 'node:assert/strict';
import {shoppingItems,selectedIngredients,ingredientLabel,setIngredientLabel} from '../lib/shopping.js';
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
  assert.equal(item.name,'Eggplant');assert.deepEqual(new Set(item.aliases),new Set(['eggplant','aubergine','auberginer']));
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
  assert.equal(shoppingItems(state)[0].note,'100 g + 1 stk');
  state.selected.push('b');assert.equal(shoppingItems(state)[0].note,'120 g + 1 stk');
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
  assert.equal(p[0].nextCount,5);assert.equal(p[0].nextNote,'');
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
test('Exact pieces use only the counter, including repeated transfers; informative notes remain',async()=>{
  let existing=[];const writes=[];
  const fetcher=async(url,options)=>{
    if(url.endsWith('/'))return Response.json([{value:existing}]);
    const item=JSON.parse(options.body).item;writes.push(item);
    existing=[{...item,shortDescription:item.shortDescription??item.comment,ticked:false}];
    return Response.json({ok:true});
  };
  const items=[{name:'Peberfrugt',note:'5 stk'}];
  assert.equal(classify(items,[])[0].nextNote,'');
  assert.equal(classify(items,[])[0].nextCount,5);
  await transfer(7,items,'token',fetcher);
  assert.equal(writes[0].count,5);assert.equal(writes[0].comment,'');
  const preview=classify([{name:'Peberfrugt',note:'2 stk'}],existing)[0];
  assert.equal(preview.nextCount,7);assert.equal(preview.nextNote,'');
  await transfer(7,[{name:'Peberfrugt',note:'2 stk'}],'token',fetcher);
  assert.equal(writes[1].count,7);assert.equal(writes[1].shortDescription,'');
  const notes=['400 g','30 ml','2 fed','1 bundt','ca. 2 stk','2 stk + Økologisk','200 g + 2 stk'];
  for(const note of notes)assert.equal(classify([{name:'Test',note}],[])[0].nextNote,note);
  const custom=classify([{name:'Løg',note:'2 stk'}],[{name:'Løg',count:3,shortDescription:'Økologisk',ticked:false}])[0];
  assert.match(custom.nextNote,/Økologisk/);
});
test('Ordinary cans, packs and bags use the counter without redundant notes on add and update',async()=>{
  for(const unit of ['dåse','dåser','pk','pk.','pakke','pakker','pose','poser']){
    const items=[{name:'Testvare',note:'2 '+unit}];
    const added=classify(items,[])[0];assert.equal(added.nextCount,2);assert.equal(added.nextNote,'');
    const existing=[{clientId:'saved',name:'Testvare',count:3,shortDescription:'',ticked:false}];
    const updated=classify(items,existing)[0];assert.equal(updated.nextCount,5);assert.equal(updated.nextNote,'');
    const writes=[];const fetcher=async(url,options)=>{
      if(url.endsWith('/'))return Response.json([{value:existing}]);
      writes.push(JSON.parse(options.body).item);return Response.json({ok:true});
    };
    await transfer(7,items,'token',fetcher);
    assert.equal(writes[0].count,5);assert.equal(writes[0].shortDescription,'');
    existing.length=0;
    await transfer(7,items,'token',fetcher);
    assert.equal(writes[1].count,2);assert.equal(writes[1].comment,'');
  }
  const old=classify([{name:'Bønner',note:'2 dåser'}],[{name:'Bønner',count:1,shortDescription:'1 dåse',ticked:false}])[0];
  assert.equal(old.nextCount,3);assert.equal(old.nextNote,'');
  for(const note of ['400 g','30 ml','2 fed','1 bundt','ca. 2 pakker','1 pakke + 200 g','1 pose + Økologisk']){
    assert.equal(classify([{name:'Testvare',note}],[])[0].nextNote,note);
  }
});
test('Remembered display names survive future recipes, preserve quantities and keep canonical export matching',()=>{
  const state=initial();state.ingredientLabels=setIngredientLabel(state,'ris','Jasminris');
  assert.equal(ingredientLabel(state,'ris'),'Jasminris');
  assert.equal(shoppingItems(state).find(x=>x.name==='Jasminris').note,'200 g');
  assert.ok(shoppingItems(state).find(x=>x.name==='Jasminris').aliases.includes('ris'));
  state.recipes=[{id:'new',lines:['300 g ris']}];state.selected=['new'];
  const reloaded=JSON.parse(JSON.stringify(state));
  assert.equal(shoppingItems(reloaded)[0].name,'Jasminris');assert.equal(shoppingItems(reloaded)[0].note,'300 g');
  assert.throws(()=>setIngredientLabel(state,'ris','   '));
  assert.throws(()=>setIngredientLabel(state,'ris','x'.repeat(151)));
  delete state.ingredientLabels.ris;assert.equal(shoppingItems(state)[0].name,'Ris');
});
test('Manual quantities resolve missing amounts, convert units and feed pantry/export without changing recipe data',()=>{
  const state=initial();state.recipes=[{id:'a',lines:['bacon tern']}];
  const key=selectedIngredients(state)[0].key;
  state.quantityOverrides={[key]:'0.4 kg'};
  assert.equal(shoppingItems(state)[0].note,'400 g');
  state.adjustments[key]=100;assert.equal(shoppingItems(state)[0].note,'300 g');
  state.adjustments={};state.quantityOverrides[key]='2 pakke';assert.equal(shoppingItems(state)[0].note,'2 pakke');
  state.quantityOverrides[key]='2 dl';assert.equal(shoppingItems(state)[0].note,'200 ml');
  assert.deepEqual(state.recipes[0].lines,['bacon tern']);
  delete state.quantityOverrides[key];assert.equal(shoppingItems(state)[0].note,'1 stk');
});
test('Alternatives each become an item with an implicit piece or inherited explicit amount',()=>{
  const state=initial();state.recipes=[{id:'a',lines:['bacon i tern eller ristede græskarkerner']}];
  let items=shoppingItems(state);assert.equal(items.length,2);assert.ok(items.every(x=>x.note==='1 stk'));
  assert.ok(items.some(x=>/bacon/i.test(x.name)));assert.ok(items.some(x=>/græskarkerner/i.test(x.name)));
  state.recipes[0].lines=['200 g bacon eller 100 g græskarkerner'];items=shoppingItems(state);
  assert.ok(items.some(x=>x.note==='200 g'));assert.ok(items.some(x=>x.note==='100 g'));
});
