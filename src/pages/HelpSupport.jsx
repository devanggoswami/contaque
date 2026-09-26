import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  HelpCircle, Send, CheckCircle2, AlertCircle, Mail, Clock, 
  ShieldCheck, MessageSquare, Headphones, Copy, Check, ExternalLink,
  ChevronDown, Phone, Sparkles, Loader2, BookOpen, Download, FileText, ArrowRight
} from 'lucide-react';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import './HelpSupport.css';

const ISSUE_CATEGORIES = [
  'Leads',
  'Payments',
  'Referral',
  'Account',
  'Plans & Subscription',
  'Wallet / Credits',
  'Technical Issue',
  'Other'
];

const COUNTRY_DIAL_CODES = [
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+1', country: 'US / Canada', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+31', country: 'Netherlands', flag: '🇳🇱' },
  { code: '+55', country: 'Brazil', flag: '🇧🇷' },
  { code: '+62', country: 'Indonesia', flag: '🇮🇩' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+82', country: 'South Korea', flag: '🇰🇷' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+34', country: 'Spain', flag: '🇪🇸' },
  { code: '+39', country: 'Italy', flag: '🇮🇹' },
  { code: '+41', country: 'Switzerland', flag: '🇨🇭' },
  { code: '+46', country: 'Sweden', flag: '🇸🇪' },
  { code: '+47', country: 'Norway', flag: '🇳🇴' },
  { code: '+48', country: 'Poland', flag: '🇵🇱' },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
  { code: '+63', country: 'Philippines', flag: '🇵🇭' },
  { code: '+66', country: 'Thailand', flag: '🇹🇭' },
  { code: '+64', country: 'New Zealand', flag: '🇳🇿' },
  { code: '+353', country: 'Ireland', flag: '🇮🇪' }
];

export default function HelpSupport() {
  const { user, authFetch } = useAuth();

  // Extract first & last name from user object if available
  const initialNames = (user?.name || '').trim().split(' ');
  const initialFirstName = initialNames[0] || '';
  const initialLastName = initialNames.slice(1).join(' ') || '';

  const [formData, setFormData] = useState({
    firstName: initialFirstName,
    lastName: initialLastName,
    email: user?.email || '',
    countryCode: '+91',
    phone: '',
    category: '',
    description: ''
  });

  // Keep email synced if auth loads after mount
  useEffect(() => {
    if (user?.email && !formData.email) {
      const names = (user?.name || '').trim().split(' ');
      setFormData(prev => ({
        ...prev,
        email: user.email,
        firstName: prev.firstName || names[0] || '',
        lastName: prev.lastName || names.slice(1).join(' ') || ''
      }));
    }
  }, [user]);

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(null);

  const handleCopyEmail = (email) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2200);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errorMessage) setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Field Validation
    if (!formData.firstName.trim()) {
      setErrorMessage('Please enter your First Name.');
      return;
    }
    if (!formData.lastName.trim()) {
      setErrorMessage('Please enter your Last Name.');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setErrorMessage('Please provide a valid registered Email address.');
      return;
    }
    if (!formData.category) {
      setErrorMessage('Please select an Issue Category.');
      return;
    }
    if (!formData.description.trim()) {
      setErrorMessage('Please provide a description of your issue or question.');
      return;
    }

    setLoading(true);

    try {
      const res = await authFetch(`${API_URL}/api/support/ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setSuccessMessage('');
        setErrorMessage(data.error || 'Failed to deliver support request. Please try again or email us directly at klyrovainfotech@gmail.com.');
        setLoading(false);
        return;
      }

      setSuccessMessage(data.message || "Your request has been submitted successfully. We'll get back to you within 24 hours on working days.");
      // Reset form description & category, keep contact details
      setFormData(prev => ({
        ...prev,
        category: '',
        description: '',
        phone: ''
      }));
    } catch (err) {
      console.error('Support ticket submission failed:', err);
      setSuccessMessage('');
      setErrorMessage('Network error while submitting support ticket. Please check your connection or reach out via email directly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="help-support-page">
      {/* Header */}
      <div className="help-support-header">
        <div className="help-header-title-wrap">
          <div className="help-header-icon-pill">
            <Headphones size={24} />
          </div>
          <div>
            <h1 className="help-support-heading">Help & Support</h1>
            <p className="help-support-subheading">
              Have questions, experiencing issues, or need help with your account? Our support team is here for you.
            </p>
          </div>
        </div>
      </div>

      {/* USER MANUAL & GUIDE BANNER */}
      <div className="help-manual-banner">
        <div className="help-manual-banner-left">
          <div className="help-manual-badge">
            <Sparkles size={14} />
            <span>OFFICIAL PRODUCT DOCUMENTATION</span>
          </div>
          <h2 className="help-manual-title">ContaQue — Complete User Guide (Manual)</h2>
          <p className="help-manual-desc">
            New to ContaQue? Learn how our 5 specialized lead engines work, which engine to pick for your specific business niche, how lead databases connect to bulk Gmail outreach, and best practices.
          </p>
          <div className="help-manual-tags">
            <span className="manual-tag blue">🔵 Google Business</span>
            <span className="manual-tag indigo">🔵 Business Index</span>
            <span className="manual-tag amber">🟡 Yellow Pages</span>
            <span className="manual-tag red">🔴 Yandex</span>
            <span className="manual-tag emerald">🟢 WhatsApp Radar</span>
          </div>
        </div>
        <div className="help-manual-banner-actions">
          <a
            href="/ContaQue_User_Guide.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="help-manual-btn primary"
            title="Open User Manual PDF directly in a new tab"
          >
            <Download size={16} />
            <span>Open User Manual (PDF)</span>
            <ExternalLink size={14} className="manual-ext-icon" />
          </a>
          <Link
            to="/user-manual"
            target="_blank"
            className="help-manual-btn secondary"
            title="Read Interactive Guide"
          >
            <FileText size={16} />
            <span>Read Interactive Guide</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* 2-Column Responsive Layout */}
      <div className="help-support-grid">
        {/* LEFT COLUMN: Support Ticket Form */}
        <div className="support-form-card">
          <div className="support-card-head">
            <h2 className="support-card-title">Submit a Support Ticket</h2>
            <p className="support-card-subtitle">
              Fill out the details below and our technical support specialists will assist you promptly.
            </p>
          </div>

          {successMessage && (
            <div className="support-alert success">
              <CheckCircle2 size={20} className="alert-icon" />
              <div className="alert-content">
                <strong>Ticket Submitted Successfully!</strong>
                <p>{successMessage}</p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="support-alert error">
              <AlertCircle size={20} className="alert-icon" />
              <div className="alert-content">
                <strong>Attention Required</strong>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="support-form" noValidate>
            {/* 1. First Name & 2. Last Name Row */}
            <div className="form-row-two">
              <div className="form-group">
                <label htmlFor="firstName" className="form-label">
                  First Name <span className="required-star">*</span>
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  placeholder="e.g. John"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="lastName" className="form-label">
                  Last Name <span className="required-star">*</span>
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  placeholder="e.g. Doe"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  className="form-input"
                />
              </div>
            </div>

            {/* 3. Email */}
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email Address <span className="required-star">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="yourname@company.com"
                value={formData.email}
                onChange={handleChange}
                required
                className="form-input"
              />
              <span className="field-hint">Pre-filled with your registered account email</span>
            </div>

            {/* 4. Mobile Number (Optional) with Country Code selector on the left */}
            <div className="form-group">
              <label htmlFor="phone" className="form-label">
                Mobile Number <span className="optional-tag">(Optional)</span>
              </label>
              <div className="phone-input-combo">
                <div className="country-code-select-wrap">
                  <select
                    id="countryCode"
                    name="countryCode"
                    value={formData.countryCode}
                    onChange={handleChange}
                    className="country-code-select"
                    title="Country Code"
                  >
                    {COUNTRY_DIAL_CODES.map((item) => (
                      <option key={`${item.code}-${item.country}`} value={item.code}>
                        {item.flag} {item.code} ({item.country})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="select-chevron" />
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="98765 43210"
                  value={formData.phone}
                  onChange={handleChange}
                  className="form-input phone-number-input"
                />
              </div>
            </div>

            {/* 5. Issue Category dropdown */}
            <div className="form-group">
              <label htmlFor="category" className="form-label">
                Issue Category <span className="required-star">*</span>
              </label>
              <div className="custom-select-wrap">
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  className="form-select"
                >
                  <option value="" disabled>Select an issue category...</option>
                  {ISSUE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="select-chevron" />
              </div>
            </div>

            {/* 6. Description */}
            <div className="form-group">
              <label htmlFor="description" className="form-label">
                Description <span className="required-star">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                rows={5}
                placeholder="Describe your issue or question..."
                value={formData.description}
                onChange={handleChange}
                required
                className="form-textarea"
              />
            </div>

            {/* 7. Send button */}
            <div className="form-actions">
              <button
                type="submit"
                disabled={loading}
                className="support-submit-btn"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="btn-spin-icon" />
                    <span>Sending Ticket...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Send</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN: Direct Email Support Card */}
        <div className="direct-support-column">
          <div className="direct-support-card">
            <div className="direct-card-badge">
              <Sparkles size={14} />
              <span>DIRECT CHANNELS</span>
            </div>

            <h2 className="direct-card-title">Need help directly?</h2>
            <p className="direct-card-subtitle">
              Reach out directly to our dedicated support channels via email.
            </p>

            <div className="direct-email-list">
              {/* Option 1: Klyrova Info */}
              <div className="direct-email-item">
                <div className="email-meta-head">
                  <span className="email-item-label">Klyrova Info</span>
                </div>
                <div className="email-action-row">
                  <a 
                    href="mailto:klyrovainfotech@gmail.com" 
                    className="email-mailto-link"
                    title="Send email to Klyrova Info"
                  >
                    <Mail size={16} className="email-link-icon" />
                    <span>klyrovainfotech@gmail.com</span>
                  </a>
                  <button 
                    type="button"
                    className={`email-copy-pill ${copiedEmail === 'klyrovainfotech@gmail.com' ? 'copied' : ''}`}
                    onClick={() => handleCopyEmail('klyrovainfotech@gmail.com')}
                    title="Copy Email Address"
                  >
                    {copiedEmail === 'klyrovainfotech@gmail.com' ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              {/* Option 2: Klyrova Support */}
              <div className="direct-email-item">
                <div className="email-meta-head">
                  <span className="email-item-label">Klyrova Support</span>
                </div>
                <div className="email-action-row">
                  <a 
                    href="mailto:Info@klyrovainfotech.com" 
                    className="email-mailto-link"
                    title="Send email to Klyrova Support"
                  >
                    <Mail size={16} className="email-link-icon" />
                    <span>Info@klyrovainfotech.com</span>
                  </a>
                  <button 
                    type="button"
                    className={`email-copy-pill ${copiedEmail === 'Info@klyrovainfotech.com' ? 'copied' : ''}`}
                    onClick={() => handleCopyEmail('Info@klyrovainfotech.com')}
                    title="Copy Email Address"
                  >
                    {copiedEmail === 'Info@klyrovainfotech.com' ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
            </div>

            {/* SLA Note */}
            <div className="direct-sla-box">
              <Clock size={16} className="sla-icon" />
              <span>You will receive a reply within 24 hours on working days.</span>
            </div>

            {/* Assistance Tip */}
            <div className="direct-tip-box">
              <ShieldCheck size={16} className="tip-icon" />
              <p className="direct-tip-text">
                For faster assistance, please include your registered email address and a clear description of the issue.
              </p>
            </div>
          </div>

          {/* RIGHT COLUMN: Quick User Guide Card */}
          <div className="direct-guide-card">
            <div className="direct-guide-header">
              <div className="direct-guide-icon-pill">
                <BookOpen size={20} />
              </div>
              <div>
                <h3 className="direct-guide-title">Platform Manual &amp; Engines</h3>
                <p className="direct-guide-desc">
                  Learn which lead engine fits your niche &amp; outreach strategy.
                </p>
              </div>
            </div>

            <div className="direct-guide-features">
              <div className="guide-feature-item">
                <span className="bullet-dot"></span>
                <span>All 5 lead generation engines explained</span>
              </div>
              <div className="guide-feature-item">
                <span className="bullet-dot"></span>
                <span>Engine selection comparison matrix</span>
              </div>
              <div className="guide-feature-item">
                <span className="bullet-dot"></span>
                <span>Gmail App Password &amp; bulk outreach setup</span>
              </div>
            </div>

            <div className="direct-guide-actions">
              <a 
                href="/ContaQue_User_Guide.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="direct-guide-pdf-btn"
                title="Download or open PDF in new tab"
              >
                <Download size={15} />
                <span>Open PDF Manual</span>
                <ExternalLink size={13} className="ml-auto" />
              </a>

              <Link 
                to="/user-manual"
                target="_blank"
                className="direct-guide-web-btn"
                title="Browse interactive manual"
              >
                <FileText size={15} />
                <span>Interactive Web Guide</span>
                <ArrowRight size={13} className="ml-auto" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
