import {validateState} from './model.js';
const key='fortnight-budget-v1',pendingKey=key+'-pending',metaKey=key+'-cloud',recoveryKey=key+'-before-cloud';
export function createSync({getState,applyState,status,notice,request=fetch,storage=localStorage}){
 let enabled=false,ready=false,busy=false,csrf='',revision=0,pending=null,remote=null,conflict=false;
 const validate=x=>validateState(x);
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const write=(k,v)=>storage.setItem(k,JSON.stringify(v));
 function guard(){if(!ready)throw Error('Wait for the online budget to load before editing.');if(conflict)throw Error('Resolve the budget versions above before editing.');if(enabled&&(pending||busy))throw Error('Your budget is syncing. Wait a moment, or retry syncing before editing again.');}
 function problem(message){status(message);notice(message,{retry:()=>ready?refresh():start(),download:()=>getState(),useOnline:remote?.state?()=>useOnline():null});}
 function adopt(doc){const state=validate(doc.state);write(recoveryKey,getState());write(key,state);write(metaKey,{revision:doc.revision});revision=doc.revision;remote=doc;applyState(state);}
 function useOnline(){if(!remote?.state)return;adopt(remote);storage.removeItem(pendingKey);pending=null;conflict=false;ready=true;notice('');status('Synced across devices');}
 async function flush(){
  if(!enabled||busy||!pending||conflict)return;busy=true;status('Saving online…');
  try{const r=await request('/api/budget',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({revision:pending.revision,state:pending.state})});const doc=await r.json();
   if(r.status===409){remote=doc;if(same(validate(doc.state),pending.state)){revision=doc.revision;}else{conflict=true;problem('Another device has newer changes. Download this device’s backup, then load the online budget. Your local version is preserved.');return;}}
   else if(!r.ok)throw Error();else revision=doc.revision;
   write(metaKey,{revision});storage.removeItem(pendingKey);pending=null;notice('');status('Synced across devices');
  }catch{problem('Saved on this device · waiting to sync. Keep this tab open and retry.');}finally{busy=false;}
 }
 function changed(next){guard();if(!enabled)return;const payload={revision,state:validate(next)};write(pendingKey,payload);pending=payload;void flush();}
 async function refresh(){
  if(!enabled||busy||conflict)return;if(pending){await flush();return;}busy=true;
  try{const r=await request('/api/budget',{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw Error();const doc=await r.json();if(doc.state&&doc.revision!==revision){adopt(doc);}status('Synced across devices');notice('');}
  catch{problem('Cannot check for updates. Your saved records remain on this device.');}finally{busy=false;}
 }
 async function start(){
  try{const r=await request('/api/session',{cache:'no-store',credentials:'same-origin'});
   if(r.status===404&&['localhost','127.0.0.1'].includes(location.hostname)){ready=true;status('Local preview · saved on this device');return;}
   if(!r.ok)throw Error();const session=await r.json();csrf=session.csrf;enabled=session.syncEnabled===true;
   if(!enabled){ready=true;status('Saved on this device · online setup pending');return;}
   const saved=await request('/api/budget',{cache:'no-store',credentials:'same-origin'});if(!saved.ok)throw Error();remote=await saved.json();revision=remote.revision;
   const rawPending=storage.getItem(pendingKey);if(rawPending){pending=JSON.parse(rawPending);validate(pending.state);applyState(pending.state);ready=true;await flush();return;}
   if(remote.state){
    const online=validate(remote.state),local=getState(),meta=storage.getItem(metaKey);
    if(!meta&&local.periods.length&&!same(local,online)){conflict=true;ready=true;problem('This device and your online account have different budgets. Download this device’s backup before loading the online budget. Nothing has been overwritten.');return;}
    adopt(remote);
   }else if(getState().periods.length){ready=true;changed(getState());return;}
   ready=true;status('Synced across devices');notice('');
  }catch{ready=false;problem('Online budget could not be loaded. Your device records are safe. Retry before editing.');}
 }
 return{guard,changed,start,refresh,retry:async()=>{if(!ready)await start();else await refresh();},get enabled(){return enabled;}};
}
