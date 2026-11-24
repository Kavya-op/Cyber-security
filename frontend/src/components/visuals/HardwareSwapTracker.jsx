import React, { useState, useEffect, useMemo } from 'react';
import {
  Cpu,
  Smartphone,
  ArrowRight,
  ShieldAlert,
  MapPin,
  Clock,
  Sparkles,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FileText,
  Radio,
  Layers,
  Copy,
  Info
} from 'lucide-react';
import { maskPhoneNumber } from '../../utils/phoneUtils';

// Known TAC Device Models Dictionary
const KNOWN_TAC_MODELS = {
  '86043204': 'OnePlus 11 5G (CPH2449)',
  '35892408': 'Apple iPhone 14 Pro Max (A2894)',
  '86410903': 'Samsung Galaxy S23 Ultra (SM-S918B)',
  '35678901': 'Xiaomi Redmi Note 12 Pro (22101316G)',
  '86012345': 'Vivo V27 5G (V2246)',
  '35123456': 'Nokia 105 Dual SIM (Burner Keypad)',
  '86789012': 'Realme 11 Pro+ 5G (RMX3741)',
  '35246810': 'Motorola Edge 40 Neo (XT2307-1)',
  '86123456': 'OPPO Reno 10 Pro 5G (CPH2525)',
};

function lookupTacModel(imei) {
  if (!imei) return 'Unknown Handset';
  const digits = String(imei).replace(/\D/g, '');
  if (digits.length >= 8) {
    const tac = digits.substring(0, 8);
    if (KNOWN_TAC_MODELS[tac]) return KNOWN_TAC_MODELS[tac];
    if (tac.startsWith('35')) return 'Apple / GSM Standard Handset';
    if (tac.startsWith('86')) return 'Android Smartphone (APAC / India)';
  }
  return `Cellular Device (...${digits.slice(-4)})`;
}

export default function HardwareSwapTracker({
  data = [],
  onAskAI,
  onViewRawRow,
  onVerifyFinding
}) {
  const [activeTab, setActiveTab] = useState('DEVICE_SWAPS'); // DEVICE_SWAPS, SHARED_HANDSETS, ALL_TRANSITIONS
  const [searchQuery, setSearchQuery] = useState('');
  const [backendData, setBackendData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [selectedSwap, setSelectedSwap] = useState(null);

  // Fetch from backend /api/hardware-tracker
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetch('/api/hardware-tracker')
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (isMounted && json) {
          setBackendData(json);
        }
      })
      .catch(err => {
        console.warn('Backend hardware tracker API offline, using local data calculations', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, [data]);

  // Fallback client-side calculation from `data` prop
  const localAnalysis = useMemo(() => {
    const groupedByPhone = {};
    const imeiToRecords = {};

    data.forEach((r, idx) => {
      const caller = r.caller || r.caller_num;
      const receiver = r.receiver || r.receiver_num;
      const imei = r.imei;
      const imsi = r.imsi;
      const tower = r.cellTowerId || r.tower_id || r.towerId || 'TOW-JPR-077';
      const towerLoc = r.cellTowerLocation || r.tower_location || `Sector ${tower}`;
      const time = r.timestamp || r.start_time || '';
      const sourceFile = r.sourceFile || r.source_file || 'OperatorA_Airtel_CDR.csv';
      const rowNum = r.rowNumber || r.row_number || idx + 1;

      if (!imei || imei.includes('N/A')) return;

      // Group by caller
      if (caller) {
        if (!groupedByPhone[caller]) groupedByPhone[caller] = [];
        groupedByPhone[caller].push({ ...r, caller, receiver, imei, imsi, tower, towerLoc, time, sourceFile, rowNum });
      }

      // Group by IMEI
      if (!imeiToRecords[imei]) imeiToRecords[imei] = [];
      imeiToRecords[imei].push({ ...r, caller, receiver, imei, imsi, tower, towerLoc, time, sourceFile, rowNum });
    });

    // Detect Device Swaps (1 Phone -> Multi-IMEI)
    const deviceSwaps = [];
    const allEvents = [];

    Object.entries(groupedByPhone).forEach(([phone, recs]) => {
      const uniqueImeis = Array.from(new Set(recs.map(r => r.imei).filter(Boolean)));
      if (uniqueImeis.length > 1) {
        const sorted = [...recs].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        const swapEvents = [];
        let prevImei = null;
        let prevRec = null;

        sorted.forEach(r => {
          if (prevImei && r.imei !== prevImei) {
            const evt = {
              type: 'DEVICE_SWAP',
              phone_number: phone,
              from_imei: prevImei,
              to_imei: r.imei,
              from_model: lookupTacModel(prevImei),
              to_model: lookupTacModel(r.imei),
              timestamp: r.time,
              tower_id: r.tower,
              tower_location: r.towerLoc,
              source_file: r.sourceFile,
              row_number: r.rowNum,
              evidence_ref: `${r.sourceFile}#L${r.rowNum}`,
              previous_timestamp: prevRec?.time
            };
            swapEvents.push(evt);
            allEvents.push(evt);
          }
          prevImei = r.imei;
          prevRec = r;
        });

        const models = {};
        uniqueImeis.forEach(im => { models[im] = lookupTacModel(im); });

        deviceSwaps.push({
          phone_number: phone,
          unique_imeis: uniqueImeis,
          device_models: models,
          imei_count: uniqueImeis.length,
          has_changes: true,
          swap_events: swapEvents,
          timeline: sorted
        });
      }
    });

    // Detect Shared Handsets (1 IMEI -> Multi-SIM)
    const sharedHandsets = [];
    Object.entries(imeiToRecords).forEach(([imei, recs]) => {
      const phones = Array.from(new Set(recs.map(r => r.caller).filter(Boolean)));
      if (phones.length > 1) {
        sharedHandsets.push({
          imei,
          device_model: lookupTacModel(imei),
          phone_numbers: phones,
          phone_count: phones.length,
          total_calls: recs.length,
          sim_swap_events: []
        });
      }
    });

    return {
      summary: {
        total_device_swaps: deviceSwaps.length,
        total_shared_handsets: sharedHandsets.length,
        total_transition_events: allEvents.length
      },
      device_swaps: deviceSwaps,
      shared_handsets: sharedHandsets,
      all_swap_events: allEvents
    };
  }, [data]);

  // Active data source: backend if available, otherwise local calculation
  const trackerData = backendData || localAnalysis;

  // Filtered lists based on search query
  const filteredDeviceSwaps = useMemo(() => {
    const list = trackerData.device_swaps || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(ds => 
      ds.phone_number?.toLowerCase().includes(q) ||
      ds.unique_imeis?.some(im => im.toLowerCase().includes(q)) ||
      Object.values(ds.device_models || {}).some(m => m.toLowerCase().includes(q))
    );
  }, [trackerData.device_swaps, searchQuery]);

  const filteredSharedHandsets = useMemo(() => {
    const list = trackerData.shared_handsets || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(sh =>
      sh.imei?.toLowerCase().includes(q) ||
      sh.device_model?.toLowerCase().includes(q) ||
      sh.phone_numbers?.some(p => p.toLowerCase().includes(q))
    );
  }, [trackerData.shared_handsets, searchQuery]);

  const filteredTransitions = useMemo(() => {
    const list = trackerData.all_swap_events || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(ev =>
      ev.phone_number?.toLowerCase().includes(q) ||
      ev.from_imei?.toLowerCase().includes(q) ||
      ev.to_imei?.toLowerCase().includes(q) ||
      ev.tower_id?.toLowerCase().includes(q) ||
      ev.tower_location?.toLowerCase().includes(q) ||
      ev.from_model?.toLowerCase().includes(q) ||
      ev.to_model?.toLowerCase().includes(q)
    );
  }, [trackerData.all_swap_events, searchQuery]);

  const handleCopy = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAskAIAboutSwap = (swap) => {
    if (!onAskAI) return;
    const prompt = `Analyze the hardware device swap detected on target MSISDN ${swap.phone_number || swap.caller_num}: Switched from ${swap.from_model || swap.from_imei} to ${swap.to_model || swap.to_imei} at Tower ${swap.tower_id} (${swap.tower_location}) on ${swap.timestamp}. Cite evidence source ${swap.evidence_ref}.`;
    onAskAI(prompt, swap);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Header & Summary Metric Strip */}
      <div className="bg-white dark:bg-palette-mocha/30 rounded-2xl p-5 border border-slate-200 dark:border-palette-taupe/30 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-palette-taupe/20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-palette-espresso text-palette-cream flex items-center justify-center shadow-xs">
              <Cpu className="w-5 h-5 text-palette-sand" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-palette-cream">
                  Multi-SIM & Hardware Swap Tracker (IMEI–IMSI Analytics)
                </h3>
                <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full uppercase">
                  Critical Anomaly
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-palette-khaki mt-0.5">
                Pinpoints device switches, burner SIM rotations, and cross-operative handset sharing with TAC device identification.
              </p>
            </div>
          </div>

          {/* Search Filter Bar */}
          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Phone, IMEI, or Model..."
              className="w-full bg-slate-50 dark:bg-palette-espresso/40 border border-slate-200 dark:border-palette-taupe/30 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-palette-cream placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-palette-khaki"
            />
          </div>
        </div>

        {/* 3 Metric Summary Boxes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div className="bg-slate-50/70 dark:bg-palette-espresso/40 p-3.5 rounded-xl border border-slate-200/80 dark:border-palette-taupe/20 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 dark:text-palette-khaki uppercase tracking-wider">
                Device Swaps (1 SIM ➔ Multi-Handset)
              </span>
              <div className="text-2xl font-bold text-slate-900 dark:text-palette-cream font-mono mt-0.5">
                {trackerData.summary?.total_device_swaps || 0} Suspects
              </div>
              <div className="text-[11px] text-slate-500 dark:text-palette-sand mt-0.5">
                Altered handsets to evade surveillance
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-50/70 dark:bg-palette-espresso/40 p-3.5 rounded-xl border border-slate-200/80 dark:border-palette-taupe/20 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 dark:text-palette-khaki uppercase tracking-wider">
                Shared Handset Hubs (1 IMEI ➔ Multi-SIM)
              </span>
              <div className="text-2xl font-bold text-slate-900 dark:text-palette-cream font-mono mt-0.5">
                {trackerData.summary?.total_shared_handsets || 0} Devices
              </div>
              <div className="text-[11px] text-slate-500 dark:text-palette-sand mt-0.5">
                Multiple burner SIMs inserted into 1 physical handset
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-50/70 dark:bg-palette-espresso/40 p-3.5 rounded-xl border border-slate-200/80 dark:border-palette-taupe/20 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 dark:text-palette-khaki uppercase tracking-wider">
                Total Transition Events
              </span>
              <div className="text-2xl font-bold text-slate-900 dark:text-palette-cream font-mono mt-0.5">
                {trackerData.summary?.total_transition_events || 0} Swaps
              </div>
              <div className="text-[11px] text-slate-500 dark:text-palette-sand mt-0.5">
                Correlated with Cell Towers & Timestamps
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-palette-sand/30 text-palette-espresso dark:text-palette-cream flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex items-center space-x-1.5 mt-4 pt-3 border-t border-slate-100 dark:border-palette-taupe/20">
          {[
            { id: 'DEVICE_SWAPS', label: 'Suspect Handset Changes', count: filteredDeviceSwaps.length },
            { id: 'ALL_TRANSITIONS', label: 'Chronological Transition Matrix', count: filteredTransitions.length },
            { id: 'SHARED_HANDSETS', label: 'Burner Handset Hubs (Multi-SIM)', count: filteredSharedHandsets.length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                activeTab === tab.id
                  ? 'bg-palette-espresso text-palette-cream shadow-xs'
                  : 'text-slate-600 dark:text-palette-khaki hover:bg-slate-100 dark:hover:bg-palette-mocha/40'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === tab.id
                  ? 'bg-palette-sand/40 text-palette-cream'
                  : 'bg-slate-200 dark:bg-palette-mocha text-slate-700 dark:text-palette-sand'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. TAB 1: Suspect Handset Changes (Device Swaps) */}
      {activeTab === 'DEVICE_SWAPS' && (
        <div className="flex flex-col gap-4">
          {filteredDeviceSwaps.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-palette-mocha/20 rounded-xl border border-slate-200 dark:border-palette-taupe/30 text-slate-400">
              No suspect handset changes match your search filter.
            </div>
          ) : (
            filteredDeviceSwaps.map((suspect, sIdx) => (
              <div 
                key={sIdx}
                className="bg-white dark:bg-palette-mocha/30 rounded-2xl p-5 border border-slate-200 dark:border-palette-taupe/30 shadow-xs space-y-4"
              >
                {/* Suspect Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-palette-taupe/20">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
                      #{sIdx + 1}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-palette-cream">
                          Target Suspect: {maskPhoneNumber(suspect.phone_number)}
                        </span>
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full uppercase">
                          {suspect.imei_count} Handsets Utilized
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        Active SIM retained across multiple hardware switches
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleAskAIAboutSwap(suspect.swap_events?.[0] || { phone_number: suspect.phone_number })}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-palette-sand/30 hover:bg-palette-sand/50 text-palette-espresso dark:text-palette-cream flex items-center space-x-1.5 transition-all"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-palette-taupe dark:text-palette-sand" />
                      <span>Investigate Suspect with AI</span>
                    </button>
                  </div>
                </div>

                {/* Handsets List */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {suspect.unique_imeis.map((imei, iIdx) => {
                    const modelName = suspect.device_models?.[imei] || lookupTacModel(imei);
                    const callCount = suspect.timeline?.filter(t => t.imei === imei).length || 0;
                    const firstSeen = suspect.timeline?.find(t => t.imei === imei)?.start_time;

                    return (
                      <div 
                        key={iIdx}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-palette-taupe/30 bg-slate-50 dark:bg-palette-espresso/30 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-semibold text-slate-400 text-[10px] uppercase">
                              Handset #{iIdx + 1}
                            </span>
                            <span className="text-[10px] font-mono text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                              {callCount} Calls
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-900 dark:text-palette-cream">
                            {modelName}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 mt-1 flex items-center justify-between">
                            <span>IMEI: {imei}</span>
                            <button
                              onClick={() => handleCopy(imei, `imei-${imei}`)}
                              className="hover:text-slate-900 text-[10px] px-1"
                              title="Copy IMEI"
                            >
                              {copiedId === `imei-${imei}` ? '✓' : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>

                        {firstSeen && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-palette-taupe/20 text-[10px] text-slate-400">
                            First active: {firstSeen.replace('T', ' ').substring(0, 19)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Transition Flow Cards */}
                {suspect.swap_events && suspect.swap_events.length > 0 && (
                  <div className="space-y-2 mt-2">
                    <h4 className="text-xs font-semibold text-slate-700 dark:text-palette-sand flex items-center space-x-1.5">
                      <RotateCcw className="w-3.5 h-3.5 text-palette-khaki" />
                      <span>Observed Hardware Swap Transitions:</span>
                    </h4>

                    {suspect.swap_events.map((evt, eIdx) => (
                      <div
                        key={eIdx}
                        className="p-3.5 rounded-xl bg-palette-sand/15 dark:bg-palette-espresso/40 border border-palette-sand/30 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                      >
                        {/* Device A -> Device B */}
                        <div className="flex items-center space-x-2.5">
                          <div className="p-2 rounded-lg bg-white dark:bg-palette-mocha border border-slate-200 dark:border-palette-taupe/30">
                            <Smartphone className="w-4 h-4 text-slate-700 dark:text-palette-sand" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-palette-cream">
                              {evt.from_model}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">
                              IMEI: {evt.from_imei}
                            </div>
                          </div>

                          <ArrowRight className="w-4 h-4 text-rose-600 shrink-0 mx-1" />

                          <div className="p-2 rounded-lg bg-white dark:bg-palette-mocha border border-slate-200 dark:border-palette-taupe/30">
                            <Smartphone className="w-4 h-4 text-rose-600" />
                          </div>
                          <div>
                            <div className="font-bold text-rose-700 dark:text-rose-400">
                              {evt.to_model}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">
                              IMEI: {evt.to_imei}
                            </div>
                          </div>
                        </div>

                        {/* Location & Time metadata */}
                        <div className="flex items-center space-x-3 text-xs border-t md:border-t-0 pt-2 md:pt-0 border-slate-200/60">
                          <div className="flex items-center space-x-1 text-slate-600 dark:text-palette-sand">
                            <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span className="font-medium truncate max-w-[170px]" title={evt.tower_location}>
                              {evt.tower_location}
                            </span>
                          </div>

                          <div className="flex items-center space-x-1 text-slate-500 font-mono text-[11px]">
                            <Clock className="w-3.5 h-3.5 text-palette-khaki" />
                            <span>{evt.timestamp?.replace('T', ' ').substring(0, 16)}</span>
                          </div>

                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white dark:bg-palette-espresso text-palette-mocha dark:text-palette-cream border border-slate-200 dark:border-palette-taupe/30">
                            {evt.evidence_ref}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 3. TAB 2: Chronological Transition Matrix */}
      {activeTab === 'ALL_TRANSITIONS' && (
        <div className="bg-white dark:bg-palette-mocha/30 rounded-2xl p-5 border border-slate-200 dark:border-palette-taupe/30 shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-palette-taupe/20">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-palette-cream">
                Chronological Hardware Transition Matrix
              </h4>
              <p className="text-xs text-slate-500 dark:text-palette-khaki">
                Sequential timeline of device and SIM card replacements with geolocated cell site sectors
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-600 dark:text-palette-sand bg-slate-100 dark:bg-palette-espresso px-2.5 py-1 rounded-lg">
              {filteredTransitions.length} Transitions Logged
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-palette-taupe/30">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-palette-espresso/50 border-b border-slate-200 dark:border-palette-taupe/30 text-slate-500 dark:text-palette-khaki font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Target MSISDN</th>
                  <th className="py-2.5 px-3">Previous Handset (Old)</th>
                  <th className="py-2.5 px-3">Replacement Handset (New)</th>
                  <th className="py-2.5 px-3">Cell Tower Sector</th>
                  <th className="py-2.5 px-3">Evidence Ref</th>
                  <th className="py-2.5 px-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-palette-taupe/20 text-[11px]">
                {filteredTransitions.map((tr, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-palette-mocha/20 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-palette-sand whitespace-nowrap">
                      {tr.timestamp?.replace('T', ' ').substring(0, 19)}
                    </td>
                    <td className="py-2.5 px-3 font-bold font-mono text-slate-900 dark:text-palette-cream">
                      {maskPhoneNumber(tr.phone_number || tr.from_phone)}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-700 dark:text-palette-sand">
                        {tr.from_model || tr.from_imei}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400">
                        {tr.from_imei}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-rose-700 dark:text-rose-400">
                        {tr.to_model || tr.to_imei}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400">
                        {tr.to_imei}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-palette-sand">
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-3 h-3 text-rose-600 shrink-0" />
                        <span className="truncate max-w-[160px]" title={tr.tower_location}>
                          {tr.tower_location}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-palette-taupe dark:text-palette-sand font-semibold">
                      {tr.evidence_ref}
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => handleAskAIAboutSwap(tr)}
                        title="Investigate with AI"
                        className="px-2 py-1 rounded bg-palette-sand/30 hover:bg-palette-sand/50 text-palette-espresso dark:text-palette-cream font-semibold text-[10px] flex items-center space-x-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>AI</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. TAB 3: Burner Handset Hubs (1 IMEI -> Multi-SIM) */}
      {activeTab === 'SHARED_HANDSETS' && (
        <div className="bg-white dark:bg-palette-mocha/30 rounded-2xl p-5 border border-slate-200 dark:border-palette-taupe/30 shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-palette-taupe/20">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-palette-cream">
                Shared Handset Hubs & Burner Device Rotations
              </h4>
              <p className="text-xs text-slate-500 dark:text-palette-khaki">
                Physical handsets (IMEIs) that hosted 2 or more distinct phone numbers (SIM cards)
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-600 dark:text-palette-sand bg-slate-100 dark:bg-palette-espresso px-2.5 py-1 rounded-lg">
              {filteredSharedHandsets.length} Hubs Found
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredSharedHandsets.slice(0, 12).map((hub, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-slate-200 dark:border-palette-taupe/30 bg-slate-50/70 dark:bg-palette-espresso/40 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-palette-cream">
                        {hub.device_model}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        IMEI: {hub.imei}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                      {hub.phone_count} Associated SIMs
                    </span>
                  </div>

                  {/* List of Phone Numbers sharing this device */}
                  <div className="mt-2.5 space-y-1">
                    <span className="text-[10px] font-semibold uppercase text-slate-400">
                      Associated Numbers (MSISDNs):
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                      {hub.phone_numbers?.map((p, pIdx) => (
                        <span key={pIdx} className="px-2 py-0.5 rounded bg-white dark:bg-palette-mocha text-slate-800 dark:text-palette-sand text-xs font-mono border border-slate-200 dark:border-palette-taupe/30">
                          {maskPhoneNumber(p)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-palette-taupe/20 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{hub.total_calls} logged call events</span>
                  <button
                    onClick={() => onAskAI && onAskAI(`Investigate burner device with IMEI ${hub.imei} (${hub.device_model}) shared across ${hub.phone_count} phone numbers: ${hub.phone_numbers?.join(', ')}.`)}
                    className="text-palette-mocha dark:text-palette-cream font-semibold hover:underline flex items-center space-x-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Analyze Hub</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
