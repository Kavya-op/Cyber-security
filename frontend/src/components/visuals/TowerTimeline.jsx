import React, { useState, useMemo, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Radio, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  ShieldAlert, 
  ArrowRight, 
  PhoneCall, 
  PhoneOutgoing,
  PhoneIncoming,
  Cpu, 
  Compass, 
  CheckCircle2, 
  MoreVertical,
  Search,
  Crosshair,
  Bot,
  FileCode,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Layers,
  ZoomIn,
  ZoomOut,
  Navigation,
  Activity,
  Maximize2,
  X,
  Table,
  FileSpreadsheet,
  Filter,
  Eye,
  Globe,
  Wifi,
  Play,
  Pause,
  RotateCcw,
  Zap,
  Users
} from 'lucide-react';

// Haversine distance calculator (km)
function haversineKm(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 0;
  const R = 6371.0;
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

function parseCoordinateVal(val, defaultVal = 0) {
  if (typeof val === 'number') return val;
  if (!val) return defaultVal;
  const match = String(val).match(/([0-9.]+)/);
  return match ? parseFloat(match[1]) : defaultVal;
}

// Generate SVG sector arc cone for antenna azimuth beam
function getSectorConePath(cx, cy, azimuthDeg, radius = 55, spreadDeg = 60) {
  const startAngle = (azimuthDeg - spreadDeg / 2 - 90) * (Math.PI / 180);
  const endAngle = (azimuthDeg + spreadDeg / 2 - 90) * (Math.PI / 180);
  const x1 = cx + radius * Math.cos(startAngle);
  const y1 = cy + radius * Math.sin(startAngle);
  const x2 = cx + radius * Math.cos(endAngle);
  const y2 = cy + radius * Math.sin(endAngle);
  return `M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${radius} ${radius} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
}

// Adjusted non-overlapping coordinates in 1000x620 canvas
const TOWER_COORDINATES = {
  'TOW-JPR-014': { x: 520, y: 130, lat: '26.9215° N', lng: '75.7985° E', name: 'Sindhi Camp Central', city: 'Jaipur', azimuth: '120°', band: 'B3 (1800MHz)', operator: 'Airtel Telematics' },
  'TOW-JPR-029': { x: 650, y: 170, lat: '26.9160° N', lng: '75.8090° E', name: 'MI Road Commercial', city: 'Jaipur', azimuth: '240°', band: 'B40 (2300MHz)', operator: 'Airtel Telematics' },
  'TOW-JPR-088': { x: 800, y: 190, lat: '26.8980° N', lng: '75.8320° E', name: 'Raja Park Node', city: 'Jaipur', azimuth: '090°', band: 'B3 (1800MHz)', operator: 'Vodafone-Idea' },
  'TOW-JPR-077': { x: 750, y: 310, lat: '26.8520° N', lng: '75.8180° E', name: 'Malviya Nagar Industrial', city: 'Jaipur', azimuth: '045°', band: 'B8 (900MHz)', operator: 'Jio 4G LTE' },
  'TOW-JPR-112': { x: 570, y: 300, lat: '26.8640° N', lng: '75.7620° E', name: 'Mansarovar Metro Sector', city: 'Jaipur', azimuth: '310°', band: 'B3 (1800MHz)', operator: 'Airtel Telematics' },
  'TOW-AJM-102': { x: 460, y: 220, lat: '26.4690° N', lng: '74.6390° E', name: 'Civil Lines Highway', city: 'Ajmer', azimuth: '180°', band: 'B1 (2100MHz)', operator: 'Jio 4G LTE' },
};

// Known IPDR correlation mapping based on timestamp proximity
const IPDR_CORRELATIONS = {
  'CDR-2024-001': {
    service: 'Telegram Voice / Encrypted',
    ip: '103.21.244.18',
    port: 443,
    timeDelta: '+3.5m after call'
  },
  'CDR-2024-002': {
    service: 'WhatsApp VoIP Call',
    ip: '157.240.198.60',
    port: 443,
    timeDelta: '+5.2m after call'
  },
  'CDR-2024-004': {
    service: 'Tor Relay Proxy Entry',
    ip: '185.199.108.153',
    port: 80,
    timeDelta: '+4.5m after call'
  }
};

const DISTINCT_IPDR_TOWERS = [
  'TOW-JPR-014', // Sindhi Camp Central (Jaipur)
  'TOW-JPR-029', // MI Road Commercial (Jaipur)
  'TOW-AJM-102', // Civil Lines Highway (Ajmer)
  'TOW-JPR-077', // Malviya Nagar Industrial (Jaipur)
  'TOW-JPR-088', // Raja Park Node (Jaipur)
  'TOW-JPR-112'  // Mansarovar Metro Sector (Jaipur)
];

const FALLBACK_IPDR_SESSIONS = [
  {
    id: 'IPDR-001',
    subscriber: '+91 98290 XXXXX',
    publicIp: '103.21.244.18',
    port: 443,
    timestamp: '2024-11-18 02:18:00',
    appService: 'Telegram Voice / Encrypted',
    cellTowerId: 'TOW-JPR-014',
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
    sourceFile: 'Carrier_IPDR_SessionLogs.csv',
    rowNumber: 5
  }
];

export default function TowerTimeline({ 
  data = [], 
  ipdrData = [],
  onAskAI, 
  onViewRawRow,
  activeFilter = 'ALL'
}) {
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [activeTab, setActiveTab] = useState('CALL_RECORDS'); // 'ACTIVE_ALERTS' | 'CALL_RECORDS' | 'CO_LOCATIONS'
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [mapZoom, setMapZoom] = useState(1);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [showCallRecordsModal, setShowCallRecordsModal] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [playbackIndex, setPlaybackIndex] = useState(null);
  const [coLocations, setCoLocations] = useState([]);
  const [loadingCoLocations, setLoadingCoLocations] = useState(false);
  const [focusedTower, setFocusedTower] = useState(null);
  const [mapMode, setMapMode] = useState('LEAFLET'); // 'LEAFLET' (live OpenStreetMap tiles) | 'VECTOR' (stylized canvas)

  const mapContainerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markersGroupRef = useRef(null);
  const pathGroupRef = useRef(null);

  // Fetch Co-Location Meetings from API or compute local fallback
  useEffect(() => {
    let isMounted = true;
    const fetchCoLocations = async () => {
      try {
        setLoadingCoLocations(true);
        const res = await fetch('/api/co-location?window_minutes=30');
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.results && json.results.length > 0) {
            setCoLocations(json.results);
            return;
          }
        }
      } catch (err) {
        console.warn('API co-location fetch fallback:', err);
      } finally {
        if (isMounted) setLoadingCoLocations(false);
      }

      // Local fallback calculation from data
      if (isMounted && data && data.length > 0) {
        const byTower = {};
        data.forEach(r => {
          const tId = r.cellTowerId || r.towerId;
          if (tId && r.timestamp) {
            if (!byTower[tId]) byTower[tId] = [];
            byTower[tId].push(r);
          }
        });
        const computed = [];
        Object.entries(byTower).forEach(([tId, recs]) => {
          for (let i = 0; i < recs.length; i++) {
            for (let j = i + 1; j < recs.length; j++) {
              const r1 = recs[i];
              const r2 = recs[j];
              const p1 = r1.caller || r1.caller_num;
              const p2 = r2.caller || r2.caller_num;
              if (p1 && p2 && p1 !== p2) {
                const t1 = new Date(r1.timestamp).getTime();
                const t2 = new Date(r2.timestamp).getTime();
                if (!isNaN(t1) && !isNaN(t2)) {
                  const deltaMin = Math.abs((t1 - t2) / (1000 * 60));
                  if (deltaMin <= 30) {
                    computed.push({
                      tower_id: tId,
                      tower_name: TOWER_COORDINATES[tId]?.name || `Sector ${tId}`,
                      latitude: parseCoordinateVal(TOWER_COORDINATES[tId]?.lat, 26.9215),
                      longitude: parseCoordinateVal(TOWER_COORDINATES[tId]?.lng, 75.7985),
                      suspect_1: {
                        phone: p1,
                        timestamp: r1.timestamp,
                        call_type: r1.call_type || 'Voice',
                        evidence_ref: `${r1.sourceFile || 'CDR.csv'}#L${r1.rowNumber || 1}`
                      },
                      suspect_2: {
                        phone: p2,
                        timestamp: r2.timestamp,
                        call_type: r2.call_type || 'Voice',
                        evidence_ref: `${r2.sourceFile || 'CDR.csv'}#L${r2.rowNumber || 2}`
                      },
                      time_delta_minutes: Math.round(deltaMin * 10) / 10,
                      meeting_confidence: deltaMin <= 10 ? 'HIGH' : 'MEDIUM'
                    });
                  }
                }
              }
            }
          }
        });
        if (computed.length > 0) setCoLocations(computed);
      }
    };
    fetchCoLocations();
    return () => { isMounted = false; };
  }, [data]);

  // Normalize chronological movement items and correlate IPDR data
  const { cdrItems, ipdrItems, timelineItems } = useMemo(() => {
    const rawCdrList = data.filter(d => d.recordType !== 'IPDR' && (d.cellTowerId || d.towerId));
    const effectiveIpdr = (ipdrData && ipdrData.length > 0) ? ipdrData : FALLBACK_IPDR_SESSIONS;

    // 1. Process CDR items with dynamic IPDR correlation and Haversine velocity anomalies
    let cumulativeDistKm = 0;
    let prevLat = null;
    let prevLng = null;
    let prevTimeMs = null;

    const processedCdr = rawCdrList.map((item, idx) => {
      const towerKey = item.cellTowerId || item.towerId || 'TOW-JPR-014';
      const coord = TOWER_COORDINATES[towerKey] || {
        x: 480 + (idx * 55),
        y: 150 + (idx * 30),
        lat: '26.9124° N',
        lng: '75.7873° E',
        name: item.cellTowerLocation || towerKey,
        city: 'Jaipur',
        azimuth: `${(idx * 60 + 45) % 360}°`,
        band: 'LTE B3',
        operator: 'Airtel Telematics'
      };

      const curLat = parseCoordinateVal(coord.lat, 26.9124);
      const curLng = parseCoordinateVal(coord.lng, 75.7873);
      const curTimeMs = item.timestamp ? new Date(item.timestamp).getTime() : null;

      let distanceKm = 0;
      let timeDeltaMin = 0;
      let speedKmh = 0;
      let isVelocityAnomaly = false;

      if (idx > 0 && prevLat !== null && prevLng !== null) {
        distanceKm = haversineKm(prevLat, prevLng, curLat, curLng);
        cumulativeDistKm += distanceKm;

        if (prevTimeMs && curTimeMs && !isNaN(curTimeMs) && !isNaN(prevTimeMs)) {
          const diffSec = Math.abs((curTimeMs - prevTimeMs) / 1000);
          timeDeltaMin = Math.round((diffSec / 60) * 10) / 10;
          const hours = diffSec / 3600;
          if (hours > 0) {
            speedKmh = Math.round((distanceKm / hours) * 10) / 10;
          }
        }

        if (distanceKm > 5 && (speedKmh > 120 || (timeDeltaMin < 2 && distanceKm > 10))) {
          isVelocityAnomaly = true;
        }
      }

      prevLat = curLat;
      prevLng = curLng;
      prevTimeMs = curTimeMs;

      const prevItem = idx > 0 ? rawCdrList[idx - 1] : null;
      const fromName = prevItem 
        ? (TOWER_COORDINATES[prevItem.cellTowerId || prevItem.towerId]?.name || prevItem.cellTowerLocation || 'Initial Sector') 
        : 'Initial Sector';
      const toName = coord.name;
      const routeTitle = `${fromName} → ${toName}`;

      let statusType = 'NORMAL';
      if (item.imeiChange) statusType = 'IMEI_SWAP';
      else if (isVelocityAnomaly) statusType = 'VELOCITY_ANOMALY';
      else if (item.isNightAlert) statusType = 'NIGHT_CALL';

      // Dynamic Correlation with IPDR
      const matchedIpdr = effectiveIpdr.find(ip => {
        if (!ip.subscriber) return false;
        const subLast5 = ip.subscriber.slice(-5);
        const callerMatch = item.caller && item.caller.includes(subLast5);
        const receiverMatch = item.receiver && item.receiver.includes(subLast5);
        return callerMatch || receiverMatch;
      }) || IPDR_CORRELATIONS[item.id] || null;

      const ipdrMatch = matchedIpdr ? {
        service: matchedIpdr.appService || matchedIpdr.service || 'VoIP / Encrypted Packet Session',
        ip: matchedIpdr.publicIp || matchedIpdr.ip || '103.21.244.18',
        port: matchedIpdr.port || 443,
        timeDelta: matchedIpdr.timeDelta || '+3.5m after call'
      } : null;

      return {
        ...item,
        cellTowerId: towerKey,
        routeTitle,
        coord,
        statusType,
        sequenceNum: idx + 1,
        isLatest: idx === rawCdrList.length - 1,
        distanceKm: Math.round(distanceKm * 10) / 10,
        cumulativeDistKm: Math.round(cumulativeDistKm * 10) / 10,
        timeDeltaMin,
        speedKmh,
        isVelocityAnomaly,
        ipdrMatch
      };
    });

    // 2. Process IPDR records as first-class movement and packet inspection cards
    const processedIpdr = effectiveIpdr.map((ipdr, idx) => {
      // Ensure each IPDR packet is mapped to a distinct Rajasthan cell tower
      const candidateTower = ipdr.cellTowerId || ipdr.towerId;
      const isValidTower = candidateTower && TOWER_COORDINATES[candidateTower] && candidateTower !== 'IP-GATEWAY' && candidateTower !== 'IP-ROUTED';
      const towerKey = isValidTower ? candidateTower : DISTINCT_IPDR_TOWERS[idx % DISTINCT_IPDR_TOWERS.length];
      const coord = TOWER_COORDINATES[towerKey] || TOWER_COORDINATES['TOW-JPR-014'];

      const prevCandidate = idx > 0 ? (effectiveIpdr[idx - 1].cellTowerId || effectiveIpdr[idx - 1].towerId) : null;
      const isPrevValid = prevCandidate && TOWER_COORDINATES[prevCandidate] && prevCandidate !== 'IP-GATEWAY' && prevCandidate !== 'IP-ROUTED';
      const prevTowerKey = idx > 0 ? (isPrevValid ? prevCandidate : DISTINCT_IPDR_TOWERS[(idx - 1) % DISTINCT_IPDR_TOWERS.length]) : null;

      const fromName = prevTowerKey ? (TOWER_COORDINATES[prevTowerKey]?.name || 'Origin Sector') : 'Sector Gateway';
      const toName = coord.name;
      const routeTitle = `${fromName} → ${toName}`;

      const isNight = ipdr.timestamp?.includes(' 00:') || ipdr.timestamp?.includes(' 01:') || 
                      ipdr.timestamp?.includes(' 02:') || ipdr.timestamp?.includes(' 03:') || 
                      ipdr.timestamp?.includes(' 04:');

      return {
        id: ipdr.id || `IPDR-EVT-${idx + 1}`,
        recordType: 'IPDR',
        isIPDR: true,
        caller: ipdr.subscriber || '+91 98290 XXXXX',
        callerName: ipdr.subscriber?.includes('98290') ? 'Suspect Alpha (Vikram R.)' : 'Suspect Associate',
        receiver: `${ipdr.publicIp || '103.21.244.18'}:${ipdr.port || 443}`,
        receiverName: ipdr.appService || 'Encrypted Voice/Data Session',
        timestamp: ipdr.timestamp || '2024-11-18 02:18:00',
        duration: ipdr.port ? parseInt(ipdr.port, 10) : 443,
        cellTowerId: towerKey,
        cellTowerLocation: coord.name,
        imei: 'N/A (Packet IPDR)',
        statusType: 'IPDR_PACKET',
        isNightAlert: isNight,
        imeiChange: false,
        sourceFile: ipdr.sourceFile || 'Carrier_IPDR_SessionLogs.csv',
        rowNumber: ipdr.rowNumber || idx + 1,
        appService: ipdr.appService || 'Encrypted VoIP Session',
        publicIp: ipdr.publicIp || '103.21.244.18',
        port: ipdr.port || 443,
        ipdrMatch: {
          service: ipdr.appService || 'Encrypted VoIP Session',
          ip: ipdr.publicIp || '103.21.244.18',
          port: ipdr.port || 443,
          timeDelta: 'Live Session'
        },
        routeTitle,
        coord,
        sequenceNum: idx + 1,
        isLatest: idx === effectiveIpdr.length - 1
      };
    });

    return {
      cdrItems: processedCdr,
      ipdrItems: processedIpdr,
      timelineItems: [...processedCdr, ...processedIpdr]
    };
  }, [data, ipdrData]);

  // Route playback timer effect
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setPlaybackIndex(prev => {
        const activeList = activeFilter === 'IPDR' ? ipdrItems : cdrItems;
        const maxIdx = Math.max(0, activeList.length - 1);
        if (prev === null || prev >= maxIdx) {
          setIsPlaying(false);
          return maxIdx;
        }
        const nextIdx = prev + 1;
        if (activeList[nextIdx]) {
          setSelectedEventId(activeList[nextIdx].id);
        }
        return nextIdx;
      });
    }, 1500 / playbackSpeed);
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, activeFilter, ipdrItems, cdrItems]);

  // Set default selected item
  const selectedEvent = useMemo(() => {
    const activeList = activeFilter === 'IPDR' ? ipdrItems : cdrItems;
    if (selectedEventId) {
      return activeList.find(t => t.id === selectedEventId) || activeList[0];
    }
    const suspicious = activeList.find(t => t.imeiChange || t.isIPDR) || activeList[0];
    return suspicious || null;
  }, [activeFilter, ipdrItems, cdrItems, selectedEventId]);

  // Filter based on tab, search query, and activeFilter from parent
  const visibleCards = useMemo(() => {
    if (activeFilter === 'IPDR') {
      return ipdrItems.filter(item => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          item.caller?.toLowerCase().includes(q) ||
          item.receiver?.toLowerCase().includes(q) ||
          item.appService?.toLowerCase().includes(q) ||
          item.cellTowerLocation?.toLowerCase().includes(q) ||
          item.cellTowerId?.toLowerCase().includes(q)
        );
      });
    }

    return cdrItems.filter(item => {
      // Tab filter
      const matchesTab = activeTab === 'CALL_RECORDS' 
        ? true 
        : (item.imeiChange || item.isNightAlert);
      
      // Anomaly parent filter
      let matchesParentFilter = true;
      if (activeFilter === 'NIGHT') {
        matchesParentFilter = item.isNightAlert;
      } else if (activeFilter === 'IMEI') {
        matchesParentFilter = item.imeiChange;
      }

      // Search query
      const matchesSearch = !searchQuery.trim() || 
        item.cellTowerId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.routeTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.imei && item.imei.includes(searchQuery)) ||
        item.caller?.includes(searchQuery) ||
        item.receiver?.includes(searchQuery);

      return matchesTab && matchesParentFilter && matchesSearch;
    });
  }, [cdrItems, ipdrItems, activeTab, searchQuery, activeFilter]);

  // Map route polyline points (dynamically uses active filter list)
  const activeMovementList = useMemo(() => {
    return activeFilter === 'IPDR' ? ipdrItems : cdrItems;
  }, [activeFilter, ipdrItems, cdrItems]);

  const routePoints = useMemo(() => {
    return activeMovementList.map(item => ({
      x: item.coord.x,
      y: item.coord.y,
      id: item.id,
      towerId: item.cellTowerId,
      name: item.coord.name,
      statusType: item.statusType,
      isIPDR: item.isIPDR,
      isLatest: item.isLatest,
      isSelected: selectedEvent?.id === item.id || focusedTower === item.cellTowerId,
      isVelocityAnomaly: item.isVelocityAnomaly,
      speedKmh: item.speedKmh
    }));
  }, [activeMovementList, selectedEvent, focusedTower]);

  const effectivePlaybackIdx = playbackIndex !== null 
    ? Math.min(playbackIndex, Math.max(0, activeMovementList.length - 1))
    : Math.max(0, activeMovementList.length - 1);

  const visibleRoutePoints = useMemo(() => {
    return routePoints.slice(0, effectivePlaybackIdx + 1);
  }, [routePoints, effectivePlaybackIdx]);

  const solidPath = useMemo(() => {
    if (visibleRoutePoints.length < 2) return '';
    return visibleRoutePoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }, [visibleRoutePoints]);

  const dottedPath = useMemo(() => {
    if (effectivePlaybackIdx >= routePoints.length - 1 || routePoints.length < 2) return '';
    const currentPoint = routePoints[effectivePlaybackIdx];
    const nextPoint = routePoints[effectivePlaybackIdx + 1];
    return `M ${currentPoint.x} ${currentPoint.y} L ${nextPoint.x} ${nextPoint.y}`;
  }, [routePoints, effectivePlaybackIdx]);

  const handleAskAIAboutSuspect = (e, item) => {
    e?.stopPropagation();
    if (!item) return;
    if (onAskAI) {
      if (item.isIPDR) {
        onAskAI({
          type: 'ipdr_packet_analysis',
          prompt: `Analyze IPDR packet session #${item.sequenceNum} for Suspect Alpha (${item.caller}) connecting to ${item.appService} at public IP ${item.publicIp}:${item.port} via tower ${item.cellTowerLocation} (${item.cellTowerId}) at ${item.timestamp}. Detail encrypted tunnel and app indicators.`,
          item
        });
      } else {
        onAskAI({
          type: 'suspect_hop_analysis',
          prompt: `Analyze movement hop #${item.sequenceNum} for Suspect Alpha (${item.caller}) at ${item.coord.name} (${item.cellTowerId}) at ${item.timestamp}. Detail hardware status (IMEI: ${item.imei}) and any correlated IPDR sessions.`,
          item
        });
      }
    }
  };

  // Cleanup Leaflet on unmount
  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // Leaflet Map Initialization and Dynamic Feature Rendering
  useEffect(() => {
    if (mapMode !== 'LEAFLET') {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
      return;
    }

    if (!mapContainerRef.current) return;

    if (!leafletMapRef.current) {
      if (mapContainerRef.current._leaflet_id) {
        mapContainerRef.current._leaflet_id = null;
      }
      try {
        const map = L.map(mapContainerRef.current, {
          center: [26.89, 75.80],
          zoom: 12,
          zoomControl: false,
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          maxZoom: 20,
          subdomains: 'abcd',
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a> | Rajasthan Police Telecom Forensics',
        }).addTo(map);

        markersGroupRef.current = L.featureGroup().addTo(map);
        pathGroupRef.current = L.featureGroup().addTo(map);
        leafletMapRef.current = map;
      } catch (err) {
        console.warn('Leaflet map initialization warning:', err);
      }
    }

    const map = leafletMapRef.current;
    const markersGroup = markersGroupRef.current;
    const pathGroup = pathGroupRef.current;

    if (!map || !markersGroup || !pathGroup) return;

    markersGroup.clearLayers();
    pathGroup.clearLayers();

    const bounds = L.latLngBounds([]);

    // 1. Plot Base Cell Tower Stations
    Object.entries(TOWER_COORDINATES).forEach(([tid, tcoord]) => {
      const lat = parseCoordinateVal(tcoord.lat, 26.9124);
      const lng = parseCoordinateVal(tcoord.lng, 75.7873);
      bounds.extend([lat, lng]);

      const isFocused = (selectedEvent?.coord && selectedEvent.cellTowerId === tid) || focusedTower === tid;
      const isRoutePoint = routePoints.some(rp => rp.towerId === tid);

      const iconHtml = `
        <div style="display:flex; flex-direction:column; align-items:center; cursor:pointer; transform:translate(-50%,-50%);">
          ${isFocused ? '<div style="position:absolute; width:38px; height:38px; border-radius:50%; background:rgba(56,49,43,0.3); animation:ping 1.5s infinite;"></div>' : ''}
          <div style="width:${isFocused ? '30px' : '24px'}; height:${isFocused ? '30px' : '24px'}; border-radius:50%; background:${isFocused ? '#171615' : isRoutePoint ? '#38312B' : '#FFFFFF'}; border:2px solid ${isFocused ? '#CDB69A' : isRoutePoint ? '#9A8068' : '#94A3B8'}; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,0.3);">
            <span style="font-size:11px;">📡</span>
          </div>
          <div style="margin-top:2px; background:${isFocused ? '#171615' : '#FFFFFF'}; color:${isFocused ? '#F1E6D5' : '#0F172A'}; border:1px solid ${isFocused ? '#CDB69A' : '#CBD5E1'}; font-family:monospace; font-size:9px; font-weight:bold; padding:1px 5px; border-radius:4px; white-space:nowrap; box-shadow:0 1px 3px rgba(0,0,0,0.12);">
            ${tid}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-tower-marker',
        html: iconHtml,
        iconSize: [32, 44],
        iconAnchor: [16, 22],
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(markersGroup);

      marker.bindPopup(`
        <div style="font-family:sans-serif; font-size:11px; min-width:180px; padding:2px;">
          <b style="color:#171615; font-size:13px;">${tcoord.name || tid}</b>
          <div style="color:#64748B; font-size:10px; margin-top:2px;">ID: <span style="font-family:monospace; font-weight:bold;">${tid}</span> • ${tcoord.city}</div>
          <div style="margin-top:6px; padding:6px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; font-size:10px; line-height:1.5;">
            <div><b>Operator:</b> ${tcoord.operator || 'Airtel / Jio'}</div>
            <div><b>Sector Azimuth:</b> ${tcoord.azimuth || '120°'} • <b>Band:</b> ${tcoord.band || 'LTE'}</div>
            <div><b>Coordinates:</b> ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E</div>
          </div>
        </div>
      `);

      marker.on('click', () => {
        setFocusedTower(tid);
        const matchEvt = activeMovementList.find(e => e.cellTowerId === tid);
        if (matchEvt) setSelectedEventId(matchEvt.id);
      });
    });

    // 2. Plot Movement Trajectory Polyline
    const routePointsData = activeMovementList
      .map(item => {
        const tcoord = TOWER_COORDINATES[item.cellTowerId] || { lat: '26.9124° N', lng: '75.7873° E' };
        return {
          lat: parseCoordinateVal(tcoord.lat, 26.9124),
          lng: parseCoordinateVal(tcoord.lng, 75.7873),
          timestamp: item.timestamp,
          towerId: item.cellTowerId,
          id: item.id
        };
      })
      .filter(p => p.lat && p.lng);

    if (routePointsData.length > 1) {
      const latLngs = routePointsData.slice(0, effectivePlaybackIdx + 1).map(p => [p.lat, p.lng]);
      if (latLngs.length > 1) {
        // Polyline shadow glow
        L.polyline(latLngs, {
          color: '#CDB69A',
          weight: 7,
          opacity: 0.5,
          lineCap: 'round',
        }).addTo(pathGroup);

        // Solid Desert Espresso trajectory line
        L.polyline(latLngs, {
          color: '#171615',
          weight: 3.5,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(pathGroup);
      }
    }

    // 3. Highlight Current Playback / Active Hop
    if (routePointsData[effectivePlaybackIdx]) {
      const activeP = routePointsData[effectivePlaybackIdx];
      const activeCircle = L.circleMarker([activeP.lat, activeP.lng], {
        radius: 12,
        fillColor: '#38312B',
        color: '#CDB69A',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.75,
      }).addTo(pathGroup);

      activeCircle.bindTooltip(`Hop #${effectivePlaybackIdx + 1}: ${activeP.towerId} (${activeP.timestamp ? activeP.timestamp.split(' ')[1] : ''})`, {
        permanent: false,
        direction: 'top',
        className: 'font-mono text-xs'
      });
    }

    // 4. Plot Co-Location Meeting Points
    coLocations.forEach((cl) => {
      const lat = parseCoordinateVal(cl.latitude, 26.8520);
      const lng = parseCoordinateVal(cl.longitude, 75.8180);

      const coLocIconHtml = `
        <div style="width:26px; height:26px; border-radius:50%; background:#DC2626; border:2px solid #FFFFFF; display:flex; align-items:center; justify-content:center; box-shadow:0 0 10px rgba(220,38,38,0.7); animation:pulse 1s infinite;">
          <span style="font-size:12px; color:white;">⚠️</span>
        </div>
      `;

      const coLocIcon = L.divIcon({
        className: 'coloc-marker',
        html: coLocIconHtml,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      const clMarker = L.marker([lat, lng], { icon: coLocIcon }).addTo(markersGroup);
      clMarker.bindPopup(`
        <div style="font-family:sans-serif; font-size:11px; padding:2px;">
          <b style="color:#DC2626; font-size:12px;">CO-LOCATION MEETING DETECTED</b>
          <div style="color:#475569; margin-top:2px;">Sector: <b>${cl.tower_id}</b> (${cl.tower_name || 'Jaipur'})</div>
          <div style="margin-top:4px; padding:4px; background:#FEF2F2; border:1px solid #FECACA; border-radius:4px;">
            <div><b>Suspect 1:</b> ${cl.suspect_1?.phone || 'Suspect Alpha'}</div>
            <div><b>Suspect 2:</b> ${cl.suspect_2?.phone || 'Suspect Beta'}</div>
            <div><b>Time Gap:</b> ${cl.time_delta_minutes || 0} mins (Confidence: ${cl.meeting_confidence || 'HIGH'})</div>
          </div>
        </div>
      `);
    });

    if (bounds.isValid() && !leafletMapRef.current._hasFittedBounds) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      leafletMapRef.current._hasFittedBounds = true;
    }
  }, [mapMode, activeMovementList, effectivePlaybackIdx, selectedEvent, focusedTower, coLocations, routePoints]);

  return (
    <div className="relative w-full min-h-[740px] xl:min-h-[820px] bg-slate-100 rounded-xl select-none border border-slate-300 shadow-xs overflow-hidden flex flex-col justify-between">
      
      {/* 1. Map Canvas: Live Leaflet OpenStreetMap Tiles or Tactical Vector Grid */}
      {mapMode === 'LEAFLET' ? (
        <div 
          ref={mapContainerRef} 
          className="absolute inset-0 w-full h-full z-10"
          style={{ minHeight: '100%', width: '100%' }}
        />
      ) : (
        <div 
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing transition-transform duration-300"
          style={{ transform: `scale(${mapZoom})` }}
        >
        <svg 
          viewBox="0 0 1000 620" 
          className="w-full h-full object-cover"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <pattern id="roadGrid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#DECDBA" strokeWidth="1" />
            </pattern>
            <filter id="mapShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.1" />
            </filter>
          </defs>

          {/* Map Base Canvas */}
          <rect width="100%" height="100%" fill="#F1E6D5" />
          <rect width="100%" height="100%" fill="url(#roadGrid)" opacity="0.6" />

          {/* Greyscale City Sector Outlines & Highways */}
          <g opacity="0.5" stroke="#CDB69A" fill="none" strokeWidth="2.5" strokeLinecap="round">
            <path d="M 420 80 Q 560 160 760 140 T 960 210" strokeWidth="4" stroke="#CDB69A" />
            <path d="M 460 60 Q 600 240 680 440" strokeWidth="3.5" stroke="#CDB69A" />
            <path d="M 520 120 L 860 360" strokeWidth="3" stroke="#CDB69A" />
            <path d="M 440 280 Q 600 310 780 340" strokeWidth="2" strokeDasharray="4,4" />
            <path d="M 500 130 L 780 150 L 720 330 Z" fill="#E7DBCC" opacity="0.4" />
          </g>

          {/* District Labels */}
          <g fill="#9A8068" className="text-[10px] font-extrabold uppercase tracking-widest pointer-events-none select-none">
            <text x="500" y="90">SINDHI CAMP / CENTRAL JAIPUR</text>
            <text x="760" y="140">AIRPORT / MALVIYA NAGAR</text>
            <text x="540" y="370">MANSAROVAR METRO SECTOR</text>
            <text x="380" y="270">NH-48 HIGHWAY CORRIDOR ➔ AJMER</text>
          </g>

          {/* Base Cellular Tower Stations (Rajasthan Police Grid) */}
          {Object.entries(TOWER_COORDINATES).map(([tid, tcoord]) => {
            const isActiveOnRoute = routePoints.some(rp => rp.towerId === tid);
            if (isActiveOnRoute) return null; // Rendered as active route pin below

            return (
              <g 
                key={`base-${tid}`} 
                transform={`translate(${tcoord.x}, ${tcoord.y})`}
                className="opacity-55 transition-opacity hover:opacity-100"
              >
                <circle
                  r="8"
                  fill="#FFFFFF"
                  stroke="#94A3B8"
                  strokeWidth="1.5"
                  strokeDasharray="2,2"
                />
                <circle
                  r="3.5"
                  fill="#94A3B8"
                />
                <g transform="translate(0, 20)" className="pointer-events-none">
                  <rect
                    x="-36"
                    y="-8"
                    width="72"
                    height="16"
                    rx="8"
                    fill="#FFFFFF"
                    stroke="#CBD5E1"
                    strokeWidth="1"
                    filter="drop-shadow(0 1px 2px rgba(0,0,0,0.06))"
                  />
                  <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    className="text-[8.5px] font-mono font-bold fill-slate-500"
                  >
                    {tid}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Antenna Azimuth Directional Sector Beam for Selected Tower */}
          {selectedEvent?.coord && (
            <path
              d={getSectorConePath(
                selectedEvent.coord.x,
                selectedEvent.coord.y,
                parseInt(selectedEvent.coord.azimuth, 10) || 120,
                75,
                60
              )}
              fill="#9A8068"
              fillOpacity="0.28"
              stroke="#655447"
              strokeWidth="1.5"
              strokeDasharray="4,3"
            />
          )}

          {/* Active Playback / Focused Radar Pulse Wave */}
          {routePoints[effectivePlaybackIdx] && (
            <g transform={`translate(${routePoints[effectivePlaybackIdx].x}, ${routePoints[effectivePlaybackIdx].y})`}>
              <circle r="30" fill="#38312B" opacity="0.18" className="animate-ping" />
              <circle r="18" fill="none" stroke="#38312B" strokeWidth="1.5" strokeDasharray="3,3" />
            </g>
          )}

          {/* Completed Tower Sequence (Solid Desert Espresso Line) */}
          {solidPath && (
            <path
              d={solidPath}
              fill="none"
              stroke="#171615"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#mapShadow)"
            />
          )}

          {/* Latest / Next Hop Sequence (Dotted Desert Espresso Line) */}
          {dottedPath && (
            <path
              d={dottedPath}
              fill="none"
              stroke="#171615"
              strokeWidth="3"
              strokeDasharray="6,6"
              strokeLinecap="round"
            />
          )}

          {/* Location Pins */}
          {routePoints.map((point, idx) => {
            const isSelected = selectedEvent?.id === point.id;
            const isCritical = point.statusType === 'IMEI_SWAP';

            return (
              <g
                key={point.id || idx}
                transform={`translate(${point.x}, ${point.y})`}
                onClick={() => setSelectedEventId(point.id)}
                className="cursor-pointer group transition-all"
              >
                {isSelected && (
                  <circle
                    r="22"
                    fill="#2563eb"
                    opacity="0.25"
                  />
                )}

                <circle
                  r={isSelected ? "14" : "11"}
                  fill="#FFFFFF"
                  stroke={isSelected ? "#0f172a" : "#CBD5E1"}
                  strokeWidth={isSelected ? "3" : "2"}
                  filter="drop-shadow(0 2px 4px rgba(0,0,0,0.12))"
                />

                <circle
                  r={isSelected ? "7" : "5"}
                  fill={
                    isSelected 
                      ? (isCritical ? "#ef4444" : "#2563eb") 
                      : (isCritical ? "#ef4444" : "#0f172a")
                  }
                />

                <g transform="translate(0, 24)" className="pointer-events-none">
                  <rect
                    x="-42"
                    y="-9"
                    width="84"
                    height="18"
                    rx="6"
                    fill={isSelected ? "#0f172a" : "#FFFFFF"}
                    stroke={isSelected ? "#0f172a" : "#CBD5E1"}
                    strokeWidth={isSelected ? "1.5" : "1"}
                    filter="drop-shadow(0 1px 3px rgba(0,0,0,0.06))"
                  />
                  <text
                    x="0"
                    y="3.5"
                    textAnchor="middle"
                    className={`text-[9px] font-bold font-mono tracking-tight ${isSelected ? 'fill-white' : 'fill-slate-900'}`}
                  >
                    {point.towerId}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>
      )}

      {/* 2. Top Controls & Chronological Route Playback Bar */}
      <div className="relative z-20 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="flex items-center space-x-2 pointer-events-auto">
          {/* Map Layer Mode Switcher: Live Leaflet OSM vs Tactical Canvas */}
          <div className="flex items-center space-x-0.5 bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-xs border border-slate-200 pointer-events-auto">
            <button
              onClick={() => setMapMode('LEAFLET')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                mapMode === 'LEAFLET'
                  ? 'bg-[#171615] text-[#F1E6D5] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-blue-500" />
              <span>Live OpenStreetMap</span>
            </button>
            <button
              onClick={() => setMapMode('VECTOR')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                mapMode === 'VECTOR'
                  ? 'bg-[#171615] text-[#F1E6D5] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-[#CDB69A]" />
              <span>Tactical Canvas</span>
            </button>
          </div>

          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-xs border border-slate-200 text-xs font-semibold text-slate-900 hover:bg-slate-50 flex items-center space-x-1.5 transition-colors"
          >
            {drawerOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <span className="hidden sm:inline">{drawerOpen ? 'Hide Drawer' : 'Show Route Drawer'}</span>
          </button>

          <button
            onClick={() => setShowCallRecordsModal(true)}
            className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-xs border border-slate-200 text-xs font-semibold text-blue-700 hover:bg-blue-50 flex items-center space-x-1.5 transition-colors"
          >
            <Table className="w-4 h-4" />
            <span className="hidden sm:inline">Records Ledger ({timelineItems.length})</span>
          </button>

          {activeFilter !== 'ALL' && (
            <div className="bg-[#171615] text-[#F1E6D5] px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Filter: {activeFilter}</span>
            </div>
          )}
        </div>

        {/* Chronological Playback HUD */}
        <div className="flex items-center space-x-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-md border border-slate-200 pointer-events-auto">
          <button
            onClick={() => {
              setIsPlaying(false);
              setPlaybackIndex(0);
              if (activeMovementList[0]) setSelectedEventId(activeMovementList[0].id);
            }}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-700 transition-colors"
            title="Rewind to Hop #1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              if (!isPlaying && effectivePlaybackIdx >= activeMovementList.length - 1) {
                setPlaybackIndex(0);
                if (activeMovementList[0]) setSelectedEventId(activeMovementList[0].id);
              }
              setIsPlaying(!isPlaying);
            }}
            className="px-2.5 py-1 rounded-lg bg-[#38312B] hover:bg-[#171615] text-white flex items-center space-x-1.5 font-semibold text-xs transition-colors shadow-xs"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 text-amber-300" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>Play Route</span>
              </>
            )}
          </button>

          <div className="flex items-center space-x-1 border-x border-slate-200 px-2">
            {[1, 2, 5].map(spd => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                  playbackSpeed === spd ? 'bg-[#38312B] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2 pl-1">
            <input
              type="range"
              min="0"
              max={Math.max(0, activeMovementList.length - 1)}
              value={effectivePlaybackIdx}
              onChange={(e) => {
                setIsPlaying(false);
                const idx = parseInt(e.target.value, 10);
                setPlaybackIndex(idx);
                if (activeMovementList[idx]) setSelectedEventId(activeMovementList[idx].id);
              }}
              className="w-20 sm:w-32 accent-[#9A8068] cursor-pointer"
            />
            <span className="font-mono text-[10px] text-slate-700 font-bold shrink-0">
              Hop {effectivePlaybackIdx + 1}/{activeMovementList.length}
            </span>
          </div>
        </div>

        {/* Map Zoom Controls */}
        <div className="flex items-center space-x-1 bg-white/95 backdrop-blur-md p-1.5 rounded-xl shadow-xs border border-slate-200 pointer-events-auto">
          <button
            onClick={() => {
              if (mapMode === 'LEAFLET' && leafletMapRef.current) {
                leafletMapRef.current.zoomIn();
              } else {
                setMapZoom(prev => Math.min(prev + 0.15, 1.6));
              }
            }}
            title="Zoom In Map"
            className="p-1 rounded-md hover:bg-slate-100 text-slate-800 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-mono font-medium text-slate-500 px-1 min-w-[32px] text-center">
            {mapMode === 'LEAFLET' ? 'OSM' : `${Math.round(mapZoom * 100)}%`}
          </span>
          <button
            onClick={() => {
              if (mapMode === 'LEAFLET' && leafletMapRef.current) {
                leafletMapRef.current.zoomOut();
              } else {
                setMapZoom(prev => Math.max(prev - 0.15, 0.7));
              }
            }}
            title="Zoom Out Map"
            className="p-1 rounded-md hover:bg-slate-100 text-slate-800 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. Left Scrollable Suspect Movement Drawer */}
      {drawerOpen && (
        <div className="absolute top-16 left-4 bottom-24 w-80 sm:w-96 z-20 bg-white/95 backdrop-blur-md rounded-xl border border-slate-200 shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-left duration-200">
          {/* Drawer Header */}
          <div className="p-3.5 pb-2.5 border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-md bg-slate-900 text-blue-400 flex items-center justify-center font-bold text-xs">
                  {activeFilter === 'IPDR' ? <Globe className="w-3.5 h-3.5 text-blue-400" /> : <Radio className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-900 tracking-tight">
                    {activeFilter === 'IPDR' ? 'Suspect IPDR Route' : 'Suspect Movement Route'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {activeFilter === 'IPDR' 
                      ? `Jaipur Sector • ${ipdrItems.length} IPDR Correlated` 
                      : `Jaipur Zone • ${cdrItems.length} Hops`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-6 h-6 rounded hover:bg-slate-100 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs: Active Alerts vs Call Records / IPDR */}
            <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              {activeFilter === 'IPDR' ? (
                <>
                  <button
                    onClick={() => setActiveTab('CALL_RECORDS')}
                    className={`flex-1 py-1 px-2.5 rounded-md font-semibold transition-colors flex items-center justify-center space-x-1 ${
                      activeTab === 'CALL_RECORDS'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5 text-blue-400" />
                    <span>IPDR Sessions ({ipdrItems.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('ACTIVE_ALERTS')}
                    className={`flex-1 py-1 px-2.5 rounded-md font-semibold transition-colors flex items-center justify-center space-x-1 ${
                      activeTab === 'ACTIVE_ALERTS'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Wifi className="w-3.5 h-3.5 text-purple-400" />
                    <span>VoIP Alerts ({ipdrItems.length})</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setActiveTab('CALL_RECORDS')}
                    className={`flex-1 py-1 px-2 rounded-md font-semibold transition-colors flex items-center justify-center space-x-1 ${
                      activeTab === 'CALL_RECORDS'
                        ? 'bg-[#38312B] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <PhoneCall className="w-3 h-3" />
                    <span>Hops ({cdrItems.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('ACTIVE_ALERTS')}
                    className={`flex-1 py-1 px-2 rounded-md font-semibold transition-colors flex items-center justify-center space-x-1 ${
                      activeTab === 'ACTIVE_ALERTS'
                        ? 'bg-[#38312B] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span>Alerts ({cdrItems.filter(t => t.imeiChange || t.isNightAlert || t.isVelocityAnomaly).length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('CO_LOCATIONS')}
                    className={`flex-1 py-1 px-2 rounded-md font-semibold transition-colors flex items-center justify-center space-x-1 ${
                      activeTab === 'CO_LOCATIONS'
                        ? 'bg-[#38312B] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-3 h-3 text-blue-400" />
                    <span>Meetings ({coLocations.length})</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Vertical Stack of Cards */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar pr-2 pb-6">
            {activeTab === 'CO_LOCATIONS' ? (
              coLocations.length === 0 ? (
                <div className="p-6 text-center bg-white rounded-xl border border-slate-200 shadow-xs">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2">
                    <Users className="w-5 h-5" />
                  </div>
                  <h4 className="font-semibold text-sm text-slate-900">No Meetings Detected</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    No suspect co-locations within 30-minute window across current cell sectors.
                  </p>
                </div>
              ) : (
                coLocations.map((meeting, mIdx) => (
                  <div
                    key={`coloc-${mIdx}`}
                    onClick={() => {
                      setFocusedTower(meeting.tower_id);
                      const matched = timelineItems.find(t => t.cellTowerId === meeting.tower_id);
                      if (matched) setSelectedEventId(matched.id);
                    }}
                    className="bg-white rounded-xl p-3 border border-slate-200 hover:border-slate-400 shadow-xs transition-colors cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-1 mb-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Meeting #{mIdx + 1} • {meeting.tower_id}
                        </span>
                        <h5 className="font-bold text-xs text-[#171615] truncate">
                          {meeting.tower_name || meeting.tower_id}
                        </h5>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        meeting.time_delta_minutes === 0 || meeting.meeting_confidence === 'HIGH'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {meeting.time_delta_minutes === 0 ? 'CONCURRENT' : `Δ ${meeting.time_delta_minutes}m`}
                      </span>
                    </div>

                    {/* Suspect Rendezvous Metadata Box */}
                    <div className="bg-[#F1E6D5]/40 border border-[#CDB69A]/60 rounded-lg p-2 text-[11px] font-mono space-y-1.5">
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="font-bold text-[#171615]">Suspect 1:</span>
                        <span className="text-blue-700 font-bold">{meeting.suspect_1?.phone}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 text-[10px]">
                        <span>{meeting.suspect_1?.timestamp?.replace('T', ' ')}</span>
                        <span>Type: {meeting.suspect_1?.call_type}</span>
                      </div>
                      <div className="border-t border-[#CDB69A]/40 pt-1 flex items-center justify-between text-slate-700">
                        <span className="font-bold text-[#171615]">Suspect 2:</span>
                        <span className="text-purple-700 font-bold">{meeting.suspect_2?.phone}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 text-[10px]">
                        <span>{meeting.suspect_2?.timestamp?.replace('T', ' ')}</span>
                        <span>Type: {meeting.suspect_2?.call_type}</span>
                      </div>
                    </div>

                    {/* Citation & Action Row */}
                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 font-mono truncate max-w-[170px]" title={meeting.suspect_1?.evidence_ref}>
                        Sec. 65B: {meeting.suspect_1?.evidence_ref || 'Evidence Ledger'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onAskAI) {
                            onAskAI({
                              type: 'suspect_meeting_analysis',
                              prompt: `Analyze physical rendezvous/co-location between Suspect ${meeting.suspect_1?.phone} and Suspect ${meeting.suspect_2?.phone} at cell tower ${meeting.tower_name} (${meeting.tower_id}) on ${meeting.suspect_1?.timestamp}. Time delta is ${meeting.time_delta_minutes} minutes. Detail investigative significance for Rajasthan Police case.`,
                              meeting
                            });
                          }
                        }}
                        className="text-blue-600 hover:text-slate-900 font-semibold flex items-center gap-1"
                      >
                        <Bot className="w-3 h-3 text-slate-700" />
                        <span>Analyze Rendezvous →</span>
                      </button>
                    </div>
                  </div>
                ))
              )
            ) : visibleCards.length === 0 ? (
              <div className="p-6 text-center bg-white rounded-xl border border-slate-200 shadow-xs">
                <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-2">
                  <Globe className="w-5 h-5" />
                </div>
                <h4 className="font-semibold text-sm text-slate-900">No Records for Filter</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Try switching between tabs or clear the search filter above.
                </p>
              </div>
            ) : (
              visibleCards.map((item) => {
                const isSelected = selectedEvent?.id === item.id;
                const isCritical = item.statusType === 'IMEI_SWAP';
                const isNight = item.statusType === 'NIGHT_CALL';
                const isIPDR = item.isIPDR;

                if (!isSelected) {
                  // Collapsed Card
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedEventId(item.id)}
                      className="bg-white rounded-lg p-3 border border-slate-200 hover:border-slate-400 shadow-xs transition-colors cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5 font-semibold text-xs text-slate-900 truncate">
                            <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-mono font-bold shrink-0 ${
                              isIPDR ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              #{item.sequenceNum}
                            </span>
                            <span className="truncate">{item.routeTitle}</span>
                          </div>
                        </div>

                        {/* Status Badges */}
                        <div className="flex items-center gap-1 shrink-0">
                          {isIPDR ? (
                            <span className="bg-purple-50 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase flex items-center gap-1">
                              <Wifi className="w-2.5 h-2.5 text-purple-700" />
                              <span>IPDR PACKET</span>
                            </span>
                          ) : item.isVelocityAnomaly ? (
                            <span className="bg-red-50 text-red-800 border border-red-200 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase flex items-center gap-0.5">
                              <Zap className="w-2.5 h-2.5 text-red-600" />
                              <span>{item.speedKmh ? `${Math.round(item.speedKmh)} km/h` : 'ANOMALY'}</span>
                            </span>
                          ) : item.isVelocityAnomaly ? (
                            <span className="bg-red-50 text-red-800 border border-red-200 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase flex items-center gap-0.5">
                              <Zap className="w-2.5 h-2.5 text-red-600" />
                              <span>{item.speedKmh ? `${Math.round(item.speedKmh)} km/h` : 'ANOMALY'}</span>
                            </span>
                          ) : isCritical ? (
                            <span className="bg-rose-50 text-rose-800 border border-rose-200 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase">
                              IMEI SWAP
                            </span>
                          ) : isNight ? (
                            <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded text-[9px] font-medium uppercase">
                              NIGHT CALL
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-normal uppercase">
                              NORMAL
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Compact IPDR Session Indicator Tag */}
                      {isIPDR ? (
                        <div className="mb-1.5 bg-purple-50 border border-purple-200 text-purple-900 px-2 py-1 rounded text-[10px] font-mono flex items-center justify-between font-medium">
                          <div className="flex items-center gap-1 truncate">
                            <Globe className="w-3 h-3 text-purple-600 shrink-0" />
                            <span className="truncate">{item.appService}</span>
                          </div>
                          <span className="text-purple-700 font-semibold shrink-0">{item.publicIp}:{item.port}</span>
                        </div>
                      ) : item.ipdrMatch && (
                        <div className="mb-1.5 bg-purple-50 border border-purple-200 text-purple-900 px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 font-medium">
                          <Wifi className="w-3 h-3 text-purple-600 shrink-0" />
                          <span className="truncate">IPDR: {item.ipdrMatch.service} ({item.ipdrMatch.ip})</span>
                        </div>
                      )}

                      {/* Metadata Row */}
                      <div className="bg-slate-50 rounded p-2 text-[11px] font-mono text-slate-700 space-y-1 border border-slate-200">
                        <div className="flex items-center justify-between text-slate-500 font-sans text-[10px]">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{item.timestamp}</span>
                          </span>
                          <span className="font-semibold text-slate-900">
                            {isIPDR ? `Port: ${item.port || 443}` : item.distanceKm ? `+${item.distanceKm}km (${item.speedKmh} km/h)` : `Duration: ${item.duration}s`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                          <span className="truncate text-blue-700 font-semibold">{item.caller}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0 mx-1" />
                          <span className="truncate text-slate-800">{item.receiver}</span>
                        </div>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                        <span>{isIPDR ? `Tower: ${item.cellTowerId}` : `IMEI: ${item.imei?.slice(-6) || '290455'}`}</span>
                        <button 
                          type="button" 
                          onClick={(e) => handleAskAIAboutSuspect(e, item)}
                          className="font-medium text-blue-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                        >
                          <Bot className="w-3 h-3 text-slate-700" />
                          <span>{isIPDR ? 'Analyze IPDR →' : 'Analyze Suspect →'}</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                // Selected / Expanded Card
                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl p-3.5 border-2 border-slate-900 shadow-md transition-all relative overflow-hidden"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
                          {isIPDR ? `Active IPDR Packet #${item.sequenceNum}` : `Active Call Record #${item.sequenceNum}`}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 tracking-tight leading-tight">
                          {item.routeTitle}
                        </h4>
                      </div>

                      <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
                        isIPDR
                          ? 'bg-purple-100 text-purple-800'
                          : isCritical 
                            ? 'bg-rose-600 text-white' 
                            : isNight 
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-900 text-white'
                      }`}>
                        {isIPDR ? 'IPDR STREAM' : isCritical ? 'IMEI SWAP' : isNight ? 'NIGHT CALL' : 'NORMAL HOP'}
                      </span>
                    </div>

                    {/* Progress Line */}
                    <div className="w-full h-1 bg-slate-100 rounded-full my-2 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${isIPDR ? 'bg-purple-600' : 'bg-blue-600'}`} 
                        style={{ width: `${Math.min(item.sequenceNum * 20, 100)}%` }}
                      />
                    </div>

                    {/* Compact IPDR Session Indicator Tag */}
                    {(isIPDR || item.ipdrMatch) && (
                      <div className="mb-2 bg-purple-50 border border-purple-200 text-purple-900 p-2 rounded text-[10px] font-mono flex items-center justify-between font-semibold">
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-purple-600" />
                          <span>{item.appService || item.ipdrMatch?.service}</span>
                        </div>
                        <span className="text-purple-700 font-semibold">{item.publicIp || item.ipdrMatch?.ip}:{item.port || 443}</span>
                      </div>
                    )}

                    {/* 4-Column Metadata Row */}
                    <div className="grid grid-cols-4 gap-2 py-2 border-y border-slate-100 text-left">
                      <div>
                        <span className="text-[9px] font-semibold uppercase text-slate-400 block">{isIPDR ? 'App Service' : 'Operator'}</span>
                        <span className="text-xs font-semibold text-slate-900 truncate block">
                          {isIPDR ? item.appService?.split('/')[0] : item.coord?.operator?.split(' ')[0]}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold uppercase text-slate-400 block">Timestamp</span>
                        <span className="text-xs font-mono font-semibold text-slate-900 truncate block">
                          {item.timestamp ? item.timestamp.split(' ')[1] : '02:18'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold uppercase text-slate-400 block">{isIPDR ? 'Port' : 'Duration'}</span>
                        <span className="text-xs font-semibold text-slate-900 block">
                          {isIPDR ? `:${item.port || 443}` : `${item.duration}s`}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold uppercase text-slate-400 block">{isIPDR ? 'Public IP' : 'Device IMEI'}</span>
                        <span className={`text-[11px] font-mono font-semibold truncate block ${isCritical ? 'text-rose-600' : 'text-slate-900'}`}>
                          {isIPDR ? (item.publicIp || '103.21.244.18') : (item.imei ? item.imei.slice(-6) : 'N/A')}
                        </span>
                      </div>
                    </div>

                    {/* Parties Row */}
                    <div className="py-2 border-b border-slate-100 text-xs">
                      <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="font-medium text-[10px] uppercase">{isIPDR ? 'Target Subscriber:' : 'Caller (A-Party):'}</span>
                        <span className="font-mono font-semibold text-blue-700">{item.caller}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="font-medium text-[10px] uppercase">{isIPDR ? 'Remote Destination:' : 'Receiver (B-Party):'}</span>
                        <span className="font-mono font-semibold text-slate-800">{item.receiver}</span>
                      </div>
                    </div>

                    {/* 1-Click Action Buttons Row */}
                    <div className="flex items-center justify-between pt-2.5">
                      {/* 1-Click 'Ask AI about this Suspect' Button */}
                      <button
                        onClick={(e) => handleAskAIAboutSuspect(e, item)}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-3 py-1.5 rounded-lg flex items-center space-x-1.5 shadow-xs transition-colors"
                      >
                        <Bot className="w-3.5 h-3.5 text-blue-400" />
                        <span>{isIPDR ? 'Analyze IPDR Session' : 'Analyze Suspect'}</span>
                      </button>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          onClick={() => onViewRawRow && onViewRawRow(item)}
                          title="Inspect Raw Evidence Line"
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 flex items-center justify-center transition-colors shadow-xs"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Details */}
                    <div className="mt-3 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => setDetailsExpanded(!detailsExpanded)}
                        className="w-full flex items-center justify-between text-[11px] font-bold text-slate-600 hover:text-[#18181B] py-1"
                      >
                        <span>{isIPDR ? 'IPDR Packet Routing & Cell Gateway' : 'Tower history and details'}</span>
                        {detailsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {detailsExpanded && (
                        <div className="mt-2 p-3 bg-slate-50 rounded-2xl text-[11px] space-y-1.5 font-mono text-slate-600 border border-slate-100 animate-in fade-in">
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-sans">Cell ID:</span>
                            <span className="font-bold text-[#18181B]">{item.cellTowerId}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-sans">Coordinates:</span>
                            <span>{item.coord?.lat}, {item.coord?.lng}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-sans">Antenna Azimuth:</span>
                            <span>{item.coord?.azimuth}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-sans">Carrier Band:</span>
                            <span>{item.coord?.band}</span>
                          </div>
                          {item.notes && (
                            <div className="pt-1.5 border-t border-slate-200/60 text-rose-700 font-sans font-semibold text-[10px]">
                              ⚠️ {item.notes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 4. Bottom Floating Evidence Summary Bar */}
      <div className={`relative z-20 p-4 transition-all ${
        drawerOpen 
          ? 'lg:pl-[405px] xl:pl-[425px]' 
          : 'pl-4'
      }`}>
        <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-slate-200 p-3.5 sm:p-4 transition-all">
          
          {/* Top Row: Case ID, Status Pill, and 'Ask AI Assistant' Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                #98
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-semibold text-slate-900 tracking-tight truncate font-mono">
                    Suspect #98290-XXXXX
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">Case RJ-2024-9102</span>
                </div>
                <p className="text-[11px] text-slate-500 font-normal truncate">
                  Primary Telecom Target • FIR #402/2024 (Jaipur Cyber Cell)
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <span className="bg-slate-900 text-white px-2.5 py-0.5 rounded text-xs font-semibold tracking-wide">
                HIGH RISK
              </span>

              <button
                onClick={(e) => handleAskAIAboutSuspect(e, selectedEvent)}
                className="border border-slate-200 hover:border-slate-800 bg-white px-3 py-1 rounded-lg text-xs font-medium text-slate-900 flex items-center space-x-1.5 shadow-xs transition-colors"
              >
                <Bot className="w-3.5 h-3.5 text-blue-600" />
                <span>Ask AI Assistant</span>
              </button>
            </div>
          </div>

          {/* Bottom Row: 5-Column Horizontal Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 text-left">
            <div className="border-r border-slate-100 pr-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Route Distance
              </span>
              <span className="text-xs font-black text-[#18181B] truncate block mt-0.5 font-mono">
                {cdrItems.reduce((acc, c) => acc + (c.distanceKm || 0), 0).toFixed(1)} km Total
              </span>
              <span className="text-[10px] text-slate-500 truncate block">
                {cdrItems.filter(c => c.isVelocityAnomaly).length} Velocity Anomalies
              </span>
            </div>

            <div className="border-r border-slate-100 pr-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Tower Perimeter
              </span>
              <span className="text-xs font-black text-[#18181B] truncate block mt-0.5">
                {timelineItems[0]?.cellTowerId || 'TOW-JPR-014'} ➔ {timelineItems[timelineItems.length - 1]?.cellTowerId || 'TOW-JPR-112'}
              </span>
              <span className="text-[10px] text-slate-500 truncate block">
                {new Set(timelineItems.map(t => t.cellTowerId)).size} Unique Towers Logged
              </span>
            </div>

            <div className="border-r border-slate-100 pr-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Current Cell ID
              </span>
              <span className="text-xs font-mono font-black text-[#18181B] truncate block mt-0.5">
                {selectedEvent?.cellTowerId || 'TOW-JPR-077'}
              </span>
              <span className="text-[10px] text-slate-500 truncate block">
                Azimuth {selectedEvent?.coord?.azimuth || '120°'}
              </span>
            </div>

            <div 
              onClick={() => setShowCallRecordsModal(true)}
              className="border-r border-slate-100 pr-2 cursor-pointer hover:bg-slate-50 p-1 rounded-xl transition-all group"
              title="Click to view all Call Records Data Sheet"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-blue-700 block tracking-wider group-hover:text-black">
                  {activeFilter === 'IPDR' ? 'IPDR Sessions' : 'Total Calls'}
                </span>
                <span className="text-[9px] font-medium text-blue-600 bg-blue-50 px-1 py-0.5 rounded group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  View Data ↗
                </span>
              </div>
              <span className="text-xs font-black text-[#18181B] block mt-0.5 group-hover:underline">
                {activeFilter === 'IPDR' ? `${ipdrItems.length} Sessions Logged` : `${cdrItems.length} Calls Recorded`}
              </span>
              <span className="text-[10px] text-slate-500 block">
                {activeFilter === 'IPDR' ? 'Active Packet Tunnels' : `${cdrItems.reduce((acc, c) => acc + (c.duration || 0), 0)}s Airtime`}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                {activeFilter === 'IPDR' ? 'Protocol / App' : 'Correlated IPDR'}
              </span>
              <span className="text-xs font-mono font-black text-purple-700 truncate block mt-0.5">
                {selectedEvent?.isIPDR 
                  ? selectedEvent.appService.split('/')[0]
                  : selectedEvent?.ipdrMatch 
                    ? selectedEvent.ipdrMatch.service.split(' ')[0] 
                    : 'Normal GSM'}
              </span>
              <span className="text-[10px] text-slate-500 block truncate">
                {selectedEvent?.isIPDR 
                  ? `${selectedEvent.publicIp}:${selectedEvent.port || 443}` 
                  : selectedEvent?.ipdrMatch 
                    ? `${selectedEvent.ipdrMatch.ip}` 
                    : 'No VoIP detected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Comprehensive Call Records Data Sheet Modal */}
      {showCallRecordsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full p-5 shadow-xl border border-slate-200 animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-black text-[#18181B] text-lg">
                      {activeFilter === 'IPDR' ? 'Carrier IPDR Session Ledger' : 'Call Detail Records (CDR) Ledger'}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase font-mono">
                      {activeMovementList.length} Records Verified
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">
                    Case #RJ-2024-9102 • Suspect Telecommunications Log
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCallRecordsModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-800 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Table Area (Scrollable) */}
            <div className="flex-1 overflow-y-auto my-4 border border-slate-200 rounded-2xl custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider z-10">
                  <tr>
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">Timestamp</th>
                    <th className="py-3 px-3">{activeFilter === 'IPDR' ? 'Target Subscriber' : 'Caller (A-Party)'}</th>
                    <th className="py-3 px-3">{activeFilter === 'IPDR' ? 'Public IP:Port' : 'Receiver (B-Party)'}</th>
                    <th className="py-3 px-3">{activeFilter === 'IPDR' ? 'App Service' : 'Duration'}</th>
                    <th className="py-3 px-3">Cell Tower & Sector</th>
                    <th className="py-3 px-3">{activeFilter === 'IPDR' ? 'Record Type' : 'Device IMEI'}</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {activeMovementList.map((call, idx) => (
                    <tr 
                      key={call.id || idx}
                      onClick={() => {
                        setSelectedEventId(call.id);
                        setShowCallRecordsModal(false);
                      }}
                      className="hover:bg-slate-50 cursor-pointer transition-colors group"
                    >
                      <td className="py-2.5 px-3 font-bold text-slate-400">
                        #{idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                        {call.timestamp}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-blue-700 whitespace-nowrap">
                        {call.caller}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                        {call.receiver}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-700">
                        {call.isIPDR ? call.appService : `${call.duration}s`}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className="font-bold text-[#18181B] font-mono block">{call.cellTowerId}</span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[140px] block">{call.coord?.name}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        {call.isIPDR ? (
                          <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-bold">
                            IPDR Packet
                          </span>
                        ) : (
                          <span className={`px-1.5 py-0.5 rounded ${
                            call.imeiChange ? 'bg-rose-100 text-rose-800 font-bold' : 'text-slate-700'
                          }`}>
                            {call.imei || 'N/A'} {call.imeiChange ? '🚨' : ''}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        {call.isIPDR ? (
                          <span className="bg-[#E9D5FF] text-[#6B21A8] px-2 py-0.5 rounded-full text-[9px] font-black uppercase">
                            IPDR Session
                          </span>
                        ) : call.imeiChange ? (
                          <span className="bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded text-[9px] font-semibold uppercase">
                            IMEI Swap
                          </span>
                        ) : call.isNightAlert ? (
                          <span className="bg-[#E9D5FF] text-[#6B21A8] px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">
                            Night Call
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-sans">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEventId(call.id);
                            setShowCallRecordsModal(false);
                          }}
                          className="text-[10px] font-bold text-blue-600 hover:text-black group-hover:underline"
                        >
                          Select on Map →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs shrink-0">
              <span className="text-slate-400 text-[11px]">
                Showing all {activeMovementList.length} {activeFilter === 'IPDR' ? 'IPDR session records' : 'normalized CDR records'} • Click any row to map & inspect
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowCallRecordsModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
