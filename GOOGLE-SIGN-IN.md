# Owner-only Google sign-in

This version adds a real server boundary. The budget HTML, JavaScript, styles and session API are only served after successful Google authentication and an exact, verified-email allowlist check. The public sign-in page contains no budget information. Sign-in requests only `openid` and `email`, not Gmail, Drive or financial-account access.

## Hosting

GitHub Pages cannot run this server. Keep the current Pages app unchanged while setting up the new host; do not describe it as protected. Once the protected version has been tested, disable the old Pages publication in repository Settings → Pages so there is no public app URL left. The repository's source code remains public until its visibility is changed separately; it contains no personal financial data or credentials.

Render is one supported host. Create a **Web Service** from this repository, using the `google-sign-in` branch while reviewing the change (or `main` after merge). Select Node runtime, `npm ci --omit=dev` as the build command, and `npm start` as the start command. A `render.yaml` blueprint is also provided. Select the Free compute plan if appropriate and review its usage limits. Free services can sleep after inactivity and take about a minute to wake; each restart signs you out but does not erase browser-stored budgets. No paid service is provisioned by this code.

## One-time Google setup

1. In Google Cloud Console, create or select a project for this app.
2. Open Google Auth Platform and configure Branding and Audience. Use External audience for a personal Gmail account. While in Testing, add only your own Google email as a test user. For this app only `openid` and `email` are requested.
3. Create an OAuth client of type **Web application**. Register exactly `https://YOUR-RENDER-SERVICE.onrender.com/auth/callback` as an authorised redirect URI. Use the actual host assigned to your service. A local test callback can be registered separately, but should not replace the production callback.
4. In the hosting service's private environment settings, add:
   - `APP_URL`: your service origin, e.g. `https://YOUR-RENDER-SERVICE.onrender.com`, without an extra path.
   - `GOOGLE_CLIENT_ID`: the client ID Google issued.
   - `GOOGLE_CLIENT_SECRET`: Google's client secret. Enter this in private hosting settings only, never a public repository, form in this app, issue, screenshot or chat message.
   - `ALLOWED_GOOGLE_EMAIL`: your exact Google email address. Only this verified address is accepted, even if other people can use the OAuth client.
   - `NODE_ENV`: `production`.
5. Redeploy. Opening the app while signed out must show the sign-in screen; directly requesting `/app.js` must return 401. Sign in with your allowed Google account and verify the budget loads. Check that a different Google account cannot enter. Never create a client-side-only check as a replacement.

The service fails closed when configuration is incomplete. Its health endpoint is available but never includes records or secrets. Do not use `server.js` as the deployment start command: it is a loopback-only preview helper with no sign-in.

## Move your existing records

Download a backup from the existing app before switching hosts. Sign in on the protected host and import that backup through Plan & backups. Browser storage is separated by origin, so the new host does not automatically receive the old records. Never add a personal backup to the repository.

Budget records continue to live only in the local browser; this change does not add cloud sync, a database or bank connections. A person controlling the same unlocked browser/device can inspect its local storage. Google sign-in protects server access, not the browser's disk. Sign out removes the server session and redirects to the sign-in page; it intentionally retains the local budget so your own next sign-in can use it. Close budget tabs and secure the device when sharing it.

## Validation

`npm test` includes unit tests for owner-only access, unverified/wrong accounts, invalid tokens, state binding and replay, PKCE, session expiry, logout CSRF checks, protected assets and incomplete setup. Tests mock the official Google client; a real Google account test is still required after configuring the provider. Google tokens are verified with the pinned official `google-auth-library`, including audience/signature/issuer/expiry checks. The app also checks nonce, verified email and the server allowlist.

Server-side sessions and OAuth transaction state are kept in bounded memory with expiry. Run one instance; scaling to multiple instances requires a shared session store. No refresh token is requested or stored. Sessions last eight hours and are invalidated on restart. Session cookies are HttpOnly, Secure on HTTPS, SameSite=Lax and use the __Host prefix in production. Logout requires a matching origin and per-session CSRF token. No ID token, authorisation code, client secret or session token is logged by the application.
