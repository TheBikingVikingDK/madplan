import {migrateSharedStep,upgradeSharedFlow} from './flow.js';
import {normalizePlanCode,validPlanCode,formatPlanCode} from './shared-plan.js';
const KEY='madplan-cloud-v1';
export function connectCloud(options){
  const $=id=>document.getElementById(id);
  let connection=null,dirty=false,saving=false,opening=false,conflict=null,applying=false,timer=null,lastWrite=0,sharedStep=1,retryDelay=1500;
  try{connection=JSON.parse(localStorage.getItem(KEY)||'null');if(!validPlanCode(connection?.code))connection=null;dirty=Boolean(connection?.dirty);}catch{}
  const persist=()=>{if(connection)localStorage.setItem(KEY,JSON.stringify({...connection,sharedStep,dirty}));else localStorage.removeItem(KEY);};
  const snapshot=()=>options.getDocument(sharedStep);
  const message=text=>{$('cloud-message').textContent=text;$('cloud-inline-message').textContent=text;};
  function showCloudDialog(focusCode=false){
    if(!$('cloud-panel').open)$('cloud-panel').showModal();
    if(focusCode)$('cloud-enter-code').focus();
  }
  $('cloud-launch').addEventListener('click',()=>showCloudDialog());
  $('cloud-close').addEventListener('click',()=>$('cloud-panel').close());
  const link=code=>location.origin+location.pathname+'#plan='+code;
  function render(){
    $('cloud-connected').hidden=!connection;$('cloud-create').hidden=Boolean(connection);$('cloud-create-area').hidden=Boolean(connection);
    const launch=$('cloud-launch'),label=connection?'Del fælles madplan':'Gem og del madplan';
    launch.setAttribute('aria-label',label);launch.title=label+(connection?' · '+(dirty?'ændringer afventer':'gemt i skyen'):'');
    launch.dataset.state=conflict?'conflict':dirty||saving?'pending':connection?'saved':'local';
    $('cloud-code').value=connection?formatPlanCode(connection.code):'';
    $('cloud-link').value=connection?link(connection.code):'';
    $('cloud-conflict').hidden=!conflict;
    $('cloud-leave').disabled=saving||opening;
    $('cloud-create').disabled=opening;$('cloud-open').disabled=opening||saving;
    $('cloud-summary').textContent=connection?'Fælles madplan · '+(dirty?'ændringer afventer':saving?'gemmer…':'gemt i skyen'):'Del eller åbn fælles madplan';
    options.renderStatus?.();
  }
  async function request(action,payload={}){
    if(!navigator.onLine)throw Error('Du er offline. Dine ændringer gemmes på enheden og sendes, når forbindelsen er tilbage.');
    const response=await fetch('/api/plans',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
    let data;try{data=await response.json();}catch{throw Error('Skyen svarede ikke som forventet. Dine ændringer er bevaret.');}
    if(!response.ok)throw Object.assign(Error(data.error||'Skylagringen kunne ikke nås.'),{status:response.status,current:data.current});
    return data;
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(flush,Math.max(retryDelay,1500-(Date.now()-lastWrite)));}
  function changed(){
    options.renderStatus?.();
    if(!connection||applying||opening)return;
    dirty=true;retryDelay=1500;persist();render();message('Ændringer gemmes automatisk…');schedule();
  }
  async function apply(record,{navigate=false}={}){
    record={...record,document:upgradeSharedFlow(record.document)};
    applying=true;
    try{sharedStep=record.document.step;options.applyDocument(record.document);if(navigate)options.navigate(sharedStep);}
    finally{applying=false;}
    connection={code:connection.code,revision:record.revision,document:record.document,updatedAt:record.updatedAt};
    dirty=false;conflict=null;persist();render();
  }
  async function flush(){
    if(!connection||!dirty||saving||opening||conflict)return;
    saving=true;render();const code=connection.code,document=snapshot();
    try{
      const result=await request('update',{code,revision:connection.revision,document});
      if(connection?.code!==code)return;
      connection={code,revision:result.revision,document:result.document,updatedAt:result.updatedAt};
      dirty=JSON.stringify(snapshot())!==JSON.stringify(document);lastWrite=Date.now();retryDelay=1500;persist();
      message(dirty?'Nye ændringer afventer…':'Gemt i skyen. Din partner kan se ændringerne.');
    }catch(error){
      if(error.status===409&&error.current){conflict=error.current;showCloudDialog();message('Din partner har også ændret planen. Vælg hvilken version I vil fortsætte med nedenfor.');}
      else{retryDelay=Math.min(60000,Math.max(15000,retryDelay*2));message(error.message);}
    }finally{saving=false;render();if(dirty&&!conflict&&navigator.onLine)schedule();}
  }
  async function refresh({force=false}={}){
    if(!connection||saving||opening||conflict)return;
    if(dirty){await flush();return;}
    const code=connection.code;
    try{
      const result=await request('read',{code});if(connection?.code!==code)return;
      if(result.revision===connection.revision)return;
      if(dirty||saving)return;
      if(!force&&!options.canApply()){message('Din partner har opdateret planen. Tryk Opdatér fra skyen, når du er færdig her.');return;}
      await apply(result);message('Planen er opdateret fra skyen. Du bliver på det trin, du har åbent.');
    }catch(error){message(error.message);}
  }
  async function open(code,{automatic=false}={}){
    code=normalizePlanCode(code);
    if(!validPlanCode(code)){message('Indtast hele delingskoden eller indsæt delingslinket.');return;}
    if(saving||opening)return;
    if(!automatic&&!confirm('Åbn den fælles madplan? Din nuværende lokale plan gemmes som en sikkerhedskopi på denne enhed.'))return;
    const before=JSON.stringify(options.getDocument(options.currentStep()));
    opening=true;render();message('Åbner fælles madplan…');
    try{
      const result=await request('read',{code});
      if(JSON.stringify(options.getDocument(options.currentStep()))!==before)throw Error('Den lokale plan blev ændret under åbningen. Prøv at åbne den fælles plan igen.');
      options.backup();connection={code};await apply(result,{navigate:true});
      message('Fælles madplan åbnet. I kan begge redigere.');showCloudDialog();
    }catch(error){message(error.message);}
    finally{opening=false;render();}
  }
  $('cloud-create').addEventListener('click',async()=>{
    if(opening||connection)return;opening=true;sharedStep=options.currentStep();render();message('Gemmer og opretter delingskode…');
    try{
      const document=snapshot(),result=await request('create',{document});
      connection={code:result.code,revision:result.revision,document:result.document,updatedAt:result.updatedAt};
      dirty=JSON.stringify(snapshot())!==JSON.stringify(document);persist();message('Planen er gemt. Del linket eller koden med din partner.');
    }catch(error){message(error.message);}
    finally{opening=false;render();if(dirty)schedule();}
  });
  $('cloud-open-form').addEventListener('submit',event=>{
    event.preventDefault();let value=$('cloud-enter-code').value.trim();
    try{if(value.includes('://'))value=new URLSearchParams(new URL(value).hash.slice(1)).get('plan')||'';}catch{}
    if(dirty){message('Gem eller afklar de afventende ændringer, før du åbner en anden plan.');return;}
    open(value);
  });
  $('cloud-refresh').addEventListener('click',()=>refresh({force:true}));
  $('cloud-copy-link').addEventListener('click',async()=>{
    if(!connection)return;
    try{await navigator.clipboard.writeText(link(connection.code));message('Delingslinket er kopieret. Alle med linket kan se og redigere planen.');}
    catch{$('cloud-link').focus();$('cloud-link').select();message('Markér og kopiér linket i feltet ovenfor.');}
  });
  $('cloud-share').addEventListener('click',async()=>{
    if(!connection)return;
    if(!navigator.share){$('cloud-copy-link').click();return;}
    try{await navigator.share({title:'Vores madplan',text:'Åbn vores fælles madplan',url:link(connection.code)});}catch(error){if(error.name!=='AbortError')message('Brug Kopiér delingslink i stedet.');}
  });
  $('cloud-leave').addEventListener('click',()=>{
    if(saving||!confirm('Fortsæt med denne plan lokalt? Planen i skyen bliver liggende, men denne enhed stopper med at synkronisere.'))return;
    connection=null;dirty=false;conflict=null;clearTimeout(timer);persist();render();message('Du fortsætter lokalt. Delingskoden kan bruges igen senere.');
  });
  $('cloud-use-remote').addEventListener('click',async()=>{
    if(!conflict||!confirm('Hent den fælles version? Dine afventende ændringer erstattes. En lokal sikkerhedskopi bevares.'))return;
    options.backup();await apply(conflict);message('Den fælles version er hentet.');
  });
  $('cloud-use-local').addEventListener('click',()=>{
    if(!conflict||!confirm('Gem din version i stedet? Den erstatter partnerens seneste ændringer.'))return;
    connection.revision=conflict.revision;conflict=null;persist();render();flush();
  });
  window.addEventListener('online',()=>dirty?flush():refresh());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)dirty?flush():refresh();});
  setInterval(()=>{if(!document.hidden&&navigator.onLine)dirty?flush():refresh();},15000);
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  render();
  if(options.incoming&&normalizePlanCode(options.incoming)!==connection?.code){
    // A newly opened link is an explicit request to open that shared plan.
    if(dirty){message('Du har afventende ændringer i den åbne plan. Gem eller afklar dem, før du åbner linkets plan.');$('cloud-enter-code').value=options.incoming;showCloudDialog();}else open(options.incoming,{automatic:true});
  }else if(connection){
    sharedStep=migrateSharedStep(connection.sharedStep||connection.document?.step||1,connection.document?.flowVersion);
    if(dirty){message('Lokale ændringer fra sidste besøg afventer synkronisering.');flush();}
    else{
      const before=JSON.stringify(options.getDocument(options.currentStep()));
      opening=true;request('read',{code:connection.code}).then(record=>{if(JSON.stringify(options.getDocument(options.currentStep()))!==before){dirty=true;persist();throw Error('Du har ændret planen under indlæsning. Ændringerne er bevaret og afventer synkronisering.');}return apply(record,{navigate:true});}).then(()=>message('Din fælles madplan er åbnet dér, hvor I slap.')).catch(error=>message(error.message)).finally(()=>{opening=false;render();});
    }
  }
  return {changed,stepChanged(step){if(applying)return;sharedStep=step;changed();},isConnected:()=>Boolean(connection),isOpening:()=>opening};
}
