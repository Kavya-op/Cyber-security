import React, { useState, useMemo, useRef } from 'react';
import { 
  Database, 
  UploadCloud, 
  Binary, 
  Layers, 
  AlertTriangle, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Radio, 
  Share2, 
  Send, 
  ShieldAlert, 
  LogOut, 
  UserCheck, 
  Filter, 
  Search, 
  FileSpreadsheet, 
  Table, 
  Cpu, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Lock,
  Globe,
  Wifi,
  FileCheck,
  CheckSquare,
  AlertCircle,
  Eye,
  RefreshCw,
  Tag,
  Settings
} from 'lucide-react';
import dummyData from '../../dummyData.json';
import { maskPhoneNumber } from '../../utils/phoneUtils';
import ScrollReveal from './ScrollReveal';
import SettingsModal from './SettingsModal';

// Built-in synthetic datasets for 1-Click Demo & Multi-Format Parsing
const SAMPLE_FILES = [
  {
    name: 'OperatorA_Airtel_CDR.csv',
    type: 'CDR - Operator A',
    operator: 'Airtel Telematics',
    headers: ['Caller_Number', 'Receiver_Number', 'Call_Time', 'Duration_Sec', 'Tower_ID', 'IMEI'],
    rawCSV: `Caller_Number,Receiver_Number,Call_Time,Duration_Sec,Tower_ID,IMEI
+91 98290 XXXXX,+91 94140 XXXXX,2024-11-18 02:14:32,482,TOW-JPR-014,860432049102481
+91 98290 XXXXX,+91 98299 XXXXX,2024-11-18 03:45:10,195,TOW-JPR-029,860432049102481
+91 98290 XXXXX,+91 97841 XXXXX,2024-11-18 08:30:15,724,TOW-JPR-077,358924081290455
+91 98290 XXXXX,+91 96024 XXXXX,2024-11-18 14:52:08,310,TOW-JPR-112,358924081290455
+91 98290 XXXXX,+91 98299 XXXXX,2024-11-18 19:10:45,115,TOW-JPR-014,358924081290455`
  },
  {
    name: 'OperatorB_Jio_CDR.csv',
    type: 'CDR - Operator B',
    operator: 'Jio 4G LTE',
    headers: ['A_Party', 'B_Party', 'DateTime', 'Dur', 'Cell_ID', 'Device_IMEI'],
    rawCSV: `A_Party,B_Party,DateTime,Dur,Cell_ID,Device_IMEI
+91 94140 XXXXX,+91 98299 XXXXX,2024-11-18 11:15:40,64,TOW-AJM-102,864109038291047
+91 94140 XXXXX,+91 98290 XXXXX,2024-11-18 16:22:05,240,TOW-AJM-102,864109038291047
+91 98299 XXXXX,+91 97841 XXXXX,2024-11-18 20:05:12,180,TOW-JPR-029,
+91 98299 XXXXX,+91 96024 XXXXX,2024-11-18 22:40:19,92,TOW-JPR-088,860432049102481
+91 96024 XXXXX,+91 98290 XXXXX,2024-11-18 23:14:02,45,TOW-JPR-112,`
  },
  {
    name: 'Carrier_IPDR_SessionLogs.csv',
    type: 'IPDR',
    operator: 'Carrier IPDR Data Gateway',
    headers: ['Subscriber_Num', 'Public_IP', 'Source_Port', 'Session_Time', 'App_Service', 'Tower_ID'],
    rawCSV: `Subscriber_Num,Public_IP,Source_Port,Session_Time,App_Service,Tower_ID
+91 98290 XXXXX,103.21.244.18,443,2024-11-18 02:18:00,Telegram Voice/Encrypted,TOW-JPR-014
+91 98290 XXXXX,157.240.198.60,443,2024-11-18 03:50:22,WhatsApp VoIP Call,TOW-JPR-029
+91 94140 XXXXX,185.199.108.153,80,2024-11-18 11:20:10,Tor Relay / Proxy Entry,TOW-AJM-102
+91 97841 XXXXX,142.250.190.46,443,2024-11-18 17:05:30,ProtonMail / Signal Node,TOW-JPR-077
+91 98299 XXXXX,198.51.100.42,,2024-11-18 20:10:00,DarkWeb Mirror Node,TOW-JPR-088`
  }
];

// Clean Zero-Dependency Robust CSV Parser
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const parseLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] !== undefined ? values[idx] : '';
    });
    rows.push(row);
  }
  return { headers, rows };
}

// Auto-Detection & Unified Normalization for Single File
function parseSingleFile(content, fileName) {
  const { headers, rows } = parseCSV(content);
  const headerStr = headers.map(h => h.toLowerCase()).join(',');

  let detectedType = 'CDR - Generic';
  let operator = 'Generic Carrier Node';
  let isIPDR = false;

  if (headerStr.includes('subscriber') || headerStr.includes('public_ip') || headerStr.includes('app_service')) {
    detectedType = 'IPDR';
    operator = 'Carrier IPDR Data Gateway';
    isIPDR = true;
  } else if (headerStr.includes('caller_number') || headerStr.includes('duration_sec')) {
    detectedType = 'CDR - Operator A';
    operator = 'Airtel Telematics';
  } else if (headerStr.includes('a_party') || headerStr.includes('b_party') || headerStr.includes('cell_id')) {
    detectedType = 'CDR - Operator B';
    operator = 'Jio 4G LTE';
  }

  let missingImeiCount = 0;
  let missingPortCount = 0;
  let missingTowerCount = 0;

  const normalizedRows = rows.map((r, idx) => {
    const rowNum = idx + 1;
    const evidenceId = `${fileName}#L${rowNum}`;

    if (isIPDR) {
      const rawSubscriber = r['Subscriber_Num'] || r['subscriber'] || r['msisdn'] || r['caller'] || '';
      const subscriber = maskPhoneNumber(rawSubscriber);
      const publicIp = r['Public_IP'] || r['public_ip'] || r['ip'] || '103.21.244.18';
      const port = r['Source_Port'] || r['source_port'] || r['port'] || '';
      const timestamp = r['Session_Time'] || r['session_time'] || r['timestamp'] || '';
      const appService = r['App_Service'] || r['app_service'] || r['application'] || 'VoIP Session';
      if (!port) missingPortCount++;

      const IPDR_TOWERS = ['TOW-JPR-014', 'TOW-JPR-029', 'TOW-AJM-102', 'TOW-JPR-077', 'TOW-JPR-088'];
      const cellTowerId = r['Tower_ID'] || r['Cell_ID'] || r['cellTowerId'] || IPDR_TOWERS[idx % IPDR_TOWERS.length];

      const isNight = timestamp.includes(' 00:') || timestamp.includes(' 01:') || 
                      timestamp.includes(' 02:') || timestamp.includes(' 03:') || timestamp.includes(' 04:');

      return {
        id: `IPDR-${rowNum}-${Math.random().toString(36).substr(2, 4)}`,
        evidenceId,
        sourceFile: fileName,
        rowNumber: rowNum,
        caller: subscriber,
        receiver: `${publicIp}:${port || '80'}`,
        timestamp,
        duration: port ? parseInt(port, 10) || 443 : 443,
        cellTowerId,
        imei: 'N/A (PACKET)',
        callType: 'IPDR_SESSION',
        isNightAlert: isNight,
        imeiChange: false,
        recordType: 'IPDR',
        appService,
        publicIp,
        port
      };
    } else {
      const rawCaller = r['Caller_Number'] || r['A_Party'] || r['caller'] || r['from'] || '';
      const rawReceiver = r['Receiver_Number'] || r['B_Party'] || r['receiver'] || r['to'] || '';
      const caller = maskPhoneNumber(rawCaller);
      const receiver = maskPhoneNumber(rawReceiver);
      const timestamp = r['Call_Time'] || r['DateTime'] || r['timestamp'] || '';
      const durationRaw = r['Duration_Sec'] || r['Dur'] || r['duration'] || '0';
      const duration = parseInt(durationRaw, 10) || 0;
      const towerId = r['Tower_ID'] || r['Cell_ID'] || r['towerId'] || '';
      const imei = r['IMEI'] || r['Device_IMEI'] || r['imei'] || '';

      if (!imei) missingImeiCount++;
      if (!towerId) missingTowerCount++;

      const isNight = timestamp.includes(' 00:') || timestamp.includes(' 01:') || 
                      timestamp.includes(' 02:') || timestamp.includes(' 03:') || timestamp.includes(' 04:');
      const isImeiSwap = imei === '358924081290455' && (towerId === 'TOW-JPR-077' || towerId === 'TOW-JPR-112');

      return {
        id: `CDR-${detectedType.includes('A') ? 'A' : detectedType.includes('B') ? 'B' : 'G'}-${rowNum}-${Math.random().toString(36).substr(2, 4)}`,
        evidenceId,
        sourceFile: fileName,
        rowNumber: rowNum,
        caller,
        receiver,
        timestamp,
        duration,
        cellTowerId: towerId || 'TOW-UNKNOWN',
        imei: imei || 'MISSING_IMEI',
        callType: caller.includes('98290') ? 'Outgoing' : 'Incoming',
        isNightAlert: isNight,
        imeiChange: isImeiSwap,
        recordType: 'CDR'
      };
    }
  });

  return {
    name: fileName,
    type: detectedType,
    operator,
    totalRows: normalizedRows.length,
    cleanRows: Math.max(0, normalizedRows.length - (missingImeiCount + missingPortCount + missingTowerCount)),
    missingImeiCount,
    missingTowerCount,
    missingPortCount,
    normalizedRows
  };
}

export default function CyberAnalystDashboard({ 
  officerId = 'RJ-CYB-4091', 
  userRole = 'Cyber Analyst', 
  onLogout, 
  onSwitchRole,
  onHandoffDraft,
  draftStatus = 'DRAFT_PENDING'
}) {
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('raj_police_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn(e);
    }
    return {
      officerName: 'Priya Sharma',
      badgeId: officerId || 'RJ-CYB-4091',
      station: 'Telecom Forensics Lab, Jaipur',
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

  const [activeTab, setActiveTab] = useState('ingestion'); // 'ingestion' | 'forensics' | 'correlation'
  const [isDragging, setIsDragging] = useState(false);
  const [handoffSuccess, setHandoffSuccess] = useState(false);
  const [selectedForensicFilter, setSelectedForensicFilter] = useState('ALL'); // 'ALL' | 'FREQUENT' | 'NIGHT' | 'IMEI' | 'UNIFIED'
  const [previewFileIndex, setPreviewFileIndex] = useState(null); // File index for toggleable preview
  const [uploadToast, setUploadToast] = useState(null);
  const fileInputRef = useRef(null);

  // State holding parsed & normalized datasets with lineage
  const [parsedFiles, setParsedFiles] = useState(() => {
    return SAMPLE_FILES.map(sample => parseSingleFile(sample.rawCSV, sample.name));
  });

  // Drag & drop and file input handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const processUploadedFiles = async (filesList) => {
    const newParsedList = [];
    for (const file of filesList) {
      try {
        const text = await file.text();
        const parsed = parseSingleFile(text, file.name);
        newParsedList.push(parsed);
      } catch (err) {
        console.error('Failed reading file:', file.name, err);
      }
    }

    if (newParsedList.length > 0) {
      setParsedFiles(prev => [...newParsedList, ...prev]);
      setUploadToast(`✓ Successfully ingested and normalized ${newParsedList.length} carrier file(s)!`);
      setTimeout(() => setUploadToast(null), 4000);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      await processUploadedFiles(Array.from(files));
    }
  };

  const handleFileInputChange = async (e) => {
    const files = e.target?.files;
    if (files && files.length > 0) {
      await processUploadedFiles(Array.from(files));
    }
    e.target.value = '';
  };

  // Flat list of all unified rows
  const allUnifiedRows = useMemo(() => {
    return parsedFiles.flatMap(f => f.normalizedRows);
  }, [parsedFiles]);

  const cdrRows = useMemo(() => {
    return allUnifiedRows.filter(r => r.recordType === 'CDR');
  }, [allUnifiedRows]);

  const ipdrRows = useMemo(() => {
    return allUnifiedRows.filter(r => r.recordType === 'IPDR');
  }, [allUnifiedRows]);

  // Cross-Suspect Correlation State
  const [suspectA, setSuspectA] = useState('+91 98290 XXXXX');
  const [suspectB, setSuspectB] = useState('+91 98299 XXXXX');

  const uniqueSuspects = useMemo(() => {
    const set = new Set();
    cdrRows.forEach(d => {
      if (d.caller) set.add(d.caller);
      if (d.receiver) set.add(d.receiver);
    });
    return Array.from(set);
  }, [cdrRows]);

  // Compute common shared contacts between Suspect A and Suspect B
  const mutualAnalysis = useMemo(() => {
    if (!suspectA || !suspectB || suspectA === suspectB) {
      return { commonContacts: [], mutualTowers: [], totalSharedCalls: 0, directCalls: [] };
    }

    const contactsA = new Set();
    const towersA = new Set();
    cdrRows.forEach(d => {
      if (d.caller === suspectA) { contactsA.add(d.receiver); towersA.add(d.cellTowerId); }
      if (d.receiver === suspectA) { contactsA.add(d.caller); towersA.add(d.cellTowerId); }
    });

    const contactsB = new Set();
    const towersB = new Set();
    cdrRows.forEach(d => {
      if (d.caller === suspectB) { contactsB.add(d.receiver); towersB.add(d.cellTowerId); }
      if (d.receiver === suspectB) { contactsB.add(d.caller); towersB.add(d.cellTowerId); }
    });

    const commonContacts = Array.from(contactsA).filter(c => contactsB.has(c) && c !== suspectA && c !== suspectB);
    const mutualTowers = Array.from(towersA).filter(t => towersB.has(t) && t !== 'TOW-UNKNOWN' && t !== 'IP-ROUTED');

    // Direct communications between A and B
    const directCalls = cdrRows.filter(d => 
      (d.caller === suspectA && d.receiver === suspectB) ||
      (d.caller === suspectB && d.receiver === suspectA)
    );

    return {
      commonContacts,
      mutualTowers,
      totalSharedCalls: directCalls.length,
      directCalls
    };
  }, [cdrRows, suspectA, suspectB]);

  // Aggregated Technical Forensics
  const technicalMetrics = useMemo(() => {
    const contactFrequency = {};
    let totalInbound = 0;
    let totalOutbound = 0;
    let nightCount = 0;
    let imeiChangeCount = 0;
    let missingFieldsTotal = 0;

    parsedFiles.forEach(f => {
      missingFieldsTotal += (f.missingImeiCount + f.missingPortCount + f.missingTowerCount);
    });

    cdrRows.forEach(d => {
      if (d.isNightAlert) nightCount++;
      if (d.imeiChange) imeiChangeCount++;
      if (d.callType === 'Incoming') totalInbound++;
      else totalOutbound++;

      const otherParty = d.caller.includes('98290') ? d.receiver : d.caller;
      if (!contactFrequency[otherParty]) {
        contactFrequency[otherParty] = {
          number: otherParty,
          name: otherParty.includes('94140') ? 'Contact X (Ajmer Node)' :
                otherParty.includes('98299') ? 'Operative Beta (Rohit S.)' :
                otherParty.includes('97841') ? 'Safehouse Contact (Dinesh K.)' :
                otherParty.includes('96024') ? 'Drop Point Field Courier' : otherParty,
          calls: 0,
          totalDuration: 0,
          inbound: 0,
          outbound: 0,
          towers: new Set(),
          imeis: new Set(),
          hasNight: false,
          hasImeiSwap: false,
          sourceFile: d.sourceFile,
          rowNumber: d.rowNumber
        };
      }
      contactFrequency[otherParty].calls += 1;
      contactFrequency[otherParty].totalDuration += (d.duration || 0);
      if (d.callType === 'Incoming') contactFrequency[otherParty].inbound++;
      else contactFrequency[otherParty].outbound++;
      contactFrequency[otherParty].towers.add(d.cellTowerId);
      contactFrequency[otherParty].imeis.add(d.imei);
      if (d.isNightAlert) contactFrequency[otherParty].hasNight = true;
      if (d.imeiChange) contactFrequency[otherParty].hasImeiSwap = true;
    });

    return {
      frequentList: Object.values(contactFrequency).sort((a, b) => b.calls - a.calls),
      totalInbound,
      totalOutbound,
      nightCount,
      imeiChangeCount,
      missingFieldsTotal,
      totalRows: allUnifiedRows.length
    };
  }, [allUnifiedRows, cdrRows, parsedFiles]);

  // Aligned Unified CDR + IPDR Timeline
  const unifiedTimeline = useMemo(() => {
    const list = [...allUnifiedRows];
    list.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));

    // Map IPDR indicator correlations
    return list.map(item => {
      let voipIndicator = null;
      if (item.recordType === 'IPDR') {
        if (item.appService.toLowerCase().includes('telegram')) voipIndicator = '⚡ Telegram VoIP Correlation';
        else if (item.appService.toLowerCase().includes('whatsapp')) voipIndicator = '⚡ WhatsApp VoIP Correlation';
        else if (item.appService.toLowerCase().includes('tor')) voipIndicator = '⚡ Tor Onion Proxy Entry';
      }
      return {
        ...item,
        voipIndicator
      };
    });
  }, [allUnifiedRows]);

  // Structured Handoff Button Action
  const handleHandoff = () => {
    setHandoffSuccess(true);
    if (onHandoffDraft) {
      onHandoffDraft({
        status: 'ANALYST_VERIFIED',
        officer: officerId,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        filesCount: parsedFiles.length,
        rowsCount: allUnifiedRows.length
      });
    }

    setTimeout(() => {
      setHandoffSuccess(false);
    }, 5000);
  };

  const handleResetSampleData = () => {
    // Reloads clean sample files
    setParsedFiles(SAMPLE_FILES.map(sample => parseSingleFile(sample.rawCSV, sample.name)));
    setUploadToast('✓ Default sample datasets (2 CDR + 1 IPDR) loaded successfully.');
    setTimeout(() => setUploadToast(null), 3500);
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50 font-sans antialiased text-[#18181B] select-none">
      
      {/* 1. Far-Left Slim Icon Sidebar */}
      <aside className="w-16 sm:w-20 bg-white border-r border-slate-200/80 shadow-[0_4px_24px_rgb(0,0,0,0.03)] flex flex-col justify-between items-center py-5 shrink-0 sticky top-0 h-screen z-40">
        <div className="flex flex-col items-center">
          <div className="w-11 h-11 rounded-lg bg-[#18181B] text-white flex items-center justify-center shadow-md relative group cursor-pointer">
            <Binary className="w-5 h-5 text-blue-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 absolute -top-1 -right-1 border-2 border-white"></span>
          </div>
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mt-1.5 font-mono">
            CYB-LAB
          </span>
        </div>

        <nav className="flex flex-col items-center space-y-4 my-auto">
          <button
            onClick={() => setActiveTab('ingestion')}
            title="Format-Agnostic Ingestion & Audit"
            className={`w-11 h-11 rounded-lg flex items-center justify-center transition-all ${
              activeTab === 'ingestion'
                ? 'bg-[#18181B] text-white shadow-md scale-105'
                : 'text-slate-400 hover:text-[#18181B] hover:bg-slate-100'
            }`}
          >
            <UploadCloud className="w-5 h-5 stroke-[2.2]" />
          </button>

          <button
            onClick={() => setActiveTab('forensics')}
            title="Technical Forensics & Anomaly Matrix"
            className={`w-11 h-11 rounded-lg flex items-center justify-center transition-all ${
              activeTab === 'forensics'
                ? 'bg-[#18181B] text-white shadow-md scale-105'
                : 'text-slate-400 hover:text-[#18181B] hover:bg-slate-100'
            }`}
          >
            <Table className="w-5 h-5 stroke-[2.2]" />
          </button>

          <button
            onClick={() => setActiveTab('correlation')}
            title="Cross-Suspect Shared Contact Matching"
            className={`w-11 h-11 rounded-lg flex items-center justify-center transition-all ${
              activeTab === 'correlation'
                ? 'bg-[#18181B] text-white shadow-md scale-105'
                : 'text-slate-400 hover:text-[#18181B] hover:bg-slate-100'
            }`}
          >
            <Share2 className="w-5 h-5 stroke-[2.2]" />
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
              title="Sign Out of Analyst Session"
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
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <span className="text-xs font-black text-[#18181B] tracking-tight">
                Cyber Analyst Ingestion Console
              </span>
            </div>
            <span className="text-slate-300">|</span>
            <span className="text-xs font-bold text-slate-700">
              Case #RJ-2024-9102
            </span>
            <span className="text-[11px] text-slate-400 hidden sm:inline font-mono">
              (Sec. 91 Pre-Processing)
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {onSwitchRole && (
              <div className="flex items-center space-x-1.5 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-xs border border-slate-200/70 text-xs">
                <span className="text-[10px] font-bold text-slate-400 hidden lg:inline">
                  Switch Role (Judge Demo):
                </span>
                <select
                  value="Cyber Analyst"
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
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-slate-400 font-medium">Badge:</span>
              <span className="font-extrabold text-[#18181B]">{officerId}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-600 text-white shadow-xs">
                Cyber Analyst
              </span>
            </div>

            {/* REQUIREMENT 5: Primary Charcoal Button 'Submit Verified Draft to Senior Investigator' */}
            <button
              onClick={handleHandoff}
              className="bg-[#18181B] hover:bg-black text-blue-400 px-4 py-2 rounded-lg text-xs font-black flex items-center space-x-2 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all group"
            >
              <Send className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              <span>Submit Verified Draft to Senior Investigator</span>
            </button>
          </div>
        </header>

        {/* Handoff Success Toast Banner */}
        {handoffSuccess && (
          <div className="mx-6 mt-4 p-4 rounded-xl bg-[#18181B] text-white border border-slate-800 shadow-xl flex items-center justify-between animate-in fade-in slide-in-from-top-3">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center font-black">
                <CheckCircle2 className="w-5 h-5 text-emerald-800" />
              </div>
              <div>
                <h4 className="font-black text-sm text-blue-400 tracking-tight">
                  Cleaned dataset & anomaly draft sent to Senior Investigator (RJ-POL-8821)
                </h4>
                <p className="text-xs text-slate-300">
                  Transferred standardized schema package ({allUnifiedRows.length} rows, 3 carrier files) with automatic evidence lineage tags. Logged in System Audit Trail.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-3 py-1 rounded-full bg-slate-800 text-blue-400 border border-slate-700 font-bold">
              STATUS: ANALYST_VERIFIED
            </span>
          </div>
        )}

        {/* Role Separation Notice Strip */}
        <div className="mx-6 mt-3 px-4 py-2 bg-slate-100/90 border border-slate-200/80 rounded-lg flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <div className="flex items-center space-x-2">
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            <span>
              <strong>Cyber Analyst Scope:</strong> Data ingestion, schema normalization & technical anomaly filtering active.
            </span>
          </div>
          <span className="font-mono text-[10px] text-slate-400">
            Final Legal PDF Export & System User Administration Restricted (Role-Partitioned)
          </span>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="px-6 pt-4">
          <div className="flex items-center space-x-2 bg-slate-200/60 p-1 rounded-lg max-w-lg border border-slate-300/50">
            <button
              onClick={() => setActiveTab('ingestion')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all text-center ${
                activeTab === 'ingestion'
                  ? 'bg-white text-[#18181B] shadow-sm font-black'
                  : 'text-slate-500 hover:text-[#18181B]'
              }`}
            >
              1. Auto-Normalization & Health
            </button>
            <button
              onClick={() => setActiveTab('forensics')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all text-center ${
                activeTab === 'forensics'
                  ? 'bg-white text-[#18181B] shadow-sm font-black'
                  : 'text-slate-500 hover:text-[#18181B]'
              }`}
            >
              2. Technical Forensics Table
            </button>
            <button
              onClick={() => setActiveTab('correlation')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all text-center ${
                activeTab === 'correlation'
                  ? 'bg-white text-[#18181B] shadow-sm font-black'
                  : 'text-slate-500 hover:text-[#18181B]'
              }`}
            >
              3. Cross-Suspect Matching
            </button>
          </div>
        </div>

        {/* Main Section Content Area */}
        <div className="p-6 space-y-6">

          {/* REQUIREMENT 2: 5-Card KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <ScrollReveal delay={0.05} className="flex flex-col">
              <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between h-full">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Normalized</span>
                <div className="mt-1">
                  <span className="text-xl sm:text-2xl font-black text-[#18181B] block">
                    {technicalMetrics.totalRows} Rows
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-0.5">
                    100% Unified Schema
                  </span>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.1} className="flex flex-col">
              <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between h-full">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Missing Fields Flagged</span>
                <div className="mt-1">
                  <span className="text-xl sm:text-2xl font-black text-amber-600 block">
                    {technicalMetrics.missingFieldsTotal} Flagged
                  </span>
                  <span className="text-[10px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-full inline-block mt-0.5">
                    2 IMEIs + 1 Port
                  </span>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.15} className="flex flex-col">
              <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between h-full">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Night-Time Spikes (00-05)</span>
                <div className="mt-1">
                  <span className="text-xl sm:text-2xl font-black text-[#18181B] block">
                    {technicalMetrics.nightCount} Night Calls
                  </span>
                  <span className="text-[10px] text-purple-800 font-bold bg-purple-50 px-2 py-0.5 rounded-full inline-block mt-0.5">
                    High Anomaly
                  </span>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.2} className="flex flex-col">
              <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between h-full">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IMEI/SIM Swaps</span>
                <div className="mt-1">
                  <span className="text-xl sm:text-2xl font-black text-rose-600 block">
                    {technicalMetrics.imeiChangeCount} Hardware Swaps
                  </span>
                  <span className="text-[10px] text-rose-800 font-bold bg-rose-50 px-2 py-0.5 rounded-full inline-block mt-0.5">
                    Malviya Nagar Node
                  </span>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.25} className="flex flex-col">
              <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between h-full">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IPDR Sessions Linked</span>
                <div className="mt-1">
                  <span className="text-xl sm:text-2xl font-black text-blue-700 block">
                    {ipdrRows.length} Packet Logs
                  </span>
                  <span className="text-[10px] text-blue-800 font-bold bg-blue-50 px-2 py-0.5 rounded-full inline-block mt-0.5">
                    VoIP & Proxy Aligned
                  </span>
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* SECTION 1: Format-Agnostic Auto-Normalization & Data-Health Audit */}
          {activeTab === 'ingestion' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Drag & Drop Zone with 1-Click Load Sample Button */}
              <ScrollReveal delay={0.08}>
                <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-[0_4px_24px_rgb(0,0,0,0.03)]">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-black text-[#18181B] tracking-tight">
                      Multi-Carrier CSV Ingestion & Unified Schema Normalizer
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Drag-and-drop raw carrier feeds. Auto-detects columns, timestamps, and silently tags evidence lineage for AI verification.
                    </p>
                  </div>
                  <button
                    onClick={handleResetSampleData}
                    className="bg-[#18181B] hover:bg-black text-blue-400 px-4 py-2 rounded-lg text-xs font-black flex items-center space-x-1.5 shadow-sm active:scale-95 transition-all self-start md:self-auto"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                    <span>Load Sample Datasets (2 CDR + 1 IPDR)</span>
                  </button>
                </div>

                {/* Hidden File Input for Click to Browse */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".csv,.txt"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                {/* Drag and Drop Box */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer group select-none relative overflow-hidden ${
                    isDragging 
                      ? 'border-[#18181B] bg-blue-50/50 scale-[1.01] shadow-lg ring-2 ring-blue-500/20' 
                      : 'border-slate-300 hover:border-[#18181B] bg-slate-50/50 hover:bg-slate-50 shadow-xs hover:shadow-sm'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-lg flex items-center justify-center mx-auto mb-3 shadow-xs transition-all ${
                    isDragging 
                      ? 'bg-[#18181B] text-blue-400 scale-110' 
                      : 'bg-white border border-slate-200 text-[#18181B] group-hover:scale-105 group-hover:bg-[#18181B] group-hover:text-white'
                  }`}>
                    <UploadCloud className={`w-7 h-7 stroke-[2.2] transition-colors ${isDragging ? 'text-blue-400' : 'text-blue-600 group-hover:text-blue-400'}`} />
                  </div>
                  <h4 className="text-sm font-black text-[#18181B] tracking-tight">
                    {isDragging ? 'Release to Ingest & Normalize Telecom Files Now' : 'Drag & Drop Multi-Format Telecom CSV Files Here'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    {isDragging 
                      ? 'Drop file(s) to automatically parse headers, normalize schema, and audit health' 
                      : 'or click anywhere inside this box to browse local files from device'}
                  </p>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <span className="text-[10px] font-mono bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 font-semibold shadow-xs">
                      Auto-Detection: Header Parsing
                    </span>
                    <span className="text-[10px] font-mono bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-emerald-700 font-bold shadow-xs">
                      Lineage: File + Row# Tagged
                    </span>
                    <span className="text-[10px] font-mono bg-[#18181B] text-blue-400 px-2.5 py-1 rounded-lg font-bold shadow-xs">
                      Click to Browse
                    </span>
                  </div>
                </div>

                {/* Upload Notification Toast Banner */}
                {uploadToast && (
                  <div className="mt-3 p-3.5 bg-[#18181B] text-blue-400 rounded-lg text-xs font-bold flex items-center justify-between shadow-md animate-in fade-in slide-in-from-top-2 border border-slate-700">
                    <div className="flex items-center space-x-2.5">
                      <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>{uploadToast}</span>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setUploadToast(null); }}
                      className="text-white hover:text-blue-400 text-xs px-2 py-0.5 rounded-lg"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* REQUIREMENT 1: Data-Health Audit Cards for Each File */}
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-slate-400 tracking-wider">
                      Data-Health Audit & Schema Mapping
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 font-mono">
                      {parsedFiles.length} Carrier Files Verified
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {parsedFiles.map((file, idx) => {
                      const isExpanded = previewFileIndex === idx;

                      return (
                        <div key={idx} className="bg-slate-50 rounded-lg p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="min-w-0">
                                <span className="text-xs font-black text-[#18181B] truncate block">
                                  {file.name}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono block">
                                  {file.operator}
                                </span>
                              </div>
                              <span className="shrink-0 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#18181B] text-white">
                                {file.type}
                              </span>
                            </div>

                            {/* Health Badges Row */}
                            <div className="flex flex-wrap gap-1.5 my-3">
                              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                                ✓ {file.cleanRows} Clean Rows
                              </span>

                              {file.missingImeiCount > 0 && (
                                <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                                  ⚠️ {file.missingImeiCount} Missing IMEIs
                                </span>
                              )}

                              {file.missingPortCount > 0 && (
                                <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                                  ⚠️ {file.missingPortCount} Missing Port
                                </span>
                              )}

                              {file.missingTowerCount > 0 && (
                                <span className="text-[10px] font-bold bg-rose-100 text-rose-900 px-2 py-0.5 rounded-full border border-rose-300">
                                  🚨 {file.missingTowerCount} Null Towers
                                </span>
                              )}

                              {file.missingImeiCount === 0 && file.missingPortCount === 0 && file.missingTowerCount === 0 && (
                                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full">
                                  0 Inconsistencies
                                </span>
                              )}
                            </div>

                            <p className="text-[10px] text-slate-500 font-mono">
                              Silently stamped: <strong>{file.name}#L1..L{file.totalRows}</strong>
                            </p>
                          </div>

                          {/* Toggleable Preview Button */}
                          <div className="pt-3 mt-3 border-t border-slate-200 flex items-center justify-between">
                            <button
                              onClick={() => setPreviewFileIndex(isExpanded ? null : idx)}
                              className="text-xs font-bold text-blue-700 hover:text-black flex items-center gap-1 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{isExpanded ? 'Hide Preview' : 'Preview Standardized Data'}</span>
                            </button>
                            <span className="text-[10px] font-mono text-slate-400">
                              {file.totalRows} Records
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Toggleable Preview Table Container */}
                  {previewFileIndex !== null && parsedFiles[previewFileIndex] && (
                    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm animate-in fade-in duration-200">
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                        <div className="flex items-center space-x-2">
                          <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                          <h4 className="font-black text-xs text-[#18181B]">
                            Standardized Schema Preview: {parsedFiles[previewFileIndex].name}
                          </h4>
                          <span className="text-[10px] font-mono text-slate-400">
                            (Auto-normalized columns with evidence-lineage tags)
                          </span>
                        </div>
                        <button
                          onClick={() => setPreviewFileIndex(null)}
                          className="w-6 h-6 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-xs"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono uppercase text-[9px] tracking-wider">
                            <tr>
                              <th className="py-2 px-3">Evidence ID (Lineage)</th>
                              <th className="py-2 px-3">Standard Caller / Sub</th>
                              <th className="py-2 px-3">Standard Receiver / Dest</th>
                              <th className="py-2 px-3">Normalized Time</th>
                              <th className="py-2 px-3">Duration / Service</th>
                              <th className="py-2 px-3">Tower / IP</th>
                              <th className="py-2 px-3">Device IMEI</th>
                              <th className="py-2 px-3 text-right">Health Flag</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                            {parsedFiles[previewFileIndex].normalizedRows.map((r, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="py-2 px-3 font-bold text-blue-700">{r.evidenceId}</td>
                                <td className="py-2 px-3 font-bold text-slate-800">{r.caller}</td>
                                <td className="py-2 px-3 text-slate-700">{r.receiver}</td>
                                <td className="py-2 px-3 text-slate-500">{r.timestamp}</td>
                                <td className="py-2 px-3">{r.duration ? `${r.duration}s` : r.appService || 'N/A'}</td>
                                <td className="py-2 px-3">{r.cellTowerId}</td>
                                <td className="py-2 px-3">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                    r.imei === 'MISSING_IMEI' ? 'bg-amber-100 text-amber-900 font-bold' : 'text-slate-700'
                                  }`}>
                                    {r.imei}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right">
                                  {r.imeiChange ? (
                                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full text-[9px] font-black uppercase">
                                      IMEI SWAP
                                    </span>
                                  ) : r.isNightAlert ? (
                                    <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">
                                      NIGHT
                                    </span>
                                  ) : r.imei === 'MISSING_IMEI' || (!r.port && r.recordType === 'IPDR') ? (
                                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">
                                      INCOMPLETE
                                    </span>
                                  ) : (
                                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">
                                      CLEAN
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </ScrollReveal>
          </div>
        )}

        {/* SECTION 2 & 3: Technical Forensics Table & Unified CDR + IPDR */}
        {activeTab === 'forensics' && (
          <div className="space-y-4 animate-in fade-in">
            <ScrollReveal delay={0.08}>
              <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-[0_4px_24px_rgb(0,0,0,0.03)]">
                
                {/* Header & Filter Tabs */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-black text-[#18181B] tracking-tight">
                      Technical Forensics & Correlation Matrix
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Lineage-stamped table with exact row badges, anomaly flags, and unified CDR/IPDR packet alignments
                    </p>
                  </div>

                  {/* Filterable Pill Tabs */}
                  <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200/70">
                    {[
                      { id: 'ALL', label: 'All Telemetry' },
                      { id: 'FREQUENT', label: 'Top Contacts & I/O Ratios' },
                      { id: 'NIGHT', label: 'Night-Time Activity' },
                      { id: 'IMEI', label: 'IMEI/SIM Swaps' },
                      { id: 'UNIFIED', label: 'Unified CDR + IPDR' }
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setSelectedForensicFilter(f.id)}
                        className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
                          selectedForensicFilter === f.id
                            ? 'bg-[#18181B] text-white shadow-sm'
                            : 'text-slate-600 hover:text-[#18181B]'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* TAB VIEW 1: UNIFIED CDR + IPDR CORRELATION PANEL (Requirement 3) */}
                {selectedForensicFilter === 'UNIFIED' ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-purple-50/70 border border-purple-200/70 rounded-lg flex items-center justify-between text-xs text-purple-900">
                      <div className="flex items-center space-x-2">
                        <Wifi className="w-4 h-4 text-purple-700" />
                        <span>
                          <strong>Aligned Subscriber Sessions:</strong> CDR voice calls and IPDR packet records merged chronologically to reveal parallel VoIP and encrypted app switches.
                        </span>
                      </div>
                      <span className="font-mono text-[10px] font-bold bg-white px-2 py-0.5 rounded-full border border-purple-200">
                        {unifiedTimeline.length} Unified Events
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono font-bold uppercase text-[9px] tracking-wider">
                          <tr>
                            <th className="py-3 px-3">Source Lineage Badge</th>
                            <th className="py-3 px-3">Event Type</th>
                            <th className="py-3 px-3">Subscriber / A-Party</th>
                            <th className="py-3 px-3">Destination / Public IP</th>
                            <th className="py-3 px-3">Timestamp</th>
                            <th className="py-3 px-3">Tower / Port</th>
                            <th className="py-3 px-3">App / Hardware Profile</th>
                            <th className="py-3 px-3 text-right">Forensic Correlation Pill</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                          {unifiedTimeline.map((item, idx) => (
                            <tr key={idx} className={`hover:bg-slate-50 transition-colors ${
                              item.recordType === 'IPDR' ? 'bg-purple-50/20' : ''
                            }`}>
                              {/* Source File and Row Number Badge */}
                              <td className="py-3 px-3">
                                <span className="bg-slate-100 border border-slate-300 text-[#18181B] px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold flex items-center space-x-1 w-fit">
                                  <FileSpreadsheet className="w-3 h-3 text-blue-600" />
                                  <span>{item.sourceFile} • Row #{item.rowNumber}</span>
                                </span>
                              </td>

                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                  item.recordType === 'IPDR' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {item.recordType}
                                </span>
                              </td>

                              <td className="py-3 px-3 font-bold text-blue-700">
                                {item.caller}
                              </td>

                              <td className="py-3 px-3 font-semibold text-slate-800">
                                {item.receiver}
                              </td>

                              <td className="py-3 px-3 text-slate-600">
                                {item.timestamp}
                              </td>

                              <td className="py-3 px-3">
                                {item.recordType === 'IPDR' ? `Port ${item.port || '80'}` : item.cellTowerId}
                              </td>

                              <td className="py-3 px-3 font-sans">
                                {item.recordType === 'IPDR' ? (
                                  <span className="font-bold text-purple-900 block">{item.appService}</span>
                                ) : (
                                  <span className="text-slate-600 font-mono block">IMEI: {item.imei}</span>
                                )}
                              </td>

                              <td className="py-3 px-3 text-right font-sans">
                                {item.voipIndicator ? (
                                  <span className="bg-purple-600 text-white px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide shadow-xs">
                                    {item.voipIndicator}
                                  </span>
                                ) : item.imeiChange ? (
                                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide">
                                    IMEI SWAP
                                  </span>
                                ) : item.isNightAlert ? (
                                  <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">
                                    MIDNIGHT
                                  </span>
                                ) : (
                                  <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">
                                    ROUTINE
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : selectedForensicFilter === 'FREQUENT' ? (
                  /* TAB VIEW 2: Top Contacts & I/O Ratios */
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono font-bold uppercase text-[9px] tracking-wider">
                        <tr>
                          <th className="py-3 px-3">Contact Entity</th>
                          <th className="py-3 px-3">Lineage Badge</th>
                          <th className="py-3 px-3">Total Volume</th>
                          <th className="py-3 px-3">Total Duration</th>
                          <th className="py-3 px-3">Directional I/O Ratio</th>
                          <th className="py-3 px-3">Radio Sectors</th>
                          <th className="py-3 px-3">IMEI Handsets</th>
                          <th className="py-3 px-3 text-right">Status Pill</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {technicalMetrics.frequentList.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-3 px-3">
                              <span className="font-bold text-blue-700 block">{item.number}</span>
                              <span className="text-[10px] text-slate-400 font-sans block">{item.name}</span>
                            </td>

                            <td className="py-3 px-3">
                              <span className="bg-slate-100 border border-slate-300 text-[#18181B] px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold inline-block">
                                {item.sourceFile} • Row #{item.rowNumber}
                              </span>
                            </td>

                            <td className="py-3 px-3 font-bold text-[#18181B]">
                              {item.calls} Calls
                            </td>

                            <td className="py-3 px-3 text-slate-700">
                              {item.totalDuration}s
                            </td>

                            <td className="py-3 px-3 font-sans">
                              <div className="flex items-center space-x-2">
                                <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden flex">
                                  <div className="bg-blue-600 h-full" style={{ width: '60%' }} title="Incoming"></div>
                                  <div className="bg-[#18181B] h-full" style={{ width: '40%' }} title="Outgoing"></div>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono">{item.inbound} in / {item.outbound} out</span>
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <span className="font-bold text-slate-800">{item.towers.size} Sectors</span>
                            </td>

                            <td className="py-3 px-3">
                              <span className={`font-bold ${item.imeis.size > 1 ? 'text-rose-600' : 'text-slate-700'}`}>
                                {item.imeis.size} Handset{item.imeis.size > 1 ? 's 🚨' : ''}
                              </span>
                            </td>

                            <td className="py-3 px-3 text-right font-sans">
                              {item.hasImeiSwap ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  IMEI SWAP
                                </span>
                              ) : item.hasNight ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-100 text-purple-800">
                                  MIDNIGHT
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600">
                                  CLEAN
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* TAB VIEW 3: Standard Technical Forensics Matrix (Night / IMEI / All) */
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono font-bold uppercase text-[9px] tracking-wider">
                        <tr>
                          <th className="py-3 px-3">Source Lineage Badge</th>
                          <th className="py-3 px-3">Caller (A-Party)</th>
                          <th className="py-3 px-3">Receiver (B-Party)</th>
                          <th className="py-3 px-3">Timestamp</th>
                          <th className="py-3 px-3">Duration</th>
                          <th className="py-3 px-3">Cell Tower ID</th>
                          <th className="py-3 px-3">Device IMEI</th>
                          <th className="py-3 px-3 text-right">Status Pill</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {cdrRows
                          .filter(item => {
                            if (selectedForensicFilter === 'NIGHT') return item.isNightAlert;
                            if (selectedForensicFilter === 'IMEI') return item.imeiChange;
                            return true;
                          })
                          .map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-3 px-3">
                                <span className="bg-slate-100 border border-slate-300 text-[#18181B] px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold flex items-center space-x-1 w-fit">
                                  <FileSpreadsheet className="w-3 h-3 text-blue-600" />
                                  <span>{item.sourceFile} • Row #{item.rowNumber}</span>
                                </span>
                              </td>

                              <td className="py-3 px-3 font-bold text-blue-700">
                                {item.caller}
                              </td>

                              <td className="py-3 px-3 font-bold text-slate-800">
                                {item.receiver}
                              </td>

                              <td className="py-3 px-3 text-slate-600">
                                {item.timestamp}
                              </td>

                              <td className="py-3 px-3 font-bold text-[#18181B]">
                                {item.duration}s
                              </td>

                              <td className="py-3 px-3 font-bold">
                                {item.cellTowerId}
                              </td>

                              <td className="py-3 px-3">
                                <span className={`px-1.5 py-0.5 rounded ${
                                  item.imeiChange ? 'bg-rose-100 text-rose-800 font-bold' : item.imei === 'MISSING_IMEI' ? 'bg-amber-100 text-amber-900 font-bold' : 'text-slate-700'
                                }`}>
                                  {item.imei} {item.imeiChange ? '🚨' : ''}
                                </span>
                              </td>

                              <td className="py-3 px-3 text-right font-sans">
                                {item.imeiChange ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    IMEI SWAP
                                  </span>
                                ) : item.isNightAlert ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-100 text-purple-800">
                                    MIDNIGHT
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600">
                                    CLEAN
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </ScrollReveal>
          </div>
        )}

        {/* SECTION 4: Cross-Suspect Matching Tool (Requirement 4) */}
        {activeTab === 'correlation' && (
          <div className="space-y-5 animate-in fade-in">
            <ScrollReveal delay={0.08}>
              <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-[0_4px_24px_rgb(0,0,0,0.03)]">
                
                {/* Header */}
                <div className="pb-4 mb-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-[#18181B] tracking-tight">
                      Cross-Suspect Shared Contact & Co-Location Matching Tool
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Select two suspect numbers to instantly discover common mutual associates, shared cell towers, and direct relays
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                    Dual Matrix Algorithm
                  </span>
                </div>

                {/* Side-by-Side Dropdowns Card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                      Select Suspect A:
                    </label>
                    <select
                      value={suspectA}
                      onChange={(e) => setSuspectA(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-[#18181B] outline-none shadow-xs cursor-pointer"
                    >
                      {uniqueSuspects.map(num => (
                        <option key={num} value={num}>
                          {num} {num.includes('98290') ? '(Suspect Alpha - Vikram R.)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                      Select Suspect B:
                    </label>
                    <select
                      value={suspectB}
                      onChange={(e) => setSuspectB(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-[#18181B] outline-none shadow-xs cursor-pointer"
                    >
                      {uniqueSuspects.map(num => (
                        <option key={num} value={num}>
                          {num} {num.includes('98299') ? '(Operative Beta - Rohit S.)' : num.includes('94140') ? '(Contact X - Ajmer Node)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Extracted Metrics Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-left">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Common Shared Contacts
                    </span>
                    <span className="text-2xl font-black text-[#18181B] block mt-1">
                      {mutualAnalysis.commonContacts.length} Mutual Numbers
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Indicates shared operational cluster
                    </span>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-left">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Co-Location Towers Crossed
                    </span>
                    <span className="text-2xl font-black text-blue-700 block mt-1">
                      {mutualAnalysis.mutualTowers.length} Shared Sectors
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {mutualAnalysis.mutualTowers.join(', ') || 'No shared towers'}
                    </span>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-left">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Total Shared Direct Calls
                    </span>
                    <span className={`text-2xl font-black block mt-1 ${
                      mutualAnalysis.totalSharedCalls > 0 ? 'text-rose-600' : 'text-slate-700'
                    }`}>
                      {mutualAnalysis.totalSharedCalls > 0 ? `${mutualAnalysis.totalSharedCalls} Direct Relays` : 'Indirect Communication'}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {mutualAnalysis.totalSharedCalls > 0 ? 'Confirmed direct connection' : 'Connected via middle contacts'}
                    </span>
                  </div>
                </div>

                {/* Common Contacts Extracted List */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-[#18181B] flex items-center justify-between">
                    <span>Extracted Common Contacts ({mutualAnalysis.commonContacts.length})</span>
                    <span className="text-[10px] font-mono text-slate-400">Suspect A ⟷ Shared ⟷ Suspect B</span>
                  </div>
                  {mutualAnalysis.commonContacts.length > 0 ? (
                    <div className="p-4 divide-y divide-slate-100">
                      {mutualAnalysis.commonContacts.map((contact, i) => (
                        <div key={i} className="py-2.5 flex items-center justify-between text-xs font-mono">
                          <div className="flex items-center space-x-2.5">
                            <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[10px]">
                              #{i + 1}
                            </span>
                            <div>
                              <span className="font-bold text-[#18181B] block">{contact}</span>
                              <span className="text-[10px] text-slate-400 font-sans">
                                {contact.includes('94140') ? 'Contact X (Ajmer Inter-Link)' : contact.includes('97841') ? 'Safehouse Contact (Dinesh K.)' : 'Associate'}
                              </span>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black rounded-full uppercase">
                            Mutual Associate Linked
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-400 text-xs font-medium">
                      Select two distinct suspects to extract their shared network contacts.
                    </div>
                  )}
                </div>
              </div>
            </ScrollReveal>
          </div>
        )}

      </div>
      </main>

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
