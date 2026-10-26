export const categories=['Groceries','Cafe & takeaways','Fuel & transport','Health','Pets','Shopping','Entertainment','Other'];
export const money=(c)=>new Intl.NumberFormat('en-NZ',{style:'currency',currency:'NZD'}).format(c/100);
export function cents(v){if(!/^\d+(\.\d{1,2})?$/.test(String(v)))throw Error('Enter a positive amount with up to two decimal places.');const n=Math.round(Number(v)*100);if(!Number.isSafeInteger(n)||n>1000000000)throw Error('Amount is too large.');return n;}
export function dateNumber(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('Choose a valid date.');const n=Date.parse(s+'T00:00:00Z');if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==s)throw Error('Choose a valid date.');return n/86400000;}
export const addDays=(s,n)=>new Date((dateNumber(s)+n)*86400000).toISOString().slice(0,10);
export const daysBetween=(a,b)=>dateNumber(b)-dateNumber(a);
export function today(){const parts=new Intl.DateTimeFormat('en-NZ',{timeZone:'Pacific/Auckland',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const part=t=>parts.find(p=>p.type===t).value;return `${part('year')}-${part('month')}-${part('day')}`;}
export const uid=()=>globalThis.crypto.randomUUID();
export function newPeriod(start,end,opening=0,buffer=0,bills=[]){return{id:uid(),start,end,opening,buffer,savingsGoal:0,bills:structuredClone(bills),expenses:[],income:[],savings:[],paidBills:[],noSpendDays:[]};}
export function occurrences(p){const rows=[];
 for(const b of p.bills){const anchor=dateNumber(b.date),start=dateNumber(p.start),end=dateNumber(p.end);if(b.end&&dateNumber(b.end)<start)continue;
  if(b.frequency==='monthly'){
   const a=new Date(anchor*86400000);const begin=new Date(start*86400000);let y=begin.getUTCFullYear(),m=begin.getUTCMonth();
   while(Date.UTC(y,m,1)/86400000<end){const d=Math.min(a.getUTCDate(),new Date(Date.UTC(y,m+1,0)).getUTCDate());const n=Date.UTC(y,m,d)/86400000;
    if(n>=start&&n>=anchor&&n<end&&(!b.end||n<=dateNumber(b.end)))push(n);m++;if(m===12){m=0;y++;}}
  }else if(b.frequency==='once'){if(anchor>=start&&anchor<end&&(!b.end||anchor<=dateNumber(b.end)))push(anchor);
  }else{const step=b.frequency==='weekly'?7:14;let n=anchor+Math.max(0,Math.ceil((start-anchor)/step))*step;for(;n<end;n+=step){if(!b.end||n<=dateNumber(b.end))push(n);}}
  function push(n){const date=new Date(n*86400000).toISOString().slice(0,10);const key=b.id+'@'+date;rows.push({key,billId:b.id,name:b.name,amount:b.amount,date,paid:p.paidBills.includes(key)});}
 }
 return rows.sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name));
}
const sum=a=>a.reduce((s,x)=>s+x.amount,0);
export function totals(p,on=today()){
 const bills=occurrences(p),fixed=sum(bills),paid=sum(bills.filter(b=>b.paid)),spent=sum(p.expenses),income=sum(p.income),saved=sum(p.savings);
 const remaining=p.opening+income-fixed-spent-saved-p.buffer;
 const daysLeft=Math.max(0,daysBetween(on<p.start?p.start:on,p.end));
 return{fixed,paid,spent,income,saved,remaining,daysLeft,perDay:daysLeft?Math.floor(Math.max(0,remaining)/daysLeft):0,cash:p.opening+income-spent-saved-paid,availableAtStart:p.opening-fixed-p.buffer};
}
export function timeline(p){let left=p.opening-occurrences(p).reduce((s,b)=>s+b.amount,0)-p.buffer;const points=[{date:p.start,value:left,label:'Opening spending money'}];
 const events=[...p.expenses.map(x=>({...x,delta:-x.amount})),...p.income.map(x=>({...x,delta:x.amount})),...p.savings.map(x=>({...x,delta:-x.amount}))].sort((a,b)=>a.date.localeCompare(b.date));
 for(const e of events){left+=e.delta;points.push({date:e.date,value:left,label:e.note||'Entry'});}return points;
}
export function validateState(raw){
 if(!raw||raw.version!==1||!Array.isArray(raw.periods)||!raw.periods.length||raw.periods.length>200)throw Error('This is not a supported budget backup.');
 const text=(s,max=120)=>{if(typeof s!=='string'||s.length>max)throw Error('Invalid text in backup.');return s;};
 const amt=(n)=>{if(!Number.isSafeInteger(n)||n<0||n>1000000000)throw Error('Invalid amount in backup.');return n;};
 const date=s=>{dateNumber(s);return s;};
 const arr=a=>{if(!Array.isArray(a)||a.length>10000)throw Error('Invalid entries in backup.');return a;};
 const ids=new Set();const periods=raw.periods.map(p=>{const id=text(p.id);if(ids.has(id))throw Error('Duplicate period.');ids.add(id);const start=date(p.start),end=date(p.end);if(daysBetween(start,end)<1||daysBetween(start,end)>366)throw Error('Period must be 1–366 days.');
  const bills=arr(p.bills).map(b=>{if(!['once','weekly','fortnightly','monthly'].includes(b.frequency))throw Error('Invalid bill schedule.');return{id:text(b.id),name:text(b.name),date:date(b.date),end:b.end?date(b.end):'',amount:amt(b.amount),frequency:b.frequency};});
  if(new Set(bills.map(b=>b.id)).size!==bills.length)throw Error('Duplicate bill.');
  function entries(a,kind){const seen=new Set();return arr(a).map(x=>{const id=text(x.id);if(seen.has(id))throw Error('Duplicate entry.');seen.add(id);const d=date(x.date);if(d<start||d>=end)throw Error('Entry falls outside its period.');const result={id,date:d,amount:amt(x.amount),note:text(x.note)};if(kind==='expense'){if(!categories.includes(x.category))throw Error('Invalid category.');result.category=x.category;}return result;});}
  const paidBills=arr(p.paidBills).map(x=>text(x,200)),noSpendDays=arr(p.noSpendDays).map(date);
  return{id,start,end,opening:amt(p.opening),buffer:amt(p.buffer),savingsGoal:amt(p.savingsGoal||0),bills,expenses:entries(p.expenses,'expense'),income:entries(p.income,'income'),savings:entries(p.savings||[],'savings'),paidBills:[...new Set(paidBills)],noSpendDays:[...new Set(noSpendDays)]};
 });
 for(const p of periods){if(p.noSpendDays.some(d=>d<p.start||d>=p.end||p.expenses.some(e=>e.date===d)))throw Error('Invalid no-spend day.');}
 const sorted=[...periods].sort((a,b)=>a.start.localeCompare(b.start));for(let i=1;i<sorted.length;i++)if(sorted[i].start<sorted[i-1].end)throw Error('Overlapping periods.');
 if(!periods.some(p=>p.id===raw.activeId))throw Error('Active period missing.');
 return{version:1,activeId:raw.activeId,periods};
}
