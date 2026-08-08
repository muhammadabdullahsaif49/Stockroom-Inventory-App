# Stockroom — Inventory & Stock Management

A complete inventory and stock management system with a CLI and a zero-dependency
web dashboard. Track items, log stock in/out, get low-stock alerts, and run reports —
all backed by local JSON files, no database or external services required.

## Features

- **User accounts** — register and log in with your email/Gmail before accessing the dashboard; "Remember me" keeps you signed in for 30 days (otherwise sessions expire after 12 hours of inactivity)
- **Item catalog** — SKU, name, category, unit, cost, quantity, and picture
- **Stock movements** — receive (stock in) and issue (stock out), with a customer/vendor name, reference, and notes
- **Low-stock & out-of-stock alerts** — automatically flagged, no manual reorder setting needed
- **Sold Out view** — see every item at zero quantity plus a feed of recent sales
- **Reports** — detailed inventory report (remaining/received/sold per item), transaction history, and low-stock summary — downloadable as CSV (Excel) or PDF
- **Automatic daily backups** — a snapshot of your data is saved to the `backups/` folder every day (last 14 kept), plus manual export/import from the dashboard
- **Dark mode** — toggle from the top bar; your preference is remembered
- **Mobile-friendly** — the dashboard adapts down to phone-sized screens
- **Two interfaces** — a full CLI for scripting/automation, and a web dashboard for day-to-day use
- **Zero dependencies** — runs on plain Node.js, no `npm install` required

## Requirements

- [Node.js](https://nodejs.org/) 16 or later (no other dependencies)

## Getting started

```bash
# From the project folder
node server.js
# or
npm start
```

Then open **http://localhost:3000** — you'll land on the login page. Click
**Register here** to create your first account, then log in.

Data is stored locally in `inventory-db.json` (items & transactions) and
`users.json` (accounts) in the project folder — back these up like any other
file. Set `PORT=xxxx node server.js` to run on a different port.

## Accounts & sessions

- Sign up and log in with your email address (e.g. your Gmail) and a password.
- Passwords are hashed with Node's built-in `crypto.scrypt` (salted) — never stored in plain text.
- Check **Remember me** at login for a 30-day session; otherwise sessions expire after 12 hours of inactivity.
- All dashboard pages and API routes require a valid session, except `/login.html`, `/register.html`, and the register/login endpoints themselves.
- Click **Log out** at the bottom of the sidebar to end your session.

## Backups

- The server automatically saves a dated snapshot of `inventory-db.json` and `users.json` into `backups/YYYY-MM-DD/` once per day, keeping the last 14 days.
- From **Backup & Restore** in the dashboard you can also download a full backup file on demand, or restore your data from a previously downloaded file (this replaces current items and transactions).

## Web dashboard

| Section | What it does |
|---|---|
| **Dashboard** | At-a-glance totals, transaction count, and low-stock alerts |
| **Items** | Browse the full catalog with pictures, search, view detail, delete items |
| **Manage Stock** | Add new items (with a picture), and record stock in/out movements with a customer/vendor name |
| **Sold Out** | Everything at zero quantity, plus a feed of the most recent sales |
| **Update Item** | Pick a product and edit its details, picture, or quantity |
| **Reports** | Run a detailed inventory report, transaction report (with date range), or low-stock report — export as CSV or PDF |
| **Backup & Restore** | Download a backup file, restore from one, and see recent automatic backups |

## CLI reference

```bash
node inventory.js help
```

### Add a new item

```bash
node inventory.js add-item --sku P001 --name "Widget" --category Tools --unit pcs --cost 12.50 --reorder 5 --quantity 20
```

### Update an item

```bash
node inventory.js update-item --sku P001 --name "Widget Pro" --cost 13.75
```

### Delete an item

```bash
node inventory.js delete-item --sku P001
```

### List all items

```bash
node inventory.js list-items
```

### View item details

```bash
node inventory.js view-item --sku P001
```

### Receive stock (stock in)

```bash
node inventory.js stock-in --sku P001 --qty 15 --ref PURCHASE-101 --note "Restock"
```

### Issue stock (stock out)

```bash
node inventory.js stock-out --sku P001 --qty 4 --ref SALE-501 --note "Customer order"
```

### Low stock alerts

```bash
node inventory.js low-stock
```

### Reports

```bash
node inventory.js report --type inventory
node inventory.js report --type transactions --from 2026-08-01 --to 2026-08-31
node inventory.js report --type low-stock
```

### Interactive menu

```bash
node inventory.js menu
```

## Project structure

```
.
├── inventory.js            # CLI entry point and business logic
├── server.js                # Zero-dependency HTTP server + REST API
├── auth.js                   # User registration, login, and session handling
├── backup.js                  # Automatic daily backup scheduling
├── inventory-db.json           # Local item/transaction data store (created on first run)
├── users.json                   # Local account store (created on first run)
├── backups/                      # Daily backup snapshots (created on first run)
├── public/
│   ├── index.html                  # Dashboard markup
│   ├── login.html                   # Login page
│   ├── register.html                 # Registration page
│   ├── style.css                      # Shared styling (light + dark themes)
│   ├── app.js                          # Dashboard client logic
│   └── auth-client.js                   # Login/register form handling
├── package.json
└── README.md
```

## Data storage

Inventory and transaction data are stored locally in `inventory-db.json`, and
accounts in `users.json`, both in the project root. There is no external
database — copy or version these files to back up or migrate your data, or
use the built-in daily backups in `backups/`.

## License

MIT
