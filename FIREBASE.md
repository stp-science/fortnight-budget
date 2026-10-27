# Firebase accounts and private cloud budgets

The Firebase deployment uses Google sign-in, remembered sessions, Firebase Hosting and Cloud Firestore. Each verified Google user gets a separate document at `budgets/{Firebase UID}`. The same account opens the same budget on every device; friends using different accounts do not share records. No bank connection or shared household budget is included.

## Deploy to Fortnight Budget

The project is `fortnight-budget-5eaff`. Its default Firestore database must exist in Standard edition / Native mode. Use production mode when creating it (all access denied until the checked-in rules are deployed). The default database is in `australia-southeast1` (Sydney). Keep the existing Spark plan; do not enable paid backups or upgrade billing as part of this change.

In the existing online Google Cloud Shell checkout:

```bash
cd ~/fortnight-firebase
git pull --ff-only origin firebase-hosting
npm ci
BUDGET_OWNER_EMAIL='talbot.g85@gmail.com' firebase deploy --only firestore,hosting --project fortnight-budget-5eaff
```

Deploy the rules and indexes together with Hosting. Do not manually use test mode, public read/write rules, or deploy the new cloud app without its ownership rules. Google sign-in must remain enabled. The Hosting domain must remain an authorised Authentication domain. `BUDGET_OWNER_EMAIL` is now used only to recognise the original owner's old unscoped device budget for migration; it does not restrict new accounts.

## Existing records

On the original owner's first visit after deployment, if this browser contains an old local budget and the cloud account is empty, the app offers **Download old device backup**, **Upload my existing budget**, or **Start with an empty cloud budget**. Upload is explicit, uses a transaction that requires the cloud account still to be empty, and preserves the original browser copy. Friends never read this legacy storage even on the same computer. An existing cloud budget is never automatically replaced by device records.

A backup can also be imported from **Plan & backups**. If a cloud budget already exists, replacement requires an explicit confirmation that applies across all signed-in devices. Backups remain private financial files. Export them regularly. The app does not provide a destructive cloud-reset button.

## Access and privacy

The server-side Firestore rules allow only a verified Google user to get/create/update their own UID document. Queries listing all budgets, all cross-account reads/writes, anonymous/unverified/non-Google access, deletes, and other paths are denied. Rules also enforce a strict document envelope, a server timestamp, and increasing revisions. Client-side email checks are not used as the security boundary.

As with any hosted service, the Firebase project owner/administrators can manage stored records through administrative access. Signing in does not give a friend admin access. Budget data is not written into source control, analytics or logs. Firestore uses memory-only browser caching. Signing out clears the mounted interface, listeners and in-memory budget; authentication persistence remains separate. Legacy device records are retained only as a migration/recovery source on the original device.

## Save behaviour and limits

The app loads the account from the server before displaying a budget. Saves require connectivity and complete before showing success or closing the form. Transactions reject stale revisions; stale open forms also refuse to overwrite remotely changed data. Other signed-in devices update via document listeners. A failed or offline save preserves the last confirmed state and the form values so the user can retry. There is no offline edit queue and no silent last-writer-wins overwrite.

A single cloud budget is limited to 700,000 UTF-8 JSON bytes, below Firestore's document limit. Larger imports fail without replacing records. Firebase free-plan quotas still apply to storage, reads and writes; they are shared across users of this project.

## Verification

`npm test` runs calculation, auth, cloud-store, migration eligibility, deployment and DOM-level application tests. `npm run test:rules` starts the local Firestore emulator against the demo project and checks the actual rules with separate authenticated users, anonymous and unverified clients, forbidden queries, schema/revision/timestamp validation, and cross-account reads/writes. It does not contact production data. Firebase tools 14 supports Java 17 for the emulator; later tools may require Java 21.

After deployment, verify Google login with two separate accounts, creation of separate budgets, restore/update of one account on another device, and the original owner's migration. Do not use a friend's identity or upload their financial data as a test.
