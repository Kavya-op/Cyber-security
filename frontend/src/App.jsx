import React, { useState, useEffect } from 'react';
import LoginPage from './components/visuals/LoginPage';
import DashboardLayout from './components/DashboardLayout';
import CyberAnalystDashboard from './components/visuals/CyberAnalystDashboard';
import AdminDashboard from './components/visuals/AdminDashboard';
import { AuthProvider } from './firebase/AuthContext';
import { logAuditAction, subscribeToAuditLogs } from './firebase/firestoreService';

const INITIAL_AUDIT_LOGS = [
  { id: 'AUD-903', timestamp: '2024-11-22 00:12:30', officer: 'RJ-POL-8821', officerName: 'Vikramaditya Rathore', role: 'Senior Investigator', actionType: 'FINDING_VERIFIED', verificationStatus: 'Officer Verified', details: 'Human-in-the-Loop Sign-off: Device Swap & SIM Swap at Malviya Nagar Industrial Area certified under Sec. 65B (OperatorA_Airtel_CDR.csv#L3)', ip: '10.219.87.162' },
  { id: 'AUD-901', timestamp: '2024-11-22 00:04:12', officer: 'RJ-POL-8821', officerName: 'Vikramaditya Rathore', role: 'Senior Investigator', actionType: 'REPORT_EXPORT', verificationStatus: 'Officer Verified', details: 'Exported Section 91 CrPC Official Dossier (FIR #402/2024) - SHA256: 7f8a9e...1b (Included only Officer-Verified AI findings)', ip: '10.219.87.162' },
  { id: 'AUD-900', timestamp: '2024-11-21 23:58:30', officer: 'RJ-CYB-4091', officerName: 'Priya Sharma', role: 'Cyber Analyst', actionType: 'DRAFT_SUBMITTED', verificationStatus: 'Analyst Certified', details: 'Cleaned multi-carrier CDR/IPDR normalization dataset (15 records) & technical anomaly draft submitted to Senior Investigator', ip: '10.219.87.104' },
  { id: 'AUD-899', timestamp: '2024-11-21 23:50:15', officer: 'RJ-POL-8821', officerName: 'Vikramaditya Rathore', role: 'Senior Investigator', actionType: 'FINDING_VERIFIED', verificationStatus: 'Officer Verified', details: 'Human-in-the-Loop Sign-off: Common Cross-Suspect Contact (+91 98299 XXXXX) verified between Suspect Alpha and Beta', ip: '10.219.87.162' },
  { id: 'AUD-898', timestamp: '2024-11-21 23:42:01', officer: 'RJ-POL-8821', officerName: 'Vikramaditya Rathore', role: 'Senior Investigator', actionType: 'AI_QUERY', verificationStatus: 'Officer Verified', details: 'AI Forensics Query: "Cite exact source file and row for IMEI change" -> OperatorA_Airtel_CDR.csv#L3', ip: '10.219.87.162' },
  { id: 'AUD-897', timestamp: '2024-11-21 23:35:44', officer: 'RJ-ADM-0102', officerName: 'Rajeev Verma', role: 'System Admin', actionType: 'ROLE_CHANGE', verificationStatus: 'System Enforced', details: 'Clearance verification update for officer RJ-CYB-5531 (Status set to Revoked)', ip: '10.219.87.001' },
  { id: 'AUD-896', timestamp: '2024-11-21 22:15:20', officer: 'RJ-CYB-4091', officerName: 'Priya Sharma', role: 'Cyber Analyst', actionType: 'FILE_UPLOAD', verificationStatus: 'Analyst Certified', details: 'Ingested 3 carrier files (Operator A, Operator B, Carrier IPDR) - 15 total rows normalized', ip: '10.219.87.104' },
  { id: 'AUD-895', timestamp: '2024-11-21 21:40:02', officer: 'RJ-POL-8821', officerName: 'Vikramaditya Rathore', role: 'Senior Investigator', actionType: 'FINDING_VERIFIED', verificationStatus: 'Officer Verified', details: 'Human-in-the-Loop Sign-off: Midnight burst call correlation (02:14 AM - 03:45 AM) verified across towers TOW-JPR-014 and TOW-JPR-029', ip: '10.219.87.162' }
];

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState('Senior Investigator');
  const [officerId, setOfficerId] = useState('RJ-POL-8821');
  const [draftStatus, setDraftStatus] = useState('DRAFT_PENDING'); // 'DRAFT_PENDING' | 'ANALYST_VERIFIED'
  const [sharedAuditLogs, setSharedAuditLogs] = useState(INITIAL_AUDIT_LOGS);

  // Subscribe to real-time Firestore audit log stream if Firebase is active
  useEffect(() => {
    const unsubscribe = subscribeToAuditLogs((liveLogs) => {
      if (liveLogs && liveLogs.length > 0) {
        setSharedAuditLogs((prev) => {
          const map = new Map();
          [...liveLogs, ...prev].forEach((item) => {
            if (item && item.id && !map.has(item.id)) {
              map.set(item.id, item);
            }
          });
          return Array.from(map.values());
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = (role, id, profile = null) => {
    setUserRole(role);
    setOfficerId(id || (role.includes('Cyber') ? 'RJ-CYB-4091' : role.includes('Admin') ? 'RJ-ADM-0102' : 'RJ-POL-8821'));
    setIsAuthenticated(true);

    // Sync officer login event to Firestore audit trail
    logAuditAction({
      actionType: 'OFFICER_LOGIN',
      officer: id || 'RJ-POL-8821',
      role: role,
      officerName: profile?.displayName || 'Authorized Officer',
      details: `Officer logged in with clearance role: ${role} (Firebase Session)`,
      verificationStatus: 'System Verified',
      ip: '10.219.87.162',
    });
  };

  const handleSwitchRole = (newRole) => {
    setUserRole(newRole);
    const newBadge = newRole.includes('Cyber') ? 'RJ-CYB-4091' : newRole.includes('Admin') ? 'RJ-ADM-0102' : 'RJ-POL-8821';
    setOfficerId(newBadge);

    logAuditAction({
      actionType: 'ROLE_SWITCH',
      officer: newBadge,
      role: newRole,
      details: `Investigator switched active operational context to ${newRole}`,
      verificationStatus: 'Officer Verified',
      ip: '10.219.87.162',
    });
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  const handleHandoffDraft = (draftPayload) => {
    setDraftStatus('ANALYST_VERIFIED');
    const newLog = {
      id: `AUD-${Date.now().toString().slice(-3)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      officer: draftPayload.officer || 'RJ-CYB-4091',
      officerName: 'Priya Sharma',
      role: 'Cyber Analyst',
      actionType: 'DRAFT_SUBMITTED',
      details: `Cleaned multi-carrier CDR/IPDR normalization dataset (${draftPayload.rowsCount || 15} rows, ${draftPayload.filesCount || 3} carrier files) & technical anomaly draft submitted to Senior Investigator`,
      ip: '10.219.87.104'
    };
    setSharedAuditLogs(prev => [newLog, ...prev]);

    // Also persist to Firestore
    logAuditAction(newLog);
  };

  const handleAddAuditLog = (updaterOrLogs) => {
    setSharedAuditLogs((prev) => {
      const next = typeof updaterOrLogs === 'function' ? updaterOrLogs(prev) : updaterOrLogs;
      if (Array.isArray(next) && next.length > prev.length) {
        const newest = next[0];
        if (newest) logAuditAction(newest);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans">
      {!isAuthenticated ? (
        <LoginPage onLogin={handleLogin} />
      ) : userRole.includes('Admin') ? (
        <AdminDashboard 
          officerId={officerId} 
          userRole={userRole} 
          onLogout={handleLogout} 
          onSwitchRole={handleSwitchRole} 
          auditLogs={sharedAuditLogs}
          onAddAuditLog={handleAddAuditLog}
        />
      ) : userRole.includes('Cyber') ? (
        <CyberAnalystDashboard 
          officerId={officerId} 
          userRole={userRole} 
          onLogout={handleLogout} 
          onSwitchRole={handleSwitchRole}
          onHandoffDraft={handleHandoffDraft}
          draftStatus={draftStatus}
        />
      ) : (
        <DashboardLayout 
          officerId={officerId} 
          userRole={userRole} 
          onLogout={handleLogout} 
          onSwitchRole={handleSwitchRole} 
          draftStatus={draftStatus}
          onAddAuditLog={handleAddAuditLog}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
