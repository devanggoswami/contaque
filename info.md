# 🚀 Lead OS — Architecture, Tech Stack & System Documentation

Lead OS is an end-to-end, high-performance **B2B Lead Intelligence, Automated Web Scraping, Multi-Account Cold Email Outreach, and 2-Way Inbox Management Platform**.

---

## 🏗️ 1. High-Level System Architecture

```
                               ┌─────────────────────────────────────────┐
                               │       Client Browser / Mobile UI        │
                               │   (React 19 + Vite + CSS Responsive)    │
                               └──────────────────┬──────────────────────┘
                                                  │ HTTP / REST API (JSON)
                                                  ▼
                               ┌─────────────────────────────────────────┐
                               │         Node.js Express Backend         │
                               │               (Port 5001)               │
                               └──────┬───────────┬───────────┬──────────┘
                                      │           │           │
         ┌────────────────────────────┘           │           └───────────────────────────┐
         ▼                                        ▼                                       ▼
┌──────────────────┐                    ┌──────────────────┐                    ┌──────────────────┐
│  Scraper Engine  │                    │ Queue Mail Engine│                    │ IMAP Sync Engine │
│  - Multi-Search  │                    │ - Gmail Rotation │                    │ - 2-Way Inbox    │
│  - Global Cities │                    │ - SMTP Dispatch  │                    │ - Mailparser     │
│  - Email Enrich  │                    │ - Rate Pacing    │                    │ - Reply Composer │
└────────┬─────────┘                    └────────┬─────────┘                    └────────┬─────────┘
         │                                       │                                       │
         └───────────────────────────────────────┼───────────────────────────────────────┘
                                                 ▼
                               ┌─────────────────────────────────────────┐
                               │           PostgreSQL Database           │
                               │  (Jobs, Leads, Campaigns, Queue, Inbox) │
                               └─────────────────────────────────────────┘
```

---

## 💻 2. Tech Stack & Languages Used

### **Frontend (Client Application)**
| Layer / Tool | Technology | Purpose |
|---|---|---|
| **Language** | JavaScript (ES6+ / JSX) | Component logic & data manipulation |
| **Framework** | **React 19** (`react`, `react-dom`) | Modern UI components & state management |
| **Build Tool** | **Vite 8** (`vite`, `@vitejs/plugin-react`) | Lightning-fast development & production bundling |
| **Routing** | **React Router v7** (`react-router-dom`) | Client-side page navigation & layout routing |
| **Styling** | **Custom CSS3** (Vanilla with CSS Tokens) | Warm Beige modern design, 100% mobile-responsive |
| **Icons** | **Lucide React** (`lucide-react`) | Clean, modern vector UI icons |
| **Exporting** | `jspdf`, `jspdf-autotable`, `xlsx` | Export leads to PDF & Excel (.xlsx / .csv) |

### **Backend (REST API & Background Engines)**
| Layer / Tool | Technology | Purpose |
|---|---|---|
| **Language & Runtime** | **Node.js** (CommonJS) | Server runtime & background workers |
| **Server Framework** | **Express 5** (`express`) | High-speed REST API routing & middleware |
| **Database Client** | **node-postgres** (`pg`) | Connection pooling & PostgreSQL SQL execution |
| **Web Scraping** | **Axios** (`axios`) & **Cheerio** (`cheerio`)| Search query scraping, HTML parsing, DOM traversal |
| **Email Extraction** | `email-regex`, `email-extractor` | Deep regex email extraction from snippets & websites |
| **SMTP Delivery** | **Nodemailer** (`nodemailer`) | Multi-account Gmail SMTP connection & email dispatch |
| **IMAP Email Sync** | **ImapFlow** (`imapflow`) & **Mailparser** (`mailparser`) | 2-way incoming email synchronization & RFC 822 parsing |
| **File Uploads** | **Multer** (`multer`) | Email attachment & image upload handling |
| **Environment** | **dotenv** (`dotenv`) | Secure environment variables management |

### **Database Engine**
| Layer / Tool | Technology | Purpose |
|---|---|---|
| **Database** | **PostgreSQL 14+** | Relational data store with foreign keys, indexes, and unique constraints |

---

## 🗄️ 3. Database Schema & Tables

The database consists of **7 core relational tables**:

```
 ┌─────────────┐        1:N         ┌─────────────┐
 │    jobs     │ ────────────────── │    leads    │
 └─────────────┘                    └─────────────┘
                                           │ 1:N
 ┌──────────────────┐               ┌─────────────┐
 │  email_accounts  │               │ email_queue │
 └────────┬─────────┘               └──────┬──────┘
          │ 1:N                            │ N:1
 ┌────────┴─────────┐        1:N    ┌──────┴──────┐
 │  inbox_threads   │ ───────────── │  campaigns  │
 └────────┬─────────┘               └─────────────┘
          │ 1:N
 ┌────────┴─────────┐
 │  inbox_messages  │
 └──────────────────┘
```

### **1. `jobs`** (Scraping Task Registry)
Tracks lead scraping jobs, parameters, target lead counts, and completion status.
- `id` (SERIAL PRIMARY KEY)
- `source` (VARCHAR: `maps`, `dorking`, `yellowpages`, `yandex`)
- `location` (VARCHAR: Target city or country)
- `keyword` (VARCHAR: Business niche / target keyword)
- `target_count` (INTEGER: Number of requested leads)
- `fetched_count` (INTEGER: Total leads scraped so far)
- `status` (VARCHAR: `IN_PROGRESS`, `COMPLETED`, `FAILED`)
- `created_at` (TIMESTAMP)

### **2. `leads`** (Scraped Business Records)
Stores scraped business records, phone numbers, websites, categories, and emails.
- `id` (SERIAL PRIMARY KEY)
- `job_id` (INTEGER REFERENCES `jobs(id)` ON DELETE CASCADE)
- `place_id` (VARCHAR: Unique hash for global deduplication)
- `name` (VARCHAR: Business or contact name)
- `address` (TEXT: Physical address / location snippet)
- `phone` (VARCHAR: Contact phone number)
- `website` (TEXT: Company website URL)
- `category` (VARCHAR: Industry or keyword)
- `source_link` (TEXT: Direct URL to the source profile/result)
- `emails` (TEXT: Extracted / verified email address)
- `created_at` (TIMESTAMP)
- **Constraint**: `UNIQUE (job_id, place_id)`

### **3. `email_accounts`** (SMTP Sending Accounts)
Stores Gmail / Google Workspace accounts with 16-digit App Passwords for rotated cold outreach.
- `id` (SERIAL PRIMARY KEY)
- `email` (VARCHAR UNIQUE: Sending email address)
- `app_password` (VARCHAR: Gmail 16-digit App Password)
- `daily_sent_count` (INTEGER: Daily emails sent count, resets daily)
- `last_reset_date` (DATE: Daily tracker to auto-reset count at midnight)
- `status` (VARCHAR: `ACTIVE`, `PAUSED`, `ERROR`)
- `created_at` (TIMESTAMP)

### **4. `campaigns`** (Outreach Campaigns)
Stores cold email campaign definitions, templates, targets, and statistics.
- `id` (SERIAL PRIMARY KEY)
- `name` (VARCHAR: Campaign title)
- `subject` (VARCHAR: Email subject line)
- `body_html` (TEXT: HTML email body with formatting)
- `target_job_id` (VARCHAR / INTEGER: Associated Job ID(s) or `NULL` for All)
- `is_manual` (BOOLEAN: True if created from manual email upload)
- `manual_emails` (TEXT: Comma-separated email list if manual)
- `attachment_path` (TEXT: Server file path for PDF/doc attachments)
- `image_link` (TEXT: Clickable CTA destination URL for email banners)
- `status` (VARCHAR: `DRAFT`, `RUNNING`, `PAUSED`, `COMPLETED`)
- `total_leads` (INTEGER: Total queue size)
- `sent_count` (INTEGER: Successfully dispatched emails)
- `failed_count` (INTEGER: Failed dispatch attempts)
- `created_at` (TIMESTAMP)

### **5. `email_queue`** (Individual Email Dispatch Queue)
Queue items representing each email to be sent to a specific lead.
- `id` (SERIAL PRIMARY KEY)
- `campaign_id` (INTEGER REFERENCES `campaigns(id)` ON DELETE CASCADE)
- `lead_id` (INTEGER REFERENCES `leads(id)` ON DELETE CASCADE, nullable for manual)
- `target_email` (VARCHAR: Recipient email address)
- `status` (VARCHAR: `PENDING`, `SENT`, `FAILED`)
- `error_msg` (TEXT: Delivery error reason if failed)
- `sent_at` (TIMESTAMP: Exact delivery time)
- `created_at` (TIMESTAMP)
- **Constraint**: `UNIQUE (campaign_id, lead_id)`

### **6. `inbox_threads`** (2-Way Email Conversations)
Groups conversation threads between sending accounts and leads.
- `id` (SERIAL PRIMARY KEY)
- `account_id` (INTEGER REFERENCES `email_accounts(id)` ON DELETE CASCADE)
- `lead_email` (VARCHAR: Lead's email address)
- `lead_name` (VARCHAR: Lead's name)
- `last_message_date` (TIMESTAMP)
- `is_unread` (BOOLEAN: Unread badge indicator)
- `created_at` (TIMESTAMP)
- **Constraint**: `UNIQUE (account_id, lead_email)`

### **7. `inbox_messages`** (Thread Messages)
Stores individual inbound replies and outbound replies within an inbox thread.
- `id` (SERIAL PRIMARY KEY)
- `thread_id` (INTEGER REFERENCES `inbox_threads(id)` ON DELETE CASCADE)
- `message_id` (VARCHAR UNIQUE: RFC 822 Email Message-ID)
- `direction` (VARCHAR: `INBOUND` or `OUTBOUND`)
- `sender_email`, `sender_name`, `recipient_email` (VARCHAR)
- `subject` (TEXT), `body_text` (TEXT), `body_html` (TEXT)
- `date` (TIMESTAMP), `is_read` (BOOLEAN)
- `created_at` (TIMESTAMP)

---

## ⚙️ 4. Core Engines & How They Work

### **A. Deep Scraping & Deduplication Engine (`server/index.js`)**
1. **Global City & Neighborhood Auto-Expansion (`server/utils/cities.js`)**:
   - Contains a complete geographic database covering **193+ countries** and **26+ metropolitan cities** (London, New York, Paris, Tokyo, Mumbai, Delhi, Sydney, etc.).
   - When a user scrapes a country (e.g. "Spain"), it automatically expands the search into 10+ sub-cities (Madrid, Barcelona, Valencia, Seville, etc.).
   - When scraping a major city (e.g. "London"), it auto-expands into borough sub-districts (Soho, Camden, Westminster, Kensington, Greenwich, etc.).
2. **Multi-Page Pagination**:
   - Loops up to 25 pages per location using search engine offset stepping (`startOffset += 10`).
3. **Global Historical Deduplication**:
   - Every scraped record checks against all previously scraped leads across all jobs (`WHERE NOT EXISTS (SELECT 1 FROM leads WHERE place_id = $2 OR source_link = $8)`).
   - If duplicates exist on a page, the engine **does not stop** — it skips the duplicates and advances to the next page / sub-district until the target lead count is fulfilled.
4. **Background Email Enrichment**:
   - Extracts emails from meta snippets immediately.
   - If no email is in the snippet, triggers a background fetch to the business website's contact / about pages to extract valid contact emails.

### **B. Smart Campaign Mail Queue Engine (`server/routes/campaigns.js`)**
1. **Multi-Account Gmail SMTP Rotation**:
   - Rotates through all registered `email_accounts`.
   - Respects a safe limit of **400 emails/account/day** (well below Google's 500 hard limit) to prevent account flags or spam classification.
2. **Auto-Pacing & Rate Limiting**:
   - Dispatches emails with randomized human-like delays (15s–45s) between sends.
3. **Play / Pause / Delete Controls**:
   - Allows users to pause active campaigns, resume them anytime, or delete queued jobs with a single click.

### **C. IMAP 2-Way Inbox Sync Engine (`server/routes/inbox.js`)**
1. **Real-time IMAP Polling**:
   - Connects securely via TLS to Gmail IMAP servers using the registered App Passwords.
   - Automatically detects lead replies to cold campaigns.
2. **Thread Matching**:
   - Matches incoming messages against the `inbox_threads` table and maps them to the correct lead.
3. **Direct Reply Composer**:
   - Allows users to reply directly from the Lead OS web interface using the same sender account.

---

## 🌐 5. REST API Endpoints Reference

| Category | Method | Endpoint | Description |
|---|---|---|---|
| **Jobs** | `POST` | `/api/jobs` | Create and trigger a new scraping job |
| **Jobs** | `GET` | `/api/jobs` | Get all jobs with live progress & status |
| **Jobs** | `DELETE`| `/api/jobs/:id` | Delete a scraping job and its associated leads |
| **Leads**| `GET` | `/api/leads` | Get leads with pagination, search, & category filter |
| **Leads**| `POST` | `/api/leads/by-jobs` | Fetch and filter leads across selected jobs by data type |
| **Leads**| `DELETE`| `/api/leads/:id` | Delete a single lead |
| **Leads**| `POST` | `/api/leads/delete-batch` | Bulk delete selected leads |
| **Leads**| `POST` | `/api/leads/export` | Export filtered leads to CSV / Excel |
| **Campaigns** | `GET` | `/api/campaigns/list` | List all campaigns with real-time delivery stats |
| **Campaigns** | `POST`| `/api/campaigns/create` | Create a new campaign and populate email queue |
| **Campaigns** | `POST`| `/api/campaigns/:id/status` | Start / Pause / Resume a campaign |
| **Campaigns** | `DELETE`| `/api/campaigns/:id` | Delete a campaign and its queued emails |
| **Accounts** | `GET` | `/api/campaigns/accounts` | List configured Gmail SMTP accounts |
| **Accounts** | `POST`| `/api/campaigns/accounts` | Add a new Gmail account with 16-digit App Password |
| **Accounts** | `DELETE`| `/api/campaigns/accounts/:id` | Remove a sending account |
| **Inbox** | `GET` | `/api/inbox/threads` | List email conversation threads |
| **Inbox** | `GET` | `/api/inbox/threads/:id`| Get full message history for a conversation |
| **Inbox** | `POST`| `/api/inbox/sync` | Trigger manual IMAP email synchronization |
| **Inbox** | `POST`| `/api/inbox/reply` | Send a direct outbound reply to a lead |
| **Telemetry** | `GET`| `/api/telemetry/stats` | Dashboard aggregated analytics & usage metrics |

---

## 🚀 6. Server Deployment Guide (Ubuntu / Linux / VPS)

### **Prerequisites on Server**
- Node.js 18.x or 20.x (`sudo apt install nodejs npm`)
- PostgreSQL 14+ (`sudo apt install postgresql postgresql-contrib`)
- PM2 Process Manager (`npm install -g pm2`)
- Nginx Reverse Proxy (`sudo apt install nginx`)

### **Step 1: Database Setup**
```bash
sudo -u postgres psql
CREATE DATABASE lead_os;
CREATE USER leaduser WITH ENCRYPTED PASSWORD 'your_strong_password';
GRANT ALL PRIVILEGES ON DATABASE lead_os TO leaduser;
\q
```

### **Step 2: Environment Configuration (`.env`)**
In `server/.env`:
```env
PORT=5001
DATABASE_URL=postgresql://leaduser:your_strong_password@localhost:5432/lead_os
NODE_ENV=production
```

In root `.env` (Frontend):
```env
VITE_API_URL=https://yourdomain.com/api
```

### **Step 3: Initialize Database Schema**
```bash
cd server
npm install
node alter_db_campaigns.js
node setup_inbox_db.js
```

### **Step 4: Build Frontend & Start Backend**
```bash
# Build frontend
cd ..
npm install
npm run build

# Start backend with PM2
cd server
pm2 start index.js --name "lead-os-backend"
pm2 save
pm2 startup
```

### **Step 5: Nginx Configuration**
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Serve Frontend static build
    location / {
        root /var/www/lead_os/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Proxy REST API requests to Backend
    location /api/ {
        proxy_pass http://localhost:5001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 📱 7. UI / UX & Mobile Features
- **Adaptive Drawer Layout**: Collapsible off-canvas drawer on mobile (`<= 768px`) and fixed sidebar on desktop.
- **Master-Detail Inbox**: Compact thread list with one-tap deep navigation and back button for smartphone screens.
- **Real-Time Job Radar**: Animated HUD radar showing live scraping counts and system status.
- **One-Click Exports**: Instant export to CSV, XLSX, and PDF formatted tables.
