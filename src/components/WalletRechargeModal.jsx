import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Wallet, ShieldCheck, Zap, Sparkles, CheckCircle2, 
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

export default function WalletRechargeModal({ isOpen, onClose, initialAmount = null, onSuccess }) {
  if (!isOpen) return null;

  const { user, token, walletBalance, refreshWallet, authFetch } = useAuth();
  const [selectedAmount, setSelectedAmount] = useState(initialAmount ? Math.max(initialAmount, 100) : 500);
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successData, setSuccessData] = useState(null);

  const activeAmount = customAmount ? parseFloat(customAmount) || 0 : selectedAmount;

  // Approximate lead capacity estimate based on Google Maps rate (₹0.90 to ₹1.30)
  const approxLeads = Math.floor(activeAmount / 1.10);

  const handlePresetClick = (amt) => {
    setSelectedAmount(amt);
    setCustomAmount('');
    setError(null);
  };

  const handleCustomChange = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomAmount(val);
    setSelectedAmount(null);
    setError(null);
  };

  const handleProceedRecharge = async () => {
    if (activeAmount < 10) {
      setError('Minimum recharge amount is ₹10.00');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Create Razorpay order on backend
      const orderRes = await authFetch(`${API_URL}/api/wallet/recharge/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: activeAmount })
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.error || 'Failed to initialize recharge order');
      }

      // 2. Launch Razorpay native frame
      if (!window.Razorpay) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }

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
            // 3. Server-side verification with cryptographic signature check
            const verifyRes = await authFetch(`${API_URL}/api/wallet/recharge/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                amount: activeAmount
              })
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              throw new Error(verifyData.error || 'Payment verification failed');
            }

            // 4. Refresh wallet balance across the app
            await refreshWallet();

            setSuccessData({
              amount: activeAmount,
              newBalance: verifyData.newBalance,
              paymentId: response.razorpay_payment_id
            });

            if (onSuccess) {
              onSuccess(verifyData.newBalance);
            }
          } catch (vErr) {
            setError(vErr.message || 'Payment verification failed on server');
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp) => {
        setError(resp.error?.description || 'Payment failed or was cancelled');
        setLoading(false);
      });
      rzp.open();

    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
      setLoading(false);
    }
  };

  if (typeof document === 'undefined') return null;

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
              An amount of <strong>₹{successData.amount.toFixed(2)}</strong> has been credited to your prepaid account.
            </p>
            <div className="wallet-balance-banner" style={{ width: '100%' }}>
              <span>Updated Balance:</span>
              <strong>₹{successData.newBalance.toFixed(2)}</strong>
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
              <strong>₹{walletBalance.toFixed(2)}</strong>
            </div>

            {/* Presets */}
            <div>
              <label className="section-sub-label">Select Top-Up Amount:</label>
              <div className="wallet-preset-grid">
                {PRESET_AMOUNTS.map((item) => (
                  <button
                    key={item.amount}
                    type="button"
                    className={`wallet-preset-btn ${selectedAmount === item.amount ? 'active' : ''}`}
                    onClick={() => handlePresetClick(item.amount)}
                  >
                    <span>{item.label}</span>
                    <span className="lead-hint">~{Math.floor(item.amount / 1.10)} leads</span>
                  </button>
                ))}
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
                  placeholder="e.g. 750"
                  value={customAmount}
                  onChange={handleCustomChange}
                />
              </div>
            </div>

            {/* Yield preview */}
            {activeAmount > 0 && (
              <div className="wallet-yield-preview">
                <Sparkles size={16} style={{ flexShrink: 0 }} />
                <span>
                  <strong>₹{activeAmount.toLocaleString()}</strong> top-up powers extraction for approximately{' '}
                  <strong>~{approxLeads.toLocaleString()}</strong> verified B2B leads.
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
              className="wallet-pay-btn"
              onClick={handleProceedRecharge}
              disabled={loading || activeAmount < 10}
            >
              {loading ? (
                <>
                  <RefreshCw size={17} className="animate-spin" />
                  <span>Connecting to Gateway...</span>
                </>
              ) : (
                <>
                  <Lock size={17} />
                  <span>Proceed to Pay ₹{activeAmount.toLocaleString()}</span>
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
