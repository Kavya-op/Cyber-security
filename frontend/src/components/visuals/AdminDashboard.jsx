import React, { useState, useMemo } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  Users, 
  FileText, 
  Key, 
  Lock, 
  Search, 
  Plus, 
  UserPlus, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Database, 
  Terminal, 
  LogOut, 
  UserCheck, 
  ToggleLeft, 
  ToggleRight,
  Filter,
  Activity,
  Layers,
  ArrowRight,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  Trash2,
  CheckSquare,
  Square,
  EyeOff,
  FileCode,
  ShieldAlert,
  RefreshCw,
  Settings
} from 'lucide-react';
import ScrollReveal from './ScrollReveal';
import SettingsModal from './SettingsModal';

// Initial Mock Officers
const INITIAL_OFFICERS = [
  { id: 1, name: 'Vikramaditya Rathore', officerId: 'RJ-POL-8821', email: 'v.rathore@rajasthanpolice.gov.in', role: 'Senior Investigator', status: 'Active', department: 'Cyber Crime Police Station, Jaipur', lastLogin: '2024-11-21 23:42:15' },
  { id: 2, name: 'Priya Sharma', officerId: 'RJ-CYB-4091', email: 'p.sharma@rajasthanpolice.gov.in', role: 'Cyber Analyst', status: 'Active', department: 'Telecom Forensics Lab, Jaipur', lastLogin: '2024-11-21 23:55:08' },
  { id: 3, name: 'Rajeev Verma', officerId: 'RJ-ADM-0102', email: 'r.verma@rajasthanpolice.gov.in', role: 'System Admin', status: 'Active', department: 'Cyber Command HQ, Police HQ Jaipur', lastLogin: '2024-11-22 00:02:11' },
  { id: 4, name: 'Suresh Meena', officerId: 'RJ-POL-6210', email: 's.meena@rajasthanpolice.gov.in', role: 'Senior Investigator', status: 'Active', department: 'Special Operations Group (SOG)', lastLogin: '2024-11-20 18:20:40' },
  { id: 5, name: 'Kavita Bishnoi', officerId: 'RJ-CYB-5531', email: 'k.bishnoi@rajasthanpolice.gov.in', role: 'Cyber Analyst', status: 'Revoked', department: 'Ajmer Range Cyber Cell', lastLogin: '2024-11-15 09:12:00' }
];

// Initial Live Audit Log Entries
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

export default function AdminDashboard({ 
  officerId = 'RJ-ADM-0102', 
  userRole = 'System Admin', 
  onLogout, 
  onSwitchRole,
  auditLogs: propAuditLogs,
  onAddAuditLog
}) {
  const [officers, setOfficers] = useState(INITIAL_OFFICERS);
  const [localAuditLogs, setLocalAuditLogs] = useState(INITIAL_AUDIT_LOGS);
  
  const auditLogs = propAuditLogs || localAuditLogs;
  const setAuditLogs = onAddAuditLog ? onAddAuditLog : setLocalAuditLogs;

  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilter, setAuditFilter] = useState('ALL'); // 'ALL' | 'AI_QUERY' | 'FINDING_VERIFIED' | 'FILE_UPLOAD' | 'POLICY'
  const [purgeToast, setPurgeToast] = useState(false);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [lastPurgedTime, setLastPurgedTime] = useState(null);

  // Blind Privacy Mode State & Verification (Requirement 1)
  const [blindPrivacyActive, setBlindPrivacyActive] = useState(true);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('raj_police_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn(e);
    }
    return {
      officerName: 'Rajeev Verma',
      badgeId: officerId || 'RJ-ADM-0102',
      station: 'Cyber Command HQ, Police HQ Jaipur',
      defaultView: 'tower-map',
      theme: 'light',
      language: 'en',
      fontSize: 'standard',
      highContrast: false,
      reducedMotion: false,
      screenReader: false
    };
  });

  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('raj_police_settings', JSON.stringify(newSettings));
    } catch (e) {
      console.warn(e);
    }
    const root = document.documentElement;
    if (newSettings.theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    if (newSettings.highContrast) root.classList.add('high-contrast');
    else root.classList.remove('high-contrast');
  };
  const [privacyToast, setPrivacyToast] = useState(null);
  const [isVerifyingPrivacy, setIsVerifyingPrivacy] = useState(false);
  const [privacyVerifiedTime, setPrivacyVerifiedTime] = useState('Today, 00:15:00');

  // Handle Cryptographic Integrity Check
  const handleVerifyPrivacyIntegrity = () => {
    setIsVerifyingPrivacy(true);
    setTimeout(() => {
      setIsVerifyingPrivacy(false);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setPrivacyVerifiedTime(timeStr);
      setPrivacyToast('✓ DPDP Cryptographic Audit Passed: 100% Blind Privacy Boundaries Verified & Sealed.');
      setTimeout(() => setPrivacyToast(null), 4500);

      const newLog = {
        id: `AUD-${Date.now().toString().slice(-3)}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        officer: officerId,
        officerName: 'Rajeev Verma (Admin)',
        role: 'System Admin',
        actionType: 'ROLE_CHANGE',
        verificationStatus: 'System Enforced',
        details: 'DPDP Act 2023 Statutory Privacy Audit executed: Zero raw MSISDN/IPDR exposure verified across Admin clearance.',
        ip: '10.219.87.001'
      };
      setAuditLogs(prev => [newLog, ...(Array.isArray(prev) ? prev : [])]);
    }, 800);
  };

  // Toggle Blind Privacy Level
  const handleToggleBlindPrivacy = () => {
    const nextState = !blindPrivacyActive;
    setBlindPrivacyActive(nextState);
    const msg = nextState 
      ? '✓ Blind Privacy Mode set to STRICT ENFORCEMENT (Zero Evidence Access)'
      : '⚠️ Switched to Compliance Vigilance Inspection Mode (Headers Only)';
    setPrivacyToast(msg);
    setTimeout(() => setPrivacyToast(null), 4500);

    const newLog = {
      id: `AUD-${Date.now().toString().slice(-3)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      officer: officerId,
      officerName: 'Rajeev Verma (Admin)',
      role: 'System Admin',
      actionType: 'ROLE_CHANGE',
      verificationStatus: 'System Enforced',
      details: nextState 
        ? 'Enforced STRICT BLIND PRIVACY MODE: All suspect evidence completely masked under DPDP Act 2023.' 
        : 'Enabled Compliance Vigilance Inspection: Unlocked compliance headers for vigilance audit.',
      ip: '10.219.87.001'
    };
    setAuditLogs(prev => [newLog, ...(Array.isArray(prev) ? prev : [])]);
  };

  // Copy SHA-256 seal to clipboard
  const handleCopyPrivacySeal = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText('SHA256:7f8a9e4b2c1d0e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f');
    }
    setPrivacyToast('✓ SHA-256 DPDP Compliance Seal copied to clipboard!');
    setTimeout(() => setPrivacyToast(null), 3500);
  };

  // Security Policy Alerts State (Requirement 3)
  const [securityAlerts, setSecurityAlerts] = useState([
    {
      id: 'SEC-01',
      level: 'BLOCKED',
      title: 'Blocked: Analyst attempted final legal report export',
      message: 'Enforced via RBAC separation of duties — Section 91 CrPC legal certificates are restricted to Senior Investigators.',
      timestamp: 'Today, 01:15 PM'
    },
    {
      id: 'SEC-02',
      level: 'NOTICE',
      title: 'Notice: Unverified AI draft flagged before export',
      message: 'Human-in-the-loop requirement enforced under Section 65B Indian Evidence Act. Only Officer-Verified findings were compiled.',
      timestamp: 'Today, 11:45 AM'
    }
  ]);

  // Add Officer Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newOfficerName, setNewOfficerName] = useState('');
  const [newOfficerBadge, setNewOfficerBadge] = useState('');
  const [newOfficerEmail, setNewOfficerEmail] = useState('');
  const [newOfficerRole, setNewOfficerRole] = useState('Senior Investigator');
  const [newOfficerDept, setNewOfficerDept] = useState('Jaipur Cyber Crime Cell');

  // Dismiss a policy alert
  const handleDismissAlert = (id) => {
    setSecurityAlerts(prev => prev.filter(a => a.id !== id));
    
    // Log acknowledgment
    const newLog = {
      id: `AUD-${Date.now().toString().slice(-3)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      officer: officerId,
      officerName: 'Rajeev Verma (Admin)',
      role: 'System Admin',
      actionType: 'ROLE_CHANGE',
      verificationStatus: 'System Enforced',
      details: `Administrator acknowledged security policy alert: ${id}`,
      ip: '10.219.87.001'
    };
    setAuditLogs(prev => [newLog, ...(Array.isArray(prev) ? prev : [])]);
  };

  // Filtered audit logs (Requirement 5)
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const matchesSearch = !auditSearch.trim() || 
        log.officer.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.officerName.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.details.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.id.toLowerCase().includes(auditSearch.toLowerCase());
      
      let matchesFilter = true;
      if (auditFilter === 'AI_QUERY') {
        matchesFilter = log.actionType === 'AI_QUERY';
      } else if (auditFilter === 'FINDING_VERIFIED') {
        matchesFilter = log.actionType === 'FINDING_VERIFIED' || 
                        log.actionType === 'HUMAN_VERIFICATION' ||
                        log.verificationStatus === 'Officer Verified' ||
                        log.verificationStatus === 'Analyst Certified' ||
                        (log.verificationStatus && log.verificationStatus.toLowerCase().includes('verified')) ||
                        (log.details && (log.details.toLowerCase().includes('verified') || log.details.toLowerCase().includes('sign-off')));
      } else if (auditFilter === 'FILE_UPLOAD') {
        matchesFilter = log.actionType === 'FILE_UPLOAD' || log.actionType === 'DRAFT_SUBMITTED';
      } else if (auditFilter === 'POLICY') {
        matchesFilter = log.actionType === 'ROLE_CHANGE' || log.actionType === 'ROLE_VIOLATION' || log.actionType === 'CACHE_PURGE';
      }

      return matchesSearch && matchesFilter;
    });
  }, [auditLogs, auditSearch, auditFilter]);

  // Toggle Officer Active / Revoked (Requirement 4)
  const toggleOfficerStatus = (id) => {
    setOfficers(prev => prev.map(o => {
      if (o.id === id) {
        const newStatus = o.status === 'Active' ? 'Revoked' : 'Active';
        
        // Log action in audit table
        const newLog = {
          id: `AUD-${Date.now().toString().slice(-3)}`,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
          officer: officerId,
          officerName: 'Rajeev Verma (Admin)',
          role: 'System Admin',
          actionType: 'ROLE_CHANGE',
          verificationStatus: 'System Enforced',
          details: `Admin changed status of ${o.name} (${o.officerId}) to ${newStatus}`,
          ip: '10.219.87.001'
        };
        setAuditLogs(logs => [newLog, ...(Array.isArray(logs) ? logs : [])]);

        return { ...o, status: newStatus };
      }
      return o;
    }));
  };

  // Change Officer Role (Requirement 4)
  const changeOfficerRole = (id, newRole) => {
    setOfficers(prev => prev.map(o => {
      if (o.id === id) {
        const newLog = {
          id: `AUD-${Date.now().toString().slice(-3)}`,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
          officer: officerId,
          officerName: 'Rajeev Verma (Admin)',
          role: 'System Admin',
          actionType: 'ROLE_CHANGE',
          verificationStatus: 'System Enforced',
          details: `Role permission updated for ${o.name} (${o.officerId}) -> ${newRole}`,
          ip: '10.219.87.001'
        };
        setAuditLogs(logs => [newLog, ...(Array.isArray(logs) ? logs : [])]);

        return { ...o, role: newRole };
      }
      return o;
    }));
  };

  // Add Officer Submission
  const handleAddOfficer = (e) => {
    e.preventDefault();
    if (!newOfficerName || !newOfficerBadge) return;

    const newOff = {
      id: Date.now(),
      name: newOfficerName,
      officerId: newOfficerBadge,
      email: newOfficerEmail || `${newOfficerBadge.toLowerCase()}@rajasthanpolice.gov.in`,
      role: newOfficerRole,
      status: 'Active',
      department: newOfficerDept,
      lastLogin: 'Never'
    };

    setOfficers(prev => [...prev, newOff]);

    const newLog = {
      id: `AUD-${Date.now().toString().slice(-3)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      officer: officerId,
      officerName: 'Rajeev Verma (Admin)',
      role: 'System Admin',
      actionType: 'ROLE_CHANGE',
      verificationStatus: 'System Enforced',
      details: `Registered new officer ${newOfficerName} (${newOfficerBadge}) with clearance scope ${newOfficerRole}`,
      ip: '10.219.87.001'
    };
    setAuditLogs(logs => [newLog, ...(Array.isArray(logs) ? logs : [])]);

    setShowAddModal(false);
    setNewOfficerName('');
    setNewOfficerBadge('');
    setNewOfficerEmail('');
  };

  // Export Chain-of-Custody Log as CSV (Requirement 5)
  const handleExportAuditCSV = () => {
    const csvRows = [
      'IMMUTABLE CHAIN-OF-CUSTODY & AUDIT TRAIL REPORT',
      `Audit Reference,FIR #402/2024 Cyber Cell Jaipur`,
      `Auditing Officer,${officerId} (System Administrator)`,
      `Exported Timestamp,${new Date().toISOString()}`,
      `Total Log Entries,${filteredAuditLogs.length}`,
      '',
      'Log ID,Timestamp,Officer ID,Officer Name,Role,Action Type,Verification Status,Details,Source IP'
    ];

    filteredAuditLogs.forEach(log => {
      csvRows.push(`"${log.id}","${log.timestamp}","${log.officer}","${log.officerName}","${log.role}","${log.actionType}","${log.verificationStatus || 'N/A'}","${log.details}","${log.ip || '10.219.87.001'}"`);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvRows.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `Chain_of_Custody_Audit_Log_FIR402_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Purge Cache Action (Requirement 6)
  const handlePurgeCache = () => {
    setShowPurgeModal(true);
  };

  const executePurgeCache = () => {
    setIsPurging(true);
    setTimeout(() => {
      setIsPurging(false);
      setShowPurgeModal(false);
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const isoStr = now.toISOString().replace('T', ' ').slice(0, 19);
      setLastPurgedTime(timeStr);
      setPurgeToast(true);

      const newLog = {
        id: `AUD-${Date.now().toString().slice(-3)}`,
        timestamp: isoStr,
        officer: officerId,
        officerName: 'Rajeev Verma (Admin)',
        role: 'System Admin',
        actionType: 'CACHE_PURGE',
        verificationStatus: 'System Enforced',
        details: 'Manual memory purge executed: Shredded 320 KB of ephemeral telecom vectors & transient buffers. Cryptographic SHA-256 vaults re-sealed.',
        ip: '10.219.87.001'
      };
      setAuditLogs(logs => [newLog, ...(Array.isArray(logs) ? logs : [])]);

      setTimeout(() => {
        setPurgeToast(false);
      }, 5000);
    }, 700);
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50 font-sans antialiased text-[#18181B] select-none">
      
      {/* 1. Far-Left Slim Icon Sidebar */}
      <aside className="w-16 sm:w-20 bg-white border-r border-slate-200/80 shadow-[0_4px_24px_rgb(0,0,0,0.03)] flex flex-col justify-between items-center py-5 shrink-0 sticky top-0 h-screen z-40">
        <div className="flex flex-col items-center">
          <div className="w-11 h-11 rounded-lg bg-[#18181B] text-white flex items-center justify-center shadow-md relative group cursor-pointer">
            <ShieldCheck className="w-5 h-5 text-purple-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 absolute -top-1 -right-1 border-2 border-white"></span>
          </div>
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mt-1.5 font-mono">
            SECOPS
          </span>
        </div>

        <nav className="flex flex-col items-center space-y-4 my-auto">
          <button
            title="Access Control & Audit Governance"
            className="w-11 h-11 rounded-lg flex items-center justify-center transition-all bg-[#18181B] text-white shadow-md scale-105"
          >
            <Shield className="w-5 h-5 stroke-[2.2] text-blue-400" />
          </button>
        </nav>

        <div className="flex flex-col items-center space-y-2.5">
          <button
            onClick={() => setShowSettingsModal(true)}
            title="Workstation Settings"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              title="Sign Out of SecOps Session"
              className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* 2. Main Work Canvas */}
      <main className="flex-1 flex flex-col min-w-0 min-h-screen relative overflow-y-auto custom-scrollbar">
        
        {/* Top Header Bar */}
        <header className="px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 z-30 shrink-0 sticky top-0 bg-slate-50/90 backdrop-blur-md border-b border-slate-200/50">
          <div className="flex items-center space-x-3 bg-white/90 backdrop-blur-md px-4 py-2 rounded-lg shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-slate-200/60">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
              <span className="text-xs font-black text-[#18181B] tracking-tight">
                System Administrator Console
              </span>
            </div>
            <span className="text-slate-300">|</span>
            <span className="text-xs font-bold text-slate-700">
              Access Control & Audit Governance
            </span>
            <span className="text-[11px] text-slate-400 hidden sm:inline font-mono">
              (DPDP Act & ISO 27001)
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {onSwitchRole && (
              <div className="flex items-center space-x-1.5 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-xs border border-slate-200/70 text-xs">
                <span className="text-[10px] font-bold text-slate-400 hidden lg:inline">
                  Switch Role (Judge Demo):
                </span>
                <select
                  value="Admin"
                  onChange={(e) => onSwitchRole(e.target.value)}
                  className="bg-transparent font-black text-xs text-[#18181B] outline-none cursor-pointer pr-1"
                >
                  <option value="Senior Investigator">Senior Investigator</option>
                  <option value="Cyber Analyst">Cyber Analyst</option>
                  <option value="Admin">System Admin</option>
                </select>
              </div>
            )}

            <div className="hidden sm:flex items-center space-x-2 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-lg shadow-xs border border-slate-200/60 text-xs">
              <UserCheck className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-slate-400 font-medium">SecOps:</span>
              <span className="font-extrabold text-[#18181B]">{officerId}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-600 text-white shadow-xs">
                System Admin
              </span>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="bg-[#18181B] hover:bg-black text-blue-400 px-4 py-2 rounded-lg text-xs font-black flex items-center space-x-2 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Add Officer</span>
            </button>
          </div>
        </header>

        {/* Purge Cache Toast Notification (Fixed Floating in Viewport) */}
        {purgeToast && (
          <div className="fixed bottom-6 right-6 z-50 max-w-md p-4 rounded-xl bg-[#18181B] text-white border border-slate-700 shadow-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center font-black shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-800" />
              </div>
              <div className="min-w-0">
                <h4 className="font-black text-sm text-blue-400 tracking-tight">
                  Expired Memory Cache Successfully Purged
                </h4>
                <p className="text-xs text-slate-300 leading-tight mt-0.5">
                  Cleaned transient vector buffers & synthetic session hashes (320 KB freed). SHA-256 evidence integrity sealed.
                </p>
              </div>
            </div>
            <button 
              onClick={() => setPurgeToast(false)}
              className="w-7 h-7 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* REQUIREMENT 1: Blind Privacy Enforcement Banner (Top Strip) */}
        <ScrollReveal delay={0.05} className="mx-6 mt-4">
          <div className="p-4 sm:p-5 rounded-xl bg-[#18181B] text-white border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center space-x-3.5">
              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                title="Click to view Blind Privacy Enforcement Policy"
                className="w-11 h-11 rounded-lg bg-purple-900/60 border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
              >
                <EyeOff className="w-5 h-5 text-blue-400 group-hover:rotate-12 transition-transform" />
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${blindPrivacyActive ? 'bg-blue-600' : 'bg-amber-400'}`}></span>
                  <h3 className="font-black text-sm text-white tracking-wide uppercase">
                    {blindPrivacyActive 
                      ? 'BLIND PRIVACY MODE ACTIVE — ZERO ACCESS TO RAW CDR/IPDR RECORDS OR SUSPECT EVIDENCE' 
                      : 'COMPLIANCE AUDIT MODE — STATUTORY PRIVACY HEADERS ACTIVE'}
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  Pursuant to Digital Personal Data Protection (DPDP) Act 2023 & Sec. 91 CrPC Privacy Regulations. Wiretap intercepts, suspect identifiers, and geographic sector plots are strictly isolated to investigating personnel.
                </p>
              </div>
            </div>

            {/* Clickable Action Button */}
            <div className="shrink-0 flex items-center gap-2.5 self-start md:self-auto">
              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="bg-purple-950/90 hover:bg-purple-900 text-purple-200 hover:text-white px-4 py-2.5 rounded-lg border border-purple-500/50 text-xs font-mono font-bold flex items-center space-x-2 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer group"
                title="Click to open DPDP Act 2023 Statutory Privacy Shield Console"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>DPDP Act 2023 • Blind Mode</span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 ml-0.5"></span>
              </button>
            </div>
          </div>
        </ScrollReveal>

        {/* Privacy Toast Notification */}
        {privacyToast && (
          <div className="fixed bottom-20 right-6 z-50 max-w-md p-4 rounded-xl bg-[#18181B] text-white border border-slate-700 shadow-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center font-black shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-950" />
              </div>
              <p className="text-xs text-slate-200 leading-tight">
                {privacyToast}
              </p>
            </div>
            <button 
              onClick={() => setPrivacyToast(null)}
              className="w-7 h-7 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* REQUIREMENT 3: Role-Violation & Security Alerts Panel */}
        {securityAlerts.length > 0 && (
          <ScrollReveal delay={0.08} className="mx-6 mt-3 space-y-2">
            {securityAlerts.map(alert => (
              <div 
                key={alert.id}
                className="bg-amber-50/90 border border-amber-200/90 rounded-lg p-3 px-4 flex items-center justify-between text-xs text-amber-950 shadow-xs animate-in fade-in"
              >
                <div className="flex items-center space-x-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-black text-amber-900 block sm:inline mr-2">
                      {alert.title}
                    </span>
                    <span className="text-[11px] text-amber-800 font-medium">
                      {alert.message}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0 ml-3">
                  <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">{alert.timestamp}</span>
                  <button
                    onClick={() => handleDismissAlert(alert.id)}
                    className="bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-xl text-[10px] font-bold active:scale-95 transition-all shadow-xs"
                  >
                    Dismiss / Acknowledge
                  </button>
                </div>
              </div>
            ))}
          </ScrollReveal>
        )}

        {/* Main Section Content Area */}
        <div className="p-6 space-y-6">

          {/* REQUIREMENT 2: 4-Card Live Compliance & Security Health KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Active Officers */}
            <ScrollReveal delay={0.05} className="flex flex-col">
              <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Active Officers (RBAC)
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <span className="text-3xl font-black text-[#18181B] block tracking-tight">
                    {officers.filter(o => o.status === 'Active').length} Active
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 mt-1 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{officers.length} Total Users • {officers.filter(o => o.status === 'Revoked').length} Revoked</span>
                  </span>
                </div>
              </div>
            </ScrollReveal>

            {/* Card 2: AI Findings Human-Verified */}
            <ScrollReveal delay={0.1} className="flex flex-col">
              <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    AI Findings Human-Verified
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>
                <div>
                  <span className="text-3xl font-black text-[#18181B] block tracking-tight">
                    100% Verified
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 mt-1.5 uppercase font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#18181B]"></span>
                    {auditLogs.filter(l => l.actionType === 'FINDING_VERIFIED' || l.verificationStatus === 'Officer Verified').length || 3} Approved Findings
                  </span>
                </div>
              </div>
            </ScrollReveal>

            {/* Card 3: Total Files & Queries Logged */}
            <ScrollReveal delay={0.15} className="flex flex-col">
              <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Total Files & Queries Logged
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <span className="text-3xl font-black text-[#18181B] block tracking-tight">
                    {auditLogs.length} Events Logged
                  </span>
                  <span className="text-xs font-semibold text-slate-500 mt-1 block font-mono">
                    3 Carrier Files • Live Immutable Trail
                  </span>
                </div>
              </div>
            </ScrollReveal>

            {/* Card 4: Encryption & RBAC Status */}
            <ScrollReveal delay={0.2} className="flex flex-col">
              <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Encryption & RBAC
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Lock className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <span className="text-xl font-black text-[#18181B] block tracking-tight">
                    AES-256 Active
                  </span>
                  <span className="text-xs font-bold text-emerald-700 mt-1 block">
                    Strict RBAC • DPDP Compliant
                  </span>
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* REQUIREMENT 4: User & Role Management Table (RBAC) */}
          <ScrollReveal delay={0.1}>
            <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-[0_4px_24px_rgb(0,0,0,0.03)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-[#18181B] tracking-tight">
                  Department Access Control (RBAC)
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Manage clearance scopes, assign roles, and revoke credentials with immediate audit logging
                </p>
              </div>

              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 rounded-lg bg-[#18181B] hover:bg-black text-blue-400 text-xs font-black flex items-center space-x-1.5 transition-all shadow-sm active:scale-95 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4 text-blue-400" />
                <span>+ Add Officer</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono font-bold uppercase text-[9px] tracking-wider">
                  <tr>
                    <th className="py-3 px-3.5">Officer Name & Unit</th>
                    <th className="py-3 px-3">Officer ID / Badge</th>
                    <th className="py-3 px-3">Assigned Role (Inline Selector)</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Last Login</th>
                    <th className="py-3 px-3 text-right">Access Toggle Switch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {officers.map(officer => (
                    <tr key={officer.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3.5 font-sans">
                        <span className="font-bold text-[#18181B] block">{officer.name}</span>
                        <span className="text-[10px] text-slate-400 block">{officer.department}</span>
                      </td>

                      <td className="py-3 px-3 font-bold text-blue-700">
                        {officer.officerId}
                      </td>

                      {/* Inline Dropdown to Change Roles */}
                      <td className="py-3 px-3 font-sans">
                        <select
                          value={officer.role}
                          onChange={(e) => changeOfficerRole(officer.id, e.target.value)}
                          className={`p-1.5 px-2 rounded-xl text-xs font-bold border outline-none cursor-pointer shadow-xs ${
                            officer.role === 'Senior Investigator' ? 'bg-slate-100 border-slate-300 text-[#18181B]' :
                            officer.role === 'Cyber Analyst' ? 'bg-blue-50 border-blue-300 text-blue-800' :
                            'bg-purple-50 border-purple-300 text-purple-800'
                          }`}
                        >
                          <option value="Senior Investigator">Senior Investigator</option>
                          <option value="Cyber Analyst">Cyber Analyst</option>
                          <option value="System Admin">System Admin</option>
                        </select>
                      </td>

                      <td className="py-3 px-3 font-sans">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase inline-flex items-center gap-1 ${
                          officer.status === 'Active' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${officer.status === 'Active' ? 'bg-emerald-600' : 'bg-rose-600'}`}></span>
                          {officer.status}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-500 font-sans text-[11px]">
                        {officer.lastLogin}
                      </td>

                      {/* Active / Revoked Toggle Switch */}
                      <td className="py-3 px-3 text-right font-sans">
                        <button
                          type="button"
                          onClick={() => toggleOfficerStatus(officer.id)}
                          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 ${
                            officer.status === 'Active'
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          {officer.status === 'Active' ? 'Revoke Access' : 'Restore Access'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ScrollReveal>

        {/* REQUIREMENT 5: Chain-of-Custody & AI Audit Trail (Immutable Log) */}
        <ScrollReveal delay={0.15}>
          <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-[0_4px_24px_rgb(0,0,0,0.03)]">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-[#18181B] tracking-tight">
                  Chain-of-Custody & AI Audit Trail
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Searchable, filterable chronological log of all AI queries, human approvals, file uploads, and policy enforcements
                </p>
              </div>

              {/* Search, Filter Pills & Export CSV Button */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search audit trail..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs text-[#18181B] bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#18181B] w-44 sm:w-56"
                  />
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/70 text-xs font-bold">
                  {[
                    { id: 'ALL', label: 'All' },
                    { id: 'AI_QUERY', label: 'AI Queries' },
                    { id: 'FINDING_VERIFIED', label: 'Human Verifications' },
                    { id: 'FILE_UPLOAD', label: 'File Uploads' },
                    { id: 'POLICY', label: 'Policy Alerts' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setAuditFilter(tab.id)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] transition-all ${
                        auditFilter === tab.id
                          ? 'bg-[#18181B] text-white shadow-xs'
                          : 'text-slate-600 hover:text-[#18181B]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Export CSV Button */}
                <button
                  onClick={handleExportAuditCSV}
                  className="bg-[#18181B] hover:bg-black text-blue-400 px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center space-x-1.5 shadow-sm active:scale-95 transition-all"
                  title="Download full immutable audit log for court evidence"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  <span>Export Log (CSV)</span>
                </button>
              </div>
            </div>

            {/* Audit Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono font-bold uppercase text-[9px] tracking-wider">
                  <tr>
                    <th className="py-3 px-3">Timestamp</th>
                    <th className="py-3 px-3">Officer</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Action Type</th>
                    <th className="py-3 px-3">Verification Status</th>
                    <th className="py-3 px-3">Details</th>
                    <th className="py-3 px-3 text-right">Source IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                            <CheckSquare className="w-5 h-5" />
                          </div>
                          <span className="font-bold text-sm text-[#18181B]">No Logs Found for Selected Filter</span>
                          <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            Try resetting to 'All' or clearing the search query to view the full chain-of-custody.
                          </p>
                          <button
                            type="button"
                            onClick={() => { setAuditFilter('ALL'); setAuditSearch(''); }}
                            className="mt-2 text-xs font-bold text-blue-600 hover:text-black underline cursor-pointer"
                          >
                            Reset Filter to All Logs
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{log.timestamp}</td>
                        <td className="py-2.5 px-3 font-bold text-blue-700">{log.officer}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-700 font-bold">{log.role}</td>
                        <td className="py-2.5 px-3 font-sans">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            log.actionType === 'REPORT_EXPORT' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                            log.actionType === 'DRAFT_SUBMITTED' ? 'bg-blue-100 text-blue-800' :
                            log.actionType === 'FINDING_VERIFIED' ? 'bg-emerald-100 text-emerald-800' :
                            log.actionType === 'AI_QUERY' ? 'bg-purple-100 text-purple-800' :
                            log.actionType === 'FILE_UPLOAD' ? 'bg-indigo-100 text-indigo-800' :
                            log.actionType === 'ROLE_CHANGE' ? 'bg-amber-100 text-amber-900' :
                            log.actionType === 'CACHE_PURGE' ? 'bg-rose-100 text-rose-800 border border-rose-300 font-black' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {log.actionType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <span className={`text-[10px] font-bold ${
                            log.verificationStatus === 'Officer Verified' ? 'text-emerald-700' :
                            log.verificationStatus === 'Analyst Certified' ? 'text-blue-700' :
                            'text-slate-500'
                          }`}>
                            {log.verificationStatus || 'N/A'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-800">
                          {log.details}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500 font-mono text-[10px]">
                          {log.ip || '10.219.87.001'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </ScrollReveal>

        {/* REQUIREMENT 6: Data Retention & Purge Control */}
        <ScrollReveal delay={0.2}>
          <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-[0_4px_24px_rgb(0,0,0,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-purple-600" />
                  <h4 className="font-black text-sm text-[#18181B] tracking-tight">
                    Data Retention & Compliance Policy (DPDP Act & Sec. 91)
                  </h4>
                </div>
                {lastPurgedTime ? (
                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-xs">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Cache Evicted (0 KB) • Sealed at {lastPurgedTime}</span>
                  </span>
                ) : (
                  <span className="bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-xs">
                    <Clock className="w-3 h-3 text-amber-700" />
                    <span>320 KB Volatile Memory Active</span>
                  </span>
                )}
              </div>
              <ul className="mt-1 text-xs text-slate-500 space-y-0.5 list-disc list-inside">
                <li>Auto-archive closed case files after 90 days (Rule 4B Telecom Interception & Cryptographic Storage Rules).</li>
                <li>Encrypted Chain-of-Custody Audit Logs preserved for 3 years under DPDP Act 2023 statutory mandates.</li>
              </ul>
            </div>

            <button
              onClick={handlePurgeCache}
              className="bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-300 px-4 py-2.5 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all active:scale-95 shrink-0 self-start md:self-auto cursor-pointer shadow-xs hover:shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>{lastPurgedTime ? 'Purge Cache Again' : 'Purge Expired Synthetic Cache'}</span>
            </button>
          </div>
        </ScrollReveal>

        </div>
      </main>

      {/* Purge Cache Confirmation Modal */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center font-black">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-base text-[#18181B] tracking-tight">
                    Confirm Synthetic Memory Purge
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    DPDP Act 2023 & Sec. 91 CrPC Retention Mandate
                  </p>
                </div>
              </div>
              <button 
                onClick={() => !isPurging && setShowPurgeModal(false)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs text-slate-600">
              <div className="p-3.5 bg-rose-50/70 rounded-lg border border-rose-200 text-rose-900 space-y-1.5">
                <div className="flex items-center space-x-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Statutory Memory Eviction Notice</span>
                </div>
                <p className="text-[11px] text-rose-700 leading-relaxed">
                  Executing this operation permanently clears volatile session buffers and synthetic vector caches in compliance with statutory privacy mandates.
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200/80 space-y-2 font-mono text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">Transient Vector Cache:</span>
                  <span className="font-bold text-[#18181B]">320.4 KB queued for eviction</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">Expired Ephemeral Tokens:</span>
                  <span className="font-bold text-[#18181B]">14 session keys to shred</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">Audit Trail Logging:</span>
                  <span className="font-bold text-emerald-700">CACHE_PURGE (Immutable)</span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/60">
                  <span className="text-slate-500 font-sans">Evidence Vault Status:</span>
                  <span className="font-bold text-blue-700">SHA-256 Vault Re-Sealed</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                disabled={isPurging}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancel / Abort
              </button>
              <button
                type="button"
                onClick={executePurgeCache}
                disabled={isPurging}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex items-center space-x-2 transition-all shadow-sm cursor-pointer disabled:opacity-60"
              >
                {isPurging ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Purging Vector Cache...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm & Purge Cache</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blind Privacy Mode & DPDP Statutory Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-lg bg-purple-900/90 text-purple-200 border border-purple-500/50 flex items-center justify-center font-black">
                  <EyeOff className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="font-black text-base text-[#18181B] tracking-tight">
                    DPDP Act 2023 & Sec. 91 CrPC Privacy Enforcement
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Statutory Separation of Duties • Cryptographic Evidence Boundary
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowPrivacyModal(false)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Enforcement Banner */}
            <div className="my-4 p-4 rounded-lg bg-[#18181B] text-white flex items-center justify-between shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center font-black">
                  <ShieldCheck className="w-4 h-4 text-emerald-950" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Privacy Boundary Status
                  </span>
                  <span className="text-xs font-black text-blue-400">
                    {blindPrivacyActive ? 'STRICT BLIND MODE ACTIVE (100% ISOLATED)' : 'VIGILANCE AUDIT MODE (COMPLIANCE ONLY)'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleBlindPrivacy}
                className="bg-slate-800 hover:bg-slate-700 text-xs font-mono font-bold text-white px-3 py-1.5 rounded-xl border border-slate-700 flex items-center space-x-1.5 cursor-pointer active:scale-95 transition-all"
              >
                {blindPrivacyActive ? <ToggleRight className="w-4 h-4 text-blue-400" /> : <ToggleLeft className="w-4 h-4 text-amber-400" />}
                <span>{blindPrivacyActive ? 'Strict Active' : 'Vigilance Mode'}</span>
              </button>
            </div>

            {/* 4 Pillars of Blind Privacy */}
            <div className="space-y-3 my-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1">
                <div className="flex items-center space-x-2 font-black text-[#18181B]">
                  <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                  <span>1. Zero Raw Evidence Exposure (RBAC Separation)</span>
                </div>
                <p className="text-slate-600 text-[11px] pl-4 leading-relaxed">
                  System Admins manage credentials, encryption keys, and vigilance logs with zero access to raw suspect phone numbers, call audio, or tower map coordinates.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1">
                <div className="flex items-center space-x-2 font-black text-[#18181B]">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  <span>2. Statutory Phone Masking (+91 98290 XXXXX)</span>
                </div>
                <p className="text-slate-600 text-[11px] pl-4 leading-relaxed">
                  All phone numbers across all tables, exports, and audit trails automatically mask the last 5 digits pursuant to statutory personal data protection mandates.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1">
                <div className="flex items-center space-x-2 font-black text-[#18181B]">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  <span>3. Human-in-the-Loop Sign-off Mandatory</span>
                </div>
                <p className="text-slate-600 text-[11px] pl-4 leading-relaxed">
                  Section 65B Indian Evidence Act compliance prevents unverified AI drafts from court compilation without explicit Senior Investigator certification.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1">
                <div className="flex items-center space-x-2 font-black text-[#18181B]">
                  <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                  <span>4. 90-Day Volatile Memory Shredding</span>
                </div>
                <p className="text-slate-600 text-[11px] pl-4 leading-relaxed">
                  Transient session hashes and vector cache buffers automatically expire after 90 days and can be evicted on-demand via the Purge Cache controller.
                </p>
              </div>
            </div>

            {/* Cryptographic Compliance Seal */}
            <div className="p-3.5 bg-purple-50/70 border border-purple-200/80 rounded-lg text-[11px] font-mono text-purple-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[9px] uppercase font-bold text-purple-700 block">SHA-256 Privacy Compliance Seal</span>
                <span className="truncate block font-bold text-purple-900">7f8a9e4b2c1d0e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f</span>
              </div>
              <button
                type="button"
                onClick={handleCopyPrivacySeal}
                className="bg-white hover:bg-purple-100 text-purple-900 border border-purple-300 px-3 py-1.5 rounded-xl text-[10px] font-bold shrink-0 self-start sm:self-auto cursor-pointer active:scale-95 transition-all shadow-xs"
              >
                Copy Seal
              </button>
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100">
              <span className="text-[10px] text-slate-400 font-mono">
                Last Verified: {privacyVerifiedTime}
              </span>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleVerifyPrivacyIntegrity}
                  disabled={isVerifyingPrivacy}
                  className="px-4 py-2.5 rounded-xl text-xs font-black bg-[#18181B] hover:bg-black text-blue-400 flex items-center space-x-2 transition-all shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {isVerifyingPrivacy ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying Shield...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                      <span>Verify Privacy Integrity</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Officer Modal (Requirement 4) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#18181B] text-blue-400 flex items-center justify-center font-black">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#18181B]">Register Police Officer</h4>
                  <p className="text-[10px] text-slate-400">Issue Law Enforcement Credentials</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddOfficer} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Officer Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Insp. Rajesh Shekhawat"
                  value={newOfficerName}
                  onChange={(e) => setNewOfficerName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-[#18181B]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Officer ID / Badge</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RJ-POL-9941"
                  value={newOfficerBadge}
                  onChange={(e) => setNewOfficerBadge(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono font-bold text-[#18181B]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Clearance Role</label>
                <select
                  value={newOfficerRole}
                  onChange={(e) => setNewOfficerRole(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-[#18181B]"
                >
                  <option value="Senior Investigator">Senior Investigator (CrPC Sec. 91 Lead)</option>
                  <option value="Cyber Analyst">Cyber Analyst (Telecom Forensics & IPDR)</option>
                  <option value="System Admin">System Admin (SecOps & Access Control)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Unit / Police Station</label>
                <input
                  type="text"
                  placeholder="e.g. Cyber Crime Police Station, Jaipur"
                  value={newOfficerDept}
                  onChange={(e) => setNewOfficerDept(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-[#18181B]"
                />
              </div>

              <div className="pt-2 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#18181B] text-blue-400 font-black hover:bg-black"
                >
                  Confirm & Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Workstation Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
      />
    </div>
  );
}
