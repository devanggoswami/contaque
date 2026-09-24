import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Globe, Check, ArrowRight, ShieldCheck, CreditCard, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './CurrencySelectionModal.css';

export default function CurrencySelectionModal({ isOpen }) {
  const { user, setCurrencyPreference } = useAuth();
  const [selectedCurrency, setSelectedCurrency] = useState('INR');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    const res = await setCurrencyPreference(selectedCurrency);
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Failed to save currency preference. Please try again.');
    }
  };

  return createPortal(
    <div className="currency-modal-backdrop animate-fade-in" id="currency-selection-modal">
      <div className="currency-modal-card animate-scale-up" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="currency-modal-header">
          <div className="currency-modal-icon-badge">
            <Globe size={24} className="text-primary-glow" />
          </div>
          <h2 className="currency-modal-title">Choose Your Currency</h2>
          <p className="currency-modal-subtitle">
            Please select your preferred billing currency. This determines subscription pricing and wallet top-ups.
          </p>
        </div>

        {error && (
          <div className="currency-modal-error">
            <span>{error}</span>
          </div>
        )}

        {/* Currency Cards Selection */}
        <div className="currency-options-grid">
          {/* Option: INR */}
          <div 
            className={`currency-option-card ${selectedCurrency === 'INR' ? 'active' : ''}`}
            onClick={() => setSelectedCurrency('INR')}
            role="button"
            tabIndex={0}
          >
            <div className="currency-option-indicator">
              {selectedCurrency === 'INR' && <Check size={14} className="check-icon" />}
            </div>
            <div className="currency-option-main">
              <div className="currency-code-badge">
                <span className="currency-symbol">₹</span>
                <span className="currency-name">INR (Indian Rupee)</span>
              </div>
              <div className="currency-plan-pricing">
                <div className="currency-plan-line">
                  <span className="plan-name">Value Plus:</span>
                  <strong className="plan-price">₹299/mo</strong>
                </div>
                <div className="currency-plan-line">
                  <span className="plan-name">Value Pack:</span>
                  <strong className="plan-price">₹499/mo</strong>
                </div>
              </div>
              <div className="currency-trial-badge">
                <Sparkles size={11} />
                <span>Includes ₹50 Free Credits</span>
              </div>
              <div className="currency-payment-methods">
                <CreditCard size={12} />
                <span>UPI, Domestic Cards, Netbanking</span>
              </div>
            </div>
          </div>

          {/* Option: USD */}
          <div 
            className={`currency-option-card ${selectedCurrency === 'USD' ? 'active' : ''}`}
            onClick={() => setSelectedCurrency('USD')}
            role="button"
            tabIndex={0}
          >
            <div className="currency-option-indicator">
              {selectedCurrency === 'USD' && <Check size={14} className="check-icon" />}
            </div>
            <div className="currency-option-main">
              <div className="currency-code-badge">
                <span className="currency-symbol">$</span>
                <span className="currency-name">USD (US Dollar)</span>
              </div>
              <div className="currency-plan-pricing">
                <div className="currency-plan-line">
                  <span className="plan-name">Value Plus:</span>
                  <strong className="plan-price">$3/mo</strong>
                </div>
                <div className="currency-plan-line">
                  <span className="plan-name">Value Pack:</span>
                  <strong className="plan-price">$5/mo</strong>
                </div>
              </div>
              <div className="currency-trial-badge">
                <Sparkles size={11} />
                <span>Includes $2 Free Credits</span>
              </div>
              <div className="currency-payment-methods">
                <Globe size={12} />
                <span>International Cards (Global Visa, MC, Amex)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Isolation Callout */}
        <div className="currency-modal-note">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Independent fixed rates • Zero live conversion fee • Saved to your profile</span>
        </div>

        {/* Action Button */}
        <button
          type="button"
          className="currency-confirm-btn"
          onClick={handleConfirm}
          disabled={loading}
        >
          {loading ? (
            <span>Saving Preference...</span>
          ) : (
            <>
              <span>Continue with {selectedCurrency === 'USD' ? 'USD ($)' : 'INR (₹)'}</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>,
    document.body
  );
}
