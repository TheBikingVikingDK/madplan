import {cloudConfigured,createPlanStore} from '../lib/shared-store.js';
import {normalizePlanCode} from '../lib/shared-plan.js';
const store=createPlanStore();
export const config={api:{bodyParser:{sizeLimit:'300kb'}}};
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Referrer-Policy','no-referrer');
  if(req.method!=='POST')return res.status(405).json({error:'Kun POST understøttes.'});
  if(req.headers.origin!=='https://'+req.headers.host)return res.status(403).json({error:'Forespørgslen skal komme fra Madplan.'});
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({error:'JSON er påkrævet.'});
  const body=req.body;
  if(!body||typeof body!=='object'||JSON.stringify(body).length>280000)return res.status(400).json({error:'Ugyldig forespørgsel.'});
  if(body.action==='status')return res.json({configured:cloudConfigured()});
  if(!cloudConfigured())return res.status(503).json({error:'Skylagring er ikke tilsluttet endnu.'});
  try{
    const code=normalizePlanCode(body.code);
    if(body.action==='create')return res.json(await store.create(body.document));
    if(body.action==='read')return res.json(await store.read(code));
    if(body.action==='update')return res.json(await store.update(code,body.revision,body.document));
    return res.status(400).json({error:'Ukendt handling.'});
  }catch(error){return res.status(error.status||502).json({error:error.status?error.message:'Planen kunne ikke gemmes i skyen. Dine lokale ændringer er bevaret. Prøv igen.',...(error.current?{current:error.current}:{})});}
}
