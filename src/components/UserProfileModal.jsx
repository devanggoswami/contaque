import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, User, ShieldCheck, CheckCircle2, Check, Lock, Zap, ArrowRight,
  TrendingUp, Sparkles, AlertCircle, RefreshCw, Crown, Calendar
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { getPlanExpiryInfo } from '../utils/planExpiry';
import RazorpayCheckoutModal from './RazorpayCheckoutModal';
import './UserProfileModal.css';

const PLAN_DEFINITIONS = {
  free: {
    id: 'free',
    name: 'Free Plan',
    badge: 'PAY AS YOU GO',
    tagline: 'Pay only for leads you generate',
    price: '₹0',
    period: '/month',
    icon: Zap,
    color: '#64748b',
    leadRates: [
      { engine: 'Google Business Index', rate: '₹1.30' },
      { engine: 'Social / Custom Discovery', rate: '₹1.00' },
      { engine: 'WhatsApp Radar', rate: '₹1.00' },
      { engine: 'Yellow Pages', rate: '₹0.60' },
      { engine: 'Yandex', rate: '₹1.70' },
    ],
    featuresTitle: 'Features Included:',
    features: [
      'No monthly fees or commitments',
      'Access to all 5 scraping engines',
      'WhatsApp phone status isolation',
      '1-Click Excel, CSV, PDF Export',
    ]
  },
  plus: {
    id: 'plus',
    name: 'Value Plus',
    badge: 'MOST POPULAR',
    tagline: 'Email outreach + discounted rates',
    price: '₹299',
    period: '/month',
    icon: Sparkles,
    color: '#6366f1',
    leadRates: [
      { engine: 'Google Business Index', rate: '₹1.10', rateUSD: '$0.011' },
      { engine: 'Social / Custom Discovery', rate: '₹0.80', rateUSD: '$0.008' },
      { engine: 'WhatsApp Radar', rate: '₹0.80', rateUSD: '$0.008' },
      { engine: 'Yellow Pages', rate: '₹0.50', rateUSD: '$0.005' },
      { engine: 'Yandex', rate: '₹1.50', rateUSD: '$0.016' },
    ],
    featuresTitle: '🔥 Features Included:',
    features: [
      '✓ Email Campaigns',
      '✓ 1 Gmail sending account',
      '✓ 400 emails/day',
      'Discounted per-lead scraping rates',
    ]
  },
  pack: {
    id: 'pack',
    name: 'Value Pack',
    badge: 'ALL-IN-ONE POWERHOUSE',
    tagline: 'Lowest rates + multi-account outreach',
    price: '₹499',
    period: '/month',
    icon: Crown,
    color: '#0ea5e9',
    leadRates: [
      { engine: 'Google Business Index', rate: '₹1.00', rateUSD: '$0.010' },
      { engine: 'Social / Custom Discovery', rate: '₹0.80', rateUSD: '$0.008' },
      { engine: 'WhatsApp Radar', rate: '₹0.80', rateUSD: '$0.008' },
      { engine: 'Yellow Pages', rate: '₹0.50', rateUSD: '$0.005' },
      { engine: 'Yandex', rate: '₹1.30', rateUSD: '$0.014' },
    ],
    featuresTitle: '🔥 Includes Outreach Suite:',
    features: [
      '✓ Email Campaigns',
      '✓ Up to 4 Gmail sending accounts',
      '✓ 1,600 emails/day',
      'Lowest rates across all 5 engines',
    ]
  }
};

const FEATURE_CATALOG = [
  {
    id: 'multi_engine',
    title: '5 Multi-Source Scraping Engines',
    description: 'Google Maps, Social Dorking, YellowPages, WhatsApp & Yandex',
    tiers: { free: true, pack: true, plus: true },
    category: 'Scraping'
  },
  {
    id: 'dedup_refund',
    title: 'Deduplication & Auto-Refunds',
    description: 'Zero charge on duplicate leads with instant wallet reimbursement',
    tiers: { free: true, pack: true, plus: true },
    category: 'Scraping'
  },
  {
    id: 'export_formats',
    title: '1-Click Export (CSV, Excel, PDF)',
    description: 'Unlimited exports formatted cleanly for any CRM or spreadsheet',
    tiers: { free: true, pack: true, plus: true },
    category: 'Scraping'
  },
  {
    id: 'parallel_workers',
    title: 'High-Speed Parallel Worker Threads',
    description: 'Extract hundreds of leads simultaneously without browser freezing',
    tiers: { free: false, pack: true, plus: true },
    category: 'Performance'
  },
  {
    id: 'whatsapp_radar',
    title: 'WhatsApp Phone Status Radar',
    description: 'Automatic detection and isolation of active WhatsApp business numbers',
    tiers: { free: false, pack: true, plus: true },
    category: 'Verification'
  },
  {
    id: 'email_campaigns',
    title: 'Bulk Cold Email Outreach Suite',
    description: 'Automated email sequence dispatching with HTML templates & attachments',
    tiers: { free: false, pack: true, plus: true },
    category: 'Outreach'
  },
  {
    id: 'smtp_rotation',
    title: 'Gmail Sending Accounts',
    description: 'Value Plus: 1 account (400 emails/day) • Value Pack: Up to 4 accounts (1,600 emails/day)',
    tiers: { free: false, pack: true, plus: true },
    category: 'Outreach'
  },
  {
    id: 'unified_inbox',
    title: '2-Way Unified Inbox & Reply Sync',
    description: 'Real-time IMAP email synchronization and reply tracking inside dashboard',
    tiers: { free: false, pack: true, plus: true },
    category: 'Outreach'
  },
  {
    id: 'priority_support',
    title: 'Priority 24/7 Dedicated Support',
    description: 'Direct priority assistance for custom query assistance and technical help',
    tiers: { free: false, pack: true, plus: true },
    category: 'Support'
  }
];

export default function UserProfileModal({ isOpen, onClose, onOpenRecharge }) {
  const { user, wallet, walletBalance, updateUserPlan, refreshWallet } = useAuth();
  const isUSD = user?.currency_preference === 'USD' || wallet?.currency === 'USD';
  const currSymbol = isUSD ? '$' : '₹';
  const [activeTab, setActiveTab] = useState('RATES_FEATURES'); // 'RATES_FEATURES' | 'ALL_PLANS'
  const [changingPlan, setChangingPlan] = useState(false);
  const [switchFeedback, setSwitchFeedback] = useState(null);
  const [checkoutPlan, setCheckoutPlan] = useState(null);

  const currentPlanKey = (wallet?.plan || user?.plan || 'plus').toLowerCase().includes('plus')
    ? 'plus'
    : (wallet?.plan || user?.plan || '').toLowerCase().includes('pack')
      ? 'pack'
      : 'free';

  const planInfo = PLAN_DEFINITIONS[currentPlanKey] || PLAN_DEFINITIONS.plus;
  const effectiveExpiresAt = user?.plan_expires_at || wallet?.plan_expires_at;
  const expiryInfo = getPlanExpiryInfo(currentPlanKey, effectiveExpiresAt);
  const rates = wallet?.rates || {
    maps: currentPlanKey === 'pack' ? 1.00 : currentPlanKey === 'plus' ? 1.10 : 1.30,
    dorking: currentPlanKey === 'pack' ? 0.80 : currentPlanKey === 'plus' ? 0.80 : 1.00,
    whatsapp: currentPlanKey === 'pack' ? 0.80 : currentPlanKey === 'plus' ? 0.80 : 1.00,
    yellowpages: currentPlanKey === 'pack' ? 0.50 : currentPlanKey === 'plus' ? 0.50 : 0.60,
    yandex: currentPlanKey === 'pack' ? 1.30 : currentPlanKey === 'plus' ? 1.50 : 1.70,
  };

  const handlePlanSwitch = async (targetPlanKey) => {
    if (targetPlanKey === currentPlanKey) return;
    if (targetPlanKey === 'free') {
      setChangingPlan(true);
      setSwitchFeedback(null);
      try {
        if (updateUserPlan) {
          const res = await updateUserPlan(targetPlanKey);
          if (res.success) {
            setSwitchFeedback(`Successfully switched to ${PLAN_DEFINITIONS[targetPlanKey].name}!`);
          } else {
            setSwitchFeedback(`Error: ${res.error || 'Failed to switch plan'}`);
          }
        } else {
          await refreshWallet();
        }
      } catch (err) {
        setSwitchFeedback(`Error: ${err.message}`);
      } finally {
        setChangingPlan(false);
      }
    } else {
      // Trigger unified checkout flow for paid plans
      setCheckoutPlan({
        id: targetPlanKey,
        name: PLAN_DEFINITIONS[targetPlanKey].name,
        price: {
          INR: PLAN_DEFINITIONS[targetPlanKey].price,
          USD: targetPlanKey === 'pack' ? '$5' : '$3'
        }
      });
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="profile-modal-backdrop" onClick={onClose}>
      <div className="profile-modal-dialog" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="profile-modal-header">
          <div className="profile-header-user">
            <div className="profile-avatar-box">
              <User size={22} />
            </div>
            <div className="profile-user-titles">
              <div className="profile-user-name-row">
                <h3>{user?.name || 'User Account'}</h3>
                <span className={`plan-badge-pill ${currentPlanKey}`}>
                  {planInfo.name}
                </span>
                <span className={`profile-plan-expiry-tag ${expiryInfo.status}`}>
                  <Calendar size={12} className="expiry-tag-icon" />
                  <span>{expiryInfo.displayText}</span>
                </span>
              </div>
              <span className="profile-user-email">{user?.email || ''}</span>
            </div>
          </div>

          <button className="profile-modal-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Status Bar */}
        <div className="profile-status-bar">
          <div className="status-stat-item">
            <span className="stat-label">Wallet Balance</span>
            <strong className="stat-val balance">
              {currSymbol}{Number(walletBalance || 0).toLocaleString(isUSD ? 'en-US' : 'en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </div>
          <div className="status-stat-item">
            <span className="stat-label">Active Plan</span>
            <strong className="stat-val plan">{planInfo.name}</strong>
            <span className={`stat-expiry-subtext ${expiryInfo.status}`}>
              {expiryInfo.displayText}
            </span>
          </div>
          <div className="status-stat-item">
            <span className="stat-label">Maps Rate</span>
            <strong className="stat-val rate">{currSymbol}{Number(rates.maps || (isUSD ? 0.012 : 1.00)).toFixed(isUSD ? 3 : 2)}/lead</strong>
          </div>
          <div className="status-stat-item">
            <span className="stat-label">Security & Session</span>
            <strong className="stat-val status">
              <ShieldCheck size={14} color="#059669" />
              <span>Verified JWT</span>
            </strong>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="profile-modal-tabs">
          <button 
            className={`profile-tab-btn ${activeTab === 'RATES_FEATURES' ? 'active' : ''}`}
            onClick={() => setActiveTab('RATES_FEATURES')}
          >
            My Rates & Feature Entitlements
          </button>
          <button 
            className={`profile-tab-btn ${activeTab === 'ALL_PLANS' ? 'active' : ''}`}
            onClick={() => setActiveTab('ALL_PLANS')}
          >
            Compare & Switch Plans
          </button>
        </div>

        {/* Tab 1: Current Rates & Feature Entitlements */}
        {activeTab === 'RATES_FEATURES' && (
          <div className="profile-tab-content">
            
            {/* Section 1: Active Per-Lead Scraping Rates */}
            <div className="modal-section-card">
              <div className="section-title-row">
                <h4>
                  <span className="section-title-icon">🏷️</span>
                  Your Per-Lead Scraping Rates ({planInfo.name})
                </h4>
                <span className="sub-rate-note">Deducted strictly for verified unique leads</span>
              </div>

              <div className="engine-rates-grid">
                <div className="engine-rate-tile">
                  <div className="engine-name-group">
                    <span className="engine-dot blue"></span>
                    <span className="engine-title">Google Business Index</span>
                  </div>
                  <div className="engine-price-tag">
                    <span className="price-main">{currSymbol}{Number(rates.maps || (isUSD ? (currentPlanKey === 'plus' ? 0.011 : currentPlanKey === 'pack' ? 0.010 : 0.014) : (currentPlanKey === 'plus' ? 1.10 : currentPlanKey === 'pack' ? 1.00 : 1.30))).toFixed(isUSD ? 3 : 2)}</span>
                    <span className="price-unit">/ lead</span>
                  </div>
                  <span className="engine-std-compare">Standard: {isUSD ? '$0.014' : '₹1.30'}</span>
                </div>

                <div className="engine-rate-tile">
                  <div className="engine-name-group">
                    <span className="engine-dot purple"></span>
                    <span className="engine-title">Social / Custom Discovery</span>
                  </div>
                  <div className="engine-price-tag">
                    <span className="price-main">{currSymbol}{Number(rates.dorking || (isUSD ? (currentPlanKey === 'free' ? 0.010 : 0.008) : (currentPlanKey === 'free' ? 1.00 : 0.80))).toFixed(isUSD ? 3 : 2)}</span>
                    <span className="price-unit">/ lead</span>
                  </div>
                  <span className="engine-std-compare">Standard: {isUSD ? '$0.010' : '₹1.00'}</span>
                </div>

                <div className="engine-rate-tile">
                  <div className="engine-name-group">
                    <span className="engine-dot green"></span>
                    <span className="engine-title">WhatsApp Radar</span>
                  </div>
                  <div className="engine-price-tag">
                    <span className="price-main">{currSymbol}{Number(rates.whatsapp || (isUSD ? (currentPlanKey === 'free' ? 0.010 : 0.008) : (currentPlanKey === 'free' ? 1.00 : 0.80))).toFixed(isUSD ? 3 : 2)}</span>
                    <span className="price-unit">/ lead</span>
                  </div>
                  <span className="engine-std-compare">Standard: {isUSD ? '$0.010' : '₹1.00'}</span>
                </div>

                <div className="engine-rate-tile">
                  <div className="engine-name-group">
                    <span className="engine-dot amber"></span>
                    <span className="engine-title">Yellow Pages</span>
                  </div>
                  <div className="engine-price-tag">
                    <span className="price-main">{currSymbol}{Number(rates.yellowpages || (isUSD ? (currentPlanKey === 'free' ? 0.006 : 0.005) : (currentPlanKey === 'free' ? 0.60 : 0.50))).toFixed(isUSD ? 3 : 2)}</span>
                    <span className="price-unit">/ lead</span>
                  </div>
                  <span className="engine-std-compare">Standard: {isUSD ? '$0.006' : '₹0.60'}</span>
                </div>

                <div className="engine-rate-tile">
                  <div className="engine-name-group">
                    <span className="engine-dot red"></span>
                    <span className="engine-title">Yandex</span>
                  </div>
                  <div className="engine-price-tag">
                    <span className="price-main">{currSymbol}{Number(rates.yandex || (isUSD ? (currentPlanKey === 'plus' ? 0.016 : currentPlanKey === 'pack' ? 0.014 : 0.018) : (currentPlanKey === 'plus' ? 1.50 : currentPlanKey === 'pack' ? 1.30 : 1.70))).toFixed(isUSD ? 3 : 2)}</span>
                    <span className="price-unit">/ lead</span>
                  </div>
                  <span className="engine-std-compare">Standard: {isUSD ? '$0.018' : '₹1.70'}</span>
                </div>
              </div>
            </div>

            {/* Section 2: Feature Lock/Unlock Entitlements */}
            <div className="modal-section-card">
              <div className="section-title-row">
                <h4>
                  <span className="section-title-icon">⚡</span>
                  Feature Entitlements & Status
                </h4>
                <span className="sub-rate-note">Based on your {planInfo.name}</span>
              </div>

              <div className="features-list-grid">
                {FEATURE_CATALOG.map((f) => {
                  const isUnlocked = f.tiers[currentPlanKey];
                  return (
                    <div 
                      key={f.id} 
                      className={`feature-status-item ${isUnlocked ? 'unlocked' : 'locked'}`}
                    >
                      <div className="feature-status-icon">
                        {isUnlocked ? (
                          <CheckCircle2 size={18} className="icon-unlocked" />
                        ) : (
                          <Lock size={18} className="icon-locked" />
                        )}
                      </div>
                      <div className="feature-info">
                        <div className="feature-header-line">
                          <span className="feature-title">{f.title}</span>
                          <span className={`feature-pill ${isUnlocked ? 'pill-unlocked' : 'pill-locked'}`}>
                            {isUnlocked ? 'UNLOCKED' : 'LOCKED'}
                          </span>
                        </div>
                        <p className="feature-desc">{f.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Compare & Switch Plans */}
        {activeTab === 'ALL_PLANS' && (
          <div className="profile-tab-content">
            {switchFeedback && (
              <div className="plan-switch-alert">
                <span>{switchFeedback}</span>
              </div>
            )}

            <div className="plans-comparison-grid">
              {Object.values(PLAN_DEFINITIONS).map((p) => {
                const isCurrent = p.id === currentPlanKey;
                const IconComponent = p.icon;
                return (
                  <div 
                    key={p.id} 
                    className={`plan-card-option ${isCurrent ? 'active-plan' : ''} ${p.id === 'pack' ? 'pack-card' : ''} ${p.id === 'plus' ? 'plus-card' : ''}`}
                  >
                    {isCurrent && (
                      <div className="current-plan-ribbon-wrap">
                        <div className="current-plan-ribbon">
                          <span>YOUR ACTIVE PLAN</span>
                        </div>
                        <div className={`plan-card-expiry-tag ${expiryInfo.status}`}>
                          {expiryInfo.displayText}
                        </div>
                      </div>
                    )}

                    {/* Card Top Row: Name + Badge */}
                    <div className="plan-card-top-header">
                      <div className="plan-title-with-icon">
                        <div className="plan-icon-wrapper" style={{ color: p.color }}>
                          <IconComponent size={20} />
                        </div>
                        <h4 className="plan-name-h">{p.name}</h4>
                      </div>
                      <span className={`plan-badge-inline ${p.id}`}>
                        {p.badge}
                      </span>
                    </div>

                    {/* Price and Tagline */}
                    <div className="plan-price-block">
                      <div className="plan-price-number-row">
                        <span className="price-big">{isUSD ? (p.id === 'pack' ? '$5' : p.id === 'plus' ? '$3' : '$0') : p.price}</span>
                        <span className="price-sub">{p.period}</span>
                      </div>
                      <p className="plan-tagline-p">• {p.tagline}</p>
                    </div>

                    {/* Engine Rates Breakdown Table */}
                    <div className="plan-engine-rates-table">
                      <div className="plan-rates-header">
                        <span>ENGINE</span>
                        <span>PER LEAD</span>
                      </div>
                      <div className="plan-rates-body">
                        {p.leadRates.map((r, rIdx) => (
                          <div key={rIdx} className="plan-rate-row">
                            <span className="plan-engine-name">{r.engine}</span>
                            <strong className="plan-engine-cost">{isUSD ? (r.rateUSD || r.rate) : r.rate}</strong>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Features Included Checklist */}
                    <div className="plan-features-block">
                      <div className="plan-features-heading">
                        {p.featuresTitle}
                      </div>
                      <ul className="plan-features-list">
                        {p.features.map((feat, fIdx) => (
                          <li key={fIdx} className="plan-feature-item">
                            <Check size={14} className={`plan-feature-check ${p.id === 'plus' ? 'plus-check' : 'std-check'}`} />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Action Area */}
                    <div className="plan-action-area">
                      {isCurrent ? (
                        <button className="plan-select-btn current" disabled>
                          <Check size={16} />
                          <span>Current Plan</span>
                        </button>
                      ) : (
                        <button 
                          className={`plan-select-btn ${p.id === 'plus' ? 'plus-action' : p.id === 'pack' ? 'pack-action' : ''}`}
                          onClick={() => handlePlanSwitch(p.id)}
                          disabled={changingPlan}
                        >
                          {changingPlan ? (
                            <RefreshCw size={15} className="spinning" />
                          ) : (
                            <ArrowRight size={15} />
                          )}
                          <span>Switch to {p.name}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="profile-modal-footer">
          <div className="footer-left-help" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span>Need more leads or custom enterprise volume? Contact info@klyrovainc.com</span>
            <div style={{ display: 'flex', gap: '8px', fontSize: '11.5px', color: '#64748b' }}>
              <a href="/terms" target="_blank" rel="noreferrer" style={{ color: '#818cf8', textDecoration: 'underline' }}>Terms</a>
              <span>•</span>
              <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: '#818cf8', textDecoration: 'underline' }}>Privacy Policy</a>
              <span>•</span>
              <a href="/refund-policy" target="_blank" rel="noreferrer" style={{ color: '#818cf8', textDecoration: 'underline' }}>Refund Policy</a>
            </div>
          </div>
          <div className="footer-right-actions">
            {onOpenRecharge && (
              <button 
                type="button" 
                className="footer-topup-btn"
                onClick={() => {
                  onClose();
                  onOpenRecharge();
                }}
              >
                + Add Wallet Balance
              </button>
            )}
            <button type="button" className="footer-done-btn" onClick={onClose}>
              Done
            </button>
          </div>
        </div>

      </div>

      {checkoutPlan && (
        <RazorpayCheckoutModal
          isOpen={!!checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          plan={checkoutPlan}
          currency={user?.currency_preference || 'INR'}
          onSuccess={async () => {
            setCheckoutPlan(null);
            if (refreshWallet) await refreshWallet();
          }}
        />
      )}
    </div>,
    document.body
  );
}
