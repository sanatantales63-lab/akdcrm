# AKD Interior (All Kind Decor) — Private Business Management CRM

A private, owner-only business management application custom-built for **AKD All Kind Decor (AKD Interior)** ([https://www.akdinterior.in/](https://www.akdinterior.in/)).

Designed with a quiet, architectural, white-first visual system (`#FFFFFF` surfaces, `#F7F7F5` canvas, `#242424` charcoal typography, `#E8E6E1` hairline borders, and champagne gold accents derived from the official AKD Interior logo).

---

## 1. Core Modules (8 Primary Navigation Sections)

1. **Dashboard (`/`)**:
   - Executive KPI summary cards: Total Clients, Active Projects, Total Project Value, Confirmed Payments Received, Outstanding Payments, and Total Recorded Expenses.
   - Date-scoped analytics (`Last 30 Days`, `Last 90 Days`, `Current Financial Year`, `All Time`, `Custom Date Range`).
   - Monthly Payments Received vs. Monthly Expenses chart, Project Status distribution, Projects Needing Attention / Deadlines, Outstanding Receivable Alerts, Recent Clients, and Chronological Studio Activity Log.
   - Clean first-run onboarding state when the database is empty.
2. **Clients (`/clients` & `/clients/:clientId`)**:
   - Full client directory with search, status/type filters, sorting, and pagination.
   - Real-time duplicate warning when phone numbers or email addresses match existing client records (never auto-merges).
   - Detailed Client Profile view displaying contact info, project history, associated enquiries, total project value, confirmed payments received, outstanding balance, payment history with one-click Receipt PDF downloads, and chronological client notes.
3. **Projects (`/projects` & `/projects/:projectId`)**:
   - Dedicated interior & turnkey project management module.
   - Tracks Project ID, Name, Associated Client, Category, Location, Site Address, Scope Description, Total Project Value, Start/Expected/Actual Completion Dates, Status, Progress Percentage (`0–100%`), Payment Terms, and Internal Notes.
   - Highlights overdue and approaching completion deadlines.
   - Decimal-safe financial formula: `Total Project Value - Confirmed Payments Received = Outstanding Project Balance` (with project expenses tracked separately).
4. **Enquiries (`/enquiries`)**:
   - Prospective lead tracking before conversion.
   - Search, filter by status/project type/overdue follow-ups, sort by follow-up date, and log timestamped follow-up notes.
   - **Convert to Client (& Project)** workflow: Checks for existing matching clients to prevent duplication, creates or links the client record, and optionally initializes an associated project in one atomic step.
5. **Payments (`/payments`)**:
   - Financial ledger for advances, instalments, milestone payments, and final settlements.
   - Enforces strict project-client consistency and decimal-safe paise arithmetic.
   - Generates **Official Payment Receipt PDFs** (explicitly labeled as a *Payment Receipt*, never a tax invoice, with zero fabricated GST/tax numbers).
6. **Expenses (`/expenses`)**:
   - Tracks business and site expenditure across customizable categories (`Materials`, `Labour`, `Contractor`, `Transportation`, `Site Expenses`, etc.).
   - Displays total expenses, current month expenditure, project-specific expenses, and category-wise breakdown.
7. **Reports & Analytics (`/reports`)**:
   - Multi-dimensional filters: Date range, Client, Project, Project Status, and Expense Category.
   - Financial Reports: Total Project Value, Confirmed Payments Received, Outstanding Receivables, Total Recorded Expenses, Net Recorded Cash Flow (`Confirmed Payments Received minus Recorded Expenses`), Monthly Cash Flow table, and Project-wise Financial Summary.
   - Operational Reports: Active/Completed/On-Hold/Overdue projects, Enquiry Conversion Rate, and Upcoming Deadlines.
8. **Settings (`/settings`)**:
   - **Business Profile**: Studio Name, Authorized Signatory, Official Logo, Phone, Email, Address, Website, Currency (`INR`).
   - **Preferences**: Date format (`dd MMM yyyy`, `dd/MM/yyyy`, `yyyy-MM-dd`), Financial Year start month, customizable Project Categories, and Expense Categories.
   - **Owner Account**: Update owner name/password and sign out.
   - **Data Management**: Full Studio Workbook export (`.xlsx`), JSON backup export (`.json`), and optional development demo-seed / reset utilities.

---

## 2. Technical Stack

- **Frontend**: Vite, React 18, TypeScript, Tailwind CSS, Lucide React, Recharts, React Hook Form, Zod, React Router v6
- **Backend & Security**: Supabase Authentication, Supabase PostgreSQL, Row Level Security (RLS), plus a local PostgreSQL-mirror vault fallback for immediate offline/local operation
- **PDF Generation**: `jsPDF` + `jspdf-autotable`
- **Excel Generation**: `SheetJS (xlsx)`

---

## 3. Setup & Installation

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in your Supabase project credentials in `.env`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-public-key
VITE_OWNER_EMAIL=owner@akdstudio.com
```

> **Security Note**: Never expose your Supabase `service_role` secret key in `.env` or frontend code.

### Step 3: Apply Database Migrations & Row Level Security (RLS)

1. Open your Supabase Dashboard → **SQL Editor**.
2. Copy and execute the contents of [`supabase/migrations/001_initial_schema.sql`](./supabase/migrations/001_initial_schema.sql).
3. Provision your single Owner user in **Supabase Dashboard → Authentication → Users → Add User** (e.g. `owner@akdstudio.com`), and disable public sign-ups under **Authentication → Providers → Email**.
4. Insert your owner user's UUID into `public.profiles`:
   ```sql
   INSERT INTO public.profiles (id, email, full_name, role, is_active)
   VALUES ('YOUR-AUTH-USER-UUID', 'owner@akdstudio.com', 'AKD Studio Principal', 'owner', true);
   ```

> **Local First-Run Mode**: If you run `npm run dev` before connecting `.env` to a remote Supabase project, the application automatically boots into its encrypted local vault mode and presents the **First-Run Owner Account Provisioning** screen on `/login`. Once provisioned, public registration is permanently locked and all records persist across browser refreshes.

### Step 4: Start the Development Server

```bash
npm run dev
```

### Step 5: Production Build

```bash
npm run build
npm run preview
```

---

## 4. Deployment Instructions

1. Build the static production bundle with `npm run build` (outputs to `dist/`).
2. Deploy to **Vercel**, **Netlify**, or **Cloudflare Pages**:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Environment Variables**: Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_OWNER_EMAIL`.
   - Ensure SPA fallback routing (`/* -> /index.html`) is enabled so direct navigation to `/clients`, `/projects`, etc. resolves cleanly.
