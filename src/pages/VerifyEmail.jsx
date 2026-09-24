import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, Mail, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Signup.css';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const urlStatus = searchParams.get('status');
  const urlError = searchParams.get('error');

  const { user, token: authToken, isAuthenticated, verifyEmailWithToken, logout } = useAuth();
  const navigate = useNavigate();

  const [verifying, setVerifying] = useState(Boolean(token && !urlStatus && !urlError));
  const [success, setSuccess] = useState(urlStatus === 'success');
  const [verifiedUser, setVerifiedUser] = useState(null);
  const [errorMessage, setErrorMessage] = useState(
    urlError === 'expired'
      ? 'This email verification link has expired. Please log in and request a new verification email.'
      : urlError === 'invalid_or_used'
      ? 'This email verification link is invalid or has already been used.'
      : urlError === 'missing_token'
      ? 'Verification token is missing from the link.'
      : ''
  );

  useEffect(() => {
    if (token && !urlStatus && !urlError) {
      let isMounted = true;
      (async () => {
        setVerifying(true);
        const res = await verifyEmailWithToken(token);
        if (!isMounted) return;
        setVerifying(false);
        if (res.success) {
          setSuccess(true);
          setVerifiedUser(res.user);
        } else {
          setErrorMessage(res.error || 'Failed to verify email. The link may have expired or is invalid.');
        }
      })();
      return () => { isMounted = false; };
    }
  }, [token, urlStatus, urlError, verifyEmailWithToken]);

  return (
    <div className="signup-screen-container">
      <div className="signup-visual-backdrop">
        <div className="signup-mesh-blob blob-one"></div>
        <div className="signup-mesh-blob blob-two"></div>
      </div>

      <div className="signup-center-wrapper" style={{ maxWidth: '520px' }}>
        {/* Header Logo */}
        <div className="signup-header-block" style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Link to="/" className="brand-logo-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.5px' }}>
              Conta<span style={{ color: '#6366f1' }}>Que</span>
            </span>
          </Link>
        </div>

        <div className="signup-form-card" style={{ padding: '36px 32px', textAlign: 'center' }}>
          {verifying ? (
            <div style={{ padding: '24px 0' }}>
              <Loader2 size={44} className="animate-spin" style={{ color: '#6366f1', margin: '0 auto 18px auto' }} />
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                Verifying your email...
              </h2>
              <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>
                Please wait while we validate your secure token with the server.
              </p>
            </div>
          ) : success ? (
            <div style={{ padding: '16px 0' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
                <CheckCircle2 size={32} style={{ color: '#10b981' }} />
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff', marginBottom: '10px' }}>
                Email Confirmed!
              </h2>
              <p style={{ color: '#9ca3af', fontSize: '14px', lineHeight: 1.6, marginBottom: '28px' }}>
                Your email address has been verified successfully. Your account is fully active and ready to extract verified B2B leads.
              </p>
              <button
                type="button"
                className="signup-submit-btn"
                onClick={() => {
                  if (verifiedUser && authToken) {
                    navigate('/dashboard', { replace: true });
                  } else {
                    logout();
                    navigate('/login', { replace: true });
                  }
                }}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <span>{verifiedUser && authToken ? 'Go to Dashboard' : 'Sign in to ContaQue'}</span>
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div style={{ padding: '16px 0' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
                <AlertCircle size={32} style={{ color: '#ef4444' }} />
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff', marginBottom: '10px' }}>
                Verification Failed
              </h2>
              <p style={{ color: '#f87171', fontSize: '14px', lineHeight: 1.6, marginBottom: '28px' }}>
                {errorMessage || 'The verification link is invalid or has expired.'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  type="button"
                  className="signup-submit-btn"
                  onClick={() => {
                    logout();
                    navigate('/login', { replace: true });
                  }}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <span>Go to Sign In</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
