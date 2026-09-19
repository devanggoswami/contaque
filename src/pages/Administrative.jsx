import React, { useState, useEffect, useCallback } from 'react';
import { 
  CreditCard, DollarSign, CheckCircle2, AlertCircle, RefreshCw, 
  Info, ShieldCheck, Zap, Layers, ChevronRight, X, ArrowUpRight,
  Terminal, Database
} from 'lucide-react';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import './Administrative.css';

function Administrative() {
  const { authFetch } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showPricingModal, setShowPricingModal] = useState(false);

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

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

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

  return (
    <div className="page-content animate-slide-up">
      {/* Header */}
      <div className="admin-header-bar">
        <div>
          <div className="admin-greeting">
            <ShieldCheck size={14} />
            <span>ENTERPRISE CONTROL HUB</span>
          </div>
          <h1 className="admin-title">Administrative & Billing</h1>
          <p className="admin-subtitle">Monitor Google Cloud API quotas, billing consumption, and monthly credit balance</p>
        </div>

        <div className="admin-header-actions">
          <button 
            className={`refresh-icon-btn ${isRefreshing ? 'spinning' : ''}`} 
            onClick={() => fetchAdminData(true)}
            title="Refresh Billing Data"
          >
            <RefreshCw size={16} />
          </button>
          <button className="pricing-btn" onClick={() => setShowPricingModal(true)}>
            <Info size={15} />
            <span>Pricing Breakdown</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="telemetry-error-banner animate-fade-in">
          <AlertCircle size={18} />
          <span>Billing Telemetry Warning: {error}</span>
        </div>
      )}

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

      {/* Engine Pipeline Inspector Card (Shifted from Generate Data) */}
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
