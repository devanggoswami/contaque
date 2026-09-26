import React, { useEffect } from 'react';
import { 
  BookOpen, 
  Download, 
  Printer, 
  ExternalLink, 
  MapPin, 
  Globe, 
  BookMarked, 
  MessageSquare, 
  Compass, 
  Mail, 
  CheckCircle2, 
  Layers, 
  ShieldCheck, 
  ArrowRight,
  Database,
  Send,
  Sparkles,
  HelpCircle,
  FileText,
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import './UserManual.css';

export default function UserManual() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'ContaQue — Complete User Guide & Manual';
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="user-manual-page">
      {/* STICKY TOPBAR */}
      <header className="manual-topbar">
        <div className="manual-topbar-content">
          <div className="manual-brand">
            <Link to="/dashboard" className="manual-brand-link">
              <div className="manual-logo-icon">
                <img src="/contaque_logo.jpg" alt="ContaQue" />
              </div>
              <span className="manual-brand-name">ContaQue</span>
            </Link>
            <span className="manual-doc-tag">User Manual &amp; Docs</span>
          </div>

          <nav className="manual-nav-links">
            <a href="#engines">1. Lead Engines</a>
            <a href="#choose">2. Choose Engine</a>
            <a href="#pipeline">3. Pipeline</a>
            <a href="#outreach">4. Bulk Outreach</a>
            <a href="#distinction">5. Architecture</a>
          </nav>

          <div className="manual-actions">
            <button 
              type="button" 
              onClick={handlePrint} 
              className="manual-action-btn secondary"
              title="Print this manual"
            >
              <Printer size={15} />
              <span>Print</span>
            </button>

            <a 
              href="/ContaQue_User_Guide.pdf" 
              target="_blank" 
              rel="noopener noreferrer"
              className="manual-action-btn primary"
              title="Open or Download Official PDF in a new tab"
            >
              <Download size={15} />
              <span>Download PDF</span>
              <ExternalLink size={13} className="ml-1 opacity-75" />
            </a>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="manual-hero">
        <div className="manual-container">
          <div className="manual-hero-badge">
            <Sparkles size={14} />
            <span>OFFICIAL PRODUCT ONBOARDING GUIDE</span>
          </div>

          <h1 className="manual-hero-title">ContaQue — Complete User Guide</h1>
          <p className="manual-hero-subtitle">
            A comprehensive, step-by-step walkthrough on how to choose between the 5 specialized lead engines, build high-converting databases, and launch automated cold email campaigns.
          </p>

          <div className="manual-hero-chips">
            <span className="hero-chip">5 Lead Engines</span>
            <span className="hero-chip">Decision Matrix</span>
            <span className="hero-chip">Google App Password Setup</span>
            <span className="hero-chip">Free PDF Manual Included</span>
          </div>

          {/* Quick PDF Banner Callout */}
          <div className="manual-pdf-banner">
            <div className="pdf-banner-info">
              <FileText size={22} className="pdf-banner-icon" />
              <div>
                <strong>Need an offline or printable copy?</strong>
                <p>The complete ContaQue User Manual is formatted as a 3-page high-resolution PDF document.</p>
              </div>
            </div>
            <a 
              href="/ContaQue_User_Guide.pdf" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="pdf-banner-download-btn"
            >
              <Download size={15} />
              <span>Open PDF in New Tab</span>
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT WRAPPER */}
      <main className="manual-main">
        <div className="manual-container">

          {/* SECTION 1: UNDERSTAND THE LEAD ENGINES FIRST */}
          <section id="engines" className="manual-section">
            <div className="section-head">
              <span className="section-num">SECTION 1</span>
              <h2 className="section-title">Understand the Lead Engines First</h2>
              <p className="section-desc">
                ContaQue has <strong>5 specialized lead-generation engines</strong>. Each engine works with a different type of data source, so choosing the right engine depends on <strong>where the businesses or contacts you need are most likely to be listed</strong>.
              </p>
            </div>

            <div className="engines-grid">
              
              {/* ENGINE 1: Google Business Data */}
              <div className="engine-card engine-google">
                <div className="engine-card-header">
                  <div className="engine-icon-pill google-pill">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <span className="engine-tag google-tag">Engine #1</span>
                    <h3 className="engine-title">Google Business Data</h3>
                  </div>
                </div>

                <div className="engine-bestfor-badge">
                  <strong>Best for:</strong> Local &amp; Google-listed businesses
                </div>

                <p className="engine-text">
                  This engine finds businesses that are listed on <strong>Google Business / Google Maps</strong>. It searches the Google Business ecosystem for matching businesses and extracts available business and contact information.
                </p>

                <div className="engine-target-list">
                  <strong>Ideal target categories:</strong>
                  <ul>
                    <li>Local businesses &amp; retail shops</li>
                    <li>Marketing &amp; creative agencies</li>
                    <li>Dental, medical, &amp; healthcare clinics</li>
                    <li>Restaurants, cafes, &amp; hotels</li>
                    <li>Contractors, plumbers, &amp; electricians</li>
                    <li>Salons, spas, &amp; fitness gyms</li>
                    <li>Real-estate brokerages &amp; professional services</li>
                  </ul>
                </div>

                <div className="engine-example-box">
                  <span className="example-label">CONCRETE EXAMPLE:</span>
                  <div className="example-row">
                    <span>You want: <code>Dental Clinics in New York</code></span>
                    <span className="example-arrow">→</span>
                    <span className="example-solution">Use: <strong>Google Business Data</strong></span>
                  </div>
                </div>

                <div className="engine-rule-box">
                  <CheckCircle2 size={16} className="rule-icon" />
                  <span><strong>When to use:</strong> When your target business is likely to have a Google Business listing.</span>
                </div>
              </div>

              {/* ENGINE 2: Business Index */}
              <div className="engine-card engine-dorking">
                <div className="engine-card-header">
                  <div className="engine-icon-pill dorking-pill">
                    <Globe size={20} />
                  </div>
                  <div>
                    <span className="engine-tag dorking-tag">Engine #2</span>
                    <h3 className="engine-title">Business Index</h3>
                  </div>
                </div>

                <div className="engine-bestfor-badge">
                  <strong>Best for:</strong> Businesses with a digital/social presence
                </div>

                <p className="engine-text">
                  Business Index is broader than Google Business Data. It is designed to find businesses that have an online presence across platforms such as <strong>LinkedIn, Instagram, Facebook, YouTube</strong>, and other indexed business sources.
                </p>

                {/* Sub-Feature: Custom Website Search */}
                <div className="custom-url-subcard">
                  <div className="subcard-badge">BONUS CAPABILITY</div>
                  <h4>Custom Website URL Search</h4>
                  <p>
                    Business Index also allows you to work with a <strong>specific website URL</strong>. If you already know a website or directory where your target businesses exist, you can provide that URL and extract available data directly from that source.
                  </p>
                </div>

                <div className="engine-example-box">
                  <span className="example-label">CONCRETE EXAMPLE:</span>
                  <div className="example-row">
                    <span>You have a site with: <code>European Real Estate Companies</code></span>
                    <span className="example-arrow">→</span>
                    <span className="example-solution">Use: <strong>Business Index (Custom URL)</strong></span>
                  </div>
                </div>

                <div className="engine-rule-box">
                  <CheckCircle2 size={16} className="rule-icon" />
                  <span><strong>When to use:</strong> &ldquo;I know these businesses have an online/social presence, but I don&apos;t specifically need them to be Google Business listings.&rdquo;</span>
                </div>
              </div>

              {/* ENGINE 3: Yellow Pages */}
              <div className="engine-card engine-yellowpages">
                <div className="engine-card-header">
                  <div className="engine-icon-pill yp-pill">
                    <BookMarked size={20} />
                  </div>
                  <div>
                    <span className="engine-tag yp-tag">Engine #3</span>
                    <h3 className="engine-title">Yellow Pages</h3>
                  </div>
                </div>

                <div className="engine-bestfor-badge">
                  <strong>Best for:</strong> Yellow Pages directory data
                </div>

                <p className="engine-text">
                  This engine is specifically designed for businesses listed in <strong>Yellow Pages-type business directories</strong> (e.g., yellowpages.com, yell.com).
                </p>

                <p className="engine-subtext">
                  This engine is not meant to replace the other engines — it is a <strong>dedicated directory-specific source</strong> for trades, local services, and established vendors.
                </p>

                <div className="engine-example-box">
                  <span className="example-label">CONCRETE EXAMPLE:</span>
                  <div className="example-row">
                    <span>You want: <code>Plumbers in California</code> from Yellow Pages</span>
                    <span className="example-arrow">→</span>
                    <span className="example-solution">Use: <strong>Yellow Pages</strong></span>
                  </div>
                </div>

                <div className="engine-rule-box">
                  <CheckCircle2 size={16} className="rule-icon" />
                  <span><strong>When to use:</strong> When your target businesses are heavily cataloged in traditional directory listings.</span>
                </div>
              </div>

              {/* ENGINE 4: Yandex */}
              <div className="engine-card engine-yandex">
                <div className="engine-card-header">
                  <div className="engine-icon-pill yandex-pill">
                    <Compass size={20} />
                  </div>
                  <div>
                    <span className="engine-tag yandex-tag">Engine #4</span>
                    <h3 className="engine-title">Yandex</h3>
                  </div>
                </div>

                <div className="engine-bestfor-badge">
                  <strong>Best for:</strong> Russia-focused business discovery &amp; MAX Messenger
                </div>

                <p className="engine-text">
                  Yandex is a <strong>Russia-specific database and search ecosystem</strong>, particularly useful when targeting businesses in Russia and CIS regions.
                </p>

                <div className="yandex-highlight-box">
                  <strong>MAX Messenger Advantage:</strong>
                  <p>One of its key advantages is the automated extraction of <strong>MAX Messenger and chat-ready contact numbers</strong> where available.</p>
                </div>

                <div className="engine-example-box">
                  <span className="example-label">CONCRETE EXAMPLE:</span>
                  <div className="example-row">
                    <span>You want: <code>Real Estate Brokers in Moscow</code></span>
                    <span className="example-arrow">→</span>
                    <span className="example-solution">Use: <strong>Yandex</strong></span>
                  </div>
                </div>

                <div className="engine-rule-box">
                  <CheckCircle2 size={16} className="rule-icon" />
                  <span><strong>When to use:</strong> When your target market is Russia and you specifically want data from the Yandex ecosystem.</span>
                </div>
              </div>

              {/* ENGINE 5: WhatsApp Radar */}
              <div className="engine-card engine-whatsapp">
                <div className="engine-card-header">
                  <div className="engine-icon-pill whatsapp-pill">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <span className="engine-tag whatsapp-tag">Engine #5</span>
                    <h3 className="engine-title">WhatsApp Radar</h3>
                  </div>
                </div>

                <div className="engine-bestfor-badge">
                  <strong>Best for:</strong> Businesses with WhatsApp numbers
                </div>

                <p className="engine-text">
                  WhatsApp Radar is a dedicated engine for finding <strong>business data where WhatsApp contact numbers (wa.me/ direct click-to-chat links) are available</strong>.
                </p>

                <p className="engine-subtext">
                  The primary purpose is not simply finding another business listing — it is specifically built for outreach workflows where <strong>WhatsApp-ready contact information</strong> is essential.
                </p>

                <div className="engine-example-box">
                  <span className="example-label">CONCRETE EXAMPLE:</span>
                  <div className="example-row">
                    <span>You want: <code>Restaurants in Dubai with WhatsApp</code></span>
                    <span className="example-arrow">→</span>
                    <span className="example-solution">Use: <strong>WhatsApp Radar</strong></span>
                  </div>
                </div>

                <div className="engine-rule-box">
                  <CheckCircle2 size={16} className="rule-icon" />
                  <span><strong>When to use:</strong> When your outreach strategy involves contacting businesses through WhatsApp directly.</span>
                </div>
              </div>

            </div>
          </section>

          {/* SECTION 2: HOW DO I CHOOSE THE RIGHT ENGINE? */}
          <section id="choose" className="manual-section">
            <div className="section-head">
              <span className="section-num">SECTION 2</span>
              <h2 className="section-title">How Do I Choose the Right Engine?</h2>
              <p className="section-desc">
                Always think about: <strong>&ldquo;Where are my target businesses most naturally listed?&rdquo;</strong>
              </p>
            </div>

            <div className="matrix-table-wrap">
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th>Your Requirement</th>
                    <th>Recommended Engine</th>
                    <th>Why This Choice?</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Local businesses / Google Maps businesses</td>
                    <td><span className="engine-badge blue">Google Business Data</span></td>
                    <td>Pulls directly from verified Google Places listings with ratings &amp; addresses.</td>
                  </tr>
                  <tr>
                    <td>Businesses with LinkedIn / Instagram / Facebook / YouTube presence</td>
                    <td><span className="engine-badge purple">Business Index</span></td>
                    <td>Captures companies that prioritize social branding over local storefronts.</td>
                  </tr>
                  <tr>
                    <td>Specific website you want to extract from</td>
                    <td><span className="engine-badge purple">Business Index</span></td>
                    <td>Allows custom domain URL targeting to mine directory subpages.</td>
                  </tr>
                  <tr>
                    <td>Yellow Pages directory businesses</td>
                    <td><span className="engine-badge amber">Yellow Pages</span></td>
                    <td>Direct scan of traditional commercial service directories.</td>
                  </tr>
                  <tr>
                    <td>Russia-focused businesses / Yandex ecosystem</td>
                    <td><span className="engine-badge red">Yandex</span></td>
                    <td>Native Russian indexing + MAX Messenger number discovery.</td>
                  </tr>
                  <tr>
                    <td>Businesses where WhatsApp numbers are important</td>
                    <td><span className="engine-badge emerald">WhatsApp Radar</span></td>
                    <td>Strictly filters for verified <code>wa.me</code> click-to-chat links.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Quick Decision Rules */}
            <div className="decision-rules-box">
              <h3 className="rules-heading">The 5 Simple Rules:</h3>
              <div className="rules-grid">
                <div className="rule-chip">
                  <span className="rule-dot blue"></span>
                  <div>
                    <strong>Google listing</strong>
                    <span className="rule-arrow">→</span>
                    <span className="rule-target">Google Business Data</span>
                  </div>
                </div>
                <div className="rule-chip">
                  <span className="rule-dot purple"></span>
                  <div>
                    <strong>Social / online presence</strong>
                    <span className="rule-arrow">→</span>
                    <span className="rule-target">Business Index</span>
                  </div>
                </div>
                <div className="rule-chip">
                  <span className="rule-dot amber"></span>
                  <div>
                    <strong>Specific directory</strong>
                    <span className="rule-arrow">→</span>
                    <span className="rule-target">Yellow Pages</span>
                  </div>
                </div>
                <div className="rule-chip">
                  <span className="rule-dot red"></span>
                  <div>
                    <strong>Russia / Yandex</strong>
                    <span className="rule-arrow">→</span>
                    <span className="rule-target">Yandex</span>
                  </div>
                </div>
                <div className="rule-chip">
                  <span className="rule-dot emerald"></span>
                  <div>
                    <strong>WhatsApp contacts</strong>
                    <span className="rule-arrow">→</span>
                    <span className="rule-target">WhatsApp Radar</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: AFTER YOU GENERATE LEADS — WHAT NEXT? */}
          <section id="pipeline" className="manual-section">
            <div className="section-head">
              <span className="section-num">SECTION 3</span>
              <h2 className="section-title">After You Generate Leads — What Next?</h2>
              <p className="section-desc">
                Generating leads is only the first part. Once your leads are available inside your <strong>Database</strong>, you can use those leads for your cold outreach campaigns.
              </p>
            </div>

            <div className="pipeline-flow-card">
              <h3 className="pipeline-title">ContaQue cleanly separates:</h3>
              
              <div className="pipeline-steps-row">
                <div className="pipeline-step-item">
                  <div className="step-circle">1</div>
                  <div className="step-content">
                    <span className="step-tag">DISCOVERY</span>
                    <h4>Lead Generation</h4>
                    <p>Scrape targeted contacts across 5 engines using location &amp; keyword.</p>
                  </div>
                </div>

                <div className="pipeline-connector">
                  <ArrowRight size={20} />
                </div>

                <div className="pipeline-step-item">
                  <div className="step-circle">2</div>
                  <div className="step-content">
                    <span className="step-tag">ORGANIZATION</span>
                    <h4>Lead Database</h4>
                    <p>Permanently stored, searchable, deduplicated, and exportable to Excel/PDF.</p>
                  </div>
                </div>

                <div className="pipeline-connector">
                  <ArrowRight size={20} />
                </div>

                <div className="pipeline-step-item">
                  <div className="step-circle">3</div>
                  <div className="step-content">
                    <span className="step-tag">CONVERSION</span>
                    <h4>Outreach Campaigns</h4>
                    <p>Select email-bearing leads and launch personalized cold email campaigns.</p>
                  </div>
                </div>
              </div>

              <div className="pipeline-note-box">
                <CheckCircle2 size={18} className="note-icon" />
                <p>
                  <strong>No pressure to email immediately:</strong> You don&apos;t have to contact leads right away. Build and segment your database first, then decide which leads to reach out to when your copy is ready.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 4: BULK EMAIL OUTREACH */}
          <section id="outreach" className="manual-section">
            <div className="section-head">
              <span className="section-num">SECTION 4</span>
              <h2 className="section-title">Bulk Email Outreach</h2>
              <p className="section-desc">
                ContaQue includes a dedicated <strong>Bulk Email Outreach</strong> engine. The basic workflow is:
              </p>
            </div>

            <div className="workflow-summary-pill">
              <span className="workflow-seq">Connect Gmail</span>
              <span className="workflow-div">→</span>
              <span className="workflow-seq">Select Leads</span>
              <span className="workflow-div">→</span>
              <span className="workflow-seq">Create Campaign</span>
              <span className="workflow-div">→</span>
              <span className="workflow-seq">Send</span>
            </div>

            <div className="steps-cards-list">
              
              {/* STEP 1 */}
              <div className="outreach-step-card">
                <div className="step-card-num">STEP 1</div>
                <div className="step-card-body">
                  <h3 className="step-card-title">Add your Gmail account (via Google App Password)</h3>
                  <p className="step-card-desc">
                    Before sending campaigns, connect the Gmail account you want ContaQue to send from. ContaQue uses secure, direct SMTP delivery without OAuth token expiration.
                  </p>

                  <div className="app-password-requirements">
                    <strong>What you need:</strong>
                    <ol>
                      <li>Your standard Google / Gmail account.</li>
                      <li><strong>2-Step Verification enabled</strong> on your Google Account.</li>
                      <li>A <strong>16-digit Google App Password</strong> (generated from your Google Account Security settings).</li>
                    </ol>
                  </div>

                  <p className="step-card-tip">
                    The <em>Add Gmail Account</em> modal inside ContaQue already includes direct links and guidance for generating your 16-digit App Password in seconds.
                  </p>
                </div>
              </div>

              {/* STEP 2 */}
              <div className="outreach-step-card">
                <div className="step-card-num">STEP 2</div>
                <div className="step-card-body">
                  <h3 className="step-card-title">Select your leads from the Database</h3>
                  <p className="step-card-desc">
                    You don&apos;t need to manually type or copy-paste email addresses. You can select email addresses directly from the leads you have already generated and stored.
                  </p>

                  <div className="lead-selection-examples">
                    <div className="sel-pill">
                      <strong>Google Business Data</strong> → Generate leads → Database → Select with emails → <strong>Campaign</strong>
                    </div>
                    <div className="sel-pill">
                      <strong>Business Index</strong> → Generate leads → Database → Select with emails → <strong>Campaign</strong>
                    </div>
                  </div>

                  <p className="step-card-tip">
                    The same process applies to all engines where verified email addresses are discovered.
                  </p>
                </div>
              </div>

              {/* STEP 3 */}
              <div className="outreach-step-card">
                <div className="step-card-num">STEP 3</div>
                <div className="step-card-body">
                  <h3 className="step-card-title">Create and launch your campaign</h3>
                  <p className="step-card-desc">
                    Set up your outreach parameters with customized variables:
                  </p>

                  <ul className="campaign-setup-list">
                    <li><strong>Campaign Name:</strong> Descriptive title to track response rates.</li>
                    <li><strong>Email Subject:</strong> Compelling cold outreach subject line.</li>
                    <li><strong>Email Body:</strong> HTML or plain-text message with personalized tags (e.g., business name).</li>
                    <li><strong>Target Recipients:</strong> Selected lead list from your database.</li>
                    <li><strong>Sending Gmail Account:</strong> Pick which connected account to send from.</li>
                  </ul>

                  <p className="step-card-tip">
                    If your plan includes multiple Gmail accounts (e.g. Value Pack with up to 4 accounts), you can assign specific senders to specific campaigns.
                  </p>
                </div>
              </div>

            </div>
          </section>

          {/* SECTION 5: LEAD GENERATION VS EMAIL OUTREACH */}
          <section id="distinction" className="manual-section">
            <div className="section-head">
              <span className="section-num">SECTION 5</span>
              <h2 className="section-title">Lead Generation and Email Outreach Are Two Different Things</h2>
              <p className="section-desc">
                Understanding this architectural distinction ensures seamless execution:
              </p>
            </div>

            <div className="distinction-grid">
              
              <div className="distinction-card gen-card">
                <div className="dist-head">
                  <Database size={24} className="dist-icon" />
                  <div>
                    <span className="dist-tag">FUNCTION A</span>
                    <h3>Lead Generation</h3>
                  </div>
                </div>

                <p className="dist-desc">
                  Find businesses and contact information across the 5 search engines.
                </p>

                <div className="dist-formula">
                  <span>FORMULA:</span>
                  <strong>Engines → Database</strong>
                </div>
              </div>

              <div className="distinction-card outreach-card">
                <div className="dist-head">
                  <Send size={24} className="dist-icon" />
                  <div>
                    <span className="dist-tag">FUNCTION B</span>
                    <h3>Email Outreach</h3>
                  </div>
                </div>

                <p className="dist-desc">
                  Contact those leads using your connected Gmail accounts safely.
                </p>

                <div className="dist-formula">
                  <span>FORMULA:</span>
                  <strong>Database → Select Emails → Campaign → Gmail</strong>
                </div>
              </div>

            </div>

            {/* Core Summary Mantra */}
            <div className="core-mantra-card">
              <span className="mantra-label">HOW TO THINK ABOUT CONTAQUE:</span>
              <div className="mantra-chain">
                <div className="mantra-step">FIND</div>
                <div className="mantra-arrow">→</div>
                <div className="mantra-step">STORE</div>
                <div className="mantra-arrow">→</div>
                <div className="mantra-step">SELECT</div>
                <div className="mantra-arrow">→</div>
                <div className="mantra-step">OUTREACH</div>
              </div>
            </div>

            {/* Bottom Actions CTA */}
            <div className="manual-footer-cta">
              <div className="footer-cta-info">
                <h3>Ready to start discovering leads?</h3>
                <p>Choose your engine, specify your keyword and location, and launch your first scraping job.</p>
              </div>
              <div className="footer-cta-actions">
                <a 
                  href="/ContaQue_User_Guide.pdf" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="manual-action-btn secondary"
                >
                  <Download size={15} />
                  <span>Download PDF Manual</span>
                </a>
                <Link to="/generate" className="manual-action-btn primary">
                  <span>Start Generating Leads</span>
                  <ArrowRight size={15} />
                </Link>
              </div>
            </div>

          </section>

        </div>
      </main>

      {/* FOOTER */}
      <footer className="manual-footer">
        <div className="manual-container">
          <p>© {new Date().getFullYear()} ContaQue by Klyrova Inc. All rights reserved.</p>
          <div className="footer-links">
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/support">Help &amp; Support</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms &amp; Conditions</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
