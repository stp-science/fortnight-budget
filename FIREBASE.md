# Firebase Hosting and remembered Google sign-in

This deployment serves browser assets directly from Firebase Hosting, with Firebase Authentication remembering the owner across browser restarts. No Render process, Cloud Functions, Firestore, bank connection or cloud budget sync is required. The current Render deployment continues to work while this migration is prepared.

## Account setup and deployment

1. Choose or create the owner's Firebase project and register a web app. Enable Authentication → Google and select the project's support email. Ensure the Hosting domain is an authorised Authentication domain.
2. Confirm the same authorised Google email used for the existing Render deployment. Do not infer it from a GitHub profile or expose Google client secrets. Set `BUDGET_OWNER_EMAIL` in the deployment environment to that email. This is a public UI allowlist, not a secret.
3. With a Firebase CLI authenticated to that project, run `npm ci`, `npm test`, then `firebase deploy --only hosting --project PROJECT_ID`. The predeploy step builds the site. `BUDGET_OWNER_EMAIL` must be present or the build fails. Hosting supplies its public web configuration at `/__/firebase/init.json`; no Google OAuth client secret is shipped.
4. Open the new HTTPS address, sign in with the owner account, close the browser and reopen it to verify restored access. Check an unrelated Google account is rejected and sign-out in another tab locks the app.

## Transfer existing records

On the device/browser with the current records, open https://fortnight-budget.onrender.com, select **Plan & backups → Download backup**, and keep that private JSON file. On the new Firebase address in the same browser, sign in and use **Plan & backups → Import backup**. Compare the fortnight, opening money, bills, expenses and remaining balance before switching bookmarks. The new domain cannot read the old domain's browser storage automatically. Keep the old address and backup until the transfer is confirmed; do not clear its records or redirect it prematurely.

## Privacy and access boundary

Budgets remain in localStorage on the current device and domain. Firebase receives identity information for authentication, not budget entries. App assets are publicly downloadable, as on any static host. The sign-in gate controls the normal interface and prevents the budget module from reading local records before an authorised login, but it does not encrypt localStorage or replace operating-system/browser-profile security. Someone with access to this browser profile can inspect its local records. If server-side budget storage or cross-device sync is added later, enforce ownership in database security rules; a browser email check is not a database access control.

Firebase sign-in uses browser local persistence. Clearing browser data, revoking access or signing out can require a fresh login. Signing out does not delete budget records. Popup errors show a retry message, and unavailable Firebase/configuration leaves the app locked.
