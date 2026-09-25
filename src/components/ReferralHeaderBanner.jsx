import React, { useState, useEffect } from 'react';
import { Gift, CheckCircle2, AlertCircle, X, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import './ReferralHeaderBanner.css';

const STORAGE_KEY = 'lead_os_auth_session';

export default function ReferralHeaderBanner({ onClaimSuccess }) {
  const { user, setUser, authFetch, refreshWallet } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [dismissed, setDismissed] = useState(false);

  // Check if locally dismissed
  const isLocallyDismissed = user?.id 
    ? localStorage.getItem(`referral_dismissed_${user.id}`) === 'true' 
    : false;

  // Auto-fill pending referral code from session storage if present
  useEffect(() => {
    const savedCode = sessionStorage.getItem('pending_referral_code');
    if (savedCode) {
      setCode(savedCode.trim().toUpperCase());
    }
  }, []);

  // Do not render if user already claimed, already dismissed (backend or local), or dismissed in current session
  if (
    dismissed || 
    isLocallyDismissed || 
    !user || 
    user.referral_claimed || 
    user.referral_prompt_dismissed
  ) {
    return null;
  }

  const isUSD = user?.currency_preference === 'USD' || (user?.country && user.country !== 'India');
  const rewardLabel = isUSD ? '$2' : '₹100';

  const handleDismiss = async () => {
    setDismissed(true);
    if (user?.id) {
      localStorage.setItem(`referral_dismissed_${user.id}`, 'true');
    }
    sessionStorage.removeItem('pending_referral_code');

    // Update in-memory user and localStorage session
    if (setUser) {
      setUser(prev => {
        if (!prev) return prev;
        const upd = { ...prev, referral_prompt_dismissed: true };
        try {
          const s = localStorage.getItem(STORAGE_KEY);
          if (s) {
            const parsed = JSON.parse(s);
            parsed.user = upd;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          }
        } catch {}
        return upd;
      });
    }

    try {
      await authFetch(`${API_URL}/api/referral/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch {
      // Quiet ignore on network failure
    }
  };

  const handleClaim = async (e) => {
    if (e) e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setError('Please enter a referral code.');
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

      sessionStorage.removeItem('pending_referral_code');
      setSuccessMsg(data.message || `Referral code applied! ${rewardLabel} credited to your wallet.`);
      setLoading(false);

      if (user?.id) {
        localStorage.setItem(`referral_dismissed_${user.id}`, 'true');
      }

      // Update in-memory user and localStorage session
      if (setUser) {
        setUser(prev => {
          if (!prev) return prev;
          const upd = { ...prev, referral_claimed: true, referral_prompt_dismissed: true };
          try {
            const s = localStorage.getItem(STORAGE_KEY);
            if (s) {
              const parsed = JSON.parse(s);
              parsed.user = upd;
              localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            }
          } catch {}
          return upd;
        });
      }

      if (refreshWallet) {
        await refreshWallet();
      }

      if (onClaimSuccess) {
        onClaimSuccess(data);
      }

      // Auto-hide banner after showing success for 2.5 seconds
      setTimeout(() => {
        setDismissed(true);
      }, 2500);

    } catch (err) {
      setError('Unable to validate referral code right now. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="referral-banner-container animate-slide-down" id="referral-header-banner">
      <div className="referral-banner-main">
        {/* Left: Icon & Pitch */}
        <div className="referral-banner-info">
          <div className="referral-banner-icon-badge">
            <Gift size={18} className="referral-gift-glow" />
          </div>
          <div className="referral-banner-text">
            <div className="referral-banner-headline">
              <span>Have a referral code?</span>
              <span className="referral-banner-tag">EARN {rewardLabel} BONUS</span>
            </div>
            <p className="referral-banner-subtext">
              Enter your friend's invite code to get <strong>{rewardLabel} free wallet credits</strong> added instantly.
            </p>
          </div>
        </div>

        {/* Right: Inline Input Form or Success State */}
        {successMsg ? (
          <div className="referral-banner-success">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        ) : (
          <form className="referral-banner-form" onSubmit={handleClaim}>
            <div className="referral-banner-input-wrap">
              <input
                type="text"
                className={`referral-banner-input ${error ? 'has-error' : ''}`}
                placeholder="e.g. CQ8K2M4P"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  if (error) setError('');
                }}
                maxLength={24}
                disabled={loading}
                aria-label="Referral Code"
              />
              <button
                type="submit"
                className="referral-banner-apply-btn"
                disabled={loading || !code.trim()}
              >
                {loading ? (
                  <Loader2 size={14} className="spin-icon" />
                ) : (
                  <>
                    <span>Apply</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
            {error && (
              <div className="referral-banner-error" role="alert">
                <AlertCircle size={13} />
                <span>{error}</span>
              </div>
            )}
          </form>
        )}

        {/* Close Button */}
        <button
          type="button"
          className="referral-banner-close-btn"
          onClick={handleDismiss}
          title="Dismiss referral prompt"
          aria-label="Close referral banner"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
