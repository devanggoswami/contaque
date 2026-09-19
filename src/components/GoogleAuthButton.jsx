import React, { useEffect, useRef, useState } from 'react';
import { GOOGLE_CLIENT_ID } from '../config';

export default function GoogleAuthButton({
  isSignup = false,
  onSuccess,
  onError,
  disabled = false
}) {
  const buttonContainerRef = useRef(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let intervalId = null;

    // Check if Google GSI library is loaded
    const checkGoogleLoaded = () => {
      if (window.google?.accounts?.id) {
        setScriptLoaded(true);
        setInitializing(false);
        if (intervalId) clearInterval(intervalId);
        return true;
      }
      return false;
    };

    if (!checkGoogleLoaded()) {
      intervalId = setInterval(() => {
        if (checkGoogleLoaded()) {
          clearInterval(intervalId);
        }
      }, 200);

      // Timeout after 5 seconds
      const timeoutId = setTimeout(() => {
        if (intervalId) clearInterval(intervalId);
        setInitializing(false);
      }, 5000);

      return () => {
        if (intervalId) clearInterval(intervalId);
        clearTimeout(timeoutId);
      };
    }
  }, []);

  useEffect(() => {
    if (!scriptLoaded || !buttonContainerRef.current || !GOOGLE_CLIENT_ID) {
      return;
    }

    try {
      // 1. Initialize Google Identity Services
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          if (response?.credential) {
            if (onSuccess) onSuccess(response.credential);
          } else {
            if (onError) onError('Google did not return an authentication credential.');
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true
      });

      // 2. Render Google Button
      buttonContainerRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(buttonContainerRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: isSignup ? 'signup_with' : 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: buttonContainerRef.current.offsetWidth || 340
      });
    } catch (err) {
      console.error('[GoogleAuthButton Init Error]:', err);
      if (onError) onError('Failed to initialize Google Sign-In.');
    }
  }, [scriptLoaded, isSignup, onSuccess, onError]);

  // Fallback interactive click if user clicks container before full render
  const handleManualClick = () => {
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed()) {
            console.warn('Google One Tap not displayed:', notification.getNotDisplayedReason());
          }
        });
      } catch (err) {
        console.error('Manual prompt error:', err);
      }
    } else {
      if (onError) onError('Google Sign-In is loading. Please check your internet connection or ad-blocker.');
    }
  };

  return (
    <div 
      className="google-auth-button-wrapper"
      style={{
        width: '100%',
        minHeight: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px'
      }}
    >
      <div 
        ref={buttonContainerRef} 
        id={isSignup ? 'google-signup-btn-container' : 'google-login-btn-container'}
        style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
      >
        {/* Placeholder while GSI iframe renders */}
        {initializing && (
          <button 
            type="button" 
            className="login-google-bar-btn"
            style={{ width: '100%', opacity: 0.8, cursor: 'wait' }}
            disabled
          >
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
              <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/>
              <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 20.4 7.5 23 12 23z"/>
            </svg>
            <span className="google-btn-text">Connecting to Google...</span>
          </button>
        )}

        {!initializing && !scriptLoaded && (
          <button 
            type="button" 
            className="login-google-bar-btn"
            onClick={handleManualClick}
            style={{ width: '100%', cursor: 'pointer' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
              <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/>
              <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 20.4 7.5 23 12 23z"/>
            </svg>
            <span className="google-btn-text">{isSignup ? 'Sign up with Google' : 'Sign in with Google'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
