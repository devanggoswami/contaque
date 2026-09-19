import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, User, ShieldCheck, CheckCircle2, Lock, Zap, ArrowRight,
  TrendingUp, Sparkles, AlertCircle, RefreshCw, Crown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import './UserProfileModal.css';

const PLAN_DEFINITIONS = {
  free: {
    id: 'free',
    name: 'Free Starter',
    badge: 'PAY AS YOU GO',
    tagline: 'Standard rates, pay only for what you extract',
    price: '₹0',
    period: 'forever',
    icon: Zap,
    color: '#64748b',
    bgLight: '#f8fafc',
    borderLight: '#e2e8f0',
    maxBatch: '50 leads / job',
    speed: '1x Standard'
  },
  pack: {
    id: 'pack',
    name: 'Value Pack',
    badge: 'MOST POPULAR',
    tagline: 'Discounted per-lead rates + high-speed parallel workers',
    price: '₹299',
    period: '/month',
    icon: Sparkles,
    color: '#4f46e5',
    bgLight: '#eef2ff',
    borderLight: '#c7d2fe',
    maxBatch: '250 leads / job',
    speed: '2x Fast Parallel'
  },
  plus: {
    id: 'plus',
    name: 'Value Plus',
    badge: 'PRO UNLIMITED',
    tagline: 'Lowest per-lead rates + full cold email & unified inbox suite',
    price: '₹499',
    period: '/month',
    icon: Crown,
    color: '#b45309',
    bgLight: '#fef3c7',
    borderLight: '#fde68a',
    maxBatch: 'Unlimited',
    speed: '4x Ultra Fast'
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
    tiers: { free: false, pack: false, plus: true },
    category: 'Outreach'
  },
  {
    id: 'smtp_rotation',
    title: 'Multi-Account SMTP Rotation',
    description: 'Safely rotate multiple Gmail/custom SMTP accounts up to 1,600 emails/day',
    tiers: { free: false, pack: false, plus: true },
    category: 'Outreach'
  },
  {
    id: 'unified_inbox',
    title: '2-Way Unified Inbox & Reply Sync',
    description: 'Real-time IMAP email synchronization and reply tracking inside dashboard',
    tiers: { free: false, pack: false, plus: true },
    category: 'Outreach'
  },
  {
    id: 'priority_support',
    title: 'Priority 24/7 Dedicated Support',
    description: 'Direct priority assistance for custom query assistance and technical help',
    tiers: { free: false, pack: false, plus: true },
    category: 'Support'
  }
];

export default function UserProfileModal({ isOpen, onClose, onOpenRecharge }) {
  if (!isOpen) return null;

  const { user, wallet, walletBalance, updateUserPlan, refreshWallet } = useAuth();
  const [activeTab, setActiveTab] = useState('RATES_FEATURES'); // 'RATES_FEATURES' | 'ALL_PLANS'
  const [changingPlan, setChangingPlan] = useState(false);
  const [switchFeedback, setSwitchFeedback] = useState(null);

  const currentPlanKey = (wallet?.plan || user?.plan || 'plus').toLowerCase().includes('plus')
    ? 'plus'
    : (wallet?.plan || user?.plan || '').toLowerCase().includes('pack')
      ? 'pack'
      : 'free';

  const planInfo = PLAN_DEFINITIONS[currentPlanKey] || PLAN_DEFINITIONS.plus;
  const rates = wallet?.rates || {
    maps: currentPlanKey === 'plus' ? 0.90 : currentPlanKey === 'pack' ? 1.10 : 1.30,
    dorking: currentPlanKey === 'plus' ? 0.70 : currentPlanKey === 'pack' ? 0.80 : 1.00,
    whatsapp: currentPlanKey === 'plus' ? 0.70 : currentPlanKey === 'pack' ? 0.80 : 1.00,
    yellowpages: currentPlanKey === 'plus' ? 0.40 : currentPlanKey === 'pack' ? 0.50 : 0.60,
    yandex: currentPlanKey === 'plus' ? 1.30 : currentPlanKey === 'pack' ? 1.50 : 1.70,
  };

  const handlePlanSwitch = async (targetPlanKey) => {
    if (targetPlanKey === currentPlanKey) return;
    setChangingPlan(true);
    setSwitchFeedback(null);
    try {
      if (updateUserPlan) {
        const res = await updateUserPlan(targetPlanKey);
        if (res.success) {
          setSwitchFeedback(`Successfully activated ${PLAN_DEFINITIONS[targetPlanKey].name}!`);
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
  };

    if (typeof document === 'undefined') return null;

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
                <h3>{user?.name || 'Devang Goswami'}</h3>
                <span className={`plan-badge-pill ${currentPlanKey}`}>
                  {planInfo.name}
                </span>
              </div>
              <span className="profile-user-email">{user?.email || 'gdevang950@gmail.com'}</span>
            </div>
          </div>

          <button className="profile-modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Top Wallet & Status Bar */}
        <div className="profile-status-bar">
          <div className="status-item">
            <span className="status-item-label">Current Balance</span>
            <span className="status-item-val green">
              ₹{Number(walletBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="status-item">
            <span className="status-item-label">Account Plan</span>
            <span className="status-item-val">{planInfo.name}</span>
          </div>
          <div className="status-item">
            <span className="status-item-label">Billing Cycle</span>
            <span className="status-item-val">{planInfo.price} {planInfo.period}</span>
          </div>
          <div className="status-item">
            <span className="status-item-label">Account Status</span>
            <span className="status-item-badge active">
              <span className="pulse-dot"></span> Active
            </span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="profile-tab-switcher">
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
                    <span className="engine-title">Google Maps Direct</span>
                  </div>
                  <div className="engine-price-tag">
                    <span className="price-main">₹{Number(rates.maps || 0.90).toFixed(2)}</span>
                    <span className="price-unit">/ lead</span>
                  </div>
                  <span className="engine-std-compare">Standard: ₹1.30</span>
                </div>

                <div className="engine-rate-tile">
                  <div className="engine-name-group">
                    <span className="engine-dot purple"></span>
                    <span className="engine-title">Social / Business Dorking</span>
                  </div>
                  <div className="engine-price-tag">
                    <span className="price-main">₹{Number(rates.dorking || 0.70).toFixed(2)}</span>
                    <span className="price-unit">/ lead</span>
                  </div>
                  <span className="engine-std-compare">Standard: ₹1.00</span>
                </div>

                <div className="engine-rate-tile">
                  <div className="engine-name-group">
                    <span className="engine-dot green"></span>
                    <span className="engine-title">WhatsApp Group Radar</span>
                  </div>
                  <div className="engine-price-tag">
                    <span className="price-main">₹{Number(rates.whatsapp || 0.70).toFixed(2)}</span>
                    <span className="price-unit">/ lead</span>
                  </div>
                  <span className="engine-std-compare">Standard: ₹1.00</span>
                </div>

                <div className="engine-rate-tile">
                  <div className="engine-name-group">
                    <span className="engine-dot amber"></span>
                    <span className="engine-title">YellowPages Directory</span>
                  </div>
                  <div className="engine-price-tag">
                    <span className="price-main">₹{Number(rates.yellowpages || 0.40).toFixed(2)}</span>
                    <span className="price-unit">/ lead</span>
                  </div>
                  <span className="engine-std-compare">Standard: ₹0.60</span>
                </div>

                <div className="engine-rate-tile">
                  <div className="engine-name-group">
                    <span className="engine-dot red"></span>
                    <span className="engine-title">Yandex + MAX Messenger</span>
                  </div>
                  <div className="engine-price-tag">
                    <span className="price-main">₹{Number(rates.yandex || 1.30).toFixed(2)}</span>
                    <span className="price-unit">/ lead</span>
                  </div>
                  <span className="engine-std-compare">Standard: ₹1.70</span>
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
                  <div key={p.id} className={`plan-card-option ${isCurrent ? 'active-plan' : ''}`}>
                    {isCurrent && (
                      <div className="current-plan-ribbon">
                        <span>YOUR ACTIVE PLAN</span>
                      </div>
                    )}
                    <div className="plan-option-header">
                      <div className="plan-icon-wrapper" style={{ color: p.color }}>
                        <IconComponent size={24} />
                      </div>
                      <h4 className="plan-name-h">{p.name}</h4>
                      <p className="plan-tagline-p">{p.tagline}</p>
                    </div>

                    <div className="plan-price-block">
                      <span className="price-big">{p.price}</span>
                      <span className="price-sub">{p.period}</span>
                    </div>

                    <div className="plan-specs-list">
                      <div className="spec-row">
                        <span className="spec-label">Google Maps:</span>
                        <span className="spec-val">
                          {p.id === 'plus' ? '₹0.90' : p.id === 'pack' ? '₹1.10' : '₹1.30'}/lead
                        </span>
                      </div>
                      <div className="spec-row">
                        <span className="spec-label">Batch Size:</span>
                        <span className="spec-val">{p.maxBatch}</span>
                      </div>
                      <div className="spec-row">
                        <span className="spec-label">Engine Speed:</span>
                        <span className="spec-val">{p.speed}</span>
                      </div>
                      <div className="spec-row">
                        <span className="spec-label">Cold Email Suite:</span>
                        <span className="spec-val">
                          {p.id === 'plus' ? '✅ Included' : '🔒 Locked'}
                        </span>
                      </div>
                      <div className="spec-row">
                        <span className="spec-label">Unified Inbox:</span>
                        <span className="spec-val">
                          {p.id === 'plus' ? '✅ Included' : '🔒 Locked'}
                        </span>
                      </div>
                    </div>

                    <div className="plan-action-area">
                      {isCurrent ? (
                        <button className="plan-select-btn current" disabled>
                          <Check size={16} />
                          <span>Current Plan</span>
                        </button>
                      ) : (
                        <button 
                          className="plan-select-btn"
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
          <div className="footer-left-help">
            <span>Need more leads or custom enterprise volume? Contact support@contaque.com</span>
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
    </div>,
    document.body
  );
}
