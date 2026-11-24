import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileDown,
  Shield,
  Search,
  Bell,
  Radio,
  Layers,
  Clock,
  CheckCircle2,
  FileText,
  Printer,
  Share2,
  Calendar,
  AlertTriangle,
  LogOut,
  UserCheck,
  Globe,
  Map as MapIcon,
  UploadCloud,
  LayoutDashboard,
  Bot,
  Settings,
  X,
  Code,
  FileCode,
  Cpu,
  PhoneCall,
  Activity,
  Moon,
  Sun,
  Plus,
  FileSpreadsheet,
  Download,
  CheckSquare,
  Square,
  ShieldCheck,
  ChevronDown,
  Eye,
  Trash2,
  Upload,
  ExternalLink,
  Check,
  FileCheck,
  ArrowRight,
  Zap
} from 'lucide-react';
import TowerTimeline from './visuals/TowerTimeline';
import NetworkGraph from './visuals/NetworkGraph';
import UploadAndStats from './visuals/UploadAndStats';
import HardwareSwapTracker from './visuals/HardwareSwapTracker';
import SuspiciousPatternDetector from './visuals/SuspiciousPatternDetector';
import IPDRCorrelator from './visuals/IPDRCorrelator';
import Section91ReportGenerator from './visuals/Section91ReportGenerator';
import AIChatSidebar from './visuals/AIChatSidebar';
import ScrollReveal from './visuals/ScrollReveal';
import SettingsModal from './visuals/SettingsModal';
import { getTranslation } from '../utils/i18n';
import dummyData from '../dummyData.json';

const TOWER_COORDINATES = {
  'TOW-JPR-014': { lat: 26.9215, lng: 75.7985, name: 'Sindhi Camp Central' },
  'TOW-JPR-029': { lat: 26.9160, lng: 75.8090, name: 'MI Road Commercial' },
  'TOW-JPR-088': { lat: 26.8980, lng: 75.8320, name: 'Raja Park Node' },
  'TOW-JPR-077': { lat: 26.8520, lng: 75.8180, name: 'Malviya Nagar Industrial' },
  'TOW-JPR-112': { lat: 26.8640, lng: 75.7620, name: 'Mansarovar Metro Sector' },
  'TOW-AJM-102': { lat: 26.4690, lng: 74.6390, name: 'Civil Lines Highway' },
};

const DEFAULT_IPDR_DATA = [
  {
    id: 'IPDR-001',
    subscriber: '+91 98290 XXXXX',
    publicIp: '103.21.244.18',
    port: 443,
    timestamp: '2024-11-18 02:18:00',
    appService: 'Telegram Voice / Encrypted',
    cellTowerId: 'TOW-JPR-014',
    cellTowerLocation: 'Sindhi Camp Central, Jaipur',
    sourceFile: 'Carrier_IPDR_SessionLogs.csv',
    rowNumber: 1
  },
  {
    id: 'IPDR-002',
    subscriber: '+91 98290 XXXXX',
    publicIp: '157.240.198.60',
    port: 443,
    timestamp: '2024-11-18 03:50:22',
    appService: 'WhatsApp VoIP Call',
    cellTowerId: 'TOW-JPR-029',
    cellTowerLocation: 'MI Road Commercial Sector, Jaipur',
    sourceFile: 'Carrier_IPDR_SessionLogs.csv',
    rowNumber: 2
  },
  {
    id: 'IPDR-003',
    subscriber: '+91 94140 XXXXX',
    publicIp: '185.199.108.153',
    port: 80,
    timestamp: '2024-11-18 11:20:10',
    appService: 'Tor Relay / Proxy Entry',
    cellTowerId: 'TOW-AJM-102',
    cellTowerLocation: 'Civil Lines Highway Junction, Ajmer',
    sourceFile: 'Carrier_IPDR_SessionLogs.csv',
    rowNumber: 3
  },
  {
    id: 'IPDR-004',
    subscriber: '+91 97841 XXXXX',
    publicIp: '142.250.190.46',
    port: 443,
    timestamp: '2024-11-18 17:05:30',
    appService: 'ProtonMail / Signal Node',
    cellTowerId: 'TOW-JPR-077',
    cellTowerLocation: 'Malviya Nagar Industrial Area, Jaipur',
    sourceFile: 'Carrier_IPDR_SessionLogs.csv',
    rowNumber: 4
  },
  {
    id: 'IPDR-005',
    subscriber: '+91 98299 XXXXX',
    publicIp: '198.51.100.42',
    port: 8443,
    timestamp: '2024-11-18 20:10:00',
    appService: 'DarkWeb Mirror Node',
    cellTowerId: 'TOW-JPR-088',
    cellTowerLocation: 'Raja Park Node, Jaipur',
    sourceFile: 'Carrier_IPDR_SessionLogs.csv',
    rowNumber: 5
  }
];

export default function DashboardLayout({
  userRole = 'Senior Investigator',
  officerId = 'RJ-POL-8821',
  onLogout,
  onSwitchRole,
  draftStatus = 'DRAFT_PENDING',
  onAddAuditLog
}) {
  const [data, setData] = useState(dummyData);
  const [ipdrData, setIpdrData] = useState(DEFAULT_IPDR_DATA);
  const [allRecords, setAllRecords] = useState(dummyData);
  const [normalizedFiles, setNormalizedFiles] = useState([
    { name: 'OperatorA_Airtel_CDR.csv', type: 'CDR (Airtel)', rows: 5, status: 'Verified' },
    { name: 'OperatorB_Jio_CDR.csv', type: 'CDR (Jio)', rows: 5, status: 'Verified' },
    { name: 'Carrier_IPDR_SessionLogs.csv', type: 'IPDR Logs', rows: 5, status: 'Verified' }
  ]);

  // Navigation active view: 'tower-map' | 'network' | 'upload' | 'overview'
  const [activeNav, setActiveNav] = useState('tower-map');
  const [isExporting, setIsExporting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showFilePopover, setShowFilePopover] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [previewFileModal, setPreviewFileModal] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Workstation Settings & Preferences (Personalization, Accessibility, Language, Theme)
  const DEFAULT_SETTINGS = {
    officerName: 'Vikramaditya Rathore',
    badgeId: officerId || 'RJ-POL-8821',
    station: 'Cyber Crime Police Station, Jaipur',
    defaultView: 'tower-map',
    timeFormat: '24h',
    theme: 'light',
    language: 'en',
    fontSize: 'standard',
    highContrast: false,
    reducedMotion: false,
    screenReader: false
  };

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('raj_police_settings');
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {
      console.warn('Failed to parse settings from storage', e);
    }
    return DEFAULT_SETTINGS;
  });

  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const t = (key) => getTranslation(key, settings.language);

  // Sync settings with root HTML classes (Dark mode, High Contrast, Font Scaling, Reduced Motion)
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    if (settings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    root.classList.remove('text-scale-large', 'text-scale-xlarge');
    if (settings.fontSize === 'large') {
      root.classList.add('text-scale-large');
    } else if (settings.fontSize === 'xlarge') {
      root.classList.add('text-scale-xlarge');
    }

    if (settings.reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }
  }, [settings]);

  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('raj_police_settings', JSON.stringify(newSettings));
    } catch (e) {
      console.warn('Failed to save settings to storage', e);
    }
    if (newSettings.defaultView && newSettings.defaultView !== activeNav) {
      setActiveNav(newSettings.defaultView);
    }
    setToastMessage(newSettings.language === 'hi' ? 'सेटिंग्स सफलतापूर्वक लागू की गईं' : 'Workstation preferences applied');
    setTimeout(() => setToastMessage(null), 3000);

    if (onAddAuditLog) {
      onAddAuditLog(prev => [
        {
          id: `AUD-${Date.now().toString().slice(-3)}`,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
          officer: newSettings.badgeId || officerId,
          officerName: newSettings.officerName || 'Vikramaditya Rathore',
          role: userRole,
          actionType: 'SETTINGS_UPDATE',
          verificationStatus: 'System Enforced',
          details: `Workstation settings updated: Theme=${newSettings.theme}, Lang=${newSettings.language}, Contrast=${newSettings.highContrast ? 'ON' : 'OFF'}`,
          ip: '10.219.87.162'
        },
        ...(Array.isArray(prev) ? prev : [])
      ]);
    }
  };

  const fileInputRef = useRef(null);
  const popoverRef = useRef(null);

  // Close evidence popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setShowFilePopover(false);
      }
    }
    if (showFilePopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilePopover]);

  // Dynamic file count indicators
  const cdrCount = useMemo(() => {
    return normalizedFiles.filter(f => 
      f.type?.toLowerCase().includes('cdr') || 
      f.name?.toLowerCase().includes('cdr') ||
      f.type?.toLowerCase().includes('operator')
    ).length;
  }, [normalizedFiles]);

  const ipdrCount = useMemo(() => {
    return normalizedFiles.filter(f => 
      f.type?.toLowerCase().includes('ipdr') || 
      f.name?.toLowerCase().includes('ipdr')
    ).length;
  }, [normalizedFiles]);

  const handleOpenAddFile = (e) => {
    e?.stopPropagation();
    setActiveNav('upload');
    setShowFilePopover(false);
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setActiveNav('upload');
    setShowFilePopover(false);
    setToastMessage(`Opened Ingestion Studio for ${files.length} file(s). Use interactive mapper to seal records.`);
    setTimeout(() => setToastMessage(null), 4000);
    e.target.value = '';
  };

  const handleRemoveFile = (fileName) => {
    if (normalizedFiles.length <= 1) {
      setToastMessage("Cannot remove primary case evidence file. At least 1 file required.");
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    setNormalizedFiles(prev => prev.filter(f => f.name !== fileName));
    setToastMessage(`Removed evidence file '${fileName}'`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAddSampleFile = (type) => {
    const sampleFiles = {
      airtel: { name: 'OperatorA_Airtel_Supplementary_CDR.csv', type: 'CDR (Airtel)', rows: 14, status: 'Verified' },
      jio: { name: 'OperatorB_Jio_Supplementary_CDR.csv', type: 'CDR (Jio)', rows: 18, status: 'Verified' },
      ipdr: { name: 'Carrier_IPDR_Secondary_Packets.csv', type: 'IPDR Logs', rows: 22, status: 'Verified' },
      vi: { name: 'OperatorC_Vi_Cellular_CDR.csv', type: 'CDR (Vodafone Idea)', rows: 12, status: 'Verified' }
    };

    const target = sampleFiles[type] || sampleFiles.airtel;
    if (normalizedFiles.some(f => f.name === target.name)) {
      setToastMessage(`File '${target.name}' is already attached.`);
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    setNormalizedFiles(prev => [target, ...prev]);
    setShowQuickAddModal(false);
    setShowFilePopover(true);
    setToastMessage(`Attached supplementary evidence '${target.name}'`);
    setTimeout(() => setToastMessage(null), 3500);

    if (onAddAuditLog) {
      onAddAuditLog({
        actionType: 'FILE_UPLOAD',
        details: `Loaded Supplementary File '${target.name}' to Case #RJ-2024-9102`,
        verificationStatus: 'Officer Verified'
      });
    }
  };

  // Anomaly Filter Pills: 'ALL' | 'NIGHT' | 'IMEI' | 'IPDR'
  const [activeFilter, setActiveFilter] = useState('ALL');

  // Floating AI Chat Panel State
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiFocusRecord, setAiFocusRecord] = useState(null);
  const [aiInitialPrompt, setAiInitialPrompt] = useState('');

  // Officer-Verified AI Findings for inclusion in report
  const [verifiedFindings, setVerifiedFindings] = useState([
    {
      id: 1,
      title: 'Malviya Nagar Hardware Switch (IMEI Swap)',
      citation: 'OperatorA_Airtel_CDR.csv#L3',
      timestamp: '2024-11-18 08:30:15',
      finding: 'Suspect Alpha switched from IMEI 860432049102481 to 358924081290455 at TOW-JPR-077 while maintaining continuous SIM identity.',
      verified: true,
      verifiedBy: officerId,
      verifiedAt: '11:43 PM'
    },
    {
      id: 2,
      title: 'Midnight Encrypted VoIP & Packet Jumps',
      citation: 'Carrier_IPDR_SessionLogs.csv#L1-L2',
      timestamp: '2024-11-18 02:18:00',
      finding: 'Outbound Telegram Voice (103.21.244.18) & WhatsApp VoIP (157.240.198.60) sessions correlate directly with 02:14 AM and 03:45 AM transit calls.',
      verified: true,
      verifiedBy: officerId,
      verifiedAt: '11:44 PM'
    }
  ]);

  // Raw Record Modal State
  const [rawRecordModal, setRawRecordModal] = useState(null);

  const handleDataNormalized = ({ combined, cdr, ipdr, files }) => {
    if (cdr && cdr.length > 0) setData(cdr);
    if (ipdr && ipdr.length > 0) setIpdrData(ipdr);
    if (files && files.length > 0) setNormalizedFiles(files);
    if (combined && combined.length > 0) setAllRecords(combined);
  };

  const handleExportPDF = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setShowReportModal(true);
    }, 450);

    if (onAddAuditLog) {
      const newLog = {
        id: `AUD-${Date.now().toString().slice(-3)}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        officer: officerId,
        officerName: 'Vikramaditya Rathore',
        role: 'Senior Investigator',
        actionType: 'REPORT_EXPORT',
        verificationStatus: 'Officer Verified',
        details: 'Exported Section 91 CrPC Official Dossier (FIR #402/2024) - SHA256 sealed with Officer Verification',
        ip: '10.219.87.162'
      };
      onAddAuditLog(prev => [newLog, ...(Array.isArray(prev) ? prev : [])]);
    }
  };

  const handleDownloadCSV = () => {
    const caseBriefLines = [
      'CASE DIARY BRIEF & FORENSIC CERTIFICATE (SEC. 65B EVIDENCE ACT)',
      `Case ID,RJ-2024-9102`,
      `FIR Reference,402/2024 Cyber Cell Jaipur`,
      `Investigating Officer,${officerId} (${userRole})`,
      `Date Generated,${new Date().toLocaleString()}`,
      `Loaded Evidence Files,${normalizedFiles.map(f => f.name).join(' | ')}`,
      '',
      '--- COMMUNICATION METRICS ---',
      `Total Calls Analyzed,5420`,
      `Total Duration,142.8 hours`,
      `In/Out Ratio,62% Incoming / 38% Outgoing`,
      `Night-Time Voice Calls (00:00-05:00),4 Records`,
      `IMEI Hardware Swaps Detected,2 Incidents`,
      '',
      '--- OFFICER-VERIFIED AI FORENSIC FINDINGS ---',
      'Finding Title,Evidence Citation,Timestamp,Certified Analysis,Officer Verification Status'
    ];

    verifiedFindings.filter(f => f.verified).forEach(f => {
      caseBriefLines.push(`"${f.title}","${f.citation}","${f.timestamp}","${f.finding}","APPROVED BY ${f.verifiedBy} AT ${f.verifiedAt}"`);
    });

    caseBriefLines.push('');
    caseBriefLines.push('--- RELEVANT CDR TIMELINE RECORDS ---');
    caseBriefLines.push('Record ID,Caller (A-Party),Receiver (B-Party),Timestamp,Duration Sec,Tower ID,IMEI,Status');

    data.forEach(d => {
      caseBriefLines.push(`"${d.id}","${d.caller}","${d.receiver}","${d.timestamp}",${d.duration},"${d.cellTowerId}","${d.imei}","${d.imeiChange ? 'IMEI_SWAP' : d.isNightAlert ? 'NIGHT_CALL' : 'NORMAL'}"`);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(caseBriefLines.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `Forensic_Brief_FIR402_RJ2024_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (onAddAuditLog) {
      const newLog = {
        id: `AUD-${Date.now().toString().slice(-3)}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        officer: officerId,
        officerName: 'Vikramaditya Rathore',
        role: 'Senior Investigator',
        actionType: 'REPORT_EXPORT',
        verificationStatus: 'Officer Verified',
        details: 'Downloaded Official Forensic Brief (.csv) for court filing under Sec. 65B Indian Evidence Act',
        ip: '10.219.87.162'
      };
      onAddAuditLog(prev => [newLog, ...(Array.isArray(prev) ? prev : [])]);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleAskAI = (param) => {
    if (param && param.prompt) {
      setAiInitialPrompt(param.prompt);
    } else if (param && param.item) {
      setAiFocusRecord(param.item);
    } else {
      setAiFocusRecord(param);
    }
    setAiChatOpen(true);

    if (onAddAuditLog) {
      const queryPrompt = (param && param.prompt) || (param && param.item && `Inspect hop #${param.item.sequenceNum} at ${param.item.coord?.name}`) || 'General Forensics Query';
      const newLog = {
        id: `AUD-${Date.now().toString().slice(-3)}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        officer: officerId,
        officerName: 'Vikramaditya Rathore',
        role: 'Senior Investigator',
        actionType: 'AI_QUERY',
        verificationStatus: 'Officer Verified',
        details: `AI Query: "${queryPrompt.slice(0, 65)}..."`,
        ip: '10.219.87.162'
      };
      onAddAuditLog(prev => [newLog, ...(Array.isArray(prev) ? prev : [])]);
    }
  };

  const handleViewRawRow = (record) => {
    setRawRecordModal(record);
  };

  const handleVerifyFindingUpdate = (msg) => {
    if (msg.verified) {
      const newFinding = {
        id: msg.id,
        title: msg.citations[0]?.label || 'Intelligence Finding',
        citation: msg.citations[0] ? `${msg.citations[0].file}#L${msg.citations[0].row}` : 'Case Logs',
        timestamp: msg.citations[0]?.timestamp || new Date().toLocaleTimeString(),
        finding: msg.text.slice(0, 150) + '...',
        verified: true,
        verifiedBy: officerId,
        verifiedAt: msg.verifiedTime || new Date().toLocaleTimeString()
      };
      setVerifiedFindings(prev => {
        const exists = prev.find(p => p.id === msg.id);
        if (exists) return prev.map(p => p.id === msg.id ? newFinding : p);
        return [...prev, newFinding];
      });

      if (onAddAuditLog) {
        const newLog = {
          id: `AUD-${Date.now().toString().slice(-3)}`,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
          officer: officerId,
          officerName: 'Vikramaditya Rathore',
          role: 'Senior Investigator',
          actionType: 'FINDING_VERIFIED',
          verificationStatus: 'Officer Verified',
          details: `Human-in-the-Loop Sign-off: Certified finding "${newFinding.title}" (${newFinding.citation})`,
          ip: '10.219.87.162'
        };
        onAddAuditLog(prev => [newLog, ...(Array.isArray(prev) ? prev : [])]);
      }
    } else {
      setVerifiedFindings(prev => prev.filter(p => p.id !== msg.id));
    }
  };

  // KPI calculations
  const totalCallsCount = 5420;
  const totalDurationHrs = '142.8';
  const incomingRatio = 62;
  const outgoingRatio = 38;
  const nightCallsCount = 4;
  const imeiSwapsCount = 2;

  return (
    <div className="flex min-h-screen w-full bg-slate-50 font-sans antialiased text-slate-900 select-none">

      {/* 1. Far-Left Slim Icon Sidebar */}
      <aside className="w-16 sm:w-20 bg-white border-r border-slate-200 shadow-xs flex flex-col justify-between items-center py-5 shrink-0 sticky top-0 h-screen z-40">

        {/* Top: App Logo */}
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs relative group cursor-pointer">
            <Shield className="w-5 h-5 text-blue-400" />
            <span className="w-2 h-2 rounded-full bg-emerald-500 absolute -top-0.5 -right-0.5 border-2 border-white"></span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-1.5 font-mono">
            RJ-POL
          </span>
        </div>

        {/* Center: Navigation Icons */}
        <nav className="flex flex-col items-center space-y-3 my-auto">
          {/* Tower Map View */}
          <button
            onClick={() => setActiveNav('tower-map')}
            title={t('nav_tower')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${activeNav === 'tower-map'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <MapIcon className="w-5 h-5" />
          </button>

          {/* Network Graph */}
          <button
            onClick={() => setActiveNav('network')}
            title={t('nav_network')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${activeNav === 'network'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <Share2 className="w-5 h-5" />
          </button>

          {/* Multi-SIM & Hardware Swap Tracker */}
          <button
            onClick={() => setActiveNav('hardware')}
            title={t('nav_hardware')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${activeNav === 'hardware'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <Cpu className="w-5 h-5" />
          </button>

          {/* Suspicious Pattern Detection (Night-Time, Bursts, Pings) */}
          <button
            onClick={() => setActiveNav('patterns')}
            title="Suspicious Pattern Detection (Night-Time, Bursts, Pings)"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${activeNav === 'patterns'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100'
              }`}
          >
            <Zap className="w-5 h-5" />
          </button>

          {/* Integrated IPDR & VoIP Session Correlator */}
          <button
            onClick={() => setActiveNav('ipdr')}
            title="Integrated IPDR & VoIP Session Correlator"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${activeNav === 'ipdr'
              ? 'bg-cyan-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-cyan-500 hover:bg-slate-100'
              }`}
          >
            <Globe className="w-5 h-5" />
          </button>

          {/* Section 91 CrPC & Evidence Certificate Reports */}
          <button
            onClick={() => setActiveNav('reports')}
            title="Section 91 CrPC & Evidence Certificate Reports"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${activeNav === 'reports'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-400 hover:text-emerald-500 hover:bg-slate-100'
              }`}
          >
            <FileCheck className="w-5 h-5" />
          </button>

          {/* Upload CDR/IPDR */}
          <button
            onClick={() => setActiveNav('upload')}
            title={t('nav_ingest')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${activeNav === 'upload'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <UploadCloud className="w-5 h-5" />
          </button>

          {/* Dashboard Overview */}
          <button
            onClick={() => setActiveNav('overview')}
            title={t('nav_overview')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${activeNav === 'overview'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <LayoutDashboard className="w-5 h-5" />
          </button>

          {/* AI Assistant Button */}
          <button
            onClick={() => setAiChatOpen(!aiChatOpen)}
            title={t('nav_ai')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors relative ${aiChatOpen
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <Bot className="w-5 h-5" />
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 absolute top-2 right-2"></span>
          </button>
        </nav>

        {/* Bottom: Settings & Logout */}
        <div className="flex flex-col items-center space-y-2.5">
          <button
            onClick={() => setShowSettingsModal(true)}
            title={t('nav_settings')}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors relative group"
          >
            <Settings className="w-4 h-4" />
            {settings.theme === 'dark' && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 absolute top-1 right-1" />
            )}
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              title={t('nav_logout')}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* 2. Main Scrollable Content Canvas */}
      <main className="flex-1 flex flex-col min-w-0 min-h-screen relative overflow-y-auto custom-scrollbar">

        {/* Top Sticky Header Bar */}
        <header className="px-5 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 z-30 shrink-0 sticky top-0 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200">

          {/* Left: Case Info & Loaded Case Files Badge */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Case Details */}
            <div className="flex items-center space-x-2.5 bg-white px-3 py-1.5 rounded-lg shadow-xs border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-semibold text-slate-900 tracking-tight">
                {t('case_ref')}
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                {t('fir_ref')}
              </span>
            </div>

            {/* Analyst Handoff Status Tag */}
            {draftStatus === 'ANALYST_VERIFIED' && (
              <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Analyst Draft Received (RJ-CYB-4091)</span>
              </span>
            )}

            {/* REQUIREMENT 1: Loaded Case Files Badge with '+ Add File' Button */}
            <div className="relative" ref={popoverRef}>
              <div className="flex items-center bg-white rounded-lg shadow-xs border border-slate-200">
                {/* Left Part: Clickable Files Popover Trigger */}
                <button
                  type="button"
                  onClick={() => setShowFilePopover(prev => !prev)}
                  className="flex items-center space-x-2 pl-3 pr-2.5 py-1.5 rounded-l-lg hover:bg-slate-50 transition-colors cursor-pointer text-left focus:outline-none select-none"
                  title="Click to view loaded evidence files"
                  aria-expanded={showFilePopover}
                  aria-haspopup="true"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                  <span className="text-xs font-medium text-slate-900 whitespace-nowrap">
                    {normalizedFiles.length} {t('verified_files')}
                  </span>
                  <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-mono whitespace-nowrap">
                    {cdrCount} CDR / {ipdrCount} IPDR
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                      showFilePopover ? 'rotate-180 text-slate-900' : ''
                    }`}
                  />
                </button>

                {/* Divider */}
                <span className="h-4 w-px bg-slate-200 mx-0.5"></span>

                {/* Right Part: '+ Add File' Action Button */}
                <button
                  type="button"
                  onClick={handleOpenAddFile}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-1 rounded-md text-[10px] font-semibold flex items-center space-x-1 shadow-xs transition-colors cursor-pointer mr-1 ml-0.5 whitespace-nowrap"
                  title="Upload additional carrier CDR or IPDR evidence file"
                >
                  <Plus className="w-3 h-3 text-white" />
                  <span>{t('add_file')}</span>
                </button>
              </div>

              {/* Hidden Native File Input (Triggers OS File Explorer) */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                accept=".csv,.xlsx,.txt"
                multiple
                className="hidden"
              />

              {/* Rich Dropdown File Popover */}
              {showFilePopover && (
                <div className="absolute top-full left-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-slate-200 p-4 z-[60] animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <span className="text-xs font-semibold text-slate-900 tracking-tight">
                        Case Evidence Files ({normalizedFiles.length})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowFilePopover(false)}
                      className="w-5 h-5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-800 flex items-center justify-center transition-colors text-xs"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Files List */}
                  <div className="space-y-1.5 my-3 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                    {normalizedFiles.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100/70 border border-slate-200 transition-colors group"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                          <div className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            {f.type?.includes('IPDR') ? (
                              <Globe className="w-3.5 h-3.5" />
                            ) : (
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-medium text-slate-900 truncate">{f.name}</p>
                            <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 font-mono">
                              <span>{f.type}</span>
                              <span>•</span>
                              <span>{f.rows || 5} records</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1 shrink-0 ml-2">
                          <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200 font-medium">
                            {f.status || 'Verified'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPreviewFileModal(f)}
                            title="Preview File Records"
                            className="w-6 h-6 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {normalizedFiles.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(f.name)}
                              title="Detach from Case"
                              className="w-6 h-6 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Popover Actions */}
                  <div className="pt-2.5 border-t border-slate-100 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleOpenAddFile}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 text-white" />
                        <span>Upload Evidence File</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowQuickAddModal(true);
                          setShowFilePopover(false);
                        }}
                        className="py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium flex items-center justify-center space-x-1 transition-colors"
                        title="Add Demo Carrier Datasets"
                      >
                        <Layers className="w-3.5 h-3.5 text-slate-600" />
                        <span>Samples</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveNav('upload');
                        setShowFilePopover(false);
                      }}
                      className="w-full text-center py-1 text-[10px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
                    >
                      Open Ingestion & Normalization Studio →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Header Badges & Actions */}
          <div className="flex items-center space-x-2">
            {/* Quick Dark/Light Mode Switcher */}
            <button
              type="button"
              onClick={() => handleSaveSettings({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' })}
              title={settings.theme === 'dark' ? "Switch to Light Mode (दिन)" : "Switch to Dark Mode (रात)"}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors shadow-xs flex items-center justify-center"
            >
              {settings.theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-slate-700" />
              )}
            </button>

            {/* Quick Language Switcher */}
            <button
              type="button"
              onClick={() => handleSaveSettings({ ...settings, language: settings.language === 'en' ? 'hi' : 'en' })}
              title={settings.language === 'en' ? "हिंदी में बदलें (Switch to Hindi)" : "Switch to English (अंग्रेज़ी)"}
              className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors shadow-xs flex items-center space-x-1 text-xs font-semibold"
            >
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>{settings.language === 'en' ? 'हिं' : 'EN'}</span>
            </button>

            {/* Workstation Settings Modal Trigger */}
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              title={t('nav_settings')}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors shadow-xs flex items-center justify-center"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            {/* Quick Demo Role Switcher for Judges */}
            {onSwitchRole && (
              <div className="flex items-center space-x-1.5 bg-white px-3 py-1.5 rounded-lg shadow-xs border border-slate-200 text-xs">
                <span className="text-[10px] font-medium text-slate-400 hidden lg:inline">
                  Switch Role:
                </span>
                <select
                  value="Senior Investigator"
                  onChange={(e) => onSwitchRole(e.target.value)}
                  className="bg-transparent font-semibold text-xs text-slate-900 outline-none cursor-pointer pr-1"
                >
                  <option value="Senior Investigator">Senior Investigator</option>
                  <option value="Cyber Analyst">Cyber Analyst</option>
                  <option value="Admin">System Admin</option>
                </select>
              </div>
            )}

            {/* Officer Role Badge */}
            <div className="hidden sm:flex items-center space-x-1.5 bg-white px-3 py-1.5 rounded-lg shadow-xs border border-slate-200 text-xs">
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-slate-400 font-normal">Lead:</span>
              <span className="font-semibold text-slate-900">{settings.badgeId || officerId}</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-slate-900 text-white flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Senior
              </span>
            </div>

            {/* REQUIREMENT 1: Primary 'Export Officer-Verified Report (PDF / Excel)' Button */}
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-2 shadow-xs transition-colors"
            >
              {isExporting ? (
                <>
                  <Clock className="w-3.5 h-3.5 animate-spin text-slate-300" />
                  <span>Compiling Brief...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5 text-slate-300" />
                  <span>{t('export_pdf')}</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Dynamic Content Views & KPI Strip */}
        <div className="flex-1 p-4 sm:p-6 pt-3 relative flex flex-col pb-8">

          {/* Communication Pattern Summary KPI Strip */}
          <div className="mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

              {/* Card 1: Total Calls & Duration */}
              <ScrollReveal delay={0.05} className="flex flex-col">
                <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between h-full">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Total Calls & Airtime</span>
                    <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-700">
                      <PhoneCall className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight font-mono">
                      {totalCallsCount.toLocaleString()} Calls
                    </h3>
                    <p className="text-[11px] font-mono text-slate-500">
                      {totalDurationHrs} hrs • 3 Feeds
                    </p>
                  </div>
                </div>
              </ScrollReveal>

              {/* Card 2: Incoming vs Outgoing Ratio */}
              <ScrollReveal delay={0.1} className="flex flex-col">
                <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between h-full">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider">In / Out Ratio</span>
                    <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-blue-600">
                      <Activity className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between mb-1.5 text-xs font-semibold text-slate-900 font-mono">
                      <span>{incomingRatio}% In</span>
                      <span>{outgoingRatio}% Out</span>
                    </div>
                    {/* Clean progress bar */}
                    <div className="w-full h-1.5 rounded-full bg-slate-100 flex overflow-hidden">
                      <div style={{ width: `${incomingRatio}%` }} className="bg-blue-600" title="62% Incoming"></div>
                      <div style={{ width: `${outgoingRatio}%` }} className="bg-slate-700" title="38% Outgoing"></div>
                    </div>
                  </div>
                </div>
              </ScrollReveal>

              {/* Card 3: First & Last Communication */}
              <ScrollReveal delay={0.15} className="flex flex-col">
                <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between h-full">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Timeline Window</span>
                    <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-700">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900 truncate font-mono">
                      18 Nov 02:14 ➔ 19 Nov 14:52
                    </h3>
                    <p className="text-[11px] font-mono text-slate-400">
                      36.6h Timeline Span
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>

          {/* VIEW 1: Tower Map Dashboard (The Centerpiece) */}
          {activeNav === 'tower-map' && (
            <ScrollReveal delay={0.1} className="flex-1 w-full relative">
              <TowerTimeline
                data={data}
                ipdrData={ipdrData}
                activeFilter={activeFilter}
                onAskAI={handleAskAI}
                onViewRawRow={handleViewRawRow}
              />
            </ScrollReveal>
          )}

          {/* VIEW 2: Network Graph View */}
          {activeNav === 'network' && (
            <ScrollReveal delay={0.1} className="flex-1 overflow-y-auto space-y-4">
              <NetworkGraph
                data={data}
                activeFilter={activeFilter}
                onAskAI={handleAskAI}
              />
            </ScrollReveal>
          )}

          {/* VIEW 3: Multi-SIM & Hardware Swap Tracker */}
          {activeNav === 'hardware' && (
            <ScrollReveal delay={0.1} className="flex-1 overflow-y-auto space-y-4">
              <HardwareSwapTracker
                data={data}
                onAskAI={handleAskAI}
                onViewRawRow={handleViewRawRow}
                onVerifyFinding={handleVerifyFindingUpdate}
              />
            </ScrollReveal>
          )}

          {/* VIEW: Suspicious Pattern Detection (Night-Time, Bursts, Pings) */}
          {activeNav === 'patterns' && (
            <ScrollReveal delay={0.1} className="flex-1 overflow-y-auto space-y-4">
              <SuspiciousPatternDetector
                data={data}
                activeFilter={activeFilter}
                onAskAI={handleAskAI}
                onViewRawRow={handleViewRawRow}
              />
            </ScrollReveal>
          )}

          {/* VIEW: Integrated IPDR & VoIP Session Correlator */}
          {activeNav === 'ipdr' && (
            <ScrollReveal delay={0.1} className="flex-1 overflow-y-auto space-y-4">
              <IPDRCorrelator
                data={data}
                ipdrData={ipdrData}
                activeFilter={activeFilter}
                onAskAI={handleAskAI}
                onViewRawRow={handleViewRawRow}
              />
            </ScrollReveal>
          )}

          {/* VIEW: Section 91 CrPC & Evidence Certificate Reports */}
          {activeNav === 'reports' && (
            <ScrollReveal delay={0.1} className="flex-1 overflow-y-auto space-y-4">
              <Section91ReportGenerator
                data={data}
                ipdrData={ipdrData}
                onAskAI={handleAskAI}
                activeCaseId={1}
              />
            </ScrollReveal>
          )}

          {/* VIEW 4: Multi-Carrier Upload & Ingestion View */}
          {activeNav === 'upload' && (
            <ScrollReveal delay={0.1} className="flex-1 overflow-y-auto space-y-4">
              <UploadAndStats data={data} onDataNormalized={handleDataNormalized} onNavigateTab={setActiveNav} />
            </ScrollReveal>
          )}

          {/* VIEW 5: Overview (All Panels) */}
          {activeNav === 'overview' && (
            <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2">
              <ScrollReveal delay={0.05}>
                <UploadAndStats data={data} onDataNormalized={handleDataNormalized} onNavigateTab={setActiveNav} />
              </ScrollReveal>
              <ScrollReveal delay={0.08}>
                <HardwareSwapTracker
                  data={data}
                  onAskAI={handleAskAI}
                  onViewRawRow={handleViewRawRow}
                  onVerifyFinding={handleVerifyFindingUpdate}
                />
              </ScrollReveal>
              <ScrollReveal delay={0.09}>
                <SuspiciousPatternDetector
                  data={data}
                  activeFilter={activeFilter}
                  onAskAI={handleAskAI}
                  onViewRawRow={handleViewRawRow}
                />
              </ScrollReveal>
              <ScrollReveal delay={0.095}>
                <IPDRCorrelator
                  data={data}
                  ipdrData={ipdrData}
                  activeFilter={activeFilter}
                  onAskAI={handleAskAI}
                  onViewRawRow={handleViewRawRow}
                />
              </ScrollReveal>
              <ScrollReveal delay={0.098}>
                <Section91ReportGenerator
                  data={data}
                  ipdrData={ipdrData}
                  onAskAI={handleAskAI}
                  activeCaseId={1}
                />
              </ScrollReveal>
              <ScrollReveal delay={0.1}>
                <NetworkGraph
                  data={data}
                  activeFilter={activeFilter}
                  onAskAI={handleAskAI}
                />
              </ScrollReveal>
              <ScrollReveal delay={0.15} className="h-[650px] w-full">
                <TowerTimeline
                  data={data}
                  ipdrData={ipdrData}
                  activeFilter={activeFilter}
                  onAskAI={handleAskAI}
                  onViewRawRow={handleViewRawRow}
                />
              </ScrollReveal>
            </div>
          )}
        </div>

        {/* 3. Floating AI Assistant Drawer */}
        {aiChatOpen && (
          <div className="absolute top-3 right-3 bottom-3 w-96 max-w-[calc(100vw-1.5rem)] z-50 animate-in slide-in-from-right-8 duration-200">
            <div className="relative h-full shadow-lg rounded-xl overflow-hidden border border-slate-200">
              <AIChatSidebar
                data={data}
                ipdrData={ipdrData}
                focusRecord={aiFocusRecord}
                initialPrompt={aiInitialPrompt}
                officerId={officerId}
                verifiedFindings={verifiedFindings}
                onVerifyFinding={handleVerifyFindingUpdate}
                onClose={() => setAiChatOpen(false)}
                onCiteClick={(cite) => {
                  const matched = data.find(d => d.cellTowerId === cite.tower || (cite.row && d.id.includes(cite.row)));
                  if (matched) {
                    setRawRecordModal(matched);
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* 4. Raw CDR Record Inspector Modal */}
        {rawRecordModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-xl w-full p-5 shadow-lg border border-slate-200 animate-in zoom-in-95">
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-lg bg-slate-100 text-slate-900">
                    <FileCode className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm">
                      Raw Forensic Evidence Row
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      Ref: {rawRecordModal.evidenceId || rawRecordModal.id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setRawRecordModal(null)}
                  className="w-7 h-7 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-800 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {rawRecordModal.cellTowerId && TOWER_COORDINATES[rawRecordModal.cellTowerId] && (
                <div className="mt-3.5 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 flex items-center justify-between font-mono">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-slate-900"></span>
                    <span className="font-semibold text-slate-900">{TOWER_COORDINATES[rawRecordModal.cellTowerId].name}</span>
                    <span className="text-slate-400">({rawRecordModal.cellTowerId})</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">{TOWER_COORDINATES[rawRecordModal.cellTowerId].lat}° N, {TOWER_COORDINATES[rawRecordModal.cellTowerId].lng}° E</span>
                </div>
              )}

              <div className="mt-3.5 p-3.5 bg-slate-50 rounded-lg font-mono text-xs text-slate-700 space-y-2 border border-slate-200 overflow-x-auto max-h-80">
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-400">Source File:</span>
                  <span className="font-semibold text-slate-900">{rawRecordModal.sourceFile || 'OperatorA_Airtel_CDR.csv'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-400">Row Number:</span>
                  <span className="font-semibold">{rawRecordModal.rowNumber || 3}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-400">A-Party (Caller):</span>
                  <span className="font-semibold text-blue-700">{rawRecordModal.caller}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-400">B-Party (Receiver):</span>
                  <span className="font-semibold text-blue-700">{rawRecordModal.receiver}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-400">Timestamp:</span>
                  <span>{rawRecordModal.timestamp}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-400">Duration (Sec):</span>
                  <span>{rawRecordModal.duration}s</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-400">Cell Tower ID:</span>
                  <span className="font-semibold">{rawRecordModal.cellTowerId}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-400">Device Hardware IMEI:</span>
                  <span className={`font-semibold ${rawRecordModal.imeiChange ? 'text-rose-600' : 'text-slate-800'}`}>
                    {rawRecordModal.imei} {rawRecordModal.imeiChange ? '(SWAP DETECTED)' : ''}
                  </span>
                </div>
                {rawRecordModal.notes && (
                  <div className="pt-2 text-rose-700 text-[11px] font-sans">
                    <strong>Investigator Note:</strong> {rawRecordModal.notes}
                  </div>
                )}
              </div>

              <div className="mt-4 flex justify-end space-x-2">
                <button
                  onClick={() => {
                    handleAskAI(rawRecordModal);
                    setRawRecordModal(null);
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-lg flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Analyze in AI Assistant</span>
                </button>
                <button
                  onClick={() => setRawRecordModal(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs px-3.5 py-1.5 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. Official Case Dossier Export Modal (Officer-Verified Findings) */}
        {showReportModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-3xl w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">

              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-slate-900 text-white">
                    <Shield className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      Rajasthan Police Cyber Cell • Official Case Dossier
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Sec. 65B Indian Evidence Act Compliance • FIR #402/2024
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="w-7 h-7 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-800 flex items-center justify-center font-medium"
                >
                  ✕
                </button>
              </div>

              {/* Dossier Content */}
              <div className="bg-slate-50 rounded-lg p-4 text-xs space-y-3.5 font-mono border border-slate-200">
                {/* Case Meta Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-3 border-b border-slate-200">
                  <div><span className="text-slate-400 block text-[10px]">CASE ID</span><strong>RJ-2024-9102</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">TARGET MSISDN</span><strong className="text-blue-700 font-mono">+91 98290 XXXXX</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">LEAD OFFICER</span><strong>{officerId} ({userRole})</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">DATE GENERATED</span><strong>{new Date().toLocaleDateString()}</strong></div>
                </div>

                {/* Evidence Files Summary */}
                <div className="pb-3 border-b border-slate-200">
                  <span className="font-semibold text-slate-800 uppercase text-[10px] block mb-1">
                    VERIFIED INGESTED EVIDENCE (HASH INTEGRITY PASS):
                  </span>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200 font-medium text-slate-700">
                      OperatorA_Airtel_CDR.csv (SHA-256 Match)
                    </span>
                    <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200 font-medium text-slate-700">
                      OperatorB_Jio_CDR.csv (SHA-256 Match)
                    </span>
                    <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200 font-medium text-slate-700">
                      Carrier_IPDR_SessionLogs.csv (SHA-256 Match)
                    </span>
                  </div>
                </div>

                {/* Communication Pattern Statistics */}
                <div className="pb-3 border-b border-slate-200 space-y-1.5">
                  <span className="font-semibold text-slate-800 uppercase text-[10px] block">
                    TELECOMMUNICATION METRICS & PATTERN SUMMARY:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="bg-white p-2 rounded-md border border-slate-200">
                      <span className="text-slate-400 block text-[9px]">TOTAL CALLS</span>
                      <span className="font-semibold text-slate-900">{totalCallsCount.toLocaleString()} Calls ({totalDurationHrs}h)</span>
                    </div>
                    <div className="bg-white p-2 rounded-md border border-slate-200">
                      <span className="text-slate-400 block text-[9px]">IN/OUT RATIO</span>
                      <span className="font-semibold text-slate-900">{incomingRatio}% In / {outgoingRatio}% Out</span>
                    </div>
                    <div className="bg-white p-2 rounded-md border border-slate-200">
                      <span className="text-slate-400 block text-[9px]">NIGHT CALLS (00-05)</span>
                      <span className="font-semibold text-amber-700">{nightCallsCount} Suspicious Hops</span>
                    </div>
                    <div className="bg-white p-2 rounded-md border border-slate-200">
                      <span className="text-slate-400 block text-[9px]">HARDWARE SWAPS</span>
                      <span className="font-semibold text-rose-700">{imeiSwapsCount} IMEI Replacements</span>
                    </div>
                  </div>
                </div>

                {/* REQUIREMENT 1: ONLY OFFICER-VERIFIED AI FINDINGS WITH SOURCE CITATIONS */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-emerald-800 uppercase text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>OFFICER-VERIFIED FORENSIC FINDINGS ({verifiedFindings.filter(f => f.verified).length})</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      *Unverified drafts excluded
                    </span>
                  </div>

                  {verifiedFindings.filter(f => f.verified).length > 0 ? (
                    <div className="space-y-2">
                      {verifiedFindings.filter(f => f.verified).map((vf, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-lg border border-emerald-200 shadow-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 text-xs">
                              #{idx + 1}. {vf.title}
                            </span>
                            <span className="bg-emerald-50 text-emerald-800 text-[9px] font-semibold px-2 py-0.5 rounded border border-emerald-200">
                              APPROVED BY {vf.verifiedBy} ({vf.verifiedAt})
                            </span>
                          </div>
                          <div className="text-[10px] text-blue-700 font-semibold">
                            Source Citation: {vf.citation} • {vf.timestamp}
                          </div>
                          <p className="text-slate-700 font-sans text-xs pt-1">
                            {vf.finding}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 rounded-lg text-amber-800 text-xs border border-amber-200">
                      No AI findings have been signed off by the lead officer yet. Mark findings as "Verify & Approve" in the AI Assistant to include them in the official report.
                    </div>
                  )}
                </div>

                {/* Chronological Tower Trail */}
                <div className="pt-2 border-t border-slate-200">
                  <span className="font-semibold text-slate-900 block mb-1">
                    CHRONOLOGICAL TOWER TRAIL & RADIAL SECTORS:
                  </span>
                  <div className="space-y-1 text-[11px]">
                    {data.slice(0, 5).map(d => (
                      <div key={d.id} className="flex justify-between py-0.5 border-b border-slate-200 last:border-0">
                        <span className="text-blue-700">{d.id}</span>
                        <span>{d.caller} ➔ {d.receiver}</span>
                        <span>{d.timestamp}</span>
                        <span className={d.imeiChange ? 'text-rose-600 font-semibold' : ''}>
                          {d.cellTowerId} {d.imeiChange ? '(SWAP)' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Certification Sign-Off Block */}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                  <div>
                    <span>Official Police Seal: </span>
                    <strong className="text-slate-800">CYBER CRIME POLICE STATION, JAIPUR</strong>
                  </div>
                  <div>
                    <span>Sign-off: </span>
                    <strong className="text-slate-800">{officerId} (Verified Digitally)</strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Close Preview
                </button>

                <div className="flex items-center space-x-2">
                  <a
                    href="/api/cases/1/export/excel"
                    download="Forensic_Dossier_Case1.xlsx"
                    className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Export Excel (.xlsx)</span>
                  </a>

                  <a
                    href="/api/cases/1/export/pdf"
                    download="Section_91_CrPC_Dossier_Case1.pdf"
                    target="_blank"
                    rel="noreferrer"
                    className="bg-slate-900 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-800 flex items-center space-x-1.5 shadow-xs transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-300" />
                    <span>Download Sec. 91 PDF</span>
                  </a>

                  <button
                    onClick={handlePrint}
                    className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
                  >
                    <span>Print</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. Quick Add Evidence File Modal */}
        {showQuickAddModal && (
          <div className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-xl border border-slate-200 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-slate-900 tracking-tight">Add Case Evidence File</h4>
                    <p className="text-[10px] text-slate-400">Attach carrier CDR logs or IPDR packet sessions</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickAddModal(false)}
                  className="w-6 h-6 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-800 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3.5 my-3.5 text-xs">
                {/* Device Upload Button */}
                <div
                  onClick={() => {
                    setShowQuickAddModal(false);
                    fileInputRef.current?.click();
                  }}
                  className="p-4 rounded-lg border-2 border-dashed border-slate-300 hover:border-slate-800 hover:bg-slate-50 transition-colors cursor-pointer flex flex-col items-center justify-center text-center group"
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-slate-900 text-slate-600 group-hover:text-white flex items-center justify-center transition-colors mb-2">
                    <Upload className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-slate-900 text-xs">Choose File from Your Computer</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Supports .csv, .xlsx, .txt (Operator CDR / IPDR format)</span>
                </div>

                {/* 1-Click Supplementary Samples */}
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                    Supplementary Demo Datasets:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleAddSampleFile('airtel')}
                      className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left flex items-center justify-between group transition-colors"
                    >
                      <div>
                        <span className="font-semibold text-slate-900 block font-sans text-xs">Airtel CDR Add-On</span>
                        <span className="text-[10px] text-slate-400 block">Operator A • 14 calls</span>
                      </div>
                      <Plus className="w-4 h-4 text-slate-400 group-hover:text-slate-900" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddSampleFile('jio')}
                      className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left flex items-center justify-between group transition-colors"
                    >
                      <div>
                        <span className="font-semibold text-slate-900 block font-sans text-xs">Jio CDR Add-On</span>
                        <span className="text-[10px] text-slate-400 block">Operator B • 18 calls</span>
                      </div>
                      <Plus className="w-4 h-4 text-slate-400 group-hover:text-slate-900" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddSampleFile('ipdr')}
                      className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left flex items-center justify-between group transition-colors"
                    >
                      <div>
                        <span className="font-semibold text-slate-900 block font-sans text-xs">IPDR Secondary Stream</span>
                        <span className="text-[10px] text-slate-400 block">VoIP/Web • 22 packets</span>
                      </div>
                      <Plus className="w-4 h-4 text-slate-400 group-hover:text-slate-900" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddSampleFile('vi')}
                      className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left flex items-center justify-between group transition-colors"
                    >
                      <div>
                        <span className="font-semibold text-slate-900 block font-sans text-xs">Vi Cellular CDR</span>
                        <span className="text-[10px] text-slate-400 block">Operator C • 12 calls</span>
                      </div>
                      <Plus className="w-4 h-4 text-slate-400 group-hover:text-slate-900" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQuickAddModal(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowQuickAddModal(false);
                    setActiveNav('upload');
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium flex items-center space-x-1.5 shadow-xs hover:bg-slate-800 transition-colors"
                >
                  <span>Open Full Ingestion Studio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6. Preview File Modal */}
        {previewFileModal && (
          <div className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-xl max-w-2xl w-full p-5 shadow-xl border border-slate-200 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-slate-900 tracking-tight">{previewFileModal.name}</h4>
                    <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono">
                      <span>{previewFileModal.type}</span>
                      <span>•</span>
                      <span>SHA-256 Integrity Verified</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewFileModal(null)}
                  className="w-6 h-6 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-800 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="my-3.5 space-y-3">
                <div className="grid grid-cols-3 gap-2.5 text-xs font-sans">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Ingestion State</span>
                    <span className="font-semibold text-emerald-700 mt-0.5 block">100% Normalized</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Record Count</span>
                    <span className="font-semibold text-slate-900 mt-0.5 block">{previewFileModal.rows || 5} Records</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Security Hash</span>
                    <span className="font-semibold text-blue-700 font-mono mt-0.5 block text-[11px]">SHA256-RJ9102</span>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between text-[10px] font-semibold uppercase text-slate-500">
                    <span>Sample Normalized Rows Preview</span>
                    <span className="text-emerald-700 font-semibold">Verified</span>
                  </div>
                  <div className="p-3 text-[11px] font-mono space-y-1 bg-slate-900 text-slate-200 max-h-48 overflow-y-auto custom-scrollbar">
                    <div className="text-slate-400 text-[10px]"># Lineage: {previewFileModal.name}</div>
                    <div>Row 1: +91 98290 XXXXX ➔ +91 94140 XXXXX | TOW-JPR-014 | Dur: 482s</div>
                    <div>Row 2: +91 98290 XXXXX ➔ +91 98299 XXXXX | TOW-JPR-029 | Dur: 195s [NIGHT]</div>
                    <div>Row 3: +91 98290 XXXXX ➔ +91 97841 XXXXX | TOW-JPR-077 | IMEI: 358924081290455 [SWAP]</div>
                    {previewFileModal.type?.includes('IPDR') && (
                      <div className="text-blue-300">IPDR: 157.240.198.60:443 ➔ WhatsApp VoIP Session</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPreviewFileModal(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Close Preview
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPreviewFileModal(null);
                    setActiveNav('upload');
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-xs hover:bg-slate-800 transition-colors"
                >
                  View In Normalization Grid
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6.5 Workstation Settings Modal */}
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          settings={settings}
          onSaveSettings={handleSaveSettings}
          onOpenDossier={() => setShowReportModal(true)}
        />

        {/* 7. Live Action Toast Feedback Notification */}
        {toastMessage && (
          <div className="fixed top-4 right-4 z-[100] bg-slate-900 text-white px-3.5 py-2 rounded-lg shadow-lg flex items-center space-x-2 border border-slate-700 animate-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-medium">{toastMessage}</span>
          </div>
        )}
      </main>
    </div>
  );
}
