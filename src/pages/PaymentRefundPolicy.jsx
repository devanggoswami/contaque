import React, { useEffect } from 'react';
import LegalLayout from '../components/LegalLayout';
import { CreditCard, ShieldCheck, Clock, Mail, MapPin } from 'lucide-react';

export default function PaymentRefundPolicy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <LegalLayout
      badge="BILLING & REFUND POLICY"
      title="Payment & Refund Policy"
      lastUpdated="September 23, 2026"
      activeDoc="refund"
    >
      {/* Table of Contents */}
      <div className="legal-toc-box">
        <div className="legal-toc-title">
          <CreditCard size={16} />
          <span>Payment &amp; Refund Policy Structure</span>
        </div>
        <div className="legal-toc-grid">
          <a href="#refund-1" className="legal-toc-link">
            <span className="legal-toc-number">01.</span>
            <span>Core Validation &amp; Refund Rule</span>
          </a>
          <a href="#refund-2" className="legal-toc-link">
            <span className="legal-toc-number">02.</span>
            <span>Successful Payments &amp; Plan Activation</span>
          </a>
          <a href="#refund-3" className="legal-toc-link">
            <span className="legal-toc-number">03.</span>
            <span>Wallet &amp; Prepaid Fund Transactions</span>
          </a>
          <a href="#refund-4" className="legal-toc-link">
            <span className="legal-toc-number">04.</span>
            <span>Payment Failures &amp; Pending Debits</span>
          </a>
          <a href="#refund-5" className="legal-toc-link">
            <span className="legal-toc-number">05.</span>
            <span>Duplicate &amp; Erroneous Payments</span>
          </a>
          <a href="#refund-6" className="legal-toc-link">
            <span className="legal-toc-number">06.</span>
            <span>Case Validation Requirement</span>
          </a>
          <a href="#refund-7" className="legal-toc-link">
            <span className="legal-toc-number">07.</span>
            <span>How to Submit a Dispute or Support Case</span>
          </a>
          <a href="#refund-8" className="legal-toc-link">
            <span className="legal-toc-number">08.</span>
            <span>Refund Processing Timelines</span>
          </a>
          <a href="#refund-9" className="legal-toc-link">
            <span className="legal-toc-number">09.</span>
            <span>Razorpay &amp; Banking Gateway Considerations</span>
          </a>
          <a href="#refund-10" className="legal-toc-link">
            <span className="legal-toc-number">10.</span>
            <span>Policy Governance &amp; Support Contact</span>
          </a>
        </div>
      </div>

      {/* Section 1: The Core Rule Callout */}
      <section id="refund-1" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">01</div>
          <h2 className="legal-section-title">Core Business &amp; Validation Rule</h2>
        </div>
        <p className="legal-text">
          At <strong>Contaque</strong> (operated by <strong>Klyrova Inc.</strong>), our billing operations are governed by transparent, fair, and record-verified procedures. Because Contaque delivers digital services, automated search scrapers, and real-time computing infrastructure, our refund evaluation is governed by the following core principle:
        </p>

        <div className="legal-callout primary">
          <ShieldCheck size={22} className="callout-icon" />
          <div className="callout-content">
            <strong>Core Policy Statement</strong>
            Refunds are not automatic solely because a customer requests one. If a customer reports a payment or service issue, the case will be reviewed and validated based on the relevant payment and account records. Where the issue is confirmed to have occurred due to a problem attributable to our service/platform, we may provide an appropriate refund or, where appropriate, service credits as a goodwill gesture. Any refund or credit is subject to case validation.
          </div>
        </div>

        <p className="legal-text">
          Neither do we claim that &quot;refunds are unconditionally guaranteed&quot; nor that &quot;refunds are never provided under any circumstance.&quot; Every genuine payment discrepancy or verified service failure is reviewed methodically against server logs and gateway records.
        </p>
      </section>

      {/* Section 2 */}
      <section id="refund-2" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">02</div>
          <h2 className="legal-section-title">Successful Payments &amp; Plan Activation</h2>
        </div>
        <p className="legal-text">
          When you initiate a payment for a subscription plan upgrade (<strong>Value Pack</strong> at ₹299/mo or <strong>Value Plus</strong> at ₹499/mo) via our integrated checkout:
        </p>
        <ul className="legal-list">
          <li><strong>Instant Cryptographic Verification:</strong> Upon completion of payment on Razorpay, our backend verifies the cryptographic signature generated by the gateway.</li>
          <li><strong>Immediate Entitlement Provisioning:</strong> Once verified, your subscription tier is upgraded immediately, unlocking discounted scraping rates and exclusive features without manual delay.</li>
          <li><strong>Calendar-Based Expiry:</strong> All monthly plans run on a strict calendar-month cycle. Your plan remains active until the exact same calendar day of the following calendar month at 11:59:59 PM Indian Standard Time (IST), ensuring you receive a full calendar month of service regardless of whether the month contains 28, 30, or 31 days.</li>
        </ul>
      </section>

      {/* Section 3 */}
      <section id="refund-3" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">03</div>
          <h2 className="legal-section-title">Wallet &amp; Prepaid Fund Transactions</h2>
        </div>
        <p className="legal-text">
          Lead extraction on Contaque utilizes a prepaid wallet system:
        </p>
        <ul className="legal-list">
          <li><strong>Prepaid Nature:</strong> Funds added to your wallet represent prepaid usage credits earmarked specifically for lead extraction and phone/email discovery across our search engines.</li>
          <li><strong>Real-Time Deductions:</strong> Charges are deducted strictly in real-time as verified business leads are extracted and stored into your account. Deductions reflect your tier&apos;s active per-lead rate schedule.</li>
          <li><strong>Deduplication Shield:</strong> You are charged solely for unique verified leads. If an extraction job encounters a lead already present in your active search database, that duplicate record is filtered with zero charge to your wallet balance.</li>
          <li><strong>Non-Refundable After Consumption:</strong> Wallet credits that have already been consumed to perform successful lead extraction jobs cannot be refunded once the computational queries have been delivered and lead data has been populated.</li>
        </ul>
      </section>

      {/* Section 4 */}
      <section id="refund-4" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">04</div>
          <h2 className="legal-section-title">Payment Failures &amp; Pending Debits</h2>
        </div>
        <p className="legal-text">
          During online transactions, temporary network drops, bank server timeouts, or UPI app delays may occasionally result in money being deducted from your bank account or card while the transaction status displays as &quot;Pending&quot; or &quot;Failed&quot; on the platform:
        </p>
        <div className="legal-callout info">
          <Clock size={20} className="callout-icon" />
          <div className="callout-content">
            <strong>Automated Bank Reconciliation Window</strong>
            In the majority of pending transaction cases, Razorpay or your issuing bank&apos;s automated reconciliation system automatically identifies the uncaptured payment and reverses the full debited amount back to your original payment method within <strong>5 to 7 business days</strong> without requiring manual merchant intervention.
          </div>
        </div>
        <p className="legal-text">
          If your account has been debited but your plan or wallet has not updated after 2 hours, please check your bank statement. If the amount has not been auto-reversed after 48 hours, contact our support team with your payment transaction ID so we can verify the status directly on the Razorpay merchant dashboard.
        </p>
      </section>

      {/* Section 5 */}
      <section id="refund-5" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">05</div>
          <h2 className="legal-section-title">Duplicate &amp; Erroneous Payments</h2>
        </div>
        <p className="legal-text">
          If you accidentally process two identical transactions for the same order due to multiple clicks or browser refresh:
        </p>
        <ul className="legal-list">
          <li>Contact our support team within forty-eight (48) hours of the transaction.</li>
          <li>Provide both payment transaction IDs and transaction timestamps.</li>
          <li>Once our team confirms the receipt of duplicate unutilized charges, you will be given the choice between an immediate credit to your Contaque wallet balance or a full refund of the duplicate transaction back to your original payment method.</li>
        </ul>
      </section>

      {/* Section 6 */}
      <section id="refund-6" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">06</div>
          <h2 className="legal-section-title">Case Validation Requirement</h2>
        </div>
        <p className="legal-text">
          <strong>No refund, charge reversal, or goodwill credit will be issued prior to thorough case validation.</strong>
        </p>
        <p className="legal-text">
          To ensure fairness and prevent fraudulent abuse, our engineering and support teams cross-reference every dispute against:
        </p>
        <ul className="legal-list">
          <li>Official Razorpay gateway payment logs and settlement receipts.</li>
          <li>Server-side database transaction tables (<code>payment_orders</code>, <code>plan_transactions</code>, and <code>wallet_ledger</code>).</li>
          <li>System error logs and task execution records at the timestamp of the reported incident.</li>
          <li>User lead consumption metrics and export timestamps.</li>
        </ul>
        <p className="legal-text">
          Where validation confirms that an error, payment capture failure, or double debit occurred due to an issue attributable to our platform, we will promptly issue a remedy (refund or service credits).
        </p>
      </section>

      {/* Section 7 */}
      <section id="refund-7" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">07</div>
          <h2 className="legal-section-title">How to Submit a Dispute or Support Case</h2>
        </div>
        <p className="legal-text">
          If you encounter an unresolved payment issue, plan activation delay, or billing discrepancy, please submit a formal case to our billing desk:
        </p>
        <div className="legal-contact-card">
          <div className="legal-contact-row">
            <Mail size={16} style={{ color: '#818cf8' }} />
            <span>Billing Desk: <a href="mailto:klyrovainfotech@gmail.com">klyrovainfotech@gmail.com</a></span>
          </div>
          <div className="legal-contact-row">
            <Mail size={16} style={{ color: '#34d399' }} />
            <span>Corporate Support: <a href="mailto:info@klyrovainc.com">info@klyrovainc.com</a></span>
          </div>
        </div>
        <p className="legal-text" style={{ marginTop: '14px' }}>
          To expedite resolution, please include the following mandatory details in your communication:
        </p>
        <ul className="legal-list">
          <li><strong>Registered Email:</strong> The exact email associated with your Contaque account.</li>
          <li><strong>Razorpay Payment ID:</strong> The transaction reference number (e.g., <code>pay_XXXXXXXXXXXXXX</code>) provided by Razorpay or found on your payment receipt.</li>
          <li><strong>Transaction Date &amp; Time:</strong> Exact timestamp of the attempted transaction.</li>
          <li><strong>Amount &amp; Currency:</strong> The exact amount debited (e.g., ₹299 INR or ₹499 INR).</li>
          <li><strong>Detailed Description:</strong> A clear explanation of what occurred (e.g., duplicate charge, plan not upgraded, wallet balance not updated).</li>
        </ul>
      </section>

      {/* Section 8 */}
      <section id="refund-8" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">08</div>
          <h2 className="legal-section-title">Refund Processing Timelines</h2>
        </div>
        <p className="legal-text">
          Once a refund request has been formally validated and approved by our support team:
        </p>
        <ul className="legal-list">
          <li><strong>Initiation:</strong> The refund is initiated on the Razorpay merchant portal within <strong>24 to 48 hours</strong> of case approval.</li>
          <li><strong>Settlement to Original Instrument:</strong> In accordance with standard banking channels and RBI clearing guidelines, the refunded amount typically reflects in the customer&apos;s bank account, credit/debit card, or UPI wallet within <strong>5 to 10 working days</strong>.</li>
          <li><strong>Notification:</strong> You will receive an official confirmation email containing the Razorpay Refund Reference Number (RRN) to trace the credit with your bank.</li>
        </ul>
      </section>

      {/* Section 9 */}
      <section id="refund-9" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">09</div>
          <h2 className="legal-section-title">Razorpay &amp; Banking Gateway Considerations</h2>
        </div>
        <p className="legal-text">
          Because payments involve intermediary banking switches (NPCI for UPI, Visa/Mastercard/RuPay card networks, and net banking aggregator servers), settlement and reversal schedules are subject to banking operational hours and public holidays in India.
        </p>
        <p className="legal-text">
          Customers are advised to refrain from opening speculative chargeback disputes with their card issuers before allowing our team the opportunity to review and validate the case, as card network disputes frequently freeze the transaction on the payment gateway, significantly delaying resolution.
        </p>
      </section>

      {/* Section 10 */}
      <section id="refund-10" className="legal-section">
        <div className="legal-section-header">
          <div className="legal-section-number">10</div>
          <h2 className="legal-section-title">Policy Governance &amp; Support Contact</h2>
        </div>
        <p className="legal-text">
          This Payment &amp; Refund Policy is governed under the laws of the Republic of India. We reserve the right to amend this policy periodically to align with evolving gateway standards and regulatory directives.
        </p>
        <div className="legal-contact-card">
          <div className="legal-contact-row">
            <Mail size={16} style={{ color: '#818cf8' }} />
            <span>Official Billing Inquiries: <a href="mailto:info@klyrovainc.com">info@klyrovainc.com</a></span>
          </div>
          <div className="legal-contact-row">
            <Mail size={16} style={{ color: '#34d399' }} />
            <span>Technical &amp; Payment Support: <a href="mailto:klyrovainfotech@gmail.com">klyrovainfotech@gmail.com</a></span>
          </div>
          <div className="legal-contact-row">
            <MapPin size={16} style={{ color: '#f59e0b' }} />
            <span>Klyrova Inc. (Klyrova Infotech) • Billing Desk • Republic of India</span>
          </div>
        </div>
      </section>
    </LegalLayout>
  );
}
