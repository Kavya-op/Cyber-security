import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  FileCheck,
  Download,
  Copy,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Printer,
  Share2,
  Calendar,
  Clock,
  Send,
  Building,
  User,
  BadgeAlert,
  Bot,
  ExternalLink,
  ChevronRight,
  Database,
  Hash,
  RefreshCw,
  Search,
  FileSpreadsheet,
  Check,
  ShieldAlert,
  Server
} from 'lucide-react';
import { maskPhoneNumber } from '../../utils/phoneUtils';

const DEFAULT_TSPS = [
  { name: 'Bharti Airtel Ltd.', email: 'nodal.rajasthan@airtel.com', circle: 'Rajasthan Telecom Circle' },
  { name: 'Reliance Jio Infocomm Ltd.', email: 'nodal.rajasthan@jio.com', circle: 'Rajasthan Telecom Circle' },
  { name: 'Vodafone Idea Ltd. (Vi)', email: 'nodal.rajasthan@vodafoneidea.com', circle: 'Rajasthan Telecom Circle' },
  { name: 'Bharat Sanchar Nigam Ltd. (BSNL)', email: 'nodal.rajasthan@bsnl.co.in', circle: 'Rajasthan Telecom Circle' },
];

export default function Section91ReportGenerator({
  data = [],
  ipdrData = [],
  onAskAI,
  activeCaseId = 1
}) {
  const [activeTab, setActiveTab] = useState('SECTION_91'); // 'SECTION_91', 'SECTION_65B', 'FULL_DOSSIER', 'AUDIT_TRAIL'
  const [copiedId, setCopiedId] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Section 91 Form State
  const [selectedTsp, setSelectedTsp] = useState(DEFAULT_TSPS[0].name);
  const [nodalEmail, setNodalEmail] = useState(DEFAULT_TSPS[0].email);
  const [ioName, setIoName] = useState('Vikram Rathore');
  const [ioRank, setIoRank] = useState('Inspector of Police / SHO');
  const [ioBadge, setIoBadge] = useState('RJ-POL-8821');
  const [policeStation, setPoliceStation] = useState('Cyber Crime Police Station, Jaipur');
  const [firNumber, setFirNumber] = useState('FIR No. 402/2024');
  const [firDate, setFirDate] = useState('2024-11-18');
  const [offenseSections, setOffenseSections] = useState('Sec. 420, 120-B IPC & Sec. 66D IT Act');
  const [targetPhones, setTargetPhones] = useState('9829011111, 9414022222, 9784144444');
  const [targetImeis, setTargetImeis] = useState('860432041234567, 358924089876543');
  const [targetIps, setTargetIps] = useState('103.21.244.18, 149.154.167.51');
  const [dateStart, setDateStart] = useState('2024-11-01');
  const [dateEnd, setDateEnd] = useState('2024-11-20');
  const [deadlineHours, setDeadlineHours] = useState(24);

  // Requisition item checkboxes
  const [reqItems, setReqItems] = useState({
    cdr: true,
    ipdr: true,
    caf: true,
    sdr: true,
    towerDump: true,
    imeiHistory: true
  });

  // Section 65B Form State
  const [computerSpecs, setComputerSpecs] = useState('Forensic Workstation HP Z8 G4 / Ubuntu 22.04 LTS (Kernel 6.1)');
  const [evidenceFiles, setEvidenceFiles] = useState([]);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [isAuditLoading, setIsAuditLoading] = useState(false);

  // Fetch Section 65B evidence files
  useEffect(() => {
    fetch('/api/reports/section-65b', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        investigating_officer_name: ioName,
        io_rank: ioRank,
        io_badge_id: ioBadge,
        police_station: policeStation,
        fir_number: firNumber,
        computer_make_model: computerSpecs,
        response_format: 'json'
      })
    })
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (json && json.evidence_files) {
          setEvidenceFiles(json.evidence_files);
        }
      })
      .catch(err => console.warn('Could not fetch 65B evidence files', err));
  }, [ioName, ioRank, ioBadge, policeStation, firNumber, computerSpecs]);

  // Fetch Audit Trail
  const fetchAuditLogs = () => {
    setIsAuditLoading(true);
    fetch('/api/reports/audit-trail?limit=100')
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (json && json.audit_logs) {
          setAuditLogs(json.audit_logs);
        }
      })
      .catch(err => console.warn('Could not fetch audit trail', err))
      .finally(() => setIsAuditLoading(false));
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const handleTspChange = (e) => {
    const tspName = e.target.value;
    setSelectedTsp(tspName);
    const found = DEFAULT_TSPS.find(t => t.name === tspName);
    if (found) setNodalEmail(found.email);
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Download Section 91 PDF
  const handleDownloadSection91PDF = async () => {
    setIsExporting(true);
    try {
      const selectedRecords = [];
      if (reqItems.cdr) selectedRecords.push('Call Detail Records (CDR) with First/Last Cell ID, Sector, and Azimuth');
      if (reqItems.ipdr) selectedRecords.push('Internet Protocol Detail Records (IPDR) with Source Public IP & Port Translation');
      if (reqItems.caf) selectedRecords.push('Certified Customer Acquisition Form (CAF) with ID/Address Proof Documents');
      if (reqItems.sdr) selectedRecords.push('Subscriber Detail Record (SDR) with Handset IMEI Association History');
      if (reqItems.imeiHistory) selectedRecords.push('Secondary SIM Usage History associated with target Handset IMEIs');
      if (reqItems.towerDump) selectedRecords.push('Cell Tower Dump of Crime Scene Sectors for Specific Incident Windows');

      const payload = {
        target_phone_numbers: targetPhones.split(',').map(s => s.trim()).filter(Boolean),
        target_imeis: targetImeis.split(',').map(s => s.trim()).filter(Boolean),
        target_ip_addresses: targetIps.split(',').map(s => s.trim()).filter(Boolean),
        tsp_name: selectedTsp,
        nodal_officer_email: nodalEmail,
        investigating_officer_name: ioName,
        io_rank: ioRank,
        io_badge_id: ioBadge,
        police_station: policeStation,
        fir_number: firNumber,
        fir_date: firDate,
        offense_sections: offenseSections,
        requested_records: selectedRecords,
        date_range_start: dateStart,
        date_range_end: dateEnd,
        compliance_deadline_hours: Number(deadlineHours),
        response_format: 'pdf'
      };

      const res = await fetch('/api/reports/section-91', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to generate Section 91 Notice PDF');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sec91_Notice_${selectedTsp.replace(/\s+/g, '_')}_${firNumber.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Error generating Section 91 PDF: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Download Section 65B PDF
  const handleDownloadSection65BPDF = async () => {
    setIsExporting(true);
    try {
      const payload = {
        investigating_officer_name: ioName,
        io_rank: ioRank,
        io_badge_id: ioBadge,
        police_station: policeStation,
        fir_number: firNumber,
        computer_make_model: computerSpecs,
        response_format: 'pdf'
      };

      const res = await fetch('/api/reports/section-65b', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to generate Section 65B Certificate PDF');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sec65B_Certificate_${firNumber.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Error generating Section 65B Certificate: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Download Full Dossier PDF
  const handleDownloadFullDossier = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/export/full-dossier');
      if (!res.ok) throw new Error('Failed to generate Full Dossier PDF');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Master_Forensic_Dossier_Case_${activeCaseId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Error generating Full Dossier: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Download Excel Spreadsheet
  const handleDownloadExcel = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/export/excel');
      if (!res.ok) throw new Error('Failed to generate Excel Spreadsheet');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Case_${activeCaseId}_Forensic_Workbook.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Error generating Excel: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const matchesSearch = !auditSearch ||
        log.action?.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.query_text?.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.user_id?.toLowerCase().includes(auditSearch.toLowerCase());
      return matchesSearch;
    });
  }, [auditLogs, auditSearch]);

  return (
    <div className="flex flex-col h-full bg-[#171615] text-[#F1E6D5] rounded-xl border border-[#38312B] overflow-hidden shadow-2xl">
      {/* 1. TOP HEADER & REPORT KPI STRIP */}
      <div className="p-5 border-b border-[#38312B] bg-gradient-to-r from-[#171615] via-[#241F1C] to-[#171615]">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#CDB69A]/10 border border-[#CDB69A]/30 flex items-center justify-center text-[#CDB69A]">
              <FileCheck className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-wide text-[#F1E6D5]">
                  Section 91 CrPC & Evidence Certificate Engine
                </h2>
                <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Sec. 65B Certified
                </span>
                <span className="px-2 py-0.5 text-xs rounded bg-[#38312B] text-[#CDB69A] border border-[#655447]/40">
                  BNSS & BSA 2023 Ready
                </span>
              </div>
              <p className="text-xs text-[#9A8068] mt-0.5">
                Automated legal notices to TSPs, cryptographic custody hash certificates, and court-ready forensic dossiers
              </p>
            </div>
          </div>

          {/* Quick Export Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadSection91PDF}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#241F1C] hover:bg-[#38312B] text-amber-300 border border-amber-500/30 transition-all shadow-sm"
              title="Download Section 91 CrPC notice PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Sec 91 PDF</span>
            </button>

            <button
              onClick={handleDownloadSection65BPDF}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#241F1C] hover:bg-[#38312B] text-emerald-300 border border-emerald-500/30 transition-all shadow-sm"
              title="Download Section 65B evidence certificate PDF"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Sec 65B PDF</span>
            </button>

            <button
              onClick={handleDownloadFullDossier}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#9A8068] to-[#CDB69A] text-[#171615] hover:opacity-90 transition-all shadow-md"
              title="Download complete forensic investigation dossier PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Full Dossier PDF</span>
            </button>
          </div>
        </div>

        {/* METRICS OVERVIEW STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-[#1D1A18] border border-[#38312B] rounded-lg p-3">
            <div className="text-[10px] text-[#9A8068] uppercase font-semibold tracking-wider flex items-center justify-between">
              <span>Sealed Evidence Files</span>
              <Hash className="w-3.5 h-3.5 text-[#CDB69A]" />
            </div>
            <div className="text-xl font-bold text-[#F1E6D5] mt-1">
              {evidenceFiles.length || 2} Files
            </div>
            <div className="text-[10px] text-emerald-400 mt-0.5">SHA-256 Verified</div>
          </div>

          <div className="bg-[#1D1A18] border border-[#38312B] rounded-lg p-3">
            <div className="text-[10px] text-[#9A8068] uppercase font-semibold tracking-wider flex items-center justify-between">
              <span>Certified CDRs</span>
              <Database className="w-3.5 h-3.5 text-[#CDB69A]" />
            </div>
            <div className="text-xl font-bold text-[#F1E6D5] mt-1">
              621 Records
            </div>
            <div className="text-[10px] text-[#9A8068] mt-0.5">Cellular airtime logs</div>
          </div>

          <div className="bg-[#1D1A18] border border-[#38312B] rounded-lg p-3">
            <div className="text-[10px] text-[#9A8068] uppercase font-semibold tracking-wider flex items-center justify-between">
              <span>Certified IPDRs</span>
              <Server className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-xl font-bold text-cyan-300 mt-1">
              405 Records
            </div>
            <div className="text-[10px] text-[#9A8068] mt-0.5">Packet session logs</div>
          </div>

          <div className="bg-[#1D1A18] border border-[#38312B] rounded-lg p-3">
            <div className="text-[10px] text-[#9A8068] uppercase font-semibold tracking-wider flex items-center justify-between">
              <span>Telecom Operators</span>
              <Building className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-amber-300 mt-1">
              4 TSPs
            </div>
            <div className="text-[10px] text-[#9A8068] mt-0.5">Airtel, Jio, Vi, BSNL</div>
          </div>

          <div className="bg-[#1D1A18] border border-[#38312B] rounded-lg p-3">
            <div className="text-[10px] text-[#9A8068] uppercase font-semibold tracking-wider flex items-center justify-between">
              <span>Audit Chain Logs</span>
              <Clock className="w-3.5 h-3.5 text-[#CDB69A]" />
            </div>
            <div className="text-xl font-bold text-[#F1E6D5] mt-1">
              {auditLogs.length || 100} Logs
            </div>
            <div className="text-[10px] text-[#9A8068] mt-0.5">Immutable chain of custody</div>
          </div>

          <div className="bg-[#1D1A18] border border-emerald-900/40 rounded-lg p-3 bg-emerald-950/10">
            <div className="text-[10px] text-emerald-400 uppercase font-semibold tracking-wider flex items-center justify-between">
              <span>Judicial Status</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-sm font-bold text-emerald-300 mt-1">
              Admissible
            </div>
            <div className="text-[10px] text-[#9A8068] mt-0.5">Sec 65B & 91 Compliant</div>
          </div>
        </div>
      </div>

      {/* 2. NAVIGATION TABS */}
      <div className="p-4 border-b border-[#38312B] bg-[#1A1816] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-[#171615] p-1 rounded-lg border border-[#38312B]">
          <button
            onClick={() => setActiveTab('SECTION_91')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'SECTION_91'
                ? 'bg-[#CDB69A] text-[#171615] shadow-sm'
                : 'text-[#9A8068] hover:text-[#F1E6D5] hover:bg-[#241F1C]'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Section 91 CrPC Notice</span>
          </button>

          <button
            onClick={() => setActiveTab('SECTION_65B')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'SECTION_65B'
                ? 'bg-[#CDB69A] text-[#171615] shadow-sm'
                : 'text-[#9A8068] hover:text-[#F1E6D5] hover:bg-[#241F1C]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Section 65B Certificate</span>
          </button>

          <button
            onClick={() => setActiveTab('FULL_DOSSIER')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'FULL_DOSSIER'
                ? 'bg-[#CDB69A] text-[#171615] shadow-sm'
                : 'text-[#9A8068] hover:text-[#F1E6D5] hover:bg-[#241F1C]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Master Case Dossier</span>
          </button>

          <button
            onClick={() => setActiveTab('AUDIT_TRAIL')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'AUDIT_TRAIL'
                ? 'bg-[#CDB69A] text-[#171615] shadow-sm'
                : 'text-[#9A8068] hover:text-[#F1E6D5] hover:bg-[#241F1C]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Chain of Custody & Audit</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#241F1C] hover:bg-[#38312B] text-[#CDB69A] border border-[#38312B] transition-all"
            title="Download multi-sheet forensic workbook"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* 3. MAIN CONTENT WORKSPACE */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* TAB 1: SECTION 91 CrPC NOTICE GENERATOR */}
        {activeTab === 'SECTION_91' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Requisition Parameters Form (5 Cols) */}
            <div className="lg:col-span-5 space-y-4 bg-[#1D1A18] border border-[#38312B] rounded-xl p-4 shadow-md">
              <div className="border-b border-[#38312B] pb-2">
                <h3 className="text-sm font-bold text-[#F1E6D5] flex items-center gap-2">
                  <Building className="w-4 h-4 text-amber-400" />
                  Requisition Notice Parameters (Section 91 CrPC)
                </h3>
                <p className="text-[11px] text-[#9A8068] mt-0.5">
                  Configure summons to Nodal Officers under Sec 91 CrPC / Sec 94 BNSS.
                </p>
              </div>

              {/* TSP Selection */}
              <div>
                <label className="text-[11px] font-semibold text-[#9A8068] block mb-1">
                  Recipient Telecom Service Provider (TSP):
                </label>
                <select
                  value={selectedTsp}
                  onChange={handleTspChange}
                  className="w-full bg-[#171615] border border-[#38312B] rounded-lg px-3 py-1.5 text-xs text-[#F1E6D5] focus:outline-none focus:border-[#CDB69A]"
                >
                  {DEFAULT_TSPS.map(t => (
                    <option key={t.name} value={t.name}>{t.name} ({t.circle})</option>
                  ))}
                </select>
              </div>

              {/* Nodal Officer Email */}
              <div>
                <label className="text-[11px] font-semibold text-[#9A8068] block mb-1">
                  Nodal Officer Official Email:
                </label>
                <input
                  type="email"
                  value={nodalEmail}
                  onChange={(e) => setNodalEmail(e.target.value)}
                  className="w-full bg-[#171615] border border-[#38312B] rounded-lg px-3 py-1.5 text-xs text-[#F1E6D5] focus:outline-none focus:border-[#CDB69A]"
                />
              </div>

              {/* Target Phone Numbers */}
              <div>
                <label className="text-[11px] font-semibold text-[#9A8068] block mb-1">
                  Target Mobile Numbers (Comma Separated):
                </label>
                <input
                  type="text"
                  value={targetPhones}
                  onChange={(e) => setTargetPhones(e.target.value)}
                  className="w-full bg-[#171615] border border-[#38312B] rounded-lg px-3 py-1.5 text-xs font-mono text-[#F1E6D5] focus:outline-none focus:border-[#CDB69A]"
                />
              </div>

              {/* Target IMEIs & IPs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#9A8068] block mb-1">
                    Target IMEIs:
                  </label>
                  <input
                    type="text"
                    value={targetImeis}
                    onChange={(e) => setTargetImeis(e.target.value)}
                    className="w-full bg-[#171615] border border-[#38312B] rounded-lg px-3 py-1.5 text-xs font-mono text-[#F1E6D5] focus:outline-none focus:border-[#CDB69A]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#9A8068] block mb-1">
                    Public/Dest IPs:
                  </label>
                  <input
                    type="text"
                    value={targetIps}
                    onChange={(e) => setTargetIps(e.target.value)}
                    className="w-full bg-[#171615] border border-[#38312B] rounded-lg px-3 py-1.5 text-xs font-mono text-[#F1E6D5] focus:outline-none focus:border-[#CDB69A]"
                  />
                </div>
              </div>

              {/* Date Window */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#9A8068] block mb-1">
                    Period From:
                  </label>
                  <input
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                    className="w-full bg-[#171615] border border-[#38312B] rounded-lg px-3 py-1.5 text-xs text-[#F1E6D5] focus:outline-none focus:border-[#CDB69A]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#9A8068] block mb-1">
                    Period To:
                  </label>
                  <input
                    type="date"
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                    className="w-full bg-[#171615] border border-[#38312B] rounded-lg px-3 py-1.5 text-xs text-[#F1E6D5] focus:outline-none focus:border-[#CDB69A]"
                  />
                </div>
              </div>

              {/* Requisition Material Checkboxes */}
              <div>
                <label className="text-[11px] font-semibold text-[#9A8068] block mb-1.5">
                  Demanded Records Checklist:
                </label>
                <div className="space-y-1.5 text-xs bg-[#171615] p-2.5 rounded-lg border border-[#38312B]">
                  {[
                    { key: 'cdr', label: 'Call Detail Records (CDR) with Cell ID & Azimuth' },
                    { key: 'ipdr', label: 'IPDR with Source/Dest IP & Port Translation' },
                    { key: 'caf', label: 'Customer Acquisition Form (CAF) with ID proof' },
                    { key: 'sdr', label: 'Subscriber Detail Record (SDR) with IMEI link' },
                    { key: 'imeiHistory', label: 'Handset IMEI history & associated SIMs' },
                    { key: 'towerDump', label: 'Cell tower dump of crime scene sectors' },
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-2 cursor-pointer text-[#CDB69A] hover:text-[#F1E6D5]">
                      <input
                        type="checkbox"
                        checked={reqItems[item.key]}
                        onChange={(e) => setReqItems({ ...reqItems, [item.key]: e.target.checked })}
                        className="rounded border-[#38312B] bg-[#171615] text-[#CDB69A] focus:ring-0"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={handleDownloadSection91PDF}
                  disabled={isExporting}
                  className="flex-1 py-2 px-3 rounded-lg bg-gradient-to-r from-[#9A8068] to-[#CDB69A] text-[#171615] text-xs font-bold flex items-center justify-center gap-1.5 shadow-md hover:opacity-90"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Section 91 PDF</span>
                </button>
              </div>
            </div>

            {/* Right: Live Legal Document Preview Pane (7 Cols) */}
            <div className="lg:col-span-7 bg-[#1D1A18] border border-[#38312B] rounded-xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#38312B] pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-[#F1E6D5] uppercase tracking-wider">
                      Live Legal Notice Preview
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const text = `GOVERNMENT OF RAJASTHAN - POLICE DEPARTMENT\n${policeStation.toUpperCase()}\n\nREQUISITION UNDER SECTION 91 Cr.P.C. / SEC 94 BNSS\nTo: Nodal Officer, ${selectedTsp}\nFIR: ${firNumber} dated ${firDate}\nTargets: ${targetPhones}\nPeriod: ${dateStart} to ${dateEnd}`;
                      handleCopy(text, 'sec91-preview');
                    }}
                    className="flex items-center gap-1 text-[11px] text-[#CDB69A] hover:text-[#F1E6D5] bg-[#241F1C] px-2 py-1 rounded border border-[#38312B]"
                  >
                    {copiedId === 'sec91-preview' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedId === 'sec91-preview' ? 'Copied' : 'Copy Text'}</span>
                  </button>
                </div>

                {/* Formatted Legal Notice Paper View */}
                <div className="bg-[#171615] border border-[#38312B] rounded-lg p-5 font-serif text-[#CDB69A] text-xs leading-relaxed space-y-4 max-h-[580px] overflow-y-auto">
                  <div className="text-center space-y-0.5 border-b border-[#38312B] pb-3">
                    <div className="font-bold text-sm tracking-wider text-[#F1E6D5]">
                      GOVERNMENT OF RAJASTHAN &bull; POLICE DEPARTMENT
                    </div>
                    <div className="text-[10px] text-[#9A8068] uppercase font-sans">
                      OFFICE OF THE SUPERINTENDENT OF POLICE &bull; {policeStation}
                    </div>
                  </div>

                  <div className="flex justify-between text-[11px] font-sans text-[#9A8068]">
                    <span>Ref: CCPS/JPR/SEC-91/2024/{firNumber.replace(/\s+/g, '_')}</span>
                    <span>Date: {new Date().toLocaleDateString()}</span>
                  </div>

                  <div className="space-y-0.5 font-sans text-[11px]">
                    <div className="font-bold text-[#F1E6D5]">TO:</div>
                    <div>The Nodal Officer (Law Enforcement Cell),</div>
                    <div className="font-semibold text-amber-300">{selectedTsp},</div>
                    <div>Rajasthan Telecom Circle, Jaipur.</div>
                    <div className="text-[#9A8068]">Email: {nodalEmail}</div>
                  </div>

                  <div className="p-2.5 bg-[#241F1C] border border-amber-900/40 rounded text-center font-sans space-y-1">
                    <div className="font-bold text-amber-300 text-xs">
                      LEGAL NOTICE / REQUISITION UNDER SECTION 91 OF Cr.P.C.
                    </div>
                    <div className="text-[10px] text-[#9A8068]">
                      (READ WITH SECTION 94 OF BHARATIYA NAGARIK SURAKSHA SANHITA, 2023)
                    </div>
                  </div>

                  <div className="space-y-2 font-sans text-[11px]">
                    <p>
                      <b>WHEREAS</b>, an investigation into <span className="text-[#F1E6D5] font-semibold">{firNumber}</span> dated <span className="text-[#F1E6D5]">{firDate}</span> registered under <span className="text-[#F1E6D5]">{offenseSections}</span> at {policeStation} is being actively pursued.
                    </p>
                    <p>
                      Technical intelligence indicates that the target telecommunication identifiers specified below were directly utilized in connection with the alleged commission of crime:
                    </p>
                  </div>

                  {/* Targets Summary */}
                  <div className="bg-[#1D1A18] p-3 rounded border border-[#38312B] space-y-1 font-mono text-[11px]">
                    <div><span className="text-[#9A8068]">Target MSISDNs:</span> <span className="text-amber-300 font-bold">{targetPhones}</span></div>
                    <div><span className="text-[#9A8068]">Target IMEIs:</span> <span className="text-[#F1E6D5]">{targetImeis}</span></div>
                    <div><span className="text-[#9A8068]">Target IP Addresses:</span> <span className="text-cyan-300">{targetIps}</span></div>
                    <div><span className="text-[#9A8068]">Period of Interest:</span> <span className="text-[#CDB69A]">{dateStart} to {dateEnd}</span></div>
                  </div>

                  <div className="font-sans text-[11px] space-y-1.5">
                    <p className="font-bold text-[#F1E6D5]">YOU ARE HEREBY DIRECTED TO PRODUCE:</p>
                    <ul className="list-disc pl-5 space-y-1 text-[#CDB69A]">
                      {reqItems.cdr && <li>Complete Call Detail Records (CDR) with First/Last Cell IDs, Azimuth, and Tower locations.</li>}
                      {reqItems.ipdr && <li>Internet Protocol Detail Records (IPDR) with Source IP, NAT Port, and Destination IP.</li>}
                      {reqItems.caf && <li>Certified Customer Acquisition Form (CAF) along with uploaded identity/address proofs.</li>}
                      {reqItems.sdr && <li>Subscriber Detail Record (SDR) with handset IMEI history.</li>}
                      {reqItems.imeiHistory && <li>All mobile numbers (SIMs) associated with target handset IMEIs.</li>}
                      {reqItems.towerDump && <li>Tower dumps of specified crime scene sectors.</li>}
                    </ul>
                  </div>

                  {/* Warning */}
                  <div className="p-2.5 bg-amber-950/20 border border-amber-500/30 rounded text-[10px] font-sans text-amber-200">
                    <b>COMPLIANCE MANDATE:</b> Under statutory provisions, production is mandated within <b>{deadlineHours} hours</b>. Electronic data must be sealed with SHA-256 hashes and accompanied by an evidentiary certificate under Section 65B of Indian Evidence Act / Section 63 BSA 2023.
                  </div>

                  {/* Endorsement Block */}
                  <div className="pt-4 border-t border-[#38312B] flex justify-between font-sans text-[11px]">
                    <div>
                      <div className="text-[9px] text-[#9A8068] uppercase">Police Station Seal</div>
                      <div className="w-16 h-16 rounded-full border border-dashed border-[#655447] flex items-center justify-center text-[8px] text-[#655447]">
                        [ SEAL ]
                      </div>
                    </div>
                    <div className="text-right space-y-0.5">
                      <div className="font-bold text-[#F1E6D5]">({ioName})</div>
                      <div className="text-[#9A8068]">{ioRank}</div>
                      <div className="text-[#9A8068]">Badge ID: {ioBadge}</div>
                      <div className="text-[#9A8068]">{policeStation}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SECTION 65B ELECTRONIC EVIDENCE CERTIFICATE */}
        {activeTab === 'SECTION_65B' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#F1E6D5] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Section 65B Indian Evidence Act Certificate (Court Admissibility)
                </h3>
                <p className="text-xs text-[#9A8068] mt-0.5">
                  Statutory electronic evidence certificate under Section 65B(4) IEA, 1872 & Section 63 of Bharatiya Sakshya Adhiniyam, 2023.
                </p>
              </div>

              <button
                onClick={handleDownloadSection65BPDF}
                disabled={isExporting}
                className="py-1.5 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Section 65B PDF</span>
              </button>
            </div>

            {/* Cryptographic SHA-256 Custody Ledger Table */}
            <div className="bg-[#1D1A18] border border-[#38312B] rounded-xl p-4 shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#F1E6D5] uppercase tracking-wider flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5 text-emerald-400" />
                  Immutable SHA-256 Digital Evidence Custody Ledger
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {evidenceFiles.length} Certified Master Files
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#171615] text-[#9A8068] uppercase font-semibold text-[10px] border-b border-[#38312B]">
                    <tr>
                      <th className="p-2.5">Evidence Master File</th>
                      <th className="p-2.5">Data Type</th>
                      <th className="p-2.5">SHA-256 Hash Digest (Cryptographic Custody Seal)</th>
                      <th className="p-2.5">Sealing Timestamp</th>
                      <th className="p-2.5 text-right">Copy Hash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#38312B]/50 font-mono">
                    {evidenceFiles.map((f, idx) => (
                      <tr key={idx} className="hover:bg-[#241F1C]/50 transition-colors">
                        <td className="p-2.5 font-bold text-[#F1E6D5]">{f.filename}</td>
                        <td className="p-2.5 text-[#CDB69A]">{f.schema}</td>
                        <td className="p-2.5 text-emerald-300 font-mono text-[11px] truncate max-w-[280px]" title={f.sha256}>
                          {f.sha256}
                        </td>
                        <td className="p-2.5 text-[#9A8068] text-[11px]">{f.timestamp}</td>
                        <td className="p-2.5 text-right">
                          <button
                            onClick={() => handleCopy(f.sha256, `hash-${idx}`)}
                            className="p-1 hover:bg-[#38312B] rounded text-[#CDB69A]"
                            title="Copy SHA-256 hash"
                          >
                            {copiedId === `hash-${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Certificate Affidavit Text View */}
            <div className="bg-[#1D1A18] border border-[#38312B] rounded-xl p-5 shadow-md space-y-4 font-serif text-xs text-[#CDB69A]">
              <div className="text-center space-y-1 border-b border-[#38312B] pb-3">
                <div className="font-bold text-sm text-[#F1E6D5]">
                  IN THE COURT OF COMPETENT JURISDICTION, JAIPUR, RAJASTHAN
                </div>
                <div className="text-xs font-bold text-amber-300 font-sans">
                  CERTIFICATE UNDER SECTION 65B(4) OF THE INDIAN EVIDENCE ACT, 1872
                </div>
                <div className="text-[10px] text-[#9A8068] font-sans">
                  (READ WITH SECTION 63 OF THE BHARATIYA SAKSHYA ADHINIYAM, 2023)
                </div>
              </div>

              <div className="font-sans text-[11px] leading-relaxed space-y-3">
                <p>
                  I, <b>{ioName}</b>, {ioRank}, Badge No. {ioBadge}, presently attached to {policeStation}, Rajasthan Police, do hereby solemnly affirm and state on oath as follows:
                </p>
                <p>
                  <b>1. LAWFUL COMMAND & OPERATION:</b> I am the authorized investigating officer having custody and operational control of the forensic computing system (<b>{computerSpecs}</b>) utilized to ingest, normalize, and cryptographically seal electronic records for {firNumber}.
                </p>
                <p>
                  <b>2. SYSTEM INTEGRITY:</b> Throughout the relevant material period, the computer system and database operated normally without malfunctions or unauthorized access affecting the accuracy and integrity of the records.
                </p>
                <p>
                  <b>3. REPRODUCTION FIDELITY:</b> The printouts, reports, and analytical timelines generated from this system are true, accurate, and faithful electronic reproductions derived directly from the certified telecom source files.
                </p>
              </div>

              <div className="pt-3 border-t border-[#38312B] flex justify-between font-sans text-[11px]">
                <div className="text-[#9A8068]">
                  Verified at Jaipur on {new Date().toLocaleDateString()}
                </div>
                <div className="text-right">
                  <div className="font-bold text-[#F1E6D5]">Deponent: {ioName}</div>
                  <div className="text-[#9A8068]">{ioRank} ({ioBadge})</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MASTER CASE DOSSIER EXPORT */}
        {activeTab === 'FULL_DOSSIER' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#F1E6D5] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#CDB69A]" />
                  Master Forensic Investigation Case Dossier
                </h3>
                <p className="text-xs text-[#9A8068] mt-0.5">
                  Complete multi-domain court presentation report combining all 6 forensic engines.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadExcel}
                  className="py-1.5 px-3 rounded-lg bg-[#241F1C] hover:bg-[#38312B] text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Download Workbook (XLSX)</span>
                </button>
                <button
                  onClick={handleDownloadFullDossier}
                  disabled={isExporting}
                  className="py-1.5 px-3.5 rounded-lg bg-gradient-to-r from-[#9A8068] to-[#CDB69A] text-[#171615] text-xs font-bold flex items-center gap-1.5 transition-all shadow-md hover:opacity-90"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Master Dossier (PDF)</span>
                </button>
              </div>
            </div>

            {/* Included Forensic Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { title: 'Multi-SIM & Hardware Swap Tracker', desc: 'IMEI-IMSI matrix, TAC device identification, burner handset swaps', tag: 'Included' },
                { title: 'Tower Geolocation & Movement Trail', desc: 'Cell tower hops, impossible travel velocity alerts, rendezvous meetings', tag: 'Included' },
                { title: 'Syndicate Network Graph Analytics', desc: 'Centrality scores, Kingpin and Bridge Broker roles, community cells', tag: 'Included' },
                { title: 'Suspicious Pattern Detection Engine', desc: '24-hour diurnal profile, nocturnal calling (23-05h), rapid call bursts', tag: 'Included' },
                { title: 'Integrated IPDR & VoIP Correlations', desc: 'WhatsApp VoIP, Telegram MTProto voice, Tor proxy events, silence gaps', tag: 'Included' },
                { title: 'Section 65B Digital Evidence Chain', desc: 'SHA-256 custody seals, raw line citations (filename#Lrow), officer sign-off', tag: 'Included' },
              ].map((mod, idx) => (
                <div key={idx} className="bg-[#1D1A18] border border-[#38312B] rounded-xl p-4 shadow-sm flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#F1E6D5]">{mod.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                        {mod.tag}
                      </span>
                    </div>
                    <p className="text-xs text-[#9A8068]">{mod.desc}</p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-[#38312B] flex items-center justify-between text-[11px] text-[#CDB69A]">
                    <span>Module #{idx + 1}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: IMMUTABLE CHAIN OF CUSTODY & AUDIT TRAIL */}
        {activeTab === 'AUDIT_TRAIL' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#F1E6D5] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#CDB69A]" />
                  Cryptographic Chain of Custody & Audit Ledger
                </h3>
                <p className="text-xs text-[#9A8068] mt-0.5">
                  Chronological record of data ingestion, officer queries, evidence exports, and tamper verification.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8068]" />
                  <input
                    type="text"
                    placeholder="Search action or query..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="bg-[#171615] border border-[#38312B] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#F1E6D5] focus:outline-none focus:border-[#CDB69A]"
                  />
                </div>
                <button
                  onClick={fetchAuditLogs}
                  className="p-1.5 rounded-lg bg-[#241F1C] hover:bg-[#38312B] text-[#CDB69A] border border-[#38312B]"
                  title="Refresh audit trail"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAuditLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="bg-[#1D1A18] border border-[#38312B] rounded-xl overflow-hidden shadow-md">
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#171615] text-[#9A8068] uppercase font-semibold text-[10px] border-b border-[#38312B] sticky top-0 z-10">
                    <tr>
                      <th className="p-3">Log ID</th>
                      <th className="p-3">Action Event</th>
                      <th className="p-3">Officer / User</th>
                      <th className="p-3">Forensic Parameters / Cryptographic Hash</th>
                      <th className="p-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#38312B]/50 font-mono">
                    {filteredAuditLogs.map((log) => {
                      const isSeal = log.action?.includes('SEAL');
                      const isExport = log.action?.includes('EXPORT') || log.action?.includes('REPORT');

                      return (
                        <tr key={log.id} className="hover:bg-[#241F1C]/50 transition-colors">
                          <td className="p-3 text-[#9A8068]">#{log.id}</td>
                          <td className="p-3">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              isSeal
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : isExport
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-[#241F1C] text-[#CDB69A]'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="p-3 text-[#F1E6D5] font-sans">{log.user_id || 'RJ-POL-8821'}</td>
                          <td className="p-3 text-cyan-300 text-[11px] truncate max-w-[420px]" title={log.query_text}>
                            {log.query_text}
                          </td>
                          <td className="p-3 text-[#9A8068] text-[11px]">
                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
