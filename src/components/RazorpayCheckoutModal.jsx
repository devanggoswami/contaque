import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ShieldCheck, CheckCircle2, Lock, ArrowRight,
  Check, Sparkles, AlertCircle, User, Mail
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL, RAZORPAY_KEY_ID } from '../config';
import './RazorpayCheckoutModal.css';

export default function RazorpayCheckoutModal({
  isOpen,
  onClose,
  plan,
  currency = 'INR',
  onSuccess
}) {
  const { user, isAuthenticated, logout, signup, login, activatePlan, authFetch } = useAuth();

  // Stepper: 1: Account (if guest), 2: Billing Details, 4: Success / Plan Activated
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

  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState('');

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
  }, [isAuthenticated, user, step]);

  useEffect(() => {
    if (isOpen) {
      setStep(isAuthenticated ? 2 : 1);
      setPaymentError('');
      setPaying(false);
      setPaymentReceipt(null);
    }
  }, [isOpen, isAuthenticated]);

  const displayPrice = plan ? (currency === 'INR' ? plan.price?.INR || '₹299' : plan.price?.USD || '$3.12') : '₹299';
  const numericAmount = plan ? (currency === 'INR' ? (plan.id === 'plus' ? '499.00' : '299.00') : (plan.id === 'plus' ? '5.20' : '3.12')) : '299.00';

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
        plan: 'free'
      });
      setAuthLoading(false);
      if (res.success) {
        setStep(2);
      } else {
        setAuthError(res.error || 'Failed to create account');
      }
    }
  };

  // Handle Step 2 Submit: Directly launch OFFICIAL Razorpay Standard Web Checkout
  const handleBillingSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!billingForm.name || !billingForm.email) {
      alert('Please provide your name and email for the invoice.');
      return;
    }
    await handleRazorpayPay();
  };

  // Handle Step 3 Razorpay Payment
  const handleRazorpayPay = async (e) => {
    if (e) e.preventDefault();
    setPaying(true);
    setPaymentError('');

    try {
      if (typeof window === 'undefined' || !window.Razorpay) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }

      // 1. Create Razorpay order on backend using Authoritative Plan API
      const orderRes = await authFetch(`${API_URL}/api/plans/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          billingDetails: billingForm
        })
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.error || 'Failed to create plan payment order');
      }

      const activeKey = orderData.keyId || RAZORPAY_KEY_ID;

      // 2. Launch Razorpay Standard Checkout
      const options = {
        key: activeKey,
        amount: orderData.amountPaise,
        currency: orderData.currency || 'INR',
        name: 'ContaQue Technologies',
        description: `${orderData.planName || plan.name} Subscription Upgrade`,
        order_id: orderData.orderId,
        prefill: {
          name: billingForm.name || user?.name || '',
          email: billingForm.email || user?.email || '',
          contact: billingForm.phone || ''
        },
        theme: {
          color: '#1f1d19'
        },
        handler: async (response) => {
          try {
            // Strict pre-validation: ensure all required payment parameters are present
            if (!response || !response.razorpay_payment_id || !response.razorpay_order_id || !response.razorpay_signature) {
              throw new Error('Incomplete payment response received from payment gateway.');
            }

            // Cryptographic Signature & Razorpay Capture Verification on Backend
            const verifyRes = await authFetch(`${API_URL}/api/plans/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                billingDetails: billingForm
              })
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData?.success) {
              throw new Error(verifyData?.error || 'Payment verification failed on server');
            }

            const receipt = {
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              amount: `₹${(orderData.amountPaise / 100).toFixed(2)}`,
              planName: verifyData.planName || plan.name,
              activePlan: verifyData.plan || plan.id,
              date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
              email: billingForm.email || user?.email
            };

            setPaymentReceipt(receipt);
            setPaying(false);
            setStep(4); // Move to Payment Success

            // Refresh user state from authoritative backend
            if (activatePlan) {
              await activatePlan(verifyData.plan || plan.id, billingForm);
            }
          } catch (vErr) {
            console.error('[Razorpay Verify Error]:', vErr);
            setPaymentError(vErr.message || 'Payment verification failed on the server.');
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
            setPaymentError('Payment was cancelled or closed. Your subscription remains unchanged.');
            if (orderData?.orderId) {
              authFetch(`${API_URL}/api/plans/record-failure`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  order_id: orderData.orderId,
                  reason: 'Checkout window dismissed by user',
                  stage: 'modal_dismissed'
                })
              }).catch(() => {});
            }
          }
        }
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.on('payment.failed', (failResp) => {
        console.error('[Razorpay Failed]:', failResp.error);
        const errMsg = failResp.error?.description || 'Payment was declined or cancelled.';
        setPaymentError(`${errMsg} Your subscription remains unchanged.`);
        setPaying(false);
        if (orderData?.orderId) {
          authFetch(`${API_URL}/api/plans/record-failure`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              order_id: orderData.orderId,
              reason: errMsg,
              stage: 'payment_failed'
            })
          }).catch(() => {});
        }
      });

      rzpInstance.open();
    } catch (err) {
      console.error('Razorpay checkout error:', err);
      setPaymentError(err.message || 'Failed to initialize payment.');
      setPaying(false);
    }
  };

  const handleFinish = () => {
    if (onSuccess) {
      onSuccess(paymentReceipt);
    } else {
      onClose();
    }
  };

  if (!isOpen || !plan) return null;
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
            {!isAuthenticated && (
              <span className={`rp-crumb-dot ${step > 1 ? 'done' : step === 1 ? 'active' : ''}`} title="Account">1</span>
            )}
            <span className={`rp-crumb-dot ${step === 4 ? 'done' : step === 2 ? 'active' : ''}`} title="Billing">
              {!isAuthenticated ? '2' : '1'}
            </span>
            <span className={`rp-crumb-dot ${step === 4 ? 'done active' : ''}`} title="Plan Activated">✓</span>
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
              {/* Authenticated Account Banner */}
              {isAuthenticated && user && (
                <div style={{
                  background: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <User size={16} style={{ color: '#818cf8', flexShrink: 0 }} />
                    <div style={{ fontSize: '12.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: '#94a3b8' }}>Upgrading account: </span>
                      <strong style={{ color: '#ffffff' }}>{user.email}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setStep(1);
                      setBillingForm({
                        name: '',
                        email: '',
                        phone: '',
                        company: '',
                        address: '',
                        city: '',
                        country: 'India',
                        gstin: ''
                      });
                      setAccountForm({
                        name: '',
                        email: '',
                        password: '',
                        country: 'India',
                        isLoginMode: false
                      });
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#cbd5e1',
                      borderRadius: '8px',
                      padding: '5px 12px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.color = '#fca5a5'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.color = '#cbd5e1'; }}
                  >
                    Switch Account
                  </button>
                </div>
              )}

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
                    <label>
                      Billing Email *
                      {isAuthenticated && (
                        <span style={{ color: '#818cf8', fontSize: '11px', fontWeight: 'normal', marginLeft: '6px' }}>
                          (Linked to Account)
                        </span>
                      )}
                    </label>
                    <input
                      type="email"
                      className="rp-input"
                      value={isAuthenticated ? (user?.email || billingForm.email) : billingForm.email}
                      onChange={(e) => {
                        if (!isAuthenticated) {
                          setBillingForm(p => ({ ...p, email: e.target.value }));
                        }
                      }}
                      readOnly={isAuthenticated}
                      style={isAuthenticated ? { opacity: 0.85, cursor: 'not-allowed', backgroundColor: 'rgba(255,255,255,0.02)' } : {}}
                      title={isAuthenticated ? `Subscription tied to ${user?.email}. Click 'Switch Account' above to change.` : ''}
                      required
                    />
                  </div>
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

                {paymentError && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    marginBottom: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <AlertCircle size={15} />
                    <span>{paymentError}</span>
                  </div>
                )}

                <button type="submit" className="rp-primary-btn" disabled={paying}>
                  {paying ? (
                    <span>Opening Official Razorpay Checkout...</span>
                  ) : (
                    <>
                      <Lock size={15} />
                      <span>Proceed to Razorpay Checkout ({displayPrice})</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '12px', fontSize: '11.5px', color: '#94a3b8' }}>
                  <ShieldCheck size={13} style={{ color: '#0c83fe' }} />
                  <span>Secured by official Razorpay Web Checkout • 100% Encrypted</span>
                </div>
              </form>
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

              <h3 style={{ color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Sparkles size={20} style={{ color: '#10b981' }} />
                Plan Activated
              </h3>
              <p>
                Your <strong>{paymentReceipt?.planName || plan.name}</strong> subscription is now active!
              </p>

              {paymentReceipt && (
                <div className="rp-receipt-box">
                  <div className="rp-receipt-row">
                    <span>Active Plan:</span>
                    <strong style={{ color: '#818cf8', fontWeight: 800, fontSize: '14px' }}>
                      {paymentReceipt.planName || plan.name}
                    </strong>
                  </div>
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
