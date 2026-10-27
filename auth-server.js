import http from 'node:http';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {OAuth2Client} from 'google-auth-library';

const root=fileURLToPath(new URL('.',import.meta.url));
const random=()=>randomBytes(32).toString('base64url');
const hash=s=>createHash('sha256').update(s).digest('base64url');
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const assets=new Map([['/','index.html'],['/index.html','index.html'],['/app.js','app.js'],['/model.js','model.js'],['/style.css','style.css'],['/icon.svg','icon.svg'],['/auth-client.js','auth-client.js'],['/budget-storage.js','budget-storage.js']]);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const sessionTTL=8*60*60*1000,flowTTL=10*60*1000;

export function authConfig(env){
 const required=['APP_URL','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','ALLOWED_GOOGLE_EMAIL'];
 if(required.some(k=>!env[k]?.trim()))return null;
 const u=new URL(env.APP_URL);if(u.pathname!=='/'||u.search||u.hash||u.username||u.password)throw Error('APP_URL must be an origin without a path.');
 const local=['127.0.0.1','localhost','[::1]'].includes(u.hostname);
 if(u.protocol!=='https:'&&!(u.protocol==='http:'&&local&&env.NODE_ENV!=='production'))throw Error('HTTPS is required outside local development.');
 const email=env.ALLOWED_GOOGLE_EMAIL.trim().toLowerCase();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw Error('Set one valid allowed Google email.');
 return{origin:u.origin,secure:u.protocol==='https:',clientId:env.GOOGLE_CLIENT_ID.trim(),clientSecret:env.GOOGLE_CLIENT_SECRET.trim(),email};
}

export function createAuthServer({env=process.env,oauthFactory=(c)=>new OAuth2Client(c.clientId,c.clientSecret,c.origin+'/auth/callback'),now=Date.now}={}){
 const config=authConfig(env),oauth=config?oauthFactory(config):null,sessions=new Map(),flows=new Map();
 const sessionCookie=config?.secure?'__Host-fortnight_session':'fortnight_session';
 const flowCookie=config?.secure?'__Host-fortnight_flow':'fortnight_flow';
 function cookie(name,value,age){return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${config?.secure?'; Secure':''}`;}
 function cookies(req){const out={};for(const part of (req.headers.cookie||'').split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=part.slice(i+1).trim();}return out;}
 function prune(){for(const [k,v] of sessions)if(v.expires<=now())sessions.delete(k);for(const [k,v] of flows)if(v.expires<=now())flows.delete(k);}
 function loginPage(message='',status=200){const ready=!!config;return{status,body:`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Fortnight</title><style>body{margin:0;background:#f5f5ee;color:#183b35;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh}main{max-width:410px;padding:42px 28px;text-align:center}.logo{font:italic 70px Georgia}h1{font:38px Georgia;letter-spacing:-1px}p{font-size:14px;line-height:1.8;color:#66746c}a{display:inline-block;background:#153e37;color:white;border-radius:12px;padding:15px 25px;text-decoration:none;font-weight:650;margin:14px 0}small{display:block;margin-top:20px;color:#66746c;line-height:1.7}.message{color:#a03f36}</style></head><body><main><div class="logo">f.</div><h1>Your money.<br>Your space.</h1><p>Sign in with your authorised Google account to open your fortnightly budget.</p>${message?`<p class="message" role="alert">${escape(message)}</p>`:''}${ready?'<a href="/auth/login">Continue with Google</a>':'<p>Google sign-in has not been connected yet. The budget stays locked until setup is complete.</p>'}<small>Only the account chosen by the owner can enter.<br>Your budget records stay in this browser.</small></main></body></html>`};}
 return http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store, private');res.setHeader('Pragma','no-cache');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  if(config?.secure)res.setHeader('Strict-Transport-Security','max-age=31536000');
  function send(status,body,type='text/html; charset=utf-8'){res.writeHead(status,{'Content-Type':type});res.end(body);}
  function redirect(url){res.writeHead(303,{Location:url});res.end();}
  function page(msg,status){const p=loginPage(msg,status);send(p.status,p.body);}
  try{
   prune();const u=new URL(req.url,'http://server.local');const pathname=u.pathname;
   if(pathname==='/healthz'){send(200,'ok','text/plain');return;}
   if(!config){page('',503);return;}
   const cs=cookies(req),token=cs[sessionCookie],session=token?sessions.get(hash(token)):null;
   if(pathname==='/signin'){if(session)redirect('/');else page('');return;}
   if(pathname==='/auth/login'){
    if(req.method!=='GET'){send(405,'Method not allowed','text/plain');return;}
    if(flows.size>=1000){send(429,'Too many sign-in attempts. Try again shortly.','text/plain');return;}
    const state=random(),browserToken=random(),nonce=random(),verifier=random();flows.set(state,{binding:hash(browserToken),nonce,verifier,expires:now()+flowTTL});
    const url=oauth.generateAuthUrl({access_type:'online',scope:['openid','email'],state,nonce,prompt:'select_account',code_challenge:hash(verifier),code_challenge_method:'S256'});
    res.setHeader('Set-Cookie',cookie(flowCookie,browserToken,600));redirect(url);return;
   }
   if(pathname==='/auth/callback'){
    if(req.method!=='GET'){send(405,'Method not allowed','text/plain');return;}
    const state=u.searchParams.get('state'),flow=flows.get(state);if(!flow||!cs[flowCookie]||!same(flow.binding,hash(cs[flowCookie]))){page('This sign-in expired or could not be verified. Please try again.',400);return;}
    flows.delete(state);res.setHeader('Set-Cookie',cookie(flowCookie,'',0));
    if(u.searchParams.has('error')){page('Sign-in was cancelled. You can try again.');return;}
    const code=u.searchParams.get('code');if(!code||code.length>4096){page('No valid sign-in response was received.',400);return;}
    const result=await oauth.getToken({code,codeVerifier:flow.verifier,redirect_uri:config.origin+'/auth/callback'});
    const idToken=result.tokens.id_token;if(!idToken){page('Google could not verify this sign-in.',401);return;}
    const ticket=await oauth.verifyIdToken({idToken,audience:config.clientId});const payload=ticket.getPayload();
    if(!payload||!same(payload.nonce,flow.nonce)||payload.email_verified!==true||!payload.sub||payload.email?.toLowerCase()!==config.email){page('This Google account is not authorised to open this budget.',403);return;}
    if(sessions.size>=1000){page('Too many active sessions. Try again later.',429);return;}
    const newToken=random();sessions.set(hash(newToken),{email:payload.email,sub:payload.sub,csrf:random(),expires:now()+sessionTTL});
    if(token)sessions.delete(hash(token));res.setHeader('Set-Cookie',[cookie(flowCookie,'',0),cookie(sessionCookie,newToken,sessionTTL/1000)]);redirect('/');return;
   }
   if(!session){if(pathname.startsWith('/api/')||path.extname(pathname)){send(401,'Sign-in required','text/plain');}else redirect('/signin');return;}
   if(pathname==='/api/session'){if(req.method!=='GET'){send(405,'Method not allowed','text/plain');return;}send(200,JSON.stringify({email:session.email,csrf:session.csrf}),'application/json');return;}
   if(pathname==='/auth/logout'){
    if(req.method!=='POST'||req.headers.origin!==config.origin||!same(req.headers['x-csrf-token'],session.csrf)){send(403,'Request could not be verified','text/plain');return;}
    sessions.delete(hash(token));res.setHeader('Set-Cookie',cookie(sessionCookie,'',0));send(200,'Signed out','text/plain');return;
   }
   if(req.method!=='GET'&&req.method!=='HEAD'){send(405,'Method not allowed','text/plain');return;}
   const file=assets.get(pathname);if(!file){send(404,'Not found','text/plain');return;}
   let body=await readFile(path.join(root,file));if(file==='index.html')body=Buffer.from(body.toString().replace('</body>','<script type="module" src="/auth-client.js"></script></body>'));
   res.writeHead(200,{'Content-Type':types[path.extname(file)]||'text/plain'});res.end(req.method==='HEAD'?undefined:body);
  }catch{page('Sign-in could not be completed. Please try again.',502);}
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT)||4174;const server=createAuthServer();server.listen(port,'0.0.0.0',()=>console.log(`Fortnight Google sign-in server listening on port ${port}.`));
}
