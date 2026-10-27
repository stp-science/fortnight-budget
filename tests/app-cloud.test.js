import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {configureBudgetStorage,emptyBudget} from '../budget-storage.js';
import {newPeriod} from '../model.js';

async function page(t,initial) {
  const dom = new JSDOM(await readFile(new URL('../index.html',import.meta.url),'utf8'), {url:'https://budget.example'});
  const {window} = dom, {document} = window;
  window.scrollTo = () => {};
  window.HTMLDialogElement.prototype.showModal = function(){this.open=true;};
  window.HTMLDialogElement.prototype.close = function(){this.open=false;};
  const previous = new Map();
  for (const [key,value] of Object.entries({window,document,localStorage:window.localStorage,confirm:()=>true,setInterval:()=>0,setTimeout:()=>0})) {
    previous.set(key,globalThis[key]);globalThis[key]=value;
  }
  t.after(()=>{configureBudgetStorage(null);for(const [key,value] of previous)globalThis[key]=value;window.close();});
  window.localStorage.setItem('fortnight-budget-v1',JSON.stringify({privateOwnerRecord:'must never be read'}));
  let localReads=0;
  const originalGet = window.Storage.prototype.getItem;
  window.Storage.prototype.getItem = function(...args){localReads++;return originalGet.apply(this,args);};
  let state=structuredClone(initial),revision=1,fail=false,listener;
  const storage = {
    cloud:true,get state(){return structuredClone(state);},get revision(){return revision;},
    async save(next){if(fail)throw Error('Offline — your change was not saved.');state=structuredClone(next);revision++;return structuredClone(state);},
    subscribe(fn){listener=fn;},start(){},
  };
  configureBudgetStorage(storage);
  await import('../app.js?test='+crypto.randomUUID());
  return {document,storage,get localReads(){return localReads;},setFail:value=>fail=value,
    remote(next){state=structuredClone(next);revision++;listener(state);}};
}
const filled = () => {
  const p = newPeriod('2026-10-20','2026-11-03',10000);
  return {version:1,activeId:p.id,periods:[p]};
};

test('a new Google account ignores the previous unscoped browser budget', async t => {
  const p = await page(t,emptyBudget());
  assert.equal(p.document.querySelector('#empty').hidden,false);
  assert.equal(p.localReads,0);
  assert.equal(p.document.querySelector('#reset').hidden,true);
});
test('failed cloud saves keep the original budget and the form open; retry saves once', async t => {
  const p = await page(t,filled());
  p.document.querySelector('#add-bill').click();
  const form = p.document.querySelector('#bill-form');
  form.elements.name.value = 'Test bill';form.elements.amount.value='25';
  form.elements.frequency.value='once';form.elements.date.value='2026-10-27';
  p.setFail(true);await form.onsubmit({preventDefault(){},currentTarget:form});
  assert.equal(p.storage.state.periods[0].bills.length,0);
  assert.equal(p.document.querySelector('#bill-dialog').open,true);
  assert.match(p.document.querySelector('#bill-error').textContent,/not saved/);
  assert.equal(p.document.querySelector('.shell').inert,false);
  p.setFail(false);await form.onsubmit({preventDefault(){},currentTarget:form});
  assert.equal(p.storage.state.periods[0].bills.length,1);
  assert.equal(p.document.querySelector('#bill-dialog').open,false);
  assert.equal(p.localReads,0);
});
test('remote updates refresh the budget and stale open forms cannot overwrite them', async t => {
  const initial=filled(), p=await page(t,initial);
  p.document.querySelector('#edit-plan').click();
  const updated=structuredClone(initial);updated.periods[0].opening=20000;
  p.remote(updated);
  assert.match(p.document.querySelector('#remaining').textContent,/200/);
  const form=p.document.querySelector('#plan-form');
  await form.onsubmit({preventDefault(){},currentTarget:form});
  assert.match(p.document.querySelector('#plan-error').textContent,/changed while this form/);
  assert.equal(p.storage.state.periods[0].opening,20000);
});

test('day completion waits for a successful cloud save and keeps spending intact',async t=>{
 const initial=filled();initial.periods[0].expenses.push({id:'e',date:'2026-10-25',amount:250,note:'Shop',category:'Groceries'});
 const p=await page(t,initial),date=p.document.querySelector('#complete-date');date.value='2026-10-25';date.onchange();
 p.setFail(true);await p.document.querySelector('#complete-day').onclick();assert.deepEqual(p.storage.state.periods[0].completedDays,[]);
 p.setFail(false);await p.document.querySelector('#complete-day').onclick();assert.deepEqual(p.storage.state.periods[0].completedDays,['2026-10-25']);assert.equal(p.storage.state.periods[0].expenses.length,1);assert.deepEqual(p.storage.state.periods[0].noSpendDays,[]);
 await p.document.querySelector('#complete-day').onclick();assert.deepEqual(p.storage.state.periods[0].completedDays,[]);
});
test('zero spending completion is explicit; a later expense reopens the day',async t=>{
 const p=await page(t,filled()),date=p.document.querySelector('#complete-date');date.value='2026-10-25';date.onchange();await p.document.querySelector('#complete-day').onclick();
 assert.deepEqual(p.storage.state.periods[0].noSpendDays,['2026-10-25']);
 p.document.querySelector('#add-top').click();const form=p.document.querySelector('#entry-form');form.elements.kind.value='expense';form.elements.date.value='2026-10-25';form.elements.amount.value='5';form.elements.category.value='Groceries';form.elements.note.value='Top-up';
 await form.onsubmit({preventDefault(){},currentTarget:form});assert.deepEqual(p.storage.state.periods[0].completedDays,[]);assert.deepEqual(p.storage.state.periods[0].noSpendDays,[]);
});
