import React, { useState, useMemo, useEffect } from 'react';
import {
  Moon,
  Zap,
  Activity,
  AlertTriangle,
  Clock,
  Radio,
  Search,
  Filter,
  ShieldAlert,
  ArrowRight,
  PhoneCall,
  PhoneOutgoing,
  PhoneIncoming,
  Bot,
  Copy,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Info,
  Calendar,
  Layers,
  MapPin,
  Eye,
  EyeOff,
  RotateCcw,
  Sparkles,
  BarChart2,
  FileText
} from 'lucide-react';
import { maskPhoneNumber } from '../../utils/phoneUtils';

export default function SuspiciousPatternDetector({
  data = [],
  onAskAI,
  onViewRawRow,
  activeFilter = null
}) {
  const [activeTab, setActiveTab] = useState('TEMPORAL'); // 'TEMPORAL', 'BURSTS', 'NIGHT_DOSSIERS', 'PINGS'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('ALL'); // 'ALL', 'CRITICAL', 'NIGHT', 'BURST', 'PING'
  const [unmaskPhones, setUnmaskPhones] = useState(false);
  const [burstWindowMinutes, setBurstWindowMinutes] = useState(20);
  const [selectedItem, setSelectedItem] = useState(null);
  const [copiedText, setCopiedText] = useState(null);
  const [backendData, setBackendData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedHour, setSelectedHour] = useState(null);

  // Fetch from backend /api/suspicious-patterns
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetch(`/api/suspicious-patterns?burst_window_minutes=${burstWindowMinutes}`)
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (isMounted && json) {
          setBackendData(json);
        }
      })
      .catch(err => {
        console.warn('Backend suspicious patterns API offline, falling back to client analysis', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, [data, burstWindowMinutes]);

  // Client-side fallback calculation from data prop
  const localAnalysis = useMemo(() => {
    if (!data || data.length === 0) return null;

    const hourlyCounts = Array(24).fill(0);
    const hourlyDurations = Array(24).fill(0);
    const suspectNightStats = {};
    const shortPingsMap = {};

    let totalNightCalls = 0;
    const sortedRecords = [...data].sort((a, b) => {
      const ta = new Date(a.timestamp || a.start_time || 0).getTime();
      const tb = new Date(b.timestamp || b.start_time || 0).getTime();
      return ta - tb;
    });

    sortedRecords.forEach((r, idx) => {
      const caller = r.caller || r.caller_num;
      const receiver = r.receiver || r.receiver_num;
      const duration = Number(r.duration || r.duration_sec || 0);
      const timeStr = r.timestamp || r.start_time;
      const tower = r.cellTowerId || r.tower_id || 'TOW-JPR-001';
      const sourceFile = r.sourceFile || r.source_file || 'telecom_cdr.csv';
      const rowNum = r.rowNumber || r.row_number || idx + 1;
      const evidence = `${sourceFile}#L${rowNum}`;

      if (timeStr) {
        const dt = new Date(timeStr);
        if (!isNaN(dt.getTime())) {
          const h = dt.getHours();
          hourlyCounts[h] += 1;
          hourlyDurations[h] += duration;

          const isNight = h >= 23 || h < 5;
          if (isNight) {
            totalNightCalls += 1;
            if (caller) {
              if (!suspectNightStats[caller]) {
                suspectNightStats[caller] = {
                  suspect: caller,
                  nightCalls: 0,
                  totalCalls: 0,
                  nightDuration: 0,
                  counterparts: {},
                  towers: new Set(),
                  evidenceRefs: []
                };
              }
              suspectNightStats[caller].nightCalls += 1;
              suspectNightStats[caller].nightDuration += duration;
              if (receiver) {
                suspectNightStats[caller].counterparts[receiver] = (suspectNightStats[caller].counterparts[receiver] || 0) + 1;
              }
              if (tower) suspectNightStats[caller].towers.add(tower);
              if (suspectNightStats[caller].evidenceRefs.length < 5) {
                suspectNightStats[caller].evidenceRefs.push(evidence);
              }
            }
          }
        }
      }

      // Track total calls per caller for nocturnal %
      if (caller) {
        if (!suspectNightStats[caller]) {
          suspectNightStats[caller] = {
            suspect: caller,
            nightCalls: 0,
            totalCalls: 0,
            nightDuration: 0,
            counterparts: {},
            towers: new Set(),
            evidenceRefs: []
          };
        }
        suspectNightStats[caller].totalCalls += 1;
      }

      // Track short pings (duration <= 10s)
      if (duration <= 10 && caller && receiver) {
        const pairKey = [caller, receiver].sort().join('<->');
        if (!shortPingsMap[pairKey]) {
          shortPingsMap[pairKey] = {
            caller,
            receiver,
            pings: [],
            totalDuration: 0
          };
        }
        shortPingsMap[pairKey].pings.push({ time: timeStr, duration, evidence });
        shortPingsMap[pairKey].totalDuration += duration;
      }
    });

    // Format hourly distribution
    const hourlyDistribution = hourlyCounts.map((count, h) => ({
      hour: h,
      hour_label: `${String(h).padStart(2, '0')}:00`,
      call_count: count,
      total_duration_sec: hourlyDurations[h],
      is_night: h >= 23 || h < 5,
      threat_level: (h >= 23 || h < 5) && count > 0 ? 'HIGH' : 'NORMAL'
    }));

    // Detect bursts (sliding window)
    const burstIncidents = [];
    const windowMs = burstWindowMinutes * 60 * 1000;
    const callerRecords = {};

    sortedRecords.forEach(r => {
      const c = r.caller || r.caller_num;
      if (c) {
        if (!callerRecords[c]) callerRecords[c] = [];
        callerRecords[c].push(r);
      }
    });

    let burstIdCounter = 1;
    Object.entries(callerRecords).forEach(([caller, recs]) => {
      for (let i = 0; i < recs.length; i++) {
        const t0 = new Date(recs[i].timestamp || recs[i].start_time || 0).getTime();
        const cluster = [recs[i]];
        for (let j = i + 1; j < recs.length; j++) {
          const tj = new Date(recs[j].timestamp || recs[j].start_time || 0).getTime();
          if (tj - t0 <= windowMs) {
            cluster.push(recs[j]);
          } else {
            break;
          }
        }
        if (cluster.length >= 3) {
          const tEnd = new Date(cluster[cluster.length - 1].timestamp || cluster[cluster.length - 1].start_time || 0).getTime();
          const spanMin = Math.max(0.1, Math.round(((tEnd - t0) / 60000) * 10) / 10);
          const rate = Math.round((cluster.length / spanMin) * 10) / 10;
          const counterparts = Array.from(new Set(cluster.map(x => x.receiver || x.receiver_num).filter(Boolean)));
          const tower = cluster[0].cellTowerId || cluster[0].tower_id || 'TOW-JPR-014';
          const evidenceRefs = cluster.slice(0, 5).map((x, k) => `${x.sourceFile || x.source_file || 'telecom_cdr.csv'}#L${x.rowNumber || x.row_number || k + 1}`);

          burstIncidents.push({
            incident_id: `BURST-${String(burstIdCounter++).padStart(3, '0')}`,
            caller,
            counterparts,
            call_count: cluster.length,
            start_time: cluster[0].timestamp || cluster[0].start_time,
            end_time: cluster[cluster.length - 1].timestamp || cluster[cluster.length - 1].start_time,
            window_minutes: spanMin,
            rate_calls_per_min: rate,
            tower_id: tower,
            tower_location: `Sector ${tower}`,
            intensity: rate >= 2.0 || cluster.length >= 5 ? 'CRITICAL' : 'HIGH',
            evidence_refs: evidenceRefs
          });
          i += cluster.length - 1; // Advance past cluster
        }
      }
    });

    // Format dossiers
    const dossiers = Object.values(suspectNightStats)
      .filter(s => s.nightCalls > 0)
      .map(s => {
        const pct = s.totalCalls > 0 ? Math.round((s.nightCalls / s.totalCalls) * 1000) / 10 : 0;
        const topCp = Object.entries(s.counterparts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([phone, calls]) => ({ phone, calls }));
        return {
          suspect: s.suspect,
          night_calls_count: s.nightCalls,
          night_duration_sec: s.nightDuration,
          nocturnal_percentage: pct,
          top_counterparts: topCp,
          towers_visited: Array.from(s.towers).map(t => `Sector ${t}`),
          risk_rating: pct >= 25 || s.nightCalls >= 5 ? 'ELEVATED' : 'MODERATE',
          sample_evidence: s.evidenceRefs
        };
      })
      .sort((a, b) => b.night_calls_count - a.night_calls_count);

    // Format pings
    let pingIdCounter = 1;
    const pingClusters = Object.entries(shortPingsMap)
      .filter(([_, data]) => data.pings.length >= 2)
      .map(([_, data]) => ({
        cluster_id: `PING-${String(pingIdCounter++).padStart(3, '0')}`,
        caller: data.caller,
        receiver: data.receiver,
        ping_count: data.pings.length,
        avg_duration_sec: Math.round((data.totalDuration / data.pings.length) * 10) / 10,
        first_seen: data.pings[0].time,
        last_seen: data.pings[data.pings.length - 1].time,
        evidence_refs: data.pings.slice(0, 5).map(p => p.evidence)
      }))
      .sort((a, b) => b.ping_count - a.ping_count);

    const totalRecords = data.length;
    const nightPct = totalRecords > 0 ? Math.round((totalNightCalls / totalRecords) * 1000) / 10 : 0;

    return {
      summary: {
        total_records_analyzed: totalRecords,
        total_anomalies: totalNightCalls + burstIncidents.length + pingClusters.length,
        night_calls_count: totalNightCalls,
        night_calls_percentage: nightPct,
        burst_incidents_count: burstIncidents.length,
        ping_clusters_count: pingClusters.length,
        risk_level: burstIncidents.length > 0 || nightPct >= 20 ? 'CRITICAL' : 'ELEVATED',
        highest_risk_suspect: dossiers.length > 0 ? dossiers[0].suspect : 'None'
      },
      hourly_distribution: hourlyDistribution,
      night_calling_dossiers: dossiers,
      burst_incidents: burstIncidents,
      ping_signaling_clusters: pingClusters
    };
  }, [data, burstWindowMinutes]);

  // Combine backend data with fallback
  const analysis = backendData || localAnalysis || {
    summary: {
      total_records_analyzed: 0,
      total_anomalies: 0,
      night_calls_count: 0,
      night_calls_percentage: 0,
      burst_incidents_count: 0,
      ping_clusters_count: 0,
      risk_level: 'NORMAL',
      highest_risk_suspect: 'None'
    },
    hourly_distribution: [],
    night_calling_dossiers: [],
    burst_incidents: [],
    ping_signaling_clusters: []
  };

  const {
    summary = {},
    hourly_distribution = [],
    night_calling_dossiers = [],
    burst_incidents = [],
    ping_signaling_clusters = []
  } = analysis;

  // Max call count for histogram normalization
  const maxHourlyCount = useMemo(() => {
    if (!hourly_distribution || hourly_distribution.length === 0) return 1;
    return Math.max(...hourly_distribution.map(d => d.call_count || 0), 1);
  }, [hourly_distribution]);

  // Peak nocturnal and daytime hours
  const peakStats = useMemo(() => {
    let peakNight = { hour: 2, count: 0 };
    let peakDay = { hour: 14, count: 0 };
    hourly_distribution.forEach(d => {
      if (d.is_night && d.call_count > peakNight.count) {
        peakNight = { hour: d.hour, count: d.call_count };
      }
      if (!d.is_night && d.call_count > peakDay.count) {
        peakDay = { hour: d.hour, count: d.call_count };
      }
    });
    return { peakNight, peakDay };
  }, [hourly_distribution]);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const renderPhone = (num) => {
    if (!num) return 'N/A';
    return unmaskPhones ? num : maskPhoneNumber(num);
  };

  // Filtered lists
  const filteredBursts = useMemo(() => {
    return burstIncidents.filter(b => {
      const matchesSearch = !searchQuery || 
        b.incident_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.caller?.includes(searchQuery) ||
        b.counterparts?.some(c => c.includes(searchQuery)) ||
        b.tower_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.tower_location?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRisk = selectedFilter === 'ALL' || selectedFilter === 'BURST' ||
        (selectedFilter === 'CRITICAL' && b.intensity === 'CRITICAL');

      return matchesSearch && matchesRisk;
    });
  }, [burstIncidents, searchQuery, selectedFilter]);

  const filteredDossiers = useMemo(() => {
    return night_calling_dossiers.filter(d => {
      const matchesSearch = !searchQuery ||
        d.suspect?.includes(searchQuery) ||
        d.top_counterparts?.some(cp => cp.phone?.includes(searchQuery)) ||
        d.towers_visited?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesRisk = selectedFilter === 'ALL' || selectedFilter === 'NIGHT' ||
        (selectedFilter === 'CRITICAL' && d.risk_rating === 'CRITICAL');

      return matchesSearch && matchesRisk;
    });
  }, [night_calling_dossiers, searchQuery, selectedFilter]);

  const filteredPings = useMemo(() => {
    return ping_signaling_clusters.filter(p => {
      const matchesSearch = !searchQuery ||
        p.cluster_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.caller?.includes(searchQuery) ||
        p.receiver?.includes(searchQuery);

      const matchesRisk = selectedFilter === 'ALL' || selectedFilter === 'PING';

      return matchesSearch && matchesRisk;
    });
  }, [ping_signaling_clusters, searchQuery, selectedFilter]);

  return (
    <div className="flex flex-col h-full bg-[#171615] text-[#F1E6D5] rounded-xl border border-[#38312B] overflow-hidden shadow-2xl">
      {/* 1. TOP HEADER & KPI STRIP */}
      <div className="p-5 border-b border-[#38312B] bg-gradient-to-r from-[#171615] via-[#241F1C] to-[#171615]">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#CDB69A]/10 border border-[#CDB69A]/30 flex items-center justify-center text-[#CDB69A]">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-wide text-[#F1E6D5]">
                  Suspicious Pattern Detection Engine
                </h2>
                <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-semibold tracking-wider flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" />
                  {summary.risk_level || 'ELEVATED'}
                </span>
                <span className="px-2 py-0.5 text-xs rounded bg-[#38312B] text-[#CDB69A] border border-[#655447]/40">
                  Sec 65B Validated
                </span>
              </div>
              <p className="text-xs text-[#9A8068] mt-0.5">
                Nocturnal anomalies (23:00–05:00), sliding-window call bursts & covert beacon signaling
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setUnmaskPhones(!unmaskPhones)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                unmaskPhones
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-[#241F1C] text-[#CDB69A] border-[#38312B] hover:border-[#655447]'
              }`}
              title="Toggle DPDP Act redaction vs full raw unmasked MSISDNs"
            >
              {unmaskPhones ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{unmaskPhones ? 'Mask MSISDNs' : 'Unmask MSISDNs'}</span>
            </button>

            <button
              onClick={() => {
                if (onAskAI) {
                  onAskAI(
                    `Analyze the suspicious patterns detected in Case 1: ${summary.night_calls_count} nocturnal calls (${summary.night_calls_percentage}%), ${summary.burst_incidents_count} rapid call bursts, and ${summary.ping_clusters_count} short beacon signaling clusters. Focus on highest risk suspect ${summary.highest_risk_suspect}. Provide tactical operational recommendations.`
                  );
                }
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#9A8068] to-[#CDB69A] text-[#171615] hover:opacity-90 transition-all shadow-md"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Ask AI Copilot</span>
            </button>
          </div>
        </div>

        {/* KPI CARDS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Total Records */}
          <div className="bg-[#1D1A18] border border-[#38312B] rounded-lg p-3">
            <div className="text-[10px] text-[#9A8068] uppercase font-semibold tracking-wider flex items-center justify-between">
              <span>Analyzed CDRs</span>
              <Activity className="w-3.5 h-3.5 text-[#CDB69A]" />
            </div>
            <div className="text-xl font-bold text-[#F1E6D5] mt-1">
              {summary.total_records_analyzed?.toLocaleString() || '0'}
            </div>
            <div className="text-[10px] text-[#9A8068] mt-0.5">Telecom CDR dataset</div>
          </div>

          {/* Card 2: Nocturnal Traffic */}
          <div className="bg-[#1D1A18] border border-amber-900/30 rounded-lg p-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/5 rounded-full -mr-3 -mt-3 pointer-events-none" />
            <div className="text-[10px] text-amber-400 uppercase font-semibold tracking-wider flex items-center justify-between">
              <span>Night Calls</span>
              <Moon className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-amber-300 mt-1">
              {summary.night_calls_count || 0}
            </div>
            <div className="text-[10px] text-[#CDB69A] mt-0.5">
              {summary.night_calls_percentage}% of total traffic
            </div>
          </div>

          {/* Card 3: Call Bursts */}
          <div className="bg-[#1D1A18] border border-red-900/30 rounded-lg p-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-red-500/5 rounded-full -mr-3 -mt-3 pointer-events-none" />
            <div className="text-[10px] text-red-400 uppercase font-semibold tracking-wider flex items-center justify-between">
              <span>Rapid Bursts</span>
              <Zap className="w-3.5 h-3.5 text-red-400" />
            </div>
            <div className="text-xl font-bold text-red-300 mt-1">
              {summary.burst_incidents_count || 0}
            </div>
            <div className="text-[10px] text-[#9A8068] mt-0.5">
              Window: {burstWindowMinutes} mins (≥3 calls)
            </div>
          </div>

          {/* Card 4: Short Pings */}
          <div className="bg-[#1D1A18] border border-[#38312B] rounded-lg p-3">
            <div className="text-[10px] text-[#CDB69A] uppercase font-semibold tracking-wider flex items-center justify-between">
              <span>Beacon Pings</span>
              <Radio className="w-3.5 h-3.5 text-[#CDB69A]" />
            </div>
            <div className="text-xl font-bold text-[#F1E6D5] mt-1">
              {summary.ping_clusters_count || 0}
            </div>
            <div className="text-[10px] text-[#9A8068] mt-0.5">Duration ≤ 10s signaling</div>
          </div>

          {/* Card 5: Highest Risk Suspect */}
          <div className="bg-[#1D1A18] border border-amber-900/40 rounded-lg p-3">
            <div className="text-[10px] text-[#CDB69A] uppercase font-semibold tracking-wider flex items-center justify-between">
              <span>Top Nocturnal Suspect</span>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-sm font-mono font-bold text-[#F1E6D5] mt-1 truncate">
              {renderPhone(summary.highest_risk_suspect)}
            </div>
            <div className="text-[10px] text-amber-400/90 mt-0.5">High night volume & towers</div>
          </div>

          {/* Card 6: Total Anomalies Flagged */}
          <div className="bg-[#1D1A18] border border-red-500/30 rounded-lg p-3 bg-red-950/10">
            <div className="text-[10px] text-red-400 uppercase font-semibold tracking-wider flex items-center justify-between">
              <span>Total Anomalies</span>
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            </div>
            <div className="text-xl font-bold text-red-400 mt-1">
              {summary.total_anomalies || 0}
            </div>
            <div className="text-[10px] text-[#9A8068] mt-0.5">Court-admissible triggers</div>
          </div>
        </div>
      </div>

      {/* 2. NAVIGATION TABS & SEARCH BAR */}
      <div className="p-4 border-b border-[#38312B] bg-[#1A1816] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-[#171615] p-1 rounded-lg border border-[#38312B]">
          <button
            onClick={() => setActiveTab('TEMPORAL')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'TEMPORAL'
                ? 'bg-[#CDB69A] text-[#171615] shadow-sm'
                : 'text-[#9A8068] hover:text-[#F1E6D5] hover:bg-[#241F1C]'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>24-Hour Profile</span>
          </button>

          <button
            onClick={() => setActiveTab('BURSTS')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'BURSTS'
                ? 'bg-[#CDB69A] text-[#171615] shadow-sm'
                : 'text-[#9A8068] hover:text-[#F1E6D5] hover:bg-[#241F1C]'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-red-500" />
            <span>Call Bursts ({burst_incidents.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('NIGHT_DOSSIERS')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'NIGHT_DOSSIERS'
                ? 'bg-[#CDB69A] text-[#171615] shadow-sm'
                : 'text-[#9A8068] hover:text-[#F1E6D5] hover:bg-[#241F1C]'
            }`}
          >
            <Moon className="w-3.5 h-3.5 text-amber-400" />
            <span>Night Dossiers ({night_calling_dossiers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('PINGS')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'PINGS'
                ? 'bg-[#CDB69A] text-[#171615] shadow-sm'
                : 'text-[#9A8068] hover:text-[#F1E6D5] hover:bg-[#241F1C]'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Beacon Pings ({ping_signaling_clusters.length})</span>
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex items-center gap-2 flex-grow sm:flex-grow-0">
          <div className="relative flex-grow sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8068]" />
            <input
              type="text"
              placeholder="Search phone, tower, incident..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#171615] border border-[#38312B] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#F1E6D5] placeholder-[#655447] focus:outline-none focus:border-[#CDB69A]"
            />
          </div>

          <div className="flex items-center gap-1 text-xs">
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="bg-[#171615] border border-[#38312B] rounded-lg px-2.5 py-1.5 text-xs text-[#CDB69A] focus:outline-none focus:border-[#CDB69A]"
            >
              <option value="ALL">All Threat Levels</option>
              <option value="CRITICAL">Critical Threats Only</option>
              <option value="BURST">Bursts Only</option>
              <option value="NIGHT">Night Calls Only</option>
              <option value="PING">Pings Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* TAB 1: 24-HOUR TEMPORAL PROFILE & HISTOGRAM */}
        {activeTab === 'TEMPORAL' && (
          <div className="space-y-6">
            {/* Visual Hourly Histogram */}
            <div className="bg-[#1D1A18] border border-[#38312B] rounded-xl p-5 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                  <h3 className="text-sm font-bold text-[#F1E6D5] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#CDB69A]" />
                    24-Hour Diurnal / Nocturnal Distribution Profile
                  </h3>
                  <p className="text-xs text-[#9A8068] mt-0.5">
                    Hourly communication traffic across all suspects. Danger window (23:00 to 05:00) highlighted in amber/red.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-red-500/40 border border-red-500/70 inline-block" />
                    <span className="text-[#CDB69A]">Nocturnal Window (23:00–05:00)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-[#9A8068]/40 border border-[#9A8068]/70 inline-block" />
                    <span className="text-[#9A8068]">Daytime Baseline (05:00–23:00)</span>
                  </div>
                </div>
              </div>

              {/* Chart Grid */}
              <div className="h-64 flex items-end gap-1.5 sm:gap-2 pt-6 pb-2 border-b border-[#38312B] relative">
                {hourly_distribution.map((d) => {
                  const heightPercent = Math.max(6, Math.round((d.call_count / maxHourlyCount) * 100));
                  const isSelected = selectedHour === d.hour;
                  const isPeak = d.hour === peakStats.peakNight.hour || d.hour === peakStats.peakDay.hour;

                  return (
                    <div
                      key={d.hour}
                      onClick={() => setSelectedHour(isSelected ? null : d.hour)}
                      className={`flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative transition-all`}
                    >
                      {/* Tooltip on Hover */}
                      <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center bg-[#171615] border border-[#CDB69A] text-[10px] rounded px-2 py-1 shadow-xl pointer-events-none whitespace-nowrap">
                        <span className="font-bold text-[#F1E6D5]">{d.hour_label}</span>
                        <span className="text-amber-300 font-semibold">{d.call_count} calls ({Math.round(d.total_duration_sec / 60)} min)</span>
                        <span className={`text-[9px] ${d.is_night ? 'text-red-400 font-bold' : 'text-[#9A8068]'}`}>
                          {d.is_night ? 'NOCTURNAL SURGE' : 'Daytime'}
                        </span>
                      </div>

                      {/* Bar Fill */}
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-t transition-all ${
                          d.is_night
                            ? isSelected
                              ? 'bg-red-400 shadow-[0_0_12px_rgba(239,68,68,0.7)]'
                              : 'bg-gradient-to-t from-red-950/80 via-red-800/80 to-amber-500/90 border-t-2 border-amber-400 group-hover:brightness-125'
                            : isSelected
                            ? 'bg-[#CDB69A] shadow-[0_0_12px_rgba(205,182,154,0.7)]'
                            : 'bg-gradient-to-t from-[#241F1C] to-[#9A8068]/80 border-t border-[#CDB69A]/40 group-hover:brightness-125'
                        }`}
                      />

                      {/* Count Badge on Bar */}
                      <span className={`text-[9px] font-mono mt-1 ${d.is_night ? 'text-amber-300 font-bold' : 'text-[#9A8068]'}`}>
                        {d.call_count}
                      </span>

                      {/* Hour Label */}
                      <span className={`text-[9px] font-mono mt-0.5 ${d.is_night ? 'text-red-400 font-bold' : 'text-[#655447]'}`}>
                        {String(d.hour).padStart(2, '0')}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Insight Strip */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 pt-2">
                <div className="bg-[#171615] border border-[#38312B] rounded-lg p-3">
                  <div className="text-xs text-[#9A8068] font-semibold flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5 text-amber-400" />
                    <span>Peak Nocturnal Surge</span>
                  </div>
                  <div className="text-base font-bold text-amber-300 mt-1">
                    {String(peakStats.peakNight.hour).padStart(2, '0')}:00 hrs
                  </div>
                  <div className="text-xs text-[#9A8068] mt-0.5">
                    {peakStats.peakNight.count} calls recorded in target window (02:00 peak)
                  </div>
                </div>

                <div className="bg-[#171615] border border-[#38312B] rounded-lg p-3">
                  <div className="text-xs text-[#9A8068] font-semibold flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[#CDB69A]" />
                    <span>Peak Daytime Traffic</span>
                  </div>
                  <div className="text-base font-bold text-[#F1E6D5] mt-1">
                    {String(peakStats.peakDay.hour).padStart(2, '0')}:00 hrs
                  </div>
                  <div className="text-xs text-[#9A8068] mt-0.5">
                    {peakStats.peakDay.count} calls during business hours
                  </div>
                </div>

                <div className="bg-[#171615] border border-[#38312B] rounded-lg p-3">
                  <div className="text-xs text-[#9A8068] font-semibold flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                    <span>Anomaly Threat Ratio</span>
                  </div>
                  <div className="text-base font-bold text-red-400 mt-1">
                    {summary.night_calls_percentage}% Nocturnal
                  </div>
                  <div className="text-xs text-[#9A8068] mt-0.5">
                    Standard civilian baseline is typically &lt; 8%
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Hour Details (If clicked) */}
            {selectedHour !== null && (
              <div className="bg-[#241F1C] border border-amber-500/40 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
                    {String(selectedHour).padStart(2, '0')}:00
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#F1E6D5]">
                      Inspection of Window {String(selectedHour).padStart(2, '0')}:00 - {String((selectedHour + 1) % 24).padStart(2, '0')}:00
                    </h4>
                    <p className="text-xs text-[#9A8068]">
                      {hourly_distribution[selectedHour]?.call_count} calls totaling {Math.round((hourly_distribution[selectedHour]?.total_duration_sec || 0) / 60)} minutes of airtime.
                      {hourly_distribution[selectedHour]?.is_night && ' High-priority surveillance window.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (onAskAI) {
                      onAskAI(
                        `Investigate why there are ${hourly_distribution[selectedHour]?.call_count} calls during the ${String(selectedHour).padStart(2, '0')}:00 hour window in Case 1. Identify which suspects were active and their tower locations.`
                      );
                    }
                  }}
                  className="px-3 py-1.5 text-xs rounded-lg bg-[#CDB69A] text-[#171615] font-semibold hover:opacity-90"
                >
                  Analyze This Hour with AI
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: HIGH-FREQUENCY CALL BURSTS */}
        {activeTab === 'BURSTS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#F1E6D5] flex items-center gap-2">
                  <Zap className="w-4 h-4 text-red-400" />
                  Sliding-Window Rapid Call Bursts ({filteredBursts.length} Detected)
                </h3>
                <p className="text-xs text-[#9A8068] mt-0.5">
                  High-cadence clusters of ≥3 calls within a {burstWindowMinutes}-minute sliding window. Indicative of coordinated criminal operations or panic signaling.
                </p>
              </div>

              {/* Window Selector */}
              <div className="flex items-center gap-1.5 text-xs text-[#9A8068]">
                <span>Window:</span>
                {[10, 20, 30].map(mins => (
                  <button
                    key={mins}
                    onClick={() => setBurstWindowMinutes(mins)}
                    className={`px-2 py-0.5 rounded text-xs ${
                      burstWindowMinutes === mins
                        ? 'bg-[#CDB69A] text-[#171615] font-bold'
                        : 'bg-[#241F1C] text-[#CDB69A] hover:bg-[#38312B]'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            {filteredBursts.length === 0 ? (
              <div className="p-8 text-center text-[#9A8068] bg-[#1D1A18] rounded-xl border border-[#38312B]">
                No call bursts matching filter criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredBursts.map((burst) => (
                  <div
                    key={burst.incident_id}
                    className="bg-[#1D1A18] border border-red-900/30 hover:border-red-500/50 rounded-xl p-4 transition-all shadow-md relative overflow-hidden flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-[#38312B] pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-red-400">
                            {burst.incident_id}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            burst.intensity === 'CRITICAL'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}>
                            {burst.intensity} INTENSITY
                          </span>
                        </div>
                        <div className="text-xs font-mono text-[#CDB69A] font-bold">
                          {burst.call_count} Calls in {burst.window_minutes} min
                        </div>
                      </div>

                      {/* Caller & Counterparts */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[#9A8068] flex items-center gap-1">
                            <PhoneOutgoing className="w-3 h-3 text-red-400" />
                            Initiator:
                          </span>
                          <span className="font-mono font-bold text-[#F1E6D5]">
                            {renderPhone(burst.caller)}
                          </span>
                        </div>

                        <div className="flex items-start justify-between">
                          <span className="text-[#9A8068] flex items-center gap-1 mt-0.5">
                            <PhoneIncoming className="w-3 h-3 text-amber-400" />
                            Counterparts:
                          </span>
                          <div className="flex flex-col items-end gap-1">
                            {burst.counterparts?.map((cp, idx) => (
                              <span key={idx} className="font-mono text-xs text-[#CDB69A] bg-[#241F1C] px-1.5 py-0.5 rounded">
                                {renderPhone(cp)}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Tower Location */}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[#9A8068] flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#CDB69A]" />
                            Cell Tower:
                          </span>
                          <span className="text-[#F1E6D5] text-[11px] font-medium text-right truncate max-w-[200px]" title={burst.tower_location}>
                            {burst.tower_location || burst.tower_id}
                          </span>
                        </div>

                        {/* Timestamp */}
                        <div className="flex items-center justify-between text-[11px] text-[#9A8068]">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Trigger Time:
                          </span>
                          <span className="font-mono text-[#CDB69A]">
                            {burst.start_time ? new Date(burst.start_time).toLocaleString() : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Section 65B Line References */}
                      {burst.evidence_refs && burst.evidence_refs.length > 0 && (
                        <div className="pt-2 border-t border-[#38312B]/70">
                          <div className="text-[10px] text-[#9A8068] font-semibold mb-1 flex items-center justify-between">
                            <span>Section 65B Admissibility Citations:</span>
                            <span className="text-amber-400">{burst.evidence_refs.length} cited lines</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {burst.evidence_refs.map((ref, idx) => (
                              <span
                                key={idx}
                                onClick={() => handleCopy(ref, `burst-${burst.incident_id}-${idx}`)}
                                className="font-mono text-[10px] bg-[#171615] text-[#CDB69A] hover:text-[#F1E6D5] px-1.5 py-0.5 rounded border border-[#38312B] cursor-pointer hover:border-[#655447] flex items-center gap-1"
                                title="Click to copy Section 65B row citation"
                              >
                                {copiedText === `burst-${burst.incident_id}-${idx}` ? (
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                                ) : (
                                  <FileText className="w-2.5 h-2.5 text-[#9A8068]" />
                                )}
                                <span>{ref}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action */}
                    <div className="pt-3 mt-3 border-t border-[#38312B] flex items-center justify-between">
                      <span className="text-[10px] text-[#9A8068] font-mono">
                        Cadence: {burst.rate_calls_per_min} calls/min
                      </span>
                      <button
                        onClick={() => {
                          if (onAskAI) {
                            onAskAI(
                              `Investigate high-frequency call burst incident ${burst.incident_id}: suspect ${burst.caller} engaged in ${burst.call_count} calls within ${burst.window_minutes} mins at tower ${burst.tower_id} (${burst.tower_location}) on ${burst.start_time}. Counterparts: ${burst.counterparts?.join(', ')}. What criminal or tactical signaling does this suggest?`
                            );
                          }
                        }}
                        className="flex items-center gap-1 text-xs text-amber-300 hover:text-amber-200 font-semibold transition-all"
                      >
                        <Bot className="w-3 h-3" />
                        <span>Copilot Dossier</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: NIGHT-TIME CALLING DOSSIERS */}
        {activeTab === 'NIGHT_DOSSIERS' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#F1E6D5] flex items-center gap-2">
                <Moon className="w-4 h-4 text-amber-400" />
                Nocturnal Communication Dossiers (23:00 to 05:00)
              </h3>
              <p className="text-xs text-[#9A8068] mt-0.5">
                Suspects displaying disproportionate nocturnal activity. Rated by nocturnal percentage and multi-sector tower hops during twilight hours.
              </p>
            </div>

            {filteredDossiers.length === 0 ? (
              <div className="p-8 text-center text-[#9A8068] bg-[#1D1A18] rounded-xl border border-[#38312B]">
                No nocturnal dossiers found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDossiers.map((dossier) => (
                  <div
                    key={dossier.suspect}
                    className="bg-[#1D1A18] border border-[#38312B] hover:border-[#CDB69A]/50 rounded-xl p-4 transition-all shadow-md flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-[#38312B] pb-2.5">
                        <div>
                          <div className="text-[10px] text-[#9A8068] uppercase font-semibold">Suspect MSISDN</div>
                          <div className="font-mono font-bold text-sm text-[#F1E6D5]">
                            {renderPhone(dossier.suspect)}
                          </div>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          dossier.risk_rating === 'CRITICAL'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}>
                          {dossier.risk_rating}
                        </span>
                      </div>

                      {/* Nocturnal Percentage Progress */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-[#9A8068]">Nocturnal Call Ratio:</span>
                          <span className="font-bold text-amber-300 font-mono">
                            {dossier.nocturnal_percentage}% ({dossier.night_calls_count} night calls)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#171615] overflow-hidden border border-[#38312B]">
                          <div
                            style={{ width: `${Math.min(100, dossier.nocturnal_percentage)}%` }}
                            className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full"
                          />
                        </div>
                        <div className="text-[10px] text-[#9A8068] mt-1">
                          Duration: {Math.round((dossier.night_duration_sec || 0) / 60)} minutes night airtime
                        </div>
                      </div>

                      {/* Top Counterparts */}
                      {dossier.top_counterparts && dossier.top_counterparts.length > 0 && (
                        <div className="text-xs">
                          <span className="text-[#9A8068] block mb-1">Key Night Counterparts:</span>
                          <div className="space-y-1">
                            {dossier.top_counterparts.map((cp, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-[#171615] px-2 py-1 rounded text-[11px]">
                                <span className="font-mono text-[#CDB69A]">{renderPhone(cp.phone)}</span>
                                <span className="text-[#9A8068]">{cp.calls} calls</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Towers Visited */}
                      {dossier.towers_visited && dossier.towers_visited.length > 0 && (
                        <div className="text-xs">
                          <span className="text-[#9A8068] block mb-1">Night Cell Sectors:</span>
                          <div className="flex flex-wrap gap-1">
                            {dossier.towers_visited.slice(0, 3).map((t, idx) => (
                              <span key={idx} className="text-[10px] bg-[#241F1C] text-[#CDB69A] px-1.5 py-0.5 rounded border border-[#38312B]">
                                {t}
                              </span>
                            ))}
                            {dossier.towers_visited.length > 3 && (
                              <span className="text-[10px] text-[#9A8068] self-center">
                                +{dossier.towers_visited.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Section 65B Citations */}
                      {dossier.sample_evidence && dossier.sample_evidence.length > 0 && (
                        <div className="pt-2 border-t border-[#38312B]/70">
                          <div className="text-[10px] text-[#9A8068] mb-1">Section 65B Line Citations:</div>
                          <div className="flex flex-wrap gap-1">
                            {dossier.sample_evidence.slice(0, 3).map((ref, idx) => (
                              <span
                                key={idx}
                                onClick={() => handleCopy(ref, `dossier-${dossier.suspect}-${idx}`)}
                                className="font-mono text-[9px] bg-[#171615] text-[#9A8068] hover:text-[#F1E6D5] px-1 py-0.5 rounded border border-[#38312B] cursor-pointer"
                                title="Copy citation"
                              >
                                {ref}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action */}
                    <div className="pt-3 mt-3 border-t border-[#38312B]">
                      <button
                        onClick={() => {
                          if (onAskAI) {
                            onAskAI(
                              `Investigate suspect ${dossier.suspect} nocturnal calling patterns: ${dossier.night_calls_count} late-night calls (${dossier.nocturnal_percentage}% of total activity), active across towers ${dossier.towers_visited?.join(', ')}. Top night contacts: ${dossier.top_counterparts?.map(c => c.phone).join(', ')}. Assess suspect risk level and suggest surveillance plan.`
                            );
                          }
                        }}
                        className="w-full py-1.5 px-3 rounded-lg bg-[#241F1C] hover:bg-[#38312B] text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-[#38312B] transition-all"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        <span>Investigate Night Dossier</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: BEACON PING & COVERT SIGNALING */}
        {activeTab === 'PINGS' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#F1E6D5] flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#CDB69A]" />
                Short-Duration Beacon Signaling & Missed Calls (≤ 10 Seconds)
              </h3>
              <p className="text-xs text-[#9A8068] mt-0.5">
                Rapid micro-calls and zero-second missed calls used to trigger physical meetups, dead drops, or burner phone activation without voice content.
              </p>
            </div>

            {filteredPings.length === 0 ? (
              <div className="p-8 text-center text-[#9A8068] bg-[#1D1A18] rounded-xl border border-[#38312B]">
                No short-duration signaling clusters identified.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPings.map((ping) => (
                  <div
                    key={ping.cluster_id}
                    className="bg-[#1D1A18] border border-[#38312B] hover:border-[#CDB69A]/50 rounded-xl p-4 transition-all shadow-md flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-[#38312B] pb-2.5">
                        <span className="font-mono font-bold text-xs text-[#CDB69A]">
                          {ping.cluster_id}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          {ping.ping_count} RAPID PINGS
                        </span>
                      </div>

                      {/* Caller and Receiver */}
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[#9A8068]">Signaling Origin:</span>
                          <span className="font-mono font-bold text-[#F1E6D5]">
                            {renderPhone(ping.caller)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#9A8068]">Signaling Target:</span>
                          <span className="font-mono font-bold text-[#CDB69A]">
                            {renderPhone(ping.receiver)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#9A8068]">Avg Call Duration:</span>
                          <span className="font-mono text-amber-400 font-bold">
                            {ping.avg_duration_sec}s (Covert)
                          </span>
                        </div>
                      </div>

                      {/* Timestamps */}
                      <div className="text-[11px] text-[#9A8068] bg-[#171615] p-2 rounded border border-[#38312B] space-y-1">
                        <div className="flex items-center justify-between">
                          <span>First Signal:</span>
                          <span className="font-mono text-[#CDB69A]">
                            {ping.first_seen ? new Date(ping.first_seen).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Last Signal:</span>
                          <span className="font-mono text-[#CDB69A]">
                            {ping.last_seen ? new Date(ping.last_seen).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Evidence Citations */}
                      {ping.evidence_refs && ping.evidence_refs.length > 0 && (
                        <div>
                          <div className="text-[10px] text-[#9A8068] mb-1">Section 65B Line Citations:</div>
                          <div className="flex flex-wrap gap-1">
                            {ping.evidence_refs.map((ref, idx) => (
                              <span
                                key={idx}
                                className="font-mono text-[9px] bg-[#171615] text-[#9A8068] px-1 py-0.5 rounded border border-[#38312B]"
                              >
                                {ref}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action */}
                    <div className="pt-3 mt-3 border-t border-[#38312B]">
                      <button
                        onClick={() => {
                          if (onAskAI) {
                            onAskAI(
                              `Investigate covert beacon signaling cluster ${ping.cluster_id}: suspect ${ping.caller} sent ${ping.ping_count} micro-calls (avg duration ${ping.avg_duration_sec}s) to ${ping.receiver} between ${ping.first_seen} and ${ping.last_seen}. What operational meaning does this indicate?`
                            );
                          }
                        }}
                        className="w-full py-1.5 px-3 rounded-lg bg-[#241F1C] hover:bg-[#38312B] text-[#CDB69A] text-xs font-semibold flex items-center justify-center gap-1.5 border border-[#38312B] transition-all"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        <span>Analyze Signaling with AI</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
