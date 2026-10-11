export const norm = s => s.trim().toLocaleLowerCase('da-DK').replace(/\s+/g,' ');
const aliases = {'stk':'stk','stk.':'stk','styk':'stk','stykker':'stk','dåse':'dåse','dåser':'dåse','pakke':'pakke','pakker':'pakke','fed':'fed','dl':'ml','l':'ml','kg':'g','g':'g','ml':'ml','spsk':'spsk','spsk.':'spsk','tsk':'tsk','tsk.':'tsk'};
export function parse(line) {
  const fractions = {'½':'1/2','¼':'1/4','¾':'3/4','⅓':'1/3','⅔':'2/3'};
  const s = line.trim().replace(/[½¼¾⅓⅔]/g,(x,offset)=> (offset > 0 && /\d/.test(line[offset-1]) ? ' ' : '')+fractions[x]);
  const m = s.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m || /^[–—-]\s*\d/.test(m[2])) return {name:line.trim(),qty:null,unit:''};
  let qty;
  if (m[1].includes('/')) { const parts=m[1].split(/\s+/);const [a,b]=parts.pop().split('/').map(Number);qty=(Number(parts[0])||0)+a/b; }
  else qty=Number(m[1].replace(',','.'));
  if (!Number.isFinite(qty) || qty <= 0) return {name:line.trim(),qty:null,unit:''};
  const u=m[2].match(/^(kg|g|ml|dl|l|stk\.?|stykker|styk|dåser?|pakker?|fed|spsk\.?|tsk\.?)\s+(.+)$/i);
  const raw=u?norm(u[1]):'stk';
  const name=(u?u[2]:m[2]).trim();
  if (!name) return {name:line.trim(),qty:null,unit:''};
  if (raw==='kg'||raw==='l') qty*=1000;
  if (raw==='dl') qty*=100;
  return {name,qty,unit:aliases[raw] || 'stk'};
}
export const format = n => new Intl.NumberFormat('da-DK',{maximumFractionDigits:2}).format(n);
