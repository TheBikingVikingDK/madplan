import * as cheerio from 'cheerio';
const BASE='https://sundpaabudget.dk';
const clean=s=>s.replace(/\s+/g,' ').trim();
export function planSummary(post){
  const title=cheerio.load(post.title?.rendered||'').text();
  const match=title.match(/^Sund madplan uge (\d{1,2}),?\s+(\d{4})/i);
  if(!match||Number(match[1])<1||Number(match[1])>53)return null;
  return {id:post.id,title,week:Number(match[1]),year:Number(match[2]),url:post.link};
}
export function extractDishes(html){
  const $=cheerio.load(html),dishes=[];
  // Only the published weekly menu, excluding any ingredient lists below it.
  const heading=$('h2,h3,h4').filter((_,e)=>/ugens sunde madplan/i.test($(e).text())).first();
  const blocks=heading.length?heading.nextUntil('h2,h3,h4'):$('.entry-content').length?$('.entry-content').find('p'): $('p');
  blocks.each((_,element)=>{
    const node=$(element),text=clean(node.text());
    const match=text.match(/^(Mandag|Tirsdag|Onsdag|Torsdag|Fredag|Lørdag|Søndag)\s*:\s*(.+)/i);
    if(!match||dishes.some(x=>x.day.toLowerCase()===match[1].toLowerCase()))return;
    const urls=[];
    node.find('a[href]').each((_,a)=>{
      if(!clean($(a).text()))return; // Ignore abandoned empty links in old posts.
      try{const u=new URL($(a).attr('href'),BASE);if(u.protocol==='https:'&&u.hostname==='sundpaabudget.dk'&&!urls.includes(u.href))urls.push(u.href);}catch{}
    });
    const notes=clean(node.find('em').text());
    const titleNode=node.clone();titleNode.find('em').remove();
    const title=clean(titleNode.text()).replace(/^[^:]+:\s*/,'');
    const extra=notes.match(/der bruges\s+(.+?)(?:\)|$)/i);
    const extraLines=extra?extra[1].split(/\s+(?:samt|og)\s+/).map(clean).filter(x=>/^[\d½¼¾⅓⅔]/.test(x)):[];
    dishes.push({day:match[1],title,urls,notes,extraLines});
  });
  return dishes;
}
async function getJson(path,fetcher){
  const response=await fetcher(BASE+'/wp-json/wp/v2/'+path,{signal:AbortSignal.timeout(10000),redirect:'error'});
  if(!response.ok)throw Error('Sund på Budget kunne ikke hentes. Prøv igen senere.');
  try{return {data:await response.json(),pages:Number(response.headers.get('x-wp-totalpages'))||1};}
  catch{throw Error('Sund på Budget svarede i et uventet format.');}
}
export async function getCategory(fetcher=fetch){
  const {data}=await getJson('categories?slug=sunde-madplaner&_fields=id,slug',fetcher);
  const category=Array.isArray(data)&&data.find(x=>x.slug==='sunde-madplaner');
  if(!category)throw Error('Den almindelige sunde madplan blev ikke fundet.');
  return category.id;
}
export async function getWeeks(page=1,fetcher=fetch){
  const category=await getCategory(fetcher);
  const {data,pages}=await getJson(`posts?categories=${category}&per_page=50&page=${page}&orderby=date&order=desc&_fields=id,title,link,date`,fetcher);
  if(!Array.isArray(data))throw Error('Ugelisten kunne ikke læses.');
  const weeks=data.map(planSummary).filter(Boolean).sort((a,b)=>b.year-a.year||b.week-a.week);
  return {weeks,hasMore:page<pages,page};
}
export async function getWeek(id,fetcher=fetch){
  const category=await getCategory(fetcher);
  const {data}=await getJson(`posts/${id}?_fields=id,title,link,content,categories`,fetcher);
  const summary=planSummary(data);
  if(!summary||!data.categories?.includes(category))throw Error('Vælg en almindelig sund madplan.');
  const dishes=extractDishes(data.content?.rendered||'');
  if(!dishes.length)throw Error('Der blev ikke fundet retter i denne uges madplan.');
  return {...summary,dishes};
}
