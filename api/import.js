import * as cheerio from 'cheerio';
const DOMAIN='sundpaabudget.dk';
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Kun GET understøttes'});
  const value=String(req.query.url||'');
  let url;try{url=new URL(value)}catch{return res.status(400).json({error:'Ugyldigt link'})}
  if(url.protocol!=='https:'||url.hostname!==DOMAIN)return res.status(400).json({error:'Kun HTTPS-links til sundpaabudget.dk er tilladt'});
  try{
    const response=await fetch(url.toString(),{headers:{'User-Agent':'MadplanPersonalRecipeImporter/0.2'},signal:AbortSignal.timeout(9000)});
    if(!response.ok)return res.status(502).json({error:'Opskriften kunne ikke hentes'});
    const html=await response.text();if(html.length>2000000)return res.status(413).json({error:'Siden er for stor'});
    const $=cheerio.load(html);
    const nodes=[];
    $('script[type="application/ld+json"]').each((_,node)=>{try{const value=JSON.parse($(node).html());const walk=x=>{if(!x||typeof x!=='object')return;if(Array.isArray(x)){x.forEach(walk);return}const type=x['@type'];if((Array.isArray(type)?type:[type]).includes('Recipe'))nodes.push(x);Object.values(x).forEach(walk)};walk(value)}catch{}});
    const recipe=nodes.find(x=>Array.isArray(x.recipeIngredient)&&x.recipeIngredient.length);
    if(!recipe)return res.status(422).json({error:'Ingen strukturerede opskriftsingredienser fundet på siden'});
    return res.status(200).json({title:String(recipe.name||$('h1').first().text()).trim(),url:url.toString(),lines:recipe.recipeIngredient.map(x=>String(x).trim()).filter(Boolean)});
  }catch{return res.status(502).json({error:'Kunne ikke hente opskriften. Prøv igen senere'})}
}
