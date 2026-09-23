import React, { useState, useEffect, useCallback } from 'react';
import { 
  Mail, Send, Settings, UserPlus, Play, Pause, Trash2, 
  Activity, Download, FileSpreadsheet, FileText, CheckCircle2, 
  Search, Filter, Globe, Phone, Share2, Sparkles, Check, X, RefreshCw,
  Info, Clock, AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API_URL } from '../config';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LockedFeatureGate from '../components/LockedFeatureGate';
import './Campaigns.css';

// DD/MM/YYYY hh:mm AM/PM Formatter
const formatDateTime = (dateStr) => {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? String(hours).padStart(2, '0') : '12';
  
  return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
};

function Campaigns() {
  const { authFetch, userPlan, user } = useAuth();
  const hasAccess = userPlan === 'plus' || userPlan === 'pack' || user?.role === 'Administrator' || user?.isAdmin;
  const [activeTab, setActiveTab] = useState('STUDIO'); // STUDIO, DASHBOARD, ACCOUNTS
  
  // Data
  const [accounts, setAccounts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [limits, setLimits] = useState({
    plan: userPlan || 'free',
    planName: userPlan === 'pack' ? 'Value Pack' : (userPlan === 'plus' ? 'Value Plus' : 'Free Plan'),
    maxAccounts: userPlan === 'pack' ? 4 : (userPlan === 'plus' ? 1 : 0),
    dailyEmailLimit: userPlan === 'pack' ? 1600 : (userPlan === 'plus' ? 400 : 0),
    dailySentToday: 0,
    canAddAccount: userPlan === 'pack' || userPlan === 'plus',
    accountLimitReached: false,
    entitlementLabel: userPlan === 'pack' ? '4 Gmail accounts · 1,600 emails/day' : (userPlan === 'plus' ? '1 Gmail account · 400 emails/day' : '0 Gmail accounts · 0 emails/day'),
    usageLabel: '0 emails used today'
  });
  
  // Form States
  const [newAccount, setNewAccount] = useState({ email: '', app_password: '' });
  const [newCampaign, setNewCampaign] = useState({ name: '', subject: '', body_html: '', target_mode: 'ALL', target_job_ids: [], manual_emails: '', image_link: '' });
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [jobSearch, setJobSearch] = useState('');
  const [gmailOnly, setGmailOnly] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [accRes, campRes, jobRes, limRes] = await Promise.all([
        authFetch(`${API_URL}/api/campaigns/accounts`),
        authFetch(`${API_URL}/api/campaigns/list`),
        authFetch(`${API_URL}/api/jobs`),
        authFetch(`${API_URL}/api/campaigns/limits`)
      ]);
      const accData = await accRes.json();
      const campData = await campRes.json();
      const jobData = await jobRes.json();
      if (limRes.ok) {
        const limData = await limRes.json();
        setLimits(limData);
      }
      setAccounts(Array.isArray(accData) ? accData : []);
      setCampaigns(Array.isArray(campData) ? campData : []);
      setJobs(Array.isArray(jobData) ? jobData : []);
    } catch (e) {
      console.error(e);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!hasAccess) return;
    fetchData();
    const int = setInterval(fetchData, 10000);
    return () => clearInterval(int);
  }, [hasAccess, fetchData]);

  // Robust Text Sanitizer to eliminate crashed / mojibake characters and unwanted domain slugs
  const sanitizeText = (text) => {
    if (!text) return '';
    let str = String(text);
    // Remove control characters & non-printable bytes
    str = str.replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F\uFFFD\uFEFF]/g, '');
    // Remove corrupted high-byte garbage sequences (e.g. þÿþÛ þÈţ þ› etc.)
    str = str.replace(/[\u00FE\u00FF\u00FD\u00DE\u00DF\u00C0-\u00C6\u00D0-\u00D6\u00D8-\u00DF\u00E0-\u00E6\u00F0-\u00F6\u00F8-\u00FD]{2,}/g, ' ');
    // Remove specific Yahoo artifact sequences
    str = str.replace(/Ø<[A-Za-z0-9\s&þ®ð›·]+/gi, ' ');
    str = str.replace(/[þÿ·ð®]+/gi, ' ');
    str = str.replace(/Â|â€¢|â€“|â€”|â€™|â€œ|â€/g, ' ');
    // Normalize spaces
    str = str.replace(/\s+/g, ' ').trim();
    return str;
  };

  const cleanBusinessName = (name) => {
    if (!name) return 'Business Contact';
    let str = sanitizeText(name);
    // Strip site domain prefixes like Facebookhttps://secure.facebook.com...
    str = str.replace(/^(?:Facebook|LinkedIn|Instagram|Twitter|YouTube|Crunchbase|GitHub)?(?:https?:\/\/[^\s]+)?/i, '');
    // Remove duplicated lowercase slug prefix concatenated with uppercase name
    const match = str.match(/^([a-z0-9_-]{4,20})([A-Z].*)$/);
    if (match && match[2] && match[2].length > 3) {
      str = match[2];
    }
    // Remove trailing site suffixes
    str = str.split(' | ')[0].split(' - Facebook')[0].split(' - LinkedIn')[0].split(' - Instagram')[0].trim();
    return str || 'Business Contact';
  };

  const cleanAddress = (addr, defaultLoc) => {
    if (!addr) return defaultLoc || 'Location';
    let str = sanitizeText(addr);
    str = str.replace(/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\s*[·•-]?\s*/i, '');
    str = str.replace(/^Posts\s+/i, '');
    if (str.length < 5) return defaultLoc || 'Location';
    return str.substring(0, 240);
  };

  const formatDisplayUrl = (url) => {
    if (!url || url === '-') return '-';
    try {
      let clean = url.replace(/^https?:\/\/(www\.)?/i, '');
      clean = clean.split('?')[0].split('#')[0];
      if (clean.length > 32) {
        clean = clean.substring(0, 30) + '...';
      }
      return clean.replace(/\/$/, '') || '-';
    } catch {
      return String(url).substring(0, 30);
    }
  };

  const formatSourceLabel = (url) => {
    if (!url || url === '-') return '-';
    if (url.includes('maps.google.com') || url.includes('google.com/maps')) {
      return 'Google Maps Profile';
    }
    if (url.includes('facebook.com')) {
      return 'Facebook Profile';
    }
    if (url.includes('instagram.com')) {
      return 'Instagram Profile';
    }
    if (url.includes('linkedin.com')) {
      return 'LinkedIn Profile';
    }
    if (url.includes('yellowpages.com') || url.includes('yell.com')) {
      return 'YellowPages Listing';
    }
    return formatDisplayUrl(url);
  };

  const cleanStr = (str) => {
    if (!str || str === 'undefined' || str === 'null') return '-';
    return String(str).trim();
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    if (limits && !limits.canAddAccount) {
      alert(limits.accountLimitReached 
        ? "You've reached the Gmail account limit for your current plan." 
        : "Please upgrade your plan to add sending accounts.");
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/campaigns/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAccount)
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || "Error adding account");
      } else {
        setNewAccount({ email: '', app_password: '' });
        fetchData();
      }
    } catch (e) {
      alert("Error adding account");
    }
    setLoading(false);
  };

  const handleDeleteAccount = async (id) => {
    if(!confirm("Delete this email account?")) return;
    try {
      await authFetch(`${API_URL}/api/campaigns/accounts/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) {}
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let attachment_filename = null;
      let attachment_type = null;

      if (attachmentFile) {
        const formData = new FormData();
        formData.append('attachment', attachmentFile);
        const uploadRes = await authFetch(`${API_URL}/api/campaigns/upload`, {
          method: 'POST',
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          attachment_filename = uploadData.filename;
          attachment_type = uploadData.type;
        } else {
          alert('Failed to upload file');
          setLoading(false);
          return;
        }
      }

      const payload = {
        ...newCampaign,
        attachment_filename,
        attachment_type
      };

      const res = await authFetch(`${API_URL}/api/campaigns/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert(`Campaign created! Queued ${data.queuedCount} emails.`);
        setNewCampaign({ name: '', subject: '', body_html: '', target_mode: 'ALL', target_job_ids: [], manual_emails: '', image_link: '' });
        setAttachmentFile(null);
        setActiveTab('DASHBOARD');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        fetchData();
      }
    } catch (e) {
      alert("Error creating campaign");
    }
    setLoading(false);
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'RUNNING' ? 'PAUSED' : 'RUNNING';
    try {
      await authFetch(`${API_URL}/api/campaigns/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchData();
    } catch(e) {}
  };

  const handleDeleteCampaign = async (id) => {
    if (!window.confirm("Are you sure you want to delete this campaign? This will also remove all pending emails for this campaign from the queue.")) return;
    try {
      await authFetch(`${API_URL}/api/campaigns/${id}`, {
        method: 'DELETE'
      });
      fetchData();
    } catch(e) {
      alert("Error deleting campaign");
    }
  };

  return (
    <LockedFeatureGate
      featureTitle="Campaign Studio"
      featureTagline="Automated Cold Email Outreach Engine"
      featureIcon={Mail}
      bullets={[
        "Multi-account Gmail & Google Workspace rotating sender engine",
        "Smart anti-spam rate limiting & automated background queue",
        "Rich personalized template editor with dynamic lead data merge",
        "Lowest extraction rates across all data mining engines"
      ]}
    >
      <div className="page-content animate-slide-up">
      <div className="campaigns-header">
        <div className="campaigns-title-group">
          <h1>Campaign Studio</h1>
          <p>Automate your cold email outreach using rotating Gmail App Passwords.</p>
        </div>

        {/* Rotating Border Live Toggle for Gmail Accounts Only */}
        <div 
          className={`gmail-rotating-badge-container ${!gmailOnly ? 'is-disabled' : ''}`}
          onClick={() => setGmailOnly(!gmailOnly)}
          title="Toggle Strict Gmail Accounts Mode"
        >
          <div className="gmail-rotating-badge-inner">
            <span className={`gmail-blink-dot ${!gmailOnly ? 'paused' : ''}`}></span>
            
            <div className="gmail-icon-badge">
              <svg width="15" height="15" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
            </div>

            <div className="gmail-text-group">
              <span className="gmail-title">Only Gmail Accounts Only</span>
              <span className="gmail-status-sub">{gmailOnly ? 'Active (Strict Filter)' : 'Disabled (All Domains)'}</span>
            </div>

            <div className={`gmail-toggle-track ${!gmailOnly ? 'off' : ''}`}>
              <div className="gmail-toggle-thumb"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="tabs-container">
        <button className={`tab-btn ${activeTab === 'STUDIO' ? 'active' : ''}`} onClick={() => setActiveTab('STUDIO')}>
          <Send size={15} /> 
          <span className="tab-text-desktop">Compose Campaign</span>
          <span className="tab-text-mobile">Compose</span>
        </button>
        <button className={`tab-btn ${activeTab === 'DASHBOARD' ? 'active' : ''}`} onClick={() => setActiveTab('DASHBOARD')}>
          <Activity size={15} /> 
          <span className="tab-text-desktop">Live Dashboard</span>
          <span className="tab-text-mobile">Dashboard</span>
        </button>
        <button className={`tab-btn ${activeTab === 'ACCOUNTS' ? 'active' : ''}`} onClick={() => setActiveTab('ACCOUNTS')}>
          <Settings size={15} /> 
          <span className="tab-text-desktop">Sending Accounts ({accounts.length})</span>
          <span className="tab-text-mobile">Accounts ({accounts.length})</span>
        </button>
      </div>

      {activeTab === 'STUDIO' && (
        <div className="card">
          <h2>Create New Campaign</h2>
          <form onSubmit={handleCreateCampaign}>
            <div className="form-group">
              <label>Campaign Internal Name</label>
              <input type="text" className="form-input" required value={newCampaign.name} onChange={e => setNewCampaign({...newCampaign, name: e.target.value})} placeholder="e.g., Q3 Software Companies Outreach" />
            </div>

            <div className="form-group">
              <label>Target Audience</label>
              
              <div className="target-mode-options">
                <label className="target-mode-label">
                  <input type="radio" name="targetMode" value="ALL" checked={newCampaign.target_mode === 'ALL'} onChange={() => setNewCampaign({...newCampaign, target_mode: 'ALL', target_job_ids: []})} />
                  <span>All Valid Emails</span>
                </label>
                <label className="target-mode-label">
                  <input type="radio" name="targetMode" value="SPECIFIC" checked={newCampaign.target_mode === 'SPECIFIC'} onChange={() => setNewCampaign({...newCampaign, target_mode: 'SPECIFIC'})} />
                  <span>Specific Jobs</span>
                </label>
                <label className="target-mode-label">
                  <input type="radio" name="targetMode" value="MANUAL" checked={newCampaign.target_mode === 'MANUAL'} onChange={() => setNewCampaign({...newCampaign, target_mode: 'MANUAL', target_job_ids: []})} />
                  <span>Manual Emails</span>
                </label>
              </div>

              {newCampaign.target_mode === 'SPECIFIC' && (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', background: 'var(--bg-card)' }}>
                  <div className="job-selection-header">
                    <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0, fontSize: '13px', fontWeight: '600'}}>
                      <input 
                        type="checkbox" 
                        checked={newCampaign.target_job_ids.length === jobs.length && jobs.length > 0}
                        onChange={e => {
                          if (e.target.checked) {
                            setNewCampaign({...newCampaign, target_job_ids: jobs.map(j => j.id)});
                          } else {
                            setNewCampaign({...newCampaign, target_job_ids: []});
                          }
                        }}
                      />
                      <span>Select All Jobs</span>
                    </label>
                    <input 
                      type="text" 
                      className="form-input job-search-input" 
                      placeholder="Search jobs..." 
                      value={jobSearch}
                      onChange={e => setJobSearch(e.target.value)}
                    />
                  </div>
                  
                  <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {jobs.filter(j => 
                      j.keyword.toLowerCase().includes(jobSearch.toLowerCase()) || 
                      j.location.toLowerCase().includes(jobSearch.toLowerCase()) ||
                      j.id.toString().includes(jobSearch)
                    ).map(j => (
                      <label key={j.id} style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'normal'}}>
                        <input 
                          type="checkbox" 
                          checked={newCampaign.target_job_ids.includes(j.id)}
                          onChange={e => {
                            let ids = [...newCampaign.target_job_ids];
                            if (e.target.checked) ids.push(j.id);
                            else ids = ids.filter(id => id !== j.id);
                            setNewCampaign({...newCampaign, target_job_ids: ids});
                          }}
                        />
                        Job #{j.id}: {j.keyword} in {j.location} <span style={{color: 'var(--text-muted)', fontSize: '12px'}}>({j.valid_emails_count || 0} emails)</span>
                      </label>
                    ))}
                  </div>

                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)', fontWeight: 'bold', color: 'var(--primary)' }}>
                    Total Valid Emails Selected: {
                      jobs.filter(j => newCampaign.target_job_ids.includes(j.id)).reduce((acc, curr) => acc + parseInt(curr.valid_emails_count || 0), 0)
                    }
                  </div>
                </div>
              )}

              {newCampaign.target_mode === 'MANUAL' && (
                <div style={{ marginTop: '10px' }}>
                  <label>Enter Email Addresses (comma separated)</label>
                  <textarea 
                    className="form-textarea" 
                    value={newCampaign.manual_emails}
                    onChange={e => setNewCampaign({...newCampaign, manual_emails: e.target.value})}
                    placeholder="john@example.com, alice@company.com"
                    style={{ minHeight: '60px' }}
                  />
                </div>
              )}
              
              {newCampaign.target_mode === 'ALL' && (
                <span className="help-text" style={{marginTop: '5px'}}>Will queue all valid extracted emails from the database.</span>
              )}
            </div>

            <div className="form-group">
              <label>Email Subject</label>
              <input type="text" className="form-input" required value={newCampaign.subject} onChange={e => setNewCampaign({...newCampaign, subject: e.target.value})} placeholder="Exclusive partnership with {{Business Name}}" />
            </div>

            <div className="form-group">
              <label>Email Body (Optional if Image/PDF Attached)</label>
              <span className="help-text" style={{marginBottom: '8px'}}>Available variables: {`{{Business Name}}, {{Category}}, {{Website}}, {{Address}}`}</span>
              <textarea 
                className="form-textarea" 
                value={newCampaign.body_html} 
                onChange={e => setNewCampaign({...newCampaign, body_html: e.target.value})}
                placeholder={`Hi team at {{Business Name}},\n\n(Optional - You can leave this blank to send ONLY your Image or PDF brochure)`}
              />
            </div>

            <div className="form-group" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <label>Attachment (Image / PDF)</label>
                <input 
                  type="file" 
                  className="form-input" 
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={e => setAttachmentFile(e.target.files[0])} 
                />
                <span className="help-text">If you upload an image, it will be embedded in the email.</span>
              </div>
              
              {attachmentFile && attachmentFile.type.startsWith('image/') && (
                <div style={{ flex: 1 }}>
                  <label>Image Redirect Link (Optional)</label>
                  <input 
                    type="url" 
                    className="form-input" 
                    value={newCampaign.image_link}
                    onChange={e => setNewCampaign({...newCampaign, image_link: e.target.value})}
                    placeholder="https://your-website.com" 
                  />
                  <span className="help-text">When users click the image, they will go here.</span>
                </div>
              )}
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              <Mail size={16} /> {loading ? 'Queuing Leads...' : 'Queue Campaign Engine'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'ACCOUNTS' && (
        <div className="grid-layout">
          {/* Plan Entitlement & Daily Quota Banner */}
          <div className="campaign-entitlement-banner">
            <div className="campaign-entitlement-info">
              <div className="campaign-entitlement-sub">Current Plan Entitlement</div>
              <div className="campaign-entitlement-title">
                {limits?.entitlementLabel || (userPlan === 'pack' ? '4 Gmail accounts · 1,600 emails/day' : '1 Gmail account · 400 emails/day')}
              </div>
            </div>
            <div className="campaign-quota-info">
              <div className="campaign-quota-sub">Daily Campaign Quota</div>
              <div className={`campaign-quota-value ${limits?.dailyLimitReached ? 'limit-reached' : ''}`}>
                {limits?.usageLabel || `${limits?.dailySentToday || 0} / ${limits?.dailyEmailLimit || 400} emails used today`}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header-flex">
              <h2 style={{margin: 0}}>Add Gmail Account</h2>
              <span className="badge" style={{background: limits?.accountLimitReached ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)', color: limits?.accountLimitReached ? '#ef4444' : '#22c55e', border: 'none', padding: '4px 10px'}}>
                {accounts.length} / {limits?.maxAccounts || 1} Accounts Used
              </span>
            </div>

            {limits?.accountLimitReached && (
              <div style={{background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', padding: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444', fontSize: '13px'}}>
                <AlertCircle size={16} style={{flexShrink: 0}} />
                <span>You've reached the Gmail account limit for your current plan.</span>
              </div>
            )}

            <form onSubmit={handleAddAccount} className="account-form">
              <div className="form-group account-form-group">
                <label>Gmail Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  required 
                  disabled={limits?.accountLimitReached || loading}
                  value={newAccount.email} 
                  onChange={e => setNewAccount({...newAccount, email: e.target.value})} 
                  placeholder="you@gmail.com" 
                />
              </div>
              <div className="form-group account-form-group">
                <label>16-Digit App Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  required 
                  disabled={limits?.accountLimitReached || loading}
                  value={newAccount.app_password} 
                  onChange={e => setNewAccount({...newAccount, app_password: e.target.value})} 
                  placeholder="abcd efgh ijkl mnop" 
                />
              </div>
              <button 
                type="submit" 
                className="btn-primary account-submit-btn" 
                disabled={loading || limits?.accountLimitReached}
                title={limits?.accountLimitReached ? "Account limit reached" : ""}
              >
                <UserPlus size={16} /> Add Account
              </button>
            </form>
            <span className="help-text" style={{marginTop: '12px', display: 'block', lineHeight: '1.6'}}>
              Note: You must enable 2-Step Verification on your Google Account. Direct Link: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline'}}>Generate 16-Digit App Password ↗</a>. The system rotates across your sending accounts up to your plan's daily limit ({limits?.dailyEmailLimit ? limits.dailyEmailLimit.toLocaleString() : 400} emails/day).
            </span>
            <span className="help-text" style={{marginTop: '8px', display: 'block', lineHeight: '1.6', color: 'var(--text-muted)'}}>
              💬 Stuck or need assistance adding your account? Please <Link to="/help" style={{color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline'}}>raise a support ticket</Link> and our team will help you set it up.
            </span>
          </div>

          <div className="card">
            <h2>Active Sending Accounts</h2>
            
            {/* Desktop Table View */}
            <div className="desktop-table-view table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email Address</th>
                    <th>Status</th>
                    <th>Sent Today</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.length === 0 ? (
                    <tr><td colSpan="4">No accounts added yet.</td></tr>
                  ) : accounts.map(acc => (
                    <tr key={acc.id}>
                      <td><strong>{acc.email}</strong></td>
                      <td><span className={`badge ${acc.status.toLowerCase()}`}>{acc.status}</span></td>
                      <td>{acc.daily_sent_count} / 400 <span style={{fontSize: '10px', color: '#94a3b8'}}>(Safe Limit)</span></td>
                      <td>
                        <button className="btn-danger" onClick={() => handleDeleteAccount(acc.id)}><Trash2 size={14}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="mobile-cards-view">
              {accounts.length === 0 ? (
                <div style={{textAlign: 'center', padding: '24px 10px', color: 'var(--text-muted)'}}>No accounts added yet.</div>
              ) : accounts.map(acc => (
                <div key={acc.id} className="mobile-account-card">
                  <div className="mobile-acc-top">
                    <div className="mobile-acc-email">{acc.email}</div>
                    <span className={`badge ${acc.status.toLowerCase()}`}>{acc.status}</span>
                  </div>
                  <div className="mobile-acc-bottom">
                    <div className="mobile-acc-quota">
                      Sent Today: <strong>{acc.daily_sent_count} / 400</strong>
                    </div>
                    <button className="btn-danger" style={{padding: '6px 12px', fontSize: '11.5px'}} onClick={() => handleDeleteAccount(acc.id)}>
                      <Trash2 size={13} style={{marginRight: '4px'}}/> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'DASHBOARD' && (
        <div className="card">
          <div className="campaigns-tab-header">
            <h2>Live Campaigns ({campaigns.length})</h2>
            <button className="btn-refresh-clean" onClick={fetchData} title="Refresh Campaigns">
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          {campaigns.length === 0 ? (
            <div style={{textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)'}}>
              <Mail size={32} style={{color: '#94a3b8', margin: '0 auto 8px', display: 'block'}} />
              <p style={{margin: '0 0 6px 0', fontWeight: 600}}>No campaigns queued yet.</p>
              <span style={{fontSize: '12.5px'}}>Switch to <strong>Compose Campaign</strong> to launch outreach!</span>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="desktop-table-view table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Campaign Name</th>
                      <th>Target</th>
                      <th>Status</th>
                      <th>Progress (Sent / Failed / Total)</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map(camp => (
                      <tr key={camp.id}>
                        <td><strong>{camp.name}</strong><br/><span style={{fontSize:'12px', color:'#64748b'}}>{camp.subject}</span></td>
                        <td>
                          {(() => {
                            if (camp.is_manual) return 'Manual Upload';
                            if (!camp.target_job_id) return 'All Leads';
                            const ids = camp.target_job_id.toString().split(',');
                            if (ids.length <= 3) return `Job #${ids.join(', ')}`;
                            return <span title={`Jobs: ${camp.target_job_id}`} style={{ cursor: 'help', borderBottom: '1px dotted #94a3b8' }}>{ids.length} Jobs Selected</span>;
                          })()}
                        </td>
                        <td>
                          <div className="status-badge-container">
                            <span className={`badge ${camp.status.toLowerCase()}`}>{camp.status}</span>
                            <div className="status-info-wrapper">
                              <button 
                                type="button" 
                                className="btn-status-info" 
                                title="View campaign timeline"
                                aria-label="View campaign timeline"
                              >
                                <Info size={12} />
                              </button>
                              <div className="status-info-popover">
                                <div className="popover-header">
                                  <Clock size={11} />
                                  <span>Timeline Details</span>
                                </div>
                                <div className="popover-row">
                                  <span className="popover-label">Started:</span>
                                  <span className="popover-val">{formatDateTime(camp.created_at)}</span>
                                </div>
                                <div className="popover-row">
                                  <span className="popover-label">Ended:</span>
                                  <span className="popover-val">
                                    {camp.status === 'COMPLETED'
                                      ? formatDateTime(camp.completed_at || camp.created_at)
                                      : camp.status === 'PAUSED'
                                      ? '⏸ Paused'
                                      : '⚡ In Progress...'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <div style={{flex: 1, background: '#e2e8f0', height: '6px', borderRadius: '3px', overflow: 'hidden'}}>
                               <div style={{width: `${((camp.sent_count + camp.failed_count) / camp.total_leads) * 100}%`, background: '#4f46e5', height: '100%'}}></div>
                            </div>
                            <span style={{fontSize: '13px', fontWeight: 600}}>{camp.sent_count} <span style={{color: '#ef4444'}}>({camp.failed_count})</span> / {camp.total_leads}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                            {camp.status !== 'COMPLETED' && (
                              <button 
                                className="btn-primary" 
                                style={{padding: '6px 12px'}}
                                onClick={() => handleToggleStatus(camp.id, camp.status)}
                              >
                                {camp.status === 'RUNNING' ? <><Pause size={14}/> Pause</> : <><Play size={14}/> Start</>}
                              </button>
                            )}
                            <button 
                              className="btn-danger" 
                              style={{padding: '6px 12px'}}
                              onClick={() => handleDeleteCampaign(camp.id)}
                              title="Delete Campaign"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="mobile-cards-view">
                {campaigns.map(camp => {
                  const progressPct = Math.min(100, Math.round(((camp.sent_count + camp.failed_count) / (camp.total_leads || 1)) * 100));
                  return (
                    <div key={camp.id} className="mobile-campaign-card">
                      {/* Top Bar: Name + Status */}
                      <div className="mobile-camp-header">
                        <div className="mobile-camp-title-wrap">
                          <h3 className="mobile-camp-title">{camp.name}</h3>
                          <span className="mobile-camp-subject">{camp.subject}</span>
                        </div>
                        <div className="status-badge-container">
                          <span className={`badge ${camp.status.toLowerCase()}`}>{camp.status}</span>
                          <div className="status-info-wrapper">
                            <button 
                              type="button" 
                              className="btn-status-info" 
                              title="View campaign timeline"
                              aria-label="View campaign timeline"
                            >
                              <Info size={11} />
                            </button>
                            <div className="status-info-popover">
                              <div className="popover-header">
                                <Clock size={11} />
                                <span>Timeline Details</span>
                              </div>
                              <div className="popover-row">
                                <span className="popover-label">Started:</span>
                                <span className="popover-val">{formatDateTime(camp.created_at)}</span>
                              </div>
                              <div className="popover-row">
                                <span className="popover-label">Ended:</span>
                                <span className="popover-val">
                                  {camp.status === 'COMPLETED'
                                    ? formatDateTime(camp.completed_at || camp.created_at)
                                    : camp.status === 'PAUSED'
                                    ? '⏸ Paused'
                                    : '⚡ In Progress...'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Meta Details Row */}
                      <div className="mobile-camp-meta-row">
                        <div className="mobile-meta-badge">
                          <span className="meta-lbl">Target:</span>
                          <span className="meta-val">
                            {(() => {
                              if (camp.is_manual) return 'Manual Upload';
                              if (!camp.target_job_id) return 'All Leads';
                              const ids = camp.target_job_id.toString().split(',');
                              if (ids.length <= 3) return `Job #${ids.join(', ')}`;
                              return `${ids.length} Jobs Selected`;
                            })()}
                          </span>
                        </div>
                        <div className="mobile-meta-badge">
                          <span className="meta-lbl">Sent:</span>
                          <span className="meta-val"><strong>{camp.sent_count}</strong> / {camp.total_leads}</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mobile-camp-progress-section">
                        <div className="mobile-progress-label-row">
                          <span>Outreach Progress</span>
                          <span style={{fontWeight: 700, color: 'var(--primary)'}}>{progressPct}%</span>
                        </div>
                        <div className="mobile-progress-track">
                          <div 
                            className="mobile-progress-fill" 
                            style={{width: `${progressPct}%`}}
                          />
                        </div>
                        {camp.failed_count > 0 && (
                          <div className="mobile-failed-count">
                            ⚠️ {camp.failed_count} failed deliveries
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="mobile-camp-actions-row">
                        {camp.status !== 'COMPLETED' && (
                          <button 
                            className="btn-primary mobile-action-btn"
                            onClick={() => handleToggleStatus(camp.id, camp.status)}
                          >
                            {camp.status === 'RUNNING' ? <><Pause size={13}/> Pause Outreach</> : <><Play size={13}/> Start Outreach</>}
                          </button>
                        )}
                        <button 
                          className="btn-danger mobile-action-btn delete-btn"
                          onClick={() => handleDeleteCampaign(camp.id)}
                          title="Delete Campaign"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
    </LockedFeatureGate>
  );
}

export default Campaigns;
