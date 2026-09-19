import React, { useState, useEffect } from 'react';
import {
  X, ShieldCheck, CheckCircle2, Lock, ArrowRight, CreditCard,
  Smartphone, Building, Check, Sparkles, AlertCircle, User, Mail
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './RazorpayCheckoutModal.css';

export default function RazorpayCheckoutModal({
  isOpen,
  onClose,
  plan,
  currency = 'INR',
  onSuccess
}) {
  if (!isOpen || !plan) return null;

  const { user, isAuthenticated, signup, login, activatePlan } = useAuth();

  // Stepper: 1: Account, 2: Billing Details, 3: Razorpay Checkout, 4: Success
  const [step, setStep] = useState(isAuthenticated ? 2 : 1);

  // Step 1: Account Fields (if not authenticated)
  const [accountForm, setAccountForm] = useState({
    name: '',
    email: '',
    password: '',
    country: 'India',
    isLoginMode: false
  });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Step 2: Billing Details
  const [billingForm, setBillingForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    company: '',
    address: '',
    city: '',
    country: user?.country || 'India',
    gstin: ''
  });

  // Step 3: Razorpay Payment Method
  const [razorpayMethod, setRazorpayMethod] = useState('upi');
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  const [paying, setPaying] = useState(false);

  // Step 4: Payment Success Receipt
  const [paymentReceipt, setPaymentReceipt] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      setBillingForm(prev => ({
        ...prev,
        name: prev.name || user?.name || '',
        email: prev.email || user?.email || '',
        country: prev.country || user?.country || 'India'
      }));
      if (step === 1) setStep(2);
    }
  }, [isAuthenticated, user]);

  const displayPrice = currency === 'INR' ? plan.price?.INR || '₹299' : plan.price?.USD || '$3.12';
  const numericAmount = currency === 'INR' ? (plan.id === 'plus' ? '499.00' : '299.00') : (plan.id === 'plus' ? '5.20' : '3.12');

  // Handle Step 1 Submit (Account Creation or Login)
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    if (accountForm.isLoginMode) {
      const res = await login(accountForm.email.trim(), accountForm.password);
      setAuthLoading(false);
      if (res.success) {
        setStep(2);
      } else {
        setAuthError(res.error || 'Invalid credentials');
      }
    } else {
      if (!accountForm.name || !accountForm.email || !accountForm.password) {
        setAuthLoading(false);
        setAuthError('Please fill in all required fields.');
        return;
      }
      const res = await signup({
        name: accountForm.name,
        email: accountForm.email,
        password: accountForm.password,
        country: accountForm.country,
        plan: plan.id
      });
      setAuthLoading(false);
      if (res.success) {
        setStep(2);
      } else {
        setAuthError(res.error || 'Failed to create account');
      }
    }
  };

  // Handle Step 2 Submit (Proceed to Razorpay)
  const handleBillingSubmit = (e) => {
    e.preventDefault();
    if (!billingForm.name || !billingForm.email) {
      alert('Please provide your name and email for the invoice.');
      return;
    }
    setStep(3); // Go to Razorpay Checkout
  };

  // Handle Step 3 Razorpay Payment
  const handleRazorpayPay = async (e) => {
    e.preventDefault();
    setPaying(true);

    // Simulate Razorpay payment network latency
    setTimeout(async () => {
      const generatedPaymentId = 'pay_RPZ' + Math.random().toString(36).substring(2, 10).toUpperCase();
      const generatedOrderId = 'order_KL' + Math.random().toString(36).substring(2, 9).toUpperCase();

      const receipt = {
        paymentId: generatedPaymentId,
        orderId: generatedOrderId,
        amount: displayPrice,
        planName: plan.name,
        date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        email: billingForm.email || user?.email
      };

      setPaymentReceipt(receipt);
      setPaying(false);
      setStep(4); // Payment Success!

      // Activate plan in AuthContext / DB
      await activatePlan(plan.id, billingForm, generatedPaymentId);
    }, 1600);
  };

  const handleFinish = () => {
    if (onSuccess) {
      onSuccess(paymentReceipt);
    } else {
      onClose();
    }
  };

    if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="rp-modal-backdrop" onClick={onClose}>
      <div className="rp-modal-container" onClick={(e) => e.stopPropagation()}>

        {/* Stepper Header */}
        <div className="rp-stepper-header">
          <div className="rp-brand-title">
            <Sparkles size={18} style={{ color: '#6366f1' }} />
            <strong>Contaques Checkout</strong>
          </div>

          <div className="rp-step-crumbs">
            <span className={`rp-crumb-dot ${step > 1 ? 'done' : step === 1 ? 'active' : ''}`} title="Account">1</span>
            <span className={`rp-crumb-dot ${step > 2 ? 'done' : step === 2 ? 'active' : ''}`} title="Billing">2</span>
            <span className={`rp-crumb-dot ${step > 3 ? 'done' : step === 3 ? 'active' : ''}`} title="Razorpay">3</span>
            <span className={`rp-crumb-dot ${step === 4 ? 'done' : ''}`} title="Done">✓</span>
          </div>

          <button className="rp-close-btn" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="rp-modal-body">

          {/* ===================================================================
              STEP 1: Create Account or Login
              =================================================================== */}
          {step === 1 && (
            <div>
              <div className="rp-stage-title">
                <h3>{accountForm.isLoginMode ? 'Sign In to Proceed' : 'Create Your Account'}</h3>
                <p>Enter your details to link your <strong>{plan.name}</strong> subscription.</p>
              </div>

              {authError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '10px 12px', borderRadius: '8px', fontSize: '12.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={15} />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleAuthSubmit}>
                {!accountForm.isLoginMode && (
                  <>
                    <div className="rp-form-group">
                      <label>Full Name *</label>
                      <input
                        type="text"
                        className="rp-input"
                        placeholder="e.g. Alex Johnson"
                        value={accountForm.name}
                        onChange={(e) => setAccountForm(p => ({ ...p, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="rp-form-group">
                      <label>Country *</label>
                      <select
                        className="rp-select"
                        value={accountForm.country}
                        onChange={(e) => setAccountForm(p => ({ ...p, country: e.target.value }))}
                      >
                        <option value="India">🇮🇳 India</option>
                        <option value="United States">🇺🇸 United States</option>
                        <option value="United Arab Emirates">🇦🇪 United Arab Emirates</option>
                        <option value="United Kingdom">🇬🇧 United Kingdom</option>
                        <option value="Canada">🇨🇦 Canada</option>
                        <option value="Australia">🇦🇺 Australia</option>
                        <option value="Singapore">🇸🇬 Singapore</option>
                        <option value="Germany">🇩🇪 Germany</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="rp-form-group">
                  <label>Work Email *</label>
                  <input
                    type="email"
                    className="rp-input"
                    placeholder="name@company.com"
                    value={accountForm.email}
                    onChange={(e) => setAccountForm(p => ({ ...p, email: e.target.value }))}
                    required
                  />
                </div>

                <div className="rp-form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    className="rp-input"
                    placeholder="••••••••••••"
                    value={accountForm.password}
                    onChange={(e) => setAccountForm(p => ({ ...p, password: e.target.value }))}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="rp-primary-btn"
                  disabled={authLoading}
                >
                  {authLoading ? 'Verifying...' : (
                    <>
                      <span>Continue to Billing</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '12.5px', color: '#94a3b8' }}>
                  <span>{accountForm.isLoginMode ? "Don't have an account?" : "Already have an account?"}</span>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: '#818cf8', fontWeight: 700, cursor: 'pointer', marginLeft: '6px' }}
                    onClick={() => setAccountForm(p => ({ ...p, isLoginMode: !p.isLoginMode }))}
                  >
                    {accountForm.isLoginMode ? 'Sign Up' : 'Log In'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ===================================================================
              STEP 2: Billing Details
              =================================================================== */}
          {step === 2 && (
            <div>
              <div className="rp-stage-title">
                <h3>Billing & Invoice Information</h3>
                <p>Plan selected: <strong>{plan.name} ({displayPrice}/month)</strong></p>
              </div>

              <form onSubmit={handleBillingSubmit}>
                <div className="rp-grid-2col">
                  <div className="rp-form-group">
                    <label>Billing Name *</label>
                    <input
                      type="text"
                      className="rp-input"
                      value={billingForm.name}
                      onChange={(e) => setBillingForm(p => ({ ...p, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="rp-form-group">
                    <label>Billing Email *</label>
                    <input
                      type="email"
                      className="rp-input"
                      value={billingForm.email}
                      onChange={(e) => setBillingForm(p => ({ ...p, email: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="rp-grid-2col">
                  <div className="rp-form-group">
                    <label>Mobile Phone *</label>
                    <input
                      type="tel"
                      className="rp-input"
                      placeholder="+91 98765 43210"
                      value={billingForm.phone}
                      onChange={(e) => setBillingForm(p => ({ ...p, phone: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="rp-form-group">
                    <label>Country *</label>
                    <select
                      className="rp-select"
                      value={billingForm.country}
                      onChange={(e) => setBillingForm(p => ({ ...p, country: e.target.value }))}
                    >
                      <option value="India">India</option>
                      <option value="United States">United States</option>
                      <option value="United Arab Emirates">United Arab Emirates</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Canada">Canada</option>
                      <option value="Australia">Australia</option>
                      <option value="Singapore">Singapore</option>
                    </select>
                  </div>
                </div>

                <div className="rp-form-group">
                  <label>Billing Address</label>
                  <input
                    type="text"
                    className="rp-input"
                    placeholder="Street, Landmark, City"
                    value={billingForm.address}
                    onChange={(e) => setBillingForm(p => ({ ...p, address: e.target.value }))}
                  />
                </div>

                <div className="rp-form-group">
                  <label>GSTIN (Optional for Tax Invoice)</label>
                  <input
                    type="text"
                    className="rp-input"
                    placeholder="e.g. 27ABCDE1234F1Z5"
                    value={billingForm.gstin}
                    onChange={(e) => setBillingForm(p => ({ ...p, gstin: e.target.value }))}
                  />
                </div>

                <button type="submit" className="rp-primary-btn">
                  <span>Proceed to Razorpay Checkout</span>
                  <ArrowRight size={16} />
                </button>
              </form>
            </div>
          )}

          {/* ===================================================================
              STEP 3: Razorpay Native Frame Checkout
              =================================================================== */}
          {step === 3 && (
            <div className="razorpay-frame-box">
              {/* Razorpay Top Bar */}
              <div className="razorpay-top-bar">
                <div className="razorpay-brand">
                  <span className="razorpay-brand-logo-text">Razorpay</span>
                  <span className="razorpay-badge">TRUSTED BUSINESS</span>
                </div>
                <div className="razorpay-price-col">
                  <span>Amount to Pay</span>
                  <strong>{displayPrice}</strong>
                </div>
              </div>

              {/* Razorpay Form Body */}
              <div className="razorpay-body-content">
                <div className="razorpay-method-nav">
                  <button
                    type="button"
                    className={`razorpay-method-tab ${razorpayMethod === 'upi' ? 'active' : ''}`}
                    onClick={() => setRazorpayMethod('upi')}
                  >
                    <Smartphone size={14} />
                    <span>UPI / QR</span>
                  </button>
                  <button
                    type="button"
                    className={`razorpay-method-tab ${razorpayMethod === 'card' ? 'active' : ''}`}
                    onClick={() => setRazorpayMethod('card')}
                  >
                    <CreditCard size={14} />
                    <span>Card</span>
                  </button>
                  <button
                    type="button"
                    className={`razorpay-method-tab ${razorpayMethod === 'netbanking' ? 'active' : ''}`}
                    onClick={() => setRazorpayMethod('netbanking')}
                  >
                    <Building size={14} />
                    <span>NetBanking</span>
                  </button>
                </div>

                <form onSubmit={handleRazorpayPay}>
                  {razorpayMethod === 'upi' && (
                    <div className="razorpay-upi-view">
                      <div className="upi-app-badges">
                        <span className="upi-pill">Google Pay</span>
                        <span className="upi-pill">PhonePe</span>
                        <span className="upi-pill">Paytm</span>
                        <span className="upi-pill">BHIM</span>
                      </div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                        Enter UPI ID / VPA
                      </label>
                      <input
                        type="text"
                        className="razorpay-native-input"
                        placeholder="yourname@okhdfcbank / paytm"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                      />
                    </div>
                  )}

                  {razorpayMethod === 'card' && (
                    <div className="razorpay-upi-view">
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                        Card Number
                      </label>
                      <input
                        type="text"
                        className="razorpay-native-input"
                        placeholder="4532 •••• •••• 9821"
                        maxLength="19"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>Expiry (MM/YY)</label>
                          <input
                            type="text"
                            className="razorpay-native-input"
                            placeholder="08/28"
                            maxLength="5"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>CVV</label>
                          <input
                            type="password"
                            className="razorpay-native-input"
                            placeholder="•••"
                            maxLength="4"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {razorpayMethod === 'netbanking' && (
                    <div className="razorpay-upi-view">
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                        Choose Bank
                      </label>
                      <select
                        className="razorpay-native-input"
                        value={selectedBank}
                        onChange={(e) => setSelectedBank(e.target.value)}
                      >
                        <option>HDFC Bank</option>
                        <option>State Bank of India</option>
                        <option>ICICI Bank</option>
                        <option>Axis Bank</option>
                        <option>Kotak Mahindra Bank</option>
                        <option>Bank of Baroda</option>
                      </select>
                    </div>
                  )}

                  {/* Razorpay Action Button */}
                  <button
                    type="submit"
                    className="razorpay-pay-button"
                    disabled={paying}
                  >
                    {paying ? (
                      <span>Connecting to Razorpay...</span>
                    ) : (
                      <>
                        <Lock size={15} />
                        <span>Pay {displayPrice}</span>
                      </>
                    )}
                  </button>

                  <div className="razorpay-security-bar">
                    <ShieldCheck size={14} style={{ color: '#0c83fe' }} />
                    <span>Secured by Razorpay • PCI-DSS 3.2.1 Certified</span>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ===================================================================
              STEP 4: Payment Success & Direct to Dashboard
              =================================================================== */}
          {step === 4 && (
            <div className="rp-success-card">
              <div className="rp-success-icon-box">
                <Check size={36} />
              </div>

              <h3>Payment Successful!</h3>
              <p>
                Your <strong>{plan.name}</strong> subscription has been successfully activated via Razorpay.
              </p>

              {paymentReceipt && (
                <div className="rp-receipt-box">
                  <div className="rp-receipt-row">
                    <span>Payment ID:</span>
                    <strong>{paymentReceipt.paymentId}</strong>
                  </div>
                  <div className="rp-receipt-row">
                    <span>Order Reference:</span>
                    <strong>{paymentReceipt.orderId}</strong>
                  </div>
                  <div className="rp-receipt-row">
                    <span>Amount Paid:</span>
                    <strong style={{ color: '#34d399' }}>{paymentReceipt.amount}</strong>
                  </div>
                  <div className="rp-receipt-row">
                    <span>Active Account:</span>
                    <strong>{paymentReceipt.email}</strong>
                  </div>
                </div>
              )}

              <button
                type="button"
                className="rp-primary-btn"
                onClick={handleFinish}
              >
                <span>Launch Dashboard Now</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
}
