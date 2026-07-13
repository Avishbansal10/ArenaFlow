/**
 * ArenaFlow Pro — Application Store
 * FIFA World Cup 2026 edition. Manages reactive state with local persistence.
 */

"use strict";

const STADIUM_CONFIG = Object.freeze({
  name: 'MetLife Stadium (East Rutherford, NJ)',
  tournament: 'FIFA World Cup 2026',
  hostCities: Object.freeze(['East Rutherford', 'Mexico City', 'Vancouver', 'Miami'])
});

const DEFAULT_STATE = {
  matches: [
    {
      id: 'match-1',
      sport: 'Football',
      tournament: 'FIFA World Cup 2026 — Group A',
      teamA: { name: 'USA', score: 2, color: '#0A2540' },
      teamB: { name: 'England', score: 1, color: '#E41B23' },
      status: 'LIVE',
      time: '78:15',
      venue: 'MetLife Stadium (NJ)',
      date: '2026-07-14'
    },
    {
      id: 'match-2',
      sport: 'Football',
      tournament: 'FIFA World Cup 2026 — Group B',
      teamA: { name: 'Mexico', score: 0, color: '#006847' },
      teamB: { name: 'Argentina', score: 0, color: '#75AADB' },
      status: 'LIVE',
      time: '23:40',
      venue: 'Estadio Azteca (Mexico City)',
      date: '2026-07-14'
    },
    {
      id: 'match-3',
      sport: 'Football',
      tournament: 'FIFA World Cup 2026 — Group C',
      teamA: { name: 'Canada', score: 0, color: '#FF0000' },
      teamB: { name: 'France', score: 0, color: '#0055A5' },
      status: 'SCHEDULED',
      time: '19:30',
      venue: 'BC Place (Vancouver)',
      date: '2026-07-14'
    },
    {
      id: 'match-4',
      sport: 'Football',
      tournament: 'FIFA World Cup 2026 — Group D',
      teamA: { name: 'Germany', score: 3, color: '#000000' },
      teamB: { name: 'Brazil', score: 2, color: '#FEDF00' },
      status: 'COMPLETED',
      time: 'Full Time',
      venue: 'Hard Rock Stadium (Miami)',
      date: '2026-07-13'
    }
  ],
  incidents: [
    {
      id: 'inc-101',
      type: 'Spill',
      location: 'Block-104',
      description: 'Liquid spill reported in aisle near stairwell access.',
      severity: 'Medium',
      status: 'Assigned',
      assignedStaff: 'John Officer',
      reportedAt: new Date(Date.now() - 30 * 60000).toISOString()
    },
    {
      id: 'inc-102',
      type: 'Medical',
      location: 'Stairwell-3',
      description: 'Fan reporting minor dizziness. Usher requested.',
      severity: 'High',
      status: 'Open',
      assignedStaff: '',
      reportedAt: new Date(Date.now() - 5 * 60000).toISOString()
    }
  ],
  concessions: [
    {
      id: 'ord-501',
      seat: 'Block-104, Row G, Seat 9',
      items: 'Double Cheese Burger Combo ($14)',
      status: 'Preparing',
      runner: 'Rajesh Kumar',
      timestamp: new Date(Date.now() - 10 * 60000).toISOString()
    }
  ],
  sensors: {
    gates: [
      { id: 'gate-a', name: 'Gate A (North)', occupancy: 1120, capacity: 2000, flowRate: 45, alert: 'Normal' },
      { id: 'gate-b', name: 'Gate B (South)', occupancy: 1680, capacity: 2000, flowRate: 88, alert: 'Moderate' },
      { id: 'gate-c', name: 'Gate C (East)', occupancy: 2150, capacity: 2200, flowRate: 145, alert: 'Critical' },
      { id: 'gate-d', name: 'Gate D (West)', occupancy: 390, capacity: 1500, flowRate: 20, alert: 'Normal' }
    ],
    concessions: [
      { id: 'zone-1', name: 'Food Court Plaza', occupancy: 420, capacity: 500, queueWait: '10m', alert: 'Moderate' },
      { id: 'zone-2', name: 'North Wing Snacks', occupancy: 95, capacity: 250, queueWait: '2m', alert: 'Normal' },
      { id: 'zone-3', name: 'South Wing Beer & Pretzels', occupancy: 395, capacity: 400, queueWait: '22m', alert: 'Critical' }
    ]
  },
  announcements: [
    {
      id: 'ann-1',
      title: 'Gate C Congestion Notice',
      content: 'Gate C is heavily congested. We strongly recommend fans arrive/exit via Gate D (West) or Gate A (North) for faster transit.',
      type: 'Warning',
      timestamp: new Date(Date.now() - 15 * 60000).toISOString()
    }
  ],
  fanChatHistory: [
    { sender: 'aura', text: 'Hello! I am Aura, your FIFA World Cup 2026 Smart Stadium assistant. How can I help you navigate the arena, order concessions, or report safety issues today?' }
  ],
  operatorChatHistory: [
    { sender: 'aura', text: 'TOC Operational Assistant active. Please authenticate using your security PIN to perform remote queries.' }
  ],
  fansScanned: 41200,
  routesComputed: 0
};

const Store = {
  state: null,
  listeners: [],

  init() {
    try {
      const saved = localStorage.getItem('arena_flow_state_v3');
      if (saved) {
        this.state = JSON.parse(saved);
        if (!this.state.fanChatHistory) this.state.fanChatHistory = [...DEFAULT_STATE.fanChatHistory];
        if (!this.state.operatorChatHistory) this.state.operatorChatHistory = [...DEFAULT_STATE.operatorChatHistory];
        if (!this.state.fansScanned) this.state.fansScanned = DEFAULT_STATE.fansScanned;
        if (this.state.routesComputed === undefined) this.state.routesComputed = DEFAULT_STATE.routesComputed;
      } else {
        this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
        this.save();
      }
    } catch (e) {
      this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
      this.save();
    }
  },

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(c => c !== callback);
    };
  },

  save() {
    try {
      localStorage.setItem('arena_flow_state_v3', JSON.stringify(this.state));
    } catch (e) {
      console.error('State save failed:', e);
    }
    this.notify();
  },

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (e) {
        console.error('State notify listener failed:', e);
      }
    }
  },

  reset() {
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this.save();
    window.Security.AuditLogger.log('RESET_STORE', 'System Admin', 'SUCCESS', 'Application store reset to FIFA World Cup 2026 default presets.');
  },

  // State Mutators

  // --- Matches ---
  addMatch(matchData) {
    const newMatch = {
      id: window.Security.Csprng.generateId('match'),
      ...matchData,
      teamA: { ...matchData.teamA, score: parseInt(matchData.teamA.score) || 0 },
      teamB: { ...matchData.teamB, score: parseInt(matchData.teamB.score) || 0 }
    };
    this.state.matches.push(newMatch);
    this.save();
    window.Security.AuditLogger.log('ADD_MATCH', 'Operator', 'SUCCESS', `Created match: ${newMatch.teamA.name} vs ${newMatch.teamB.name}`);
    return newMatch;
  },

  updateScore(matchId, scoreA, scoreB) {
    const match = this.state.matches.find(m => m.id === matchId);
    if (match) {
      const oldScoreA = match.teamA.score;
      const oldScoreB = match.teamB.score;
      match.teamA.score = parseInt(scoreA);
      match.teamB.score = parseInt(scoreB);
      this.save();
      window.Security.AuditLogger.log('UPDATE_SCORE', 'Scorekeeper', 'SUCCESS', `Match ${matchId} score updated from [${oldScoreA}-${oldScoreB}] to [${scoreA}-${scoreB}]`);
    }
  },

  updateMatchStatus(matchId, status, time = null) {
    const match = this.state.matches.find(m => m.id === matchId);
    if (match) {
      const oldStatus = match.status;
      match.status = status;
      if (time !== null) match.time = time;
      this.save();
      window.Security.AuditLogger.log('UPDATE_MATCH_STATUS', 'Operator', 'SUCCESS', `Match ${matchId} status changed from ${oldStatus} to ${status}`);
    }
  },

  // --- Incidents (Linked to path blocking) ---
  reportIncident(type, location, description, severity) {
    const newIncident = {
      id: window.Security.Csprng.generateId('inc'),
      type,
      location: window.Security.sanitizeHtml(location),
      description: window.Security.sanitizeHtml(description),
      severity,
      status: 'Open',
      assignedStaff: '',
      reportedAt: new Date().toISOString()
    };
    this.state.incidents.push(newIncident);
    this.save();
    window.Security.AuditLogger.log('REPORT_INCIDENT', 'Safety System', 'SUCCESS', `Incident ticket created: [${severity}] ${type} at ${location}`);
    
    // Check if incident blocks a navigation node (e.g. Stairwell-3)
    if (window.Router) {
      window.Router.updateBlockedNodes(this.state.incidents);
    }
    
    return newIncident;
  },

  assignIncident(incidentId, staffName) {
    const incident = this.state.incidents.find(i => i.id === incidentId);
    if (incident) {
      incident.status = 'Assigned';
      incident.assignedStaff = window.Security.sanitizeHtml(staffName);
      this.save();
      window.Security.AuditLogger.log('ASSIGN_INCIDENT', 'Dispatcher', 'SUCCESS', `Incident ${incidentId} assigned to ${staffName}`);
    }
  },

  resolveIncident(incidentId) {
    const incident = this.state.incidents.find(i => i.id === incidentId);
    if (incident) {
      incident.status = 'Resolved';
      this.save();
      window.Security.AuditLogger.log('RESOLVE_INCIDENT', 'Dispatcher', 'SUCCESS', `Incident ${incidentId} marked resolved`);
      
      // Update router block list
      if (window.Router) {
        window.Router.updateBlockedNodes(this.state.incidents);
      }
    }
  },

  // --- Concessions ---
  placeOrder(seat, items) {
    const newOrder = {
      id: window.Security.Csprng.generateId('ord'),
      seat: window.Security.sanitizeHtml(seat),
      items: window.Security.sanitizeHtml(items),
      status: 'Received',
      runner: '',
      timestamp: new Date().toISOString()
    };
    this.state.concessions.push(newOrder);
    this.save();
    window.Security.AuditLogger.log('PLACE_ORDER', 'Fan Seat Service', 'SUCCESS', `Order placed: ${items} to ${seat}`);
    return newOrder;
  },

  updateOrderStatus(orderId, status, runnerName = '') {
    const order = this.state.concessions.find(o => o.id === orderId);
    if (order) {
      order.status = status;
      if (runnerName) order.runner = window.Security.sanitizeHtml(runnerName);
      this.save();
      window.Security.AuditLogger.log('UPDATE_ORDER_STATUS', 'Concession Manager', 'SUCCESS', `Order ${orderId} status set to ${status}`);
    }
  },

  // --- Automated Warnings ---
  triggerRerouteAlert(gateId, targetRouteName) {
    const gate = this.state.sensors.gates.find(g => g.id === gateId);
    if (gate) {
      gate.alert = 'Critical';
      const alertTitle = `Gate Redirection Alert`;
      const alertContent = `High congestion detected at ${gate.name}. Please follow signs to redirect entry/exit via ${targetRouteName}.`;
      
      const newAnn = {
        id: window.Security.Csprng.generateId('ann'),
        title: alertTitle,
        content: alertContent,
        type: 'Critical',
        timestamp: new Date().toISOString()
      };
      
      this.state.announcements.unshift(newAnn);
      this.save();
      window.Security.AuditLogger.log('TRIGGER_REDIRECTION', 'TOC Automated Agent', 'SUCCESS', `Dynamic redirection triggered for ${gate.name} -> ${targetRouteName}`);
    }
  },

  clearSensorAlert(gateId) {
    const gate = this.state.sensors.gates.find(g => g.id === gateId);
    if (gate) {
      gate.alert = 'Normal';
      this.save();
      window.Security.AuditLogger.log('CLEAR_SENSOR_ALERT', 'TOC System', 'SUCCESS', `Congestion alert cleared for ${gate.name}`);
    }
  },

  // --- Aura AI Chat History Updates ---
  addChatMessage(roleType, sender, text) {
    const historyKey = roleType === 'fan' ? 'fanChatHistory' : 'operatorChatHistory';
    this.state[historyKey].push({ sender, text: window.Security.sanitizeHtml(text) });
    
    if (this.state[historyKey].length > 100) {
      this.state[historyKey].shift();
    }
    this.save();
  },

  incrementFansScanned() {
    this.state.fansScanned++;
    this.save();
  },

  incrementRoutesComputed() {
    this.state.routesComputed++;
    this.save();
  }
};

window.STADIUM_CONFIG = STADIUM_CONFIG;
window.Store = Store;
