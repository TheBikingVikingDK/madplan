import { randomUUID } from 'node:crypto';
import { canonicalName, canonicalAmount, displayName, parse, format } from './ingredients.js';

// Wire protocol observed in eTilbudsavis and CagosDk/hacs-etilbudsavis.
const BASE = 'https://etilbudsavis.dk';
const API_KEY = '152000596c6e45d9983eab0c14afebea';
export class ApiError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}
export async function request(path, payload, token, fetcher = fetch) {
  const headers = { 'Content-Type': 'application/json', Origin: BASE,
    Referer: BASE + '/indkoebslister/aktiv', 'x-api-key': API_KEY };
  if (token) headers.Cookie = 'tjek-session=' + encodeURIComponent(JSON.stringify({ token }));
  let response;
  try { response = await fetcher(BASE + path, { method: 'POST', headers,
    body: JSON.stringify(payload), redirect: 'error', signal: AbortSignal.timeout(12000) }); }
  catch { throw new ApiError('Forbindelsen til eTilbudsavis blev afbrudt. Kontrollér listen før du prøver igen.'); }
  if ([401,403].includes(response.status)) throw new ApiError('Log ind i eTilbudsavis igen.', 401);
  if (response.status === 429) throw new ApiError('eTilbudsavis beder dig vente. Prøv igen senere.', 429);
  if (!response.ok) throw new ApiError('eTilbudsavis afviste forespørgslen. Prøv igen senere.');
  try { return await response.json(); }
  catch { throw new ApiError('eTilbudsavis svarede i et uventet format.'); }
}
export async function query(name, params, token, fetcher) {
  const key = Buffer.from(JSON.stringify([name,params])).toString('base64');
  const data = await request('/', { data: [key] }, token, fetcher);
  const entry = Array.isArray(data) ? data[0] : data;
  if (!entry || entry.error || !Array.isArray(entry.value)) throw new ApiError('Kunne ikke læse indkøbslisten. Ingen varer blev tilføjet.');
  return entry.value;
}
export const normalize = name => canonicalName(name.normalize('NFKC'));
function quantityPart(text,name,gramsPerDl){
  const clean=text.replace(/\bpk\.?(?=\s|$)/gi,'pakke').replace(/^ca\.\s*/i,'').replace(/\b(\d{1,3}(?:\.\d{3})+)(?=\s|,|$)/g,x=>x.replaceAll('.',''));
  const p=parse(clean+' __quantity__');
  if(p.qty===null||p.name!=='__quantity__')return null;
  const amount=canonicalAmount({...p,name},gramsPerDl?{[normalize(name)]:gramsPerDl}:{});
  return {...amount,approximate:amount.approximate||/^ca\./i.test(text)};
}
export function mergeQuantityNotes(notes,name,gramsPerDl){
  const amounts=new Map(),other=[];
  for(const text of notes.flatMap(note=>String(note||'').split(/\s+\+\s+/)).map(x=>x.trim()).filter(Boolean)){
    const p=quantityPart(text,name,gramsPerDl);
    if(!p){if(!other.includes(text))other.push(text);continue;}
    const old=amounts.get(p.unit)||{qty:0,approximate:false};
    old.qty+=p.qty;old.approximate||=p.approximate;amounts.set(p.unit,old);
  }
  return [...amounts].map(([unit,p])=>(p.approximate?'ca. ':'')+format(p.qty)+' '+unit).concat(other).join(' + ');
}
function matchedItem(item,existing){
  const names=new Set([item.name,...(item.aliases||[])].map(normalize));
  return existing.find(x=>!x.ticked&&names.has(normalize(String(x.name||''))));
}
const counterUnits=new Set(['stk','dåse','pakke','pose']);
function outgoingQuantity(note,name,gramsPerDl,fallbackCount=1){
  const amount=quantityPart(note,name,gramsPerDl);
  // Ordinary pieces and packages are fully represented by the counter.
  const pieces=counterUnits.has(amount?.unit);
  return {note:pieces&&!amount.approximate?'':note,count:pieces?amount.qty:fallbackCount};
}
function increasedItem(item,current){
  let oldNote=String(current.shortDescription||'').trim();
  const oldCount=Number(current.count)>0?Number(current.count):1;
  const addition=quantityPart(item.note,item.name,item.gramsPerDl);
  // For ordinary packages too, a missing note means the counter holds the quantity.
  if(!oldNote)oldNote=counterUnits.has(addition?.unit)?format(oldCount)+' '+addition.unit:'Eksisterende: '+format(oldCount)+' × (mængde ukendt)';
  const note=mergeQuantityNotes([oldNote,item.note],item.name,item.gramsPerDl);
  return outgoingQuantity(note,item.name,item.gramsPerDl,oldCount);
}
export function classify(items, existing) {
  return items.map(item=>{
    const current=matchedItem(item,existing),next=current?increasedItem(item,current):outgoingQuantity(item.note,item.name,item.gramsPerDl);
    return {...item,name:displayName(item.name),duplicate:Boolean(current),currentNote:current?String(current.shortDescription||''):null,
      nextNote:next.note,nextCount:next.count};
  });
}
export async function transfer(listId, items, token, fetcher) {
  const existing = await query('shoppingListItems', { shoppingListId: listId }, token, fetcher);
  const added = [], updated = [], skipped = [], processed=new Set();
  for (const item of items) {
    // Repeated names within one request must not create another item either.
    if (processed.has(normalize(item.name))) { skipped.push(item.name); continue; }
    try {
      const current=matchedItem(item,existing),name=displayName(item.name);
      if(current){
        if(typeof current.clientId!=='string'||!current.clientId)throw new ApiError('Varen mangler et id. Kontrollér listen i eTilbudsavis.');
        const next=increasedItem(item,current);
        if(next.note.length>200)throw new ApiError('Den samlede note er for lang. Tilpas noten i eTilbudsavis først.');
        await request('/api/shopping-list-update-item',{shoppingListId:listId,item:{
          clientId:current.clientId,name,shortDescription:next.note,count:next.count,ticked:current.ticked,
          previousClientId:current.previousClientId,businessPublicId:current.businessPublicId,
          estimatedPrice:current.estimatedPrice,departmentSlug:current.departmentSlug,updatedAt:new Date().toISOString()
        }},token,fetcher);
        updated.push(name);
      }else{
        const next=outgoingQuantity(item.note,item.name,item.gramsPerDl);
        await request('/api/shopping-list-add-item', { shoppingListId: listId,
          item: { clientId: randomUUID(), name, count: next.count, comment: next.note } }, token, fetcher);
        added.push(name);
      }
      processed.add(normalize(item.name));
    } catch (error) {
      // Never automatically retry writes: an interrupted response may hide a successful write.
      return { added, updated, skipped, uncertain: item.name, error: error.message };
    }
  }
  return { added, updated, skipped };
}
