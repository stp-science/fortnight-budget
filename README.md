# Fortnight

A small, responsive daily expense tracker for the money between paydays. Choose a category, enter one total per purchase/payment, and optionally add the store name. No item-by-item shopping list is needed.

## Use

For owner-only Google sign-in, follow [GOOGLE-SIGN-IN.md](GOOGLE-SIGN-IN.md). Run `npm ci`, set the private server environment variables shown in `.env.example`, and run `npm start`. This starts the protected server, defaulting to port 4174 locally. Google OAuth needs the matching registered callback URL. Incomplete configuration leaves the app locked.

For a local preview without authentication, run `npm run preview` and open http://127.0.0.1:4173. That preview listens only on loopback and must not be used as a hosted server. `npm test` runs the budget and sign-in tests with Node 22+.

1. Set the window's start date and next payday. The next payday belongs to the next window. The first window can be shorter than 14 days.
2. Enter your actual opening bank balance, including income already received. Later contributions can be logged as money received. Expected income does not count.
3. Add fixed bills with exact due dates and weekly, fortnightly, monthly or one-off schedules. Monthly dates clamp to the last day of shorter months. An optional last date supports cancellations and price changes.
4. Log daily purchases with a category dropdown. The category donut and money-left line chart update immediately. Edit or delete mistakes.
5. Fixed bills automatically deduct from estimated cash on their due date, using Pacific/Auckland dates. No ticking is required. Do not enter them again as daily expenses: they were already reserved. Edit the schedule if an actual debit is delayed or changed.
6. Log savings only when you actually transfer money out of the tracked spending account. A savings target and unspent cash are not treated as savings achieved.
7. Start the next fortnight with its actual bank balance (including payday income), copying bill schedules if desired. Previous windows stay available.

## Calculations

**Left to spend = opening money + later money received − all fixed bills in the window − daily expenses − actual savings transfers − keep-back buffer.**

Estimated current cash automatically subtracts fixed bills dated today or earlier in Auckland time, while left to spend reserves every bill in the window from the start. The allowance therefore does not fall a second time when a bill comes due. Previously recorded early-paid bills remain honoured without double counting. No synthetic expense entries or duplicate automatic-payment records are written. The display refreshes at the next date while open and recalculates when reopened; no background service is needed. A visible estimated-bank-balance figure shows scheduled deductions. The daily guide divides positive remaining money by calendar days left including today, using Pacific/Auckland dates. It includes variable essentials such as groceries and fuel, not just discretionary shopping. Negative budgets stay visibly negative. The trend chart reserves fixed bills from the start and plots the effect of income, expenses and savings entries.

Keep all entries within the chosen dates. Opening money must be the balance before that window's logged expenses; do not start from today's balance and re-enter spending already included in it. Money returned from savings should be logged as received income, with a note, and reviewed when assessing net saving across windows.

## Data and privacy

No bank connection, analytics or external fonts. Optional private cloud sync stores the budget in a dedicated Supabase project, behind the Render server's owner-only Google authentication. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY only in the server environment after applying cloud-schema.sql. The backend key must never be put in browser code, GitHub, a backup, or a chat message. Budget tables have RLS enabled and no browser grants or browser policies; only the protected backend can use their RPCs. The verified Google subject selects the owner; clients cannot choose it.

Online writes use revision checks and retained recovery history. A stale device cannot overwrite a newer budget. Offline changes are kept as a pending device copy; retry before making another change. A first device with a different existing budget asks you to choose the online copy and offers a recovery download. Download regular backups even with sync. Mark a date complete after all expenses are logged; adding, editing or deleting expenses reopens the affected day. A connected finance coach can read the saved budget through the authorised Supabase connection for reminders; Google sign-in alone does not connect a chat.

Without storage configuration, the app continues using browser-only records and explicitly shows that online setup is pending. The static preview and old GitHub Pages site have no server authentication or sync.

Backups contain financial information. Keep them private and out of source control. Import validates dates, categories and integer money values and asks before replacing existing records. Monetary calculations use integer cents. The app retains completed windows rather than silently rolling balances forward. Source code contains no personal financial data; user-specific setup can be imported locally.

## GitHub Pages

GitHub Pages can serve only the public static version; it cannot run this Google sign-in server. If a Pages version is already published, it stays publicly accessible until you disable Pages after verifying the protected host. Keep a private backup before changing hosts. See the Google sign-in guide for the hosting setup. Do not assume the presence of `auth-server.js` in a repository protects a Pages deployment.

## Limitations

Bill dates and amounts are user assumptions; this is a spending plan, not a bank balance. The app cannot verify whether bills cleared; due-date deductions are estimates, not bank confirmations. Cross-device sync requires the private storage environment variables and a working connection. This app does not send notifications itself; the separate coaching reminder must read the connected storage.
