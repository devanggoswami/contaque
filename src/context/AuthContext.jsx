import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_URL } from '../config';

const AuthContext = createContext(null);

const STORAGE_KEY = 'lead_os_auth_session';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize session from localStorage & provide sliding activity renewal
  useEffect(() => {
    const initSession = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const session = JSON.parse(saved);
          // Check if session is valid
          if (session.expiresAt && Date.now() < session.expiresAt) {
            setUser(session.user);
            setToken(session.token);

            // Sliding Window: If active and more than 12h elapsed, automatically extend 48 hours
            const timeRemaining = session.expiresAt - Date.now();
            if (timeRemaining < 36 * 60 * 60 * 1000) {
              const updatedSession = {
                ...session,
                expiresAt: Date.now() + 48 * 60 * 60 * 1000
              };
              localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSession));
            }
          } else {
            // Expired, clear storage
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (err) {
        console.error('Session load error:', err);
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, []);

  const login = async (email, password) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }

      // Calculate 48-hour expiration timestamp
      const expiresAt = Date.now() + 48 * 60 * 60 * 1000;
      const sessionData = {
        token: data.token,
        user: data.user,
        expiresAt
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
      setUser(data.user);
      setToken(data.token);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const signup = async ({ name, email, password, country, plan = 'free' }) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, country, plan, auth_provider: 'local' })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      const expiresAt = Date.now() + 48 * 60 * 60 * 1000;
      const sessionData = {
        token: data.token,
        user: data.user,
        expiresAt
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
      setUser(data.user);
      setToken(data.token);
      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const googleAuth = async ({ email, name, avatar }) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, avatar })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Google sign-in failed');
      }

      const expiresAt = Date.now() + 48 * 60 * 60 * 1000;
      const sessionData = {
        token: data.token,
        user: data.user,
        expiresAt
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
      setUser(data.user);
      setToken(data.token);
      return { success: true, user: data.user, isExisting: data.isExisting };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const verifyEmail = async () => {
    if (!user?.email) return;
    try {
      await fetch(`${API_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      });
    } catch (e) {
      console.warn('Verify email offline fallback:', e);
    }
    const updatedUser = { ...user, email_verified: true };
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const session = JSON.parse(saved);
      session.user = updatedUser;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }
    setUser(updatedUser);
  };

  const activatePlan = async (planId, billingDetails, paymentId) => {
    try {
      await fetch(`${API_URL}/api/checkout/razorpay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user?.email || billingDetails?.email,
          planId,
          billingDetails,
          paymentId
        })
      });
    } catch (e) {
      console.warn('Checkout offline fallback:', e);
    }
    const updatedUser = { ...user, plan: planId, billing_details: billingDetails };
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const session = JSON.parse(saved);
      session.user = updatedUser;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }
    setUser(updatedUser);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      isAuthenticated: !!user, 
      loading, 
      login, 
      signup, 
      googleAuth, 
      verifyEmail, 
      activatePlan, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
