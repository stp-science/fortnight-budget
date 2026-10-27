import {readFile, writeFile, mkdir, cp, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export async function buildFirebase({ownerEmail = process.env.BUDGET_OWNER_EMAIL, output} = {}) {
  if (!/^[^@\s<>"']+@[^@\s<>"']+\.[^@\s<>"']+$/.test(ownerEmail || '')) {
    throw Error('Set BUDGET_OWNER_EMAIL to the authorised Google email before building.');
  }
  const root = fileURLToPath(new URL('../', import.meta.url));
  const destination = output || path.join(root, 'dist-firebase');
  const source = await readFile(path.join(root, 'index.html'), 'utf8');
  const body = source.match(/<body>([\s\S]*)<\/body>/)[1]
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const head = source.slice(0, source.indexOf('<body>'))
    .replace('</head>', `<meta name="budget-owner" content="${ownerEmail.toLowerCase()}">
<meta name="robots" content="noindex,nofollow">
<style>[hidden]{display:none!important}.signin-gate{max-width:440px;margin:15vh auto;padding:32px;text-align:center}.signin-gate h1{font:42px Georgia}.signin-gate p{line-height:1.7}.signin-gate .brand{font:italic 70px Georgia}</style></head>`);
  await rm(destination, {recursive: true, force: true});
  await mkdir(destination, {recursive: true});
  // Explicitly allow only browser assets: no server code, secrets or backups.
  for (const name of ['app.js', 'model.js', 'style.css', 'icon.svg', 'firebase-auth.js', 'firebase-policy.js']) {
    await cp(path.join(root, name), path.join(destination, name));
  }
  await writeFile(path.join(destination, 'index.html'), head + `<body>
<section id="signin-gate" class="signin-gate"><div class="brand">f.</div><h1>Your money.<br>Your space.</h1>
<p id="signin-status" role="status">Restoring your sign-in…</p>
<button id="google-login" class="button primary" type="button" hidden>Continue with Google</button>
<p class="muted">Your budget records stay in this browser.</p></section>
<div id="budget-root"></div><template id="budget-template">${body}</template>
<script type="module" src="firebase-auth.js"></script></body></html>`);
  return destination;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildFirebase();
  console.log('Firebase hosting files built in dist-firebase.');
}
