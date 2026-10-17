import test from 'node:test';
import assert from 'node:assert/strict';
import {sharedDocument,applySharedDocument,validateSharedDocument,normalizePlanCode,validPlanCode} from '../lib/shared-plan.js';
import {createPlanStore} from '../lib/shared-store.js';
import {BlobPreconditionFailedError} from '@vercel/blob';
import handler from '../api/plans.js';
const state=()=>({recipes:[{id:'a',title:'Risret',url:'https://sundpaabudget.dk/ris/',lines:['200 g ris']},{id:'private',title:'Privat opskrift',lines:['1 løg']}],selected:['a'],adjustments:{'ris|g':20},excluded:[],densities:{},hiddenIngredients:['salt'],nameAliases:{},sessionToken:'secret'});
function fakeStorage(){
  const records=new Map();let revision=0;
  return {records,async get(path,options){assert.equal(options.access,'private');assert.equal(options.useCache,false);const item=records.get(path);return item?{stream:new Response(item.body).body,blob:{etag:item.etag}}:null;},async put(path,body,options){assert.equal(options.access,'private');const old=records.get(path);if(options.ifMatch&&old?.etag!==options.ifMatch)throw new BlobPreconditionFailedError();if(!options.allowOverwrite&&old)throw Error('exists');const etag=String(++revision);records.set(path,{body,etag});return {etag};}};
}
test('Shared plans contain selected dishes and preferences but no unselected recipes or credentials',()=>{
  const local=state(),document=validateSharedDocument(sharedDocument(local,3));
  assert.deepEqual(document.state.selected,['a']);assert.equal(document.state.recipes.length,1);
  assert.equal(JSON.stringify(document).includes('secret'),false);assert.equal(JSON.stringify(document).includes('Privat opskrift'),false);
  const next=applySharedDocument(local,{...document,state:{...document.state,selected:[]}});
  assert.equal(next.recipes.some(recipe=>recipe.id==='private'),true);assert.deepEqual(next.selected,[]);
  assert.equal(validPlanCode(normalizePlanCode('ABCD-1234-abcd-1234-abcd-1234-abcd-1234')),true);
});
test('Snapshot validation rejects unsafe links, inconsistent selections, unsafe map keys and oversized data',()=>{
  let doc=sharedDocument(state(),1);doc.state.recipes[0]={...doc.state.recipes[0],url:'javascript:bad'};assert.throws(()=>validateSharedDocument(doc));
  doc=sharedDocument(state(),1);doc.state.selected=['missing'];assert.throws(()=>validateSharedDocument(doc));
  doc=sharedDocument(state(),1);doc.state.adjustments=JSON.parse('{"__proto__":4}');assert.throws(()=>validateSharedDocument(doc));
  doc=sharedDocument(state(),1);doc.state.recipes[0]={...doc.state.recipes[0],lines:['x'.repeat(1001)]};assert.throws(()=>validateSharedDocument(doc));
});
test('Private storage persists the shared step and status and rejects stale concurrent writes',async()=>{
  const backend=fakeStorage(),store=createPlanStore(backend),created=await store.create(sharedDocument(state(),2));
  assert.equal(created.code.length,32);assert.equal([...backend.records.keys()][0].includes(created.code),false);
  const loaded=await store.read(created.code);assert.equal(loaded.document.step,2);
  const first=structuredClone(loaded.document);first.step=4;first.progress.stage='sent';
  const saved=await store.update(created.code,loaded.revision,first);assert.equal(saved.document.progress.stage,'sent');
  await assert.rejects(store.update(created.code,loaded.revision,sharedDocument(state(),1)),error=>error.status===409&&error.current.document.step===4);
  assert.equal((await store.read(created.code)).revision,saved.revision);
  await assert.rejects(store.read('bad'),error=>error.status===400);
  await assert.rejects(store.read('0'.repeat(32)),error=>error.status===404);
});
test('Cloud API rejects cross-origin requests and returns no plan listing',async()=>{
  const call=async req=>{let status=200,result;const response={setHeader(){},status(code){status=code;return this;},json(body){result=body;return this;}};await handler(req,response);return {status,result};};
  assert.equal((await call({method:'POST',headers:{origin:'https://attacker.example',host:'madplan.test'},body:{action:'read'}})).status,403);
  assert.equal((await call({method:'GET',headers:{}})).status,405);
});

test('Storage transport ETag formatting cannot cause a false client revision conflict',async()=>{
  const backend=fakeStorage(),put=backend.put.bind(backend);
  backend.put=async(...args)=>{const result=await put(...args);return {etag:'different-transport-'+result.etag};};
  const store=createPlanStore(backend),created=await store.create(sharedDocument(state(),1));
  const result=await store.update(created.code,created.revision,sharedDocument(state(),2));
  assert.equal(result.document.step,2);assert.equal((await store.read(created.code)).revision,result.revision);
});
