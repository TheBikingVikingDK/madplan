import {getWeeks,getWeek} from '../lib/mealplans.js';
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Kun GET understøttes.'});
  const id=req.query.id,page=Number(req.query.page||1);
  if((id&&!/^\d{1,10}$/.test(String(id)))||!Number.isInteger(page)||page<1||page>100)return res.status(400).json({error:'Ugyldig uge eller side.'});
  try{return res.json(id?await getWeek(Number(id)):await getWeeks(page));}
  catch(error){return res.status(502).json({error:error.message});}
}
