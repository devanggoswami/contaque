import React, { useState, useEffect } from 'react';
import { 
  Gift, Copy, Check, Users, Award, Wallet, Share2, 
  ExternalLink, Sparkles, RefreshCw, MessageSquare, Mail, AlertCircle 
} from 'lucide-react';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import './ReferAndEarn.css';

export default function ReferAndEarn() {
  const { user, authFetch, walletBalance, refreshWallet } = useAuth();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState({
    referral_code: '',
    total_referrals: 0,
    total_earned: 0,
    referral_history: []
  });

  const isUSD = user?.country && user.country !== 'India';
  const rewardUnit = isUSD ? '$2' : '₹100';

  const fetchReferralInfo = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`${API_URL}/api/referral/info`);
      if (res.ok) {
        const data = await res.json();
        setInfo(data);
      }
    } catch (err) {
      console.error('Failed to load referral details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferralInfo();
  }, []);

  const referralCode = info.referral_code || user?.referral_code || '...';
  const shareUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/signup?ref=${referralCode}`
    : `https://contaque.com/signup?ref=${referralCode}`;

  const copyToClipboard = (text, isLink = false) => {
    navigator.clipboard.writeText(text);
    if (isLink) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `Hey! Get ${rewardUnit} free credits on Contaque (B2B Lead Intelligence & Outreach platform) by signing up with my referral code: ${referralCode}\n\nJoin here: ${shareUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleTwitterShare = () => {
    const text = encodeURIComponent(
      `Get ${rewardUnit} in free credits on @Contaque using my invite code ${referralCode}! High quality B2B verified leads & data.`
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(shareUrl)}`, '_blank');
  };

  return (
    <div className="referral-page-container">
      {/* Page Header */}
      <div className="referral-header">
        <div className="referral-title-group">
          <div className="referral-icon-pill">
            <Gift size={24} />
          </div>
          <div>
            <h1 className="referral-page-heading">Refer & Earn</h1>
            <p className="referral-page-subheading">
              Invite your network to Contaque and earn wallet credits automatically
            </p>
          </div>
        </div>

        <button 
          className="referral-refresh-btn" 
          onClick={fetchReferralInfo}
          disabled={loading}
          title="Refresh Statistics"
        >
          <RefreshCw size={16} className={loading ? 'spin-icon' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Hero Banner with Explanation */}
      <div className="referral-hero-card">
        <div className="referral-hero-content">
          <div className="referral-hero-tag">
            <Sparkles size={14} />
            <span>INSTANT SIGNUP REWARDS</span>
          </div>
          <h2 className="referral-hero-title">
            Share your referral code with friends.
          </h2>
          <div className="referral-rules-box">
            <p className="referral-rule-intro">When a new user signs up using your code:</p>
            <ul className="referral-rules-list">
              <li>
                <span className="bullet-dot">•</span>
                <span>You receive <strong>{rewardUnit} credits</strong></span>
              </li>
              <li>
                <span className="bullet-dot">•</span>
                <span>Your friend receives <strong>{rewardUnit} credits</strong></span>
              </li>
            </ul>
            <p className="referral-rule-note">
              Referral rewards are credited after the referral is successfully validated.
            </p>
          </div>
        </div>

        {/* Code & Sharing Card */}
        <div className="referral-share-box">
          <div className="referral-code-label">YOUR UNIQUE REFERRAL CODE</div>
          <div className="referral-code-display">
            <span className="referral-code-text">{referralCode}</span>
            <button 
              className={`referral-copy-code-btn ${copiedCode ? 'copied' : ''}`}
              onClick={() => copyToClipboard(referralCode, false)}
            >
              {copiedCode ? <Check size={16} /> : <Copy size={16} />}
              <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
            </button>
          </div>

          <div className="referral-link-section">
            <label className="referral-link-label">Direct Referral Link</label>
            <div className="referral-link-input-group">
              <input 
                type="text" 
                readOnly 
                value={shareUrl} 
                className="referral-link-input"
              />
              <button 
                className={`referral-copy-link-btn ${copiedLink ? 'copied' : ''}`}
                onClick={() => copyToClipboard(shareUrl, true)}
                title="Copy share link"
              >
                {copiedLink ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
          </div>

          <div className="referral-social-share">
            <button className="social-share-btn whatsapp" onClick={handleWhatsAppShare}>
              <MessageSquare size={16} />
              <span>Share WhatsApp</span>
            </button>
            <button className="social-share-btn twitter" onClick={handleTwitterShare}>
              <Share2 size={16} />
              <span>Share on X</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="referral-stats-grid">
        <div className="referral-stat-card">
          <div className="stat-icon-wrap blue">
            <Users size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Friends Referred</div>
            <div className="stat-value">{info.total_referrals}</div>
            <div className="stat-help">Verified active signups</div>
          </div>
        </div>

        <div className="referral-stat-card">
          <div className="stat-icon-wrap emerald">
            <Award size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Referral Rewards</div>
            <div className="stat-value">
              {isUSD ? `$${(info.total_earned / 50).toFixed(2)}` : `₹${info.total_earned.toLocaleString('en-IN')}`}
            </div>
            <div className="stat-help">Earned and credited to wallet</div>
          </div>
        </div>

        <div className="referral-stat-card">
          <div className="stat-icon-wrap violet">
            <Wallet size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Current Wallet Balance</div>
            <div className="stat-value">
              {isUSD ? `$${((walletBalance || 0) / 50).toFixed(2)}` : `₹${Number(walletBalance || 0).toLocaleString('en-IN')}`}
            </div>
            <div className="stat-help">Ready for lead generation & exports</div>
          </div>
        </div>
      </div>

      {/* Referral History */}
      <div className="referral-history-card">
        <div className="history-card-header">
          <div>
            <h3 className="history-card-title">Referral History</h3>
            <p className="history-card-subtitle">Recent friends who claimed your referral code</p>
          </div>
        </div>

        {info.referral_history && info.referral_history.length > 0 ? (
          <div className="history-table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Referred User</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Your Reward</th>
                </tr>
              </thead>
              <tbody>
                {info.referral_history.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="history-user-pill">
                        <span className="user-email-masked">{item.referred_email}</span>
                      </div>
                    </td>
                    <td>
                      {new Date(item.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>
                    <td>
                      <span className="history-status-badge">
                        <Check size={12} />
                        <span>Completed</span>
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                      +{isUSD ? '$2.00' : `₹${item.reward_amount || 100}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="history-empty-state">
            <div className="empty-icon-wrap">
              <Gift size={32} />
            </div>
            <h4>No referrals yet</h4>
            <p>Share your unique code with your colleagues or clients to start earning {rewardUnit} credits per signup!</p>
          </div>
        )}
      </div>
    </div>
  );
}
