import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, MapPin, Tag, Globe, Hash, Sparkles, Zap, 
  CheckCircle2, Clock, ArrowRight, ShieldCheck, RefreshCw, 
  ExternalLink, Layers, Terminal, Compass, Building2, Flame,
  AlertTriangle, MessageCircle, X
} from 'lucide-react';
import { API_URL } from '../config';
import './GenerateData.css';

const PRESET_QUERIES = [
  { keyword: 'Real Estate Brokers', location: 'Dubai', source: 'whatsapp', count: 30 },
  { keyword: 'Software Companies', location: 'Bangalore', source: 'dorking', platform: 'linkedin.com', count: 50 },
  { keyword: 'Dental Clinics', location: 'New York', source: 'maps', count: 30 },
  { keyword: 'Digital Marketing Agencies', location: 'London', source: 'dorking', platform: 'linkedin.com', count: 40 },
  { keyword: 'Architects & Interior Designers', location: 'Mumbai', source: 'maps', count: 40 },
  { keyword: 'Auto Repair & Garage', location: 'Toronto', source: 'yellowpages', count: 30 }
];

const PLATFORM_PRESETS = [
  { id: 'linkedin.com', label: 'LinkedIn', icon: '💼' },
  { id: 'instagram.com', label: 'Instagram', icon: '📸' },
  { id: 'facebook.com', label: 'Facebook', icon: '👥' },
  { id: 'twitter.com', label: 'Twitter / X', icon: '🐦' },
  { id: 'youtube.com', label: 'YouTube', icon: '▶️' },
  { id: 'tiktok.com', label: 'TikTok', icon: '🎵' },
  { id: 'pinterest.com', label: 'Pinterest', icon: '📌' },
  { id: 'crunchbase.com', label: 'Crunchbase', icon: '🚀' },
  { id: 'github.com', label: 'GitHub', icon: '💻' },
  { id: 'custom', label: 'Custom URL / Domain', icon: '🌐' }
];

function GenerateData() {
  const navigate = useNavigate();
  const [source, setSource] = useState('maps');
  const [location, setLocation] = useState('');
  const [keyword, setKeyword] = useState('');
  const [targetCount, setTargetCount] = useState(40);
  const [platform, setPlatform] = useState('linkedin.com');
  const [customDomain, setCustomDomain] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [billing, setBilling] = useState(null);
  
  // Non-intrusive toast notification and button feedback
  const [successToast, setSuccessToast] = useState(null);
  const [justDispatched, setJustDispatched] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/billing`)
      .then(res => res.json())
      .then(data => setBilling(data))
      .catch(err => console.error("Billing fetch error:", err));
  }, []);

  // Auto-dismiss toast after 6 seconds
  useEffect(() => {
    if (!successToast) return;
    const timer = setTimeout(() => {
      setSuccessToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [successToast]);

  // Dynamic Region Intelligence Auto-Detector
  const detectRegionInfo = (loc) => {
    if (!loc) return null;
    const l = loc.toLowerCase().trim();
    if (l.includes('russia') || l.includes('moscow') || l.includes('petersburg') || l.includes('казань') || l.includes('москва') || l.includes('россия') || l.includes('kazan') || l.includes('novosibirsk')) {
      return {
        country: 'Russia',
        flag: '🇷🇺',
        code: '+7',
        recommendedSource: 'yandex',
        sourceLabel: 'Yandex + MAX Messenger',
        tip: 'Yandex indexed data includes direct MAX Messenger (+7) 1-click chat integration!'
      };
    }
    if (l.includes('dubai') || l.includes('uae') || l.includes('abu dhabi') || l.includes('sharjah') || l.includes('emirates')) {
      return {
        country: 'United Arab Emirates',
        flag: '🇦🇪',
        code: '+971',
        recommendedSource: 'whatsapp',
        sourceLabel: 'WhatsApp Radar',
        tip: 'WhatsApp Radar yields 100% verified mobile numbers across UAE businesses!'
      };
    }
    if (l.includes('india') || l.includes('mumbai') || l.includes('delhi') || l.includes('bangalore') || l.includes('pune') || l.includes('hyderabad') || l.includes('chennai') || l.includes('kolkata')) {
      return {
        country: 'India',
        flag: '🇮🇳',
        code: '+91',
        recommendedSource: 'maps',
        sourceLabel: 'Google Business Data',
        tip: 'Google Maps directory provides richest business listings & direct phone numbers.'
      };
    }
    if (l.includes('usa') || l.includes('united states') || l.includes('york') || l.includes('california') || l.includes('texas') || l.includes('chicago') || l.includes('miami') || l.includes('florida')) {
      return {
        country: 'United States',
        flag: '🇺🇸',
        code: '+1',
        recommendedSource: 'dorking',
        sourceLabel: 'Business Index (LinkedIn)',
        tip: 'B2B executive emails and corporate phone records verified via LinkedIn platform.'
      };
    }
    return null;
  };

  const detectedRegion = detectRegionInfo(location);

  const applyPreset = (preset) => {
    setKeyword(preset.keyword);
    setLocation(preset.location);
    setSource(preset.source);
    setTargetCount(preset.count);
    if (preset.platform) {
      setPlatform(preset.platform);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!keyword.trim() || !location.trim()) {
      setError("Please provide both a business keyword and target location.");
      return;
    }

    let targetPlatform = platform;
    if (source === 'dorking') {
      if (platform === 'custom') {
        if (!customDomain.trim()) {
          setError("Please enter your custom domain (e.g. clutch.co, medium.com).");
          return;
        }
        targetPlatform = customDomain.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
      }
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source,
          location: location.trim(),
          keyword: keyword.trim(),
          targetCount: parseInt(targetCount, 10) || 30,
          platform: source === 'dorking' ? targetPlatform : undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to launch scraping process");
      }

      setLoading(false);
      setJustDispatched(true);
      setTimeout(() => setJustDispatched(false), 3000);

      setSuccessToast({
        jobId: data.jobId,
        keyword: keyword.trim(),
        location: location.trim(),
        count: parseInt(targetCount, 10) || 30
      });
    } catch (err) {
      setError(err.message || "Failed to connect to backend server.");
      setLoading(false);
    }
  };

  const getSourceDisplayName = (src) => {
    switch (src) {
      case 'maps': return 'Google Business Data';
      case 'dorking': return 'Business Index';
      case 'yellowpages': return 'Yellow Pages';
      case 'yandex': return 'Yandex';
      case 'whatsapp': return 'WhatsApp Radar';
      default: return src;
    }
  };

  // Dynamic Query Estimator
  const getSimulatedQuery = () => {
    const kw = keyword || 'Business';
    const loc = location || 'Location';
    const effectivePlatform = platform === 'custom' 
      ? (customDomain.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '') || 'customdomain.com')
      : platform;
    if (source === 'dorking') return `site:${effectivePlatform} ${kw} ${loc} email OR phone`;
    if (source === 'yellowpages') return `site:yellowpages.com ${kw} ${loc}`;
    if (source === 'yandex') return `${kw} ${loc}`;
    if (source === 'whatsapp') return `site:wa.me "${kw}" "${loc}" OR "api.whatsapp.com/send"`;
    return `textQuery: "${kw} in ${loc}" (Google Places API)`;
  };

  return (
    <div className="page-content generate-page animate-slide-up">
      <div className="generate-layout">
        {/* Left Form Card */}
        <div className="generate-card">
          <div className="generate-header">
            <div className="header-icon-glow">
              <Sparkles size={22} />
            </div>
            <div>
              <h1>Generate Leads</h1>
              <p>Deploy intelligent localized scrapers across multiple verified web engines</p>
            </div>
          </div>

          {/* Quick Presets Carousel / Chips */}
          <div className="presets-section">
            <div className="presets-label">
              <Flame size={14} />
              <span>POPULAR SEARCH PRESETS</span>
            </div>
            <div className="presets-chips">
              {PRESET_QUERIES.map((preset, index) => (
                <button
                  key={index}
                  type="button"
                  className="preset-chip"
                  onClick={() => applyPreset(preset)}
                >
                  <span className="preset-kw">{preset.keyword}</span>
                  <span className="preset-loc">in {preset.location}</span>
                </button>
              ))}
            </div>
          </div>
          
          <form className="search-form" onSubmit={handleSearch}>
            {/* Source Selection Cards Grid */}
            <div className="form-group">
              <label className="group-title">Select Data Engine</label>
              <div className="source-cards-grid">
                <div 
                  className={`source-card ${source === 'maps' ? 'active' : ''}`}
                  onClick={() => setSource('maps')}
                >
                  <div className="source-icon maps">
                    <MapPin size={20} />
                  </div>
                  <div className="source-details">
                    <h4>Google Business Data</h4>
                  </div>
                </div>

                <div 
                  className={`source-card ${source === 'dorking' ? 'active' : ''}`}
                  onClick={() => setSource('dorking')}
                >
                  <div className="source-icon dorking">
                    <Globe size={20} />
                  </div>
                  <div className="source-details">
                    <h4>Business Index</h4>
                  </div>
                </div>

                <div 
                  className={`source-card ${source === 'yellowpages' ? 'active' : ''}`}
                  onClick={() => setSource('yellowpages')}
                >
                  <div className="source-icon yellowpages">
                    <Search size={20} />
                  </div>
                  <div className="source-details">
                    <h4>Yellow Pages</h4>
                  </div>
                </div>

                <div 
                  className={`source-card ${source === 'yandex' ? 'active' : ''}`}
                  onClick={() => setSource('yandex')}
                >
                  <div className="source-icon yandex">
                    <Globe size={20} />
                  </div>
                  <div className="source-details">
                    <h4>Yandex</h4>
                  </div>
                </div>

                <div 
                  className={`source-card whatsapp-card ${source === 'whatsapp' ? 'active' : ''}`}
                  onClick={() => setSource('whatsapp')}
                >
                  <div className="source-icon whatsapp">
                    <MessageCircle size={20} />
                  </div>
                  <div className="source-details">
                    <h4>WhatsApp Radar</h4>
                    <span className="source-tag-wa">100% Numbers</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Platform Selector when Business Index is active */}
            {source === 'dorking' && (
              <div className="form-group animate-slide-up">
                <label className="group-title">Target Social / Web Platform</label>
                <div className="platform-presets-grid">
                  {PLATFORM_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`platform-btn ${platform === p.id ? 'active' : ''}`}
                      onClick={() => setPlatform(p.id)}
                    >
                      <span>{p.icon}</span>
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>

                {platform === 'custom' && (
                  <div className="custom-url-box animate-slide-up">
                    <label htmlFor="customDomain">Enter Custom Website / Domain URL</label>
                    <div className="input-wrapper">
                      <Globe className="input-icon" size={18} />
                      <input 
                        type="text" 
                        id="customDomain" 
                        className="form-control" 
                        placeholder="e.g. clutch.co, medium.com, behance.net, dribbble.com" 
                        value={customDomain}
                        onChange={(e) => setCustomDomain(e.target.value)}
                        required={source === 'dorking' && platform === 'custom'}
                        autoFocus
                      />
                    </div>
                    <div className="custom-url-warning-badge">
                      <div className="warning-blink-icon">
                        <AlertTriangle size={16} />
                      </div>
                      <div className="warning-text-content">
                        <strong>Notice:</strong> If the target website actively blocks automated data mining (e.g. Cloudflare / Bot Protection / WAF), lead extraction may be limited or fallback search indexing will be utilized.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="form-row">
              <div className="form-group flex-1">
                <label htmlFor="keyword">Industry / Business Type</label>
                <div className="input-wrapper">
                  <Tag className="input-icon" size={18} />
                  <input 
                    type="text" 
                    id="keyword" 
                    className="form-control" 
                    placeholder="e.g. Real Estate, Doctors, IT Companies" 
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group flex-1">
                <label htmlFor="location">Target City / Country</label>
                <div className="input-wrapper">
                  <MapPin className="input-icon" size={18} />
                  <input 
                    type="text" 
                    id="location" 
                    className="form-control" 
                    placeholder="e.g. Dubai, New York, Moscow, Mumbai" 
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    required
                  />
                </div>
                {detectedRegion && (
                  <div className="dynamic-region-pill-box animate-slide-up">
                    <div className="region-meta">
                      <span className="region-flag">{detectedRegion.flag}</span>
                      <div className="region-text-group">
                        <span className="region-name">{detectedRegion.country} ({detectedRegion.code})</span>
                        <span className="region-tip">{detectedRegion.tip}</span>
                      </div>
                    </div>
                    {source !== detectedRegion.recommendedSource && (
                      <button 
                        type="button" 
                        className="region-switch-action-btn"
                        onClick={() => setSource(detectedRegion.recommendedSource)}
                      >
                        <Zap size={12} />
                        <span>Switch to {detectedRegion.sourceLabel}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label htmlFor="targetCount">Target Lead Count ({targetCount})</label>
                <div className="range-selector-box">
                  <div className="input-wrapper">
                    <Hash className="input-icon" size={18} />
                    <input 
                      type="number" 
                      id="targetCount" 
                      className="form-control count-input" 
                      min="10" 
                      max="60" 
                      step="10"
                      value={targetCount}
                      onChange={(e) => setTargetCount(e.target.value)}
                      required
                    />
                  </div>
                  <input 
                    type="range"
                    min="10"
                    max="60"
                    step="10"
                    value={targetCount}
                    onChange={(e) => setTargetCount(e.target.value)}
                    className="dynamic-range-slider"
                  />
                </div>

                <div className="slider-dynamic-telemetry-grid animate-fade-in">
                  <div className="telemetry-pill">
                    <Clock size={12} />
                    <span>Est. Runtime: ~{Math.round(targetCount * 0.7)}s</span>
                  </div>
                  <div className="telemetry-pill">
                    <ShieldCheck size={12} />
                    <span>Verified: 96-99%</span>
                  </div>
                  <div className="telemetry-pill">
                    <Zap size={12} />
                    <span>Threads: {targetCount > 35 ? '8 Workers' : '4 Workers'}</span>
                  </div>
                  <div className="telemetry-pill highlight">
                    <Sparkles size={12} />
                    <span>Expected Yield: ~{Math.round(targetCount * 0.95)} Leads</span>
                  </div>
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              className={`submit-button ${justDispatched ? 'dispatched' : ''}`} 
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw size={18} className="spin-icon" />
                  <span>Launching Worker Threads...</span>
                </>
              ) : justDispatched ? (
                <>
                  <CheckCircle2 size={18} />
                  <span>Engine Dispatched Successfully!</span>
                </>
              ) : (
                <>
                  <Zap size={18} />
                  <span>Execute Scrape Engine</span>
                </>
              )}
            </button>
          </form>

          {error && (
            <div className="error-message-card animate-slide-up">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Floating Scrape Notification Toast (Non-intrusive, does not alter page layout) */}
      {successToast && (
        <div className="scrape-toast-notification animate-slide-up">
          <div className="toast-icon-wrapper">
            <CheckCircle2 size={20} />
          </div>
          <div className="toast-body">
            <div className="toast-title">Scraper Dispatched (Job #{successToast.jobId})</div>
            <div className="toast-subtitle">
              Harvesting {successToast.count} leads for "{successToast.keyword}" in "{successToast.location}".
            </div>
          </div>
          <div className="toast-actions">
            <button 
              type="button" 
              className="toast-open-db-btn"
              onClick={() => navigate('/database')}
            >
              <span>View Database</span>
              <ArrowRight size={13} />
            </button>
            <button 
              type="button" 
              className="toast-dismiss-btn"
              onClick={() => setSuccessToast(null)}
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GenerateData;
