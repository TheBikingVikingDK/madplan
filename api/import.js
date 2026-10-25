import * as cheerio from 'cheerio';
import {parse,canonicalName} from '../lib/ingredients.js';
import {recipeImage} from '../lib/recipe-image.js';
import {extractRecipeMinutes} from '../lib/recipe-time-source.js';
import {extractServings} from '../lib/recipe-servings.js';
const DOMAIN='sundpaabudget.dk';
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Kun GET understøttes'});
  const value=String(req.query.url||'');
  let url;try{url=new URL(value)}catch{return res.status(400).json({error:'Ugyldigt link'})}
  if(url.protocol!=='https:'||url.hostname!==DOMAIN)return res.status(400).json({error:'Kun HTTPS-links til sundpaabudget.dk er tilladt'});
  try{
    const response=await fetch(url.toString(),{headers:{'User-Agent':'MadplanPersonalRecipeImporter/0.2'},redirect:'error',signal:AbortSignal.timeout(9000)});
    if(!response.ok)return res.status(502).json({error:'Opskriften kunne ikke hentes'});
    const html=await response.text();if(html.length>2000000)return res.status(413).json({error:'Siden er for stor'});
    const $=cheerio.load(html);
    const nodes=[];
    $('script[type="application/ld+json"]').each((_,node)=>{try{const value=JSON.parse($(node).html());const walk=x=>{if(!x||typeof x!=='object')return;if(Array.isArray(x)){x.forEach(walk);return}const type=x['@type'];if((Array.isArray(type)?type:[type]).includes('Recipe'))nodes.push(x);Object.values(x).forEach(walk)};walk(value)}catch{}});
    const recipe=nodes.find(x=>Array.isArray(x.recipeIngredient)&&x.recipeIngredient.length);
    if(!recipe)return res.status(422).json({error:'Ingen strukturerede opskriftsingredienser fundet på siden'});
    const amounts=new Map();
    $('.wprm-recipe-ingredient').each((_,node)=>{
      const row=$(node),name=row.find('.wprm-recipe-ingredient-name').text().trim(),amount=row.find('.wprm-recipe-ingredient-amount').text().trim(),unit=row.find('.wprm-recipe-ingredient-unit').text().trim();
      if(name&&amount){const key=canonicalName(name);const line=[amount,unit,name].filter(Boolean).join(' ');if(parse(line).qty!==null){if(amounts.has(key))amounts.set(key,null);else amounts.set(key,line);}}
    });
    const lines=recipe.recipeIngredient.map(x=>String(x).trim()).filter(Boolean).map(line=>parse(line).qty===null?(amounts.get(canonicalName(line))||line):line);
    return res.status(200).json({title:String(recipe.name||$('h1').first().text()).trim(),url:url.toString(),servings:extractServings(recipe,$),totalMinutes:extractRecipeMinutes(recipe,$),image:recipeImage(recipe.image,url.toString())||recipeImage($('meta[property="og:image"]').attr('content'),url.toString()),lines});
  }catch{return res.status(502).json({error:'Kunne ikke hente opskriften. Prøv igen senere'})}
}

