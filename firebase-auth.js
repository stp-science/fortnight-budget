import {isBudgetOwner} from './firebase-policy.js';

const status = document.querySelector('#signin-status');
const login = document.querySelector('#google-login');
const gate = document.querySelector('#signin-gate');
const root = document.querySelector('#budget-root');
let mounted = false;

function message(text) { status.textContent = text; }

async function start() {
  const [appSDK, authSDK, response] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js'),
    fetch('/__/firebase/init.json', {cache: 'no-store'})
  ]);
  if (!response.ok) throw Error('Firebase hosting is not connected yet.');
  const config = await response.json();
  const allowedEmail = document.querySelector('meta[name="budget-owner"]').content;
  if (!allowedEmail) throw Error('The budget owner has not been configured.');
  const auth = authSDK.getAuth(appSDK.initializeApp(config));
  // A returning user is restored by Firebase before the sign-in button appears.
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
    if (!isBudgetOwner(user, allowedEmail)) {
      // Clear the mounted app and its in-memory state after logout in any tab.
      if (mounted) { location.reload(); return; }
      root.replaceChildren();
      gate.hidden = false;
      login.hidden = false;
      if (user) {
        await authSDK.signOut(auth);
        message('That Google account cannot open this budget. Use your authorised account.');
      } else if (!status.textContent || status.textContent === 'Restoring your sign-in…') {
        message('Sign in once on this device. Your sign-in will be remembered.');
      }
      return;
    }
    if (mounted) return;
    mounted = true;
    try {
      root.append(document.querySelector('#budget-template').content.cloneNode(true));
      gate.hidden = true;
      const bar = document.createElement('div'); bar.className = 'signed-in-bar';
      const label = document.createElement('span'); label.textContent = 'Signed in · ' + user.email;
      const logout = document.createElement('button'); logout.className = 'text-button';
      logout.type = 'button'; logout.textContent = 'Sign out';
      logout.onclick = async () => {
        logout.disabled = true;
        try { await authSDK.signOut(auth); }
        catch { logout.disabled = false; logout.textContent = 'Try signing out again'; }
      };
      bar.append(label, logout); root.querySelector('main').prepend(bar);
      await import('./app.js');
    } catch {
      root.replaceChildren(); gate.hidden = false; login.hidden = true;
      message('The budget could not open. Refresh the page to try again. Your saved records have not been changed.');
    }
  }, () => message('Your sign-in could not be restored. Refresh to try again.'));
}

start().catch(error => {
  login.hidden = true;
  message(error.message === 'The budget owner has not been configured.' ? error.message :
    'Sign-in is unavailable. Check your connection and refresh the page.');
});
