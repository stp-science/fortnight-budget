import {validateState} from './model.js';

export const emptyBudget = () => ({version:1,activeId:null,periods:[]});
export function validateBudget(value) {
  if (value?.version === 1 && value.activeId === null &&
      Array.isArray(value.periods) && value.periods.length === 0) return emptyBudget();
  return validateState(value);
}

let configured = null;
export const getBudgetStorage = () => configured;
export function configureBudgetStorage(store) { configured = store; }

export function createCloudBudgetStore({uid, transport}) {
  if (!uid || /\//.test(uid)) throw Error('A signed-in account is required.');
  let state = emptyBudget(), revision = 0, ready = false, busy = false, closed = false;
  let stop, deferred = null;
  const listeners = new Set(), statuses = new Set();
  const status = text => { for (const fn of statuses) fn(text); };
  const emit = () => { for (const fn of listeners) fn(structuredClone(state)); };
  function decode(doc) {
    if (!doc) return {state:emptyBudget(),revision:0};
    if (doc.schemaVersion !== 1 || !Number.isSafeInteger(doc.revision) || doc.revision < 1) {
      throw Error('The saved cloud budget could not be read. It has not been replaced.');
    }
    return {state:validateBudget(JSON.parse(doc.data)),revision:doc.revision};
  }
  function accept(doc) {
    const next = decode(doc);
    if (next.revision < revision) return;
    const changed = next.revision !== revision;
    state = next.state; revision = next.revision;
    if (changed) emit();
  }
  return {
    cloud:true,
    get state() { return structuredClone(state); },
    get revision() { return revision; },
    get busy() { return busy; },
    async load() {
      if (closed) throw Error('Sign in again to open your budget.');
      accept(await transport.read(uid)); ready = true;
      return structuredClone(state);
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    onStatus(fn) { statuses.add(fn); return () => statuses.delete(fn); },
    start() {
      if (stop || closed) return;
      stop = transport.listen(uid, doc => {
        if (closed) return;
        if (busy) { deferred = {doc}; return; }
        try { accept(doc); status('Saved to your private account'); }
        catch { ready = false; status('Cloud data could not be read. Reload before making changes.'); }
      }, () => {
        ready = false; status('Sync unavailable. Reload when connected before saving.');
      });
    },
    async save(value) {
      if (closed || !ready) throw Error('Your cloud budget is unavailable. Reconnect and reload before saving.');
      if (busy) throw Error('A save is still in progress. Please wait.');
      const next = validateBudget(value), data = JSON.stringify(next), expected = revision;
      if (new TextEncoder().encode(data).length > 700000) {
        throw Error('This budget is too large to sync. Export a backup before making more changes.');
      }
      busy = true; status('Saving…');
      try {
        await transport.transact(uid, doc => {
          if (closed) throw Error('The account changed. Sign in again.');
          const remote = decode(doc);
          if (remote.revision !== expected) {
            throw Error('Your budget changed on another device. Reload to see it, then try your change again.');
          }
          return {schemaVersion:1,revision:expected+1,data};
        });
        if (closed) throw Error('The account changed. Sign in again.');
        state = next; revision = expected+1;
        status('Saved to your private account');
      } catch (error) {
        status('Not saved. '+error.message);
        throw error;
      } finally {
        busy = false;
        if (deferred && !closed) {
          try { accept(deferred.doc); }
          catch { ready = false; status('Cloud data could not be read. Reload before making changes.'); }
        }
        deferred = null;
      }
      return structuredClone(state);
    },
    dispose() {
      closed = true; ready = false; stop?.();
      listeners.clear(); statuses.clear(); state = emptyBudget(); deferred = null;
    }
  };
}
