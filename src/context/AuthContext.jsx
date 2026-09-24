import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config';
import CurrencySelectionModal from '../components/CurrencySelectionModal';

const AuthContext = createContext(null);

const STORAGE_KEY = 'lead_os_auth_session';

// Helper to safely parse API responses and handle HTML/server outage errors cleanly
async function parseResponseJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    if (res.status === 404 || res.status === 502 || res.status === 503 || res.status === 504 || text.includes('Service Suspended') || text.includes('<html>')) {
      throw new Error('Backend service is currently unavailable. Please try again shortly.');
    }
    throw new Error(!res.ok ? 'Backend service is currently unavailable. Please try again shortly.' : 'Invalid response from server.');
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState({
    balance: 0.00,
    currency: null,
    currency_preference: null,
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
        const data = await parseResponseJson(res);
        setWallet({
          balance: Number(data.balance || 0),
          balance_inr: Number(data.balance_inr !== undefined ? data.balance_inr : 0),
          balance_usd: Number(data.balance_usd !== undefined ? data.balance_usd : 0),
          currency: data.currency || null,
          currency_preference: data.currency_preference || null,
          plan: data.plan || 'free',
          plan_expires_at: data.plan_expires_at || null,
          rates: data.rates || {},
          allTiers: data.allTiers || {}
        });

        // Always sync user object plan, plan_expires_at, and currency_preference with server wallet plan
        setUser(prev => {
          if (!prev) return prev;
          const planChanged = data.plan && prev.plan !== data.plan;
          const expiryChanged = data.plan_expires_at !== undefined && prev.plan_expires_at !== data.plan_expires_at;
          const currencyChanged = data.currency_preference !== undefined && prev.currency_preference !== data.currency_preference;
          if (planChanged || expiryChanged || currencyChanged) {
            const upd = { 
              ...prev, 
              ...(data.plan ? { plan: data.plan } : {}),
              ...(data.plan_expires_at !== undefined ? { plan_expires_at: data.plan_expires_at } : {}),
              ...(data.currency_preference !== undefined ? { currency_preference: data.currency_preference } : {})
            };
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
      const data = await parseResponseJson(res);
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
                const vData = await parseResponseJson(vRes);
                if (vData.valid && vData.user) {
                  setUser(vData.user);
                  setToken(session.token);
                  const renewalTimestamp = Date.now() + 48 * 60 * 60 * 1000;
                  const renewedSession = {
                    ...session,
                    user: vData.user,
                    expiresAt: renewalTimestamp
                  };
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(renewedSession));
                  await refreshWallet(session.token);
                  setLoading(false);
                  return;
                }
              }
            } catch {
              // Server verification offline; fallback to cached session
              setUser(session.user);
              setToken(session.token);
              setLoading(false);
              return;
            }
          }
        }
        // No stored session or expired
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
        setToken(null);
      } catch {
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

      const data = await parseResponseJson(res);
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
      if (data.user?.wallet_balance !== undefined) {
        setWallet(prev => ({ ...prev, balance: Number(data.user.wallet_balance) }));
      }
      await refreshWallet(data.token);
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

      const data = await parseResponseJson(res);
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
      if (data.user?.wallet_balance !== undefined) {
        setWallet(prev => ({ ...prev, balance: Number(data.user.wallet_balance) }));
      }
      await refreshWallet(data.token);
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

      const data = await parseResponseJson(res);
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
      if (data.user?.currency_preference) {
        const bal = data.user.currency_preference === 'USD' 
          ? Number(data.user.wallet_balance_usd || 0) 
          : Number(data.user.wallet_balance || 0);
        setWallet(prev => ({ 
          ...prev, 
          balance: bal,
          currency: data.user.currency_preference,
          currency_preference: data.user.currency_preference
        }));
      } else {
        setWallet(prev => ({ 
          ...prev, 
          balance: 0.00,
          currency: null,
          currency_preference: null
        }));
      }
      await refreshWallet(data.token);
      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Request new email verification link to be sent to user's registered email
  const resendVerificationEmail = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await parseResponseJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to send verification email');
      return { success: true, message: data.message };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Verify email using server-validated cryptographic token
  const verifyEmailWithToken = async (token) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-email-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await parseResponseJson(res);
      if (!res.ok) throw new Error(data.error || 'Invalid or expired verification link');
      
      if (data.token && data.user) {
        // Security Authority: Cleanly isolate session. Wipe any prior session (e.g. admin or other user)
        localStorage.removeItem(STORAGE_KEY);
        const expiresAt = Date.now() + 48 * 60 * 60 * 1000;
        const sessionData = {
          token: data.token,
          user: data.user,
          expiresAt
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
        setUser(data.user);
        setToken(data.token);
        if (data.user?.wallet_balance !== undefined) {
          setWallet(prev => ({ 
            ...prev, 
            balance: Number(data.user.wallet_balance),
            balance_usd: Number(data.user.wallet_balance_usd || 0),
            currency_preference: data.user.currency_preference || null
          }));
        }
        await refreshWallet(data.token);
      } else {
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
        setToken(null);
      }

      return { success: true, message: data.message, user: data.user, token: data.token };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Refresh and synchronize user plan and profile from backend source of truth
  const activatePlan = async (planId, billingDetails) => {
    try {
      await refreshWallet();
    } catch (e) {
      console.warn('Sync plan error:', e);
    }
  };

  const setCurrencyPreference = async (curr) => {
    try {
      const res = await authFetch(`${API_URL}/api/user/currency-preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: curr, currency_preference: curr })
      });
      const data = await parseResponseJson(res);
      if (res.ok) {
        setUser(prev => {
          if (!prev) return prev;
          const upd = { ...prev, currency_preference: curr };
          try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
              const session = JSON.parse(saved);
              session.user = upd;
              localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
            }
          } catch {}
          return upd;
        });
        await refreshWallet();
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setToken(null);
    setWallet({
      balance: 0.00,
      currency: null,
      currency_preference: null,
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
      walletBalanceUSD: wallet.balance_usd || 0,
      walletBalanceINR: wallet.balance_inr || 0,
      walletCurrency: wallet.currency || null,
      currencyPreference: user?.currency_preference || wallet.currency_preference || null,
      walletRates: wallet.rates,
      walletAllTiers: wallet.allTiers,
      userPlan: wallet.plan || (user && user.plan) || 'free',
      planExpiresAt: wallet.plan_expires_at || (user && user.plan_expires_at) || null,
      updateUserPlan,
      refreshWallet,
      setCurrencyPreference,
      authFetch,
      isAuthenticated: Boolean(user && token), 
      loading, 
      login, 
      loginWithGoogle,
      signup, 
      resendVerificationEmail,
      verifyEmailWithToken,
      activatePlan, 
      logout 
    }}>
      {children}
      <CurrencySelectionModal 
        isOpen={Boolean(!loading && user && token && !user.currency_preference)} 
      />
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
