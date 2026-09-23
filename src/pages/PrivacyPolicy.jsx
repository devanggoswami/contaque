import React, { useEffect } from 'react';
import LegalLayout from '../components/LegalLayout';
import { 
  ShieldCheck, Lock, Eye, Database, Server, CreditCard, 
  Share2, UserCheck, HardDrive, Cookie, RefreshCw, Mail, MapPin 
} from 'lucide-react';

export default function PrivacyPolicy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <LegalLayout
      badge="DATA PROTECTION & PRIVACY"
      title="Privacy Policy"
      lastUpdated="September 23, 2026"
      activeDoc="privacy"
    >
      {/* Table of Contents */}
      <div className="legal-toc-box">
        <div className="legal-toc-title">
          <ShieldCheck size={16} />
          <span>Privacy Policy Overview</span>
        </div>
        <div className="legal-toc-grid">
          <a href="#privacy-1" className="legal-toc-link">
            <span className="legal-toc-number">01.</span>
            <span>Introduction & Scope</span>
          </a>
          <a href="#privacy-2" className="legal-toc-link">
            <span className="legal-toc-number">02.</span>
            <span>Information We Collect</span>
          </a>
          <a href="#privacy-3" className="legal-toc-link">
            <span className="legal-toc-number">03.</span>
            <span>Why We Collect Your Data</span>
          </a>
          <a href="#privacy-4" className="legal-toc-link">
            <span className="legal-toc-number">04.</span>
            <span>Payment Processing (Razorpay)</span>
          </a>
          <a href="#privacy-5" className="legal-toc-link">
            <span className="legal-toc-number">05.</span>
            <span>Google OAuth & Authentication</span>
          </a>
          <a href="#privacy-6" className="legal-toc-link">
            <span className="legal-toc-number">06.</span>
            <span>Internal Operational Systems & Sheets Sync</span>
          </a>
          <a href="#privacy-7" className="legal-toc-link">
            <span className="legal-toc-number">07.</span>
            <span>Data Security Safeguards</span>
          </a>
          <a href="#privacy-8" className="legal-toc-link">
            <span className="legal-toc-number">08.</span>
            <span>Data Retention Standards</span>
          </a>
          <a href="#privacy-9" className="legal-toc-link">
            <span className="legal-toc-number">09.</span>
            <span>Third-Party Service Providers</span>
          </a>
          <a href="#privacy-10" className="legal-toc-link">
            <span className="legal-toc-number">10.</span>
            <span>User Rights & Account Control</span>
          </a>
          <a href="#privacy-11" className="legal-toc-link">
            <span className="legal-toc-number">11.</span>
            <span>Cookies & Local Storage</span>
          </a>
          <a href="#privacy-12" className="legal-toc-link">
            <span className="legal-toc-number">12.</span>
            <span>Policy Updates & Contact</span>
          </a>
        </div>
      </div>

      {/* Section 1 */}
      <section id="privacy-1" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">01</div>
          <h2 className="legal-section-title">Introduction &amp; Scope</h2>
        </div>
        <p className="legal-text">
          At <strong>Contaque</strong> (operated by <strong>Klyrova Inc.</strong>, &quot;Company&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), we take your privacy and data security seriously. This Privacy Policy details the precise types of personal and operational data we collect when you use our website, web application, APIs, and cloud services, how that data is processed and safeguarded, and your rights concerning your personal information.
        </p>
        <p className="legal-text">
          We do not sell personal data to advertisers or third-party data brokers. All data handling is conducted in accordance with the Information Technology Act, 2000 of India, the Digital Personal Data Protection (DPDP) principles, and internationally recognized information security practices.
        </p>
      </section>

      {/* Section 2 */}
      <section id="privacy-2" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">02</div>
          <h2 className="legal-section-title">Information We Collect</h2>
        </div>
        <p className="legal-text">
          We collect only the information necessary to provide, secure, and bill for our lead intelligence and outreach services. We do not collect or claim to collect data that our application does not actually utilize:
        </p>
        <ul className="legal-list">
          <li>
            <strong>Account &amp; Registration Information:</strong> Your full name, work email address, country of residence, and an encrypted password hash (salted using bcrypt; plain text passwords are never stored or visible to us).
          </li>
          <li>
            <strong>Google OAuth Profile Data:</strong> If you choose to authenticate via Google Sign-In, we receive your verified Google email address, name, and unique Google account identifier through the Google Identity Services token.
          </li>
          <li>
            <strong>Billing &amp; Payment Records:</strong> Transaction records including Razorpay order IDs, payment IDs, transaction timestamps, payment purpose (plan upgrade or wallet top-up), payment amounts in paise/INR, and customer billing details (name, email, phone, address, and GST number if provided during checkout).
          </li>
          <li>
            <strong>Platform Usage &amp; Operational Data:</strong> Search queries submitted (keywords, target locations, engine selections), lead extraction job histories, saved lead records, campaign message templates, outbound email queue records, and SMTP/IMAP account credentials configured by Value Plus users for automated outreach.
          </li>
          <li>
            <strong>Technical &amp; Session Data:</strong> IP addresses, browser user-agent strings, timestamps, and JSON Web Tokens (JWT) stored in your browser&apos;s local storage to maintain authenticated sessions.
          </li>
        </ul>
      </section>

      {/* Section 3 */}
      <section id="privacy-3" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">03</div>
          <h2 className="legal-section-title">Why We Collect Your Data</h2>
        </div>
        <p className="legal-text">
          We process collected information strictly for legitimate business and operational purposes:
        </p>
        <ul className="legal-list">
          <li><strong>Account Management:</strong> Provisioning your workspace, authenticating your logins, and managing role-based access.</li>
          <li><strong>Service Delivery:</strong> Executing parallel scraping jobs across public business indexes, formatting exported files (CSV/Excel/PDF), and running automated email campaigns.</li>
          <li><strong>Billing &amp; Wallet Reconciliation:</strong> Verifying Razorpay payment signatures, updating wallet balances, and computing per-lead rate deductions accurately.</li>
          <li><strong>Operational Sync:</strong> Syncing new user registrations with internal operational spreadsheets (via Google Sheets webhooks) for account management and onboarding.</li>
          <li><strong>Customer Support:</strong> Diagnosing job errors, investigating payment discrepancies, and responding to direct inquiries.</li>
          <li><strong>Security &amp; Fraud Prevention:</strong> Detecting unauthorized login attempts, preventing automated rate-limit abuse, and safeguarding database infrastructure.</li>
        </ul>
      </section>

      {/* Section 4 */}
      <section id="privacy-4" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">04</div>
          <h2 className="legal-section-title">Payment Processing Through Razorpay</h2>
        </div>
        <p className="legal-text">
          All financial transactions for Contaque subscriptions and prepaid wallet top-ups are routed securely through <strong>Razorpay</strong>, an authorized, PCI-DSS Level 1 certified payment gateway operating under Reserve Bank of India (RBI) regulations.
        </p>
        <div className="legal-callout success">
          <CreditCard size={20} className="callout-icon" />
          <div className="callout-content">
            <strong>Zero Raw Card Storage Guarantee</strong>
            Contaque does NOT collect, capture, store, or process raw credit card numbers, debit card numbers, CVVs, card expiry dates, UPI PINs, or net banking passwords on our servers. All sensitive financial inputs are handled exclusively by Razorpay within their encrypted checkout modal.
          </div>
        </div>
        <p className="legal-text">
          We receive only tokenized payment confirmations, payment IDs, and transaction status logs necessary to activate your requested subscription plan or credit funds to your wallet balance.
        </p>
      </section>

      {/* Section 5 */}
      <section id="privacy-5" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">05</div>
          <h2 className="legal-section-title">Google OAuth &amp; Authentication</h2>
        </div>
        <p className="legal-text">
          Contaque supports one-click authentication via Google Identity Services (GIS). When you sign up or log in using Google:
        </p>
        <ul className="legal-list">
          <li>We request only basic public profile information: your name, verified email address, and unique Google ID token.</li>
          <li>We do NOT request access to your private Google Drive files, personal Gmail inbox, or Google Contacts.</li>
          <li>Google OAuth data is used solely to authenticate your identity and provision your user account. We never share, transfer, or sell your Google authentication data to third-party ad networks.</li>
        </ul>
      </section>

      {/* Section 6 */}
      <section id="privacy-6" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">06</div>
          <h2 className="legal-section-title">Internal Operational Systems &amp; Sheets Sync</h2>
        </div>
        <p className="legal-text">
          To manage customer onboarding, enterprise support, and operational accounting, user registration details (name, email, country, signup timestamp, and plan status) may be synchronized via secure server-side webhooks to internal operational management tools, including private Google Sheets documents maintained exclusively by authorized Klyrova Inc. administrators.
        </p>
        <p className="legal-text">
          These internal operational logs are protected by two-factor authentication, encrypted in transit, and accessed strictly by internal personnel with a legitimate business need to know.
        </p>
      </section>

      {/* Section 7 */}
      <section id="privacy-7" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">07</div>
          <h2 className="legal-section-title">Data Security Safeguards</h2>
        </div>
        <p className="legal-text">
          We implement multi-layered administrative, technical, and physical security measures to protect your personal and business data against unauthorized access, loss, alteration, or disclosure:
        </p>
        <ul className="legal-list">
          <li><strong>Encryption in Transit:</strong> All communications between your browser and our servers are encrypted using modern Transport Layer Security (TLS 1.2 / TLS 1.3 / HTTPS).</li>
          <li><strong>Password Security:</strong> Passwords are cryptographically salted and hashed using bcrypt before database insertion.</li>
          <li><strong>Database Protections:</strong> Production PostgreSQL databases are hosted in isolated private subnets with strict firewall rules and parameterized SQL queries to prevent injection attacks.</li>
          <li><strong>Session Token Security:</strong> Authentication is governed by signed JSON Web Tokens (JWT) with strict expiration periods and server-side verification.</li>
        </ul>
      </section>

      {/* Section 8 */}
      <section id="privacy-8" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">08</div>
          <h2 className="legal-section-title">Data Retention Standards</h2>
        </div>
        <p className="legal-text">
          We retain your account details and extracted lead datasets for as long as your account remains active. If you request account closure, we will delete or anonymize your personal identifiers within thirty (30) days of your confirmed request, except where retention is required by applicable law (such as Indian tax, accounting, or statutory audit requirements for transaction receipts).
        </p>
      </section>

      {/* Section 9 */}
      <section id="privacy-9" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">09</div>
          <h2 className="legal-section-title">Third-Party Service Providers</h2>
        </div>
        <p className="legal-text">
          We share data with third parties only to the extent strictly necessary to operate our service:
        </p>
        <ul className="legal-list">
          <li><strong>Razorpay:</strong> Payment processing and subscription billing under PCI-DSS compliance.</li>
          <li><strong>Cloud Infrastructure Providers:</strong> Secure cloud servers, compute instances, and database hosting.</li>
          <li><strong>Google:</strong> OAuth 2.0 authentication verification and internal operational spreadsheet webhooks.</li>
          <li><strong>Legal &amp; Regulatory Authorities:</strong> We may disclose information if required to comply with a valid court order, government inquiry, or applicable Indian statutory obligation.</li>
        </ul>
      </section>

      {/* Section 10 */}
      <section id="privacy-10" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">10</div>
          <h2 className="legal-section-title">User Rights &amp; Account Control</h2>
        </div>
        <p className="legal-text">
          Subject to applicable laws, you hold the following rights regarding your personal information:
        </p>
        <ul className="legal-list">
          <li><strong>Access &amp; Export:</strong> You can export your mined lead lists and campaign data at any time via CSV, Excel, or PDF directly from your dashboard.</li>
          <li><strong>Correction:</strong> You may update your profile details and billing information from your user settings or by contacting our team.</li>
          <li><strong>Account Deletion:</strong> You may request permanent deletion of your account and personal records by emailing <code>klyrovainfotech@gmail.com</code> from your registered account email.</li>
        </ul>
      </section>

      {/* Section 11 */}
      <section id="privacy-11" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">11</div>
          <h2 className="legal-section-title">Cookies &amp; Local Storage</h2>
        </div>
        <p className="legal-text">
          Contaque utilizes browser <strong>LocalStorage</strong> strictly for essential functional purposes: storing your authenticated session JWT, user profile cache, and UI preferences (such as selected engines). We do not employ third-party tracking cookies or behavioral advertising beacons to track your web browsing outside of Contaque.
        </p>
      </section>

      {/* Section 12 */}
      <section id="privacy-12" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">12</div>
          <h2 className="legal-section-title">Policy Updates &amp; Contact Desk</h2>
        </div>
        <p className="legal-text">
          We may update this Privacy Policy from time to time to reflect operational or regulatory changes. The &quot;Effective Date&quot; at the top indicates when the latest modifications were published. For any privacy queries or data access requests, please contact our data desk:
        </p>
        <div className="legal-contact-card">
          <div className="legal-contact-row">
            <Mail size={16} style={{ color: '#818cf8' }} />
            <span>Privacy &amp; Data Desk: <a href="mailto:klyrovainfotech@gmail.com">klyrovainfotech@gmail.com</a></span>
          </div>
          <div className="legal-contact-row">
            <Mail size={16} style={{ color: '#34d399' }} />
            <span>Corporate Inquiries: <a href="mailto:info@klyrovainc.com">info@klyrovainc.com</a></span>
          </div>
          <div className="legal-contact-row">
            <MapPin size={16} style={{ color: '#f59e0b' }} />
            <span>Klyrova Inc. Data Compliance Team • Operating in India</span>
          </div>
        </div>
      </section>
    </LegalLayout>
  );
}
