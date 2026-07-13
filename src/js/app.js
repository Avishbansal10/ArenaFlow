/**
 * ArenaFlow Pro — Controller & Aura AI Assistant
 * FIFA World Cup 2026 Edition.
 * Orchestrates event handling, role authorizations, dynamic rerouting UI, and NLU parsing.
 */

"use strict";

// Predefined translation mappings for World Cup multilingual operations (USA / Mexico / Canada)
const TRANSLATION_DB = Object.freeze({
  es: {
    title: 'Aviso de Congestión en la Puerta C',
    content: 'La Puerta C está sumamente congestionada. Se recomienda a los aficionados llegar/salir por la Puerta D (Oeste) o la Puerta A (Norte) para un tránsito más rápido.',
    confirm: 'Anuncios del estadio traducidos al español para los aficionados de México.',
    no_alert: 'No hay alertas de transmisiones activas en este momento.'
  },
  fr: {
    title: 'Avis de Congestion à la Porte C',
    content: 'La porte C est fortement encombrée. Nous recommandons vivement aux supporters d\'arriver/de sortir par la porte D (Ouest) ou la porte A (Nord) pour un transit plus rapide.',
    confirm: 'Annonces du stade traduites en français pour les supporters du Canada.',
    no_alert: 'Aucune alerte de diffusion active pour le moment.'
  }
});

// --- Aura AI Natural Language Parser (NLU) ---
const AuraAI = {
  /**
   * Processes a natural language text query from a fan.
   * @param {string} rawText - Message text
   * @returns {Promise<string>} Response text
   */
  async processFanQuery(rawText) {
    const text = rawText.toLowerCase().trim();

    // 1. Multilingual translation request
    // e.g. "translate to spanish", "traduzca al espanol", "translate french"
    if (text.includes('translate') || text.includes('spanish') || text.includes('french') || text.includes('espanol')) {
      let langCode = 'es';
      let langName = 'Spanish';
      if (text.includes('french') || text.includes('fr')) {
        langCode = 'fr';
        langName = 'French';
      }

      const activeAnn = window.Store.state.announcements;
      if (activeAnn.length === 0) {
        return `Aura AI: ${TRANSLATION_DB[langCode].no_alert}`;
      }

      // Render translated alert list in UI
      const listEl = document.getElementById('announcements-list');
      if (listEl) {
        listEl.innerHTML = `
          <div class="alert-banner alert-banner-warning" role="alert">
            <div style="font-size:1.1rem;">🌐</div>
            <div style="flex-grow:1;">
              <div style="font-weight:800; font-size:0.85rem;">[${langName}] ${window.Security.sanitizeHtml(TRANSLATION_DB[langCode].title)}</div>
              <div style="margin-top:0.2rem; color:var(--text-primary); font-size:0.8rem;">${window.Security.sanitizeHtml(TRANSLATION_DB[langCode].content)}</div>
            </div>
          </div>
        `;
      }

      window.Security.AuditLogger.log('TRANSLATE_ALERTS', 'Fan Portal', 'SUCCESS', `Announcements translated to ${langName}.`);
      return `🌐 ${TRANSLATION_DB[langCode].confirm}`;
    }

    // 2. Check for pathfinding queries
    if (text.includes('path') || text.includes('route') || text.includes('direction') || text.includes('get to') || text.includes('exit')) {
      let startBlock = 'Block-102';
      if (text.includes('102')) startBlock = 'Block-102';
      else if (text.includes('104')) startBlock = 'Block-104';
      else if (text.includes('212')) startBlock = 'Block-212';

      let endGate = 'Gate-A';
      if (text.includes('gate a') || text.includes('gate-a')) endGate = 'Gate-A';
      else if (text.includes('gate b') || text.includes('gate-b')) endGate = 'Gate-B';
      else if (text.includes('gate c') || text.includes('gate-c')) endGate = 'Gate-C';
      else if (text.includes('gate d') || text.includes('gate-d')) endGate = 'Gate-D';

      const stepFree = text.includes('step-free') || text.includes('accessible') || text.includes('elevator') || text.includes('lift') || text.includes('wheelchair');

      const routeResult = window.Router.findShortestPath(startBlock, endGate, stepFree);
      const instructions = window.Router.generateInstructions(routeResult.path);
      
      const selectBlock = document.getElementById('nav-start-block');
      const selectGate = document.getElementById('nav-end-gate');
      const toggleAccess = document.getElementById('nav-accessible-toggle');
      if (selectBlock) selectBlock.value = startBlock;
      if (selectGate) selectGate.value = endGate;
      if (toggleAccess) toggleAccess.checked = stepFree;

      window.AppController.renderPathOutput(instructions, routeResult.rerouted);

      let response = `Calculated navigation route from ${startBlock} to ${endGate}. `;
      if (stepFree) response += `Step-free elevator routing is active. `;
      if (routeResult.rerouted) {
        response += `⚠️ Notice: Due to an active hazard, I have rerouted you safely around blocked areas. `;
      }
      response += `Steps: ` + instructions.map((s, i) => `[${i+1}] ${s.action}`).join(' -> ');
      return response;
    }

    // 3. Check for food ordering queries
    if (text.includes('order') || text.includes('burger') || text.includes('popcorn') || text.includes('nachos') || text.includes('food')) {
      let seat = 'Block-104, Row G, Seat 9';
      if (text.includes('102')) seat = 'Block-102, Row B, Seat 3';
      else if (text.includes('212')) seat = 'Block-212, Row C, Seat 4';

      let item = 'Double Cheese Burger Combo ($14)';
      if (text.includes('popcorn')) item = 'Popcorn & Soda Combo ($10)';
      else if (text.includes('nacho')) item = 'Nachos & Cheese Combo ($9)';

      const order = window.Store.placeOrder(seat, item);
      sessionStorage.setItem('last_placed_seat', seat);
      
      return `🍔 Order placed successfully! Your "${item}" has been registered. Order ID: #${order.id}. Delivery runner will bring it to ${seat}.`;
    }

    // 4. Check for incident reporting queries
    if (text.includes('report') || text.includes('spill') || text.includes('hazard') || text.includes('medical') || text.includes('broken')) {
      let location = 'Block-104';
      if (text.includes('102')) location = 'Block-102';
      else if (text.includes('212')) location = 'Block-212';
      else if (text.includes('stairwell 3') || text.includes('stairwell-3')) location = 'Stairwell-3';
      else if (text.includes('gate c') || text.includes('gate-c')) location = 'Gate-C';

      let type = 'Spill';
      if (text.includes('medical') || text.includes('hurt') || text.includes('dizzy')) type = 'Medical';
      else if (text.includes('broken') || text.includes('seat')) type = 'Maintenance';
      else if (text.includes('fight') || text.includes('security')) type = 'Security';

      let desc = 'Safety issue reported via Aura AI Assistant.';
      if (text.includes('water') || text.includes('soda')) desc = 'Water spill reported. Slip hazard.';

      const inc = window.Store.reportIncident(type, location, desc, 'Medium');
      return `🚨 Safety Ticket #${inc.id} created! Reported a "${type}" hazard at location: ${location}. Our stadium control room has dispatched a responder.`;
    }

    if (text.includes('hello') || text.includes('hi') || text.includes('hey')) {
      return "Hi there! I am Aura, your FIFA World Cup 2026 digital stadium assistant. How can I help you navigate the arena, translate alerts, order food, or report safety issues today?";
    }

    if (text.includes('stadium') || text.includes('metlife') || text.includes('world cup')) {
      return "Welcome to MetLife Stadium, hosting the FIFA World Cup 2026! We have advanced IoT gate tracking, accessible routes, and 4 gates (Gates A-D) open for your convenience.";
    }

    return "I didn't quite catch that. You can ask me for directions (e.g., 'route from Block 102 to Gate C step-free'), translate announcements ('translate to Spanish'), or report spills.";
  },

  /**
   * Processes operational queries from stadium coordinators.
   * @param {string} rawText - Message text
   * @returns {Promise<string>} Response text
   */
  async processOperatorQuery(rawText) {
    const text = rawText.toLowerCase().trim();

    // Enforce administrative check
    if (!window.Security.Auth.isAuthorized('operator')) {
      if (text.includes('pin:') || text.includes('pin ')) {
        const pin = text.replace('pin:', '').replace('pin', '').trim();
        const success = await window.Security.Auth.verifyPIN(pin, 'operator');
        if (success) {
          window.AppController.renderAuthOverlay();
          return "🔑 PIN Verified successfully! Administrative commands unlocked. You can now schedule games, check gate flows, or audit tickets.";
        } else {
          return "❌ Authentication failed. Incorrect PIN code entered.";
        }
      }
      return "🔒 Operational clearance required. Please authorize by entering your PIN in the authentication popup or type 'PIN: [your_pin]' in chat.";
    }

    // 1. Handle match scheduling
    if (text.includes('schedule') || text.includes('match') || text.includes('game')) {
      let teamA = 'Germany';
      let teamB = 'Brazil';
      if (text.includes('usa') || text.includes('mexico')) {
        teamA = 'USA';
        teamB = 'Mexico';
      }
      
      const newMatch = window.Store.addMatch({
        sport: 'Football',
        tournament: 'FIFA World Cup 2026',
        venue: 'MetLife Stadium (NJ)',
        time: '20:00',
        date: new Date().toISOString().split('T')[0],
        status: 'SCHEDULED',
        teamA: { name: teamA, score: 0, color: '#3b82f6' },
        teamB: { name: teamB, score: 0, color: '#ff4b4b' }
      });
      return `📅 Match Scheduled! Created match: ${newMatch.teamA.name} vs ${newMatch.teamB.name} at MetLife Stadium (ID: ${newMatch.id}).`;
    }

    // 2. Handle incident lists
    if (text.includes('incident') || text.includes('alert') || text.includes('safety')) {
      const openIncidents = window.Store.state.incidents.filter(i => i.status !== 'Resolved');
      if (openIncidents.length === 0) {
        return "✓ Security Status: Normal. There are currently no open/unresolved incident reports.";
      }
      return `🚨 Active Incidents (${openIncidents.length}): ` + 
        openIncidents.map(i => `[#${i.id}] ${i.type} at ${i.location} (${i.severity} severity)`).join('; ');
    }

    // 3. Handle gate sensor flow rate queries
    if (text.includes('gate') || text.includes('occupancy') || text.includes('flow')) {
      let gateId = 'gate-c';
      if (text.includes('gate a') || text.includes('gate-a')) gateId = 'gate-a';
      else if (text.includes('gate b') || text.includes('gate-b')) gateId = 'gate-b';
      else if (text.includes('gate d') || text.includes('gate-d')) gateId = 'gate-d';

      const gate = window.Store.state.sensors.gates.find(g => g.id === gateId);
      return `📊 Gate Report (${gate.name}): Occupancy: ${gate.occupancy}/${gate.capacity} (${(gate.occupancy/gate.capacity*100).toFixed(0)}%). Flow rate: ${gate.flowRate} fans/min. Alert status: ${gate.alert}.`;
    }

    if (text.includes('status') || text.includes('system')) {
      return `⚙️ TOC Status Panel: System Online. Matches tracked: ${window.Store.state.matches.length}. Active incidents: ${window.Store.state.incidents.filter(i => i.status !== 'Resolved').length}. Concessions active: ${window.Store.state.concessions.filter(o => o.status !== 'Delivered').length}.`;
    }

    return "Operations Assistant: Command recognized but not understood. You can query gate statuses ('status of gate A'), check safety reports ('list incidents'), or schedule games.";
  }
};


// --- Controller class orchestrating UI & Events ---
class ArenaFlowController {
  constructor() {
    this.activeRole = 'fan'; 
    this.selectedGateSensor = 'gate-c'; 
    this.currentNavInstructions = '';
  }

  setLoadingState(buttonId, isLoading, defaultText, loadingText = 'Submitting...') {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    if (isLoading) {
      btn.disabled = true;
      btn.classList.add('btn-loading');
      btn.textContent = loadingText;
    } else {
      btn.disabled = false;
      btn.classList.remove('btn-loading');
      btn.textContent = defaultText;
    }
  }

  init() {
    window.Store.init();

    // Initialize static standard path caches
    window.Router.init();

    window.Router.updateBlockedNodes(window.Store.state.incidents);

    this.bindEvents();
    window.Store.subscribe((state) => this.render(state));

    this.render(window.Store.state);
    this.renderAuthOverlay();

    window.Security.AuditLogger.log('SYSTEM_STARTUP', 'FIFA System Kernel', 'SUCCESS', 'ArenaFlow Pro dashboard fully activated.');
  }

  bindEvents() {
    // 1. Role Toggle Tabs
    document.querySelectorAll('.role-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const role = e.target.getAttribute('data-role');
        this.switchRole(role);
      });
    });

    // 2. High Contrast button
    const btnContrast = document.getElementById('btn-toggle-contrast');
    if (btnContrast) {
      btnContrast.addEventListener('click', () => {
        document.body.classList.toggle('high-contrast');
        const isHc = document.body.classList.contains('high-contrast');
        btnContrast.setAttribute('aria-pressed', isHc);
        window.Security.AuditLogger.log('TOGGLE_HIGH_CONTRAST', 'User', 'SUCCESS', `High contrast active: ${isHc}`);
      });
    }

    // 3. TTS Reader
    const btnSpeak = document.getElementById('btn-tts-read');
    if (btnSpeak) {
      btnSpeak.addEventListener('click', () => {
        this.speakActiveAnnouncements();
      });
    }

    // 4. Pathfinder form
    const navForm = document.getElementById('routing-form');
    if (navForm) {
      navForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.calculateNavigationRoute();
      });
    }

    // 5. Food Order form
    const orderForm = document.getElementById('concession-form');
    if (orderForm) {
      orderForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFanOrder();
      });
    }

    // 6. Fan incident ticket reporter
    const fanIncidentForm = document.getElementById('fan-incident-form');
    if (fanIncidentForm) {
      fanIncidentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFanReportIncident();
      });
    }

    // 7. Match scheduling form
    const schedulerForm = document.getElementById('operator-scheduler-form');
    if (schedulerForm) {
      schedulerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleOperatorCreateMatch();
      });
    }

    // 8. Gate sensor map click selectors
    document.querySelectorAll('.sensor-node').forEach(node => {
      node.addEventListener('click', (e) => {
        this.selectedGateSensor = e.target.getAttribute('data-sensor-id');
        this.renderHeatmapDetail();
      });
    });

    // 9. Diagnostics runner
    const btnDiagnostics = document.getElementById('btn-run-diagnostics');
    if (btnDiagnostics) {
      btnDiagnostics.addEventListener('click', () => {
        this.runSystemDiagnostics();
      });
    }

    // 10. Audit logs clear
    const btnClearLogs = document.getElementById('btn-clear-audit-logs');
    if (btnClearLogs) {
      btnClearLogs.addEventListener('click', () => {
        window.Security.AuditLogger.clearLogs();
        this.renderAuditLogs();
      });
    }

    // 11. Role Login PIN submissions
    const formLogin = document.getElementById('auth-pin-form');
    if (formLogin) {
      formLogin.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handlePinSubmit();
      });
    }

    // 12. Ticket Scanner simulation button
    const btnScan = document.getElementById('btn-scan-ticket');
    if (btnScan) {
      btnScan.addEventListener('click', () => {
        this.simulateTicketScan();
      });
    }

    // 13. Fan Chat submit
    const fanChatForm = document.getElementById('fan-chat-form');
    if (fanChatForm) {
      fanChatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleChatSubmit('fan');
      });
    }

    // 14. Operator Chat submit
    const opChatForm = document.getElementById('operator-chat-form');
    if (opChatForm) {
      opChatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleChatSubmit('operator');
      });
    }

    // Real-time audit updates
    window.addEventListener('auditlogadded', () => {
      this.renderAuditLogs();
    });

    // 15. Scroll-to-top button handler
    const btnScroll = document.getElementById('btn-scroll-top');
    if (btnScroll) {
      window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
          btnScroll.style.display = 'flex';
        } else {
          btnScroll.style.display = 'none';
        }
      });
      btnScroll.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  switchRole(role) {
    if ((role === 'operator' || role === 'diagnostics') && !window.Security.Auth.isAuthorized(role)) {
      this.pendingRoleSwitch = role; 
      this.activeRole = role; 
      
      document.querySelectorAll('.role-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-role') === role) tab.classList.add('active');
      });

      this.renderAuthOverlay();
      return;
    }

    this.activeRole = role;
    this.pendingRoleSwitch = null;

    document.querySelectorAll('.role-tab').forEach(tab => {
      if (tab.getAttribute('data-role') === role) {
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
      } else {
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
      }
    });

    document.querySelectorAll('.view-panel').forEach(panel => {
      if (panel.id === `${role}-panel`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    this.renderAuthOverlay();
    window.Security.AuditLogger.log('SWITCH_VIEW_ROLE', 'User', 'SUCCESS', `Entered ${role} role interface.`);
  }

  async handlePinSubmit() {
    const inputPin = document.getElementById('auth-pin-input');
    if (!inputPin) return;
    const pin = inputPin.value;

    const valResult = window.Security.validateField(pin, {
      required: true,
      pattern: window.Security.Patterns.PIN,
      patternMessage: 'PIN must be alphanumeric and 4-10 characters.'
    });

    if (!valResult.isValid) {
      alert(valResult.error);
      return;
    }

    const role = this.pendingRoleSwitch || this.activeRole;
    const isSuccess = await window.Security.Auth.verifyPIN(pin, role);

    if (isSuccess) {
      inputPin.value = '';
      this.switchRole(role); 
    } else {
      alert('Invalid PIN code entered. Access Denied.');
    }
  }

  simulateTicketScan() {
    const btn = document.getElementById('btn-scan-ticket');
    if (btn) btn.disabled = true;

    window.Security.AuditLogger.log('TICKET_SCAN_TRIGGER', 'Fan Terminal', 'SUCCESS', 'Scanning digital World Cup ticket...');

    setTimeout(() => {
      const selectBlock = document.getElementById('nav-start-block');
      const orderSeat = document.getElementById('order-seat');
      if (selectBlock) selectBlock.value = 'Block-104';
      if (orderSeat) orderSeat.value = 'Block-104, Row G, Seat 9';

      window.Store.incrementFansScanned();

      window.Store.addChatMessage('fan', 'user', '[Simulated Ticket Scan]');
      window.Store.addChatMessage('fan', 'aura', '🎟️ Ticket Verified! Welcome to MetLife Stadium. You are registered in Block 104. I have automatically configured your seat route. How can I assist you today?');

      if (btn) btn.disabled = false;
      alert('Ticket verified! Seat designated to Block 104.');
    }, 1500);
  }

  // --- Aura AI Chat handlers ---

  handleChatSubmit(roleType) {
    const inputId = roleType === 'fan' ? 'fan-chat-input' : 'operator-chat-input';
    const input = document.getElementById(inputId);
    if (!input) return;
    const text = input.value;

    const valResult = window.Security.validateField(text, { required: true, maxLength: 150 });
    if (!valResult.isValid) {
      alert('Invalid message: ' + valResult.error);
      return;
    }

    const ipKey = `${roleType}_chat_ip`;
    const allowed = window.Security.RateLimiter.checkLimit(ipKey, 5, 20); 
    if (!allowed) {
      alert('Rate limit exceeded. Please wait a few seconds before messaging Aura AI again.');
      return;
    }

    window.Store.addChatMessage(roleType, 'user', text);
    input.value = '';

    setTimeout(async () => {
      let aiResponse = '';
      if (roleType === 'fan') {
        aiResponse = await AuraAI.processFanQuery(text);
      } else {
        aiResponse = await AuraAI.processOperatorQuery(text);
      }
      window.Store.addChatMessage(roleType, 'aura', aiResponse);
    }, 600);
  }

  // --- Rendering functions ---

  render(state) {
    this.renderMatches(state.matches);
    this.renderIncidents(state.incidents);
    this.renderConcessions(state.concessions);
    this.renderAnnouncements(state.announcements);
    this.renderHeatmapDetail();
    this.renderAuditLogs();
    
    this.renderChatMessages('fan', state.fanChatHistory);
    this.renderChatMessages('operator', state.operatorChatHistory);

    // Update Live Analytics Counters (Professional Touch: reacts to state mutations)
    const activeAlertsEl = document.getElementById('stat-active-alerts');
    const concessionOrdersEl = document.getElementById('stat-concession-orders');
    const occupancyEl = document.getElementById('stat-occupancy');
    const routesEl = document.getElementById('stat-active-routes');
    const fansEl = document.getElementById('stat-fans-scanned');
    const integrityEl = document.getElementById('stat-system-health');
    
    if (activeAlertsEl) {
      activeAlertsEl.textContent = state.incidents.filter(i => i.status !== 'Resolved').length;
    }
    if (concessionOrdersEl) {
      concessionOrdersEl.textContent = state.concessions.filter(o => o.status !== 'Delivered').length;
    }
    if (occupancyEl) {
      const totalOccupancy = state.sensors.gates.reduce((sum, g) => sum + g.occupancy, 0);
      const totalCapacity = state.sensors.gates.reduce((sum, g) => sum + g.capacity, 0);
      const occupancyPercent = totalCapacity > 0 ? Math.round((totalOccupancy / totalCapacity) * 100) : 0;
      occupancyEl.textContent = `${occupancyPercent}%`;
    }
    if (routesEl) {
      routesEl.textContent = state.routesComputed.toLocaleString();
    }
    if (fansEl) {
      fansEl.textContent = state.fansScanned.toLocaleString();
    }
    if (integrityEl) {
      const logVerification = window.Security.AuditLogger.verifyChain();
      if (logVerification.verified) {
        integrityEl.textContent = "100% Chained";
        integrityEl.style.color = "var(--text-primary)";
      } else {
        integrityEl.textContent = "Chain Fault!";
        integrityEl.style.color = "var(--color-danger)";
      }
    }
  }

  renderAuthOverlay() {
    const overlay = document.getElementById('auth-screen-overlay');
    if (!overlay) return;

    const needsAuth = (this.activeRole === 'operator' || this.activeRole === 'diagnostics') && 
                      !window.Security.Auth.isAuthorized(this.activeRole);

    if (needsAuth) {
      overlay.style.display = 'flex';
      const roleLabel = document.getElementById('auth-role-name');
      if (roleLabel) roleLabel.textContent = this.activeRole.toUpperCase();
    } else {
      overlay.style.display = 'none';
    }
  }

  renderChatMessages(roleType, history) {
    const chatHistoryEl = document.getElementById(`${roleType}-chat-history`);
    if (!chatHistoryEl) return;

    chatHistoryEl.innerHTML = history.map(msg => {
      const bubbleClass = msg.sender === 'aura' ? 'bubble-aura' : 'bubble-user';
      const senderName = msg.sender === 'aura' ? 'Aura AI' : 'You';
      return `
        <div class="chat-bubble ${bubbleClass}">
          <div style="font-weight:700; font-size:0.75rem; margin-bottom:0.15rem; color:var(--text-muted)">${window.Security.sanitizeHtml(senderName)}</div>
          <div>${window.Security.sanitizeHtml(msg.text)}</div>
        </div>
      `;
    }).join('');

    chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight; 
  }

  renderMatches(matches) {
    const fanMatchesList = document.getElementById('fan-matches-list');
    if (fanMatchesList) {
      fanMatchesList.innerHTML = matches.map(match => this.createMatchHtml(match, false)).join('');
    }

    const operatorMatchesList = document.getElementById('operator-matches-list');
    if (operatorMatchesList) {
      operatorMatchesList.innerHTML = matches.map(match => this.createMatchHtml(match, true)).join('');
      
      operatorMatchesList.querySelectorAll('.btn-score-up').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const matchId = e.currentTarget.getAttribute('data-match-id');
          const team = e.currentTarget.getAttribute('data-team');
          const delta = parseInt(e.currentTarget.getAttribute('data-delta'));
          this.adjustMatchScore(matchId, team, delta);
        });
      });

      operatorMatchesList.querySelectorAll('.select-match-status').forEach(select => {
        select.addEventListener('change', (e) => {
          const matchId = e.target.getAttribute('data-match-id');
          const newStatus = e.target.value;
          const match = matches.find(m => m.id === matchId);
          let newTime = match.time;
          if (newStatus === 'LIVE' && match.status !== 'LIVE') newTime = '00:00';
          if (newStatus === 'COMPLETED') newTime = 'Full Time';
          if (newStatus === 'SCHEDULED') newTime = '19:30';
          window.Store.updateMatchStatus(matchId, newStatus, newTime);
        });
      });
    }
  }

  createMatchHtml(match, isOperator) {
    const statusClass = match.status === 'LIVE' ? 'badge-live' : match.status === 'COMPLETED' ? 'badge-completed' : 'badge-scheduled';
    const cleanVenue = window.Security.sanitizeHtml(match.venue);
    const cleanTournament = window.Security.sanitizeHtml(match.tournament);
    const cleanTeamA = window.Security.sanitizeHtml(match.teamA.name);
    const cleanTeamB = window.Security.sanitizeHtml(match.teamB.name);
    const cleanTime = window.Security.sanitizeHtml(match.time);
    const cleanId = window.Security.sanitizeHtml(match.id);
    const cleanStatus = window.Security.sanitizeHtml(match.status);

    if (isOperator) {
      return `
        <div class="match-item" data-match-id="${cleanId}">
          <div class="match-meta">
            <span>${cleanTournament} | ${cleanVenue}</span>
            <select class="select-match-status" data-match-id="${cleanId}" aria-label="Status select for match vs ${cleanTeamA}">
              <option value="SCHEDULED" ${match.status === 'SCHEDULED' ? 'selected' : ''}>Scheduled</option>
              <option value="LIVE" ${match.status === 'LIVE' ? 'selected' : ''}>Live</option>
              <option value="COMPLETED" ${match.status === 'COMPLETED' ? 'selected' : ''}>Completed</option>
            </select>
          </div>
          <div class="match-scoreline">
            <div class="team-info">
              <span class="team-dot" style="background-color: ${match.teamA.color}"></span>
              <span>${cleanTeamA}</span>
            </div>
            <div class="score-display">
              <span>${match.teamA.score}</span>
              <span class="score-divider">-</span>
              <span>${match.teamB.score}</span>
            </div>
            <div class="team-info right">
              <span>${cleanTeamB}</span>
              <span class="team-dot" style="background-color: ${match.teamB.color}"></span>
            </div>
          </div>
          <div class="match-controls">
            <button class="btn btn-secondary btn-score-up" data-match-id="${cleanId}" data-team="A" data-delta="1">+1 ${cleanTeamA}</button>
            <button class="btn btn-secondary btn-score-up" data-match-id="${cleanId}" data-team="B" data-delta="1">+1 ${cleanTeamB}</button>
            <span style="flex-grow:1;"></span>
            <input type="text" value="${cleanTime}" class="match-time-input" 
              style="width: 80px; text-align: center; padding: 0.2rem;" aria-label="Game Clock input for match vs ${cleanTeamA}"
              onchange="window.Store.updateMatchStatus('${cleanId}', '${cleanStatus}', this.value)"/>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="match-item">
          <div class="match-meta">
            <span>${cleanTournament} | ${cleanVenue}</span>
            <span class="match-status-badge ${statusClass}">${cleanStatus}</span>
          </div>
          <div class="match-scoreline">
            <div class="team-info">
              <span class="team-dot" style="background-color: ${match.teamA.color}"></span>
              <span>${cleanTeamA}</span>
            </div>
            <div class="score-display">
              <span>${match.teamA.score}</span>
              <span class="score-divider">:</span>
              <span>${match.teamB.score}</span>
            </div>
            <div class="team-info right">
              <span>${cleanTeamB}</span>
              <span class="team-dot" style="background-color: ${match.teamB.color}"></span>
            </div>
          </div>
          <div style="font-size: 0.8rem; text-align: center; color: var(--text-muted); margin-top: 0.25rem;">
            <span>Game Clock: ${cleanTime}</span>
          </div>
        </div>
      `;
    }
  }

  renderIncidents(incidents) {
    const tableBody = document.getElementById('operator-incidents-table-body');
    if (!tableBody) return;

    if (incidents.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted); font-style:italic;">
            ✓ All security operations clear. No incidents reported.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = incidents.map(inc => {
      const severityClass = `severity-${inc.severity.toLowerCase()}`;
      const statusClass = `status-${inc.status.toLowerCase()}`;
      const cleanId = window.Security.sanitizeHtml(inc.id);
      const cleanType = window.Security.sanitizeHtml(inc.type);
      const cleanLoc = window.Security.sanitizeHtml(inc.location);
      const cleanDesc = window.Security.sanitizeHtml(inc.description);
      const cleanSeverity = window.Security.sanitizeHtml(inc.severity);
      const cleanStatus = window.Security.sanitizeHtml(inc.status);
      const cleanStaff = inc.assignedStaff ? window.Security.sanitizeHtml(inc.assignedStaff) : '<em>None</em>';

      let actions = '';
      if (inc.status === 'Open') {
        actions = `<button class="btn btn-secondary btn-assign-inc" data-incident-id="${cleanId}" style="padding:0.3rem 0.5rem; font-size:0.75rem;" aria-label="Assign dispatcher for incident #${cleanId}">Assign Staff</button>`;
      } else if (inc.status === 'Assigned') {
        actions = `<button class="btn btn-success btn-resolve-inc" data-incident-id="${cleanId}" style="padding:0.3rem 0.5rem; font-size:0.75rem;" aria-label="Resolve incident #${cleanId}">Resolve</button>`;
      } else {
        actions = `<span style="color: var(--color-primary); font-weight:700;">✓ Resolved</span>`;
      }

      return `
        <tr>
          <td><strong>#${cleanId}</strong></td>
          <td>${cleanType}</td>
          <td>${cleanLoc}</td>
          <td>${cleanDesc}</td>
          <td><span class="severity-badge ${severityClass}">${cleanSeverity}</span></td>
          <td><span class="status-badge ${statusClass}">${cleanStatus}</span></td>
          <td>${cleanStaff}</td>
          <td>${actions}</td>
        </tr>
      `;
    }).join('');

    tableBody.querySelectorAll('.btn-assign-inc').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const incId = e.target.getAttribute('data-incident-id');
        const staffName = prompt('Assign dispatch responder:');
        if (staffName && staffName.trim()) {
          const valResult = window.Security.validateField(staffName, { minLength: 2, maxLength: 30 });
          if (valResult.isValid) {
            window.Store.assignIncident(incId, staffName);
          } else {
            alert('Invalid responder name: ' + valResult.error);
          }
        }
      });
    });

    tableBody.querySelectorAll('.btn-resolve-inc').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const incId = e.target.getAttribute('data-incident-id');
        window.Store.resolveIncident(incId);
      });
    });
  }

  renderConcessions(orders) {
    const operatorOrdersList = document.getElementById('operator-orders-list');
    if (operatorOrdersList) {
      if (orders.length === 0) {
        operatorOrdersList.innerHTML = `<div style="background:rgba(255,255,255,0.01); border:1px dashed var(--border-color); padding:1rem; border-radius:var(--radius-md); text-align:center; color:var(--text-muted); font-size:0.85rem; font-style:italic;">✓ No concession orders in queue.</div>`;
      } else {
        operatorOrdersList.innerHTML = orders.map(ord => {
          const cleanId = window.Security.sanitizeHtml(ord.id);
          const cleanSeat = window.Security.sanitizeHtml(ord.seat);
          const cleanItems = window.Security.sanitizeHtml(ord.items);
          const cleanRunner = ord.runner ? window.Security.sanitizeHtml(ord.runner) : '<em>Unassigned</em>';
          const cleanStatus = window.Security.sanitizeHtml(ord.status);

          let actionButtons = '';
          if (ord.status === 'Received') {
            actionButtons = `<button class="btn btn-secondary btn-order-action" data-order-id="${cleanId}" data-action="Preparing" style="padding:0.25rem 0.5rem; font-size:0.75rem;" aria-label="Prepare order #${cleanId}">Prepare</button>`;
          } else if (ord.status === 'Preparing') {
            actionButtons = `<button class="btn btn-secondary btn-order-action" data-order-id="${cleanId}" data-action="Dispatched" style="padding:0.25rem 0.5rem; font-size:0.75rem;" aria-label="Dispatch order #${cleanId}">Dispatch</button>`;
          } else if (ord.status === 'Dispatched') {
            actionButtons = `<button class="btn btn-success btn-order-action" data-order-id="${cleanId}" data-action="Delivered" style="padding:0.25rem 0.5rem; font-size:0.75rem;" aria-label="Deliver order #${cleanId}">Mark Delivered</button>`;
          } else {
            actionButtons = `<span style="color: var(--color-primary); font-weight:700;">✓ Delivered</span>`;
          }

          return `
            <div class="match-item" style="border-left: 4px solid var(--color-accent);">
              <div class="match-meta">
                <span>Order #${cleanId} - ${cleanSeat}</span>
                <span class="status-badge" style="background-color:rgba(255,255,255,0.02); color:var(--text-primary);">${cleanStatus}</span>
              </div>
              <div style="font-weight:600; font-size:0.85rem; padding: 0.2rem 0;">${cleanItems}</div>
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem;">
                <span>Runner: ${cleanRunner}</span>
                <div>${actionButtons}</div>
              </div>
            </div>
          `;
        }).join('');

        operatorOrdersList.querySelectorAll('.btn-order-action').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const ordId = e.target.getAttribute('data-order-id');
            const nextAction = e.target.getAttribute('data-action');
            let runnerName = '';
            if (nextAction === 'Dispatched') {
              runnerName = prompt('Enter delivery staff name:');
              if (!runnerName || !runnerName.trim()) return;
            }
            window.Store.updateOrderStatus(ordId, nextAction, runnerName);
          });
        });
      }
    }

    const fanOrderTrackList = document.getElementById('fan-order-track-list');
    if (fanOrderTrackList) {
      const mySeat = sessionStorage.getItem('last_placed_seat') || '';
      const myOrders = orders.filter(o => o.seat === mySeat);
      
      if (myOrders.length === 0) {
        fanOrderTrackList.innerHTML = `
          <div style="background:rgba(255,255,255,0.01); border:1px dashed var(--border-color); padding:1rem; border-radius:var(--radius-md); text-align:center; color:var(--text-muted); font-size:0.85rem; font-style:italic;">
            🍔 No active food orders placed from this session.
          </div>
        `;
      } else {
        fanOrderTrackList.innerHTML = myOrders.map(ord => {
          let progressPercent = 10;
          if (ord.status === 'Preparing') progressPercent = 40;
          if (ord.status === 'Dispatched') progressPercent = 80;
          if (ord.status === 'Delivered') progressPercent = 100;
          
          return `
            <div class="match-item" style="border: 1px solid var(--border-color);">
              <div class="match-meta">
                <span>Order #${window.Security.sanitizeHtml(ord.id)}</span>
                <span class="status-badge status-${ord.status.toLowerCase()}">${window.Security.sanitizeHtml(ord.status)}</span>
              </div>
              <div style="font-size: 0.85rem; font-weight:700;">${window.Security.sanitizeHtml(ord.items)}</div>
              <div style="margin: 0.5rem 0; background-color:rgba(255,255,255,0.05); height:6px; border-radius:3px; overflow:hidden;">
                <div style="background-color:var(--color-primary); width: ${progressPercent}%; height:100%; transition:width 0.4s ease;"></div>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  }

  renderAnnouncements(announcements) {
    const list = document.getElementById('announcements-list');
    if (!list) return;

    if (announcements.length === 0) {
      list.innerHTML = `
        <div class="alert-banner" style="background:rgba(16,185,129,0.04); border:1px solid rgba(16,185,129,0.2); border-left:4px solid var(--color-primary); color:var(--text-primary); padding:0.75rem 1rem; border-radius:var(--radius-md); font-size:0.85rem; font-weight:600;" role="alert">
          ✓ Stadium operating normally. No active safety alerts.
        </div>
      `;
      return;
    }

    list.innerHTML = announcements.map(ann => {
      const typeClass = ann.type === 'Critical' ? 'alert-banner-critical' : ann.type === 'Warning' ? 'alert-banner-warning' : 'alert-banner-info';
      const icon = ann.type === 'Critical' ? '🚨' : ann.type === 'Warning' ? '⚠️' : 'ℹ️';
      return `
        <div class="alert-banner ${typeClass}" role="alert" aria-live="assertive">
          <div style="font-size:1.1rem;">${icon}</div>
          <div style="flex-grow:1;">
            <div style="font-weight:800; font-size:0.85rem;">${window.Security.sanitizeHtml(ann.title)}</div>
            <div style="margin-top:0.2rem; color:var(--text-primary); font-size:0.8rem;">${window.Security.sanitizeHtml(ann.content)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderHeatmapDetail() {
    const detailBox = document.getElementById('sensor-details');
    if (!detailBox) return;

    const isGate = this.selectedGateSensor.startsWith('gate-');
    const sensors = window.Store.state.sensors;
    
    document.querySelectorAll('.sensor-node').forEach(node => {
      node.style.border = '2px solid #fff';
    });
    
    const selectedEl = document.querySelector(`[data-sensor-id="${this.selectedGateSensor}"]`);
    if (selectedEl) {
      selectedEl.style.border = '3px solid var(--border-focus)';
    }

    if (isGate) {
      const gate = sensors.gates.find(g => g.id === this.selectedGateSensor);
      const isCritical = gate.alert === 'Critical';
      const cleanName = window.Security.sanitizeHtml(gate.name);
      const cleanAlert = window.Security.sanitizeHtml(gate.alert);

      detailBox.innerHTML = `
        <div class="sensor-detail-box">
          <h4 style="border-bottom: 1px solid var(--border-color); padding-bottom:0.25rem; margin-bottom:0.4rem; color:var(--color-primary)">${cleanName}</h4>
          <div class="sensor-detail-item"><span>Current Flow:</span><strong>${gate.flowRate} fans/min</strong></div>
          <div class="sensor-detail-item"><span>Occupancy:</span><strong>${gate.occupancy} / ${gate.capacity}</strong></div>
          <div class="sensor-detail-item"><span>Alert Status:</span><strong style="color: ${isCritical ? 'var(--color-danger)' : gate.alert === 'Moderate' ? 'var(--color-accent)' : 'var(--color-primary)'}">${cleanAlert}</strong></div>
          
          ${isCritical ? `
            <div style="margin-top:0.6rem; color:var(--color-danger); font-size:0.75rem; font-weight:700;">⚠️ Gate Congestion Critical</div>
          ` : gate.alert === 'Moderate' ? `
            <button class="btn btn-warning" style="width:100%; font-size:0.75rem; padding:0.3rem; margin-top:0.6rem;" onclick="window.Store.triggerRerouteAlert('${gate.id}', 'Gate D (West)')" aria-label="Reroute Gate ${cleanName}">
              Trigger Rerouting
            </button>
          ` : `
            <div style="margin-top:0.6rem; color:var(--color-primary); font-size:0.75rem; font-weight:700;">✓ Operations Normal</div>
          `}
        </div>
      `;
    } else {
      const zone = sensors.concessions.find(z => z.id === this.selectedGateSensor);
      detailBox.innerHTML = `
        <div class="sensor-detail-box">
          <h4 style="border-bottom: 1px solid var(--border-color); padding-bottom:0.25rem; margin-bottom:0.4rem; color:var(--color-primary)">${window.Security.sanitizeHtml(zone.name)}</h4>
          <div class="sensor-detail-item"><span>Average Wait:</span><strong>${zone.queueWait}</strong></div>
          <div class="sensor-detail-item"><span>Density:</span><strong>${zone.occupancy} / ${zone.capacity}</strong></div>
          <div class="sensor-detail-item"><span>Alert Status:</span><strong style="color: ${zone.alert === 'Critical' ? 'var(--color-danger)' : zone.alert === 'Moderate' ? 'var(--color-accent)' : 'var(--color-primary)'}">${window.Security.sanitizeHtml(zone.alert)}</strong></div>
        </div>
      `;
    }
  }

  renderAuditLogs() {
    const list = document.getElementById('audit-logs-list');
    if (!list) return;

    const logs = window.Security.AuditLogger.getLogs();
    if (logs.length === 0) {
      list.innerHTML = `<div class="diag-log-line" style="color:var(--text-muted)">No operational logs generated yet.</div>`;
      return;
    }

    list.innerHTML = logs.slice().reverse().map(log => {
      const date = new Date(log.timestamp).toLocaleTimeString();
      const statusColor = log.status === 'SUCCESS' ? 'var(--color-primary)' : 'var(--color-danger)';
      return `
        <div class="diag-log-line">
          [${date}] <span style="color:${statusColor}">${log.status}</span> <strong>${log.action}</strong> by <em>${log.user}</em>: ${log.details}
        </div>
      `;
    }).join('');
  }

  // --- Actions & Calculations ---

  adjustMatchScore(matchId, team, delta) {
    const match = window.Store.state.matches.find(m => m.id === matchId);
    if (match) {
      let scoreA = match.teamA.score;
      let scoreB = match.teamB.score;
      if (team === 'A') scoreA = Math.max(0, scoreA + delta);
      else scoreB = Math.max(0, scoreB + delta);
      window.Store.updateScore(matchId, scoreA, scoreB);
    }
  }

  calculateNavigationRoute() {
    const selectBlock = document.getElementById('nav-start-block');
    const selectGate = document.getElementById('nav-end-gate');
    const toggleAccessible = document.getElementById('nav-accessible-toggle');
    const resultsContainer = document.getElementById('nav-instructions-list');

    if (!selectBlock || !selectGate || !resultsContainer) return;

    this.setLoadingState('btn-routing-submit', true, 'Calculate Path', 'Calculating...');

    setTimeout(() => {
      const startBlock = selectBlock.value;
      const endGate = selectGate.value;
      const stepFree = toggleAccessible ? toggleAccessible.checked : false;

      const result = window.Router.findShortestPath(startBlock, endGate, stepFree);
      const steps = window.Router.generateInstructions(result.path);

      window.Store.incrementRoutesComputed();

      this.currentNavInstructions = steps.map(s => s.action).join('. ');

      this.renderPathOutput(steps, result.rerouted);

      const liveRegion = document.getElementById('sr-live-route-announcement');
      if (liveRegion) {
        liveRegion.textContent = `Route computed. ${steps.length} steps. First: ${steps[0].action}`;
      }

      window.Security.AuditLogger.log('CALCULATE_ROUTE', 'Fan Seat Finder', 'SUCCESS', `Route computed: ${startBlock} -> ${endGate} (Step-free: ${stepFree}, Rerouted: ${result.rerouted})`);
      this.setLoadingState('btn-routing-submit', false, 'Calculate Path');
    }, 400);
  }

  renderPathOutput(steps, rerouted) {
    const resultsContainer = document.getElementById('nav-instructions-list');
    const ttsAlertBox = document.getElementById('routing-tts-prompt');
    const pathAlertContainer = document.getElementById('path-alert-container');

    if (!resultsContainer) return;

    if (pathAlertContainer) {
      if (rerouted) {
        pathAlertContainer.innerHTML = `
          <div class="route-alert reroute-active">
            ⚠️ <strong>Aura AI Notice:</strong> Optimal route recalculated. Standard path contains active incidents; routing around safety hazard.
          </div>
        `;
      } else if (steps.length === 1 && steps[0].node === 'Error') {
        pathAlertContainer.innerHTML = `
          <div class="route-alert">
            🛑 <strong>Blocked Path:</strong> Active safety hazards block all paths to this gate. Please contact an usher immediately.
          </div>
        `;
      } else {
        pathAlertContainer.innerHTML = '';
      }
    }

    resultsContainer.innerHTML = steps.map((step, idx) => `
      <div class="path-node-step">
        <div class="path-step-icon">${idx + 1}</div>
        <div class="path-step-desc">${window.Security.sanitizeHtml(step.action)}</div>
      </div>
    `).join('');

    if (ttsAlertBox) {
      ttsAlertBox.style.display = 'flex';
      const readBtn = document.getElementById('btn-tts-read-path');
      if (readBtn) {
        const newReadBtn = readBtn.cloneNode(true);
        readBtn.parentNode.replaceChild(newReadBtn, readBtn);
        newReadBtn.addEventListener('click', () => {
          this.speakText(this.currentNavInstructions);
        });
      }
    }
  }

  handleFanOrder() {
    const inputSeat = document.getElementById('order-seat');
    const selectFood = document.getElementById('order-food');
    const alertBox = document.getElementById('order-success-alert');

    if (!inputSeat || !selectFood) return;

    const seatVal = inputSeat.value;
    const foodVal = selectFood.value;

    const validatedSeat = window.Security.validateField(seatVal, {
      required: true,
      pattern: window.Security.Patterns.SEAT,
      patternMessage: 'Seat address format must contain Block/Seat (e.g. Block-104).'
    });

    if (!validatedSeat.isValid) {
      alert(`Invalid Seat: ${validatedSeat.error}`);
      return;
    }

    if (!window.Security.RateLimiter.checkLimit('concession_order', 2, 30)) {
      alert('Too many concession orders. Please wait 30 seconds before placing another order.');
      return;
    }

    this.setLoadingState('btn-concession-submit', true, 'Order Food Set', 'Placing Order...');

    setTimeout(() => {
      const order = window.Store.placeOrder(seatVal, foodVal);
      sessionStorage.setItem('last_placed_seat', seatVal);
      
      selectFood.selectedIndex = 0;
      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.textContent = `Order placed successfully! Tracking ID: #${order.id}.`;
        setTimeout(() => { alertBox.style.display = 'none'; }, 6000);
      }
      this.setLoadingState('btn-concession-submit', false, 'Order Food Set');
    }, 500);
  }

  handleFanReportIncident() {
    const inputSeat = document.getElementById('report-loc');
    const selectType = document.getElementById('report-type');
    const textDesc = document.getElementById('report-desc');
    const selectSeverity = document.getElementById('report-severity');
    const alertBox = document.getElementById('report-success-alert');

    if (!inputSeat || !selectType || !textDesc || !selectSeverity) return;

    const seatVal = inputSeat.value;
    const typeVal = selectType.value;
    const descVal = textDesc.value;
    const severityVal = selectSeverity.value;

    const validatedSeat = window.Security.validateField(seatVal, {
      required: true,
      pattern: window.Security.Patterns.SEAT,
      patternMessage: 'Specify a valid Block/Stairwell ID (e.g. Stairwell-3).'
    });

    const validatedDesc = window.Security.validateField(descVal, {
      required: true,
      minLength: 5,
      maxLength: 200
    });

    if (!validatedSeat.isValid) {
      alert(`Location Error: ${validatedSeat.error}`);
      return;
    }

    if (!validatedDesc.isValid) {
      alert(`Description Error: ${validatedDesc.error}`);
      return;
    }

    if (!window.Security.RateLimiter.checkLimit('incident_report', 3, 60)) {
      alert('Rate limit exceeded. Please wait 60 seconds before submitting another incident.');
      return;
    }

    this.setLoadingState('btn-incident-submit', true, 'File Incident Ticket', 'Filing Ticket...');

    setTimeout(() => {
      const inc = window.Store.reportIncident(typeVal, seatVal, descVal, severityVal);

      inputSeat.value = '';
      textDesc.value = '';

      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.textContent = `Incident ticket #${inc.id} logged. Safeguards dispatched.`;
        setTimeout(() => { alertBox.style.display = 'none'; }, 6000);
      }
      this.setLoadingState('btn-incident-submit', false, 'File Incident Ticket');
    }, 500);
  }

  handleOperatorCreateMatch() {
    const sportInput = document.getElementById('sched-sport');
    const tourInput = document.getElementById('sched-tour');
    const venueInput = document.getElementById('sched-venue');
    const timeInput = document.getElementById('sched-time');
    const teamAInput = document.getElementById('sched-teama');
    const teamAColor = document.getElementById('sched-teama-color');
    const teamBInput = document.getElementById('sched-teamb');
    const teamBColor = document.getElementById('sched-teamb-color');

    if (!sportInput || !tourInput || !venueInput || !timeInput || !teamAInput || !teamBInput) return;

    const sport = sportInput.value;
    const tournament = tourInput.value;
    const venue = venueInput.value;
    const time = timeInput.value;
    const teamAName = teamAInput.value;
    const teamBName = teamBInput.value;

    const valSport = window.Security.validateField(sport, { required: true, minLength: 2, maxLength: 30 });
    const valTour = window.Security.validateField(tournament, { required: true, minLength: 2, maxLength: 50 });
    const valVenue = window.Security.validateField(venue, { required: true, minLength: 2, maxLength: 50 });
    const valTeamA = window.Security.validateField(teamAName, { required: true, minLength: 2, maxLength: 40 });
    const valTeamB = window.Security.validateField(teamBName, { required: true, minLength: 2, maxLength: 40 });

    if (!valSport.isValid || !valTour.isValid || !valVenue.isValid || !valTeamA.isValid || !valTeamB.isValid) {
      alert('Validation error. Please verify input fields.');
      return;
    }

    this.setLoadingState('btn-schedule-submit', true, 'Schedule Match', 'Scheduling...');

    setTimeout(() => {
      window.Store.addMatch({
        sport,
        tournament,
        venue,
        time,
        date: new Date().toISOString().split('T')[0],
        status: 'SCHEDULED',
        teamA: { name: teamAName, score: 0, color: teamAColor.value },
        teamB: { name: teamBName, score: 0, color: teamBColor.value }
      });

      sportInput.value = '';
      tourInput.value = '';
      venueInput.value = '';
      timeInput.value = '19:30';
      teamAInput.value = '';
      teamBInput.value = '';
      this.setLoadingState('btn-schedule-submit', false, 'Schedule Match');
    }, 500);
  }

  // --- Accessibility Voice Synthesis ---

  speakText(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    const voices = window.speechSynthesis.getVoices();
    const cleanVoice = voices.find(voice => voice.lang.includes('en-'));
    if (cleanVoice) utterance.voice = cleanVoice;
    window.speechSynthesis.speak(utterance);
  }

  speakActiveAnnouncements() {
    const anns = window.Store.state.announcements;
    if (anns.length === 0) {
      this.speakText("There are no active stadium announcements at this time.");
      return;
    }
    const txt = anns.map((ann, idx) => `Alert ${idx + 1}: ${ann.title}. ${ann.content}`).join('. ');
    this.speakText(`Reading safety alerts: ${txt}`);
  }

  // --- Diagnostics Console Test Runner ---

  runSystemDiagnostics() {
    const consoleEl = document.getElementById('diagnostics-console-logs');
    if (!consoleEl) return;

    consoleEl.innerHTML = '';
    const writeLog = (text, type = '') => {
      const div = document.createElement('div');
      div.className = `diag-log-line ${type}`;
      div.textContent = text;
      consoleEl.appendChild(div);
      consoleEl.scrollTop = consoleEl.scrollHeight;
    };

    writeLog('==================================================', 'diag-header');
    writeLog(' ARENAFLOW PRO AUTOMATED DIAGNOSTIC VERIFICATION  ', 'diag-header');
    writeLog(` RUN TIME: ${new Date().toLocaleString()}         `, 'diag-header');
    writeLog('==================================================', 'diag-header');
    writeLog('Initializing secure test sandbox...', 'diag-log-line');

    setTimeout(async () => {
      const report = await window.TestSuite.run();
      
      report.results.forEach(res => {
        if (res.success) {
          writeLog(`[PASS] ${res.name} (${res.durationMs}ms)`, 'diag-pass');
        } else {
          writeLog(`[FAIL] ${res.name} (${res.durationMs}ms): ${res.error}`, 'diag-fail');
        }
      });

      writeLog('--------------------------------------------------', 'diag-log-line');
      
      // Verify local storage audit log hash-chain integrity
      const logVerification = window.Security.AuditLogger.verifyChain();
      if (logVerification.verified) {
        writeLog('[PASS] Audit Log Integrity Check: Cryptographic Hash Chain verified.', 'diag-pass');
      } else {
        writeLog(`[FAIL] Audit Log Integrity Check: Cryptographic tampering detected at index ${logVerification.corruptedIndex}!`, 'diag-fail');
      }

      writeLog('--------------------------------------------------', 'diag-log-line');
      writeLog(`Test execution completed. Passed: ${report.passed}/${report.total}.`, 'diag-log-line');
      
      if (report.failed === 0) {
        writeLog('SECURITY & ARCHITECTURE AUDIT: PASSED. All validators, route hazards, NLU handlers, and authorization blocks are functional.', 'diag-pass');
        window.Security.AuditLogger.log('RUN_DIAGNOSTICS', 'Diagnostic System', 'SUCCESS', `Ran ${report.total} assertions. Clean success.`);
      } else {
        writeLog('SYSTEM HEALTH CHECK: FAILED. Check details above.', 'diag-fail');
        window.Security.AuditLogger.log('RUN_DIAGNOSTICS', 'Diagnostic System', 'FAILURE', `Assertions failed: ${report.failed}`);
      }
    }, 800);
  }
}

const AppController = new ArenaFlowController();
window.AppController = AppController;

document.addEventListener('DOMContentLoaded', () => {
  AppController.init();
});
