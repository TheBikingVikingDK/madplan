import test from 'node:test';
import assert from 'node:assert/strict';
import {planSummary,extractDishes,getWeeks,getWeek} from '../lib/mealplans.js';
test('Only ordinary healthy mealplans qualify, with correct week/year labels',()=>{
  assert.equal(planSummary({title:{rendered:'Flexitarisk madplan uge 42, 2026'}}),null);
  assert.equal(planSummary({title:{rendered:'Single ugeplan uge 42, 2026'}}),null);
  assert.equal(planSummary({title:{rendered:'Vegetarisk madplan uge 42, 2026'}}),null);
  assert.equal(planSummary({title:{rendered:'Sund madplan uge 52, 2025 (inkl. julemiddag)'}}).week,52);
});
test('Weekly menu ignores empty stale links, keeps sides and explicit extra quantities',()=>{
  const dishes=extractDishes('<h3>UGENS SUNDE MADPLAN</h3><p><strong>Mandag:</strong> <a href="/obsolete/"></a><a href="/pasta/">Pasta</a> samt <a href="/salat/">salat</a></p><p><strong>Torsdag</strong>: <a href="/kikaertesalat/">Kikærtesalat</a><br><em>(der bruges ½ agurk samt 4 gulerødder)</em></p><h3>Andre opskrifter</h3><p>Fredag: <a href="/other/">Other</a></p>');
  assert.equal(dishes.length,2);
  assert.deepEqual(dishes[0].urls,['https://sundpaabudget.dk/pasta/','https://sundpaabudget.dk/salat/']);
  assert.equal(dishes[0].title,'Pasta samt salat');
  assert.deepEqual(dishes[1].extraLines,['½ agurk','4 gulerødder']);
});
test('Week list uses the healthy category, orders newest first and supports archive pages',async()=>{
  const fetcher=async url=>{
    if(url.includes('/categories?'))return Response.json([{id:1944,slug:'sunde-madplaner'}]);
    assert.ok(url.includes('categories=1944'));assert.ok(url.includes('page=1'));
    return Response.json([{id:1,title:{rendered:'Sund madplan uge 52, 2025'}},{id:2,title:{rendered:'Sund madplan uge 2, 2026'}}],{headers:{'x-wp-totalpages':'3'}});
  };
  const result=await getWeeks(1,fetcher);assert.equal(result.weeks[0].id,2);assert.equal(result.hasMore,true);
});
test('Individual week must also belong to the ordinary healthy category',async()=>{
  const fetcher=async url=>Response.json(url.includes('/categories?')?[{id:1944,slug:'sunde-madplaner'}]:{id:1,categories:[999],title:{rendered:'Sund madplan uge 42, 2026'},content:{rendered:''}});
  await assert.rejects(getWeek(1,fetcher),/almindelig sund/);
});
