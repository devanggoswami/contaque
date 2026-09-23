import React, { useState, useEffect, useCallback } from 'react';
import { 
  CreditCard, DollarSign, CheckCircle2, AlertCircle, RefreshCw, 
  Info, ShieldCheck, Zap, Layers, ChevronRight, X, ArrowUpRight,
  Terminal, Database, Search, UserCheck, ShieldAlert, ArrowRight,
  PlusCircle, MinusCircle, Clock, FileText, Check, AlertTriangle, User
} from 'lucide-react';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import './Administrative.css';

function Administrative() {
  const { user: currentUser, authFetch } = useAuth();
  const [activeTab, setActiveTab] = useState('support'); // 'support' | 'telemetry'

  // Telemetry state
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showPricingModal, setShowPricingModal] = useState(false);

  // User Support & Override state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserLoading, setSelectedUserLoading] = useState(false);
  
  // Plan Override form
  const [targetPlan, setTargetPlan] = useState('plus');
  const [planExtendDays, setPlanExtendDays] = useState('30');
  const [planReason, setPlanReason] = useState('');
  const [planSubmitting, setPlanSubmitting] = useState(false);
  const [planSuccessMsg, setPlanSuccessMsg] = useState('');
  const [planErrorMsg, setPlanErrorMsg] = useState('');

  // Wallet Override form
  const [walletType, setWalletType] = useState('CREDIT');
  const [walletAmount, setWalletAmount] = useState('');
  const [walletReason, setWalletReason] = useState('');
  const [walletSubmitting, setWalletSubmitting] = useState(false);
  const [walletSuccessMsg, setWalletSuccessMsg] = useState('');
  const [walletErrorMsg, setWalletErrorMsg] = useState('');

  // Diagnostic sub-tab for selected user
  const [userSubTab, setUserSubTab] = useState('audit'); // 'audit' | 'ledger' | 'orders'

  const fetchAdminData = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const res = await authFetch(`${API_URL}/api/dashboard`);
      if (!res.ok) throw new Error("Failed to fetch administrative telemetry");
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      if (manual) setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [authFetch]);

  // Initial load
  useEffect(() => {
    fetchAdminData();
    // Preload recent users for support tab
    handleSearchUsers('');
  }, [fetchAdminData]);

  // Search users
  const handleSearchUsers = async (queryToSearch = searchQuery) => {
    setSearchLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/users/search?q=${encodeURIComponent(queryToSearch.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users || []);
        if (data.users?.length > 0 && !selectedUser) {
          fetchUserDetails(data.users[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to search users:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  // Fetch full details of a selected user
  const fetchUserDetails = async (userId) => {
    setSelectedUserLoading(true);
    setPlanSuccessMsg('');
    setPlanErrorMsg('');
    setWalletSuccessMsg('');
    setWalletErrorMsg('');
    try {
      const res = await authFetch(`${API_URL}/api/admin/users/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedUser(data);
        setTargetPlan(data.user.plan || 'plus');
      }
    } catch (err) {
      console.error('Failed to fetch user details:', err);
    } finally {
      setSelectedUserLoading(false);
    }
  };

  // Handle Plan Override submission
  const handlePlanOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser?.user?.id) return;
    if (!planReason || planReason.trim().length < 3) {
      setPlanErrorMsg('Please provide a mandatory reason for this plan adjustment (min 3 chars).');
      return;
    }

    setPlanSubmitting(true);
    setPlanSuccessMsg('');
    setPlanErrorMsg('');

    try {
      const res = await authFetch(`${API_URL}/api/admin/override/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.user.id,
          plan: targetPlan,
          reason: planReason.trim(),
          extendDays: parseInt(planExtendDays, 10) || 30
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPlanSuccessMsg(data.message || `Plan updated to "${targetPlan.toUpperCase()}"`);
        setPlanReason('');
        // Refresh full user diagnostic profile
        await fetchUserDetails(selectedUser.user.id);
        // Refresh search list
        handleSearchUsers(searchQuery);
      } else {
        setPlanErrorMsg(data.error || 'Failed to update plan.');
      }
    } catch (err) {
      setPlanErrorMsg(err.message || 'Network error performing plan override.');
    } finally {
      setPlanSubmitting(false);
    }
  };

  // Handle Wallet Adjustment submission
  const handleWalletOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser?.user?.id) return;

    const numAmount = parseFloat(walletAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setWalletErrorMsg('Please enter a valid positive amount greater than 0.');
      return;
    }

    if (!walletReason || walletReason.trim().length < 3) {
      setWalletErrorMsg('Please provide a mandatory reason for this wallet adjustment (min 3 chars).');
      return;
    }

    setWalletSubmitting(true);
    setWalletSuccessMsg('');
    setWalletErrorMsg('');

    try {
      const res = await authFetch(`${API_URL}/api/admin/override/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.user.id,
          type: walletType,
          amount: numAmount,
          reason: walletReason.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setWalletSuccessMsg(data.message || `Wallet balance updated successfully.`);
        setWalletAmount('');
        setWalletReason('');
        // Refresh full user diagnostic profile
        await fetchUserDetails(selectedUser.user.id);
        // Refresh search list
        handleSearchUsers(searchQuery);
      } else {
        setWalletErrorMsg(data.error || 'Failed to adjust wallet balance.');
      }
    } catch (err) {
      setWalletErrorMsg(err.message || 'Network error performing wallet adjustment.');
    } finally {
      setWalletSubmitting(false);
    }
  };

  // Format date helper (IST)
  const formatDateIST = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }) + ' IST';
    } catch {
      return dateStr;
    }
  };

  const billing = stats?.billing || {
    monthRequests: 0,
    monthLeads: 0,
    monthCostUSD: 0,
    monthCostINR: 0,
    freeCreditMonthlyUSD: 200,
    remainingCreditUSD: 200,
    creditUsedPercent: 0,
    netPayableUSD: 0,
    costPerRequest: 0.035,
    inrRate: 86.5
  };

  const remainingFreeLeads = Math.max(0, (Math.floor(billing.freeCreditMonthlyUSD / billing.costPerRequest) * 20) - billing.monthLeads);

  if (loading) {
    return (
      <div className="page-content animate-fade-in">
        <div className="admin-loading-skeleton">
          <div className="skeleton-hero skeleton"></div>
          <div className="skeleton-grid">
            <div className="skeleton-card skeleton"></div>
            <div className="skeleton-card skeleton"></div>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = currentUser?.role === 'Administrator' || currentUser?.isAdmin;

  if (!isAdmin) {
    return (
      <div className="page-content animate-fade-in">
        <div className="admin-unauthorized-card">
          <ShieldAlert size={48} className="text-danger" />
          <h2>Access Restricted</h2>
          <p>Administrator privileges are required to view and manage enterprise support and billing controls.</p>
          <a href="/dashboard" className="btn-primary-blue mt-4">Return to Dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content animate-slide-up">
      {/* Top Header */}
      <div className="admin-header-bar">
        <div>
          <div className="admin-greeting">
            <ShieldCheck size={14} />
            <span>ENTERPRISE CONTROL & SUPPORT HUB</span>
          </div>
          <h1 className="admin-title">Administration & Customer Support</h1>
          <p className="admin-subtitle">Manage user accounts, manual plan activations, wallet adjustments & billing telemetry</p>
        </div>

        <div className="admin-header-actions">
          <div className="admin-tab-pills">
            <button 
              className={`admin-tab-pill ${activeTab === 'support' ? 'active' : ''}`}
              onClick={() => setActiveTab('support')}
            >
              <UserCheck size={15} />
              <span>Customer Support & Overrides</span>
            </button>
            <button 
              className={`admin-tab-pill ${activeTab === 'telemetry' ? 'active' : ''}`}
              onClick={() => setActiveTab('telemetry')}
            >
              <CreditCard size={15} />
              <span>API Quotas & Billing</span>
            </button>
          </div>
          
          <button 
            className={`refresh-icon-btn ${isRefreshing ? 'spinning' : ''}`} 
            onClick={() => fetchAdminData(true)}
            title="Refresh Data"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {error && (
        <div className="telemetry-error-banner animate-fade-in">
          <AlertCircle size={18} />
          <span>System Telemetry Warning: {error}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: CUSTOMER SUPPORT & ACCOUNT OVERRIDE HUB */}
      {/* ========================================================================= */}
      {activeTab === 'support' && (
        <div className="admin-support-layout animate-fade-in">
          {/* Left Column: User Search & List */}
          <div className="admin-search-panel">
            <div className="search-header-box">
              <h3>Search & Select Customer</h3>
              <p>Find user by email or account ID to view details and execute support actions.</p>
              
              <form 
                className="admin-search-form" 
                onSubmit={(e) => { e.preventDefault(); handleSearchUsers(searchQuery); }}
              >
                <div className="admin-search-input-wrap">
                  <Search size={16} className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Search by email, name or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button 
                      type="button" 
                      className="search-clear-btn"
                      onClick={() => { setSearchQuery(''); handleSearchUsers(''); }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button type="submit" className="admin-search-submit-btn" disabled={searchLoading}>
                  {searchLoading ? <RefreshCw size={14} className="spinning" /> : 'Search'}
                </button>
              </form>
            </div>

            <div className="admin-user-list-container">
              <div className="user-list-count">
                <span>{searchResults.length} Users Found</span>
              </div>
              
              <div className="admin-user-cards-list">
                {searchResults.map((u) => {
                  const isSelected = selectedUser?.user?.id === u.id;
                  const planKey = (u.plan || 'free').toLowerCase();
                  return (
                    <div 
                      key={u.id}
                      className={`admin-user-card-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => fetchUserDetails(u.id)}
                    >
                      <div className="user-card-top">
                        <div className="user-avatar-circle">
                          {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="user-card-meta">
                          <strong className="user-card-name">{u.name || 'Unnamed User'}</strong>
                          <span className="user-card-email">{u.email}</span>
                        </div>
                        <span className={`plan-badge badge-${planKey}`}>
                          {planKey.toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="user-card-bottom">
                        <span className="user-card-balance">
                          Balance: <strong>₹{u.wallet_balance?.toFixed(2)}</strong>
                        </span>
                        <span className="user-card-date">
                          ID: #{u.id}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {searchResults.length === 0 && !searchLoading && (
                  <div className="no-users-found">
                    <AlertCircle size={24} className="text-secondary" />
                    <p>No user accounts matched your search query.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Selected User Diagnostic & Action Workspace */}
          <div className="admin-workspace-panel">
            {selectedUserLoading ? (
              <div className="workspace-loading-box">
                <RefreshCw size={28} className="spinning text-primary" />
                <span>Loading customer profile & transaction logs...</span>
              </div>
            ) : selectedUser?.user ? (
              <div className="workspace-content animate-slide-up">
                {/* User Summary Header Card */}
                <div className="user-profile-hero-card">
                  <div className="profile-hero-left">
                    <div className="profile-avatar-large">
                      {selectedUser.user.name ? selectedUser.user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <div className="user-name-row">
                        <h2>{selectedUser.user.name || 'User'}</h2>
                        <span className={`plan-pill pill-${(selectedUser.user.plan || 'free').toLowerCase()}`}>
                          {selectedUser.user.plan ? selectedUser.user.plan.toUpperCase() : 'FREE'} PLAN
                        </span>
                        {selectedUser.user.email_verified && (
                          <span className="verified-pill" title="Email Verified">
                            <CheckCircle2 size={12} /> Verified
                          </span>
                        )}
                      </div>
                      <span className="user-email-text">{selectedUser.user.email}</span>
                      <div className="user-stats-subtext">
                        <span>User ID: <strong>#{selectedUser.user.id}</strong></span>
                        <span>•</span>
                        <span>Auth: <strong>{selectedUser.user.auth_provider?.toUpperCase() || 'LOCAL'}</strong></span>
                        <span>•</span>
                        <span>Registered: <strong>{formatDateIST(selectedUser.user.created_at)}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="profile-hero-balance-box">
                    <span className="hero-balance-label">Current Prepaid Balance</span>
                    <strong className="hero-balance-value">
                      ₹{Number(selectedUser.user.wallet_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                    {selectedUser.user.plan_expires_at && (
                      <span className="hero-plan-expiry">
                        Plan Expires: {formatDateIST(selectedUser.user.plan_expires_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions Grid: Plan Override & Wallet Correction */}
                <div className="admin-actions-grid">
                  {/* Action Card 1: Plan Override */}
                  <div className="admin-action-card">
                    <div className="action-card-head">
                      <div className="action-icon-wrap icon-purple">
                        <Zap size={18} />
                      </div>
                      <div>
                        <h4>Manual Plan Override</h4>
                        <p>Activate, change or downgrade subscription without payment gateway</p>
                      </div>
                    </div>

                    {planSuccessMsg && (
                      <div className="action-success-alert animate-fade-in">
                        <Check size={16} />
                        <span>{planSuccessMsg}</span>
                      </div>
                    )}
                    {planErrorMsg && (
                      <div className="action-error-alert animate-fade-in">
                        <AlertTriangle size={16} />
                        <span>{planErrorMsg}</span>
                      </div>
                    )}

                    <form onSubmit={handlePlanOverrideSubmit} className="action-form">
                      <div className="form-group-row">
                        <div className="form-field">
                          <label>Target Plan Tier</label>
                          <select 
                            value={targetPlan} 
                            onChange={(e) => setTargetPlan(e.target.value)}
                            className="admin-select"
                          >
                            <option value="plus">Value Plus (₹299 - 1 Account, 400 Emails/day)</option>
                            <option value="pack">Value Pack (₹499 - 4 Accounts, 1,600 Emails/day)</option>
                            <option value="free">Free Tier (Reset / Downgrade)</option>
                            <option value="pro">Pro</option>
                            <option value="starter">Starter</option>
                          </select>
                        </div>

                        <div className="form-field">
                          <label>Validity Duration</label>
                          <select 
                            value={planExtendDays} 
                            onChange={(e) => setPlanExtendDays(e.target.value)}
                            className="admin-select"
                            disabled={targetPlan === 'free'}
                          >
                            <option value="30">30 Days (Standard)</option>
                            <option value="60">60 Days</option>
                            <option value="90">90 Days</option>
                            <option value="365">1 Year (365 Days)</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-field">
                        <label>Mandatory Audit Reason *</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Razorpay payment stuck / Support Resolution ticket #4810"
                          value={planReason}
                          onChange={(e) => setPlanReason(e.target.value)}
                          className="admin-input"
                          required
                        />
                      </div>

                      <button 
                        type="submit" 
                        className="btn-apply-action btn-purple"
                        disabled={planSubmitting}
                      >
                        {planSubmitting ? <RefreshCw size={14} className="spinning" /> : <ShieldCheck size={15} />}
                        <span>Apply Plan Override</span>
                      </button>
                    </form>
                  </div>

                  {/* Action Card 2: Wallet Balance Correction */}
                  <div className="admin-action-card">
                    <div className="action-card-head">
                      <div className="action-icon-wrap icon-blue">
                        <DollarSign size={18} />
                      </div>
                      <div>
                        <h4>Wallet Balance Adjustment</h4>
                        <p>Manually credit or debit prepaid funds with atomic ledger logging</p>
                      </div>
                    </div>

                    {walletSuccessMsg && (
                      <div className="action-success-alert animate-fade-in">
                        <Check size={16} />
                        <span>{walletSuccessMsg}</span>
                      </div>
                    )}
                    {walletErrorMsg && (
                      <div className="action-error-alert animate-fade-in">
                        <AlertTriangle size={16} />
                        <span>{walletErrorMsg}</span>
                      </div>
                    )}

                    <form onSubmit={handleWalletOverrideSubmit} className="action-form">
                      <div className="form-group-row">
                        <div className="form-field">
                          <label>Adjustment Type</label>
                          <div className="radio-toggle-group">
                            <button 
                              type="button"
                              className={`radio-toggle-btn ${walletType === 'CREDIT' ? 'active-credit' : ''}`}
                              onClick={() => setWalletType('CREDIT')}
                            >
                              <PlusCircle size={14} />
                              <span>Credit (+)</span>
                            </button>
                            <button 
                              type="button"
                              className={`radio-toggle-btn ${walletType === 'DEBIT' ? 'active-debit' : ''}`}
                              onClick={() => setWalletType('DEBIT')}
                            >
                              <MinusCircle size={14} />
                              <span>Debit (-)</span>
                            </button>
                          </div>
                        </div>

                        <div className="form-field">
                          <label>Amount (INR ₹)</label>
                          <input 
                            type="number" 
                            step="0.01" 
                            min="0.01"
                            placeholder="e.g. 250.00"
                            value={walletAmount}
                            onChange={(e) => setWalletAmount(e.target.value)}
                            className="admin-input"
                            required
                          />
                        </div>
                      </div>

                      <div className="form-field">
                        <label>Mandatory Audit Reason *</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Good-will credit / Lead extraction compensation / Refund adjustment"
                          value={walletReason}
                          onChange={(e) => setWalletReason(e.target.value)}
                          className="admin-input"
                          required
                        />
                      </div>

                      <button 
                        type="submit" 
                        className={`btn-apply-action ${walletType === 'CREDIT' ? 'btn-green' : 'btn-orange'}`}
                        disabled={walletSubmitting}
                      >
                        {walletSubmitting ? <RefreshCw size={14} className="spinning" /> : (walletType === 'CREDIT' ? <PlusCircle size={15} /> : <MinusCircle size={15} />)}
                        <span>{walletType === 'CREDIT' ? 'Add Funds to Wallet' : 'Deduct Funds from Wallet'}</span>
                      </button>
                    </form>
                  </div>
                </div>

                {/* Bottom Section: User Diagnostic Logs (Audit Logs / Ledger / Orders) */}
                <div className="user-diagnostic-container">
                  <div className="diagnostic-header-tabs">
                    <button 
                      className={`diag-tab ${userSubTab === 'audit' ? 'active' : ''}`}
                      onClick={() => setUserSubTab('audit')}
                    >
                      <ShieldCheck size={14} />
                      <span>Admin Audit Trail ({selectedUser.auditLogs?.length || 0})</span>
                    </button>
                    <button 
                      className={`diag-tab ${userSubTab === 'ledger' ? 'active' : ''}`}
                      onClick={() => setUserSubTab('ledger')}
                    >
                      <Layers size={14} />
                      <span>Wallet Ledger ({selectedUser.ledger?.length || 0})</span>
                    </button>
                    <button 
                      className={`diag-tab ${userSubTab === 'orders' ? 'active' : ''}`}
                      onClick={() => setUserSubTab('orders')}
                    >
                      <FileText size={14} />
                      <span>Payment Orders ({selectedUser.paymentOrders?.length || 0})</span>
                    </button>
                  </div>

                  <div className="diagnostic-tab-body">
                    {/* SUB-TAB 1: AUDIT LOGS */}
                    {userSubTab === 'audit' && (
                      <div className="diag-table-wrap">
                        {selectedUser.auditLogs?.length > 0 ? (
                          <table className="diag-data-table">
                            <thead>
                              <tr>
                                <th>Timestamp (IST)</th>
                                <th>Admin Identity</th>
                                <th>Action Performed</th>
                                <th>Amount / Values</th>
                                <th>Mandatory Reason</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedUser.auditLogs.map((log) => (
                                <tr key={log.id}>
                                  <td className="text-nowrap">{formatDateIST(log.created_at)}</td>
                                  <td><strong>{log.admin_email}</strong></td>
                                  <td>
                                    <span className={`log-badge badge-${log.action?.toLowerCase()}`}>
                                      {log.action}
                                    </span>
                                  </td>
                                  <td>
                                    {log.amount > 0 && <span className="text-emerald">₹{parseFloat(log.amount).toFixed(2)} </span>}
                                    {log.action === 'PLAN_OVERRIDE' && (
                                      <span>
                                        {log.previous_value?.plan?.toUpperCase()} ➔ <strong>{log.new_value?.plan?.toUpperCase()}</strong>
                                      </span>
                                    )}
                                  </td>
                                  <td className="log-reason-cell">{log.reason}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="empty-diag-state">
                            <Info size={20} className="text-secondary" />
                            <span>No manual admin actions recorded on this account yet.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SUB-TAB 2: WALLET LEDGER */}
                    {userSubTab === 'ledger' && (
                      <div className="diag-table-wrap">
                        {selectedUser.ledger?.length > 0 ? (
                          <table className="diag-data-table">
                            <thead>
                              <tr>
                                <th>Timestamp (IST)</th>
                                <th>Type</th>
                                <th>Amount</th>
                                <th>Balance After</th>
                                <th>Reason & Reference</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedUser.ledger.map((item) => (
                                <tr key={item.id}>
                                  <td className="text-nowrap">{formatDateIST(item.created_at)}</td>
                                  <td>
                                    <span className={`log-badge badge-${item.type?.toLowerCase()}`}>
                                      {item.type}
                                    </span>
                                  </td>
                                  <td className={item.type === 'CREDIT' ? 'text-emerald' : 'text-danger'}>
                                    {item.type === 'CREDIT' ? '+' : '-'}₹{parseFloat(item.amount).toFixed(2)}
                                  </td>
                                  <td>₹{parseFloat(item.balance_after).toFixed(2)}</td>
                                  <td className="log-reason-cell">
                                    <strong>{item.reason}</strong>
                                    {item.reference_id && <span className="ref-tag">Ref: {item.reference_id}</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="empty-diag-state">
                            <Info size={20} className="text-secondary" />
                            <span>No ledger transactions found for this user.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SUB-TAB 3: PAYMENT ORDERS */}
                    {userSubTab === 'orders' && (
                      <div className="diag-table-wrap">
                        {selectedUser.paymentOrders?.length > 0 ? (
                          <table className="diag-data-table">
                            <thead>
                              <tr>
                                <th>Timestamp (IST)</th>
                                <th>Order ID</th>
                                <th>Purpose</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Payment ID</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedUser.paymentOrders.map((ord) => (
                                <tr key={ord.id}>
                                  <td className="text-nowrap">{formatDateIST(ord.created_at)}</td>
                                  <td><code>{ord.order_id}</code></td>
                                  <td><span className="log-badge badge-neutral">{ord.purpose}</span></td>
                                  <td>₹{(ord.amount_paise / 100).toFixed(2)}</td>
                                  <td>
                                    <span className={`log-badge badge-${ord.status?.toLowerCase()}`}>
                                      {ord.status}
                                    </span>
                                  </td>
                                  <td><code>{ord.payment_id || '-'}</code></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="empty-diag-state">
                            <Info size={20} className="text-secondary" />
                            <span>No payment orders recorded for this user.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="workspace-empty-state">
                <User size={48} className="text-secondary" />
                <h3>No Customer Selected</h3>
                <p>Select a customer from the left search panel to inspect their account details or perform plan and wallet adjustments.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: API QUOTAS & BILLING TELEMETRY (Original Features Preserved 100%) */}
      {/* ========================================================================= */}
      {activeTab === 'telemetry' && (
        <div className="animate-fade-in">
          {/* Main Billing Meter Card */}
          <div className="billing-meter-card main-admin-card">
            <div className="billing-header-row">
              <div className="title-with-icon">
                <div className="admin-icon-box">
                  <CreditCard size={22} className="billing-icon" />
                </div>
                <div>
                  <h3>Google Places API • Live Billing & Credit Meter</h3>
                  <p className="billing-subtitle">Real-time tracking of API consumption against Google's $200.00 Monthly Free Tier</p>
                </div>
              </div>
            </div>

            <div className="billing-grid">
              {/* Credit Progress Gauge */}
              <div className="billing-gauge-box">
                <div className="gauge-header">
                  <span className="gauge-title">Monthly $200 Free Credit Balance</span>
                  <span className="gauge-pct-badge">{billing.creditUsedPercent}% Used</span>
                </div>
                
                <div className="credit-amount-row">
                  <span className="credit-big">${billing.remainingCreditUSD.toFixed(2)}</span>
                  <span className="credit-total">/ ${billing.freeCreditMonthlyUSD}.00 USD remaining</span>
                </div>

                <div className="credit-track">
                  <div 
                    className="credit-fill" 
                    style={{ width: `${Math.min(100, Math.max(2, billing.creditUsedPercent))}%` }}
                  ></div>
                </div>

                <div className="gauge-footer-text">
                  <CheckCircle2 size={14} className="check-emerald" />
                  <span><strong>{remainingFreeLeads.toLocaleString()}</strong> free leads remaining this month before billing starts.</span>
                </div>
              </div>

              {/* Quick Metrics */}
              <div className="billing-stats-column">
                <div className="billing-stat-item">
                  <span className="b-label">This Month API Consumption</span>
                  <div className="b-val-row">
                    <strong className="b-val">${billing.monthCostUSD.toFixed(2)} USD</strong>
                    <span className="b-inr">(₹{billing.monthCostINR.toFixed(2)} INR)</span>
                  </div>
                  <span className="b-sub">{billing.monthRequests} API Requests ({billing.monthLeads} Leads mined)</span>
                </div>

                <div className="billing-stat-item highlight-free">
                  <span className="b-label">Net Out-Of-Pocket Payable</span>
                  <div className="b-val-row">
                    <strong className="b-val-free">$0.00 USD (100% Covered by Free Credit)</strong>
                  </div>
                  <span className="b-sub">Rate: $0.035 / request (Places New TextSearch Pro)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Engine Pipeline Inspector Card */}
          <div className="admin-pipeline-card">
            <div className="inspector-header">
              <Terminal size={18} className="text-primary" />
              <div>
                <h3>Engine Pipeline Inspector & Dispatch Architecture</h3>
                <p className="pipeline-desc">Real-time query execution mechanics across Google Places API, Business Index & Web Directory engines</p>
              </div>
            </div>

            <div className="pipeline-grid">
              <div className="pipeline-code-box">
                <div className="code-header">
                  <span>DEFAULT QUERY DISPATCH</span>
                  <span className="engine-chip">Places API (New)</span>
                </div>
                <div className="code-content">
                  <code>textQuery: "Business Keyword in Target Location" (Google Places API v1)</code>
                </div>
              </div>

              <div className="inspector-stats-list">
                <div className="inspector-stat-row">
                  <span className="stat-label">Extraction Method:</span>
                  <span className="stat-value">Places API (v1) TextSearch Pro</span>
                </div>
                <div className="inspector-stat-row">
                  <span className="stat-label">Standard Yield Rate:</span>
                  <span className="stat-value">20 - 60 Verified Contacts / Job</span>
                </div>
                <div className="inspector-stat-row">
                  <span className="stat-label">API Cost Rate:</span>
                  <span className="stat-value text-emerald">~$0.035 USD (100% Free - Covered by Credit)</span>
                </div>
                <div className="inspector-stat-row">
                  <span className="stat-label">Google Free Credit Left:</span>
                  <span className="stat-value text-emerald">
                    ${billing.remainingCreditUSD.toFixed(2)} / ${billing.freeCreditMonthlyUSD}.00 USD
                  </span>
                </div>
                <div className="inspector-stat-row">
                  <span className="stat-label">Database Storage Engine:</span>
                  <span className="stat-value">PostgreSQL (Deduplication & Auto-Indexing Enabled)</span>
                </div>
              </div>
            </div>

            <div className="inspector-tip">
              <ShieldCheck size={16} />
              <span>
                Places API TextSearch Pro tier. You currently have <strong>{remainingFreeLeads.toLocaleString()}</strong> free leads remaining this calendar month!
              </span>
            </div>
          </div>

          {/* Quota & Cost Explanatory Grid */}
          <div className="admin-info-grid">
            <div className="admin-info-card">
              <div className="info-card-head">
                <DollarSign size={18} className="info-icon green" />
                <h4>Free Monthly Quota ($200.00)</h4>
              </div>
              <p>Every Google Cloud account receives <strong>$200.00 USD of free usage credit</strong> every single calendar month automatically.</p>
              <div className="quota-tag">Max Yield: ~114,280 Free Leads / Month</div>
            </div>

            <div className="admin-info-card">
              <div className="info-card-head">
                <Zap size={18} className="info-icon purple" />
                <h4>Places TextSearch (Pro Rate)</h4>
              </div>
              <p>Each scraping search query costs <strong>$0.035 USD</strong> and yields up to <strong>20 complete business profiles</strong>.</p>
              <div className="quota-tag">Approx ₹3.03 INR per 20 Leads (₹0.15 / lead)</div>
            </div>

            <div className="admin-info-card">
              <div className="info-card-head">
                <ShieldCheck size={18} className="info-icon blue" />
                <h4>Zero Risk & Hard Limit Safety</h4>
              </div>
              <p>You will not be billed by Google Cloud as long as your total usage stays below the monthly $200 free tier allowance.</p>
              <div className="quota-tag">100% Safe & Cost-Controlled</div>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Modal */}
      {showPricingModal && (
        <div className="modal-overlay animate-fade-in" onClick={() => setShowPricingModal(false)}>
          <div className="pricing-modal-card animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="pricing-modal-header">
              <div className="title-with-icon">
                <Info size={20} className="text-primary" />
                <h2>Google Places API (New) Official Pricing</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setShowPricingModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="pricing-modal-body">
              <div className="pricing-info-grid">
                <div className="pricing-tile">
                  <span className="tile-label">Free Monthly Credit</span>
                  <strong className="tile-value text-emerald">$200.00 USD</strong>
                  <span className="tile-sub">Renewed 1st of every month</span>
                </div>
                <div className="pricing-tile">
                  <span className="tile-label">Cost Per API Call</span>
                  <strong className="tile-value">$0.035 USD</strong>
                  <span className="tile-sub">Places API (New) TextSearch Pro</span>
                </div>
                <div className="pricing-tile">
                  <span className="tile-label">Lead Extraction Ratio</span>
                  <strong className="tile-value">Up to 20 Leads</strong>
                  <span className="tile-sub">Per individual API call</span>
                </div>
              </div>

              <div className="pricing-table-section">
                <h4 className="table-title">Cost Estimation Chart (USD & INR)</h4>
                <table className="pricing-comp-table">
                  <thead>
                    <tr>
                      <th>Leads Target</th>
                      <th>API Calls</th>
                      <th>Gross Cost (USD)</th>
                      <th>INR Equivalent</th>
                      <th>Out-of-Pocket</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>1,000 leads</strong></td>
                      <td>50 calls</td>
                      <td>$1.75</td>
                      <td>₹151.38</td>
                      <td><span className="badge-free">FREE ($0.00)</span></td>
                    </tr>
                    <tr>
                      <td><strong>5,000 leads</strong></td>
                      <td>250 calls</td>
                      <td>$8.75</td>
                      <td>₹756.88</td>
                      <td><span className="badge-free">FREE ($0.00)</span></td>
                    </tr>
                    <tr>
                      <td><strong>20,000 leads</strong></td>
                      <td>1,000 calls</td>
                      <td>$35.00</td>
                      <td>₹3,027.50</td>
                      <td><span className="badge-free">FREE ($0.00)</span></td>
                    </tr>
                    <tr>
                      <td><strong>50,000 leads</strong></td>
                      <td>2,500 calls</td>
                      <td>$87.50</td>
                      <td>₹7,568.75</td>
                      <td><span className="badge-free">FREE ($0.00)</span></td>
                    </tr>
                    <tr>
                      <td><strong>114,280 leads</strong></td>
                      <td>5,714 calls</td>
                      <td>$200.00</td>
                      <td>₹17,300.00</td>
                      <td><span className="badge-free">100% FREE CAP</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Administrative;
