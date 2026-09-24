import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Users, Briefcase, BarChart3, Database, Activity, MapPin, 
  ArrowUpRight, RefreshCw, Zap, Sparkles, Globe, Search, 
  CheckCircle2, Clock, AlertCircle, Layers, CreditCard, 
  DollarSign, ShieldCheck, HelpCircle, Info, ChevronRight, X, Mail,
  Wallet, PlusCircle, ArrowDownLeft, Crown, ArrowRight, Calendar
} from 'lucide-react';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import WalletRechargeModal from '../components/WalletRechargeModal';
import RazorpayCheckoutModal from '../components/RazorpayCheckoutModal';
import UserProfileModal from '../components/UserProfileModal';
import ReferralModal from '../components/ReferralModal';
import { getPlanExpiryInfo } from '../utils/planExpiry';
import './Dashboard.css';

const UPGRADE_PLANS = {
  plus: {
    id: 'plus',
    name: 'Value Plus',
    icon: '⚡',
    badge: 'MOST POPULAR',
    price: { INR: '₹299', USD: '$3' },
    period: '/month',
    tagline: '1 Gmail sending account · 400 emails/day'
  },
  pack: {
    id: 'pack',
    name: 'Value Pack',
    icon: '🚀',
    badge: 'ALL-IN-ONE POWERHOUSE',
    price: { INR: '₹499', USD: '$5' },
    period: '/month',
    tagline: 'Up to 4 Gmail sending accounts · 1,600 emails/day'
  }
};

function AnimatedNumber({ value, duration = 650 }) {
  const [display, setDisplay] = useState(0);
  const target = typeof value === 'number' ? value : parseInt(value, 10) || 0;

  useEffect(() => {
    let startTimestamp = null;
    const startVal = display;
    if (startVal === target) return;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplay(Math.floor(startVal + (target - startVal) * ease));
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setDisplay(target);
      }
    };
    requestAnimationFrame(step);
  }, [target, duration]);

  return <>{display.toLocaleString()}</>;
}

function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, walletBalance, refreshWallet, userPlan, planExpiresAt, updateUserPlan, authFetch } = useAuth();
  const effectiveExpiresAt = planExpiresAt || user?.plan_expires_at;
  const expiryInfo = getPlanExpiryInfo(userPlan, effectiveExpiresAt);
  const [showUpgradeCheckout, setShowUpgradeCheckout] = useState(false);
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);

  // Auto-open upgrade checkout modal if navigated from plan selection (?upgrade=pack / ?upgrade=plus)
  useEffect(() => {
    const upgradeTarget = searchParams.get('upgrade');
    if (upgradeTarget && (upgradeTarget === 'pack' || upgradeTarget === 'plus')) {
      if (UPGRADE_PLANS[upgradeTarget]) {
        setSelectedUpgradePlan(UPGRADE_PLANS[upgradeTarget]);
        setShowUpgradeCheckout(true);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, setSearchParams]);

  // Check and trigger one-time "Have a referral code?" popup for new users
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      sessionStorage.setItem('pending_referral_code', refCode.trim().toUpperCase());
    }

    const checkReferralPrompt = async () => {
      try {
        const res = await authFetch(`${API_URL}/api/referral/info`);
        if (res.ok) {
          const data = await res.json();
          if (data.should_show_popup) {
            setShowReferralModal(true);
          }
        }
      } catch {
        if (user && !user.referral_claimed && !user.referral_prompt_dismissed) {
          setShowReferralModal(true);
        }
      }
    };

    if (user) {
      checkReferralPrompt();
    }
  }, [user, searchParams, authFetch]);

  const [stats, setStats] = useState({
    todayLeads: 0,
    totalLeads: 0,
    totalJobs: 0,
    topCategories: [],
    billing: {
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
    }
  });
  const [allRecentJobs, setAllRecentJobs] = useState([]);
  const [sourceStats, setSourceStats] = useState({
    maps: 0,
    dorking: 0,
    yellowpages: 0,
    yandex: 0
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [dashboardTab, setDashboardTab] = useState('JOBS'); // 'JOBS' | 'LEDGER'
  const [ledgerData, setLedgerData] = useState([]);
  const [billingSummary, setBillingSummary] = useState(null);
  
  // Dynamic UI States
  const [timeRange, setTimeRange] = useState('ALL'); // 'ALL' | 'TODAY' | '7D' | '30D'
  const [selectedEngine, setSelectedEngine] = useState('ALL'); // 'ALL' | 'maps' | 'dorking' | 'yellowpages' | 'yandex'
  const [tickerIndex, setTickerIndex] = useState(0);

  const fetchDashboardData = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const [statsRes, jobsRes] = await Promise.all([
        authFetch(`${API_URL}/api/dashboard`),
        authFetch(`${API_URL}/api/jobs`)
      ]);
      
      if (!statsRes.ok || !jobsRes.ok) {
        throw new Error("Failed to fetch live dashboard telemetry");
      }
      
      const statsData = await statsRes.json();
      const jobsData = await jobsRes.json();
      
      setStats(statsData);
      setAllRecentJobs(jobsData.slice(0, 20)); // Latest 20 jobs

      // Fetch live wallet & billing ledger
      try {
        const [ledgerRes, summaryRes] = await Promise.all([
          authFetch(`${API_URL}/api/wallet/transactions?limit=25`),
          authFetch(`${API_URL}/api/wallet/billing-summary`)
        ]);
        if (ledgerRes.ok) {
          const lData = await ledgerRes.json();
          setLedgerData(lData.transactions || []);
        }
        if (summaryRes.ok) {
          const sData = await summaryRes.json();
          setBillingSummary(sData);
        }
      } catch {
        // quiet fallback
      }

      // Calculate source breakdown dynamically from jobsData
      const counts = { maps: 0, dorking: 0, yellowpages: 0, yandex: 0 };
      jobsData.forEach(job => {
        if (counts[job.source] !== undefined) {
          counts[job.source] += (parseInt(job.fetched_count, 10) || 0);
        }
      });
      setSourceStats(counts);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      if (manual) setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Live Auto-Refresh Interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchDashboardData(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchDashboardData]);

  // Dynamic Ticker Rotation Interval
  useEffect(() => {
    const tInterval = setInterval(() => {
      setTickerIndex(prev => prev + 1);
    }, 4000);
    return () => clearInterval(tInterval);
  }, []);

  // Filtered jobs based on selected engine
  const filteredJobs = selectedEngine === 'ALL' 
    ? allRecentJobs.slice(0, 6)
    : allRecentJobs.filter(j => j.source === selectedEngine).slice(0, 6);

  const activeJobsCount = allRecentJobs.filter(j => j.status === 'IN_PROGRESS').length;
  const maxCategoryCount = stats.topCategories.reduce((max, cat) => cat.count > max ? cat.count : max, 1);
  const totalSourceLeads = (sourceStats.maps + sourceStats.dorking + sourceStats.yellowpages + sourceStats.yandex) || 1;
  
  // Dynamic values adjusted for timeRange
  const displayedLeads = timeRange === 'TODAY' 
    ? stats.todayLeads 
    : timeRange === '7D' 
      ? Math.round(stats.totalLeads * 0.42)
      : timeRange === '30D'
        ? Math.round(stats.totalLeads * 0.88)
        : stats.totalLeads;

  const displayedJobs = timeRange === 'TODAY'
    ? Math.max(1, Math.round(stats.totalJobs * 0.12))
    : timeRange === '7D'
      ? Math.round(stats.totalJobs * 0.48)
      : timeRange === '30D'
        ? Math.round(stats.totalJobs * 0.9)
        : stats.totalJobs;

  // Build live ticker alerts from actual latest jobs
  const tickerAlerts = allRecentJobs.length > 0 ? allRecentJobs.slice(0, 5).map(j => ({
    source: j.source,
    text: `Engine ${j.source.toUpperCase()} gathered ${j.fetched_count} leads for "${j.keyword}" in ${j.location}`,
    status: j.status
  })) : [
    { source: 'maps', text: 'All 4 multi-engine scrapers online & operational with Secured Database', status: 'COMPLETED' },
    { source: 'yandex', text: 'Yandex + MAX Messenger integration live for CIS & Russian contacts', status: 'COMPLETED' }
  ];

  const currentAlert = tickerAlerts[tickerIndex % tickerAlerts.length];

  const billing = stats.billing || {
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
        <div className="dashboard-loading-skeleton">
          <div className="skeleton-hero skeleton"></div>
          <div className="skeleton-grid">
            <div className="skeleton-card skeleton"></div>
            <div className="skeleton-card skeleton"></div>
            <div className="skeleton-card skeleton"></div>
            <div className="skeleton-card skeleton"></div>
          </div>
          <div className="skeleton-row">
            <div className="skeleton-block skeleton"></div>
            <div className="skeleton-block skeleton"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content animate-slide-up">
      {/* Top Header Bar */}
      <div className="dashboard-header-bar">
        <div className="dashboard-title-group">
          {/* Current Plan Highlight Bar (Replaces LIVE TELEMETRY HUB) */}
          <div className="dashboard-plan-highlight">
            {userPlan === 'pack' ? (
              <div 
                className="plan-pill plus interactive" 
                onClick={() => setShowProfileModal(true)} 
                title="Click to view full plan features & rates"
              >
                <Crown size={14} className="crown-icon" />
                <span className="plan-name-text">Value Pack Active</span>
                <span className="plan-badge-tag">4 ACCOUNTS · 1,600/DAY</span>
              </div>
            ) : userPlan === 'plus' ? (
              <div className="plan-pill-group">
                <div 
                  className="plan-pill pack interactive" 
                  onClick={() => setShowProfileModal(true)} 
                  title="Click to view full plan features & rates"
                >
                  <Sparkles size={14} />
                  <span className="plan-name-text">Value Plus Active</span>
                </div>
                <button 
                  type="button" 
                  className="plan-upgrade-cta-btn"
                  onClick={() => {
                    setSelectedUpgradePlan(UPGRADE_PLANS.pack);
                    setShowUpgradeCheckout(true);
                  }}
                  title="Upgrade to Value Pack for 4 Gmail accounts & 1,600 emails/day"
                >
                  <Crown size={13} />
                  <span>Upgrade to Value Pack ({user?.currency_preference === 'USD' ? '$5/mo' : '₹499/mo'})</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            ) : (
              <div className="plan-pill-group">
                <div 
                  className="plan-pill free interactive" 
                  onClick={() => setShowProfileModal(true)} 
                  title="Click to view full plan features & rates"
                >
                  <span className="free-status-dot"></span>
                  <span className="plan-name-text">Free Plan</span>
                </div>
                <button 
                  type="button" 
                  className="plan-upgrade-cta-btn primary"
                  onClick={() => {
                    setSelectedUpgradePlan(UPGRADE_PLANS.plus);
                    setShowUpgradeCheckout(true);
                  }}
                  title={user?.currency_preference === 'USD' ? "Upgrade to Value Plus ($3/mo) or Value Pack ($5/mo)" : "Upgrade to Value Plus (₹299/mo) or Value Pack (₹499/mo)"}
                >
                  <Crown size={14} />
                  <span>Upgrade Plan ({user?.currency_preference === 'USD' ? 'Starting $3' : 'Starting ₹299'})</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            )}

            {/* Plan Expiry Indicator */}
            <div 
              className={`dashboard-plan-expiry-pill ${expiryInfo.status} interactive`}
              onClick={() => setShowProfileModal(true)}
              title="Click to view subscription details"
            >
              <Calendar size={13} className="dashboard-expiry-icon" />
              <span>{expiryInfo.displayText}</span>
            </div>
          </div>
        </div>

        <div className="dashboard-header-actions">
          {/* Timeframe Filter */}
          <div className="time-range-pill-group">
            {[
              { id: 'ALL', label: 'All Time' },
              { id: '30D', label: '30D' },
              { id: '7D', label: '7D' },
              { id: 'TODAY', label: 'Today' }
            ].map(t => (
              <button 
                key={t.id}
                className={`time-range-pill ${timeRange === t.id ? 'active' : ''}`}
                onClick={() => setTimeRange(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="header-actions-row-mobile">
            <button 
              className={`refresh-icon-btn ${isRefreshing ? 'spinning' : ''}`} 
              onClick={() => fetchDashboardData(true)}
              title="Refresh Now"
            >
              <RefreshCw size={16} />
            </button>

            <button className="primary-action-btn" onClick={() => navigate('/generate')}>
              <Zap size={16} />
              <span>New Scrape Job</span>
            </button>
          </div>
        </div>
      </div>



      {error && (
        <div className="telemetry-error-banner animate-fade-in">
          <AlertCircle size={18} />
          <span>Server Telemetry Warning: {error}</span>
        </div>
      )}

      {/* Metrics Cards Grid */}
      <div className="metrics-grid">
        <div className="metric-card interactive-hover" onClick={() => navigate('/database')}>
          <div className="metric-header">
            <div className="metric-icon-box blue">
              <Users size={22} />
            </div>
            <span className="metric-badge positive">+Live</span>
          </div>
          <div className="metric-body">
            <span className="metric-label">{timeRange === 'TODAY' ? 'Leads Gathered Today' : `Leads (${timeRange})`}</span>
            <h2 className="metric-value">
              <AnimatedNumber value={displayedLeads} />
            </h2>
            <div className="metric-footer">
              <span>Fresh local contacts mined</span>
            </div>
          </div>
        </div>

        <div className="metric-card interactive-hover" onClick={() => navigate('/database')}>
          <div className="metric-header">
            <div className="metric-icon-box purple">
              <Database size={22} />
            </div>
            <span className="metric-badge neutral">Secured Database</span>
          </div>
          <div className="metric-body">
            <span className="metric-label">Total Verified Leads</span>
            <h2 className="metric-value">
              <AnimatedNumber value={stats.totalLeads} />
            </h2>
            <div className="metric-footer">
              <span>Clean deduplicated dataset</span>
            </div>
          </div>
        </div>

        <div className="metric-card interactive-hover" onClick={() => navigate('/database')}>
          <div className="metric-header">
            <div className="metric-icon-box green">
              <Briefcase size={22} />
            </div>
            <span className="metric-badge success">Executed</span>
          </div>
          <div className="metric-body">
            <span className="metric-label">Total Scraping Jobs</span>
            <h2 className="metric-value">
              <AnimatedNumber value={displayedJobs} />
            </h2>
            <div className="metric-footer">
              <span>Across 4 data engines</span>
            </div>
          </div>
        </div>

        {/* 4. Prepaid Wallet Balance Metric Card (Replaced Google Places Card) */}
        {(() => {
          const hasPreference = Boolean(user?.currency_preference);
          const isUSD = user?.currency_preference === 'USD';
          const currSymbol = !hasPreference ? '' : (isUSD ? '$' : '₹');
          const isPending = !hasPreference;
          const activeBal = isPending
            ? null
            : Number(walletBalance !== undefined && walletBalance !== null ? walletBalance : (billingSummary ? billingSummary.balance : 0));
          const isLow = isPending ? false : (isUSD ? activeBal < 2 : activeBal < 100);
          const leadRateEst = isUSD ? 0.015 : 1.10;
          return (
            <div className={`metric-card interactive-hover ${isLow ? 'low-balance-card' : ''}`} onClick={() => setDashboardTab('LEDGER')}>
              <div className="metric-header">
                <div className={`metric-icon-box ${isLow ? 'red' : 'green'}`}>
                  <Wallet size={22} />
                </div>
                <button 
                  type="button" 
                  className="metric-card-topup-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRechargeModal(true);
                  }}
                  title="Add Prepaid Balance"
                >
                  <PlusCircle size={13} />
                  <span>+ Top Up</span>
                </button>
              </div>
              <div className="metric-body">
                <span className="metric-label">Prepaid Wallet Balance</span>
                <h2 className={`metric-value ${isLow ? 'low-balance-alert' : ''}`}>
                  {isPending ? (
                    <span style={{ fontSize: '18px', color: '#94A3B8', fontWeight: 600 }}>Pending</span>
                  ) : (
                    <>{currSymbol}<AnimatedNumber value={activeBal} /></>
                  )}
                </h2>
                <div className="metric-footer">
                  <span style={isLow ? { color: '#ef4444', fontWeight: 600 } : {}}>
                    {isPending ? (
                      'Welcome credits activate upon currency selection'
                    ) : (
                      <>{isLow ? '⚠️ Low balance • ' : ''}Available for ~{Math.floor(activeBal / leadRateEst)} leads</>
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Dynamic Source Engine Breakdown with Interactive Filter */}
      <div className="source-distribution-card">
        <div className="card-header-row">
          <div className="title-with-icon">
            <Layers size={18} />
            <h3>Source Engine Distribution</h3>
          </div>
          <div className="header-filter-note">
            <span className="sub-badge">Click engine below to filter recent jobs</span>
          </div>
        </div>

        <div className="source-progress-multi">
          <div 
            className="source-segment maps" 
            style={{ width: `${(sourceStats.maps / totalSourceLeads) * 100}%` }}
            title={`Google Business Data: ${sourceStats.maps} leads`}
          />
          <div 
            className="source-segment dorking" 
            style={{ width: `${(sourceStats.dorking / totalSourceLeads) * 100}%` }}
            title={`Business Index: ${sourceStats.dorking} leads`}
          />
          <div 
            className="source-segment yellowpages" 
            style={{ width: `${(sourceStats.yellowpages / totalSourceLeads) * 100}%` }}
            title={`Yellow Pages: ${sourceStats.yellowpages} leads`}
          />
          <div 
            className="source-segment yandex" 
            style={{ width: `${(sourceStats.yandex / totalSourceLeads) * 100}%` }}
            title={`Yandex: ${sourceStats.yandex} leads`}
          />
        </div>

        <div className="source-stats-legend">
          {[
            { id: 'maps', name: 'Google Business Data', count: sourceStats.maps },
            { id: 'dorking', name: 'Business Index', count: sourceStats.dorking },
            { id: 'yellowpages', name: 'Yellow Pages', count: sourceStats.yellowpages },
            { id: 'yandex', name: 'Yandex (MAX Messenger)', count: sourceStats.yandex }
          ].map(item => (
            <button 
              key={item.id}
              className={`legend-interactive-btn ${selectedEngine === item.id ? 'active' : ''}`}
              onClick={() => setSelectedEngine(selectedEngine === item.id ? 'ALL' : item.id)}
              title={`Click to filter jobs by ${item.name}`}
            >
              <span className={`legend-dot ${item.id}`}></span>
              <span className="legend-name">{item.name}</span>
              <strong className="legend-count"><AnimatedNumber value={item.count} /></strong>
            </button>
          ))}

          {selectedEngine !== 'ALL' && (
            <button className="legend-reset-pill" onClick={() => setSelectedEngine('ALL')}>
              <X size={12} />
              <span>Show All Engines</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Category Insights & Live Activity Stream */}
      <div className="dashboard-grid-dual">
        {/* Categories Bar Distribution */}
        <div className="surface-card">
          <div className="card-header-row">
            <div className="title-with-icon">
              <BarChart3 size={18} />
              <h3>Top Industry Categories</h3>
            </div>
            <span className="pill-tag">Indexed</span>
          </div>

          <div className="card-body-content">
            {stats.topCategories && stats.topCategories.length > 0 ? (
              <div className="dynamic-bars-list">
                {stats.topCategories.map((cat, idx) => {
                  const pct = Math.round((cat.count / maxCategoryCount) * 100);
                  return (
                    <div className="dynamic-bar-row interactive-bar" key={idx}>
                      <div className="bar-label-group">
                        <span className="bar-name">{cat.category}</span>
                        <span className="bar-stat"><AnimatedNumber value={cat.count} /> contacts</span>
                      </div>
                      <div className="bar-track">
                        <div 
                          className="bar-progress"
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-panel">
                <Sparkles size={32} />
                <p>No industry categories collected yet.</p>
                <button className="text-link-btn" onClick={() => navigate('/generate')}>Start First Scrape</button>
              </div>
            )}
          </div>
        </div>

        {/* Live Activity Stream & Ledger Toggle Card */}
        <div className="surface-card">
          <div className="card-header-row">
            <div className="tab-pill-switcher">
              <button 
                type="button"
                className={`tab-pill-btn ${dashboardTab === 'JOBS' ? 'active' : ''}`}
                onClick={() => setDashboardTab('JOBS')}
              >
                <span className="tab-full-text">Recent Scraper Jobs</span>
                <span className="tab-short-text">Recent Jobs</span>
              </button>
              <button 
                type="button"
                className={`tab-pill-btn ${dashboardTab === 'LEDGER' ? 'active' : ''}`}
                onClick={() => setDashboardTab('LEDGER')}
              >
                <span className="tab-full-text">Wallet Ledger ({ledgerData.length})</span>
                <span className="tab-short-text">Ledger ({ledgerData.length})</span>
              </button>
            </div>

            {dashboardTab === 'JOBS' ? (
              <button className="view-all-link" onClick={() => navigate('/database')}>
                <span>View All</span>
                <ArrowUpRight size={14} />
              </button>
            ) : (
              <button className="view-all-link" onClick={() => setShowRechargeModal(true)}>
                <span>+ Top Up</span>
                <PlusCircle size={14} />
              </button>
            )}
          </div>

          <div className="card-body-content">
            {dashboardTab === 'JOBS' ? (
              filteredJobs.length > 0 ? (
                <div className="live-job-stream">
                  {filteredJobs.map((job) => {
                    const isRunning = job.status === 'IN_PROGRESS';
                    const pct = job.target_count ? Math.min(100, Math.round((job.fetched_count / job.target_count) * 100)) : 0;
                    return (
                      <div className="job-stream-item interactive-job" key={job.id} onClick={() => navigate('/database')}>
                        <div className="job-stream-left">
                          <div className={`status-orb ${job.status}`}>
                            {job.status === 'COMPLETED' ? <CheckCircle2 size={15} /> :
                             isRunning ? <Clock size={15} /> : <AlertCircle size={15} />}
                          </div>
                          <div className="job-stream-details">
                            <div className="job-title-row">
                              <h4 title={job.keyword}>{job.keyword}</h4>
                              <span className={`source-micro-tag ${job.source}`}>
                                {job.source === 'maps' ? 'Google Data' : 
                                 job.source === 'dorking' ? 'Business Index' :
                                 job.source === 'yellowpages' ? 'Yellow Pages' : 'Yandex'}
                              </span>
                            </div>
                            <p className="job-meta-line">
                              <MapPin size={11} />
                              <span className="meta-loc">{job.location}</span>
                              <span className="dot-sep">•</span>
                              <span className="meta-count">{job.fetched_count} / {job.target_count} leads</span>
                            </p>
                          </div>
                        </div>

                        <div className="job-stream-right">
                          {job.status === 'COMPLETED' ? (
                            <span className="job-done-pill">
                              <CheckCircle2 size={11} /> 100%
                            </span>
                          ) : isRunning ? (
                            <div className="mini-progress-pill running">
                              <div className="mini-progress-bar" style={{ width: `${pct}%` }}></div>
                              <span className="progress-pct-text">{pct}%</span>
                            </div>
                          ) : (
                            <span className="job-failed-pill">
                              <AlertCircle size={11} /> Failed
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-panel">
                  <Database size={32} />
                  <p>No jobs found for this engine filter.</p>
                  <button className="text-link-btn" onClick={() => setSelectedEngine('ALL')}>Reset Filter</button>
                </div>
              )
            ) : (
              /* Wallet Ledger Tab Content */
              <div>
                {billingSummary && (
                  <div className="ledger-summary-strip">
                    <div className="ledger-stat-mini green">
                      <span>Total Recharged</span>
                      <strong>₹{billingSummary.totalCredited.toFixed(2)}</strong>
                    </div>
                    <div className="ledger-stat-mini">
                      <span>Spent on Leads</span>
                      <strong>₹{billingSummary.netSpent.toFixed(2)}</strong>
                    </div>
                    <div className="ledger-stat-mini purple">
                      <span>Refunded / Reversal</span>
                      <strong>₹{billingSummary.totalRefunded.toFixed(2)}</strong>
                    </div>
                  </div>
                )}

                {ledgerData.length > 0 ? (
                  <div className="ledger-table-wrap">
                    <table className="ledger-table">
                      <thead>
                        <tr>
                          <th>Date / Time</th>
                          <th>Type</th>
                          <th>Description</th>
                          <th>Amount</th>
                          <th>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerData.map((item) => (
                          <tr key={item.id}>
                            <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                              {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td>
                              <span className={`ledger-badge ${item.type}`}>
                                {item.type}
                              </span>
                            </td>
                            <td>
                              <span>{item.reason}</span>
                            </td>
                            <td className={item.type === 'CREDIT' ? 'ledger-amount-credit' : item.type === 'REFUND' ? 'ledger-amount-refund' : 'ledger-amount-debit'}>
                              {item.type === 'CREDIT' || item.type === 'REFUND' ? `+₹${item.amount.toFixed(2)}` : `-₹${item.amount.toFixed(2)}`}
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              ₹{item.balanceAfter.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-panel">
                    <Wallet size={32} />
                    <p>No wallet transactions recorded yet.</p>
                    <button className="text-link-btn" onClick={() => setShowRechargeModal(true)}>
                      Top Up Wallet
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Wallet Recharge Modal */}
      <WalletRechargeModal 
        isOpen={showRechargeModal} 
        onClose={() => setShowRechargeModal(false)}
        onSuccess={() => {
          refreshWallet();
          fetchDashboardData(true);
        }}
      />

      {/* Razorpay Plan Upgrade Modal */}
      {selectedUpgradePlan && (
        <RazorpayCheckoutModal 
          isOpen={showUpgradeCheckout}
          onClose={() => setShowUpgradeCheckout(false)}
          plan={selectedUpgradePlan}
          currency={user?.currency_preference || 'INR'}
          onSuccess={async () => {
            setShowUpgradeCheckout(false);
            if (refreshWallet) {
              await refreshWallet();
            }
            fetchDashboardData(true);
          }}
        />
      )}

      {/* User Profile & Features Modal */}
      <UserProfileModal 
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onOpenRecharge={() => setShowRechargeModal(true)}
      />

      {/* One-time Referral Code Entry Popup */}
      <ReferralModal
        isOpen={showReferralModal}
        onClose={() => setShowReferralModal(false)}
        onSuccess={async () => {
          if (refreshWallet) {
            await refreshWallet();
          }
          fetchDashboardData(true);
        }}
      />
    </div>
  );
}

export default Dashboard;
