// Keep the page fixed on mobile Safari as well as desktop browsers.
let scrollLock=null;
const listening=new WeakSet();
const bodyProperties=['position','top','left','width','paddingRight'];
function unlockIfClosed(){
  if(!scrollLock||document.querySelector('dialog[open]'))return;
  const saved=scrollLock;scrollLock=null;
  for(const property of bodyProperties)document.body.style[property]=saved.body[property];
  document.documentElement.style.overflow=saved.overflow;
  window.scrollTo(saved.x,saved.y);
}
export function openDialog(dialog){
  if(dialog.open)return;
  if(!scrollLock){
    const body=document.body,root=document.documentElement;
    const gap=Math.max(0,window.innerWidth-root.clientWidth),padding=parseFloat(getComputedStyle(body).paddingRight)||0;
    scrollLock={x:window.scrollX,y:window.scrollY,overflow:root.style.overflow,body:Object.fromEntries(bodyProperties.map(property=>[property,body.style[property]]))};
    root.style.overflow='hidden';body.style.position='fixed';body.style.top=-scrollLock.y+'px';body.style.left=-scrollLock.x+'px';body.style.width='100%';
    if(gap)body.style.paddingRight=padding+gap+'px';
  }
  if(!listening.has(dialog)){dialog.addEventListener('close',unlockIfClosed);listening.add(dialog);}
  try{dialog.showModal();}catch(error){unlockIfClosed();throw error;}
}
export function closeDialog(dialog){
  dialog.close();unlockIfClosed();
}
