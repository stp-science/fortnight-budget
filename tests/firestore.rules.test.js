import {before,after,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,getDocs,collection,setDoc,updateDoc,deleteDoc,serverTimestamp} from 'firebase/firestore';

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let environment;
before(async()=>{
  if (!enabled) return;
  environment = await initializeTestEnvironment({projectId:'demo-fortnight-budget',firestore:{rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});
});
after(async()=>{await environment?.cleanup();});
const account=(uid,claims={})=>environment.authenticatedContext(uid,{email:uid+'@example.com',email_verified:true,firebase:{sign_in_provider:'google.com'},...claims}).firestore();
const data=revision=>({schemaVersion:1,revision,data:'{"version":1,"activeId":null,"periods":[]}',updatedAt:serverTimestamp()});

test('Firestore enforces private account boundaries for reads, writes, queries and deletes', {skip:!enabled}, async()=>{
  const owner = account('owner'), friend = account('friend');
  await assertSucceeds(setDoc(doc(owner,'budgets/owner'),data(1)));
  await assertSucceeds(setDoc(doc(friend,'budgets/friend'),data(1)));
  await assertSucceeds(getDoc(doc(owner,'budgets/owner')));
  await assertSucceeds(getDoc(doc(friend,'budgets/friend')));
  await assertFails(getDoc(doc(friend,'budgets/owner')));
  await assertFails(getDoc(doc(owner,'budgets/friend')));
  await assertFails(setDoc(doc(friend,'budgets/owner'),data(2)));
  await assertFails(getDocs(collection(owner,'budgets')));
  await assertFails(deleteDoc(doc(owner,'budgets/owner')));
  await assertFails(setDoc(doc(owner,'elsewhere/owner'),data(1)));
  await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(),'budgets/owner')));
  await assertFails(getDoc(doc(account('owner',{email_verified:false}),'budgets/owner')));
  await assertFails(getDoc(doc(account('owner',{firebase:{sign_in_provider:'password'}}),'budgets/owner')));
});
test('Firestore validates schema, revisions, server timestamps and size', {skip:!enabled}, async()=>{
  const db = account('validation'), ref = doc(db,'budgets/validation');
  await assertFails(setDoc(ref,data(2)));
  await assertFails(setDoc(ref,{...data(1),extra:'unexpected'}));
  await assertFails(setDoc(ref,{...data(1),updatedAt:0}));
  await assertFails(setDoc(ref,{...data(1),data:7}));
  await assertFails(setDoc(ref,{...data(1),data:'x'.repeat(700001)}));
  await assertSucceeds(setDoc(ref,data(1)));
  await assertFails(updateDoc(ref,{revision:1,updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref,{revision:3,updatedAt:serverTimestamp()}));
  await assertSucceeds(setDoc(ref,data(2)));
});
