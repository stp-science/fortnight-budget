import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudBudgetStore,emptyBudget} from '../budget-storage.js';
import {newPeriod} from '../model.js';

const budget = opening => {
  const p = newPeriod('2026-10-20','2026-11-03',opening);
  return {version:1,activeId:p.id,periods:[p]};
};
function harness() {
  const docs = new Map(), watches = new Map(); let offline = false, paused = null;
  const transport = {
    async read(uid) { if (offline) throw Error('Offline'); return docs.get(uid)||null; },
    async transact(uid, update) {
      if (offline) throw Error('Offline');
      if (paused) await paused;
      const next = update(docs.get(uid)||null); docs.set(uid,next);
      for (const fn of watches.get(uid)||[]) fn(next);
    },
    listen(uid, fn) {
      if (!watches.has(uid)) watches.set(uid,new Set()); watches.get(uid).add(fn);
      return () => watches.get(uid).delete(fn);
    }
  };
  return {docs,transport,setOffline:v=>offline=v,pause:promise=>paused=promise,
    store:uid=>createCloudBudgetStore({uid,transport})};
}

test('different accounts have separate documents; another device restores the same account', async () => {
  const h = harness(), owner = h.store('owner'), friend = h.store('friend');
  await owner.load(); await friend.load();
  await owner.save(budget(10000)); await friend.save(budget(25000));
  const otherDevice = h.store('owner'); await otherDevice.load();
  assert.equal(otherDevice.state.periods[0].opening,10000);
  assert.equal(friend.state.periods[0].opening,25000);
  assert.equal(h.docs.size,2);
});
test('live updates reach only devices signed in to the same account', async () => {
  const h = harness(), a = h.store('owner'), b = h.store('owner'), friend = h.store('friend');
  await a.load(); await b.load(); await friend.load(); b.start(); friend.start();
  let received; b.subscribe(next=>received=next);
  await a.save(budget(12345));
  assert.equal(received.periods[0].opening,12345);
  assert.deepEqual(friend.state,emptyBudget());
});
test('a stale device cannot overwrite a newer revision', async () => {
  const h = harness(), a = h.store('owner'), b = h.store('owner');
  await a.load(); await b.load(); await a.save(budget(10000));
  await assert.rejects(b.save(budget(1)),/changed on another device/);
  assert.equal(JSON.parse(h.docs.get('owner').data).periods[0].opening,10000);
});
test('an offline save never changes the confirmed state or another device', async () => {
  const h = harness(), a = h.store('owner'); await a.load(); await a.save(budget(10000));
  h.setOffline(true); await assert.rejects(a.save(budget(1)),/Offline/);
  assert.equal(a.state.periods[0].opening,10000);
  assert.equal(JSON.parse(h.docs.get('owner').data).periods[0].opening,10000);
});
test('sign-out cancels pending changes and drops in-memory records and listeners', async () => {
  const h = harness(), a = h.store('owner'); await a.load(); await a.save(budget(10000)); a.start();
  let resolve; h.pause(new Promise(r=>resolve=r));
  const pending = a.save(budget(1)); a.dispose(); resolve();
  await assert.rejects(pending,/account changed/);
  assert.deepEqual(a.state,emptyBudget());
  assert.equal(JSON.parse(h.docs.get('owner').data).periods[0].opening,10000);
});
test('corrupt existing cloud records cannot be silently replaced', async () => {
  const h = harness(); h.docs.set('owner',{schemaVersion:1,revision:1,data:'broken'});
  const a = h.store('owner'); await assert.rejects(a.load()); await assert.rejects(a.save(budget(1)),/unavailable/);
  assert.equal(h.docs.get('owner').data,'broken');
});
test('a first-time account stays empty until it explicitly saves or imports', async () => {
  const h = harness(), a = h.store('friend'); await a.load();
  assert.deepEqual(a.state,emptyBudget()); assert.equal(h.docs.size,0);
});
