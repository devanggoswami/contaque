import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Sparkles, ShieldCheck, AlertCircle, ArrowRight, CheckCircle2, 
  Gift, Zap 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GoogleAuthButton from '../components/GoogleAuthButton';
import './Signup.css';

const PLAN_LABELS = {
  plus: 'Value Plus (₹299 / $3)',
  pack: 'Value Pack (₹499 / $5)',
  free: 'Free Explorer (₹50 / $2 Welcome Bonus)'
};

export default function Signup() {
  const [searchParams] = useSearchParams();
  const requestedPlan = searchParams.get('plan') || 'free';
  const refCodeFromUrl = searchParams.get('ref') || '';

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { isAuthenticated, loginWithGoogle, logout } = useAuth();
  const navigate = useNavigate();

  // Capture referral code silently into session storage for referral reward attribution
  useEffect(() => {
    if (refCodeFromUrl) {
      sessionStorage.setItem('pending_referral_code', refCodeFromUrl.trim().toUpperCase());
    }
  }, [refCodeFromUrl]);

  const handleGoogleSuccess = async (credential) => {
    setError('');
    setSubmitting(true);
    if (isAuthenticated) {
      logout();
    }
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
    <div className="signup-screen-container">
      <div className="signup-visual-backdrop">
        <div className="signup-mesh-blob blob-one"></div>
        <div className="signup-mesh-blob blob-two"></div>
      </div>

      <div className="signup-center-wrapper" style={{ maxWidth: '440px' }}>
        {/* Brand Header */}
        <div className="signup-header-block" onClick={() => navigate('/landing')} style={{ cursor: 'pointer', textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', overflow: 'hidden' }}>
              <img src="/contaque_logo.jpg" alt="Contaque" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.5px', lineHeight: 1.1 }}>Contaque</div>
              <span style={{ fontSize: '9px', fontWeight: 800, color: '#818CF8', letterSpacing: '0.8px' }}>ENTERPRISE CLOUD</span>
            </div>
          </div>
        </div>

        <div className="signup-form-card" style={{ padding: '32px 28px' }}>
          {/* Plan badge if chosen */}
          {requestedPlan && requestedPlan !== 'free' && (
            <div style={{
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '8px',
              padding: '8px 12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12.5px',
              color: '#C7D2FE',
              fontWeight: 600
            }}>
              <Zap size={15} style={{ color: '#818CF8', flexShrink: 0 }} />
              <span>Selected Plan: <strong>{PLAN_LABELS[requestedPlan] || requestedPlan}</strong></span>
            </div>
          )}

          {/* Referral badge if active */}
          {refCodeFromUrl && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              padding: '8px 12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12.5px',
              color: '#A7F3D0',
              fontWeight: 600
            }}>
              <Gift size={15} style={{ color: '#34D399', flexShrink: 0 }} />
              <span>Referral Invite Applied — Claim extra credits on sign up!</span>
            </div>
          )}

          <div style={{ marginBottom: '22px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
              Get Started with Contaque
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
              Instant 1-click registration with your Google account. No passwords or email verification required.
            </p>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#F87171',
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

          {/* Feature Highlights */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '14px 16px',
            marginBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#E2E8F0' }}>
              <CheckCircle2 size={15} style={{ color: '#10B981', flexShrink: 0 }} />
              <span>Instant ₹50 / $2 Free Welcome Credits in wallet</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#E2E8F0' }}>
              <CheckCircle2 size={15} style={{ color: '#10B981', flexShrink: 0 }} />
              <span>Access to 120M+ verified global B2B leads</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#E2E8F0' }}>
              <ShieldCheck size={15} style={{ color: '#818CF8', flexShrink: 0 }} />
              <span>Single Sign-On verified by Google OAuth 2.0</span>
            </div>
          </div>

          <p style={{ fontSize: '11.5px', color: '#64748B', textAlign: 'center', margin: '0 0 16px 0', lineHeight: 1.5 }}>
            By creating an account with Google, you agree to our{' '}
            <span 
              onClick={() => navigate('/terms')}
              style={{ color: '#818CF8', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Terms &amp; Conditions
            </span>{' '}
            and{' '}
            <span 
              onClick={() => navigate('/privacy')}
              style={{ color: '#818CF8', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Privacy Policy
            </span>.
          </p>

          <div style={{ textAlign: 'center', fontSize: '12.5px', color: '#94A3B8' }}>
            <span>Already have an account?</span>
            <span 
              style={{ color: '#818CF8', fontWeight: 700, cursor: 'pointer', marginLeft: '6px' }}
              onClick={() => navigate('/login')}
            >
              Sign In
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
