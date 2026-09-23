import React, { useState, useEffect } from 'react';
import { X, Gift, CheckCircle2, ArrowRight, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import './ReferralModal.css';

export default function ReferralModal({ isOpen, onClose, onSuccess }) {
  const { user, authFetch, refreshWallet } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Prefill pending referral code from sessionStorage or query param if available
  useEffect(() => {
    if (isOpen) {
      const savedCode = sessionStorage.getItem('pending_referral_code');
      if (savedCode) {
        setCode(savedCode.trim().toUpperCase());
      }
      setError('');
      setSuccessMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isUSD = user?.country && user.country !== 'India';
  const rewardLabel = isUSD ? '$2' : '₹100';

  const handleDismiss = async () => {
    try {
      // Notify backend that user dismissed the prompt
      await authFetch(`${API_URL}/api/referral/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch {
      // Quiet ignore on network failure
    }
    // Clear pending session code
    sessionStorage.removeItem('pending_referral_code');
    onClose();
  };

  const handleContinue = async (e) => {
    if (e) e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setError('Please enter a referral code to continue.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await authFetch(`${API_URL}/api/referral/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referral_code: cleanCode })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Invalid referral code. Please check and try again.');
        setLoading(false);
        return;
      }

      // Successful claim!
      sessionStorage.removeItem('pending_referral_code');
      setSuccessMsg(data.message || `Referral code applied! ${rewardLabel} has been credited to your wallet.`);
      setLoading(false);

      if (refreshWallet) {
        await refreshWallet();
      }

      if (onSuccess) {
        onSuccess(data);
      }

      // Auto-close modal after 1.5 seconds of celebrating success
      setTimeout(() => {
        onClose();
      }, 1600);

    } catch (err) {
      setError('Unable to validate referral code right now. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="referral-modal-overlay" onClick={handleDismiss}>
      <div className="referral-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Close / X button */}
        <button 
          className="referral-modal-close" 
          onClick={handleDismiss}
          aria-label="Close popup"
        >
          <X size={20} />
        </button>

        <div className="referral-modal-header">
          <div className="referral-modal-badge-icon">
            <Gift size={28} className="referral-gift-icon" />
          </div>
          <h2 className="referral-modal-title">Have a referral code?</h2>
          <p className="referral-modal-desc">
            Enter your friend's invite code to get <span className="referral-highlight">{rewardLabel} free wallet credits</span> instantly added to your account!
          </p>
        </div>

        {successMsg ? (
          <div className="referral-modal-success-state">
            <div className="referral-success-icon-wrap">
              <CheckCircle2 size={44} className="referral-success-icon" />
            </div>
            <h3 className="referral-success-title">Reward Claimed!</h3>
            <p className="referral-success-text">{successMsg}</p>
          </div>
        ) : (
          <form className="referral-modal-form" onSubmit={handleContinue}>
            <div className="referral-input-group">
              <label htmlFor="referralCodeInput" className="referral-input-label">
                Referral Code
              </label>
              <div className="referral-input-wrapper">
                <input
                  id="referralCodeInput"
                  type="text"
                  placeholder="e.g. CQ8K2M4P"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    if (error) setError('');
                  }}
                  autoFocus
                  maxLength={24}
                  disabled={loading}
                  className={`referral-input ${error ? 'input-error' : ''}`}
                />
              </div>
              {error && (
                <div className="referral-error-banner">
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="referral-modal-actions">
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="referral-continue-btn"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="spin-icon" />
                    <span>Validating...</span>
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={handleDismiss}
                className="referral-skip-btn"
                disabled={loading}
              >
                I don't have a code
              </button>
            </div>
          </form>
        )}

        <div className="referral-modal-footer">
          <Sparkles size={13} className="referral-footer-sparkle" />
          <span>Both you and your friend receive {rewardLabel} upon verification</span>
        </div>
      </div>
    </div>
  );
}
