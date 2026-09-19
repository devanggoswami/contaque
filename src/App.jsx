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

// Public Login: If already authenticated, redirect to /dashboard
function PublicLoginRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-loading-screen">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Login />;
}

// Public Signup: If already authenticated, redirect to /dashboard
function PublicSignupRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-loading-screen">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Signup />;
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

          {/* Public Auth Routes */}
          <Route path="/login" element={<PublicLoginRoute />} />
          <Route path="/signup" element={<PublicSignupRoute />} />

          {/* Strictly Protected Application Routes */}
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/generate" element={<GenerateData />} />
            <Route path="/database" element={<Database />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/inbox" element={<Inbox />} />
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
