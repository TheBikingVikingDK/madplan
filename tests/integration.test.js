import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { parse } from '../lib/ingredients.js';
import { seal, unseal, cookie, SESSION } from '../lib/session.js';
import { classify, transfer, query } from '../lib/etilbudsavis.js';
import handler from '../api/etilbudsavis.js';

test('Ingredients support Danish decimals, implicit pieces, fractions and mixed units',()=>{
  assert.deepEqual(parse('0,5 kg ris'),{name:'ris',qty:500,unit:'g'});
  assert.deepEqual(parse('2 løg'),{name:'løg',qty:2,unit:'stk'});
  assert.deepEqual(parse('½ dl mælk'),{name:'mælk',qty:50,unit:'ml'});
  assert.deepEqual(parse('1½ spsk. olie'),{name:'olie',qty:1.5,unit:'spsk'});
  assert.equal(parse('1-2 løg').qty,2);
  assert.equal(parse('salt og peber').qty,null);
});
test('Session hides the token and rejects tampering and expired sessions',()=>{
  process.env.SESSION_SECRET=randomBytes(32).toString('hex');
  const sealed=seal({token:'test-secret'},60);
  assert.equal(unseal(sealed).token,'test-secret');
  assert.equal(sealed.includes('test-secret'),false);
  assert.equal(unseal(sealed.slice(0,-5)+'abcde'),null);
  assert.equal(unseal(seal({token:'test'},-1)),null);
  assert.match(cookie(SESSION,sealed,60),/HttpOnly; Secure; SameSite=Strict/);
});
test('Duplicates match active names; checked-off items may be bought again',()=>{
  const items=[{name:' LØG ',note:'3 stk'},{name:'Mælk',note:'1 l'}];
  assert.deepEqual(classify(items,[{name:'løg',ticked:false},{name:'mælk',ticked:true}]).map(x=>x.duplicate),[true,false]);
});
test('Unexpected RPC data fails closed instead of treating the list as empty',async()=>{
  await assert.rejects(query('shoppingLists',{},'token',async()=>new Response('{}',{status:200})),/Kunne ikke læse/);
});
test('Transfer rereads the list, increases existing amounts, keeps notes and stops on ambiguous failure',async()=>{
  const writes=[];
  const fetcher=async(url,options)=>{
    const body=JSON.parse(options.body);
    assert.match(options.headers.Cookie,/tjek-session=/);
    if(url.endsWith('/'))return Response.json([{value:[{clientId:'onion-id',name:'Løg',count:1,shortDescription:'3 stk',ticked:false}]}]);
    writes.push(body);
    if(body.item.name==='Ris')throw Error('lost response');
    return Response.json({ok:true});
  };
  const result=await transfer(123,[{name:'løg',note:'2 stk'},{name:'Mælk',note:'500 ml'},{name:'mælk',note:'100 ml'},{name:'Ris',note:'200 g'},{name:'Pasta',note:'500 g'}],'token',fetcher);
  assert.deepEqual(result.added,['Mælk']);assert.deepEqual(result.updated,['Løg']);assert.deepEqual(result.skipped,['mælk']);
  assert.equal(result.uncertain,'Ris');assert.equal(writes.length,3);
  assert.equal(writes[0].item.count,5);assert.equal(writes[0].item.shortDescription,'5 stk');
  assert.equal(writes[1].item.count,1);assert.equal(writes[1].item.comment,'500 ml');
  assert.equal(writes[0].shoppingListId,123);
});
async function run(body,headers={}){
  const req={method:'POST',headers:{host:'madplan.example',origin:'https://madplan.example','content-type':'application/json',...headers},body};
  const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(data){this.data=data;return this}};
  await handler(req,res);return res;
}
test('API rejects cross-origin requests and unauthenticated transfers before contacting upstream',async()=>{
  assert.equal((await run({action:'login',email:'test@example.com'},{origin:'https://evil.example'})).code,403);
  assert.equal((await run({action:'transfer',listId:1,items:[]})).code,401);
  assert.equal((await run({action:'status'})).data.connected,false);
});
test('Login verification stores token only in encrypted cookies; list IDs are checked against account',async()=>{
  const original=global.fetch;
  global.fetch=async(url,options)=>{
    if(url.endsWith('auth-otp-initialize'))return Response.json({otpId:'test-otp'});
    if(url.endsWith('auth-otp-finalize'))return Response.json({token:'private-test-token'});
    return Response.json([{value:[{id:7,name:'Our list'}]}]);
  };
  try{
    const login=await run({action:'login',email:'test@example.com'});
    const pending=login.headers['Set-Cookie'].split(';')[0];
    const verified=await run({action:'verify',code:'123456'},{cookie:pending});
    assert.equal(verified.data.connected,true);
    assert.equal(JSON.stringify(verified.data).includes('private-test-token'),false);
    const auth=verified.headers['Set-Cookie'][0].split(';')[0];
    assert.equal(unseal(auth.split('=')[1]).token,'private-test-token');
    assert.equal((await run({action:'preview',listId:99,items:[]},{cookie:auth})).code,400);
  }finally{global.fetch=original;}
});
