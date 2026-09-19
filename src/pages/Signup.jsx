import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Sparkles, Mail, Lock, Eye, EyeOff, ArrowRight, Check, CheckCircle2, 
  AlertCircle, ShieldCheck, User, Globe 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GoogleAuthButton from '../components/GoogleAuthButton';
import './LandingPage.css';
import './Signup.css';

const COUNTRIES = [
  'India',
  'United States',
  'United Arab Emirates',
  'United Kingdom',
  'Canada',
  'Australia',
  'Singapore',
  'Germany',
  'France',
  'Saudi Arabia',
  'Netherlands',
  'Brazil',
  'Indonesia',
  'South Africa'
];

export default function Signup() {
  const [searchParams] = useSearchParams();
  const requestedPlan = searchParams.get('plan') || 'free';

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    country: 'India',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credential) => {
    setError('');
    setSubmitting(true);
    const res = await loginWithGoogle(credential, requestedPlan);
    setSubmitting(false);
    if (res.success) {
      navigate('/dashboard', { replace: true });
    } else {
      setError(res.error || 'Google authentication failed. Please try again.');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Submit Email Signup Form with Full Details (Name, Email, Country, Password, Confirm Password)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const { name, email, country, password, confirmPassword } = formData;

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid work email.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setSubmitting(true);
    const res = await signup({
      name: name.trim(),
      email: email.trim(),
      country,
      password,
      plan: requestedPlan
    });
    setSubmitting(false);

    if (res.success) {
      navigate('/dashboard', { replace: true });
    } else {
      setError(res.error || 'Failed to create account. Please try again.');
    }
  };

  return (
    <div className="signup-screen-container">
      {/* Background Ambient Mesh */}
      <div className="signup-visual-backdrop">
        <div className="signup-glow-1"></div>
        <div className="signup-glow-2"></div>
      </div>

      {/* Main Signup Form Card */}
      <div className="signup-card-wrapper">
        {/* Brand Header */}
        <div className="signup-brand-header" onClick={() => navigate('/landing')}>
          <div className="signup-brand-logo">
            <Sparkles size={22} />
          </div>
          <div className="signup-brand-text">
            <h2>Contaques</h2>
            <span className="signup-pro-tag">PRO INTELLIGENCE</span>
          </div>
        </div>

        {/* Heading Box */}
        <div className="signup-heading-box">
          <h3>Create your Free Account</h3>
          <p>Sign up with Google or complete your details to launch your dashboard.</p>
        </div>

        {error && (
          <div className="signup-alert-box animate-fade-in">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Official Google Identity Services Sign Up Button */}
        <GoogleAuthButton 
          isSignup={true}
          onSuccess={handleGoogleSuccess} 
          onError={setError} 
        />

        {/* Divider */}
        <div className="signup-divider-row">
          <div className="signup-divider-line"></div>
          <span className="signup-divider-text">or sign up with email</span>
          <div className="signup-divider-line"></div>
        </div>

        {/* Email Signup Form with Full Requested Details */}
        <form onSubmit={handleSubmit} className="signup-form">
          {/* Name Field */}
          <div className="signup-input-field-wrap">
            <User size={18} className="field-icon-left" />
            <input 
              type="text" 
              name="name"
              className="signup-clean-input"
              placeholder="Full Name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          {/* Email Field */}
          <div className="signup-input-field-wrap">
            <Mail size={18} className="field-icon-left" />
            <input 
              type="email" 
              name="email"
              className="signup-clean-input"
              placeholder="Enter your Email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          {/* Country Field */}
          <div className="signup-input-field-wrap">
            <Globe size={18} className="field-icon-left" />
            <select 
              name="country" 
              className="signup-clean-input signup-select"
              value={formData.country}
              onChange={handleChange}
            >
              {COUNTRIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Create Password Field */}
          <div className="signup-input-field-wrap">
            <Lock size={18} className="field-icon-left" />
            <input 
              type={showPassword ? 'text' : 'password'}
              name="password"
              className="signup-clean-input"
              placeholder="Create a Password"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <button 
              type="button" 
              className="signup-pwd-toggle"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex="-1"
              title={showPassword ? 'Hide' : 'Show'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Confirm Password Field */}
          <div className="signup-input-field-wrap">
            <Lock size={18} className="field-icon-left" />
            <input 
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
              className="signup-clean-input"
              placeholder="Confirm your Password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
            <button 
              type="button" 
              className="signup-pwd-toggle"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              tabIndex="-1"
              title={showConfirmPassword ? 'Hide' : 'Show'}
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            className="signup-submit-btn"
            disabled={submitting}
          >
            {submitting ? (
              <span>Creating your workspace...</span>
            ) : (
              <>
                <span>Create Account & Launch Dashboard</span>
                <ArrowRight size={17} />
              </>
            )}
          </button>

          {/* Bottom switch to Sign In */}
          <div className="signup-bottom-switch">
            <span>Already have an account?</span>
            <span 
              className="signup-signin-link" 
              onClick={() => navigate('/login')}
            >
              Sign In
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
