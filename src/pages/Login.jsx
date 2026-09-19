import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Lock, Mail, Eye, EyeOff, ShieldCheck, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GoogleAuthButton from '../components/GoogleAuthButton';
import './Login.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credential) => {
    setError('');
    setSubmitting(true);
    const res = await loginWithGoogle(credential);
    setSubmitting(false);
    if (res.success) {
      navigate('/dashboard', { replace: true });
    } else {
      setError(res.error || 'Google authentication failed. Please try again.');
    }
  };

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

        {/* Official Google Identity Services Sign In Button */}
        <GoogleAuthButton 
          onSuccess={handleGoogleSuccess} 
          onError={setError} 
        />

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
