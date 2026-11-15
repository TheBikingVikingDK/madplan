import test from 'node:test';
import assert from 'node:assert/strict';
import { transfer } from '../lib/etilbudsavis.js';

const items = ['Iceberg','Kartofler','Løg'].map(name=>({name,note:'1 stk',aliases:[]}));
function mockFetch(failName, status=502) {
  const sent=[];
  return {sent,fetcher:async (url,options)=>{
    const body=JSON.parse(options.body);
    if(url.endsWith('/') && body.data) return {ok:true,status:200,json:async()=>[{value:[]}]};
    const name=body.item.name;
    sent.push(name);
    if(name===failName)return {ok:false,status,json:async()=>({})};
    return {ok:true,status:200,json:async()=>({})};
  }};
}
test('continues after an individual write fails and reports the missing item',async()=>{
  const {sent,fetcher}=mockFetch('Kartofler');
  const result=await transfer('list',items,'token',fetcher);
  assert.deepEqual(sent,['Iceberg','Kartofler','Løg']);
  assert.deepEqual(result.added,['Iceberg','Løg']);
  assert.deepEqual(result.failed.map(x=>x.name),['Kartofler']);
  assert.equal(result.uncertain,'Kartofler');
});
test('stops after rate limiting to avoid further rejected writes',async()=>{
  const {sent,fetcher}=mockFetch('Kartofler',429);
  const result=await transfer('list',items,'token',fetcher);
  assert.deepEqual(sent,['Iceberg','Kartofler']);
  assert.deepEqual(result.failed.map(x=>x.name),['Kartofler']);
});

test('rounds fractional piece counts up when creating items',async()=>{
  const counts=[];
  const fetcher=async(url,options)=>{
    const body=JSON.parse(options.body);
    if(body.data)return {ok:true,status:200,json:async()=>[{value:[]}]};
    counts.push(body.item.count);
    return {ok:true,status:200,json:async()=>({})};
  };
  await transfer('list',[
    {name:'Iceberg',note:'0,5 stk'},
    {name:'Æg',note:'1,5 stk'},
    {name:'Mælk',note:'1,5 liter'},
    {name:'Tomater',note:'2 stk'}
  ],'token',fetcher);
  assert.deepEqual(counts,[1,2,1,2]);
});
