import React, { useState } from 'react';
import { 
  Lock, Sparkles, CheckCircle2, ArrowRight, ShieldCheck, Zap, 
  Mail, Send, Layers, Crown 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import RazorpayCheckoutModal from './RazorpayCheckoutModal';
import UserProfileModal from './UserProfileModal';
import './LockedFeatureGate.css';

const PLUS_PLAN_DATA = {
  id: 'plus',
  name: 'Value Plus',
  icon: '⚡',
  badge: 'ALL-IN-ONE POWERHOUSE',
  price: { INR: '₹499', USD: '$5.20' },
  period: '/month',
  tagline: 'Lowest rates + full cold outreach suite'
};

export default function LockedFeatureGate({
  featureTitle = 'Campaign Studio',
  featureTagline = 'Automated Cold Email Outreach Engine',
  featureIcon: FeatureIcon = Mail,
  bullets = [
    'Multi-account Gmail & Google Workspace rotating sender engine',
    'Smart anti-spam rate limiting & automated background queue',
    'Rich personalized template editor with dynamic lead data merge',
    'Lowest extraction rates across all data mining engines'
  ],
  children
}) {
  const { userPlan, user, refreshWallet } = useAuth();
  const [showCheckout, setShowCheckout] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Feature is accessible if user is on 'plus' plan or has admin rights
  const hasAccess = userPlan === 'plus' || user?.role === 'Administrator';

  // If user has access, render content normally without any barrier
  if (hasAccess) {
    return <>{children}</>;
  }

  // If locked, render blurred content in the background with dynamic animated swinging lock overlay
  return (
    <div className="locked-gate-wrapper">
      {/* Blurred background preview of the actual page */}
      <div className="locked-gate-blurred-preview" aria-hidden="true">
        {children}
      </div>

      {/* Dynamic Paywall Overlay */}
      <div className="locked-gate-overlay">
        <div className="locked-gate-card">
          {/* Swinging Pendulum Lock Icon */}
          <div className="pendulum-anchor">
            <div className="pendulum-string" />
            <div className="swinging-lock-badge" title="Locked Feature">
              <Lock size={22} className="lock-svg" />
            </div>
          </div>

          {/* Tier Tag */}
          <div className="locked-tier-pill">
            <Crown size={13} className="pill-icon" />
            <span>VALUE PLUS EXCLUSIVE</span>
          </div>

          {/* Titles */}
          <h2 className="locked-gate-title">
            Unlock {featureTitle}
          </h2>
          <p className="locked-gate-subtitle">
            {featureTagline}. Automate cold outreach, rotate multiple Google accounts, and track inbox replies effortlessly.
          </p>

          {/* Feature Highlights Grid */}
          <div className="locked-bullets-list">
            {bullets.map((bullet, idx) => (
              <div key={idx} className="locked-bullet-item">
                <div className="bullet-check-circle">
                  <CheckCircle2 size={15} />
                </div>
                <span>{bullet}</span>
              </div>
            ))}
          </div>

          {/* Pricing & Value Summary */}
          <div className="locked-pricing-strip">
            <div className="pricing-left">
              <span className="price-tag">₹499</span>
              <span className="price-period">/month</span>
            </div>
            <div className="pricing-right">
              <span className="pricing-badge">BEST ROI</span>
              <span className="pricing-sub">Full outreach suite + lowest per-lead rates</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="locked-cta-group">
            <button 
              className="locked-upgrade-btn"
              onClick={() => setShowCheckout(true)}
              id="btn-upgrade-plan-gate"
            >
              <Zap size={18} />
              <span>Upgrade to Value Plus</span>
              <ArrowRight size={18} />
            </button>

            <button 
              className="locked-learn-btn"
              onClick={() => setShowProfileModal(true)}
              id="btn-view-plans-gate"
            >
              View Plan Details & Rate Chart
            </button>
          </div>

          {/* Security Note */}
          <div className="locked-trust-note">
            <ShieldCheck size={14} />
            <span>Instant activation via Razorpay • 100% AES-256 Cloud Security</span>
          </div>
        </div>
      </div>

      {/* Razorpay Upgrade Modal */}
      {showCheckout && (
        <RazorpayCheckoutModal
          isOpen={showCheckout}
          onClose={() => setShowCheckout(false)}
          plan={PLUS_PLAN_DATA}
          currency="INR"
          onSuccess={async () => {
            setShowCheckout(false);
            if (refreshWallet) await refreshWallet();
          }}
        />
      )}

      {/* Profile / Plan Comparison Modal */}
      {showProfileModal && (
        <UserProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          onUpgradeClick={(plan) => {
            setShowProfileModal(false);
            setShowCheckout(true);
          }}
        />
      )}
    </div>
  );
}
