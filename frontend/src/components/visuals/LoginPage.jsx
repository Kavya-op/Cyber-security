import React, { useState } from 'react';
import { 
  Shield, 
  Lock, 
  User, 
  LogIn, 
  Eye, 
  EyeOff, 
  ArrowRight,
  Flame,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { isFirebaseConfigured, firebaseConfig } from '../../firebase/config';
import { signInOfficerWithEmail, signInOfficerWithGoogle } from '../../firebase/authService';

const ROLES = [
  { 
    id: 'Senior Investigator', 
    shortLabel: 'Senior Investigator', 
    badge: 'Full Access',
    badgeId: 'RJ-POL-8821',
    desc: 'Timeline, GIS Map & AI Dossier'
  },
  { 
    id: 'Cyber Analyst', 
    shortLabel: 'Cyber Analyst', 
    badge: 'Normalization',
    badgeId: 'RJ-CYB-4091',
    desc: 'Multi-Carrier CDR / IPDR Ingestion'
  },
  { 
    id: 'Admin', 
    shortLabel: 'System Admin', 
    badge: 'Audit & RBAC',
    badgeId: 'RJ-ADM-0102',
    desc: 'Section 65B Compliance Trail'
  }
];

export default function LoginPage({ onLogin }) {
  const [authMode, setAuthMode] = useState('QUICK_ROLE'); // 'QUICK_ROLE' | 'FIREBASE_AUTH'
  const [officerId, setOfficerId] = useState('RJ-POL-8821');
  const [email, setEmail] = useState('investigator.rathore@police.rajasthan.gov.in');
  const [password, setPassword] = useState('••••••••••••');
  const [selectedRole, setSelectedRole] = useState('Senior Investigator');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  const isConfigured = isFirebaseConfigured();

  const handleQuickSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLogin(selectedRole, officerId || 'RJ-POL-8821');
    }, 200);
  };

  const handleRoleDirectLogin = (role) => {
    setSelectedRole(role.id);
    setOfficerId(role.badgeId);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLogin(role.id, role.badgeId);
    }, 150);
  };

  const handleFirebaseEmailLogin = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setIsLoading(true);
    try {
      if (!isConfigured) {
        throw new Error('Firebase credentials not set in frontend/.env. Copy your Firebase config to enable live cloud authentication, or switch to Quick Sign-In.');
      }
      const profile = await signInOfficerWithEmail(email, password);
      onLogin(profile.role, profile.badgeId, profile);
    } catch (err) {
      setAuthError(err.message || 'Firebase authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFirebaseGoogleLogin = async () => {
    setAuthError(null);
    setIsLoading(true);
    try {
      if (!isConfigured) {
        throw new Error('Firebase credentials not set in frontend/.env. Copy your Firebase config to enable Google Sign-In.');
      }
      const profile = await signInOfficerWithGoogle();
      onLogin(profile.role, profile.badgeId, profile);
    } catch (err) {
      setAuthError(err.message || 'Google SSO sign-in was cancelled or encountered an error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 selection:bg-slate-900 selection:text-white">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xs p-8">
        
        {/* Header */}
        <div className="flex items-center space-x-3 pb-5 border-b border-slate-100">
          <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-slate-900 tracking-tight leading-none">
              Rajasthan Police Cyber Command
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              CDR / IPDR Telecom Forensics Suite (PS03)
            </p>
          </div>
        </div>

        {/* Firebase Live Status Pill */}
        <div className="my-4 p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <Flame className={`w-4 h-4 ${isConfigured ? 'text-amber-500' : 'text-slate-400'}`} />
            <div>
              <span className="font-semibold text-slate-800">Firebase Cloud: </span>
              <span className="text-slate-600 font-mono text-[11px]">
                {isConfigured ? (firebaseConfig.projectId || 'Active') : 'Ready (Awaiting .env keys)'}
              </span>
            </div>
          </div>
          <span className={`inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full ${
            isConfigured 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            {isConfigured ? 'Live Connected' : 'Simulation Mode'}
          </span>
        </div>

        {/* Auth Mode Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => setAuthMode('QUICK_ROLE')}
            className={`py-1.5 rounded-md transition-all ${
              authMode === 'QUICK_ROLE'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1-Click Clearance
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('FIREBASE_AUTH')}
            className={`py-1.5 rounded-md transition-all flex items-center justify-center space-x-1.5 ${
              authMode === 'FIREBASE_AUTH'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>Firebase Login</span>
          </button>
        </div>

        {authError && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 text-[11px] leading-relaxed">{authError}</div>
          </div>
        )}

        {authMode === 'QUICK_ROLE' ? (
          <>
            {/* 1-Click Role Direct Sign-in */}
            <div className="py-2 border-b border-slate-100">
              <label className="block text-xs font-medium text-slate-500 mb-2.5">
                Quick Sign-In by Clearance Role
              </label>
              <div className="grid grid-cols-1 gap-2">
                {ROLES.map((role) => {
                  const isSelected = selectedRole === role.id;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => handleRoleDirectLogin(role)}
                      className={`flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-semibold">{role.shortLabel}</span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                            isSelected ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {role.badgeId}
                          </span>
                        </div>
                        <p className={`text-[11px] mt-0.5 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                          {role.desc}
                        </p>
                      </div>
                      <ArrowRight className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Traditional Credentials Form */}
            <form onSubmit={handleQuickSubmit} className="pt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Officer Badge ID
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={officerId}
                    onChange={(e) => setOfficerId(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 text-slate-900"
                    placeholder="RJ-POL-8821"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">
                    Security Passcode
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">Sec. 91 CrPC</span>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-9 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 active:bg-black transition-colors flex items-center justify-center space-x-2"
              >
                <LogIn className="w-4 h-4" />
                <span>{isLoading ? 'Authenticating...' : `Enter Console (${selectedRole.split(' ')[0]})`}</span>
              </button>
            </form>
          </>
        ) : (
          /* Firebase Real Authentication Form */
          <div className="pt-2 space-y-4">
            <button
              type="button"
              onClick={handleFirebaseGoogleLogin}
              disabled={isLoading}
              className="w-full py-2.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors flex items-center justify-center space-x-2 shadow-2xs"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Sign in with Google (Police SSO)</span>
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-3 text-[10px] uppercase font-mono text-slate-400">or official email</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <form onSubmit={handleFirebaseEmailLogin} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Official Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 text-slate-900"
                  placeholder="officer@police.rajasthan.gov.in"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Firebase Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 text-slate-900"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 active:bg-black transition-colors flex items-center justify-center space-x-2"
              >
                <Flame className="w-4 h-4 text-amber-400" />
                <span>{isLoading ? 'Connecting to Firebase...' : 'Firebase Cloud Sign-In'}</span>
              </button>
            </form>

            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
              <strong>Tip for Judges / Setup:</strong> To link your own Firebase project, place your credentials in <code>frontend/.env</code>. When offline, use the <em>1-Click Clearance</em> tab for immediate full-featured access.
            </div>
          </div>
        )}

        {/* Footer Meta */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>FIR #402/2024</span>
          <span>Jaipur Cyber Cell</span>
          <span>Sec. 65B Certified</span>
        </div>
      </div>
    </div>
  );
}
