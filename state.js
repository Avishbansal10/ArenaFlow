/**
 * ArenaFlow Application Store
 * Manages reactive central state with LocalStorage backup.
 */

const DEFAULT_STATE = {
  matches: [
    {
      id: 'match-1',
      sport: 'Basketball',
      tournament: 'Grand Slam Championship 2026',
      teamA: { name: 'Apex Titans', score: 88, color: '#ff4b4b' },
      teamB: { name: 'Metro Bolts', score: 85, color: '#3b82f6' },
      status: 'LIVE', // SCHEDULED, LIVE, COMPLETED
      time: 'Q4 - 02:45',
      venue: 'Main Arena Court A',
      date: '2026-07-14'
    },
    {
      id: 'match-2',
      sport: 'Volleyball',
      tournament: 'National Club League',
      teamA: { name: 'Ocean Breezes', score: 1, color: '#06b6d4' },
      teamB: { name: 'Desert Storms', score: 2, color: '#f59e0b' },
      status: 'LIVE',
      time: 'Set 4 - 12:15',
      venue: 'North Pavilion Court 2',
      date: '2026-07-14'
    },
    {
      id: 'match-3',
      sport: 'Basketball',
      tournament: 'Grand Slam Championship 2026',
      teamA: { name: 'Giga Hawks', score: 0, color: '#8b5cf6' },
      teamB: { name: 'Solar Rays', score: 0, color: '#ec4899' },
      status: 'SCHEDULED',
      time: '19:30',
      venue: 'Main Arena Court A',
      date: '2026-07-14'
    },
    {
      id: 'match-4',
      sport: 'Basketball',
      tournament: 'Championship Consolation Round',
      teamA: { name: 'Iron Wolves', score: 102, color: '#64748b' },
      teamB: { name: 'Sky Eagles', score: 98, color: '#10b981' },
      status: 'COMPLETED',
      time: 'Final',
      venue: 'Main Arena Court B',
      date: '2026-07-13'
    }
  ],
  incidents: [
    {
      id: 'inc-101',
      type: 'Spill',
      location: 'Block 104, Row G, Seat 8',
      description: 'Large soda spilled in the aisle. Slip hazard reported.',
      severity: 'Medium', // Low, Medium, High
      status: 'Assigned', // Open, Assigned, Resolved
      assignedStaff: 'Rohan Sharma',
      reportedAt: new Date(Date.now() - 30 * 60000).toISOString() // 30 mins ago
    },
    {
      id: 'inc-102',
      type: 'Medical',
      location: 'Gate C Entrance',
      description: 'Elderly fan feeling dizzy due to heat. Requires medical check.',
      severity: 'High',
      status: 'Open',
      assignedStaff: '',
      reportedAt: new Date(Date.now() - 5 * 60000).toISOString() // 5 mins ago
    },
    {
      id: 'inc-103',
      type: 'Maintenance',
      location: 'Block 212, Row C, Seat 4',
      description: 'Seat backrest is broken and loose.',
      severity: 'Low',
      status: 'Resolved',
      assignedStaff: 'Michael Scott',
      reportedAt: new Date(Date.now() - 120 * 60000).toISOString()
    }
  ],
  concessions: [
    {
      id: 'ord-501',
      seat: 'Block 104, Row G, Seat 9',
      items: '2x Double Cheese Burger, 1x Classic Fries, 1x Large Cola',
      status: 'Preparing', // Received, Preparing, Dispatched, Delivered
      runner: 'Rajesh Kumar',
      timestamp: new Date(Date.now() - 10 * 60000).toISOString()
    },
    {
      id: 'ord-502',
      seat: 'Block 102, Row B, Seat 3',
      items: '1x Nachos with Cheese, 1x Diet Soda',
      status: 'Received',
      runner: '',
      timestamp: new Date(Date.now() - 2 * 60000).toISOString()
    }
  ],
  sensors: {
    gates: [
      { id: 'gate-a', name: 'Gate A (North)', occupancy: 1240, capacity: 2000, flowRate: 85, alert: 'Normal' },
      { id: 'gate-b', name: 'Gate B (South)', occupancy: 1850, capacity: 2000, flowRate: 98, alert: 'Moderate' },
      { id: 'gate-c', name: 'Gate C (East)', occupancy: 2150, capacity: 2200, flowRate: 140, alert: 'Critical' },
      { id: 'gate-d', name: 'Gate D (West)', occupancy: 420, capacity: 1500, flowRate: 25, alert: 'Normal' }
    ],
    concessions: [
      { id: 'zone-1', name: 'Food Court Plaza', occupancy: 450, capacity: 500, queueWait: '12m', alert: 'Moderate' },
      { id: 'zone-2', name: 'North Wing Snacks', occupancy: 120, capacity: 250, queueWait: '3m', alert: 'Normal' },
      { id: 'zone-3', name: 'South Wing Beer & Pretzels', occupancy: 390, capacity: 400, queueWait: '25m', alert: 'Critical' }
    ]
  },
  announcements: [
    {
      id: 'ann-1',
      title: 'Gate C Crowding Warning',
      content: 'Gate C is experiencing high congestion. Fans arriving are advised to use Gate D (West) or Gate A (North) for faster entry.',
      type: 'Warning', // Info, Warning, Critical
      timestamp: new Date(Date.now() - 15 * 60000).toISOString()
    }
  ]
};

const Store = {
  state: null,
  listeners: [],

  /**
   * Initializes the state, loading from localStorage if present.
   */
  init() {
    try {
      const saved = localStorage.getItem('arena_flow_state');
      if (saved) {
        this.state = JSON.parse(saved);
        // Ensure structure is correct
        if (!this.state.matches || !this.state.incidents || !this.state.concessions) {
          throw new Error('Malformed state');
        }
      } else {
        this.state = JSON.parse(JSON.stringify(DEFAULT_STATE)); // deep copy
        this.save();
      }
    } catch (e) {
      this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
      this.save();
    }
  },

  /**
   * Subscribes a listener callback to state changes.
   */
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(c => c !== callback);
    };
  },

  /**
   * Saves current state to localStorage and notifies listeners.
   */
  save() {
    try {
      localStorage.setItem('arena_flow_state', JSON.stringify(this.state));
    } catch (e) {
      console.error('State persistence failed:', e);
    }
    this.notify();
  },

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (e) {
        console.error('Listener callback failed:', e);
      }
    }
  },

  /**
   * Reset store to default state.
   */
  reset() {
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this.save();
    window.Security.AuditLogger.log('RESET_STORE', 'System Admin', 'SUCCESS', 'Application store reset to factory defaults.');
  },

  // State Mutators

  // --- Matches ---
  addMatch(matchData) {
    const newMatch = {
      id: 'match-' + Math.random().toString(36).substr(2, 9),
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

  // --- Incidents ---
  reportIncident(type, location, description, severity) {
    const newIncident = {
      id: 'inc-' + Math.floor(100 + Math.random() * 900),
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
    window.Security.AuditLogger.log('REPORT_INCIDENT', 'Fan Portal', 'SUCCESS', `New incident reported: [${severity}] ${type} at ${location}`);
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
      window.Security.AuditLogger.log('RESOLVE_INCIDENT', 'Dispatcher', 'SUCCESS', `Incident ${incidentId} resolved`);
    }
  },

  // --- Concessions ---
  placeOrder(seat, items) {
    const newOrder = {
      id: 'ord-' + Math.floor(500 + Math.random() * 500),
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

  // --- Sensors / Crowd Management ---
  triggerRerouteAlert(gateId, targetRouteName) {
    const gate = this.state.sensors.gates.find(g => g.id === gateId);
    if (gate) {
      gate.alert = 'Critical';
      const alertTitle = `Gate Redirection Alert`;
      const alertContent = `High congestion detected at ${gate.name}. Please follow signs to redirect entry/exit via ${targetRouteName}.`;
      
      const newAnn = {
        id: 'ann-' + Math.random().toString(36).substr(2, 9),
        title: alertTitle,
        content: alertContent,
        type: 'Critical',
        timestamp: new Date().toISOString()
      };
      
      this.state.announcements.unshift(newAnn); // add to top
      this.save();
      window.Security.AuditLogger.log('TRIGGER_REDirection', 'TOC Automated Agent', 'SUCCESS', `Dynamic redirection triggered for ${gate.name} -> ${targetRouteName}`);
    }
  },

  clearSensorAlert(gateId) {
    const gate = this.state.sensors.gates.find(g => g.id === gateId);
    if (gate) {
      gate.alert = 'Normal';
      this.save();
      window.Security.AuditLogger.log('CLEAR_SENSOR_ALERT', 'TOC System', 'SUCCESS', `Congestion alert cleared for ${gate.name}`);
    }
  }
};

window.Store = Store;
