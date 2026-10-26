let csrf='';
const session=await fetch('/api/session',{cache:'no-store',credentials:'same-origin'});
if(!session.ok){location.replace('/signin');}else{
 const data=await session.json();csrf=data.csrf;const bar=document.createElement('div');bar.className='signed-in-bar';
 const label=document.createElement('span');label.textContent='Signed in · '+data.email;
 const button=document.createElement('button');button.type='button';button.textContent='Sign out';button.className='text-button';
 button.onclick=async()=>{button.disabled=true;try{const r=await fetch('/auth/logout',{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':csrf}});if(!r.ok)throw Error();location.replace('/signin');}catch{button.disabled=false;button.textContent='Try signing out again';}};
 bar.append(label,button);document.querySelector('main').prepend(bar);
}
window.addEventListener('pageshow',async e=>{if(e.persisted){const r=await fetch('/api/session',{cache:'no-store'});if(!r.ok)location.replace('/signin');}});
