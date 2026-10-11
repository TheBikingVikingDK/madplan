import { ApiError, request, query, classify, transfer } from '../lib/etilbudsavis.js';
import { SESSION, OTP, seal, readCookie, cookie } from '../lib/session.js';

export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  if (req.method !== 'POST') return res.status(405).json({error:'Kun POST understøttes.'});
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || origin !== 'https://' + host) return res.status(403).json({error:'Forespørgslen skal komme fra Madplan.'});
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return res.status(415).json({error:'JSON er påkrævet.'});
  const body = req.body;
  if (!body || typeof body !== 'object' || JSON.stringify(body).length > 50000) return res.status(400).json({error:'Ugyldig forespørgsel.'});
  try {
    const session = readCookie(req,SESSION), pending = readCookie(req,OTP);
    if (body.action === 'status') return res.json({connected:Boolean(session?.token),configured:Boolean(process.env.SESSION_SECRET)});
    if (body.action === 'logout') {
      res.setHeader('Set-Cookie',[cookie(SESSION,'',0),cookie(OTP,'',0)]);
      return res.json({connected:false});
    }
    if (body.action === 'login') {
      if (!process.env.SESSION_SECRET) throw new ApiError('Login er ikke konfigureret på serveren.',503);
      if (pending && Date.now() - pending.sent < 60000) throw new ApiError('Vent et minut, før du beder om en ny kode.',429);
      const email = String(body.email || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new ApiError('Indtast en gyldig e-mailadresse.',400);
      const data = await request('/api/auth-otp-initialize',{apiKey:'152000596c6e45d9983eab0c14afebea',email});
      if (!data.otpId) throw new ApiError('Kunne ikke sende login-koden.');
      res.setHeader('Set-Cookie',cookie(OTP,seal({otpId:data.otpId,sent:Date.now()},600),600));
      return res.json({sent:true});
    }
    if (body.action === 'verify') {
      if (!pending?.otpId) throw new ApiError('Bed om en ny login-kode.',400);
      if (!/^\d{6}$/.test(String(body.code || ''))) throw new ApiError('Indtast den 6-cifrede kode.',400);
      const data = await request('/api/auth-otp-finalize',{apiKey:'152000596c6e45d9983eab0c14afebea',otpId:pending.otpId,otp:String(body.code)});
      if (typeof data.token !== 'string' || !data.token) throw new ApiError('Login lykkedes ikke. Bed om en ny kode.',401);
      res.setHeader('Set-Cookie',[cookie(SESSION,seal({token:data.token},2592000),2592000),cookie(OTP,'',0)]);
      return res.json({connected:true});
    }
    if (!session?.token) throw new ApiError('Log ind i eTilbudsavis først.',401);
    const lists = await query('shoppingLists',{},session.token);
    if (body.action === 'lists') return res.json({lists:lists.map(x=>({id:x.id,name:String(x.name || 'Indkøbsliste')}))});
    const list = lists.find(x=>String(x.id) === String(body.listId));
    if (!list) throw new ApiError('Vælg en af dine indkøbslister.',400);
    if (body.action === 'preview' || body.action === 'transfer') {
      if (!Array.isArray(body.items) || body.items.length > 100 || body.items.some(x => !x || typeof x.name !== 'string' || !x.name.trim() || x.name.length > 200 || typeof x.note !== 'string' || x.note.length > 200)) throw new ApiError('Ugyldige varer eller for mange varer (maks. 100).',400);
      const items = body.items.map(x=>({name:x.name.trim(),note:x.note.trim()}));
      if (body.action === 'transfer') return res.json(await transfer(list.id,items,session.token));
      const existing = await query('shoppingListItems',{shoppingListId:list.id},session.token);
      return res.json({items:classify(items,existing),existing:existing.filter(x=>!x.ticked).map(x=>({name:String(x.name || ''),note:String(x.shortDescription || '')}))});
    }
    throw new ApiError('Ukendt handling.',400);
  } catch(error) {
    return res.status(error.status || 502).json({error:error instanceof ApiError ? error.message : 'Forbindelsen kunne ikke gennemføres. Prøv igen senere.'});
  }
}
