import React, { useState } from 'react';
import { 
  X, ShieldCheck, CheckCircle2, CreditCard, Smartphone, Building, 
  ArrowRight, Lock, Check, Zap, Sparkles 
} from 'lucide-react';
import './CheckoutModal.css';

export default function CheckoutModal({ 
  isOpen, 
  onClose, 
  plan, 
  currency = 'INR', 
  userEmail = '', 
  onSuccess 
}) {
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [email, setEmail] = useState(userEmail || '');
  const [name, setName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form Fields
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [upiId, setUpiId] = useState('');

  if (!isOpen || !plan) return null;

  const displayPrice = currency === 'INR' ? plan.price?.INR || '₹299' : plan.price?.USD || (plan.id === 'pack' ? '$5' : '$3');

  const handlePay = (e) => {
    e.preventDefault();
    setProcessing(true);

    // Simulate instant verified payment gateway
    setTimeout(() => {
      setProcessing(false);
      setSuccess(true);

      setTimeout(() => {
        if (onSuccess) {
          onSuccess({
            planId: plan.id,
            planName: plan.name,
            email: email || 'user@contaques.pro',
            name: name || 'Valued Growth Leader'
          });
        }
      }, 1200);
    }, 1500);
  };

  return (
    <div className="checkout-modal-backdrop" onClick={onClose}>
      <div className="checkout-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="checkout-close-btn" onClick={onClose} title="Close checkout">
          <X size={18} />
        </button>

        <div className="checkout-header-badge">
          <Lock size={12} />
          <span>256-BIT ENCRYPTED CHECKOUT</span>
        </div>

        <div className="checkout-title-row">
          <h2>Upgrade to {plan.name}</h2>
          <span className="checkout-price-pill">{displayPrice}/mo</span>
        </div>

        <p className="checkout-plan-desc">
          Instant activation. Get discounted lead engine rates and full outbound capabilities.
        </p>

        {/* Highlights */}
        <div className="checkout-highlights-box">
          <div className="checkout-feat-item">
            <CheckCircle2 size={15} className="check-icon" />
            <span>Discounted lead rates across all 6 verified scraping engines</span>
          </div>
          {plan.id === 'plus' && (
            <>
              <div className="checkout-feat-item">
                <CheckCircle2 size={15} className="check-icon" />
                <span>Free Bulk Email Outreach (Up to 1,600 emails/day)</span>
              </div>
              <div className="checkout-feat-item">
                <CheckCircle2 size={15} className="check-icon" />
                <span>2-Way Unified Inbox & Advanced Automated Sequences</span>
              </div>
            </>
          )}
          <div className="checkout-feat-item">
            <CheckCircle2 size={15} className="check-icon" />
            <span>Priority dedicated scraper workers & zero proxy setup</span>
          </div>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '30px 10px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', border: '2px solid #10b981', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
              <Check size={30} />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: '0 0 8px 0' }}>Payment Approved!</h3>
            <p style={{ fontSize: '13.5px', color: '#94a3b8', margin: 0 }}>
              Activating your <strong>{plan.name}</strong> subscription. Launching dashboard now...
            </p>
          </div>
        ) : (
          <form onSubmit={handlePay}>
            {/* Payment Method Switcher */}
            <div className="checkout-tabs-wrap">
              <button 
                type="button" 
                className={`checkout-tab-btn ${paymentMethod === 'upi' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('upi')}
              >
                <Smartphone size={15} />
                <span>UPI / QR</span>
              </button>
              <button 
                type="button" 
                className={`checkout-tab-btn ${paymentMethod === 'card' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('card')}
              >
                <CreditCard size={15} />
                <span>Card</span>
              </button>
              <button 
                type="button" 
                className={`checkout-tab-btn ${paymentMethod === 'netbanking' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('netbanking')}
              >
                <Building size={15} />
                <span>NetBanking</span>
              </button>
            </div>

            {/* Inputs */}
            <div className="checkout-form-col">
              <div className="checkout-row-2col">
                <div className="checkout-input-group">
                  <label>Your Name *</label>
                  <input 
                    type="text" 
                    className="checkout-input" 
                    placeholder="e.g. Rahul Sharma" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="checkout-input-group">
                  <label>Account Email *</label>
                  <input 
                    type="email" 
                    className="checkout-input" 
                    placeholder="name@company.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {paymentMethod === 'upi' && (
                <div className="upi-qr-card">
                  <div className="mock-qr-code">
                    <svg viewBox="0 0 24 24" fill="#0b0f17">
                      <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm14 0h-2v2h2v-2zm-4 4h-2v2h2v-2zm4 0h-2v2h2v-2zm2-2h-2v-2h2v2zm-2-4h-2v2h2v-2zm2 0h-2v-2h2v2zm-4 2h-2v2h2v-2z"/>
                    </svg>
                  </div>
                  <div className="upi-details-col">
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>Scan QR or Enter UPI ID</span>
                    <span className="upi-id-badge">klyrovainc@okhdfcbank</span>
                    <input 
                      type="text" 
                      className="checkout-input" 
                      placeholder="yourname@okhdfcbank / paytm" 
                      style={{ marginTop: '6px' }}
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {paymentMethod === 'card' && (
                <>
                  <div className="checkout-input-group">
                    <label>Card Number</label>
                    <input 
                      type="text" 
                      className="checkout-input" 
                      placeholder="4532 •••• •••• 8829" 
                      maxLength="19"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                    />
                  </div>
                  <div className="checkout-row-2col">
                    <div className="checkout-input-group">
                      <label>Valid Thru</label>
                      <input 
                        type="text" 
                        className="checkout-input" 
                        placeholder="MM/YY" 
                        maxLength="5"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                      />
                    </div>
                    <div className="checkout-input-group">
                      <label>CVV</label>
                      <input 
                        type="password" 
                        className="checkout-input" 
                        placeholder="•••" 
                        maxLength="4"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              {paymentMethod === 'netbanking' && (
                <div className="checkout-input-group">
                  <label>Select Bank</label>
                  <select className="checkout-input" style={{ background: '#0b0f17' }}>
                    <option>HDFC Bank</option>
                    <option>State Bank of India</option>
                    <option>ICICI Bank</option>
                    <option>Axis Bank</option>
                    <option>Kotak Mahindra Bank</option>
                  </select>
                </div>
              )}
            </div>

            {/* Total Calculation */}
            <div className="checkout-summary-box">
              <div className="summary-row">
                <span>Plan Subtotal</span>
                <span>{displayPrice}</span>
              </div>
              <div className="summary-row">
                <span>Platform Taxes</span>
                <span>₹0 (Included)</span>
              </div>
              <div className="summary-row total">
                <span>Total Amount Due</span>
                <span>{displayPrice}</span>
              </div>
            </div>

            {/* CTA Button */}
            <button 
              type="submit" 
              className="checkout-submit-btn"
              disabled={processing}
            >
              {processing ? (
                <span>Verifying Secure Payment...</span>
              ) : (
                <>
                  <span>Pay {displayPrice} & Launch Dashboard</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className="checkout-security-notice">
              <ShieldCheck size={14} style={{ color: '#10b981' }} />
              <span>Protected by Klyrova Inc. AES-256 Cloud Infrastructure • Cancel Anytime</span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
