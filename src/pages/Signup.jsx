import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, AlertCircle, Gift, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GoogleAuthButton from '../components/GoogleAuthButton';
import './Login.css';

const PLAN_LABELS = {
  plus: 'Value Plus (₹299 / $3)',
  pack: 'Value Pack (₹499 / $5)',
  free: 'Free Explorer'
};

export default function Signup() {
  const [searchParams] = useSearchParams();
  const requestedPlan = searchParams.get('plan') || 'free';
  const refCodeFromUrl = searchParams.get('ref') || '';

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { isAuthenticated, loading, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  // If already authenticated, redirect deterministically to dashboard
  useEffect(() => {
    if (isAuthenticated && !loading) {
      if (requestedPlan && requestedPlan !== 'free') {
        navigate(`/dashboard?upgrade=${requestedPlan}`, { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, loading, navigate, requestedPlan]);

  // Capture referral code silently into session storage for referral reward attribution
  useEffect(() => {
    if (refCodeFromUrl) {
      sessionStorage.setItem('pending_referral_code', refCodeFromUrl.trim().toUpperCase());
    }
  }, [refCodeFromUrl]);

  const handleGoogleSuccess = async (credential) => {
    setError('');
    setSubmitting(true);
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

        {/* Plan badge if chosen */}
        {requestedPlan && requestedPlan !== 'free' && (
          <div style={{
            background: '#EEF2FF',
            border: '1px solid #C7D2FE',
            borderRadius: '8px',
            padding: '8px 12px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12.5px',
            color: '#3730A3',
            fontWeight: 600
          }}>
            <Zap size={15} style={{ color: '#4F46E5', flexShrink: 0 }} />
            <span>Selected Plan: <strong>{PLAN_LABELS[requestedPlan] || requestedPlan}</strong></span>
          </div>
        )}

        {/* Referral badge if active */}
        {refCodeFromUrl && (
          <div style={{
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: '8px',
            padding: '8px 12px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12.5px',
            color: '#065F46',
            fontWeight: 600
          }}>
            <Gift size={15} style={{ color: '#059669', flexShrink: 0 }} />
            <span>Referral Invite Applied — Extra credits on signup!</span>
          </div>
        )}

        <div className="login-welcome-box" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#172033', marginBottom: '6px' }}>
            Get Started with Contaque
          </h3>
          <p style={{ fontSize: '13px', lineHeight: 1.5, color: '#64748B', margin: 0 }}>
            Instant 1-click registration with your Google account. No passwords or email verification required.
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

        {/* Google Sign-in as the exclusive onboarding method */}
        <div style={{ marginBottom: '22px' }}>
          <GoogleAuthButton 
            isSignup={true}
            onSuccess={handleGoogleSuccess} 
            onError={setError} 
            disabled={submitting}
          />
        </div>

        <p className="auth-consent-text" style={{ fontSize: '11.5px', color: '#94A3B8', textAlign: 'center', margin: '0 0 16px 0', lineHeight: 1.5 }}>
          By creating an account with Google, you agree to our{' '}
          <span 
            onClick={() => navigate('/terms')}
            style={{ color: '#2563EB', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Terms &amp; Conditions
          </span>{' '}
          and{' '}
          <span 
            onClick={() => navigate('/privacy')}
            style={{ color: '#2563EB', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Privacy Policy
          </span>.
        </p>

        <div style={{ textAlign: 'center', fontSize: '12.5px', color: '#64748B', marginBottom: '16px' }}>
          <span>Already have an account?</span>
          <span 
            style={{ color: '#2563EB', fontWeight: 700, cursor: 'pointer', marginLeft: '6px' }}
            onClick={() => navigate('/login')}
          >
            Sign In
          </span>
        </div>

        <div className="login-card-footer" style={{ borderTop: '1px solid #E2E8F0', paddingTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11px', color: '#94A3B8' }}>
          <ShieldCheck size={13} style={{ color: '#10B981' }} />
          <span>Secured by Google Identity Services</span>
        </div>
      </div>
    </div>
  );
}
