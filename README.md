# Viros GST Billing — GST ERP System

A full-featured GST ERP system built with Next.js 14, TypeScript, and MySQL (no ORM — raw MySQL2 queries).

## Features

| Module | Description |
|--------|-------------|
| Authentication | JWT-based login with NextAuth.js, bcrypt password hashing |
| Dashboard | Real-time stats, sales/purchase charts (Recharts) |
| Inventory | Product CRUD, stock tracking, HSN codes, GST rates |
| Customers | Customer management with GSTIN, ledger |
| Vendors | Vendor management with GSTIN, ledger |
| Billing/Invoices | GST-compliant invoicing with CGST/SGST/IGST support |
| Quotations | Quotation builder with convert-to-invoice |
| Purchases | Purchase recording with stock auto-increment |
| Purchase Orders | PO creation and management |
| Delivery Challans | Delivery challan with e-way bill |
| Returnable Challans | Track issued and returned goods |
| GST Reports | GSTR-1 style sales/purchase registers |
| Reports | Sales, purchase, stock, low-stock, ledger reports |
| Staff Management | Multi-user with role assignment |
| Roles & Permissions | Granular permission matrix per module/action |
| Settings | Business profile, bank details, document prefixes |
| PDF Export | Invoice PDF with jsPDF + jspdf-autotable |
| Excel Export | Report export with xlsx |

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict)
- **Database**: MySQL 8 (via XAMPP)
- **DB Driver**: mysql2 (raw parameterized queries — no ORM)
- **Auth**: NextAuth.js v4 (JWT strategy)
- **UI**: Tailwind CSS + shadcn/ui
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **State**: Zustand
- **PDF**: jsPDF + jspdf-autotable
- **Excel**: xlsx

---

## Setup via XAMPP (Local)

### Prerequisites

- [Node.js 18+](https://nodejs.org/) — download and install
- [XAMPP](https://www.apachefriends.org/) — download and install (includes MySQL + phpMyAdmin)

---

### Step 1 — Start XAMPP

1. Open **XAMPP Control Panel** (search for it in Start Menu / Applications)
2. Click **Start** next to **Apache** *(required for phpMyAdmin)*
3. Click **Start** next to **MySQL**
4. Both rows should turn **green** — MySQL runs on port **3306**

![XAMPP both green](https://www.apachefriends.org/images/xampp-controls.png)

---

### Step 2 — Create the Database in phpMyAdmin

1. Open your browser and go to **[http://localhost/phpmyadmin](http://localhost/phpmyadmin)**
2. In the left sidebar, click **New**
3. In the **Database name** field, type exactly: `viros_web_new`
4. Set collation to: `utf8mb4_unicode_ci`
5. Click **Create**

You should now see `viros_web_new` appear in the left sidebar.

---

### Step 3 — Import the Schema (Tables + Seed Data)

1. In phpMyAdmin, click on **`viros_web_new`** in the left sidebar
2. Click the **Import** tab in the top menu bar
3. Click **Choose File**
4. Navigate to your project folder and select **`schema.sql`**
5. Scroll down and click **Go**
6. Wait for the success message: *"Import has been successfully finished"*

This imports all tables **and** creates the default admin login.

> **Alternative (terminal method):**
> Open Terminal and run:
> ```bash
> cd /path/to/VIros-GST-Billing
> mysql -u root viros_web_new < schema.sql
> ```

---

### Step 4 — Check the `.env` File

The `.env` file in the project root is already configured for XAMPP defaults:

```env
# XAMPP MySQL — no password, port 3306
DATABASE_URL="mysql://root:@127.0.0.1:3306/viros_web_new"

NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="liP+nuT4r3f5KzDax3i+CRt8UoibIbB3diCevUdVZkk="

APP_NAME="Viros GST Billing"
APP_URL="http://localhost:3000"
```

> **No changes needed** if you are using the default XAMPP setup (no MySQL root password).
> If you set a MySQL root password in XAMPP, change the URL to:
> `mysql://root:YOUR_PASSWORD@127.0.0.1:3306/viros_web_new`

---

### Step 5 — Install Node.js Dependencies

Open Terminal, navigate to the project folder, and run:

```bash
cd /path/to/VIros-GST-Billing
npm install
```

---

### Step 6 — Start the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Step 7 — Log In

| Field    | Value       |
|----------|-------------|
| Username | `virosgst`  |
| Password | `Viros@123` |

> Change this password after first login via **Staff** page.

---

### Quick Reference Checklist

- [ ] XAMPP — Apache started
- [ ] XAMPP — MySQL started (port 3306)
- [ ] Database `viros_web_new` created in phpMyAdmin
- [ ] `schema.sql` imported (tables + admin user)
- [ ] `.env` file has correct `DATABASE_URL`
- [ ] `npm install` completed
- [ ] `npm run dev` running
- [ ] Logged in at http://localhost:3000

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server (port 3000) |
| `npm run build` | Build for production |
| `npm start` | Start production server |

---

## Project Structure

```
├── app/
│   ├── (auth)/login/         # Login page
│   ├── (dashboard)/          # Protected routes
│   │   ├── dashboard/        # Stats & charts
│   │   ├── inventory/        # Products & stock
│   │   ├── customers/        # Customer CRUD
│   │   ├── vendors/          # Vendor CRUD
│   │   ├── billing/          # Invoices
│   │   ├── quotations/       # Quotations
│   │   ├── purchases/        # Purchases
│   │   ├── purchase-orders/  # Purchase Orders
│   │   ├── delivery-challans/
│   │   ├── returnable-challans/
│   │   ├── reports/          # GST & business reports
│   │   ├── staff/            # User management
│   │   ├── roles/            # Permission matrix
│   │   └── settings/         # Business settings
│   └── api/                  # REST API routes
├── lib/
│   ├── db.ts                 # MySQL2 connection pool
│   ├── auth.ts               # NextAuth config (raw SQL)
│   ├── validations.ts        # Zod schemas
│   ├── api-auth.ts           # Permission guard helper
│   ├── utils.ts              # GST calculations, helpers
│   ├── pdf-export.ts         # PDF generation
│   └── excel-export.ts       # Excel export
├── schema.sql                # Full MySQL schema + seed data
└── .env                      # Environment variables
```

---

## GST Modes Supported

| Mode | Use Case |
|------|----------|
| **CGST + SGST** | Intra-state transactions |
| **IGST** | Inter-state transactions |
| **Exempt** | Zero-rated / exempt goods |

---

## Default Admin Credentials (from schema.sql)

| Field    | Value               |
|----------|---------------------|
| Username | `virosgst`          |
| Password | `Viros@123`         |
| Role     | Super Admin         |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Connection refused` on port 3306 | Start MySQL in XAMPP Control Panel |
| `Unknown database 'viros_web_new'` | Create DB in phpMyAdmin (Step 2) |
| `Table doesn't exist` | Import `schema.sql` (Step 3) |
| Login fails with correct credentials | Make sure `schema.sql` was imported (admin user seed included) |
| Port 3000 already in use | Run `npm run dev -- -p 3001` and update `NEXTAUTH_URL` |

---

## License

MIT

