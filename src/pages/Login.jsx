import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, ShieldCheck, AlertCircle, ArrowRight, CheckCircle2, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GoogleAuthButton from '../components/GoogleAuthButton';
import './Login.css';

function Login() {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchParams] = useSearchParams();

  const { user, isAuthenticated, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  // Capture referral code into session storage if present in URL
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      sessionStorage.setItem('pending_referral_code', refCode.trim().toUpperCase());
    }
  }, [searchParams]);

  const handleGoogleSuccess = async (credential) => {
    setError('');
    setSubmitting(true);
    const requestedPlan = searchParams.get('plan') || 'free';
    const res = await loginWithGoogle(credential, requestedPlan);
    setSubmitting(false);

    if (res.success) {
      if (requestedPlan && requestedPlan !== 'free') {
        navigate(`/dashboard?upgrade=${requestedPlan}`, { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } else {
      setError(res.error || 'Google authentication failed. Please try again.');
    }
  };

  return (
    <div className="login-screen-container">
      <div className="login-visual-backdrop"></div>

      <div className="login-card-wrapper animate-slide-up" style={{ maxWidth: '440px', padding: '32px 28px' }}>
        {/* Brand Header */}
        <div className="login-brand-header" onClick={() => navigate('/landing')} style={{ cursor: 'pointer', marginBottom: '20px' }}>
          <div className="login-brand-logo" style={{ overflow: 'hidden', padding: 0 }}>
            <img src="/contaque_logo.jpg" alt="Contaque" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div className="login-brand-text">
            <h2>Contaque</h2>
            <span className="login-pro-tag">ENTERPRISE CLOUD</span>
          </div>
        </div>

        {/* Active Session Notice if user is already signed in */}
        {isAuthenticated && user && (
          <div style={{
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            fontSize: '12.5px',
            color: '#cbd5e1'
          }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Currently signed in: <strong style={{ color: '#818cf8' }}>{user.email}</strong>
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              style={{
                background: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                color: '#e0e7ff',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              Dashboard →
            </button>
          </div>
        )}

        <div className="login-welcome-box" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px' }}>Sign in to Contaque</h3>
          <p style={{ fontSize: '13px', lineHeight: 1.5, color: '#64748B' }}>
            Instant, secure access to your lead pipelines, scraping jobs, and live outreach campaigns.
          </p>
        </div>

        {error && (
          <div className="login-error-alert" style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '18px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Primary & Exclusive Authentication Method: Continue with Google */}
        <div style={{ marginBottom: '22px' }}>
          <GoogleAuthButton 
            onSuccess={handleGoogleSuccess} 
            onError={setError} 
            disabled={submitting}
          />
        </div>

        {/* Benefits & Trust Highlights */}
        <div style={{
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '10px',
          padding: '14px 16px',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155' }}>
            <CheckCircle2 size={15} style={{ color: '#10B981', flexShrink: 0 }} />
            <span>Instant access with <strong>₹50 / $2 Welcome Credits</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155' }}>
            <CheckCircle2 size={15} style={{ color: '#10B981', flexShrink: 0 }} />
            <span><strong>48-Hour</strong> secure persistent session active</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155' }}>
            <ShieldCheck size={15} style={{ color: '#2563EB', flexShrink: 0 }} />
            <span>Enterprise Google OAuth 2.0 verification</span>
          </div>
        </div>

        <p className="auth-consent-text" style={{ fontSize: '11.5px', color: '#94A3B8', textAlign: 'center', margin: '0 0 16px 0', lineHeight: 1.5 }}>
          By continuing with Google, you agree to our{' '}
          <span 
            className="auth-consent-link" 
            onClick={() => navigate('/terms')}
            style={{ color: '#2563EB', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Terms &amp; Conditions
          </span>{' '}
          and{' '}
          <span 
            className="auth-consent-link" 
            onClick={() => navigate('/privacy')}
            style={{ color: '#2563EB', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Privacy Policy
          </span>.
        </p>

        <div className="login-card-footer" style={{ borderTop: '1px solid #E2E8F0', paddingTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11px', color: '#94A3B8' }}>
          <ShieldCheck size={13} style={{ color: '#10B981' }} />
          <span>Secured by Google Identity Services</span>
        </div>
      </div>
    </div>
  );
}

export default Login;
