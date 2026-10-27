import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildFirebase} from '../scripts/build-firebase.js';
import {isGoogleUser,canImportLegacy} from '../firebase-policy.js';

test('all verified Google users can use their own account, but only the original owner can import unscoped local records', () => {
  const owner = {uid:'owner-id',email:'owner@example.com', emailVerified:true, providerData:[{providerId:'google.com'}]};
  const friend = {...owner,uid:'friend-id',email:'friend@example.com'};
  assert.equal(isGoogleUser(owner), true);
  assert.equal(isGoogleUser(friend), true);
  assert.equal(canImportLegacy(owner,'OWNER@example.com'), true);
  assert.equal(canImportLegacy(friend,'owner@example.com'), false);
  assert.equal(canImportLegacy(owner,''), false);
  for (const user of [null, {...owner,uid:''}, {...owner,emailVerified:false}, {...owner,providerData:[]}]) {
    assert.equal(isGoogleUser(user), false);
  }
});

test('Firebase deployment rejects an invalid migration email', async () => {
  await assert.rejects(buildFirebase({ownerEmail:'"><script>'}), /BUDGET_OWNER_EMAIL/);
});

test('Firebase deployment contains only browser assets and defers budget startup', async t => {
  const output = await mkdtemp(path.join(tmpdir(), 'fortnight-firebase-'));
  t.after(() => rm(output, {recursive:true,force:true}));
  await buildFirebase({ownerEmail:'owner@example.com',output});
  assert.deepEqual((await readdir(output)).sort(), ['app.js','budget-storage.js','firebase-auth.js','firebase-policy.js','icon.svg','index.html','model.js','style.css']);
  const html = await readFile(path.join(output,'index.html'),'utf8');
  assert.match(html, /<template id="budget-template">/);
  assert.match(html, /content="owner@example.com"/);
  assert.match(html, /src="firebase-auth.js"/);
  assert.doesNotMatch(html, /<script[^>]*src="app.js"/);
  assert.match(html, /id="export"/);
  assert.match(html, /id="import"/);
  assert.match(html, /budget-legacy-owner/);
  assert.match(html, /Your private budget, on every device/);
  assert.doesNotMatch(html, /Your entries are stored in this browser/);
});
