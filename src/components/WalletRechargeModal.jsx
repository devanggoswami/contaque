import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Wallet, ShieldCheck, Sparkles, CheckCircle2, 
  ArrowRight, AlertCircle, RefreshCw, Lock 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import './WalletRechargeModal.css';

const PRESET_AMOUNTS = [
  { amount: 250, label: '₹250' },
  { amount: 500, label: '₹500' },
  { amount: 1000, label: '₹1,000' },
  { amount: 2500, label: '₹2,500' },
  { amount: 5000, label: '₹5,000' }
];

const parseInitialAmountStr = (init) => {
  if (init !== null && init !== undefined && String(init).trim() !== '') {
    const num = Number(init);
    if (!isNaN(num) && num > 0) {
      return String(Math.max(Math.round(num), 100));
    }
  }
  return '500';
};

export default function WalletRechargeModal({ isOpen, onClose, initialAmount = null, onSuccess }) {
  const { user, walletBalance, refreshWallet, authFetch } = useAuth();
  
  // Amount kept strictly as a string state while typing
  const [amount, setAmount] = useState(() => parseInitialAmountStr(initialAmount));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successData, setSuccessData] = useState(null);

  // Sync state whenever modal opens or initialAmount changes
  useEffect(() => {
    if (isOpen) {
      setAmount(parseInitialAmountStr(initialAmount));
      setError(null);
      setSuccessData(null);
      setLoading(false);
    }
  }, [isOpen, initialAmount]);

  // Handle preset selection
  const handlePresetClick = (presetNum) => {
    setAmount(String(presetNum));
    setError(null);
  };

  // Handle typing: keeps string state, allows empty string without calling Number() or parseInt()
  const handleAmountChange = (e) => {
    const rawVal = e.target.value;
    // Allow empty string when user clears or backspaces
    if (rawVal === '') {
      setAmount('');
      setError(null);
      return;
    }
    // Only allow whole digits
    const digitsOnly = rawVal.replace(/[^0-9]/g, '');
    setAmount(digitsOnly);
    setError(null);
  };

  // Safe display derivations (Never call Number()/parseInt() when empty or invalid)
  const trimmed = typeof amount === 'string' ? amount.trim() : String(amount || '').trim();
  const hasDigits = trimmed.length > 0 && /^[0-9]+$/.test(trimmed);

  let previewNumeric = null;
  let approxLeads = 0;
  let formattedAmount = '';

  if (hasDigits) {
    const parsed = parseInt(trimmed, 10);
    if (!isNaN(parsed) && parsed >= 10) {
      previewNumeric = parsed;
      approxLeads = Math.round(parsed / 1.10);
      formattedAmount = parsed.toLocaleString('en-IN');
    }
  }

  // Handle payment initiation with strict validation and error handling
  const handleProceedRecharge = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (loading) return;

    try {
      setError(null);

      // Rule: Never call Number(), parseInt(), payment API, or Razorpay checkout when input is empty or invalid
      const currentVal = typeof amount === 'string' ? amount.trim() : String(amount || '').trim();

      if (!currentVal) {
        setError('Minimum amount is ₹10');
        return;
      }

      if (!/^[0-9]+$/.test(currentVal)) {
        setError('Minimum amount is ₹10');
        return;
      }

      // Convert to number strictly on submit
      const numericAmount = parseInt(currentVal, 10);
      if (isNaN(numericAmount) || numericAmount < 10) {
        setError('Minimum amount is ₹10');
        return;
      }

      setLoading(true);

      // 1. Create Razorpay order on backend
      const orderRes = await authFetch(`${API_URL}/api/wallet/recharge/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numericAmount })
      });

      let orderData = null;
      try {
        orderData = await orderRes.json();
      } catch (_) {
        orderData = {};
      }

      if (!orderRes.ok) {
        throw new Error(orderData?.error || `Order creation failed (HTTP ${orderRes.status})`);
      }

      if (!orderData?.orderId || !orderData?.keyId) {
        throw new Error('Payment order could not be generated. Please try again.');
      }

      // 2. Ensure Razorpay SDK is loaded
      if (typeof window === 'undefined' || !window.Razorpay) {
        throw new Error('Razorpay payment gateway failed to load. Please verify your connection or disable ad blockers and try again.');
      }

      // 3. Configure Razorpay checkout
      const options = {
        key: orderData.keyId,
        amount: Math.round(orderData.amount * 100),
        currency: orderData.currency || 'INR',
        name: 'ContaQue Technologies',
        description: `Wallet Balance Top-Up: ₹${orderData.amount}`,
        order_id: orderData.orderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || ''
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

            setLoading(true);
            const verifyRes = await authFetch(`${API_URL}/api/wallet/recharge/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                amount: numericAmount
              })
            });

            let verifyData = null;
            try {
              verifyData = await verifyRes.json();
            } catch (_) {
              verifyData = {};
            }

            if (!verifyRes.ok || !verifyData?.success) {
              throw new Error(verifyData?.error || 'Payment verification failed on server');
            }

            // ONLY after successful backend verification: execute existing actions
            if (refreshWallet) {
              await refreshWallet().catch((wErr) => {
                console.warn('Wallet refresh failed:', wErr);
              });
            }

            setSuccessData({
              amount: numericAmount,
              newBalance: typeof verifyData?.newBalance === 'number' 
                ? verifyData.newBalance 
                : ((Number(walletBalance) || 0) + numericAmount),
              paymentId: response.razorpay_payment_id
            });

            if (onSuccess) {
              onSuccess(verifyData?.newBalance);
            }
          } catch (vErr) {
            console.error('Payment verification error:', vErr);
            setError(vErr.message || 'Payment verification failed. If amount was deducted, please contact support.');
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            setSuccessData(null);
          }
        }
      };

      let rzp = null;
      try {
        rzp = new window.Razorpay(options);
      } catch (initErr) {
        throw new Error(`Failed to initialize payment gateway: ${initErr.message}`);
      }

      rzp.on('payment.failed', (resp) => {
        setError(resp.error?.description || 'Payment was cancelled or failed');
        setLoading(false);
      });

      rzp.open();

    } catch (err) {
      console.error('Recharge initiation error:', err);
      setError(err.message || 'An unexpected error occurred while initiating recharge');
      setLoading(false);
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="wallet-modal-overlay" onClick={onClose}>
      <div className="wallet-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="wallet-modal-header">
          <div className="wallet-modal-title-group">
            <div className="wallet-modal-icon-glow">
              <Wallet size={20} />
            </div>
            <div>
              <h2>Recharge Wallet</h2>
              <p>Top up your prepaid balance for lead extraction</p>
            </div>
          </div>
          <button className="wallet-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        {successData ? (
          <div className="wallet-success-card">
            <div className="wallet-success-icon">
              <CheckCircle2 size={36} />
            </div>
            <h3>Wallet Successfully Recharged!</h3>
            <p>
              An amount of <strong>₹{Number(successData?.amount || 0).toFixed(2)}</strong> has been credited to your prepaid account.
            </p>
            <div className="wallet-balance-banner" style={{ width: '100%' }}>
              <span>Updated Balance:</span>
              <strong>₹{Number(successData?.newBalance || 0).toFixed(2)}</strong>
            </div>
            <button className="wallet-pay-btn" style={{ width: '100%' }} onClick={onClose}>
              Continue to Dashboard <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          <div className="wallet-modal-body">
            {/* Current Balance Banner */}
            <div className="wallet-balance-banner">
              <span>Current Available Balance:</span>
              <strong>₹{Number(walletBalance || 0).toFixed(2)}</strong>
            </div>

            {/* Presets */}
            <div>
              <label className="section-sub-label">Select Top-Up Amount:</label>
              <div className="wallet-preset-grid">
                {PRESET_AMOUNTS.map((item) => {
                  const isPresetActive = trimmed === String(item.amount);
                  return (
                    <button
                      key={item.amount}
                      type="button"
                      className={`wallet-preset-btn ${isPresetActive ? 'active' : ''}`}
                      onClick={() => handlePresetClick(item.amount)}
                    >
                      <span>{item.label}</span>
                      <span className="lead-hint">~{Math.round(item.amount / 1.10)} leads</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Amount */}
            <div className="wallet-custom-input-wrap">
              <label htmlFor="custom-wallet-input">Or enter custom amount (INR):</label>
              <div className="wallet-input-container">
                <span className="wallet-currency-prefix">₹</span>
                <input
                  id="custom-wallet-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 750"
                  value={amount}
                  onChange={handleAmountChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleProceedRecharge(e);
                    }
                  }}
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Yield preview */}
            {previewNumeric !== null && (
              <div className="wallet-yield-preview">
                <Sparkles size={16} style={{ flexShrink: 0 }} />
                <span>
                  <strong>₹{formattedAmount}</strong> top-up powers extraction for approximately{' '}
                  <strong>~{approxLeads.toLocaleString('en-IN')}</strong> verified B2B leads.
                </span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="wallet-error-box">
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Pay Button */}
            <button
              type="button"
              className="wallet-pay-btn"
              onClick={handleProceedRecharge}
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw size={17} className="animate-spin" />
                  <span>Connecting to Gateway...</span>
                </>
              ) : (
                <>
                  <Lock size={17} />
                  <span>
                    {previewNumeric !== null 
                      ? `Proceed to Pay ₹${formattedAmount}` 
                      : 'Proceed to Pay'}
                  </span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Security Footer */}
        <div className="wallet-security-footer">
          <ShieldCheck size={14} />
          <span>Secured with 256-Bit SSL • PCI-DSS Certified Gateway</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

