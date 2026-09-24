import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RazorpayCheckoutModal from '../components/RazorpayCheckoutModal';
import { 
  Sparkles, Zap, Database, Mail, ShieldCheck, CheckCircle2, 
  ArrowRight, Globe, MapPin, Phone, MessageSquare, Play, 
  Calendar, Users, Building, HelpCircle, ChevronDown, ChevronUp, 
  Star, ExternalLink, RefreshCw, X, Layers, Check, Clock, Send,
  TrendingUp, DollarSign, Award, Sliders, Search, BarChart3
} from 'lucide-react';
import './LandingPage.css';

// Smooth Rolling Animated Number
function AnimatedCounter({ end, duration = 1200, prefix = '', suffix = '' }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(ease * end));
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    const req = requestAnimationFrame(step);
    return () => cancelAnimationFrame(req);
  }, [end, duration]);

  return <>{prefix}{count.toLocaleString()}{suffix}</>;
}

// 4 Multi-Engine Live Simulation Pipelines
const SIMULATED_PIPELINES = [
  {
    query: 'Dental Clinics in Moscow',
    engine: 'YANDEX ENGINE',
    status: 'MAX Messenger (+7) Ready',
    progress: 94,
    extracted: 58,
    leads: [
      { name: 'DentaMed Moscow Center', contact: '+7 (495) 933-86-86', loc: 'Moscow, Tverskaya', tag: '💬 MAX Ready', badge: '100% Valid' },
      { name: 'Smile Studio Premium', contact: '+7 (495) 812-40-10', loc: 'Moscow, Arbat', tag: '💬 MAX Ready', badge: '100% Valid' },
      { name: 'EuroDent Specialist Group', contact: '+7 (495) 609-12-34', loc: 'Moscow, Leninsky', tag: '💬 MAX Ready', badge: '100% Valid' }
    ]
  },
  {
    query: 'Real Estate Brokers in Dubai',
    engine: 'WHATSAPP RADAR ENGINE',
    status: '100% Active WhatsApp Mobile Numbers',
    progress: 94,
    extracted: 68,
    leads: [
      { name: 'Emaar Luxury Properties', contact: '+971 50 367 3333', loc: 'Downtown Dubai', tag: '🟢 Active on WA', badge: 'Verified 40%+ Open' },
      { name: 'Damac Hills Real Estate', contact: '+971 52 445 0000', loc: 'Business Bay', tag: '🟢 Active on WA', badge: 'Verified 40%+ Open' },
      { name: 'Sobha Realty Partners', contact: '+971 55 423 8888', loc: 'Dubai Marina', tag: '🟢 Active on WA', badge: 'Verified 40%+ Open' }
    ]
  },
  {
    query: 'B2B SaaS Founders in California',
    engine: 'BUSINESS INDEX DORKING',
    status: 'LinkedIn Profile Discovery',
    progress: 96,
    extracted: 44,
    leads: [
      { name: 'CloudScale Technologies', contact: 'alex@cloudscale.io', loc: 'San Francisco, CA', tag: '💼 LinkedIn', badge: 'Verified Email' },
      { name: 'DataPulse Analytics', contact: 'sarah@datapulse.ai', loc: 'Palo Alto, CA', tag: '💼 LinkedIn', badge: 'Verified Email' },
      { name: 'HyperFlow Systems', contact: 'david@hyperflow.com', loc: 'San Jose, CA', tag: '💼 LinkedIn', badge: 'Verified Email' }
    ]
  },
  {
    query: 'HVAC Repair Contractors in Toronto',
    engine: 'YELLOW PAGES ENGINE',
    status: 'Directory Landlines Validated',
    progress: 92,
    extracted: 54,
    leads: [
      { name: 'Toronto Climate Experts', contact: '+1 (416) 555-0199', loc: 'Downtown Toronto', tag: '📞 Direct Landline', badge: 'Verified' },
      { name: 'Maple Leaf Heating & Air', contact: '+1 (416) 555-0322', loc: 'North York, ON', tag: '📞 Direct Landline', badge: 'Verified' },
      { name: 'Ontario Comfort Systems', contact: '+1 (416) 555-0811', loc: 'Scarborough, ON', tag: '📞 Direct Landline', badge: 'Verified' }
    ]
  }
];

// Real-Time Global Outreach & Scraping Live Activity Feed
const LIVE_ACTIVITIES = [
  { name: 'Alex M.', location: 'London, UK', action: 'mined 540 Dental Clinics with direct phone numbers', time: '12s ago', icon: '📍' },
  { name: 'Dmitry K.', location: 'Moscow, RU', action: 'verified 310 Russian contacts with 1-Click MAX Messenger', time: '35s ago', icon: '💬' },
  { name: 'Sarah T.', location: 'San Francisco, US', action: 'dispatched 1,200 cold emails via rotating Gmail SMTP', time: '1m ago', icon: '✉️' },
  { name: 'Tariq A.', location: 'Dubai, UAE', action: 'extracted 680 Luxury Real Estate brokers with WhatsApp Radar', time: '2m ago', icon: '🟢' },
  { name: 'Julian R.', location: 'Toronto, CA', action: 'exported 920 B2B Contractors into Excel spreadsheet', time: '3m ago', icon: '⚡' },
];

// 6 Specialized Growth Engines Bento Data
const ENGINES_DATA = [
  {
    id: 'maps',
    name: 'Google Business Data',
    tabLabel: 'Google Business',
    badge: 'Real-time Places API',
    tagline: 'Deep local business intelligence extracted at scale across 200+ countries.',
    metrics: '99.2% Address & Phone Accuracy',
    color: '#4f46e5',
    features: [
      'Official business name, ratings, and verified review counts',
      'Direct contact phone numbers with country calling code',
      'Operating addresses, postal codes, and map geo-coordinates',
      'Corporate website URLs and primary business categories'
    ],
    sampleLeads: [
      { name: 'Apex Dental Care', phone: '+1 (212) 555-0192', loc: 'New York, USA', cat: 'Dentist', status: 'VERIFIED' },
      { name: 'Metro Health Clinic', phone: '+1 (212) 555-0481', loc: 'New York, USA', cat: 'Dentist', status: 'VERIFIED' },
      { name: 'Skyline Smiles Group', phone: '+1 (212) 555-0833', loc: 'New York, USA', cat: 'Dentist', status: 'VERIFIED' }
    ]
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Radar',
    tabLabel: 'WhatsApp Radar',
    badge: '🔥 Highest Response Rate (40%+ Open Rate)',
    tagline: 'Skip the spam folder. Connect directly where B2B decision-makers read 98% of messages within 3 minutes.',
    metrics: '100% Active WhatsApp Mobiles',
    color: '#10b981',
    features: [
      'Real-time filtering of 100% active, WhatsApp-enabled mobile numbers only',
      'Eliminates dead landlines, IVR phone trees, and gatekeeper switchboards',
      'Instant Click-to-Chat wa.me direct link generation for 1-click outreach',
      'Direct contact name, verified mobile digits, and business category attribution'
    ],
    sampleLeads: [
      { name: 'Apex Prime Realty', phone: '+971 50 123 4567', loc: 'Dubai Marina, UAE', cat: 'Real Estate (WA)', status: '🟢 ACTIVE ON WA', waLink: 'https://wa.me/971501234567' },
      { name: 'Elite Design Studio', phone: '+44 7700 900123', loc: 'London, UK', cat: 'Agency (WA)', status: '🟢 ACTIVE ON WA', waLink: 'https://wa.me/447700900123' },
      { name: 'Sunrise Dental Specialists', phone: '+91 98200 12345', loc: 'Mumbai, India', cat: 'Clinic (WA)', status: '🟢 ACTIVE ON WA', waLink: 'https://wa.me/919820012345' }
    ]
  },
  {
    id: 'dorking',
    name: 'Business Index (Social Discovery)',
    tabLabel: 'Social Discovery',
    badge: 'Custom Platform Dorking',
    tagline: 'Targeted executive and company discovery across LinkedIn, Instagram, Facebook, and custom domains.',
    metrics: 'Multi-Channel Profile Matching',
    color: '#06b6d4',
    features: [
      'Extract decision-maker profiles from LinkedIn, Instagram, X, and Facebook',
      'Target any custom platform (Clutch.co, Medium, Behance, GitHub)',
      'Direct extraction of public executive email addresses',
      'B2B company size and founder profile URL attribution'
    ],
    sampleLeads: [
      { name: 'CloudScale Technologies', phone: '+91 80 4123 9900', loc: 'Bangalore, India', cat: 'Software (LinkedIn)', status: 'VERIFIED' },
      { name: 'InnoVibe Labs', phone: '+91 80 2341 8812', loc: 'Bangalore, India', cat: 'SaaS Founder', status: 'VERIFIED' },
      { name: 'DataPulse Systems', phone: '+91 80 6512 0045', loc: 'Bangalore, India', cat: 'Fintech (LinkedIn)', status: 'VERIFIED' }
    ]
  },
  {
    id: 'yellowpages',
    name: 'Yellow Pages Engine',
    tabLabel: 'Yellow Pages',
    badge: 'High-Yield Directories',
    tagline: 'High-volume localized business directory extraction across specific trades, contractors, and local service providers.',
    metrics: 'Fastest Bulk Extraction',
    color: '#f59e0b',
    features: [
      'Direct access to thousands of local service providers and contractors',
      'Established landlines and direct branch phone numbers',
      'Physical commercial addresses across North American & European directories',
      'Zero proxy blocks with built-in rotational bypass'
    ],
    sampleLeads: [
      { name: 'Precision Auto Garage', phone: '+1 (416) 555-0182', loc: 'Toronto, Canada', cat: 'Auto Repair', status: 'VERIFIED' },
      { name: 'Maple Leaf Collision', phone: '+1 (416) 555-0391', loc: 'Toronto, Canada', cat: 'Auto Repair', status: 'VERIFIED' },
      { name: 'Downtown Motors Service', phone: '+1 (416) 555-0722', loc: 'Toronto, Canada', cat: 'Mechanic', status: 'VERIFIED' }
    ]
  },
  {
    id: 'yandex',
    name: 'Yandex (MAX Messenger Ready)',
    tabLabel: 'Yandex & MAX',
    badge: 'Exclusive CIS & Russian Network',
    tagline: 'Direct Russian and Eastern European discovery with integrated 1-click MAX Messenger (+7) outreach.',
    metrics: 'Direct Mobile & MAX Discovery',
    color: '#ec4899',
    features: [
      'Full Cyrillic and English keyword synonym auto-expansion',
      'Automatic normalization of domestic Russian numbers (+7 / 8 format)',
      '1-Click MAX Messenger integration for direct Russian mobile chats',
      'High-yield extraction of clinics, salons, real estate, and B2B services'
    ],
    sampleLeads: [
      { name: 'DentaMed Clinic', phone: '+7 (495) 933-86-86', loc: 'Moscow, Russia', cat: 'Dental (MAX)', status: 'VERIFIED' },
      { name: 'Smile Studio Moscow', phone: '+7 (495) 812-40-10', loc: 'Moscow, Russia', cat: 'Clinic (MAX)', status: 'VERIFIED' },
      { name: 'EvroDent Tverskaya', phone: '+7 (495) 609-12-34', loc: 'Moscow, Russia', cat: 'Dentist (MAX)', status: 'VERIFIED' }
    ]
  },
  {
    id: 'mailer',
    name: 'Built-in Bulk Cold Outreach',
    tabLabel: 'Bulk Cold Mailer',
    badge: 'Automated SMTP Rotation',
    tagline: 'Queue automated cold email campaigns using rotating Gmail App Passwords with zero external tools needed.',
    metrics: 'High Inbox Deliverability',
    color: '#10b981',
    features: [
      'Rotating sender pool across multiple Gmail and Google Workspace accounts',
      'Dynamic email template variables: {{Business Name}}, {{Location}}, {{Category}}',
      'Smart batch throttle and delay settings to protect sender reputation',
      'Real-time delivery, queue telemetry, and failed attempt monitoring'
    ],
    sampleLeads: [
      { name: 'Target: 1,420 Enriched Leads', phone: 'Batch #12 Active', loc: 'Auto-Spam Protection', cat: 'Template: Cold Pitch', status: 'SENDING' },
      { name: 'Sender: outreach@growthhub.io', phone: '48 Sent / 0 Bounced', loc: 'Gmail SMTP Pool', cat: 'Queue: 180 Pending', status: 'ACTIVE' }
    ]
  }
];

const FAQS = [
  {
    q: 'How does Contaques verify contact information?',
    a: 'Contaques runs multi-pass validation on every lead extracted. Phone numbers are validated against standard ITU-T E.164 formats, geographical area codes, and carrier prefixes. For Russian and CIS leads, domestic numbers starting with 8 are automatically normalized to +7 with MAX Messenger validation.'
  },
  {
    q: 'Do I need to manage proxies or worry about IP bans?',
    a: 'No. Contaques incorporates enterprise proxy rotation, intelligent request pacing, and dual directory backfill mechanisms under the hood. You never have to purchase external proxies or worry about getting blocked.'
  },
  {
    q: 'What is the MAX Messenger integration for Russia?',
    a: 'In Russia and CIS territories where WhatsApp is heavily restricted, MAX Messenger (max.ru / web.max.ru) is the state-mandated standard. Contaques automatically extracts, validates, and provides 1-click clipboard and direct web chat initiation for all +7 Russian phone numbers.'
  },
  {
    q: 'How does the built-in cold email outreach work?',
    a: 'You can connect multiple Gmail or Google Workspace accounts using secure App Passwords. Contaques automatically rotates sender accounts per campaign batch, substitutes dynamic placeholders (e.g. {{Business Name}}), and throttles sending to maintain pristine inbox delivery.'
  },
  {
    q: 'How does WhatsApp Radar filter 100% active WhatsApp numbers?',
    a: 'WhatsApp Radar filters extracted international phone numbers through carrier prefix validation and mobile network lookups to isolate genuine personal and business mobile numbers. It discards dead landlines, automated switchboards, and IVR systems so you can initiate direct Click-to-Chat conversations on wa.me with over 40% open rates.'
  },
  {
    q: 'Can I export leads to CSV, Excel, or PDF?',
    a: 'Yes! You can filter and export enriched leads in 1-click to Microsoft Excel (.xlsx), CSV (.csv), or structured PDF format, ready to be imported into any CRM like HubSpot, Salesforce, or Pipedrive.'
  }
];

// Exact Pricing Structure (Free, Value Plus, Value Pack)
const PRICING_PLANS = [
  {
    id: 'free',
    name: 'Free Plan',
    icon: '🆓',
    badge: 'PAY AS YOU GO',
    price: {
      INR: '₹0',
      USD: '$0'
    },
    period: '/month',
    tagline: 'Pay only for leads you generate',
    leadRates: [
      { engine: 'Google Business Index', inr: '₹1.30', usd: '$0.014' },
      { engine: 'Social / Custom Discovery', inr: '₹1.00', usd: '$0.010' },
      { engine: 'WhatsApp Radar', inr: '₹1.00', usd: '$0.010' },
      { engine: 'Yellow Pages', inr: '₹0.60', usd: '$0.006' },
      { engine: 'Yandex', inr: '₹1.70', usd: '$0.018' },
    ],
    features: [
      { text: '✕ Email Campaigns', excluded: true },
      { text: '✕ Gmail sending accounts', excluded: true },
      { text: 'No monthly fees or commitments' },
      { text: 'Access to all 5 scraping engines' },
      { text: 'WhatsApp phone status isolation' },
      { text: '1-Click Excel, CSV, PDF Export' },
    ],
    cta: 'Get Started Free',
    isPopular: false,
    theme: 'subtle'
  },
  {
    id: 'plus',
    name: 'Value Plus',
    icon: '⚡',
    badge: 'MOST POPULAR',
    price: {
      INR: '₹299',
      USD: '$3.50'
    },
    period: '/month',
    tagline: 'Email outreach + discounted rates',
    leadRates: [
      { engine: 'Google Business Index', inr: '₹1.10', usd: '$0.011' },
      { engine: 'Social / Custom Discovery', inr: '₹0.80', usd: '$0.008' },
      { engine: 'WhatsApp Radar', inr: '₹0.80', usd: '$0.008' },
      { engine: 'Yellow Pages', inr: '₹0.50', usd: '$0.005' },
      { engine: 'Yandex', inr: '₹1.50', usd: '$0.016' },
    ],
    features: [
      { text: '✓ Email Campaigns', highlight: true },
      { text: '✓ 1 Gmail sending account', highlight: true },
      { text: '✓ 400 emails/day', highlight: true },
      { text: 'Discounted per-lead scraping rates' },
      { text: 'Priority parallel scraper workers' },
      { text: 'Cloud job history & persistence' },
    ],
    cta: 'Upgrade to Value Plus',
    isPopular: true,
    theme: 'gradient'
  },
  {
    id: 'pack',
    name: 'Value Pack',
    icon: '🚀',
    badge: 'ALL-IN-ONE POWERHOUSE',
    price: {
      INR: '₹499',
      USD: '$5.50'
    },
    period: '/month',
    tagline: 'Lowest rates + multi-account outreach',
    leadRates: [
      { engine: 'Google Business Index', inr: '₹1.00', usd: '$0.010' },
      { engine: 'Social / Custom Discovery', inr: '₹0.80', usd: '$0.008' },
      { engine: 'WhatsApp Radar', inr: '₹0.80', usd: '$0.008' },
      { engine: 'Yellow Pages', inr: '₹0.50', usd: '$0.005' },
      { engine: 'Yandex', inr: '₹1.30', usd: '$0.014' },
    ],
    features: [
      { text: '✓ Email Campaigns', highlight: true },
      { text: '✓ Up to 4 Gmail sending accounts', highlight: true },
      { text: '✓ 1,600 emails/day', highlight: true },
      { text: 'Lowest rates across all 5 engines' },
      { text: 'Multi-account rotation queue' },
      { text: '2-way unified inbox for replies' },
    ],
    cta: 'Get Value Pack',
    isPopular: false,
    theme: 'gold'
  }
];

function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, signup } = useAuth();

  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedCheckoutPlan, setSelectedCheckoutPlan] = useState(null);

  const handlePricingAction = (plan) => {
    if (plan.id === 'free') {
      navigate('/signup?plan=free');
    } else {
      if (!isAuthenticated) {
        // Direct unauthenticated users to create their account first with the chosen plan
        navigate(`/signup?plan=${plan.id}`);
      } else {
        setSelectedCheckoutPlan(plan);
        setIsCheckoutOpen(true);
      }
    }
  };

  const handleCheckoutSuccess = async (receipt) => {
    setIsCheckoutOpen(false);
    navigate('/dashboard', { replace: true });
  };

  // Active state for Engine Tab Switcher
  const [activeEngine, setActiveEngine] = useState('maps');

  // Currency Toggle State ('INR' | 'USD')
  const [currency, setCurrency] = useState('INR');


  // Live Scraper Simulation Pipeline Index
  const [simIndex, setSimIndex] = useState(0);

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  // Auto-cycle simulation queries every 4.5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setSimIndex(prev => (prev + 1) % SIMULATED_PIPELINES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // Live Activity Toast State & Rotation (every 5.5s)
  const [activityIndex, setActivityIndex] = useState(0);
  const [showActivityToast, setShowActivityToast] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setActivityIndex(prev => (prev + 1) % LIVE_ACTIVITIES.length);
    }, 5500);
    return () => clearInterval(timer);
  }, []);


  // Mockup Send Sequence Demo State
  const [sequenceSent, setSequenceSent] = useState(false);

  const handleSendSequence = (e) => {
    e.preventDefault();
    setSequenceSent(true);
    setTimeout(() => setSequenceSent(false), 2000);
  };

  // Newsletter State
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    if (newsletterEmail.trim()) {
      setNewsletterSubscribed(true);
      setTimeout(() => setNewsletterSubscribed(false), 3000);
      setNewsletterEmail('');
    }
  };

  const currentSim = SIMULATED_PIPELINES[simIndex];
  const selectedEngineData = ENGINES_DATA.find(e => e.id === activeEngine) || ENGINES_DATA[0];

  return (
    <div className="landing-container">
      {/* Background Animated Ambient Mesh */}
      <div className="ambient-canvas">
        <div className="ambient-sphere sphere-1"></div>
        <div className="ambient-sphere sphere-2"></div>
        <div className="ambient-sphere sphere-3"></div>
      </div>

      {/* Sticky Glass Navbar */}
      <header className="landing-navbar">
        <div className="navbar-inner">
          <div className="brand-group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} title="Contaque - Find | Connect | Grow">
            <img 
              src="/contaque_logo.jpg" 
              alt="Contaque" 
              className="brand-logo-img" 
            />
          </div>

          <nav className="nav-links-desktop">
            <a href="#engines">How It Works</a>
            <a href="#pricing">Pricing</a>
            <a href="#comparison">Why Contaques</a>
            <a href="#faq">FAQ</a>
            <a href="/contact" onClick={(e) => { e.preventDefault(); navigate('/contact'); }}>Contact Us</a>
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
              onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')} 
              title="Launch Contaques Dashboard"
            >
              <Zap size={14} />
              <span>Launch</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-pill-badge floating-element">
            <span className="pulsing-beacon"></span>
            <span className="badge-text">6 SPECIALIZED GROWTH ENGINES • ZERO PROXY CONFIGURATION</span>
          </div>

          <h1 className="hero-headline">
            Automate B2B Lead Extraction & <br />
            <span className="gradient-text glow-animated">Cold Outreach on Autopilot</span>
          </h1>

          <p className="hero-subheadline">
            Extract verified emails, phone numbers, and WhatsApp-ready contacts across 6 powerful data engines—from Google business indexes , Socials to Yandex. Build your list and launch targeted outreach directly from one dashboard
          </p>

          {/* Conversion CTA Button */}
          <div className="hero-cta-group">
            <button 
              type="button" 
              className="hero-cta-btn hero-cta-large"
              onClick={() => navigate('/signup')}
            >
              <span>Get Started Free</span>
              <ArrowRight size={18} />
            </button>
          </div>

          {/* Animated Social Proof Ticker */}
          <div className="hero-social-proof-bar">
            <div className="proof-item">
              <strong>
                <AnimatedCounter end={10480210} prefix="" suffix="+" />
              </strong>
              <span>Verified Leads Mined</span>
            </div>
            <div className="proof-divider"></div>
            <div className="proof-item">
              <strong>98.4%</strong>
              <span>Valid Contact Rate</span>
            </div>
            <div className="proof-divider"></div>
            <div className="proof-item">
              <strong>6 Engines</strong>
              <span>Unified in 1 System</span>
            </div>
            <div className="proof-divider"></div>
            <div className="proof-item">
              <strong>
                <AnimatedCounter end={1420} prefix="" suffix="+" />
              </strong>
              <span>Growth Agencies & Teams</span>
            </div>
          </div>
        </div>

        {/* Live Multi-Pipeline Interactive Scraper Mockup */}
        <div className="hero-mockup-wrapper">
          {/* Dynamic Floating Badges */}
          <div className="hero-floating-badge badge-top-right">
            <Zap size={15} style={{ color: '#f59e0b' }} />
            <span>4 Parallel Scraper Workers Active</span>
          </div>
          <div className="hero-floating-badge badge-bottom-left">
            <ShieldCheck size={15} style={{ color: '#10b981' }} />
            <span>WhatsApp Radar & Russian MAX (+7) Verified</span>
          </div>

          <div className="mockup-rotating-beam-frame">
            <div className="mockup-window-frame">
              <div className="mockup-header-bar">
                <div className="window-dots">
                  <span className="dot red"></span>
                  <span className="dot yellow"></span>
                  <span className="dot green"></span>
                </div>
                <div className="mockup-search-preview">
                  <Globe size={13} />
                  <span>contaques.pro/engine/live-pipeline</span>
                </div>
                <div className="mockup-live-status">
                  <span className="green-pulse"></span>
                  <span>Active Scrape: 4 Parallel Workers</span>
                </div>
              </div>

              <div className="mockup-body">
                {/* Simulated Pipeline Selector Chips */}
                <div className="mockup-chips-row">
                  {SIMULATED_PIPELINES.map((p, idx) => (
                    <button
                      key={idx}
                      className={`mockup-chip-btn ${simIndex === idx ? 'active' : ''}`}
                      onClick={() => setSimIndex(idx)}
                    >
                      <span className="chip-dot"></span>
                      <span>{p.query}</span>
                    </button>
                  ))}
                </div>

                <div className="mockup-top-stats">
                  <div className="m-stat">
                    <span className="m-label">Active Query</span>
                    <strong className="m-value query-slide" key={currentSim.query}>{currentSim.query}</strong>
                  </div>
                  <div className="m-stat">
                    <span className="m-label">Engine & Status</span>
                    <strong className="m-value emerald">{currentSim.status}</strong>
                  </div>
                  <div className="m-stat">
                    <span className="m-label">Verified Extracted</span>
                    <strong className="m-value">{currentSim.extracted} Contacts</strong>
                  </div>
                  <button 
                    type="button"
                    className={`mockup-trigger-btn ${sequenceSent ? 'sent' : ''}`}
                    onClick={handleSendSequence}
                    title="Send Sequence Demo"
                  >
                    {sequenceSent ? (
                      <>
                        <Check size={13} />
                        <span>Sequence Queued!</span>
                      </>
                    ) : (
                      <>
                        <Send size={13} />
                        <span>Send Sequence</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Animated Progress Bar */}
                <div className="mockup-progress-track">
                  <div 
                    className="mockup-progress-fill" 
                    style={{ width: `${currentSim.progress}%` }}
                  ></div>
                </div>

                <div className="mockup-leads-table">
                  <div className="m-table-header">
                    <span>Business Name</span>
                    <span>Direct Contact</span>
                    <span>Location</span>
                    <span>Channel</span>
                    <span>Verification</span>
                  </div>
                  {currentSim.leads.map((lead, lIdx) => (
                    <div className="m-table-row animate-slide-in" key={`${simIndex}-${lIdx}`}>
                      <span className="bold-name">{lead.name}</span>
                      <span className="code-text">{lead.contact}</span>
                      <span>{lead.loc}</span>
                      <span className={`channel-pill ${lead.tag.includes('MAX') ? 'max' : lead.tag.includes('WhatsApp') ? 'wa' : 'default'}`}>
                        {lead.tag}
                      </span>
                      <span className="badge-verified"><CheckCircle2 size={12} /> {lead.badge}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The 6 Specialized Growth Engines Bento Showcase */}
      <section className="section-container" id="engines">
        <div className="section-header-center">
          <span className="section-pill">ALL-IN-ONE ARCHITECTURE</span>
          <h2>6 Specialized Growth Engines. One Unified Pipeline.</h2>
          <p>Switch seamlessly between Google Maps, WhatsApp Radar, custom social networks, localized trade directories, Russian MAX Messenger, and built-in bulk mailer.</p>
        </div>

        <div className="engines-tabs-bar">
          {ENGINES_DATA.map(engine => (
            <button
              key={engine.id}
              className={`engine-tab-btn ${activeEngine === engine.id ? 'active' : ''} ${engine.id === 'whatsapp' ? 'wa-tab' : ''}`}
              onClick={() => setActiveEngine(engine.id)}
            >
              {engine.id === 'whatsapp' && <span className="tab-wa-dot">🟢</span>}
              <span>{engine.tabLabel || engine.name}</span>
            </button>
          ))}
        </div>

        <div className="engine-showcase-card animate-fade-in" key={activeEngine}>
          <div className="showcase-left">
            <div className="engine-badge-row">
              <span className={`engine-badge ${activeEngine === 'whatsapp' ? 'badge-wa-emerald' : ''}`}>{selectedEngineData.badge}</span>
              <span className="engine-metrics-tag">{selectedEngineData.metrics}</span>
            </div>
            <h3>{selectedEngineData.name}</h3>
            <p className="engine-tagline">{selectedEngineData.tagline}</p>

            <ul className="engine-features-list">
              {selectedEngineData.features.map((feat, idx) => (
                <li key={idx} className="animate-feat-item" style={{ animationDelay: `${idx * 0.08}s` }}>
                  <CheckCircle2 size={16} className="feat-check" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>

            <div className="showcase-action-btns">
              {activeEngine === 'whatsapp' ? (
                <>
                  <button className="btn-emerald-gradient" onClick={() => navigate(isAuthenticated ? '/generate' : '/signup')}>
                    <MessageSquare size={15} />
                    <span>Launch WhatsApp Radar</span>
                  </button>
                  <button className="btn-glass-subtle" onClick={() => navigate(isAuthenticated ? '/database' : '/signup')}>
                    <span>View Extracted Database</span>
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-primary-gradient" onClick={() => navigate(isAuthenticated ? '/generate' : '/signup')}>
                    <span>Deploy This Engine</span>
                    <ArrowRight size={15} />
                  </button>
                  <button className="btn-glass-subtle" onClick={() => navigate(isAuthenticated ? '/database' : '/signup')}>
                    <span>View Extracted Database</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="showcase-right">
            <div className="live-preview-box">
              <div className="preview-top">
                <span className="preview-title">Real-Time Extraction Sample</span>
                <span className="preview-live-indicator">
                  <span className="live-pulse-dot"></span>
                  Live Output
                </span>
              </div>
              <div className="preview-table">
                {selectedEngineData.sampleLeads.map((item, idx) => (
                  <div className="sample-card interactive-hover-card" key={idx}>
                    <div className="sample-info">
                      <strong className="sample-name">{item.name}</strong>
                      <span className="sample-sub">{item.loc} • {item.cat}</span>
                    </div>
                    <div className="sample-contact-box">
                      <span className="sample-phone">{item.phone}</span>
                      <span className={`sample-status-badge ${item.status.includes('WA') ? 'wa-status' : ''}`}>{item.status}</span>
                      {item.waLink && (
                        <a 
                          href={item.waLink} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="sample-wa-chat-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Chat Now (wa.me) ↗
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Step-by-Step Workflow */}
      <section className="section-container" id="how-it-works">
        <div className="section-header-center">
          <span className="section-pill">INSTANT EXECUTION</span>
          <h2>How Contaques Puts Your Outbound on Autopilot</h2>
          <p>From zero contacts to an active automated outreach campaign in under 3 minutes.</p>
        </div>

        <div className="workflow-grid">
          <div className="workflow-step-card interactive-hover-card">
            <div className="step-number">01</div>
            <h4>Define Search Criteria</h4>
            <p>Select your target data engine, specify the industry niche (e.g. Real Estate, Dentists, IT Companies), and input the target location.</p>
            <div className="step-tag">Dual Directory AI Matching</div>
          </div>

          <div className="workflow-step-card interactive-hover-card">
            <div className="step-number">02</div>
            <h4>Automatic Enrichment</h4>
            <p>Our background scrapers bypass blockers, isolate 100% active WhatsApp numbers, normalize international formats (+1, +971, +7 MAX), and verify decision-maker emails.</p>
            <div className="step-tag">Zero Duplicates Guaranteed</div>
          </div>

          <div className="workflow-step-card interactive-hover-card">
            <div className="step-number">03</div>
            <h4>Export or Launch Multi-Channel Outreach</h4>
            <p>Export in 1-click to Excel/CSV, dispatch rotating Gmail cold email campaigns, or export pre-validated WhatsApp mobile lists for instant conversational messaging.</p>
            <div className="step-tag">1-Click Multi-Channel Ready</div>
          </div>
        </div>
      </section>

      {/* Comparison: Why Contaques Beats Generic Tools */}
      <section className="section-container" id="comparison">
        <div className="section-header-center">
          <span className="section-pill">COMPETITIVE ADVANTAGE</span>
          <h2>Why Top Growth Agencies Choose Contaques</h2>
          <p>Compare our automated multi-engine pipeline against traditional manual prospecting and expensive single-source scrapers.</p>
        </div>

        <div className="comparison-mobile-scroll-tip">
          <ArrowRight size={13} />
          <span>Swipe horizontally to compare all platforms</span>
        </div>

        <div className="comparison-table-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Capabilities</th>
                <th className="highlight-col">Contaques Intelligence</th>
                <th>Generic Scrapers</th>
                <th>Manual Prospecting</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Data Engine Diversity</td>
                <td className="highlight-col"><strong>6 Unified Growth Engines</strong> (Google, WhatsApp Radar, Social, YP, Yandex, Mailer)</td>
                <td>Single source only</td>
                <td>Manual search tabs</td>
              </tr>
              <tr>
                <td>Direct WhatsApp Messaging</td>
                <td className="highlight-col"><strong>100% Active Mobile Radar + Click-to-Chat</strong></td>
                <td>Dead office landlines & IVRs</td>
                <td>Manual phone saving & checking</td>
              </tr>
              <tr>
                <td>Russia & CIS Outreach</td>
                <td className="highlight-col"><strong>1-Click MAX Messenger (+7)</strong></td>
                <td>Zero support</td>
                <td>Impossible without local SIM</td>
              </tr>
              <tr>
                <td>Integrated Cold Mailer</td>
                <td className="highlight-col"><strong>Built-in Rotating Gmail Pool</strong></td>
                <td>Requires 3rd party tool ($99/mo)</td>
                <td>Manual 1-by-1 emailing</td>
              </tr>
              <tr>
                <td>Proxy & IP Management</td>
                <td className="highlight-col"><strong>100% Handled Internally</strong></td>
                <td>Requires expensive proxy plans</td>
                <td>Frequent IP rate limits</td>
              </tr>
              <tr>
                <td>Export Formats</td>
                <td className="highlight-col"><strong>Excel (.xlsx), CSV, and PDF in 1 Click</strong></td>
                <td>CSV only</td>
                <td>Manual copy-pasting</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* Transparent & Predictable Pricing Section (Full Viewport Fit) */}
      {/* ---------------------------------------------------- */}
      <section className="section-container" id="pricing">
        <div className="pricing-header-center">
          <span className="section-pill">TRANSPARENT PRICING</span>
          <p className="pricing-subtitle">Pay only for verified leads or scale with outreach packs</p>
          <h2 className="pricing-main-heading">Simple, Pay-As-You-Grow Pricing</h2>

          {/* Currency Switcher Toggle */}
          <div className="pricing-currency-toggle-wrapper">
            <span className={`currency-option-label ${currency === 'INR' ? 'active' : ''}`}>
              ₹ INR
            </span>
            <button 
              type="button"
              className="currency-pill-switch" 
              onClick={() => setCurrency(prev => prev === 'INR' ? 'USD' : 'INR')}
              title="Toggle currency between INR (₹) and USD ($)"
              aria-label="Toggle currency"
            >
              <span className={`currency-switch-slider ${currency === 'USD' ? 'slide-right' : ''}`}>
                {currency === 'INR' ? '₹' : '$'}
              </span>
            </button>
            <span className={`currency-option-label ${currency === 'USD' ? 'active' : ''}`}>
              $ USD
            </span>
          </div>
        </div>

        <div className="pricing-cards-grid">
          {PRICING_PLANS.map((plan) => (
            <div 
              key={plan.id} 
              className={`pricing-card interactive-hover-card ${plan.isPopular ? 'popular-card' : ''} ${plan.id === 'plus' ? 'plus-card' : ''}`}
            >
              <div className="pricing-card-top-row">
                <div className="plan-title-inline">
                  <span className="pricing-plan-icon">{plan.icon}</span>
                  <h3 className="pricing-plan-name">{plan.name}</h3>
                </div>
                {plan.badge && (
                  <span className={`pricing-card-badge-inline ${plan.isPopular ? 'popular' : plan.id === 'plus' ? 'plus' : 'subtle'}`}>
                    {plan.badge}
                  </span>
                )}
              </div>

              <div className="pricing-price-display">
                <div className="price-amount-group">
                  <span className="price-number">{currency === 'INR' ? plan.price.INR : plan.price.USD}</span>
                  <span className="price-period">{plan.period}</span>
                </div>
                <span className="pricing-plan-tagline-inline">• {plan.tagline}</span>
              </div>

              {/* Per-Lead Rates Breakdown */}
              <div className="pricing-rates-box">
                <div className="rates-box-title">
                  <span>ENGINE</span>
                  <span>PER LEAD</span>
                </div>
                <div className="rates-rows-group">
                  {plan.leadRates.map((r, rIdx) => (
                    <div key={rIdx} className="rates-row-item">
                      <span className="rates-engine-name">{r.engine}</span>
                      <strong className="rates-engine-price">
                        {currency === 'INR' ? r.inr : r.usd}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Included Features List */}
              <div className="pricing-features-wrap">
                <div className="features-wrap-title">
                  {plan.id === 'plus' || plan.id === 'pack' ? '🔥 Includes Outreach Suite:' : 'Features Included:'}
                </div>
                <ul className="pricing-features-checklist">
                  {plan.features.map((feat, fIdx) => {
                    const isObj = typeof feat === 'object';
                    const text = isObj ? feat.text : feat;
                    const isExcluded = isObj && feat.excluded;
                    const isHighlight = isObj && feat.highlight;
                    return (
                      <li key={fIdx} style={isExcluded ? { color: 'var(--text-muted)', opacity: 0.75 } : (isHighlight ? { fontWeight: 600 } : {})}>
                        {isExcluded ? (
                          <X size={13} className="check-icon red" style={{ color: '#ef4444' }} />
                        ) : (
                          <Check size={13} className={`check-icon ${plan.id === 'pack' ? 'gold' : plan.id === 'plus' ? 'green' : 'indigo'}`} />
                        )}
                        <span>{text}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <button 
                className={`pricing-action-btn ${plan.isPopular ? 'popular-btn' : plan.id === 'plus' ? 'plus-btn' : 'outline-btn'}`}
                onClick={() => handlePricingAction(plan)}
              >
                <span>{plan.cta}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Dynamic FAQ Accordion */}
      <section className="section-container" id="faq">
        <div className="section-header-center">
          <span className="section-pill">QUESTIONS & ANSWERS</span>
          <h2>Frequently Asked Questions</h2>
          <p>Everything you need to know about scrapers, deliverability, and accounts.</p>
        </div>

        <div className="faq-accordion-list">
          {FAQS.map((faq, idx) => (
            <div 
              key={idx} 
              className={`faq-accordion-item ${openFaqIndex === idx ? 'open' : ''}`}
              onClick={() => setOpenFaqIndex(openFaqIndex === idx ? -1 : idx)}
            >
              <div className="faq-question-row">
                <h4>{faq.q}</h4>
                <button className="faq-toggle-icon">
                  {openFaqIndex === idx ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              </div>
              {openFaqIndex === idx && (
                <div className="faq-answer-content animate-fade-in">
                  <p>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* High-Impact Final CTA */}
      <section className="final-cta-section">
        <div className="final-cta-card rotating-beam-box">
          <div className="cta-spark-badge">
            <Sparkles size={16} />
            <span>START EXTRACTING LEADS IN 60 SECONDS</span>
          </div>
          <h2>Stop Hunting Leads Manually.<br />Put Your Pipeline on Autopilot.</h2>
          <p>Join over 1,400+ B2B agencies and growth teams closing high-ticket deals with verified direct contacts.</p>
          
          <div className="final-cta-actions">
            <button 
              className="btn-primary-gradient big border-shimmer" 
              onClick={() => {
                const el = document.getElementById('pricing');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <Zap size={18} />
              <span>Start Growing</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* Footer (Elite Design Matching Screenshot) */}
      <footer className="landing-footer">
        {/* Ambient Subtle Glow Wave */}
        <div className="footer-ambient-wave"></div>

        <div className="footer-inner-v2">
          {/* Column 1: Brand & Mini Feature Cards */}
          <div className="footer-col-brand">
            <div className="brand-group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} title="Contaque - Find | Connect | Grow">
              <img 
                src="/contaque_logo.jpg" 
                alt="Contaque" 
                className="brand-logo-img" 
              />
            </div>

            <p className="footer-tagline-lead">Find. Enrich. Reach. Grow.</p>
            <p className="footer-brand-desc">
              Contaques helps you discover high-quality business leads from multiple sources and turn them into real opportunities.
            </p>

            <div className="footer-feature-badges">
              <div className="feature-badge-item" onClick={() => navigate(isAuthenticated ? '/generate' : '/signup')} title="Find Targeted Leads">
                <div className="feature-badge-icon">
                  <Search size={17} />
                </div>
                <span className="feature-badge-label">Find<br />Leads</span>
              </div>

              <div className="feature-badge-item" onClick={() => navigate(isAuthenticated ? '/database' : '/signup')} title="Enrich Lead Profiles">
                <div className="feature-badge-icon">
                  <Database size={17} />
                </div>
                <span className="feature-badge-label">Enrich<br />Data</span>
              </div>

              <div className="feature-badge-item" onClick={() => navigate(isAuthenticated ? '/campaigns' : '/signup')} title="Direct Multi-Channel Outreach">
                <div className="feature-badge-icon">
                  <Send size={17} />
                </div>
                <span className="feature-badge-label">Outreach<br />Easily</span>
              </div>

              <div className="feature-badge-item" onClick={() => navigate(isAuthenticated ? '/dashboard' : '/signup')} title="Accelerate Deal Velocity">
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
              <li><a href="#how-it-works">Features</a></li>
              <li><a href="#engines">Lead Engines</a></li>
              <li><a href="#comparison">Pricing</a></li>
              <li><a href="#how-it-works">How It Works</a></li>
              <li><a href="#engines">Use Cases</a></li>
              <li><a href="#engines">Changelog</a></li>
            </ul>
          </div>

          {/* Column 3: Company */}
          <div className="footer-col-links">
            <h4 className="footer-col-title">Company &amp; Legal</h4>
            <ul className="footer-links-list">
              <li><a href="#how-it-works">About Us</a></li>
              <li><a href="/contact" onClick={(e) => { e.preventDefault(); navigate('/contact'); }}>Contact</a></li>
              <li><a href="/terms" onClick={(e) => { e.preventDefault(); navigate('/terms'); }}>Terms &amp; Conditions</a></li>
              <li><a href="/privacy" onClick={(e) => { e.preventDefault(); navigate('/privacy'); }}>Privacy Policy</a></li>
              <li><a href="/refund-policy" onClick={(e) => { e.preventDefault(); navigate('/refund-policy'); }}>Payment &amp; Refund Policy</a></li>
            </ul>
          </div>

          {/* Column 4: Resources */}
          <div className="footer-col-links">
            <h4 className="footer-col-title">Resources</h4>
            <ul className="footer-links-list">
              <li><a href="#faq">Documentation</a></li>
              <li><a href="#faq">FAQs</a></li>
              <li><a href="#faq">Help Center</a></li>
              <li><span className="badge-link-subtle">API (Coming Soon)</span></li>
              <li><a href="#faq">Status</a></li>
              <li><a href="#engines">Roadmap</a></li>
            </ul>
          </div>

          {/* Subtle Vertical Divider */}
          <div className="footer-col-divider"></div>

          {/* Column 5: Stay Updated */}
          <div className="footer-col-newsletter">
            <h4 className="footer-col-title">Stay Updated</h4>
            <p className="newsletter-desc">
              Get the latest updates, tips and growth strategies straight to your inbox.
            </p>

            <form className="footer-subscribe-form" onSubmit={handleNewsletterSubmit}>
              <input 
                type="email" 
                placeholder="Enter your email address" 
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                required
              />
              <button type="submit" className="footer-subscribe-btn">
                {newsletterSubscribed ? 'Subscribed!' : 'Subscribe'}
              </button>
            </form>

            <span className="newsletter-note">No spam. Unsubscribe anytime.</span>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom-bar">
          <div className="footer-bottom-left">
            <span className="copyright-main">© 2026 klyrova inc. All rights reserved.</span>
            <span className="copyright-sub">Built for businesses that think ahead.</span>
          </div>

          <div className="footer-bottom-right">
            <div className="footer-social-icons">
              <a href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn" className="social-icon-btn">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>
              </a>
              <a href="https://twitter.com" target="_blank" rel="noreferrer" aria-label="Twitter X" className="social-icon-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube" className="social-icon-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </a>
              <a href="https://discord.com" target="_blank" rel="noreferrer" aria-label="Discord" className="social-icon-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
              </a>
            </div>

            <div className="handwritten-slogan-box">
              <span className="handwritten-slogan">Better Data. Bigger Opportunities.</span>
              <svg className="slogan-swoop-svg" width="130" height="12" viewBox="0 0 130 12" fill="none">
                <path d="M2 9C35 2 95 2 128 8" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
      </footer>



      {/* Real-Time Live Activity Notification Toast */}
      {showActivityToast && LIVE_ACTIVITIES[activityIndex] && (
        <div className="live-activity-toast" key={activityIndex}>
          <div className="live-activity-icon">
            <span>{LIVE_ACTIVITIES[activityIndex].icon}</span>
          </div>
          <div className="live-activity-content">
            <div className="live-activity-title">
              {LIVE_ACTIVITIES[activityIndex].name} • {LIVE_ACTIVITIES[activityIndex].location}
            </div>
            <div className="live-activity-action">
              {LIVE_ACTIVITIES[activityIndex].action}
            </div>
            <div className="live-activity-time">
              <span>{LIVE_ACTIVITIES[activityIndex].time}</span>
            </div>
          </div>
          <button 
            className="toast-close-btn"
            onClick={() => setShowActivityToast(false)}
            title="Dismiss notification"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Razorpay 5-Step Checkout Modal for Paid Plans */}
      <RazorpayCheckoutModal 
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        plan={selectedCheckoutPlan}
        currency={currency}
        onSuccess={handleCheckoutSuccess}
      />
    </div>
  );
}

export default LandingPage;
