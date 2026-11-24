/**
 * Rajasthan Police CDR/IPDR Intelligence Platform
 * Officer Authentication Context
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInOfficerWithEmail,
  signInOfficerWithGoogle,
  signOutOfficer,
  subscribeToAuthChanges,
} from './authService';
import { isFirebaseConfigured, firebaseConfig } from './config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [officerProfile, setOfficerProfile] = useState({
    displayName: 'Vikramaditya Rathore',
    badgeId: 'RJ-POL-8821',
    role: 'Senior Investigator',
    email: 'investigator.rathore@police.rajasthan.gov.in',
  });
  const [isFirebaseLive, setIsFirebaseLive] = useState(isFirebaseConfigured());
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    setIsFirebaseLive(isFirebaseConfigured());

    const unsubscribe = subscribeToAuthChanges((profile) => {
      if (profile) {
        setCurrentUser(profile);
        setOfficerProfile(profile);
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email, password) => {
    setAuthLoading(true);
    try {
      const profile = await signInOfficerWithEmail(email, password);
      setCurrentUser(profile);
      setOfficerProfile(profile);
      return profile;
    } finally {
      setAuthLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setAuthLoading(true);
    try {
      const profile = await signInOfficerWithGoogle();
      setCurrentUser(profile);
      setOfficerProfile(profile);
      return profile;
    } finally {
      setAuthLoading(false);
    }
  };

  const quickDemoLogin = (role, badgeId, officerName = null) => {
    const demoProfile = {
      displayName: officerName || (role.includes('Cyber') ? 'Priya Sharma' : role.includes('Admin') ? 'Rajeev Verma' : 'Vikramaditya Rathore'),
      badgeId: badgeId || (role.includes('Cyber') ? 'RJ-CYB-4091' : role.includes('Admin') ? 'RJ-ADM-0102' : 'RJ-POL-8821'),
      role: role || 'Senior Investigator',
      email: `${(role || 'investigator').toLowerCase().replace(/\s+/g, '.')}@police.rajasthan.gov.in`,
      isDemo: true,
    };
    setCurrentUser(demoProfile);
    setOfficerProfile(demoProfile);
    return demoProfile;
  };

  const logout = async () => {
    if (isFirebaseLive) {
      await signOutOfficer();
    }
    setCurrentUser(null);
  };

  const switchRole = (newRole) => {
    const newBadge = newRole.includes('Cyber') ? 'RJ-CYB-4091' : newRole.includes('Admin') ? 'RJ-ADM-0102' : 'RJ-POL-8821';
    quickDemoLogin(newRole, newBadge);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        officerProfile,
        userRole: officerProfile?.role || 'Senior Investigator',
        badgeId: officerProfile?.badgeId || 'RJ-POL-8821',
        isFirebaseLive,
        firebaseProjectId: firebaseConfig?.projectId || null,
        authLoading,
        loginWithEmail,
        loginWithGoogle,
        quickDemoLogin,
        switchRole,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useOfficerAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useOfficerAuth must be used within an AuthProvider');
  }
  return context;
}
