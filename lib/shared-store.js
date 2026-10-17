import {upgradeSharedFlow} from './flow.js';
import {get,put,BlobPreconditionFailedError} from '@vercel/blob';
import {createHash,randomBytes} from 'node:crypto';
import {validateSharedDocument,validPlanCode} from './shared-plan.js';
const ETAG=Symbol('storage-etag');
const pathname=code=>'plans/'+createHash('sha256').update(code).digest('hex')+'.json';
export const cloudConfigured=()=>Boolean(process.env.BLOB_READ_WRITE_TOKEN||(process.env.BLOB_STORE_ID&&process.env.VERCEL_OIDC_TOKEN));
export function createPlanStore(storage={get,put}){
  async function read(code){
    if(!validPlanCode(code))throw Object.assign(Error('Ugyldig delingskode.'),{status:400});
    const result=await storage.get(pathname(code),{access:'private',useCache:false});
    if(!result)throw Object.assign(Error('Madplanen blev ikke fundet. Kontrollér koden.'),{status:404});
    const record=await new Response(result.stream).json();
    return {...record,document:upgradeSharedFlow(record.document),revision:record.revision||result.blob.etag,[ETAG]:result.blob.etag.replace(/^W\//,'').replace(/^"|"$/g,'')};
  }
  async function create(document){
    const code=randomBytes(16).toString('hex'),updatedAt=new Date().toISOString();
    const record={document:validateSharedDocument(document),updatedAt,revision:randomBytes(16).toString('hex')};
    const result=await storage.put(pathname(code),JSON.stringify(record),{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:'application/json'});
    return {code,...record};
  }
  async function update(code,revision,document){
    if(!validPlanCode(code)||typeof revision!=='string'||!revision||revision.length>200)throw Object.assign(Error('Ugyldig kode eller version.'),{status:400});
    const current=await read(code);
    if(current.revision!==revision)throw Object.assign(Error('Planen er ændret på en anden enhed.'),{status:409,current});
    // Older open clients do not send the new portion fields; keep their stored values.
    if(document?.state)document={...document,state:{...document.state,people:document.state.people??current.document.state.people??4,recipeCounts:document.state.recipeCounts??current.document.state.recipeCounts??{}}};
    const record={document:validateSharedDocument(document),updatedAt:new Date().toISOString(),revision:randomBytes(16).toString('hex')};
    try{
      const result=await storage.put(pathname(code),JSON.stringify(record),{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json',ifMatch:current[ETAG]});
      return record;
    }catch(error){
      if(error instanceof BlobPreconditionFailedError)throw Object.assign(Error('Planen er ændret på en anden enhed.'),{status:409,current:await read(code)});
      throw error;
    }
  }
  return {read,create,update};
}
