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

// Helper to extract authoritative wallet state from a user profile object
function extractWalletFromUser(u, prevWallet = {}) {
  if (!u) {
    return {
      balance: 0.00,
      balance_inr: 0.00,
      balance_usd: 0.00,
      currency: null,
      currency_preference: null,
      plan: 'free',
      plan_expires_at: null,
      rates: prevWallet.rates || {},
      allTiers: prevWallet.allTiers || {}
    };
  }
  const pref = u.currency_preference || prevWallet.currency_preference || null;
  const isUSD = (pref || '').toUpperCase() === 'USD';
  const balUSD = Number(u.wallet_balance_usd !== undefined && u.wallet_balance_usd !== null ? u.wallet_balance_usd : (prevWallet.balance_usd || 0));
  const balINR = Number(u.wallet_balance !== undefined && u.wallet_balance !== null ? u.wallet_balance : (prevWallet.balance_inr || 0));
  const activeBal = pref ? (isUSD ? balUSD : balINR) : 0;
  return {
    balance: activeBal,
    balance_inr: balINR,
    balance_usd: balUSD,
    currency: pref,
    currency_preference: pref,
    plan: u.plan || prevWallet.plan || 'free',
    plan_expires_at: u.plan_expires_at !== undefined ? u.plan_expires_at : (prevWallet.plan_expires_at || null),
    rates: prevWallet.rates || {},
    allTiers: prevWallet.allTiers || {}
  };
}

export const AuthProvider = ({ children }) => {
  // Synchronous session restore helper to prevent initial $0 flash upon reload/edit
  const getInitialSession = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const session = JSON.parse(saved);
        if (session?.token && session?.expiresAt && Date.now() < session.expiresAt) {
          return session;
        }
      }
    } catch {}
    return null;
  };

  const initialSession = getInitialSession();

  const [user, setUser] = useState(() => initialSession?.user || null);
  const [token, setToken] = useState(() => initialSession?.token || null);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(() => extractWalletFromUser(initialSession?.user));

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
        const bInr = Number(data.balance_inr !== undefined && data.balance_inr !== null ? data.balance_inr : 0);
        const bUsd = Number(data.balance_usd !== undefined && data.balance_usd !== null ? data.balance_usd : 0);
        const pref = data.currency_preference || null;
        const isUSD = (pref || '').toUpperCase() === 'USD';
        const activeBal = pref ? (isUSD ? bUsd : bInr) : Number(data.balance || 0);

        setWallet({
          balance: activeBal,
          balance_inr: bInr,
          balance_usd: bUsd,
          currency: data.currency || pref,
          currency_preference: pref,
          plan: data.plan || 'free',
          plan_expires_at: data.plan_expires_at || null,
          rates: data.rates || {},
          allTiers: data.allTiers || {}
        });

        // Always sync user object & localStorage with authoritative server balances & plan
        setUser(prev => {
          let current = prev;
          if (!current) {
            try {
              const s = localStorage.getItem(STORAGE_KEY);
              if (s) {
                const parsed = JSON.parse(s);
                current = parsed?.user || null;
              }
            } catch {}
          }
          if (!current) return null;
          const upd = { 
            ...current,
            wallet_balance: bInr,
            wallet_balance_usd: bUsd,
            ...(data.plan ? { plan: data.plan } : {}),
            ...(data.plan_expires_at !== undefined ? { plan_expires_at: data.plan_expires_at } : {}),
            ...(pref !== null ? { currency_preference: pref } : {})
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
                  setWallet(prev => extractWalletFromUser(vData.user, prev));

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
              } else if (vRes.status === 401) {
                // Token explicitly rejected by server
                localStorage.removeItem(STORAGE_KEY);
                setUser(null);
                setToken(null);
                setLoading(false);
                return;
              }
              // If status is 500, 502, 503 or transient network failure:
              // Fall back to cached session instead of dropping user or resetting wallet
              if (session.user && session.token) {
                setUser(session.user);
                setToken(session.token);
                setWallet(prev => extractWalletFromUser(session.user, prev));
                refreshWallet(session.token).catch(() => {});
                setLoading(false);
                return;
              }
            } catch {
              // Server verification offline; fallback to cached session
              if (session.user && session.token) {
                setUser(session.user);
                setToken(session.token);
                setWallet(prev => extractWalletFromUser(session.user, prev));
                refreshWallet(session.token).catch(() => {});
                setLoading(false);
                return;
              }
            }
          }
        }
        // No stored session or expired
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
        setToken(null);
        setWallet(extractWalletFromUser(null));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
        setToken(null);
        setWallet(extractWalletFromUser(null));
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
      setWallet(prev => extractWalletFromUser(data.user, prev));
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
      setWallet(prev => extractWalletFromUser(data.user, prev));
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
      setLoading(false);
      setWallet(prev => extractWalletFromUser(data.user, prev));
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
        setWallet(prev => extractWalletFromUser(data.user, prev));
        await refreshWallet(data.token);
      } else {
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
        setToken(null);
        setWallet(extractWalletFromUser(null));
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
        // Immediately flip active wallet balance without waiting for network roundtrip
        const isUSD = (curr || '').toUpperCase() === 'USD';
        setWallet(prev => ({
          ...prev,
          currency: curr,
          currency_preference: curr,
          balance: isUSD ? prev.balance_usd : prev.balance_inr
        }));

        setUser(prev => {
          let current = prev;
          if (!current) {
            try {
              const s = localStorage.getItem(STORAGE_KEY);
              if (s) current = JSON.parse(s)?.user;
            } catch {}
          }
          const upd = { ...(current || {}), currency_preference: curr };
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
    setWallet(extractWalletFromUser(null));
  };

  const effectiveCurrency = user?.currency_preference || wallet.currency_preference || null;
  const isUSD = (effectiveCurrency || '').toUpperCase() === 'USD';

  // Resilient authoritative balance resolution:
  // If user currency is USD:
  // Priority 1: wallet.balance_usd (if defined & non-null)
  // Priority 2: user.wallet_balance_usd (if defined & non-null)
  // Priority 3: wallet.balance
  const resolvedBalanceUSD = Number(
    wallet.balance_usd !== undefined && wallet.balance_usd !== null
      ? wallet.balance_usd
      : (user?.wallet_balance_usd !== undefined && user?.wallet_balance_usd !== null ? user.wallet_balance_usd : 0)
  );

  const resolvedBalanceINR = Number(
    wallet.balance_inr !== undefined && wallet.balance_inr !== null
      ? wallet.balance_inr
      : (user?.wallet_balance !== undefined && user?.wallet_balance !== null ? user.wallet_balance : 0)
  );

  let activeWalletBalance = 0;
  if (effectiveCurrency === 'USD') {
    activeWalletBalance = resolvedBalanceUSD;
  } else if (effectiveCurrency === 'INR') {
    activeWalletBalance = resolvedBalanceINR;
  } else {
    activeWalletBalance = Number(wallet.balance || 0);
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      setUser,
      token, 
      wallet,
      walletBalance: activeWalletBalance,
      walletBalanceUSD: resolvedBalanceUSD,
      walletBalanceINR: resolvedBalanceINR,
      walletCurrency: wallet.currency || effectiveCurrency,
      currencyPreference: effectiveCurrency,
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
