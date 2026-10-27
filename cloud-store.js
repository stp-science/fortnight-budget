// Server only. Credentials never leave the protected Render service.
export function createCloudStore(env=process.env,request=fetch){
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)return null;
 const origin=new URL(env.SUPABASE_URL);if(origin.protocol!=='https:'||!origin.hostname.endsWith('.supabase.co'))throw Error('Invalid storage URL');
 const headers={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'};
 async function call(name,args){const r=await request(origin.origin+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Storage unavailable');return r.json();}
 return{read:owner=>call('read_budget',{p_owner:owner}),save:(owner,revision,state)=>call('save_budget',{p_owner:owner,p_revision:revision,p_state:state})};
}
