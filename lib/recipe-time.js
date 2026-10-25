export function durationMinutes(value){
  if(typeof value!=='string')return null;
  const text=value.trim().replace(/,/g,'.');
  const iso=/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(text);
  if(iso){const minutes=Number(iso[1]||0)*1440+Number(iso[2]||0)*60+Number(iso[3]||0)+Number(iso[4]||0)/60;return minutes>0?Math.ceil(minutes):null;}
  let minutes=0,found=false;
  for(const match of text.matchAll(/(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))?\s*(timer?|tim\.?|hours?|hrs?|h\b|minutter?|min\.?|minutes?|m\b)/gi)){
    minutes+=Number(match[2]||match[1])*(/^(t|h)/i.test(match[3])?60:1);found=true;
  }
  return found&&minutes>0?Math.ceil(minutes):null;
}
export function totalRecipeMinutes(parts){
  return parts.length&&parts.every(part=>Number.isFinite(part.totalMinutes)&&part.totalMinutes>0)?parts.reduce((total,part)=>total+part.totalMinutes,0):null;
}
export function recipeTimeLabel(minutes){
  if(!Number.isFinite(minutes)||minutes<=0)return 'Tid ikke oplyst';
  const hours=Math.floor(minutes/60),rest=minutes%60;
  return 'Samlet tid: ca. '+(hours?hours+' t'+(rest?' '+rest+' min':''):minutes+' min');
}
