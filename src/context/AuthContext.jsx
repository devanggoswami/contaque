import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config';

const AuthContext = createContext(null);

const STORAGE_KEY = 'lead_os_auth_session';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState({
    balance: 0.00,
    currency: 'INR',
    plan: 'free',
    rates: {}
  });

  const refreshWallet = async (overrideToken) => {
    let activeToken = overrideToken || token;
    if (!activeToken) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          activeToken = parsed?.token;
        }
      } catch {
        // fallback
      }
    }
    if (!activeToken) return;

    try {
      const headers = { 'Authorization': `Bearer ${activeToken}` };
      const res = await fetch(`${API_URL}/api/wallet/balance`, { headers });
      if (res.ok) {
        const data = await res.json();
        setWallet({
          balance: Number(data.balance || 0),
          currency: data.currency || 'INR',
          plan: data.plan || 'free',
          rates: data.rates || {},
          allTiers: data.allTiers || {}
        });

        // Always sync user object plan with server wallet plan
        setUser(prev => {
          if (!prev) return prev;
          if (data.plan && prev.plan !== data.plan) {
            const upd = { ...prev, plan: data.plan };
            try {
              const s = localStorage.getItem(STORAGE_KEY);
              if (s) {
                const parsed = JSON.parse(s);
                parsed.user = upd;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
              }
            } catch {}
            return upd;
          }
          return prev;
        });
      }
    } catch {
      // Quiet fallback for local execution
    }
  };

  const authFetch = useCallback(async (url, options = {}) => {
    let activeToken = token;
    if (!activeToken) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          activeToken = parsed?.token;
        }
      } catch {
        // fallback
      }
    }
    const headers = {
      ...options.headers,
      ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {})
    };
    return fetch(url, { ...options, headers });
  }, [token]);

  const updateUserPlan = async (newPlan) => {
    try {
      const res = await authFetch(`${API_URL}/api/wallet/plan/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: newPlan })
      });
      const data = await res.json();
      if (res.ok) {
        await refreshWallet();
        return { success: true, message: data.message };
      }
      return { success: false, error: data.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Initialize session from localStorage, verify with server & provide sliding activity renewal
  useEffect(() => {
    const initSession = async () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const session = JSON.parse(saved);
          // Check if session token and expiration are valid
          if (session.token && session.expiresAt && Date.now() < session.expiresAt) {
            try {
              const vRes = await fetch(`${API_URL}/api/auth/verify`, {
                headers: { 'Authorization': `Bearer ${session.token}` }
              });
              if (vRes.ok) {
                const vData = await vRes.json();
                const activeUser = vData.user || session.user;
                setUser(activeUser);
                setToken(session.token);
                refreshWallet(session.token);

                const updatedSession = {
                  ...session,
                  user: activeUser,
                  expiresAt: timeRemaining < 36 * 60 * 60 * 1000 ? (Date.now() + 48 * 60 * 60 * 1000) : session.expiresAt
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSession));
                return;
              } else {
                // Token rejected by server
                localStorage.removeItem(STORAGE_KEY);
                setUser(null);
                setToken(null);
                return;
              }
            } catch {
              // Server temporary network error: retain local session if not expired
              setUser(session.user);
              setToken(session.token);
              refreshWallet(session.token);
              return;
            }
          }
        }
        // No stored session or expired
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
        setToken(null);
      } catch (err) {
        console.error('Session load error:', err);
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
        setToken(null);
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

  const loginWithGoogle = async (credential, plan = 'free') => {
    try {
      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, plan })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Google authentication failed.');
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
      await refreshWallet(data.token);
      return { success: true, user: data.user };
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
    setWallet({
      balance: 0.00,
      currency: 'INR',
      plan: 'free',
      rates: {},
      allTiers: {}
    });
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      wallet,
      walletBalance: wallet.balance,
      walletRates: wallet.rates,
      walletAllTiers: wallet.allTiers,
      userPlan: wallet.plan || (user && user.plan) || 'plus',
      updateUserPlan,
      refreshWallet,
      authFetch,
      isAuthenticated: Boolean(user && token), 
      loading, 
      login, 
      loginWithGoogle,
      signup, 
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
