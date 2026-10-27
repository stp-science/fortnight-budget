import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildFirebase} from '../scripts/build-firebase.js';
import {isBudgetOwner} from '../firebase-policy.js';

test('Firebase gate rejects unverified, wrong-account and non-Google identities', () => {
  const owner = {email:'owner@example.com', emailVerified:true, providerData:[{providerId:'google.com'}]};
  assert.equal(isBudgetOwner(owner, 'OWNER@example.com'), true);
  for (const user of [null, {...owner,emailVerified:false}, {...owner,email:'other@example.com'}, {...owner,providerData:[]}]) {
    assert.equal(isBudgetOwner(user, 'owner@example.com'), false);
  }
  assert.equal(isBudgetOwner(owner, ''), false);
});

test('Firebase deployment fails closed without a configured owner', async () => {
  await assert.rejects(buildFirebase({ownerEmail:''}), /BUDGET_OWNER_EMAIL/);
  await assert.rejects(buildFirebase({ownerEmail:'"><script>'}), /BUDGET_OWNER_EMAIL/);
});

test('Firebase deployment contains only browser assets and defers budget startup', async t => {
  const output = await mkdtemp(path.join(tmpdir(), 'fortnight-firebase-'));
  t.after(() => rm(output, {recursive:true,force:true}));
  await buildFirebase({ownerEmail:'owner@example.com',output});
  assert.deepEqual((await readdir(output)).sort(), ['app.js','firebase-auth.js','firebase-policy.js','icon.svg','index.html','model.js','style.css']);
  const html = await readFile(path.join(output,'index.html'),'utf8');
  assert.match(html, /<template id="budget-template">/);
  assert.match(html, /content="owner@example.com"/);
  assert.match(html, /src="firebase-auth.js"/);
  assert.doesNotMatch(html, /<script[^>]*src="app.js"/);
  assert.match(html, /id="export"/);
  assert.match(html, /id="import"/);
});
