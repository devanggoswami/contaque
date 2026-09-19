import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Lock, Mail, Eye, EyeOff, ShieldCheck, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Login.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const res = await login(email.trim(), password);
    setSubmitting(false);

    if (res.success) {
      navigate('/dashboard', { replace: true });
    } else {
      setError(res.error || 'Invalid credentials. Please check your email and password.');
    }
  };

  return (
    <div className="login-screen-container">
      <div className="login-visual-backdrop"></div>

      <div className="login-card-wrapper animate-slide-up">
        {/* Brand Header */}
        <div className="login-brand-header">
          <div className="login-brand-logo">
            <Sparkles size={24} />
          </div>
          <div className="login-brand-text">
            <h2>Contaques</h2>
            <span className="login-pro-tag">ENTERPRISE CLOUD</span>
          </div>
        </div>

        <div className="login-welcome-box">
          <h3>Welcome Back</h3>
          <p>Sign in to manage lead pipelines, scraping jobs, and live cold campaigns.</p>
        </div>

        {/* Google Sign In Button - Under Review Status */}
        <button 
          type="button" 
          className="login-google-bar-btn"
          onClick={() => setError('Google OAuth verification is currently pending. Please sign in using your account email and password below.')}
          title="Google OAuth currently under review"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
            <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/>
            <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 20.4 7.5 23 12 23z"/>
          </svg>
          <span className="google-btn-text">Continue with Google</span>
          <span className="google-review-pill">OAuth In Review</span>
        </button>

        {error && (
          <div className="login-error-alert" style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '16px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <div className="signup-divider-row" style={{ margin: '0 0 18px 0' }}>
          <div className="signup-divider-line"></div>
          <span className="signup-divider-text">or sign in with credentials</span>
          <div className="signup-divider-line"></div>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Administrator Email</label>
            <div className="login-input-box">
              <Mail size={18} className="input-leading-icon" />
              <input 
                type="email" 
                id="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <div className="label-row">
              <label htmlFor="password">Security Password</label>
            </div>
            <div className="login-input-box">
              <Lock size={18} className="input-leading-icon" />
              <input 
                type={showPassword ? "text" : "password"} 
                id="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button 
                type="button" 
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <div className="login-meta-features">
            <div className="meta-item">
              <CheckCircle2 size={14} className="check-icon" />
              <span>48-Hour Persistent Session Active</span>
            </div>
            <div className="meta-item">
              <ShieldCheck size={14} className="check-icon" />
              <span>Zero Backend Interruption Guarantee</span>
            </div>
          </div>

          <button 
            type="submit" 
            className="login-submit-btn"
            disabled={submitting}
          >
            {submitting ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#94a3b8' }}>
          <span>Don't have an account?</span>
          <span 
            style={{ color: '#818cf8', fontWeight: 700, cursor: 'pointer', marginLeft: '6px' }}
            onClick={() => navigate('/signup')}
          >
            Create an Account
          </span>
        </div>

        <div className="login-card-footer">
          <ShieldCheck size={14} />
          <span>Secured Login</span>
        </div>
      </div>
    </div>
  );
}

export default Login;
