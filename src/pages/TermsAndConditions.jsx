import React, { useEffect } from 'react';
import LegalLayout from '../components/LegalLayout';
import { 
  FileText, AlertTriangle, Calendar, Scale, Mail, MapPin 
} from 'lucide-react';

export default function TermsAndConditions() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <LegalLayout
      badge="LEGAL AGREEMENT"
      title="Terms & Conditions"
      lastUpdated="September 23, 2026"
      activeDoc="terms"
    >
      {/* Table of Contents */}
      <div className="legal-toc-box">
        <div className="legal-toc-title">
          <FileText size={16} />
          <span>Table of Contents</span>
        </div>
        <div className="legal-toc-grid">
          <a href="#section-1" className="legal-toc-link">
            <span className="legal-toc-number">01.</span>
            <span>Agreement to Terms & Company Info</span>
          </a>
          <a href="#section-2" className="legal-toc-link">
            <span className="legal-toc-number">02.</span>
            <span>Account Registration & Responsibilities</span>
          </a>
          <a href="#section-3" className="legal-toc-link">
            <span className="legal-toc-number">03.</span>
            <span>Accurate Account Information</span>
          </a>
          <a href="#section-4" className="legal-toc-link">
            <span className="legal-toc-number">04.</span>
            <span>Acceptable Use Policy</span>
          </a>
          <a href="#section-5" className="legal-toc-link">
            <span className="legal-toc-number">05.</span>
            <span>Subscription Plans & Calendar Expiry</span>
          </a>
          <a href="#section-6" className="legal-toc-link">
            <span className="legal-toc-number">06.</span>
            <span>Wallet & Prepaid Credits Usage</span>
          </a>
          <a href="#section-7" className="legal-toc-link">
            <span className="legal-toc-number">07.</span>
            <span>Payment Terms & Processing</span>
          </a>
          <a href="#section-8" className="legal-toc-link">
            <span className="legal-toc-number">08.</span>
            <span>Account Suspension & Termination</span>
          </a>
          <a href="#section-9" className="legal-toc-link">
            <span className="legal-toc-number">09.</span>
            <span>Intellectual Property Rights</span>
          </a>
          <a href="#section-10" className="legal-toc-link">
            <span className="legal-toc-number">10.</span>
            <span>Service Availability & Warranties</span>
          </a>
          <a href="#section-11" className="legal-toc-link">
            <span className="legal-toc-number">11.</span>
            <span>Limitation of Liability</span>
          </a>
          <a href="#section-12" className="legal-toc-link">
            <span className="legal-toc-number">12.</span>
            <span>Modifications to Services & Terms</span>
          </a>
          <a href="#section-13" className="legal-toc-link">
            <span className="legal-toc-number">13.</span>
            <span>Governing Law & Jurisdiction</span>
          </a>
          <a href="#section-14" className="legal-toc-link">
            <span className="legal-toc-number">14.</span>
            <span>Contact & Support Desk</span>
          </a>
        </div>
      </div>

      {/* Section 1 */}
      <section id="section-1" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">01</div>
          <h2 className="legal-section-title">Agreement to Terms & Company Information</h2>
        </div>
        <p className="legal-text">
          These Terms and Conditions (&quot;Terms&quot;, &quot;Agreement&quot;) constitute a legally binding agreement between you (&quot;User&quot;, &quot;Customer&quot;, &quot;You&quot;) and <strong>Klyrova Inc.</strong> (&quot;Company&quot;, &quot;We&quot;, &quot;Us&quot;, &quot;Our&quot;), governing your access to and use of the <strong>Contaque</strong> software-as-a-service platform, including the website, APIs, scraping engines, data extraction tools, cold outreach tools, and customer dashboards (collectively, the &quot;Service&quot;).
        </p>
        <p className="legal-text">
          By creating an account, clicking &quot;Sign Up&quot;, logging in, topping up a wallet balance, purchasing a subscription plan, or accessing any part of the Service, you acknowledge that you have read, understood, and agree to be bound by these Terms and our companion Privacy Policy and Payment &amp; Refund Policy. If you are entering into this Agreement on behalf of a company, organization, or legal entity, you represent and warrant that you possess the lawful authority to bind such entity to these Terms.
        </p>
      </section>

      {/* Section 2 */}
      <section id="section-2" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">02</div>
          <h2 className="legal-section-title">Account Registration &amp; User Responsibility</h2>
        </div>
        <p className="legal-text">
          To access the core features of Contaque, you must register for an account using a valid email address or via Google OAuth authentication. You are strictly responsible for maintaining the confidentiality of your login credentials, password, and session access tokens.
        </p>
        <ul className="legal-list">
          <li><strong>Individual Account Ownership:</strong> Each account is assigned to an individual user or organization. You must not share, transfer, or resell access to your account credentials without prior written consent from the Company.</li>
          <li><strong>Security Notification:</strong> You must immediately notify our technical support team at <code>klyrovainfotech@gmail.com</code> if you detect or suspect any unauthorized access, breach of security, or compromised credentials.</li>
          <li><strong>Account Liability:</strong> You accept full legal and financial responsibility for all activities, scraping jobs, outreach campaigns, and data requests conducted through your account.</li>
        </ul>
      </section>

      {/* Section 3 */}
      <section id="section-3" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">03</div>
          <h2 className="legal-section-title">Accurate Account Information</h2>
        </div>
        <p className="legal-text">
          You agree to provide true, accurate, current, and complete information during registration and checkout, including your legal name, authorized work email, country of residence/operation, and accurate billing details where required. Providing fraudulent, deceptive, or deliberately misleading information constitutes a material breach of these Terms and may result in immediate suspension or permanent termination of your account without notice.
        </p>
      </section>

      {/* Section 4 */}
      <section id="section-4" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">04</div>
          <h2 className="legal-section-title">Acceptable Use Policy</h2>
        </div>
        <p className="legal-text">
          Contaque is built for legitimate B2B business development, sales prospecting, market research, and targeted outbound communication. You agree to use the Service in strict compliance with all applicable local, national, and international laws, regulations, and industry standards.
        </p>
        <div className="legal-callout warning">
          <AlertTriangle size={20} className="callout-icon" />
          <div className="callout-content">
            <strong>Prohibited Activities</strong>
            You expressly agree NOT to engage in any of the following unauthorized practices:
          </div>
        </div>
        <ul className="legal-list">
          <li>Extracting or harvesting non-public, classified, restricted government datasets, or private individual personal data that violates data protection statutes.</li>
          <li>Transmitting unsolicited bulk spam, phishing campaigns, deceptive messages, or harassing communications in violation of anti-spam regulations (such as the IT Act of India, CAN-SPAM, GDPR, or equivalent telemarketing laws).</li>
          <li>Attempting to probe, scan, breach, reverse engineer, decompile, or bypass the platform’s security safeguards, rate limiters, or authentication mechanisms.</li>
          <li>Reselling, sublicensing, or distributing the Contaque application code, scraping engines, or proprietary algorithms to third parties.</li>
          <li>Using automated bots or high-frequency automated scripts to degrade, overload, or impair the stability of our cloud infrastructure.</li>
        </ul>
      </section>

      {/* Section 5 */}
      <section id="section-5" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">05</div>
          <h2 className="legal-section-title">Subscription Plans &amp; Calendar-Based Expiry</h2>
        </div>
        <p className="legal-text">
          Contaque offers multiple tiers of service, including a Free Pay-As-You-Go plan and paid monthly subscription tiers (Value Pack and Value Plus):
        </p>
        <ul className="legal-list">
          <li><strong>Free Plan:</strong> No monthly recurring commitment; users pay per lead generated using prepaid wallet balance.</li>
          <li><strong>Value Pack (₹299/mo):</strong> Discounted per-lead scraping rates across all engines, priority workers, and verified contact lookups.</li>
          <li><strong>Value Plus (₹499/mo):</strong> Lowest per-lead scraping rates plus full cold email outreach suite (including automated rotation, campaigns, and unified inbox).</li>
        </ul>
        <div className="legal-callout info">
          <Calendar size={20} className="callout-icon" />
          <div className="callout-content">
            <strong>Strict Calendar-Based Billing Rule</strong>
            All paid subscription plans operate on a strict calendar-month cycle. A plan activated on any calendar day expires on the exact same calendar day of the subsequent calendar month at 11:59:59 PM Indian Standard Time (IST). For activations on month-end dates (e.g., January 31), the expiry automatically adjusts safely to the final calendar day of the next month (e.g., February 28 or 29) at 11:59:59 PM IST.
          </div>
        </div>
      </section>

      {/* Section 6 */}
      <section id="section-6" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">06</div>
          <h2 className="legal-section-title">Wallet &amp; Prepaid Credits Usage</h2>
        </div>
        <p className="legal-text">
          Lead extraction across our search engines is powered by prepaid wallet credits:
        </p>
        <ul className="legal-list">
          <li><strong>Prepaid Deduction:</strong> Credits are deducted in real-time as verified business leads are extracted and added to your database, calculated according to your current active subscription plan&apos;s per-lead rate schedule.</li>
          <li><strong>Deduplication Guarantee:</strong> You are charged solely for newly extracted unique leads. Duplicate leads previously mined within the same job or database search are automatically filtered with zero deduction.</li>
          <li><strong>Non-Transferable:</strong> Wallet balances are strictly tied to your authenticated account and may not be transferred, assigned, or gifted to other accounts.</li>
          <li><strong>Non-Interest Bearing:</strong> Prepaid wallet balances do not accumulate interest or dividends.</li>
        </ul>
      </section>

      {/* Section 7 */}
      <section id="section-7" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">07</div>
          <h2 className="legal-section-title">Payment Terms &amp; Processing</h2>
        </div>
        <p className="legal-text">
          All pricing and fees are quoted in Indian National Rupees (INR) unless explicitly stated otherwise. Payments for subscriptions and wallet top-ups are processed through authorized, PCI-DSS compliant third-party payment gateways, primarily <strong>Razorpay</strong>.
        </p>
        <ul className="legal-list">
          <li><strong>Taxes:</strong> All applicable Goods and Services Tax (GST) or statutory levies are calculated and collected in accordance with Indian tax laws.</li>
          <li><strong>Payment Verification:</strong> Plan upgrades and wallet credits are credited to your account upon cryptographic verification of the gateway transaction signature.</li>
          <li><strong>Payment Gateway Security:</strong> Contaque does not store, process, or transmit raw credit/debit card numbers, CVVs, or net banking passwords. All sensitive payment details are handled directly by Razorpay under certified banking encryption standards.</li>
        </ul>
      </section>

      {/* Section 8 */}
      <section id="section-8" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">08</div>
          <h2 className="legal-section-title">Account Suspension &amp; Termination</h2>
        </div>
        <p className="legal-text">
          We reserve the right, in our sole and reasonable discretion, to suspend, restrict, or permanently terminate your account and access to the Service under the following circumstances:
        </p>
        <ul className="legal-list">
          <li>Any violation of our Acceptable Use Policy, anti-spam guidelines, or applicable laws.</li>
          <li>Initiation of fraudulent payment chargebacks, unauthorized payment disputes, or stolen payment credentials.</li>
          <li>Activities that threaten the operational integrity, availability, or security of the platform or other customers.</li>
          <li>Compliance with a lawful court order, subpoena, or government regulatory directive.</li>
        </ul>
        <p className="legal-text">
          Upon termination, your right to access the Service terminates immediately. You may request an export of your existing database records subject to account verification and compliance clearance.
        </p>
      </section>

      {/* Section 9 */}
      <section id="section-9" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">09</div>
          <h2 className="legal-section-title">Intellectual Property Rights</h2>
        </div>
        <p className="legal-text">
          <strong>Our Property:</strong> All software, source code, user interfaces, visual design, scraping pipelines, algorithms, trademarks, service marks, logos, and documentation related to Contaque are and remain the exclusive intellectual property of Klyrova Inc. and its licensors.
        </p>
        <p className="legal-text">
          <strong>Your Data:</strong> You retain full ownership and intellectual rights in and to your account inputs, search parameters, email campaign copy, and the datasets you extract and export from the platform. We do not claim ownership of the business contacts you extract through your lawful use of the Service.
        </p>
      </section>

      {/* Section 10 */}
      <section id="section-10" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">10</div>
          <h2 className="legal-section-title">Service Availability &amp; Disclaimer of Warranties</h2>
        </div>
        <p className="legal-text">
          We endeavor to maintain high platform availability and uninterrupted scraping execution. However, the Service is provided on an <strong>&quot;AS IS&quot;</strong> and <strong>&quot;AS AVAILABLE&quot;</strong> basis without warranties of any kind, whether express, statutory, or implied.
        </p>
        <ul className="legal-list">
          <li><strong>Maintenance &amp; Downtime:</strong> We reserve the right to perform scheduled maintenance, software updates, and emergency security patches, during which parts of the Service may be temporarily unavailable.</li>
          <li><strong>Third-Party Dependencies:</strong> Data extraction relies on public web indexes and search platforms whose availability, layout, and rate limits are beyond our direct control. We do not guarantee uninterrupted extraction speed or 100% data completeness for every query.</li>
          <li><strong>Accuracy:</strong> While our engines apply phone and email verification filters, we do not warrant that all public business records retrieved from the web are error-free or up-to-date.</li>
        </ul>
      </section>

      {/* Section 11 */}
      <section id="section-11" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">11</div>
          <h2 className="legal-section-title">Limitation of Liability</h2>
        </div>
        <p className="legal-text">
          To the maximum extent permitted by applicable Indian law, neither Klyrova Inc., nor its directors, officers, employees, agents, or affiliates, shall be liable for any indirect, incidental, special, punitive, exemplary, or consequential damages whatsoever, including without limitation damages for lost profits, loss of goodwill, business interruption, or loss of sales data, arising out of or in connection with the use or inability to use the Service.
        </p>
        <div className="legal-callout primary">
          <Scale size={20} className="callout-icon" />
          <div className="callout-content">
            <strong>Aggregate Liability Cap</strong>
            In no event shall the aggregate total liability of Klyrova Inc. arising out of or related to these Terms or the Service exceed the total amount actually paid by you to the Company in the twelve (12) months immediately preceding the event giving rise to liability.
          </div>
        </div>
      </section>

      {/* Section 12 */}
      <section id="section-12" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">12</div>
          <h2 className="legal-section-title">Modifications to Services &amp; Terms</h2>
        </div>
        <p className="legal-text">
          We reserve the right to enhance, modify, or discontinue features of the Service or update these Terms periodically. When changes are made, we will update the &quot;Effective Date&quot; at the top of this document. For material changes, we will make reasonable efforts to provide notice via email or an in-app banner. Your continued use of the Service following the posting of revised Terms constitutes your explicit acceptance of such changes.
        </p>
      </section>

      {/* Section 13 */}
      <section id="section-13" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">13</div>
          <h2 className="legal-section-title">Governing Law &amp; Jurisdiction</h2>
        </div>
        <p className="legal-text">
          These Terms and any dispute, controversy, or claim arising out of or in connection with them shall be governed by and construed in accordance with the <strong>laws of the Republic of India</strong>, without regard to its conflict of law principles.
        </p>
        <p className="legal-text">
          You agree that any legal suit, action, or proceeding arising out of or related to these Terms or the Service shall be instituted exclusively in the competent courts having jurisdiction in <strong>India</strong>, and you irrevocably submit to the personal and exclusive jurisdiction of such courts.
        </p>
      </section>

      {/* Section 14 */}
      <section id="section-14" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">14</div>
          <h2 className="legal-section-title">Contact &amp; Support Desk</h2>
        </div>
        <p className="legal-text">
          If you have questions, inquiries, or notices regarding these Terms &amp; Conditions, please reach out to our dedicated support and legal desk:
        </p>
        <div className="legal-contact-card">
          <div className="legal-contact-row">
            <Mail size={16} style={{ color: '#818cf8' }} />
            <span>Official Business Inquiries: <a href="mailto:info@klyrovainc.com">info@klyrovainc.com</a></span>
          </div>
          <div className="legal-contact-row">
            <Mail size={16} style={{ color: '#34d399' }} />
            <span>Support &amp; Technical Desk: <a href="mailto:klyrovainfotech@gmail.com">klyrovainfotech@gmail.com</a></span>
          </div>
          <div className="legal-contact-row">
            <MapPin size={16} style={{ color: '#f59e0b' }} />
            <span>Entity: <strong>Klyrova Inc. (Klyrova Infotech)</strong> • Jurisdiction: India</span>
          </div>
        </div>
      </section>
    </LegalLayout>
  );
}
