# MENENGAI JMO ENTERPRISES — Retail POS

Point of sale and inventory management for MENENGAI JMO ENTERPRISES, Kiamunyi.

A lightweight point-of-sale and inventory app for a clothing and shoe shop. It runs in a modern browser without a build step. It can be installed as a mobile Progressive Web App (PWA).

## Public app

A GitHub Actions workflow publishes the app at <https://jmo2030.github.io/mastersproject/>. Before the first deployment, enable GitHub Pages in the repository's **Settings → Pages** and set the source to **GitHub Actions**. Every push to `main` then triggers a deployment.

## Run it

For PWA installation and offline support, serve the app from an HTTPS host, or locally from `http://localhost`:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`. Opening `index.html` directly as a `file://` URL still works for browser use, but browsers disable PWA installation and service workers for file URLs.

### Install on a phone

Open the public app URL above over HTTPS:

- **Android:** open the URL in Chrome, then choose **Install app** or **Add to Home screen**.
- **iPhone/iPad:** open the URL in Safari, tap **Share**, then **Add to Home Screen**.
- The app shell is cached on first visit for offline reopening. Each browser/device keeps its own separate local data; this PWA does not synchronize between devices.
- Existing data from a `file://` browser session is separate from the installed website. Before switching, download a backup from **Store settings → Backups**, then restore it after opening the HTTPS app.

The demo accounts are:

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Manager | `manager` | `manager123` |
| Cashier | `cashier` | `cashier123` |

## Features

- Dashboard with daily sales totals, inventory levels, low-stock alerts, and recent transactions
- Point of sale with product search, category filters, cart quantity controls, Cash, M-Pesa, or Card payment, optional 8% tax toggle, and printable receipts
- Inventory management to add, edit, search, filter, delete, and export products; download a CSV template to bulk-upload new products
- Order management with customer details, pending/fulfilled/cancelled statuses, and stock reservation; cancelling an order returns its reserved stock
- Create, save, print, and convert 14-day quotations for currently available stock; quotations do not reserve inventory until converted to an order
- Sales history and CSV export
- Separate reports for sales performance, inventory valuation and reorder alerts, and payment-method reconciliation; filter sales/payment reports by today, last 7 days, last 30 days, or all time
- Export reports to PDF using the browser's print dialog (select **Save as PDF**)
- Per-product bargain discounts at checkout, reflected in totals, optional tax calculation, sales history, and receipts
- Upload a company logo from **Store settings**; the logo appears in the sidebar, sign-in screen, receipts, and PDF reports
- Set the company email, phone number, and website in **Store settings → Company profile** to include them on printed receipts and PDF report headers
- Admin-only **User management** settings tab to create, edit, activate, deactivate, and delete staff profiles; Admin, Manager, and Cashier roles have different page access
- Admin-only **Backups** settings tab; an automatic browser-local backup is saved every 12 hours while the app is open, with options to create, download, and restore a backup file
- Product and sale data persisted in the browser's local storage
- Prices, sales, and receipts displayed in Kenyan shillings (KSh)
- Consistent light-blue theme across the sign-in screen and every workspace page
- Installable PWA with home-screen icons and offline app-shell caching
- Tax is off by default for each checkout and can be added by selecting **Add tax**; when selected, 8% is calculated after any product discount

The product CSV template uses these columns in order: `SKU`, `Product Name`, `Category`, `Size`, `Price (KES)`, `Stock`. Categories must be `Clothing`, `Shoes`, or `Accessories`. Uploads are validated as a whole; duplicate SKUs or invalid rows prevent the entire file from being imported. Existing products are not overwritten.

This public app is a front-end demo, not a secure production system. Login accounts, passwords, sales, customer details, and backups are stored in the browser and are not shared or synchronized between devices. Do not enter real customer, employee, or financial information. Use a server with secure authentication, access controls, and protected backups before using it for real business. Automatic backups are held in browser storage, so download backup files regularly to keep an independent copy; the app must be open for the 12-hour timer to run, and overdue backups are created when reopened. Previous sample sales are cleared when the updated app opens; actual sales are retained. Previously saved USD demo amounts are converted to KSh using a simple 100:1 demo conversion the first time the updated app opens. The sales chart is illustrative; sales totals and inventory counts are based on saved browser data.
