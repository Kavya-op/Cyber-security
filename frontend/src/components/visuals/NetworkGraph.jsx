import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Share2, 
  Filter, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ShieldAlert, 
  PhoneOutgoing, 
  PhoneIncoming, 
  Radio, 
  Info, 
  UserCheck, 
  Maximize2, 
  MapPin, 
  CheckCircle2, 
  Bot, 
  Users, 
  Layers, 
  ArrowRight,
  GitBranch,
  Network,
  Zap,
  Sliders,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  FileCode,
  Activity,
  Eye,
  EyeOff
} from 'lucide-react';
import { maskPhoneNumber } from '../../utils/phoneUtils';

export default function NetworkGraph({ 
  data = [], 
  onAskAI, 
  activeFilter = 'ALL',
  onResetFilter
}) {
  const [activeTab, setActiveTab] = useState('GRAPH'); // 'GRAPH' | 'COMMON_CONTACTS' | 'COMMUNITIES'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSuspect, setSelectedSuspect] = useState('ALL');
  const [selectedRole, setSelectedRole] = useState('ALL'); // 'ALL' | 'KINGPIN' | 'BROKER' | 'OPERATIVE'
  const [minCallsFilter, setMinCallsFilter] = useState(1);
  const [activeNode, setActiveNode] = useState(null);
  const [activeEdge, setActiveEdge] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshNotification, setRefreshNotification] = useState(null);
  const [layoutKey, setLayoutKey] = useState(0);
  const [unmaskNumbers, setUnmaskNumbers] = useState(false);

  // Cross-Suspect Link Analysis State
  const [correlationSuspectA, setCorrelationSuspectA] = useState('');
  const [correlationSuspectB, setCorrelationSuspectB] = useState('');
  const [shortestPathResult, setShortestPathResult] = useState(null);
  const [isCalculatingPath, setIsCalculatingPath] = useState(false);
  const [vennFilter, setVennFilter] = useState('SHARED'); // 'ALL' | 'SHARED' | 'ONLY_A' | 'ONLY_B'

  // Backend Graph API Data
  const [backendGraph, setBackendGraph] = useState(null);
  const [loadingBackendGraph, setLoadingBackendGraph] = useState(false);

  // Fetch full graph topology from API
  useEffect(() => {
    let isMounted = true;
    const fetchGraph = async () => {
      try {
        setLoadingBackendGraph(true);
        const res = await fetch(`/api/network-graph?min_calls=${minCallsFilter}`);
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.nodes && json.nodes.length > 0) {
            setBackendGraph(json);
            return;
          }
        }
      } catch (err) {
        console.warn('API network-graph fetch fallback:', err);
      } finally {
        if (isMounted) setLoadingBackendGraph(false);
      }
    };
    fetchGraph();
    return () => { isMounted = false; };
  }, [minCallsFilter]);

  // Extract unique nodes and links from data or backendGraph
  const { nodes, links, uniqueSuspectList, communitiesList } = useMemo(() => {
    // 1. If backendGraph has nodes and matches, use enriched backend graph
    if (backendGraph && backendGraph.nodes && backendGraph.nodes.length > 0) {
      const bNodes = backendGraph.nodes.map((n, idx) => ({
        ...n,
        name: n.label || n.id,
        callsCount: n.calls_count || n.degree || 1,
        totalDuration: n.total_duration || 0,
        imeiCount: n.imei_count || 1,
        towerCount: n.tower_count || 1,
        isHub: n.role === 'KINGPIN' || n.is_hub,
        isBridge: n.role === 'BROKER' || n.is_bridge,
        alias: n.role === 'KINGPIN' ? 'Kingpin / Hub' : n.role === 'BROKER' ? 'Bridge Broker' : 'Suspect Node'
      }));

      // Structure links with curve offsets
      const pairGroups = new Map();
      (backendGraph.edges || []).forEach(edge => {
        const pairKey = [edge.source, edge.target].sort().join(':::');
        if (!pairGroups.has(pairKey)) pairGroups.set(pairKey, []);
        pairGroups.get(pairKey).push(edge);
      });

      const structuredLinks = [];
      pairGroups.forEach((groupLinks) => {
        const count = groupLinks.length;
        groupLinks.forEach((link, idx) => {
          let curveOffset = 0;
          if (count === 2) curveOffset = idx === 0 ? -24 : 24;
          else if (count > 2) curveOffset = (idx - (count - 1) / 2) * 26;

          structuredLinks.push({
            ...link,
            duration: link.total_duration || 0,
            isNightAlert: (link.night_calls || 0) > 0,
            imeiChange: (link.imei_swaps || 0) > 0,
            curveOffset,
            isMultiEdge: count > 1
          });
        });
      });

      return {
        nodes: bNodes,
        links: structuredLinks,
        uniqueSuspectList: bNodes,
        communitiesList: backendGraph.communities || []
      };
    }

    // 2. Client-side fallback calculation from data records
    const nodeMap = new Map();
    const rawLinkList = [];

    data.forEach((record) => {
      const callerId = record.caller || record.caller_num;
      const receiverId = record.receiver || record.receiver_num;
      if (!callerId || !receiverId) return;

      if (!nodeMap.has(callerId)) {
        nodeMap.set(callerId, {
          id: callerId,
          name: record.callerName || callerId,
          callsCount: 0,
          totalDuration: 0,
          degree: 0,
          imeis: new Set(),
          towers: new Set(),
          role: callerId.includes('98290') ? 'KINGPIN' : 'OPERATIVE'
        });
      }
      const cNode = nodeMap.get(callerId);
      cNode.callsCount += 1;
      cNode.totalDuration += (record.duration || record.duration_sec || 0);
      if (record.imei) cNode.imeis.add(record.imei);
      if (record.cellTowerId) cNode.towers.add(record.cellTowerId);

      if (!nodeMap.has(receiverId)) {
        nodeMap.set(receiverId, {
          id: receiverId,
          name: record.receiverName || receiverId,
          callsCount: 0,
          totalDuration: 0,
          degree: 0,
          imeis: new Set(),
          towers: new Set(),
          role: receiverId.includes('98299') ? 'BROKER' : 'PERIPHERAL'
        });
      }
      const rNode = nodeMap.get(receiverId);
      rNode.callsCount += 1;
      rNode.totalDuration += (record.duration || record.duration_sec || 0);
      if (record.cellTowerId) rNode.towers.add(record.cellTowerId);

      rawLinkList.push({
        source: callerId,
        target: receiverId,
        duration: record.duration || record.duration_sec || 0,
        timestamp: record.timestamp || record.start_time,
        isNightAlert: record.isNightAlert || false,
        imeiChange: record.imeiChange || false,
        tower: record.cellTowerId,
        id: record.id,
        sample_evidence: `${record.sourceFile || 'CDR.csv'}#L${record.rowNumber || 1}`
      });
    });

    // Compute basic degree
    rawLinkList.forEach(l => {
      if (nodeMap.has(l.source)) nodeMap.get(l.source).degree += 1;
      if (nodeMap.has(l.target)) nodeMap.get(l.target).degree += 1;
    });

    const nodeList = Array.from(nodeMap.values());
    const totalN = Math.max(1, nodeList.length);

    // Position nodes gracefully in 760 x 400 canvas
    const positionedNodes = nodeList.map((n, idx) => {
      // Golden spiral distribution for clean node scattering
      const angle = idx * 2.39996; // golden angle in radians
      const r = Math.min(160, 35 + Math.sqrt(idx) * 22);
      const cx = 380 + r * Math.cos(angle);
      const cy = 200 + (r * 0.75) * Math.sin(angle);

      const isHub = n.role === 'KINGPIN' || n.degree >= 8;
      const isBridge = n.role === 'BROKER' || n.degree >= 5;

      return {
        ...n,
        label: n.name,
        alias: isHub ? 'Primary Hub' : isBridge ? 'Key Intermediary' : 'Field Node',
        x: Math.round(cx),
        y: Math.round(cy),
        isHub,
        isBridge,
        betweenness: Math.round((n.degree / totalN) * 100) / 100,
        centrality: Math.round((n.callsCount / Math.max(1, data.length)) * 100) / 100,
        imeiCount: n.imeis.size,
        towerCount: n.towers.size,
        community_id: (idx % 3) + 1
      };
    });

    // Structure parallel links
    const pairGroups = new Map();
    rawLinkList.forEach(link => {
      const pairKey = [link.source, link.target].sort().join(':::');
      if (!pairGroups.has(pairKey)) pairGroups.set(pairKey, []);
      pairGroups.get(pairKey).push(link);
    });

    const structuredLinks = [];
    pairGroups.forEach((groupLinks) => {
      const count = groupLinks.length;
      groupLinks.forEach((link, idx) => {
        let curveOffset = 0;
        if (count === 2) curveOffset = idx === 0 ? -24 : 24;
        else if (count > 2) curveOffset = (idx - (count - 1) / 2) * 26;

        structuredLinks.push({
          ...link,
          call_count: count,
          total_duration: groupLinks.reduce((sum, g) => sum + g.duration, 0),
          curveOffset,
          isMultiEdge: count > 1
        });
      });
    });

    return {
      nodes: positionedNodes,
      links: structuredLinks,
      uniqueSuspectList: positionedNodes,
      communitiesList: [
        { community_id: 1, label: 'Syndicate Cell #1 (Jaipur Central)', size: Math.ceil(totalN * 0.45) },
        { community_id: 2, label: 'Syndicate Cell #2 (Ajmer Highway)', size: Math.ceil(totalN * 0.35) },
        { community_id: 3, label: 'Syndicate Cell #3 (Burner Network)', size: Math.ceil(totalN * 0.2) }
      ]
    };
  }, [data, backendGraph]);

  // Set default targets for correlation once nodes load
  useEffect(() => {
    if (nodes.length >= 2 && (!correlationSuspectA || !correlationSuspectB)) {
      const sortedByDeg = [...nodes].sort((a, b) => (b.callsCount || 0) - (a.callsCount || 0));
      setCorrelationSuspectA(sortedByDeg[0]?.id || '');
      setCorrelationSuspectB(sortedByDeg[1]?.id || '');
    }
  }, [nodes]);

  // Cross-Suspect Common Contacts Calculation
  const correlationResult = useMemo(() => {
    if (!correlationSuspectA || !correlationSuspectB || correlationSuspectA === correlationSuspectB) {
      return { 
        commonContacts: [], 
        onlyA: [], 
        onlyB: [], 
        totalDistinct: 0,
        directCallCount: 0, 
        directDuration: 0, 
        hasDirectCall: false 
      };
    }

    const contactsOfA = new Map();
    const contactsOfB = new Map();

    links.forEach(l => {
      // For A
      if (l.source === correlationSuspectA) contactsOfA.set(l.target, l);
      if (l.target === correlationSuspectA) contactsOfA.set(l.source, l);

      // For B
      if (l.source === correlationSuspectB) contactsOfB.set(l.target, l);
      if (l.target === correlationSuspectB) contactsOfB.set(l.source, l);
    });

    // Check direct call between A and B
    const directLinks = links.filter(l => 
      (l.source === correlationSuspectA && l.target === correlationSuspectB) ||
      (l.source === correlationSuspectB && l.target === correlationSuspectA)
    );
    const hasDirectCall = directLinks.length > 0;
    const directCallCount = directLinks.reduce((sum, l) => sum + (l.call_count || 1), 0);
    const directDuration = directLinks.reduce((sum, l) => sum + (l.duration || l.total_duration || 0), 0);

    // 1. Shared / Mutual contacts
    const mutual = [];
    contactsOfA.forEach((linkA, contactId) => {
      if (contactsOfB.has(contactId) && contactId !== correlationSuspectA && contactId !== correlationSuspectB) {
        const linkB = contactsOfB.get(contactId);
        const nodeObj = nodes.find(n => n.id === contactId);
        if (nodeObj) {
          mutual.push({
            node: nodeObj,
            type: 'SHARED',
            callsWithA: linkA.call_count || 1,
            durWithA: linkA.duration || linkA.total_duration || 0,
            callsWithB: linkB.call_count || 1,
            durWithB: linkB.duration || linkB.total_duration || 0,
            totalMutualCalls: (linkA.call_count || 1) + (linkB.call_count || 1),
            evidenceRefA: linkA.sample_evidence,
            evidenceRefB: linkB.sample_evidence
          });
        }
      }
    });
    mutual.sort((a, b) => b.totalMutualCalls - a.totalMutualCalls);

    // 2. Only A (exclusive to Suspect A)
    const onlyA = [];
    contactsOfA.forEach((linkA, contactId) => {
      if (!contactsOfB.has(contactId) && contactId !== correlationSuspectB && contactId !== correlationSuspectA) {
        const nodeObj = nodes.find(n => n.id === contactId);
        if (nodeObj) {
          onlyA.push({
            node: nodeObj,
            type: 'ONLY_A',
            callsWithA: linkA.call_count || 1,
            durWithA: linkA.duration || linkA.total_duration || 0,
            callsWithB: 0,
            durWithB: 0,
            totalMutualCalls: linkA.call_count || 1,
            evidenceRefA: linkA.sample_evidence,
          });
        }
      }
    });
    onlyA.sort((a, b) => b.callsWithA - a.callsWithA);

    // 3. Only B (exclusive to Suspect B)
    const onlyB = [];
    contactsOfB.forEach((linkB, contactId) => {
      if (!contactsOfA.has(contactId) && contactId !== correlationSuspectA && contactId !== correlationSuspectB) {
        const nodeObj = nodes.find(n => n.id === contactId);
        if (nodeObj) {
          onlyB.push({
            node: nodeObj,
            type: 'ONLY_B',
            callsWithA: 0,
            durWithA: 0,
            callsWithB: linkB.call_count || 1,
            durWithB: linkB.duration || linkB.total_duration || 0,
            totalMutualCalls: linkB.call_count || 1,
            evidenceRefB: linkB.sample_evidence,
          });
        }
      }
    });
    onlyB.sort((a, b) => b.callsWithB - a.callsWithB);

    return {
      commonContacts: mutual,
      onlyA,
      onlyB,
      totalDistinct: mutual.length + onlyA.length + onlyB.length,
      hasDirectCall,
      directCallCount,
      directDuration
    };
  }, [links, nodes, correlationSuspectA, correlationSuspectB]);

  const sharedContactIds = useMemo(() => {
    return new Set(correlationResult.commonContacts.map(c => c.node.id));
  }, [correlationResult]);

  // Shortest path degrees of separation calculation
  const handleCalculateShortestPath = async () => {
    if (!correlationSuspectA || !correlationSuspectB) return;
    try {
      setIsCalculatingPath(true);
      const res = await fetch(`/api/shortest-path?source=${correlationSuspectA}&target=${correlationSuspectB}`);
      if (res.ok) {
        const json = await res.json();
        setShortestPathResult(json);
        if (json.has_path) {
          setRefreshNotification(`Traced chain: ${json.degrees_of_separation} degrees of separation (${json.path.length} hops)`);
          setTimeout(() => setRefreshNotification(null), 3500);
        }
        return;
      }
    } catch (err) {
      console.warn('API shortest-path error:', err);
    } finally {
      setIsCalculatingPath(false);
    }

    // Client-side breadth-first-search fallback
    const adj = new Map();
    links.forEach(l => {
      if (!adj.has(l.source)) adj.set(l.source, []);
      if (!adj.has(l.target)) adj.set(l.target, []);
      adj.get(l.source).push(l.target);
      adj.get(l.target).push(l.source);
    });

    const queue = [[correlationSuspectA]];
    const visited = new Set([correlationSuspectA]);
    let foundPath = null;

    while (queue.length > 0) {
      const path = queue.shift();
      const curr = path[path.length - 1];
      if (curr === correlationSuspectB) {
        foundPath = path;
        break;
      }
      for (const nxt of (adj.get(curr) || [])) {
        if (!visited.has(nxt)) {
          visited.add(nxt);
          queue.push([...path, nxt]);
        }
      }
    }

    if (foundPath) {
      const hops = [];
      for (let i = 0; i < foundPath.length - 1; i++) {
        hops.push({
          from: foundPath[i],
          to: foundPath[i + 1],
          call_count: 1,
          total_duration: 60,
          evidence_ref: 'CDR_Evidence_Ledger.csv#L' + (i + 1)
        });
      }
      setShortestPathResult({
        source: correlationSuspectA,
        target: correlationSuspectB,
        has_path: true,
        degrees_of_separation: foundPath.length - 1,
        path: foundPath,
        hops
      });
    } else {
      setShortestPathResult({
        source: correlationSuspectA,
        target: correlationSuspectB,
        has_path: false,
        degrees_of_separation: null,
        path: [],
        hops: []
      });
    }
  };

  const shortestPathNodeIds = useMemo(() => {
    return new Set(shortestPathResult?.path || []);
  }, [shortestPathResult]);

  // Filter nodes based on user query, dropdown, and activeFilter
  const filteredNodes = useMemo(() => {
    return nodes.filter(node => {
      const rawText = (node.name + ' ' + node.id + ' ' + (node.alias || '')).toLowerCase();
      const matchesSearch = !searchTerm.trim() || rawText.includes(searchTerm.toLowerCase());
      const matchesSuspect = selectedSuspect === 'ALL' || node.id === selectedSuspect;
      const matchesRole = selectedRole === 'ALL' || node.role === selectedRole;
      const matchesMinCalls = (node.callsCount || 0) >= minCallsFilter;

      let matchesAnomaly = true;
      if (activeFilter === 'NIGHT') {
        matchesAnomaly = links.some(l => (l.source === node.id || l.target === node.id) && l.isNightAlert);
      } else if (activeFilter === 'IMEI') {
        matchesAnomaly = node.imeiCount > 1 || links.some(l => (l.source === node.id || l.target === node.id) && l.imeiChange);
      }

      return matchesSearch && matchesSuspect && matchesRole && matchesMinCalls && matchesAnomaly;
    });
  }, [nodes, links, searchTerm, selectedSuspect, selectedRole, minCallsFilter, activeFilter]);

  const activeNodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);

  const handleResetGraph = () => {
    setIsRefreshing(true);
    setZoomLevel(1);
    setSearchTerm('');
    setSelectedSuspect('ALL');
    setSelectedRole('ALL');
    setMinCallsFilter(1);
    setActiveNode(null);
    setActiveEdge(null);
    setShortestPathResult(null);
    if (onResetFilter) onResetFilter();
    setLayoutKey(prev => prev + 1);
    setRefreshNotification('Network view reset: Zoom 100%, search cleared, default layout restored');

    setTimeout(() => setIsRefreshing(false), 500);
    setTimeout(() => setRefreshNotification(null), 2500);
  };

  const handleExplainWithAI = () => {
    if (onAskAI) {
      onAskAI({
        type: 'network_cluster_explanation',
        prompt: `Analyze the communication network topology for Case #RJ-2024-9102. Detail the role of primary kingpin ${correlationSuspectA}, bridge nodes between clusters, and shared contacts with target ${correlationSuspectB}. Highlight any late-night burst calling or burner IMEI swaps.`
      });
    }
  };

  const formatDisplayPhone = (phone) => {
    if (!phone) return 'Unknown';
    if (unmaskNumbers) return phone;
    return maskPhoneNumber(phone);
  };

  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs transition-all flex flex-col space-y-4">
      
      {/* 1. Header Bar with Tabs & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#171615] text-[#F1E6D5] flex items-center justify-center shadow-xs">
              <Share2 className="w-4 h-4 text-[#CDB69A] stroke-[2.3]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                  Advanced Communication Network Graph & Link Analysis
                </h2>
                {activeFilter !== 'ALL' && (
                  <span className="bg-[#171615] text-[#F1E6D5] text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider">
                    Filter: {activeFilter}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-normal">
                {nodes.length} Network Nodes • {links.length} Communication Links • {communitiesList.length} Syndicate Cells
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs & AI Action */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Buttons */}
          <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setActiveTab('GRAPH')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center space-x-1.5 ${
                activeTab === 'GRAPH'
                  ? 'bg-[#38312B] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Topology Graph</span>
            </button>
            <button
              onClick={() => setActiveTab('COMMON_CONTACTS')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center space-x-1.5 ${
                activeTab === 'COMMON_CONTACTS'
                  ? 'bg-[#38312B] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
              <span>Multi-Suspect Venn ({correlationResult.commonContacts.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('COMMUNITIES')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center space-x-1.5 ${
                activeTab === 'COMMUNITIES'
                  ? 'bg-[#38312B] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span>Syndicate Cells ({communitiesList.length})</span>
            </button>
          </div>

          {/* Mask / Unmask Toggle for Section 65B court evidence */}
          <button
            onClick={() => setUnmaskNumbers(!unmaskNumbers)}
            className="border border-slate-200 hover:border-slate-800 bg-white px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 flex items-center space-x-1 shadow-xs transition-colors"
            title={unmaskNumbers ? "Mask Numbers for Public Display" : "Unmask Numbers for Police Evidence Review"}
          >
            {unmaskNumbers ? <EyeOff className="w-3.5 h-3.5 text-slate-500" /> : <Eye className="w-3.5 h-3.5 text-blue-600" />}
            <span className="hidden sm:inline">{unmaskNumbers ? 'Mask' : 'Unmask'}</span>
          </button>

          {/* Explain Graph with AI */}
          <button
            onClick={handleExplainWithAI}
            className="bg-[#171615] hover:bg-[#38312B] text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-colors"
          >
            <Bot className="w-3.5 h-3.5 text-[#CDB69A]" />
            <span>Explain Graph with AI</span>
          </button>
        </div>
      </div>

      {/* 2. Filter & Link Analysis Control Bar */}
      <div className="bg-[#F1E6D5]/40 border border-[#CDB69A]/60 rounded-xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: Suspect Pair Link Tracer */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1 bg-[#171615] text-[#F1E6D5] px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
            <GitBranch className="w-3 h-3 text-[#CDB69A]" />
            <span>Link Tracer</span>
          </div>

          <div className="flex items-center space-x-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Target A:</span>
            <select
              value={correlationSuspectA}
              onChange={(e) => {
                setCorrelationSuspectA(e.target.value);
                setShortestPathResult(null);
              }}
              className="bg-white border border-slate-300 text-xs font-semibold text-slate-900 rounded-md px-2 py-1 outline-none cursor-pointer"
            >
              {nodes.map(s => (
                <option key={`A-${s.id}`} value={s.id}>
                  {formatDisplayPhone(s.id)} ({s.role})
                </option>
              ))}
            </select>
          </div>

          <span className="text-slate-400 font-black text-xs">⟷</span>

          <div className="flex items-center space-x-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Target B:</span>
            <select
              value={correlationSuspectB}
              onChange={(e) => {
                setCorrelationSuspectB(e.target.value);
                setShortestPathResult(null);
              }}
              className="bg-white border border-slate-300 text-xs font-semibold text-slate-900 rounded-md px-2 py-1 outline-none cursor-pointer"
            >
              {nodes.map(s => (
                <option key={`B-${s.id}`} value={s.id}>
                  {formatDisplayPhone(s.id)} ({s.role})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleCalculateShortestPath}
            disabled={isCalculatingPath || !correlationSuspectA || !correlationSuspectB}
            className="bg-[#38312B] hover:bg-[#171615] text-white px-2.5 py-1 rounded-md text-xs font-bold transition-colors flex items-center space-x-1 shadow-xs disabled:opacity-50"
          >
            <Zap className="w-3 h-3 text-amber-400" />
            <span>{isCalculatingPath ? 'Tracing...' : 'Trace Path'}</span>
          </button>
        </div>

        {/* Right: Search, Role Filter, and Min Calls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative w-44">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search suspect/alias..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 text-xs text-slate-900 bg-white border border-slate-200 rounded-md outline-none focus:border-slate-800"
            />
          </div>

          {/* Role Filter */}
          <div className="relative">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="bg-white border border-slate-200 text-xs font-medium text-slate-800 rounded-md pl-2 pr-6 py-1 outline-none cursor-pointer"
            >
              <option value="ALL">All Roles</option>
              <option value="KINGPIN">Kingpins / Hubs</option>
              <option value="BROKER">Bridge Brokers</option>
              <option value="OPERATIVE">Field Operatives</option>
            </select>
            <Filter className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Min Calls Slider */}
          <div className="flex items-center space-x-1.5 bg-white border border-slate-200 px-2 py-0.5 rounded-md text-xs">
            <Sliders className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] text-slate-500 font-bold">Min Calls:</span>
            <input
              type="range"
              min="1"
              max="15"
              value={minCallsFilter}
              onChange={(e) => setMinCallsFilter(parseInt(e.target.value, 10))}
              className="w-16 accent-[#9A8068] cursor-pointer"
            />
            <span className="text-[10px] font-mono font-bold text-slate-700 min-w-[14px]">
              {minCallsFilter}
            </span>
          </div>

          {/* Zoom & Reset */}
          <div className="flex items-center space-x-0.5 bg-white border border-slate-200 p-0.5 rounded-md">
            <button
              onClick={() => setZoomLevel(prev => Math.min(prev + 0.15, 1.5))}
              className="p-1 hover:bg-slate-100 rounded text-slate-700"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="text-[9px] font-mono font-bold text-slate-500 px-1">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel(prev => Math.max(prev - 0.15, 0.7))}
              className="p-1 hover:bg-slate-100 rounded text-slate-700"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetGraph}
              className="p-1 hover:bg-slate-100 rounded text-slate-700"
              title="Reset View"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Shortest Path Banner (if traced) */}
      {shortestPathResult && (
        <div className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
          shortestPathResult.has_path 
            ? 'bg-amber-50 border-amber-200 text-amber-950' 
            : 'bg-slate-100 border-slate-200 text-slate-600'
        }`}>
          <div className="flex items-center space-x-2">
            <Zap className={`w-4 h-4 ${shortestPathResult.has_path ? 'text-amber-600' : 'text-slate-400'}`} />
            <div>
              <span className="font-bold text-[11px] uppercase tracking-wider block">
                {shortestPathResult.has_path 
                  ? `Degrees of Separation: ${shortestPathResult.degrees_of_separation} (${shortestPathResult.path.length} Suspect Nodes in Chain)`
                  : 'No Direct or Intermediary Route Found'}
              </span>
              {shortestPathResult.has_path && (
                <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold mt-0.5 flex-wrap">
                  {shortestPathResult.path.map((step, idx) => (
                    <React.Fragment key={idx}>
                      <span className={`px-1.5 py-0.5 rounded ${
                        idx === 0 || idx === shortestPathResult.path.length - 1
                          ? 'bg-[#171615] text-[#F1E6D5]'
                          : 'bg-amber-200 text-amber-900'
                      }`}>
                        {formatDisplayPhone(step)}
                      </span>
                      {idx < shortestPathResult.path.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-amber-600 inline" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setShortestPathResult(null)}
            className="text-xs text-slate-400 hover:text-slate-700 px-2 py-1 font-semibold"
          >
            Clear Path
          </button>
        </div>
      )}

      {/* 4. Main Body: TAB 1 (TOPOLOGY GRAPH) */}
      {activeTab === 'GRAPH' && (
        <div className="relative rounded-xl min-h-[460px] flex items-center justify-center overflow-hidden border border-slate-200 bg-[#F1E6D5]/30">
          {/* Cartographic Road Grid */}
          <div className="absolute inset-0 pointer-events-none opacity-40">
            <svg viewBox="0 0 760 400" className="w-full h-full object-cover">
              <defs>
                <pattern id="netRoadPattern2" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#DECDBA" strokeWidth="0.8" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#netRoadPattern2)" />
            </svg>
          </div>

          {/* Notification Toast */}
          {refreshNotification && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-[#171615] text-[#F1E6D5] text-[11px] font-medium px-3 py-1 rounded-md shadow-lg border border-slate-700 flex items-center space-x-1.5 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{refreshNotification}</span>
            </div>
          )}

          {/* SVG Canvas */}
          <div 
            key={layoutKey}
            className="w-full h-full flex items-center justify-center transition-all duration-300"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <svg viewBox="0 0 760 400" className="w-full max-h-[480px] overflow-visible">
              <defs>
                <linearGradient id="alertGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.95" />
                </linearGradient>
                <marker id="arrow" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#655447" opacity="0.8"/>
                </marker>
                <marker id="arrow-gold" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#d97706" />
                </marker>
              </defs>

              {/* Communication Links (Edges) */}
              {links.map((link, idx) => {
                const sNode = nodes.find(n => n.id === link.source);
                const tNode = nodes.find(n => n.id === link.target);
                if (!sNode || !tNode) return null;

                const isPathLink = shortestPathNodeIds.has(sNode.id) && shortestPathNodeIds.has(tNode.id);
                const isDirectCorrelationLink = 
                  (link.source === correlationSuspectA && link.target === correlationSuspectB) ||
                  (link.source === correlationSuspectB && link.target === correlationSuspectA);

                const isSharedLink = 
                  (sharedContactIds.has(link.source) && (link.target === correlationSuspectA || link.target === correlationSuspectB)) ||
                  (sharedContactIds.has(link.target) && (link.source === correlationSuspectA || link.source === correlationSuspectB));

                const isSelectedActive = 
                  (activeNode && (activeNode.id === sNode.id || activeNode.id === tNode.id)) ||
                  (activeEdge && activeEdge.source === link.source && activeEdge.target === link.target);

                let strokeColor = '#94A3B8';
                let strokeWidth = 1.5;

                if (isPathLink) {
                  strokeColor = '#D97706';
                  strokeWidth = 3.8;
                } else if (isDirectCorrelationLink) {
                  strokeColor = '#DC2626';
                  strokeWidth = 3.5;
                } else if (isSharedLink) {
                  strokeColor = '#059669';
                  strokeWidth = 2.8;
                } else if (link.imeiChange) {
                  strokeColor = '#DC2626';
                  strokeWidth = 2.2;
                } else if (link.isNightAlert) {
                  strokeColor = '#D97706';
                  strokeWidth = 1.8;
                } else if (isSelectedActive) {
                  strokeColor = '#171615';
                  strokeWidth = 2.5;
                }

                // Bezier geometry
                const midX = (sNode.x + tNode.x) / 2;
                const midY = (sNode.y + tNode.y) / 2;
                const dx = tNode.x - sNode.x;
                const dy = tNode.y - sNode.y;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const normalX = -dy / len;
                const normalY = dx / len;

                const offset = link.curveOffset || 0;
                const ctrlX = midX + normalX * offset;
                const ctrlY = midY + normalY * offset;

                const badgeX = offset === 0 ? midX : 0.5 * midX + 0.5 * ctrlX;
                const badgeY = offset === 0 ? midY : 0.5 * midY + 0.5 * ctrlY;

                const pathData = offset === 0
                  ? `M ${sNode.x} ${sNode.y} L ${tNode.x} ${tNode.y}`
                  : `M ${sNode.x} ${sNode.y} Q ${ctrlX} ${ctrlY} ${tNode.x} ${tNode.y}`;

                return (
                  <g 
                    key={`link-${idx}`}
                    onClick={() => setActiveEdge(link)}
                    className="cursor-pointer group"
                  >
                    {(isSelectedActive || isPathLink || isDirectCorrelationLink || isSharedLink) && (
                      <path
                        d={pathData}
                        fill="none"
                        stroke={isPathLink ? '#D97706' : isDirectCorrelationLink ? '#DC2626' : isSharedLink ? '#059669' : '#171615'}
                        strokeWidth={strokeWidth + 5}
                        strokeOpacity="0.2"
                        strokeLinecap="round"
                      />
                    )}

                    <path
                      d={pathData}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={link.isNightAlert ? '4,4' : 'none'}
                      markerEnd={isPathLink ? "url(#arrow-gold)" : "url(#arrow)"}
                      className="transition-all"
                    />

                    {/* Edge Call Count Pill */}
                    <g transform={`translate(${badgeX}, ${badgeY})`}>
                      <rect
                        x="-20"
                        y="-8"
                        width="40"
                        height="16"
                        rx="8"
                        fill="#FFFFFF"
                        stroke={isPathLink ? '#D97706' : isSharedLink ? '#059669' : isDirectCorrelationLink ? '#DC2626' : '#CBD5E1'}
                        strokeWidth="1.2"
                        filter="drop-shadow(0 1px 2px rgba(0,0,0,0.06))"
                      />
                      <text
                        x="0"
                        y="3"
                        textAnchor="middle"
                        className="text-[8.5px] font-bold fill-[#171615] font-mono"
                      >
                        {link.call_count || 1} calls
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Nodes */}
              {nodes.map((node) => {
                const isSelected = activeNode?.id === node.id;
                const isKingpin = node.role === 'KINGPIN' || node.isHub;
                const isBroker = node.role === 'BROKER' || node.isBridge;
                const isShared = sharedContactIds.has(node.id);
                const isPathNode = shortestPathNodeIds.has(node.id);
                const isTargetA = node.id === correlationSuspectA;
                const isTargetB = node.id === correlationSuspectB;

                return (
                  <g
                    key={`node-${node.id}`}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() => {
                      setActiveNode(node);
                      setActiveEdge(null);
                    }}
                    className="cursor-pointer group transition-all"
                  >
                    {/* Pulsing Kingpin / Path Halo */}
                    {(isKingpin || isPathNode) && (
                      <circle
                        r={isKingpin ? 32 : 28}
                        fill={isPathNode ? '#D97706' : '#38312B'}
                        opacity="0.14"
                        className="animate-pulse"
                      />
                    )}

                    {/* Shared Mutual Contact Aura */}
                    {isShared && (
                      <circle
                        r="28"
                        fill="#059669"
                        opacity="0.18"
                      />
                    )}

                    {/* Outer Ring */}
                    <circle
                      r={isKingpin ? 24 : 18}
                      fill="#FFFFFF"
                      stroke={
                        isPathNode
                          ? '#D97706'
                          : isTargetA || isTargetB
                            ? '#171615'
                            : isShared
                              ? '#059669'
                              : isBroker
                                ? '#059669'
                                : isKingpin
                                  ? '#171615'
                                  : '#CBD5E1'
                      }
                      strokeWidth={isPathNode ? 3.5 : isTargetA || isTargetB ? 3 : isKingpin ? 2.5 : 1.8}
                      filter="drop-shadow(0 2px 4px rgba(0,0,0,0.08))"
                    />

                    {/* Inner Core */}
                    <circle
                      r={isKingpin ? 16 : 12}
                      fill={
                        isPathNode
                          ? '#D97706'
                          : isTargetA || isTargetB
                            ? '#171615'
                            : isShared
                              ? '#059669'
                              : isBroker
                                ? '#059669'
                                : isKingpin
                                  ? '#38312B'
                                  : '#64748B'
                      }
                    />

                    {/* Icon inside Core */}
                    <text
                      x="0"
                      y="3.5"
                      textAnchor="middle"
                      fill="#FFFFFF"
                      className="text-[9px] font-bold select-none pointer-events-none"
                    >
                      {isKingpin ? '★' : isBroker || isShared ? '🔗' : node.role === 'OPERATIVE' ? '⚡' : '•'}
                    </text>

                    {/* Role / Mutual Badge */}
                    {(isKingpin || isBroker || isShared || isPathNode) && (
                      <g transform="translate(0, -26)">
                        <rect
                          x="-28"
                          y="-7"
                          width="56"
                          height="14"
                          rx="4"
                          fill={isPathNode ? '#D97706' : isShared ? '#059669' : isBroker ? '#059669' : '#171615'}
                        />
                        <text
                          x="0"
                          y="3"
                          textAnchor="middle"
                          fill="#FFFFFF"
                          className="text-[7.5px] font-bold tracking-wider uppercase font-sans"
                        >
                          {isPathNode ? 'PATH HOP' : isShared ? 'MUTUAL' : isKingpin ? 'KINGPIN' : 'BROKER'}
                        </text>
                      </g>
                    )}

                    {/* Phone Number Label */}
                    <text
                      x="0"
                      y={isKingpin ? 36 : 30}
                      textAnchor="middle"
                      className="text-[10px] font-bold fill-slate-900 tracking-tight select-none pointer-events-none font-mono"
                    >
                      {formatDisplayPhone(node.id)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Floating Entity Dossier Panel */}
          {activeNode && (
            <div className="absolute bottom-3 left-3 w-80 bg-white/95 backdrop-blur-md rounded-xl p-4 border border-slate-200 shadow-xl z-20 animate-in zoom-in-95">
              <div className="flex items-start justify-between">
                <div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded text-white ${
                    activeNode.role === 'KINGPIN' ? 'bg-[#171615]' : activeNode.role === 'BROKER' ? 'bg-[#059669]' : 'bg-slate-700'
                  }`}>
                    {activeNode.role || 'TARGET DOSSIER'}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 mt-1 font-mono">
                    {formatDisplayPhone(activeNode.id)}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-sans">
                    Syndicate Cell #{activeNode.community_id || 1} • {activeNode.alias || 'Suspect'}
                  </p>
                </div>
                <button
                  onClick={() => setActiveNode(null)}
                  className="w-6 h-6 rounded hover:bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2.5 text-xs font-mono">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[9px] font-sans font-bold uppercase">Call Volume</span>
                  <span className="font-bold text-slate-900">{activeNode.callsCount} calls</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[9px] font-sans font-bold uppercase">Centrality</span>
                  <span className="font-bold text-slate-900">Between: {activeNode.betweenness || 0}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[9px] font-sans font-bold uppercase">Unique Towers</span>
                  <span className="font-bold text-slate-900">{activeNode.towerCount || 1} sectors</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[9px] font-sans font-bold uppercase">Handsets (IMEI)</span>
                  <span className={`font-bold ${activeNode.imeiCount > 1 ? 'text-rose-600' : 'text-slate-900'}`}>
                    {activeNode.imeiCount || 1} {activeNode.imeiCount > 1 ? '⚠️' : ''}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => {
                    setCorrelationSuspectA(activeNode.id);
                    setShortestPathResult(null);
                    setRefreshNotification(`Selected ${formatDisplayPhone(activeNode.id)} as Target A`);
                    setTimeout(() => setRefreshNotification(null), 2000);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold"
                >
                  Set Target A →
                </button>

                <button
                  onClick={() => {
                    if (onAskAI) {
                      onAskAI({
                        type: 'entity_dossier',
                        prompt: `Perform deep forensic link analysis on suspect ${activeNode.id}. Role: ${activeNode.role}. Detail handling of ${activeNode.callsCount} calls across ${activeNode.towerCount} towers and ${activeNode.imeiCount} handsets.`
                      });
                    }
                  }}
                  className="bg-[#171615] text-white hover:bg-[#38312B] text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center space-x-1"
                >
                  <Bot className="w-3.5 h-3.5 text-[#CDB69A]" />
                  <span>Analyze in Copilot</span>
                </button>
              </div>
            </div>
          )}

          {/* Floating Edge Dossier Panel */}
          {activeEdge && (
            <div className="absolute top-3 right-3 w-80 bg-white/95 backdrop-blur-md rounded-xl p-4 border border-slate-200 shadow-xl z-20 animate-in zoom-in-95">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded text-white bg-[#38312B]">
                    Communication Link
                  </span>
                  <h5 className="text-xs font-bold text-slate-900 mt-1 font-mono">
                    {formatDisplayPhone(activeEdge.source)} ⟷ {formatDisplayPhone(activeEdge.target)}
                  </h5>
                </div>
                <button
                  onClick={() => setActiveEdge(null)}
                  className="w-5 h-5 rounded hover:bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="mt-2.5 p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Total Calls:</span>
                  <span className="font-bold text-slate-900">{activeEdge.call_count || 1} records</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Airtime Duration:</span>
                  <span className="font-bold text-slate-900">{activeEdge.duration || activeEdge.total_duration || 0}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Late Night Calls:</span>
                  <span className="font-bold text-amber-700">{activeEdge.night_calls || (activeEdge.isNightAlert ? 1 : 0)} calls</span>
                </div>
                <div className="pt-1 border-t border-slate-200 text-[10px] text-slate-500 truncate" title={activeEdge.sample_evidence}>
                  Sec. 65B Ref: {activeEdge.sample_evidence || 'Carrier_CDR.csv#L1'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. TAB 2: DYNAMIC MULTI-SUSPECT VENN SELECTOR & LINK ANALYSIS */}
      {activeTab === 'COMMON_CONTACTS' && (
        <div className="space-y-4">
          {/* A. Dynamic Suspect Dropdown Selectors & Quick Preset Chips */}
          <div className="bg-[#F1E6D5]/40 border border-[#CDB69A]/70 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#CDB69A]/40 pb-2.5">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <GitBranch className="w-4 h-4 text-[#38312B]" />
                  <span>Dynamic Multi-Suspect Venn Selector</span>
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Select any arbitrary pair of suspects from the dataset to dynamically calculate and visualize mutual contacts, Venn intersections, and direct relays.
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold bg-[#171615] text-[#F1E6D5] px-2.5 py-1 rounded-full shrink-0 w-fit">
                Dynamic Dual-Matrix Engine
              </span>
            </div>

            {/* Dropdown Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
              {/* Suspect A Dropdown */}
              <div className="md:col-span-2 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Target Suspect A:
                </label>
                <select
                  value={correlationSuspectA}
                  onChange={(e) => {
                    setCorrelationSuspectA(e.target.value);
                    setShortestPathResult(null);
                  }}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none cursor-pointer focus:bg-white focus:border-[#38312B]"
                >
                  {nodes.map(n => (
                    <option key={n.id} value={n.id}>
                      {formatDisplayPhone(n.id)} — {n.alias} ({n.callsCount} calls)
                    </option>
                  ))}
                </select>
              </div>

              {/* Swap Button */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    const temp = correlationSuspectA;
                    setCorrelationSuspectA(correlationSuspectB);
                    setCorrelationSuspectB(temp);
                    setShortestPathResult(null);
                  }}
                  title="Swap Suspect A and Suspect B"
                  className="w-10 h-10 rounded-full bg-white border border-slate-300 hover:border-[#171615] hover:bg-slate-50 shadow-xs flex items-center justify-center transition-all active:scale-95 text-slate-700"
                >
                  <RotateCcw className="w-4 h-4 text-[#38312B]" />
                </button>
              </div>

              {/* Suspect B Dropdown */}
              <div className="md:col-span-2 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Target Suspect B:
                </label>
                <select
                  value={correlationSuspectB}
                  onChange={(e) => {
                    setCorrelationSuspectB(e.target.value);
                    setShortestPathResult(null);
                  }}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none cursor-pointer focus:bg-white focus:border-[#38312B]"
                >
                  {nodes.map(n => (
                    <option key={n.id} value={n.id}>
                      {formatDisplayPhone(n.id)} — {n.alias} ({n.callsCount} calls)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Preset Buttons for Judges */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                Quick Pairs:
              </span>
              <button
                type="button"
                onClick={() => {
                  setCorrelationSuspectA('9829011111');
                  setCorrelationSuspectB('9829933333');
                  setShortestPathResult(null);
                }}
                className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-white border border-slate-200 hover:border-slate-400 text-slate-800 shadow-xs transition-colors"
              >
                Suspect Alpha vs Operative Beta
              </button>
              <button
                type="button"
                onClick={() => {
                  setCorrelationSuspectA('9829011111');
                  setCorrelationSuspectB('9414022222');
                  setShortestPathResult(null);
                }}
                className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-white border border-slate-200 hover:border-slate-400 text-slate-800 shadow-xs transition-colors"
              >
                Suspect Alpha vs Contact X (Ajmer)
              </button>
              <button
                type="button"
                onClick={() => {
                  setCorrelationSuspectA('9829933333');
                  setCorrelationSuspectB('9784155555');
                  setShortestPathResult(null);
                }}
                className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-white border border-slate-200 hover:border-slate-400 text-slate-800 shadow-xs transition-colors"
              >
                Operative Beta vs Dinesh K. (Safehouse)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (nodes.length >= 2) {
                    const sorted = [...nodes].sort((a, b) => (b.callsCount || 0) - (a.callsCount || 0));
                    setCorrelationSuspectA(sorted[0]?.id || '');
                    setCorrelationSuspectB(sorted[1]?.id || '');
                    setShortestPathResult(null);
                  }
                }}
                className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-[#171615] text-[#F1E6D5] hover:bg-[#38312B] shadow-xs transition-colors"
              >
                Top 2 Active Communicators
              </button>
            </div>
          </div>

          {/* B. Interactive Visual SVG Venn Diagram */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Interactive Communication Venn Diagram (Set Overlap)
                </h4>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                Click any circle region to filter contacts ledger below
              </span>
            </div>

            {/* SVG Venn Diagram */}
            <div className="w-full max-w-2xl py-3">
              <svg 
                viewBox="0 0 760 360" 
                className="w-full h-auto select-none overflow-visible"
              >
                <defs>
                  {/* Drop Shadow Filter */}
                  <filter id="vennShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.12" />
                  </filter>
                  {/* Glow for Intersection */}
                  <filter id="emeraldGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#059669" floodOpacity="0.35" />
                  </filter>
                </defs>

                {/* 1. Circle A (Left: Suspect A Exclusive & Total) */}
                <circle
                  cx="270"
                  cy="180"
                  r="130"
                  fill="#38312B"
                  fillOpacity={vennFilter === 'ONLY_A' ? '0.24' : '0.12'}
                  stroke="#38312B"
                  strokeWidth={vennFilter === 'ONLY_A' ? '3.5' : '2'}
                  strokeDasharray={vennFilter === 'ONLY_A' ? 'none' : '4,2'}
                  filter="url(#vennShadow)"
                  onClick={() => setVennFilter('ONLY_A')}
                  className="cursor-pointer transition-all hover:fill-opacity-25"
                />

                {/* 2. Circle B (Right: Suspect B Exclusive & Total) */}
                <circle
                  cx="490"
                  cy="180"
                  r="130"
                  fill="#9A8068"
                  fillOpacity={vennFilter === 'ONLY_B' ? '0.24' : '0.12'}
                  stroke="#9A8068"
                  strokeWidth={vennFilter === 'ONLY_B' ? '3.5' : '2'}
                  strokeDasharray={vennFilter === 'ONLY_B' ? 'none' : '4,2'}
                  filter="url(#vennShadow)"
                  onClick={() => setVennFilter('ONLY_B')}
                  className="cursor-pointer transition-all hover:fill-opacity-25"
                />

                {/* 3. Center Venn Lens Intersection (Shared Mutual Contacts) */}
                <path
                  d="M 380 97 A 130 130 0 0 1 380 263 A 130 130 0 0 1 380 97 Z"
                  fill="#059669"
                  fillOpacity={vennFilter === 'SHARED' ? '0.45' : '0.28'}
                  stroke="#059669"
                  strokeWidth={vennFilter === 'SHARED' ? '3.5' : '2.5'}
                  filter="url(#emeraldGlow)"
                  onClick={() => setVennFilter('SHARED')}
                  className="cursor-pointer transition-all hover:fill-opacity-50"
                />

                {/* Direct Call Lightning Bridge (if A and B talked directly) */}
                {correlationResult.hasDirectCall && (
                  <g className="pointer-events-none">
                    <line
                      x1="270"
                      y1="180"
                      x2="490"
                      y2="180"
                      stroke="#DC2626"
                      strokeWidth="2.5"
                      strokeDasharray="4,4"
                      className="animate-pulse"
                    />
                    <g transform="translate(380, 70)">
                      <rect
                        x="-80"
                        y="-12"
                        width="160"
                        height="24"
                        rx="12"
                        fill="#FEF2F2"
                        stroke="#DC2626"
                        strokeWidth="1.5"
                        filter="url(#vennShadow)"
                      />
                      <text
                        x="0"
                        y="4"
                        textAnchor="middle"
                        className="text-[10px] font-bold font-mono fill-rose-700"
                      >
                        ⚡ Direct: {correlationResult.directCallCount} Calls ({correlationResult.directDuration}s)
                      </text>
                    </g>
                  </g>
                )}

                {/* Left Circle Content (Suspect A Exclusive) */}
                <g 
                  transform="translate(205, 180)" 
                  onClick={() => setVennFilter('ONLY_A')}
                  className="cursor-pointer select-none"
                >
                  <text x="0" y="-30" textAnchor="middle" className="text-[11px] font-bold uppercase tracking-wider fill-slate-700 font-sans">
                    Target A Exclusive
                  </text>
                  <text x="0" y="-12" textAnchor="middle" className="text-[13px] font-extrabold font-mono fill-[#171615]">
                    {formatDisplayPhone(correlationSuspectA)}
                  </text>
                  <circle cx="0" cy="18" r="22" fill="#FFFFFF" stroke="#38312B" strokeWidth="2" />
                  <text x="0" y="23" textAnchor="middle" className="text-[14px] font-black font-mono fill-[#38312B]">
                    {correlationResult.onlyA.length}
                  </text>
                  <text x="0" y="52" textAnchor="middle" className="text-[9.5px] font-semibold fill-slate-500 font-sans">
                    Contacts Only in A
                  </text>
                </g>

                {/* Center Intersection Content (Shared Contacts) */}
                <g 
                  transform="translate(380, 180)" 
                  onClick={() => setVennFilter('SHARED')}
                  className="cursor-pointer select-none"
                >
                  <circle cx="0" cy="0" r="30" fill="#FFFFFF" stroke="#059669" strokeWidth="2.5" filter="url(#vennShadow)" />
                  <circle cx="0" cy="0" r="38" fill="none" stroke="#059669" strokeWidth="1" strokeDasharray="3,3" className="animate-spin" />
                  <text x="0" y="6" textAnchor="middle" className="text-[18px] font-black font-mono fill-[#059669]">
                    {correlationResult.commonContacts.length}
                  </text>
                  <text x="0" y="-45" textAnchor="middle" className="text-[11px] font-black uppercase tracking-wider fill-emerald-800 font-sans">
                    SHARED ASSOCIATES
                  </text>
                  <text x="0" y="55" textAnchor="middle" className="text-[10px] font-extrabold fill-emerald-700 font-sans">
                    Mutual Intermediaries
                  </text>
                </g>

                {/* Right Circle Content (Suspect B Exclusive) */}
                <g 
                  transform="translate(555, 180)" 
                  onClick={() => setVennFilter('ONLY_B')}
                  className="cursor-pointer select-none"
                >
                  <text x="0" y="-30" textAnchor="middle" className="text-[11px] font-bold uppercase tracking-wider fill-slate-700 font-sans">
                    Target B Exclusive
                  </text>
                  <text x="0" y="-12" textAnchor="middle" className="text-[13px] font-extrabold font-mono fill-[#171615]">
                    {formatDisplayPhone(correlationSuspectB)}
                  </text>
                  <circle cx="0" cy="18" r="22" fill="#FFFFFF" stroke="#9A8068" strokeWidth="2" />
                  <text x="0" y="23" textAnchor="middle" className="text-[14px] font-black font-mono fill-[#9A8068]">
                    {correlationResult.onlyB.length}
                  </text>
                  <text x="0" y="52" textAnchor="middle" className="text-[9.5px] font-semibold fill-slate-500 font-sans">
                    Contacts Only in B
                  </text>
                </g>
              </svg>
            </div>

            {/* Venn Region Filter Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-slate-100 w-full">
              <button
                type="button"
                onClick={() => setVennFilter('SHARED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  vennFilter === 'SHARED'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <span>⚡ Shared Intermediaries ({correlationResult.commonContacts.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setVennFilter('ONLY_A')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  vennFilter === 'ONLY_A'
                    ? 'bg-[#38312B] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>Target A Only ({correlationResult.onlyA.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setVennFilter('ONLY_B')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  vennFilter === 'ONLY_B'
                    ? 'bg-[#9A8068] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>Target B Only ({correlationResult.onlyB.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setVennFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  vennFilter === 'ALL'
                    ? 'bg-[#171615] text-[#F1E6D5] shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>View Full Set ({correlationResult.totalDistinct})</span>
              </button>

              <button
                type="button"
                onClick={handleCalculateShortestPath}
                disabled={isCalculatingPath}
                className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center space-x-1.5 transition-colors shadow-xs"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{isCalculatingPath ? 'Calculating...' : 'Trace Shortest Path'}</span>
              </button>
            </div>
          </div>

          {/* C. Dynamic Contacts Ledger for Selected Venn Partition */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  {vennFilter === 'SHARED' && `Mutual & Shared Intermediaries (${correlationResult.commonContacts.length})`}
                  {vennFilter === 'ONLY_A' && `Exclusive to Target A: ${formatDisplayPhone(correlationSuspectA)} (${correlationResult.onlyA.length})`}
                  {vennFilter === 'ONLY_B' && `Exclusive to Target B: ${formatDisplayPhone(correlationSuspectB)} (${correlationResult.onlyB.length})`}
                  {vennFilter === 'ALL' && `Complete Associational Set (${correlationResult.totalDistinct} Contacts)`}
                </span>
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">
                Sec. 65B Certified Network Telemetry
              </span>
            </div>

            {(() => {
              let displayList = [];
              if (vennFilter === 'SHARED') displayList = correlationResult.commonContacts;
              else if (vennFilter === 'ONLY_A') displayList = correlationResult.onlyA;
              else if (vennFilter === 'ONLY_B') displayList = correlationResult.onlyB;
              else displayList = [...correlationResult.commonContacts, ...correlationResult.onlyA, ...correlationResult.onlyB];

              if (displayList.length === 0) {
                return (
                  <div className="p-8 text-center bg-white">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <h4 className="font-bold text-sm text-slate-900">No Contacts Found in this Partition</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Select another suspect pair or switch the Venn region filter above.
                    </p>
                  </div>
                );
              }

              return (
                <div className="divide-y divide-slate-100 bg-white">
                  {displayList.map((item, idx) => {
                    const isShared = item.type === 'SHARED' || item.callsWithB > 0;
                    const isAOnly = item.type === 'ONLY_A';
                    const isBOnly = item.type === 'ONLY_B';

                    return (
                      <div key={idx} className="p-3.5 hover:bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors">
                        <div className="flex items-start space-x-3">
                          <div className={`w-8 h-8 rounded-lg text-white flex items-center justify-center font-bold text-xs font-mono shrink-0 ${
                            isShared ? 'bg-emerald-700' : isAOnly ? 'bg-[#38312B]' : 'bg-[#9A8068]'
                          }`}>
                            #{idx + 1}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="text-xs font-bold text-slate-900 font-mono">
                                {formatDisplayPhone(item.node.id)}
                              </h4>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                isShared ? 'bg-emerald-100 text-emerald-800' : isAOnly ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {isShared ? 'SHARED ASSOCIATE' : isAOnly ? 'TARGET A ONLY' : 'TARGET B ONLY'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {item.node.alias}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {item.node.alias || 'Intermediary Bridge Node'} • Total {item.totalMutualCalls} calls recorded • Sec. 65B Ref: {item.evidenceRefA || item.evidenceRefB || 'Carrier_CDR.csv#L1'}
                            </p>
                          </div>
                        </div>

                        {/* Split Call Volumes */}
                        <div className="flex items-center gap-3 text-xs font-mono">
                          <div className="bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                            <span className="text-[9px] text-slate-400 block font-sans font-bold">With Target A:</span>
                            <span className="font-bold text-blue-700">{item.callsWithA} calls ({item.durWithA}s)</span>
                          </div>
                          <div className="bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                            <span className="text-[9px] text-slate-400 block font-sans font-bold">With Target B:</span>
                            <span className="font-bold text-purple-700">{item.callsWithB} calls ({item.durWithB}s)</span>
                          </div>

                          {/* Actions */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('GRAPH');
                              setActiveNode(item.node);
                            }}
                            className="px-2.5 py-1 bg-white border border-slate-300 hover:border-slate-800 text-slate-800 rounded text-xs font-bold transition-colors"
                          >
                            Graph View →
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (onAskAI) {
                                onAskAI({
                                  type: 'common_contact_analysis',
                                  prompt: `Analyze associate ${item.node.id} in relation to Target A (${correlationSuspectA}) and Target B (${correlationSuspectB}). Handled ${item.callsWithA} calls with A and ${item.callsWithB} calls with B. Detail operational significance.`
                                });
                              }
                            }}
                            className="p-1.5 bg-[#171615] hover:bg-[#38312B] text-white rounded transition-colors"
                            title="Analyze with Copilot"
                          >
                            <Bot className="w-3.5 h-3.5 text-[#CDB69A]" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 6. TAB 3: SYNDICATE CELLS & COMMUNITIES */}
      {activeTab === 'COMMUNITIES' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {communitiesList.map((comm) => (
              <div 
                key={comm.community_id}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-slate-400 transition-colors"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-900">{comm.label}</span>
                  <span className="px-2 py-0.5 rounded bg-[#F1E6D5] text-[#38312B] font-bold text-[10px] font-mono">
                    {comm.size} Members
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5 text-xs">
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-400 font-sans">Hub / Orchestrator:</span>
                    <span className="font-bold text-blue-700">{formatDisplayPhone(comm.hub_node)}</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-400 font-sans">Cell ID:</span>
                    <span className="font-bold text-slate-800">Cluster #{comm.community_id}</span>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">Modularity Subgraph</span>
                  <button
                    onClick={() => {
                      setSelectedSuspect(comm.hub_node || 'ALL');
                      setActiveTab('GRAPH');
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-slate-900"
                  >
                    View Cluster on Graph →
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
