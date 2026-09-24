import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import GenerateData from './pages/GenerateData';
import Database from './pages/Database';
import Campaigns from './pages/Campaigns';
import Inbox from './pages/Inbox';
import Administrative from './pages/Administrative';
import Login from './pages/Login';
import Signup from './pages/Signup';
import LandingPage from './pages/LandingPage';
import ContactUs from './pages/ContactUs';
import TermsAndConditions from './pages/TermsAndConditions';
import PrivacyPolicy from './pages/PrivacyPolicy';
import PaymentRefundPolicy from './pages/PaymentRefundPolicy';
import ReferAndEarn from './pages/ReferAndEarn';
import HelpSupport from './pages/HelpSupport';
import './App.css';

// Protected App Layout: Strict route guard requiring valid session & JWT
function ProtectedLayout() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-loading-screen">
        <div className="loading-spinner"></div>
        <p>Verifying secure session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Root Route: Always renders Public Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Standalone Public Pages (No sidebar, no dashboard layout) */}
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/home" element={<LandingPage />} />
          <Route path="/welcome" element={<LandingPage />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/contact-us" element={<ContactUs />} />

          {/* Public Legal & Policy Pages */}
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
          <Route path="/terms-of-service" element={<TermsAndConditions />} />
          <Route path="/terms-of-use" element={<TermsAndConditions />} />
          <Route path="/tos" element={<TermsAndConditions />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/refund-policy" element={<PaymentRefundPolicy />} />
          <Route path="/payment-refund-policy" element={<PaymentRefundPolicy />} />
          <Route path="/refund" element={<PaymentRefundPolicy />} />

          {/* Public Auth Routes: Always accessible to allow multi-user login and signup */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email" element={<Navigate to="/login" replace />} />

          {/* Strictly Protected Application Routes */}
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/generate" element={<GenerateData />} />
            <Route path="/database" element={<Database />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/referral" element={<ReferAndEarn />} />
            <Route path="/refer-and-earn" element={<ReferAndEarn />} />
            <Route path="/refer" element={<ReferAndEarn />} />
            <Route path="/support" element={<HelpSupport />} />
            <Route path="/help-and-support" element={<HelpSupport />} />
            <Route path="/help" element={<HelpSupport />} />
            <Route path="/admin" element={<Administrative />} />
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
