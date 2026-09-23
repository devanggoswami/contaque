import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Database, Zap, Sparkles, ShieldCheck, Menu, X, LogOut, User, Globe, Wallet, Lock, Gift, HelpCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import WalletRechargeModal from './WalletRechargeModal';
import UserProfileModal from './UserProfileModal';
import './Sidebar.css';

function Sidebar() {
  const [activeJobsCount, setActiveJobsCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isRechargeOpen, setIsRechargeOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, walletBalance, refreshWallet, userPlan, authFetch } = useAuth();

  // Close mobile drawer whenever route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  useEffect(() => {
    const checkActiveJobs = async () => {
      try {
        const res = await authFetch(`${API_URL}/api/jobs`);
        if (res.ok) {
          const jobs = await res.json();
          const inProgress = jobs.filter(j => j.status === 'IN_PROGRESS').length;
          setActiveJobsCount(inProgress);
        }
      } catch {
        // quiet fallback
      }
    };

    checkActiveJobs();
    const interval = setInterval(checkActiveJobs, 4000);
    return () => clearInterval(interval);
  }, [authFetch]);

  // Balance under 100 INR (~$2) is considered low
  const isLowBalance = Number(walletBalance ?? 0) < 100;

  return (
    <>
      {/* Mobile Top Navbar (visible only on <= 768px) */}
      <header className="mobile-top-bar">
        <div className="mobile-brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <div className="mobile-brand-icon" style={{ overflow: 'hidden', padding: 0 }}>
            <img src="/contaque_logo.jpg" alt="Contaque" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span className="mobile-brand-name">Contaque</span>
          <span className="mobile-brand-tag">PRO</span>
        </div>

        <div className="mobile-header-right">
          <button 
            className={`mobile-wallet-pill ${isLowBalance ? 'low-balance-alert' : ''}`}
            onClick={() => setIsRechargeOpen(true)}
            title="Prepaid Balance - Tap to Top Up"
          >
            <Wallet size={13} />
            <span className={isLowBalance ? 'low-balance-text' : ''}>
              ₹{Number(walletBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </button>
          {activeJobsCount > 0 && (
            <span className="mobile-live-badge">{activeJobsCount} live</span>
          )}
          <button 
            className="mobile-menu-btn" 
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Backdrop overlay for mobile drawer */}
      {mobileOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar / Off-canvas Drawer */}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-logo" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
            <div className="brand-icon" style={{ overflow: 'hidden', padding: 0 }}>
              <img src="/contaque_logo.jpg" alt="Contaque" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div className="brand-info">
              <h2>Contaque</h2>
              <span className="brand-tag">PRO INTELLIGENCE</span>
            </div>
          </div>
          <button 
            className="sidebar-close-btn" 
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">PLATFORM</div>
          
          <NavLink 
            to="/dashboard" 
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} 
            end
            onClick={() => setMobileOpen(false)}
          >
            <LayoutDashboard size={19} className="nav-icon" />
            <span>Dashboard</span>
          </NavLink>

          <NavLink 
            to="/generate" 
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            onClick={() => setMobileOpen(false)}
          >
            <Zap size={19} className="nav-icon" />
            <span>Generate Data</span>
            <span className="nav-badge-new">FAST</span>
          </NavLink>

          <NavLink 
            to="/database" 
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            onClick={() => setMobileOpen(false)}
          >
            <Database size={19} className="nav-icon" />
            <span>Database</span>
            {activeJobsCount > 0 ? (
              <span className="nav-badge-pulse">{activeJobsCount} live</span>
            ) : null}
          </NavLink>

          <NavLink 
            to="/campaigns" 
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            onClick={() => setMobileOpen(false)}
          >
            <svg className="nav-icon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            <span>Campaigns</span>
            {userPlan === 'plus' || userPlan === 'pack' ? (
              <span className="nav-badge-neutral">BETA</span>
            ) : (
              <span className="nav-badge-lock" title="Paid Plan Feature"><Lock size={9} /> PRO</span>
            )}
          </NavLink>

          <NavLink 
            to="/inbox" 
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            onClick={() => setMobileOpen(false)}
          >
            <svg className="nav-icon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            <span>Inbox</span>
            {userPlan === 'plus' || userPlan === 'pack' ? (
              <span className="nav-badge-new">NEW</span>
            ) : (
              <span className="nav-badge-lock" title="Paid Plan Feature"><Lock size={9} /> PRO</span>
            )}
          </NavLink>

          <NavLink 
            to="/referral" 
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            onClick={() => setMobileOpen(false)}
          >
            <Gift size={19} className="nav-icon" />
            <span>Refer & Earn</span>
            <span className="nav-badge-new" style={{ background: 'linear-gradient(135deg, #10B981, #059669)', color: '#FFFFFF' }}>
              {(user?.country && user.country !== 'India') ? '$2' : '₹100'}
            </span>
          </NavLink>

          <NavLink 
            to="/support" 
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            onClick={() => setMobileOpen(false)}
          >
            <HelpCircle size={19} className="nav-icon" />
            <span>Help & Support</span>
          </NavLink>

          {/* Admin Support Link - Visible strictly for Administrator */}
          {(user?.role === 'Administrator' || user?.isAdmin) && (
            <NavLink 
              to="/admin" 
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              onClick={() => setMobileOpen(false)}
            >
              <ShieldCheck size={19} className="nav-icon" />
              <span>Admin Support</span>
              <span className="nav-badge-new" style={{ background: '#10367D', color: '#FFFFFF' }}>ADMIN</span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          {/* Wallet Balance Card */}
          <div className={`sidebar-wallet-card ${isLowBalance ? 'low-balance-alert' : ''}`}>
            <div className="wallet-card-left">
              <div className={`wallet-icon-circle ${isLowBalance ? 'low-balance-alert' : ''}`}>
                <Wallet size={14} />
              </div>
              <div className="wallet-card-text">
                <span className="wallet-label">Prepaid Balance</span>
                <span className={`wallet-value ${isLowBalance ? 'low-balance-alert' : ''}`}>
                  ₹{Number(walletBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <button 
              className="wallet-topup-btn" 
              onClick={() => setIsRechargeOpen(true)}
              title="Add Credits to Wallet"
            >
              + Top Up
            </button>
          </div>

          {user && (
            <div 
              className="sidebar-user-card interactive"
              onClick={() => setIsProfileModalOpen(true)}
              title="Click to view subscription plan, per-lead rates & feature entitlements"
            >
              <div className="user-avatar-circle">
                <User size={15} />
              </div>
              <div className="user-info-text">
                <div className="user-name-plan-row">
                  <span className="user-name">{user.name || user.email?.split('@')[0] || 'Account'}</span>
                  <span className={`user-plan-badge ${(userPlan || 'plus').toLowerCase()}`}>
                    {(userPlan || 'plus').toUpperCase()}
                  </span>
                </div>
                <span className="user-email-tag">{user.email}</span>
              </div>
              <button 
                className="sidebar-logout-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  logout();
                  navigate('/login', { replace: true });
                }}
                title="Sign Out Session"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}

        </div>
      </aside>

      <WalletRechargeModal 
        isOpen={isRechargeOpen}
        onClose={() => setIsRechargeOpen(false)}
        onSuccess={() => refreshWallet()}
      />

      <UserProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onOpenRecharge={() => setIsRechargeOpen(true)}
      />
    </>
  );
}

export default Sidebar;
