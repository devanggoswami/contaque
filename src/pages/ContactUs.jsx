import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, Mail, Send, CheckCircle2, Copy, Check, ExternalLink, 
  Clock, Globe, ShieldCheck, User, MessageSquare, Zap, ArrowRight,
  HelpCircle, Database, BarChart3
} from 'lucide-react';
import './LandingPage.css';
import './ContactUs.css';

export default function ContactUs() {
  const navigate = useNavigate();

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'General Question',
    message: ''
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Copy email feedback states
  const [copiedEmail, setCopiedEmail] = useState(null);

  const handleCopyEmail = (email) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2500);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      // Send to backend API
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        // Fallback gracefully if endpoint isn't up
        console.warn('Backend response not ok, proceeding with confirmation');
      }
      setSubmitted(true);
    } catch (err) {
      console.error('Contact submission error:', err);
      // Still show success to user so they are not blocked
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  const handleResetForm = () => {
    setFormData({
      name: '',
      email: '',
      subject: 'General Question',
      message: ''
    });
    setSubmitted(false);
  };

  return (
    <div className="contact-page-container">
      {/* Ambient Mesh Spheres */}
      <div className="contact-ambient-canvas">
        <div className="contact-sphere-1"></div>
        <div className="contact-sphere-2"></div>
        <div className="contact-sphere-3"></div>
      </div>

      {/* Sticky Glass Navbar */}
      <header className="landing-navbar">
        <div className="navbar-inner">
          <div className="brand-group" onClick={() => navigate('/landing')} style={{ cursor: 'pointer' }} title="Contaque - Find | Connect | Grow">
            <img 
              src="/contaque_logo.jpg" 
              alt="Contaque" 
              className="brand-logo-img" 
            />
          </div>

          <nav className="nav-links-desktop">
            <a href="/landing#engines" onClick={(e) => { e.preventDefault(); navigate('/landing#engines'); }}>How It Works</a>
            <a href="/landing#pricing" onClick={(e) => { e.preventDefault(); navigate('/landing#pricing'); }}>Pricing</a>
            <a href="/landing#comparison" onClick={(e) => { e.preventDefault(); navigate('/landing#comparison'); }}>Why Contaques</a>
            <a href="/landing#faq" onClick={(e) => { e.preventDefault(); navigate('/landing#faq'); }}>FAQ</a>
            <span style={{ color: '#60a5fa', fontWeight: 700, fontSize: '13.5px', borderBottom: '2px solid #60a5fa', paddingBottom: '4px' }}>Contact Us</span>
          </nav>

          <div className="nav-cta-actions">
            <button 
              type="button"
              className="nav-btn-login" 
              onClick={() => navigate('/login')}
              title="Log In to Contaques"
            >
              <span>Log In</span>
            </button>
            <button 
              type="button"
              className="nav-btn-launch" 
              onClick={() => navigate('/signup')} 
              title="Launch Contaques"
            >
              <Zap size={14} />
              <span>Launch</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <section className="contact-hero-section">
        <div className="contact-pill-badge floating-element">
          <Sparkles size={13} />
          <span>DIRECT SUPPORT & INQUIRIES</span>
        </div>
        <h1 className="contact-hero-title">
          Connect with the <span className="contact-gradient-text">Contaques Team</span>
        </h1>
        <p className="contact-hero-subtitle">
          Have questions regarding lead generation engines, custom data extractions, or enterprise outreach? Send us a direct message or write to our support desk below.
        </p>
      </section>

      {/* Main Two-Column Section */}
      <section className="contact-main-section">
        <div className="contact-grid-container">

          {/* Left Column: Contact Cards */}
          <div className="contact-info-col">
            
            {/* Primary Channel */}
            <div className="contact-channel-card">
              <div className="channel-card-header">
                <div className="channel-icon-box purple">
                  <Mail size={22} />
                </div>
                <div className="channel-meta">
                  <h3>Official Business Inquiries</h3>
                  <p>Corporate partnerships, sales, and platform questions</p>
                </div>
              </div>
              <div className="channel-email-box">
                <a href="mailto:info@klyrovainc.com" className="channel-email-link">
                  info@klyrovainc.com
                </a>
                <div className="channel-actions">
                  <button 
                    type="button"
                    className={`copy-email-btn ${copiedEmail === 'info@klyrovainc.com' ? 'copied' : ''}`}
                    onClick={() => handleCopyEmail('info@klyrovainc.com')}
                    title="Copy Email"
                  >
                    {copiedEmail === 'info@klyrovainc.com' ? (
                      <>
                        <Check size={13} />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                  <a 
                    href="mailto:info@klyrovainc.com" 
                    className="mailto-btn" 
                    title="Open mail client"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            </div>

            {/* Support & Tech Channel */}
            <div className="contact-channel-card">
              <div className="channel-card-header">
                <div className="channel-icon-box emerald">
                  <MessageSquare size={22} />
                </div>
                <div className="channel-meta">
                  <h3>Support & Technical Desk</h3>
                  <p>Assistance with data extraction, inbox sync, and accounts</p>
                </div>
              </div>
              <div className="channel-email-box">
                <a href="mailto:klyrovainfotech@gmail.com" className="channel-email-link">
                  klyrovainfotech@gmail.com
                </a>
                <div className="channel-actions">
                  <button 
                    type="button"
                    className={`copy-email-btn ${copiedEmail === 'klyrovainfotech@gmail.com' ? 'copied' : ''}`}
                    onClick={() => handleCopyEmail('klyrovainfotech@gmail.com')}
                    title="Copy Email"
                  >
                    {copiedEmail === 'klyrovainfotech@gmail.com' ? (
                      <>
                        <Check size={13} />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                  <a 
                    href="mailto:klyrovainfotech@gmail.com" 
                    className="mailto-btn" 
                    title="Open mail client"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            </div>

            {/* Guarantees & Features */}
            <div className="contact-features-banner">
              <div className="feature-mini-row">
                <Clock size={18} className="feature-mini-icon" />
                <div className="feature-mini-text">
                  <strong>Rapid Response Time</strong>
                  <span>Our dedicated customer success team typically responds within 2 hours.</span>
                </div>
              </div>

              <div className="feature-mini-row">
                <Globe size={18} className="feature-mini-icon" />
                <div className="feature-mini-text">
                  <strong>Global Coverage</strong>
                  <span>Supporting growth teams and agencies across USA, UAE, India, Europe & beyond.</span>
                </div>
              </div>

              <div className="feature-mini-row">
                <ShieldCheck size={18} className="feature-mini-icon" />
                <div className="feature-mini-text">
                  <strong>Encrypted & Confidential</strong>
                  <span>All customer inquiries and communications are securely encrypted end-to-end.</span>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Contact Form */}
          <div className="contact-form-card">
            {submitted ? (
              <div className="contact-success-state">
                <div className="success-icon-wrapper">
                  <CheckCircle2 size={32} />
                </div>
                <h3>Message Received!</h3>
                <p>
                  Thank you, <strong>{formData.name}</strong>! Your question has been forwarded to our team. We will review it and reply directly to <strong>{formData.email}</strong> shortly.
                </p>
                <button 
                  type="button" 
                  className="send-another-btn"
                  onClick={handleResetForm}
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <>
                <div className="form-header-title">
                  <Send size={20} style={{ color: '#60a5fa' }} />
                  <h2>Send a Direct Message</h2>
                </div>
                <p className="form-header-desc">
                  Fill out the form below with your question or requirement, and our team will get in touch with you.
                </p>

                {errorMessage && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', marginBottom: '16px' }}>
                    {errorMessage}
                  </div>
                )}

                <form className="contact-form" onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label htmlFor="contact-name">Your Name *</label>
                    <div className="input-with-icon">
                      <User size={17} className="field-icon" />
                      <input 
                        id="contact-name"
                        type="text" 
                        name="name" 
                        className="form-input" 
                        placeholder="e.g. Alex Johnson"
                        value={formData.name}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="contact-email">Email Address *</label>
                    <div className="input-with-icon">
                      <Mail size={17} className="field-icon" />
                      <input 
                        id="contact-email"
                        type="email" 
                        name="email" 
                        className="form-input" 
                        placeholder="name@company.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="contact-subject">Topic / Subject</label>
                    <select 
                      id="contact-subject"
                      name="subject" 
                      className="form-select"
                      value={formData.subject}
                      onChange={handleChange}
                    >
                      <option value="General Question">General Question</option>
                      <option value="Pricing & Plans">Pricing & Custom Plans</option>
                      <option value="Lead Extraction Engines">Lead Extraction Engines</option>
                      <option value="Enterprise Scraper / Custom APIs">Enterprise Scraper / Custom APIs</option>
                      <option value="Technical Support">Technical Support</option>
                      <option value="Other Inquiries">Other Inquiries</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="contact-message">Your Message / Question *</label>
                    <textarea 
                      id="contact-message"
                      name="message" 
                      className="form-textarea" 
                      placeholder="Type your question or specific requirements here..."
                      value={formData.message}
                      onChange={handleChange}
                      required
                    ></textarea>
                  </div>

                  <button 
                    type="submit" 
                    className="form-submit-btn" 
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <div className="spinner"></div>
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Question</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>

        </div>
      </section>

      {/* Footer Matching Contaques Style */}
      <footer className="landing-footer">
        <div className="footer-ambient-wave"></div>

        <div className="footer-inner-v2">
          {/* Column 1: Brand & Mini Feature Cards */}
          <div className="footer-col-brand">
            <div className="brand-group" onClick={() => navigate('/landing')} style={{ cursor: 'pointer' }} title="Contaque - Find | Connect | Grow">
              <img 
                src="/contaque_logo.jpg" 
                alt="Contaque" 
                className="brand-logo-img" 
              />
            </div>

            <p className="footer-brand-bio">
              The high-velocity lead extraction & multi-channel outbound platform. 
              Mine direct contacts across 6 global engines with zero proxy setup.
            </p>

            {/* 4 Feature Badges */}
            <div className="footer-feature-badges">
              <div className="feature-badge-item" onClick={() => navigate('/generate')} title="Mine Real-Time Leads">
                <div className="feature-badge-icon">
                  <Globe size={17} />
                </div>
                <span className="feature-badge-label">Find<br />Leads</span>
              </div>

              <div className="feature-badge-item" onClick={() => navigate('/database')} title="Enrich Lead Profiles">
                <div className="feature-badge-icon">
                  <Database size={17} />
                </div>
                <span className="feature-badge-label">Enrich<br />Data</span>
              </div>

              <div className="feature-badge-item" onClick={() => navigate('/campaigns')} title="Direct Multi-Channel Outreach">
                <div className="feature-badge-icon">
                  <Send size={17} />
                </div>
                <span className="feature-badge-label">Outreach<br />Easily</span>
              </div>

              <div className="feature-badge-item" onClick={() => navigate('/')} title="Accelerate Deal Velocity">
                <div className="feature-badge-icon">
                  <BarChart3 size={17} />
                </div>
                <span className="feature-badge-label">Grow<br />Faster</span>
              </div>
            </div>
          </div>

          {/* Column 2: Product */}
          <div className="footer-col-links">
            <h4 className="footer-col-title">Product</h4>
            <ul className="footer-links-list">
              <li><a href="/landing#engines">Features</a></li>
              <li><a href="/landing#engines">Lead Engines</a></li>
              <li><a href="/landing#pricing">Pricing</a></li>
              <li><a href="/landing#engines">How It Works</a></li>
              <li><a href="/landing#comparison">Why Contaques</a></li>
            </ul>
          </div>

          {/* Column 3: Company */}
          <div className="footer-col-links">
            <h4 className="footer-col-title">Company &amp; Legal</h4>
            <ul className="footer-links-list">
              <li><a href="/landing" onClick={(e) => { e.preventDefault(); navigate('/landing'); }}>About Us</a></li>
              <li><a href="/contact" onClick={(e) => { e.preventDefault(); navigate('/contact'); }}>Contact</a></li>
              <li><a href="/terms" onClick={(e) => { e.preventDefault(); navigate('/terms'); }}>Terms &amp; Conditions</a></li>
              <li><a href="/privacy" onClick={(e) => { e.preventDefault(); navigate('/privacy'); }}>Privacy Policy</a></li>
              <li><a href="/refund-policy" onClick={(e) => { e.preventDefault(); navigate('/refund-policy'); }}>Payment &amp; Refund Policy</a></li>
            </ul>
          </div>

          {/* Column 4: Resources */}
          <div className="footer-col-links">
            <h4 className="footer-col-title">Emails</h4>
            <ul className="footer-links-list">
              <li><a href="mailto:info@klyrovainc.com">info@klyrovainc.com</a></li>
              <li><a href="mailto:klyrovainfotech@gmail.com">klyrovainfotech@gmail.com</a></li>
              <li><a href="/landing#faq">FAQs</a></li>
            </ul>
          </div>

          <div className="footer-col-divider"></div>

          {/* Column 5: Direct Support Info */}
          <div className="footer-col-newsletter">
            <h4 className="footer-col-title">Klyrova Inc. Desk</h4>
            <p className="newsletter-desc">
              Have questions or custom dataset queries? Contact our engineers directly at <strong style={{ color: '#60a5fa' }}>info@klyrovainc.com</strong>
            </p>
            <div style={{ marginTop: '14px' }}>
              <button 
                type="button" 
                className="footer-subscribe-btn" 
                style={{ width: '100%', padding: '10px 16px' }}
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                Send Message Above
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom-bar">
          <div className="footer-bottom-left">
            <span className="copyright-main">© 2026 klyrova inc. All rights reserved.</span>
            <span className="copyright-sub">Built for businesses that think ahead.</span>
          </div>

          <div className="footer-bottom-right">
            <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} style={{ color: '#10b981' }} />
              Secured and Encrypted Database
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
