import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FileText, ShieldCheck, CreditCard, ArrowRight, Zap, 
  Mail, Calendar, MapPin, CheckCircle2, ChevronRight, Globe, Database, Send, BarChart3 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../pages/LegalPage.css';

export default function LegalLayout({ 
  badge = 'LEGAL & COMPLIANCE',
  title = 'Terms & Conditions',
  lastUpdated = 'September 23, 2026',
  activeDoc = 'terms',
  children 
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  return (
    <div className="legal-page-container">
      {/* Background Animated Ambient Mesh */}
      <div className="legal-ambient-canvas">
        <div className="legal-sphere-1"></div>
        <div className="legal-sphere-2"></div>
        <div className="legal-sphere-3"></div>
      </div>

      {/* Sticky Navbar */}
      <header className="legal-navbar">
        <div className="legal-navbar-inner">
          <div 
            className="legal-brand-group" 
            onClick={() => navigate('/landing')} 
            title="Contaque - B2B Lead Intelligence"
          >
            <div className="legal-brand-logo">
              <img src="/contaque_logo.jpg" alt="Contaque" />
            </div>
            <div className="legal-brand-title">
              <span>Contaque</span>
              <span className="legal-brand-badge">LEGAL DESK</span>
            </div>
          </div>

          <nav className="legal-nav-links">
            <a 
              href="/landing#engines" 
              className="legal-nav-link"
              onClick={(e) => { e.preventDefault(); navigate('/landing#engines'); }}
            >
              How It Works
            </a>
            <a 
              href="/landing#pricing" 
              className="legal-nav-link"
              onClick={(e) => { e.preventDefault(); navigate('/landing#pricing'); }}
            >
              Pricing
            </a>
            <a 
              href="/landing#comparison" 
              className="legal-nav-link"
              onClick={(e) => { e.preventDefault(); navigate('/landing#comparison'); }}
            >
              Why Contaque
            </a>
            <a 
              href="/contact" 
              className="legal-nav-link"
              onClick={(e) => { e.preventDefault(); navigate('/contact'); }}
            >
              Contact Us
            </a>
          </nav>

          <div className="legal-nav-cta">
            <button 
              type="button"
              className="legal-btn-subtle" 
              onClick={() => navigate('/login')}
            >
              Log In
            </button>
            <button 
              type="button"
              className="legal-btn-primary" 
              onClick={() => navigate(isAuthenticated ? '/dashboard' : '/signup')} 
              title="Launch Contaque"
            >
              <Zap size={14} />
              <span>{isAuthenticated ? 'Dashboard' : 'Get Started'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="legal-hero">
        <div className="legal-pill-badge">
          <ShieldCheck size={13} />
          <span>{badge}</span>
        </div>
        <h1 className="legal-hero-title">
          {title}
        </h1>
        <div className="legal-hero-meta">
          <div className="legal-meta-item">
            <Calendar size={14} style={{ color: '#818cf8' }} />
            <span>Effective Date: <strong>{lastUpdated}</strong></span>
          </div>
          <div className="legal-meta-item">
            <Globe size={14} style={{ color: '#38bdf8' }} />
            <span>Platform: <strong>Contaque SaaS</strong></span>
          </div>
          <div className="legal-meta-item">
            <MapPin size={14} style={{ color: '#34d399' }} />
            <span>Jurisdiction: <strong>Republic of India</strong></span>
          </div>
        </div>
      </section>

      {/* 3-Tab Document Switcher Bar */}
      <nav className="legal-doc-switcher" aria-label="Legal documents navigation">
        <div className="legal-switcher-pills">
          <button
            type="button"
            className={`legal-switcher-pill ${activeDoc === 'terms' ? 'active' : ''}`}
            onClick={() => navigate('/terms')}
          >
            <FileText size={15} />
            <span>Terms & Conditions</span>
          </button>
          <button
            type="button"
            className={`legal-switcher-pill ${activeDoc === 'privacy' ? 'active' : ''}`}
            onClick={() => navigate('/privacy')}
          >
            <ShieldCheck size={15} />
            <span>Privacy Policy</span>
          </button>
          <button
            type="button"
            className={`legal-switcher-pill ${activeDoc === 'refund' ? 'active' : ''}`}
            onClick={() => navigate('/refund-policy')}
          >
            <CreditCard size={15} />
            <span>Payment & Refund Policy</span>
          </button>
        </div>
      </nav>

      {/* Document Content Card */}
      <main className="legal-content-wrap">
        <div className="legal-card">
          {children}
        </div>
      </main>

      {/* Standard Footer */}
      <footer className="landing-footer" style={{ marginTop: 'auto' }}>
        <div className="footer-ambient-wave"></div>

        <div className="footer-inner-v2">
          {/* Column 1: Brand & Tagline */}
          <div className="footer-col-brand">
            <div className="brand-group" onClick={() => navigate('/landing')} style={{ cursor: 'pointer' }} title="Contaque">
              <img 
                src="/contaque_logo.jpg" 
                alt="Contaque" 
                className="brand-logo-img" 
              />
            </div>

            <p className="footer-brand-bio">
              The high-velocity lead extraction & multi-channel outbound platform. 
              Mine direct verified contacts across 6 global engines with zero proxy setup.
            </p>

            <div className="footer-feature-badges">
              <div className="feature-badge-item" onClick={() => navigate('/generate')} title="Mine Real-Time Leads">
                <div className="feature-badge-icon"><Globe size={17} /></div>
                <span className="feature-badge-label">Find<br />Leads</span>
              </div>
              <div className="feature-badge-item" onClick={() => navigate('/database')} title="Enrich Lead Profiles">
                <div className="feature-badge-icon"><Database size={17} /></div>
                <span className="feature-badge-label">Enrich<br />Data</span>
              </div>
              <div className="feature-badge-item" onClick={() => navigate('/campaigns')} title="Direct Multi-Channel Outreach">
                <div className="feature-badge-icon"><Send size={17} /></div>
                <span className="feature-badge-label">Outreach<br />Easily</span>
              </div>
              <div className="feature-badge-item" onClick={() => navigate('/')} title="Accelerate Deal Velocity">
                <div className="feature-badge-icon"><BarChart3 size={17} /></div>
                <span className="feature-badge-label">Grow<br />Faster</span>
              </div>
            </div>
          </div>

          {/* Column 2: Product */}
          <div className="footer-col-links">
            <h4 className="footer-col-title">Product</h4>
            <ul className="footer-links-list">
              <li><a href="/landing#engines" onClick={(e) => { e.preventDefault(); navigate('/landing#engines'); }}>Features</a></li>
              <li><a href="/landing#engines" onClick={(e) => { e.preventDefault(); navigate('/landing#engines'); }}>Lead Engines</a></li>
              <li><a href="/landing#pricing" onClick={(e) => { e.preventDefault(); navigate('/landing#pricing'); }}>Pricing</a></li>
              <li><a href="/landing#engines" onClick={(e) => { e.preventDefault(); navigate('/landing#engines'); }}>How It Works</a></li>
              <li><a href="/landing#comparison" onClick={(e) => { e.preventDefault(); navigate('/landing#comparison'); }}>Why Contaque</a></li>
            </ul>
          </div>

          {/* Column 3: Legal & Policies */}
          <div className="footer-col-links">
            <h4 className="footer-col-title">Legal & Policies</h4>
            <ul className="footer-links-list">
              <li><a href="/terms" onClick={(e) => { e.preventDefault(); navigate('/terms'); }} style={{ color: activeDoc === 'terms' ? '#60a5fa' : '' }}>Terms & Conditions</a></li>
              <li><a href="/privacy" onClick={(e) => { e.preventDefault(); navigate('/privacy'); }} style={{ color: activeDoc === 'privacy' ? '#60a5fa' : '' }}>Privacy Policy</a></li>
              <li><a href="/refund-policy" onClick={(e) => { e.preventDefault(); navigate('/refund-policy'); }} style={{ color: activeDoc === 'refund' ? '#60a5fa' : '' }}>Payment & Refund Policy</a></li>
              <li><a href="/contact" onClick={(e) => { e.preventDefault(); navigate('/contact'); }}>Contact Desk</a></li>
            </ul>
          </div>

          {/* Column 4: Official Emails */}
          <div className="footer-col-links">
            <h4 className="footer-col-title">Support & Inquiries</h4>
            <ul className="footer-links-list">
              <li><a href="mailto:info@klyrovainc.com">info@klyrovainc.com</a></li>
              <li><a href="mailto:klyrovainfotech@gmail.com">klyrovainfotech@gmail.com</a></li>
              <li><a href="/contact" onClick={(e) => { e.preventDefault(); navigate('/contact'); }}>Help Desk & Tickets</a></li>
            </ul>
          </div>

          <div className="footer-col-divider"></div>

          {/* Column 5: Compliance Desk */}
          <div className="footer-col-newsletter">
            <h4 className="footer-col-title">Klyrova Compliance</h4>
            <p className="newsletter-desc">
              Questions regarding billing, privacy rights, or service compliance? Reach out to our legal & support desk directly.
            </p>
            <div style={{ marginTop: '14px' }}>
              <button 
                type="button" 
                className="footer-subscribe-btn" 
                style={{ width: '100%', padding: '10px 16px' }}
                onClick={() => navigate('/contact')}
              >
                Open Support Desk
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom-bar">
          <div className="footer-bottom-left">
            <span className="copyright-main">© 2026 Klyrova Inc. All rights reserved.</span>
            <span className="copyright-sub">Contaque B2B Cloud Intelligence Platform • Governed under the Laws of India</span>
          </div>

          <div className="footer-bottom-right">
            <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} style={{ color: '#10b981' }} />
              256-Bit Encrypted Database & PCI-DSS Compliant Payments
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
