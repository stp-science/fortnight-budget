# Fortnight

A small, responsive daily expense tracker for the money between paydays. Choose a category, enter one total per purchase/payment, and optionally add the store name. No item-by-item shopping list is needed.

## Use

Serve this folder with any static web host, including GitHub Pages, or run `npm start` and open http://127.0.0.1:4173. No installation or build step is required. `npm test` runs the calculation tests with Node 22+.

1. Set the window's start date and next payday. The next payday belongs to the next window. The first window can be shorter than 14 days.
2. Enter your actual opening bank balance, including income already received. Later contributions can be logged as money received. Expected income does not count.
3. Add fixed bills with exact due dates and weekly, fortnightly, monthly or one-off schedules. Monthly dates clamp to the last day of shorter months. An optional last date supports cancellations and price changes.
4. Log daily purchases with a category dropdown. The category donut and money-left line chart update immediately. Edit or delete mistakes.
5. Mark fixed bills paid in the bills list. Do not also enter them as daily expenses: they were already reserved.
6. Log savings only when you actually transfer money out of the tracked spending account. A savings target and unspent cash are not treated as savings achieved.
7. Start the next fortnight with its actual bank balance (including payday income), copying bill schedules if desired. Previous windows stay available.

## Calculations

**Left to spend = opening money + later money received − all fixed bills in the window − daily expenses − actual savings transfers − keep-back buffer.**

Estimated current cash subtracts only fixed bills marked paid, while left to spend reserves every scheduled bill whether paid or unpaid. The daily guide divides positive remaining money by calendar days left including today, using Pacific/Auckland dates. It includes variable essentials such as groceries and fuel, not just discretionary shopping. Negative budgets stay visibly negative. The trend chart reserves fixed bills from the start and plots the effect of income, expenses and savings entries.

Keep all entries within the chosen dates. Opening money must be the balance before that window's logged expenses; do not start from today's balance and re-enter spending already included in it. Money returned from savings should be logged as received income, with a note, and reviewed when assessing net saving across windows.

## Data and privacy

No bank connection, account sign-in, analytics, external fonts, server-side storage or cloud sync. Records are stored in localStorage on the current browser/device and origin. Hosting the app on GitHub Pages does not upload entries to GitHub. Someone using the same browser profile can see the records. Clearing browser data can remove them. Export backups regularly; import a backup on another device to move records. The app does not automatically send entries to the finance-coaching chat or its reminders.

Backups contain financial information. Keep them private and out of source control. Import validates dates, categories and integer money values and asks before replacing existing records. Monetary calculations use integer cents. The app retains completed windows rather than silently rolling balances forward. Source code contains no personal financial data; user-specific setup can be imported locally.

## GitHub Pages

In repository **Settings → Pages**, select **Deploy from a branch**, branch **main**, folder **/ (root)**. Availability for private repositories depends on your GitHub plan. Source can also be downloaded and served locally without publishing. GitHub Pages serves the static app; it is not a private database or a backup service.

## Limitations

Bill dates and amounts are user assumptions; this is a spending plan, not a bank balance. The app cannot verify whether bills cleared. Browser storage has no automatic cross-device backup. The existing chat reminders are separate; no background notifications are added by this app.
