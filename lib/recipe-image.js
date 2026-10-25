export function recipeImage(value,base){
  const values=Array.isArray(value)?value:[value];
  for(const item of values){
    const candidate=typeof item==='string'?item:item?.url||item?.contentUrl;
    if(!candidate)continue;
    try{const url=new URL(candidate,base);if(url.protocol==='https:'&&url.hostname==='sundpaabudget.dk')return url.href;}catch{}
  }
  return null;
}
