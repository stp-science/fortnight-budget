import {isGoogleUser, canImportLegacy} from './firebase-policy.js';
import {createCloudBudgetStore, configureBudgetStorage, validateBudget} from './budget-storage.js';

const status = document.querySelector('#signin-status');
const login = document.querySelector('#google-login');
const gate = document.querySelector('#signin-gate');
const root = document.querySelector('#budget-root');
let mountedUid = null, activeStore = null, generation = 0;
function message(text) { status.textContent = text; }
function downloadLegacy(text) {
  const url = URL.createObjectURL(new Blob([text], {type:'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = 'fortnight-device-backup.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function migrationChoice(user, store, legacyOwner) {
  if (!canImportLegacy(user, legacyOwner)) return Promise.resolve();
  let raw, legacy;
  try {
    raw = localStorage.getItem('fortnight-budget-v1');
    if (!raw) return Promise.resolve();
    legacy = validateBudget(JSON.parse(raw));
    if (!legacy.periods.length) return Promise.resolve();
  } catch { return Promise.resolve(); }
  const emptyCloud = !store.state.periods.length;
  message(emptyCloud ? 'There is an existing budget on this device. Upload it to your private Google account to use it across devices?' :
    'Your cloud budget is ready. A separate older device budget is also available. You can download a copy before continuing.');
  const choices = document.createElement('div'); choices.className = 'migration-choices'; gate.append(choices);
  const backup = document.createElement('button'); backup.className = 'button subtle'; backup.type = 'button';
  backup.textContent = 'Download old device backup'; backup.onclick = () => downloadLegacy(raw); choices.append(backup);
  return new Promise(resolve => {
    if (emptyCloud) {
      const upload = document.createElement('button'); upload.type = 'button'; upload.className = 'button primary';
      upload.textContent = 'Upload my existing budget'; choices.append(upload);
      upload.onclick = async () => {
        upload.disabled = true; skip.disabled = true;
        try {
          await store.save(legacy);
          // Keep the original local budget as a recovery copy.
          try { localStorage.setItem('fortnight-migrated-'+user.uid, 'complete'); } catch {}
          choices.remove(); resolve();
        } catch (error) { message('Import was not saved: '+error.message); upload.disabled = false; skip.disabled = false; }
      };
    }
    const skip = document.createElement('button'); skip.type = 'button'; skip.className = 'button subtle';
    skip.textContent = emptyCloud ? 'Start with an empty cloud budget' : 'Continue to my cloud budget';
    skip.onclick = () => { choices.remove(); resolve(); }; choices.append(skip);
    try {
      if (!emptyCloud && localStorage.getItem('fortnight-migrated-'+user.uid) === 'complete') { choices.remove(); resolve(); }
    } catch {}
  });
}

async function start() {
  const [appSDK, authSDK, response] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js'),
    fetch('/__/firebase/init.json', {cache:'no-store'})
  ]);
  if (!response.ok) throw Error('Firebase hosting is not connected yet.');
  const config = await response.json(), app = appSDK.initializeApp(config), auth = authSDK.getAuth(app);
  const legacyOwner = document.querySelector('meta[name="budget-legacy-owner"]')?.content || '';
  await authSDK.setPersistence(auth, authSDK.browserLocalPersistence);
  const provider = new authSDK.GoogleAuthProvider();
  login.onclick = async () => {
    login.disabled = true;
    try { await authSDK.signInWithPopup(auth, provider); }
    catch (error) {
      message(error.code === 'auth/popup-closed-by-user' ? 'Sign-in was cancelled. Try again when ready.' :
        error.code === 'auth/popup-blocked' ? 'Allow pop-ups for this site, then try again.' :
        'Google sign-in could not finish. Check your connection and try again.');
    } finally { login.disabled = false; }
  };
  authSDK.onAuthStateChanged(auth, async user => {
    if (mountedUid === user?.uid && isGoogleUser(user)) return;
    const thisGeneration = ++generation;
    if (mountedUid && user?.uid !== mountedUid) {
      activeStore?.dispose(); root.replaceChildren(); gate.hidden = false;
      location.reload(); return;
    }
    activeStore?.dispose(); activeStore = null; configureBudgetStorage(null);
    gate.querySelectorAll('.migration-choices').forEach(el => el.remove());
    if (!isGoogleUser(user)) {
      root.replaceChildren(); gate.hidden = false; login.hidden = false;
      if (user) { await authSDK.signOut(auth); message('Use a verified Google account to open your private budget.'); }
      else message('Sign in with Google. Your budget is private to your account.');
      return;
    }
    if (mountedUid === user.uid) return;
    login.hidden = true; message('Opening your private budget…');
    try {
      const sdk = await import('https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js');
      const db = sdk.initializeFirestore(app, {localCache:sdk.memoryLocalCache()});
      const reference = uid => sdk.doc(db, 'budgets', uid);
      const transport = {
        async read(uid) {
          const snapshot = await sdk.getDocFromServer(reference(uid));
          return snapshot.exists() ? snapshot.data() : null;
        },
        transact(uid, update) {
          return sdk.runTransaction(db, async tx => {
            const ref = reference(uid), snapshot = await tx.get(ref);
            tx.set(ref, {...update(snapshot.exists() ? snapshot.data() : null), updatedAt:sdk.serverTimestamp()});
          });
        },
        listen(uid, receive, error) {
          return sdk.onSnapshot(reference(uid), snapshot => {
            if (!snapshot.metadata.hasPendingWrites && !snapshot.metadata.fromCache) receive(snapshot.exists() ? snapshot.data() : null);
          }, error);
        }
      };
      const store = createCloudBudgetStore({uid:user.uid, transport}); activeStore = store;
      await store.load();
      if (generation !== thisGeneration || auth.currentUser?.uid !== user.uid) { store.dispose(); return; }
      await migrationChoice(user, store, legacyOwner);
      if (generation !== thisGeneration || auth.currentUser?.uid !== user.uid) { store.dispose(); return; }
      configureBudgetStorage(store);
      root.append(document.querySelector('#budget-template').content.cloneNode(true));
      gate.hidden = true; mountedUid = user.uid;
      const bar = document.createElement('div'); bar.className = 'signed-in-bar';
      const label = document.createElement('span'); label.textContent = 'Signed in · '+user.email;
      const sync = document.createElement('span'); sync.id = 'cloud-sync-status'; sync.setAttribute('role','status');
      sync.textContent = 'Saved to your private account'; store.onStatus(text => sync.textContent = text);
      window.addEventListener('offline', () => sync.textContent = 'Offline — reconnect before saving changes');
      window.addEventListener('online', () => sync.textContent = 'Connection restored — changes save when confirmed');
      const logout = document.createElement('button'); logout.type = 'button'; logout.className = 'text-button'; logout.textContent = 'Sign out';
      logout.onclick = async () => {
        logout.disabled = true;
        try { await authSDK.signOut(auth); }
        catch { logout.disabled = false; logout.textContent = 'Try signing out again'; }
      };
      bar.append(label, sync, logout); root.querySelector('main').prepend(bar);
      await import('./app.js');
    } catch {
      if (generation !== thisGeneration) return;
      activeStore?.dispose(); activeStore = null; configureBudgetStorage(null);
      root.replaceChildren(); gate.hidden = false; login.hidden = true;
      message('Your cloud budget could not open. Check your connection and refresh. Your existing records have not been changed.');
      const logout = document.createElement('button'); logout.className = 'button subtle'; logout.textContent = 'Sign out';
      logout.onclick = () => authSDK.signOut(auth); gate.append(logout);
    }
  }, () => message('Your sign-in could not be restored. Refresh to try again.'));
}
start().catch(() => { login.hidden = true; message('Sign-in is unavailable. Check your connection and refresh the page.'); });
