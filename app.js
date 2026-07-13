/**
 * ArenaFlow Application Controller
 * Handles DOM orchestration, algorithmic pathfinding, view state toggling, and TTS speech synthesis.
 */

// --- Stadium Pathfinding Graph Definitions ---
const GraphData = {
  nodes: [
    { id: 'Block-102', label: 'Seat Area Block 102', type: 'block' },
    { id: 'Block-104', label: 'Seat Area Block 104', type: 'block' },
    { id: 'Block-212', label: 'Seat Area Block 212', type: 'block' },
    { id: 'Stairwell-3', label: 'Stairwell 3 (High-steep stairs)', type: 'stairs' },
    { id: 'Stairwell-4', label: 'Stairwell 4 (Stairs)', type: 'stairs' },
    { id: 'Elevator-East', label: 'Elevator East (Step-Free)', type: 'elevator' },
    { id: 'Elevator-West', label: 'Elevator West (Step-Free)', type: 'elevator' },
    { id: 'Main-Concourse-North', label: 'Main Concourse North level', type: 'concourse' },
    { id: 'Main-Concourse-South', label: 'Main Concourse South level', type: 'concourse' },
    { id: 'Gate-A', label: 'Gate A (North Entrance)', type: 'gate' },
    { id: 'Gate-B', label: 'Gate B (South Entrance)', type: 'gate' },
    { id: 'Gate-C', label: 'Gate C (East Entrance)', type: 'gate' },
    { id: 'Gate-D', label: 'Gate D (West Entrance)', type: 'gate' }
  ],
  edges: [
    // Block 102 connections
    { from: 'Block-102', to: 'Stairwell-3', weight: 2, accessible: false },
    { from: 'Block-102', to: 'Elevator-East', weight: 5, accessible: true }, // longer walk to elevator, but accessible
    
    // Block 104 connections
    { from: 'Block-104', to: 'Stairwell-4', weight: 2, accessible: false },
    { from: 'Block-104', to: 'Elevator-West', weight: 4, accessible: true },
    
    // Block 212 connections
    { from: 'Block-212', to: 'Stairwell-4', weight: 3, accessible: false },
    { from: 'Block-212', to: 'Elevator-West', weight: 6, accessible: true },

    // Stairwells / Elevators to Concourses
    { from: 'Stairwell-3', to: 'Main-Concourse-North', weight: 3, accessible: false },
    { from: 'Elevator-East', to: 'Main-Concourse-North', weight: 2, accessible: true },
    { from: 'Stairwell-4', to: 'Main-Concourse-South', weight: 3, accessible: false },
    { from: 'Elevator-West', to: 'Main-Concourse-South', weight: 2, accessible: true },

    // Concourse to Gates
    { from: 'Main-Concourse-North', to: 'Gate-A', weight: 2, accessible: true },
    { from: 'Main-Concourse-North', to: 'Gate-C', weight: 4, accessible: true },
    
    { from: 'Main-Concourse-South', to: 'Gate-B', weight: 2, accessible: true },
    { from: 'Main-Concourse-South', to: 'Gate-D', weight: 5, accessible: true },

    // Inter-concourse backup link
    { from: 'Main-Concourse-North', to: 'Main-Concourse-South', weight: 8, accessible: true }
  ]
};

/**
 * Custom Dijkstra Pathfinding Algorithm.
 * Computes shortest path from start block to exit gate.
 * If accessibleOnly is true, filters out non-accessible (staircase) routes.
 */
function findShortestPath(startNodeId, targetNodeId, accessibleOnly = false) {
  const nodes = GraphData.nodes.map(n => n.id);
  
  // Initialize distances
  const distances = {};
  const previous = {};
  const remaining = new Set(nodes);
  
  for (const node of nodes) {
    distances[node] = Infinity;
    previous[node] = null;
  }
  distances[startNodeId] = 0;

  // Build adjacency list filtered by accessibility criteria
  const adjList = {};
  for (const node of nodes) {
    adjList[node] = [];
  }
  
  for (const edge of GraphData.edges) {
    if (accessibleOnly && !edge.accessible) {
      continue; // Skip inaccessible routes (stairs)
    }
    // Graph is bi-directional for navigation
    adjList[edge.from].push({ node: edge.to, weight: edge.weight });
    adjList[edge.to].push({ node: edge.from, weight: edge.weight });
  }

  while (remaining.size > 0) {
    // Find node with minimum distance
    let minNode = null;
    for (const node of remaining) {
      if (minNode === null || distances[node] < distances[minNode]) {
        minNode = node;
      }
    }

    if (minNode === null || distances[minNode] === Infinity) {
      break;
    }

    if (minNode === targetNodeId) {
      break; // Found target
    }

    remaining.delete(minNode);

    // Relax edges
    for (const neighbor of adjList[minNode]) {
      if (!remaining.has(neighbor.node)) continue;
      
      const alt = distances[minNode] + neighbor.weight;
      if (alt < distances[neighbor.node]) {
        distances[neighbor.node] = alt;
        previous[neighbor.node] = minNode;
      }
    }
  }

  // Reconstruct path
  const path = [];
  let current = targetNodeId;
  while (current !== null) {
    path.unshift(current);
    current = previous[current];
  }

  if (path[0] !== startNodeId) {
    return { path: [], distance: Infinity }; // No path available
  }

  return { path, distance: distances[targetNodeId] };
}

/**
 * Translates a path array of node IDs to human-readable step-by-step navigation instructions.
 */
function generatePathInstructions(path, accessibleOnly) {
  if (path.length === 0) {
    return ["No route found under selected accessibility parameters. Please request immediate usher assistance."];
  }

  const steps = [];
  for (let i = 0; i < path.length; i++) {
    const node = GraphData.nodes.find(n => n.id === path[i]);
    if (i === 0) {
      steps.push({ node: node.label, action: `Start at your seating section: ${node.label}` });
    } else {
      const prevNode = GraphData.nodes.find(n => n.id === path[i-1]);
      let verb = "Proceed to";
      if (node.type === 'stairs') {
        verb = "Go down the stairs via";
      } else if (node.type === 'elevator') {
        verb = "Proceed to the lift at";
      } else if (node.type === 'gate') {
        verb = "Arrive at exit terminal";
      }
      steps.push({ node: node.label, action: `${verb} ${node.label}` });
    }
  }
  return steps;
}


// --- Main Application UI Controller ---
class ArenaFlowController {
  constructor() {
    this.activeRole = 'fan'; // 'fan' or 'operator' or 'diagnostics'
    this.selectedGateSensor = 'gate-c'; // heatmap detail focus
  }

  init() {
    // Initialize central store
    window.Store.init();

    // Bind event listeners
    this.bindEvents();

    // Subscribe to state changes
    window.Store.subscribe((state) => this.render(state));

    // Initial render
    this.render(window.Store.state);
    
    // Log startup
    window.Security.AuditLogger.log('SYSTEM_STARTUP', 'System Kernel', 'SUCCESS', 'ArenaFlow UI dashboard fully loaded.');
  }

  bindEvents() {
    // 1. Role Toggle Tabs
    document.querySelectorAll('.role-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const role = e.target.getAttribute('data-role');
        this.switchRole(role);
      });
    });

    // 2. High Contrast toggle
    const btnContrast = document.getElementById('btn-toggle-contrast');
    if (btnContrast) {
      btnContrast.addEventListener('click', () => {
        document.body.classList.toggle('high-contrast');
        const isHc = document.body.classList.contains('high-contrast');
        btnContrast.setAttribute('aria-pressed', isHc);
        window.Security.AuditLogger.log('TOGGLE_HIGH_CONTRAST', 'User', 'SUCCESS', `High contrast mode toggled to: ${isHc}`);
      });
    }

    // 3. TTS Announcement Reader
    const btnSpeak = document.getElementById('btn-tts-read');
    if (btnSpeak) {
      btnSpeak.addEventListener('click', () => {
        this.speakActiveAnnouncements();
      });
    }

    // 4. Seating Path Navigation Form
    const navForm = document.getElementById('routing-form');
    if (navForm) {
      navForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.calculateNavigationRoute();
      });
    }

    // 5. Fan Order Food Form
    const orderForm = document.getElementById('concession-form');
    if (orderForm) {
      orderForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFanOrder();
      });
    }

    // 6. Fan Report Incident Form
    const fanIncidentForm = document.getElementById('fan-incident-form');
    if (fanIncidentForm) {
      fanIncidentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFanReportIncident();
      });
    }

    // 7. Match Score Updates (Operator Panel)
    const schedulerForm = document.getElementById('operator-scheduler-form');
    if (schedulerForm) {
      schedulerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleOperatorCreateMatch();
      });
    }

    // 8. Heatmap dynamic node selector clicks
    document.querySelectorAll('.sensor-node').forEach(node => {
      node.addEventListener('click', (e) => {
        this.selectedGateSensor = e.target.getAttribute('data-sensor-id');
        this.renderHeatmapDetail();
      });
    });

    // 9. Run Diagnostics Button
    const btnDiagnostics = document.getElementById('btn-run-diagnostics');
    if (btnDiagnostics) {
      btnDiagnostics.addEventListener('click', () => {
        this.runSystemDiagnostics();
      });
    }

    // 10. Clear Audit logs button
    const btnClearLogs = document.getElementById('btn-clear-audit-logs');
    if (btnClearLogs) {
      btnClearLogs.addEventListener('click', () => {
        window.Security.AuditLogger.clearLogs();
        this.renderAuditLogs();
      });
    }

    // Listen to real-time audit log addition events
    window.addEventListener('auditlogadded', () => {
      this.renderAuditLogs();
    });
  }

  switchRole(role) {
    this.activeRole = role;
    
    // Toggle active classes on tab buttons
    document.querySelectorAll('.role-tab').forEach(tab => {
      if (tab.getAttribute('data-role') === role) {
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
      } else {
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
      }
    });

    // Toggle active panel visibility
    document.querySelectorAll('.view-panel').forEach(panel => {
      if (panel.id === `${role}-panel`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    window.Security.AuditLogger.log('SWITCH_VIEW_ROLE', 'User', 'SUCCESS', `Switched application role to ${role}`);
  }

  // --- Rendering Functions ---

  render(state) {
    this.renderMatches(state.matches);
    this.renderIncidents(state.incidents);
    this.renderConcessions(state.concessions);
    this.renderAnnouncements(state.announcements);
    this.renderHeatmapDetail();
    this.renderAuditLogs();
  }

  renderMatches(matches) {
    // 1. Render in Fan View Match list
    const fanMatchesList = document.getElementById('fan-matches-list');
    if (fanMatchesList) {
      fanMatchesList.innerHTML = matches.map(match => this.createMatchHtml(match, false)).join('');
    }

    // 2. Render in Operator View Match List (with score inputs)
    const operatorMatchesList = document.getElementById('operator-matches-list');
    if (operatorMatchesList) {
      operatorMatchesList.innerHTML = matches.map(match => this.createMatchHtml(match, true)).join('');
      // Bind inline scoring buttons
      operatorMatchesList.querySelectorAll('.btn-score-up').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const matchId = e.currentTarget.getAttribute('data-match-id');
          const team = e.currentTarget.getAttribute('data-team');
          const delta = parseInt(e.currentTarget.getAttribute('data-delta'));
          this.adjustMatchScore(matchId, team, delta);
        });
      });

      // Bind inline status select boxes
      operatorMatchesList.querySelectorAll('.select-match-status').forEach(select => {
        select.addEventListener('change', (e) => {
          const matchId = e.target.getAttribute('data-match-id');
          const newStatus = e.target.value;
          const match = matches.find(m => m.id === matchId);
          let newTime = match.time;
          if (newStatus === 'LIVE' && match.status !== 'LIVE') newTime = 'Q1 - 10:00';
          if (newStatus === 'COMPLETED') newTime = 'Final';
          if (newStatus === 'SCHEDULED') newTime = '18:00';
          window.Store.updateMatchStatus(matchId, newStatus, newTime);
        });
      });
    }
  }

  createMatchHtml(match, isOperator) {
    const statusClass = match.status === 'LIVE' ? 'badge-live' : match.status === 'COMPLETED' ? 'badge-completed' : 'badge-scheduled';
    
    if (isOperator) {
      return `
        <div class="match-item" data-match-id="${match.id}">
          <div class="match-meta">
            <span>${window.Security.sanitizeHtml(match.tournament)} | ${window.Security.sanitizeHtml(match.venue)}</span>
            <select class="select-match-status" data-match-id="${match.id}" aria-label="Change status for match vs ${match.teamA.name}">
              <option value="SCHEDULED" ${match.status === 'SCHEDULED' ? 'selected' : ''}>Scheduled</option>
              <option value="LIVE" ${match.status === 'LIVE' ? 'selected' : ''}>Live</option>
              <option value="COMPLETED" ${match.status === 'COMPLETED' ? 'selected' : ''}>Completed</option>
            </select>
          </div>
          <div class="match-scoreline">
            <div class="team-info">
              <span class="team-dot" style="background-color: ${match.teamA.color}"></span>
              <span>${window.Security.sanitizeHtml(match.teamA.name)}</span>
            </div>
            <div class="score-display">
              <span>${match.teamA.score}</span>
              <span class="score-divider">-</span>
              <span>${match.teamB.score}</span>
            </div>
            <div class="team-info">
              <span>${window.Security.sanitizeHtml(match.teamB.name)}</span>
              <span class="team-dot" style="background-color: ${match.teamB.color}"></span>
            </div>
          </div>
          <div class="match-controls">
            <button class="btn btn-secondary btn-score-up" data-match-id="${match.id}" data-team="A" data-delta="1" aria-label="Score +1 to ${match.teamA.name}">
              +1 ${match.teamA.name}
            </button>
            <button class="btn btn-secondary btn-score-up" data-match-id="${match.id}" data-team="B" data-delta="1" aria-label="Score +1 to ${match.teamB.name}">
              +1 ${match.teamB.name}
            </button>
            <span style="flex-grow: 1;"></span>
            <input type="text" value="${window.Security.sanitizeHtml(match.time)}" class="match-time-input" 
              data-match-id="${match.id}" style="width: 80px; text-align: center; padding: 0.2rem;" aria-label="Match time clock"
              onchange="window.Store.updateMatchStatus('${match.id}', '${match.status}', this.value)"/>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="match-item">
          <div class="match-meta">
            <span>${window.Security.sanitizeHtml(match.tournament)} | ${window.Security.sanitizeHtml(match.venue)}</span>
            <span class="match-status-badge ${statusClass}">${match.status}</span>
          </div>
          <div class="match-scoreline">
            <div class="team-info">
              <span class="team-dot" style="background-color: ${match.teamA.color}"></span>
              <span>${window.Security.sanitizeHtml(match.teamA.name)}</span>
            </div>
            <div class="score-display">
              <span>${match.teamA.score}</span>
              <span class="score-divider">:</span>
              <span>${match.teamB.score}</span>
            </div>
            <div class="team-info">
              <span>${window.Security.sanitizeHtml(match.teamB.name)}</span>
              <span class="team-dot" style="background-color: ${match.teamB.color}"></span>
            </div>
          </div>
          <div style="font-size: 0.8rem; text-align: center; color: var(--text-muted); margin-top: 0.25rem;">
            <span>Game Time: ${window.Security.sanitizeHtml(match.time)}</span>
          </div>
        </div>
      `;
    }
  }

  renderIncidents(incidents) {
    const tableBody = document.getElementById('operator-incidents-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = incidents.map(inc => {
      const severityClass = `severity-${inc.severity.toLowerCase()}`;
      const statusClass = `status-${inc.status.toLowerCase()}`;
      
      let actions = '';
      if (inc.status === 'Open') {
        actions = `<button class="btn btn-secondary btn-assign-inc" data-incident-id="${inc.id}">Assign Staff</button>`;
      } else if (inc.status === 'Assigned') {
        actions = `<button class="btn btn-success btn-resolve-inc" data-incident-id="${inc.id}">Resolve</button>`;
      } else {
        actions = `<span style="color: var(--color-success); font-weight: 600;">✓ Completed</span>`;
      }

      return `
        <tr>
          <td><strong>#${inc.id}</strong></td>
          <td>${window.Security.sanitizeHtml(inc.type)}</td>
          <td>${window.Security.sanitizeHtml(inc.location)}</td>
          <td>${window.Security.sanitizeHtml(inc.description)}</td>
          <td><span class="severity-badge ${severityClass}">${inc.severity}</span></td>
          <td><span class="status-badge ${statusClass}">${inc.status}</span></td>
          <td>${inc.assignedStaff ? window.Security.sanitizeHtml(inc.assignedStaff) : '<em style="color: var(--text-muted)">None</em>'}</td>
          <td>${actions}</td>
        </tr>
      `;
    }).join('');

    // Bind dynamic incident action buttons
    tableBody.querySelectorAll('.btn-assign-inc').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const incId = e.target.getAttribute('data-incident-id');
        const staffName = prompt('Enter name of dispatch staff to assign:');
        if (staffName && staffName.trim()) {
          const validated = window.Security.validateField(staffName, { minLength: 2, maxLength: 30 });
          if (validated.isValid) {
            window.Store.assignIncident(incId, staffName);
          } else {
            alert('Invalid staff name: ' + validated.error);
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
    // 1. Render in Operator View Concession manager
    const operatorOrdersList = document.getElementById('operator-orders-list');
    if (operatorOrdersList) {
      operatorOrdersList.innerHTML = orders.map(ord => {
        const statusText = ord.status;
        let actionButtons = '';
        if (ord.status === 'Received') {
          actionButtons = `<button class="btn btn-secondary btn-order-action" data-order-id="${ord.id}" data-action="Preparing">Prepare</button>`;
        } else if (ord.status === 'Preparing') {
          actionButtons = `<button class="btn btn-secondary btn-order-action" data-order-id="${ord.id}" data-action="Dispatched">Dispatch</button>`;
        } else if (ord.status === 'Dispatched') {
          actionButtons = `<button class="btn btn-success btn-order-action" data-order-id="${ord.id}" data-action="Delivered">Mark Delivered</button>`;
        } else {
          actionButtons = `<span style="color: var(--color-success)">✓ Delivered</span>`;
        }

        return `
          <div class="match-item" style="border-left: 4px solid var(--color-primary);">
            <div class="match-meta">
              <span>Order #${ord.id} - ${ord.seat}</span>
              <span class="status-badge" style="background-color: rgba(255,255,255,0.05); color: var(--text-primary); border: 1px solid var(--border-color);">${statusText}</span>
            </div>
            <div style="font-weight: 500; font-size: 0.9rem; padding: 0.25rem 0;">
              ${window.Security.sanitizeHtml(ord.items)}
            </div>
            <div style="display:flex; justify-content: space-between; align-items:center; font-size:0.75rem;">
              <span>Runner: ${ord.runner ? window.Security.sanitizeHtml(ord.runner) : '<em>Unassigned</em>'}</span>
              <div style="display:flex; gap:0.25rem;">
                ${actionButtons}
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Bind dynamic actions
      operatorOrdersList.querySelectorAll('.btn-order-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const ordId = e.target.getAttribute('data-order-id');
          const nextAction = e.target.getAttribute('data-action');
          let runnerName = '';
          if (nextAction === 'Dispatched') {
            runnerName = prompt('Enter Delivery Runner name:');
            if (!runnerName || !runnerName.trim()) return;
          }
          window.Store.updateOrderStatus(ordId, nextAction, runnerName);
        });
      });
    }

    // 2. Render Concessions Status in Fan View (Track Order)
    const fanOrderTrackList = document.getElementById('fan-order-track-list');
    if (fanOrderTrackList) {
      // Find orders matching last placed seat order
      const mySeat = sessionStorage.getItem('last_placed_seat') || '';
      const myOrders = orders.filter(o => o.seat === mySeat);
      
      if (myOrders.length === 0) {
        fanOrderTrackList.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted)">No active food orders placed from this browser tab yet.</p>`;
      } else {
        fanOrderTrackList.innerHTML = myOrders.map(ord => {
          let progressPercent = 10;
          if (ord.status === 'Preparing') progressPercent = 40;
          if (ord.status === 'Dispatched') progressPercent = 80;
          if (ord.status === 'Delivered') progressPercent = 100;
          
          return `
            <div class="match-item" style="border: 1px solid rgba(255,255,255,0.05);">
              <div class="match-meta">
                <span>Order #${ord.id} (${ord.status})</span>
                <span>Seat: ${ord.seat}</span>
              </div>
              <div style="font-size: 0.85rem; font-weight: 500;">${window.Security.sanitizeHtml(ord.items)}</div>
              <div style="margin: 0.5rem 0 0.25rem 0; background-color: rgba(255,255,255,0.05); height: 6px; border-radius: 3px; overflow:hidden;">
                <div style="background-color: var(--color-success); width: ${progressPercent}%; height:100%; transition: width 0.3s ease;"></div>
              </div>
              <span style="font-size:0.75rem; color:var(--text-muted)">
                ${ord.status === 'Dispatched' ? `Delivery runner ${ord.runner} is on their way!` : ord.status === 'Delivered' ? 'Enjoy your food!' : 'Kitchen is preparing your order.'}
              </span>
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
      list.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-muted)">No active public alerts/announcements.</p>`;
      return;
    }

    list.innerHTML = announcements.map(ann => {
      const typeClass = ann.type === 'Critical' ? 'alert-banner-critical' : ann.type === 'Warning' ? 'alert-banner-warning' : 'alert-banner-info';
      const icon = ann.type === 'Critical' ? '🚨' : ann.type === 'Warning' ? '⚠️' : 'ℹ️';
      return `
        <div class="alert-banner ${typeClass}" role="alert" aria-live="assertive">
          <div style="font-size:1.1rem;">${icon}</div>
          <div style="flex-grow:1;">
            <div style="font-weight:700; font-size:0.9rem;">${window.Security.sanitizeHtml(ann.title)}</div>
            <div style="margin-top:0.2rem; color:var(--text-primary); font-size:0.8rem;">${window.Security.sanitizeHtml(ann.content)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderHeatmapDetail() {
    const detailBox = document.getElementById('sensor-details');
    if (!detailBox) return;

    // Get current data based on this.selectedGateSensor
    const isGate = this.selectedGateSensor.startsWith('gate-');
    const sensors = window.Store.state.sensors;
    
    // Remove active highlight from all nodes
    document.querySelectorAll('.sensor-node').forEach(node => {
      node.style.border = '2px solid #fff';
    });
    
    // Highlight the selected node
    const selectedEl = document.querySelector(`[data-sensor-id="${this.selectedGateSensor}"]`);
    if (selectedEl) {
      selectedEl.style.border = '3px solid var(--border-focus)';
    }

    if (isGate) {
      const gate = sensors.gates.find(g => g.id === this.selectedGateSensor);
      const isCritical = gate.alert === 'Critical';
      detailBox.innerHTML = `
        <div class="sensor-detail-box">
          <h4 style="border-bottom: 1px solid var(--border-color); padding-bottom:0.25rem; margin-bottom:0.4rem; color:var(--color-primary)">${window.Security.sanitizeHtml(gate.name)}</h4>
          <div class="sensor-detail-item"><span>Current Flow:</span><strong>${gate.flowRate} fans/min</strong></div>
          <div class="sensor-detail-item"><span>Occupancy:</span><strong>${gate.occupancy} / ${gate.capacity}</strong></div>
          <div class="sensor-detail-item"><span>Alert Status:</span><strong style="color: ${isCritical ? 'var(--color-danger)' : gate.alert === 'Moderate' ? 'var(--color-warning)' : 'var(--color-success)'}">${gate.alert}</strong></div>
          
          ${isCritical ? `
            <div style="margin-top:0.6rem; color:var(--color-danger); font-size:0.75rem; font-weight:600;">⚠️ Gate Congestion High</div>
          ` : gate.alert === 'Moderate' ? `
            <button class="btn btn-warning" style="width:100%; font-size:0.75rem; padding:0.3rem; margin-top:0.6rem;" onclick="window.Store.triggerRerouteAlert('${gate.id}', 'Gate D (West)')">
              Trigger Rerouting
            </button>
          ` : `
            <div style="margin-top:0.6rem; color:var(--color-success); font-size:0.75rem;">✓ Normal operations</div>
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
          <div class="sensor-detail-item"><span>Alert Status:</span><strong style="color: ${zone.alert === 'Critical' ? 'var(--color-danger)' : zone.alert === 'Moderate' ? 'var(--color-warning)' : 'var(--color-success)'}">${zone.alert}</strong></div>
        </div>
      `;
    }
  }

  renderAuditLogs() {
    const consoleLogs = document.getElementById('audit-logs-list');
    if (!consoleLogs) return;

    const logs = window.Security.AuditLogger.getLogs();
    if (logs.length === 0) {
      consoleLogs.innerHTML = `<div class="diag-log-line" style="color:var(--text-muted)">No system audit logs found.</div>`;
      return;
    }

    // Display logs in reverse order (newest first)
    consoleLogs.innerHTML = logs.slice().reverse().map(log => {
      const date = new Date(log.timestamp).toLocaleTimeString();
      const statusColor = log.status === 'SUCCESS' ? 'var(--color-success)' : 'var(--color-danger)';
      return `
        <div class="diag-log-line">
          [${date}] <span style="color:${statusColor}">${log.status}</span> <strong>${log.action}</strong> by <em>${log.user}</em>: ${log.details}
        </div>
      `;
    }).join('');
  }

  // --- Algorithmic & Action Handlers ---

  adjustMatchScore(matchId, team, delta) {
    const match = window.Store.state.matches.find(m => m.id === matchId);
    if (match) {
      let scoreA = match.teamA.score;
      let scoreB = match.teamB.score;
      if (team === 'A') {
        scoreA = Math.max(0, scoreA + delta);
      } else {
        scoreB = Math.max(0, scoreB + delta);
      }
      window.Store.updateScore(matchId, scoreA, scoreB);
    }
  }

  calculateNavigationRoute() {
    const selectBlock = document.getElementById('nav-start-block');
    const selectGate = document.getElementById('nav-end-gate');
    const toggleAccessible = document.getElementById('nav-accessible-toggle');
    const resultsContainer = document.getElementById('nav-instructions-list');
    const ttsAlertBox = document.getElementById('routing-tts-prompt');

    if (!selectBlock || !selectGate || !resultsContainer) return;

    const startBlock = selectBlock.value;
    const endGate = selectGate.value;
    const stepFree = toggleAccessible ? toggleAccessible.checked : false;

    // Run Dijkstra pathfinder
    const result = findShortestPath(startBlock, endGate, stepFree);
    const steps = generatePathInstructions(result.path, stepFree);

    // Save instructions to class property for TTS read-out
    this.currentNavInstructions = steps.map(s => s.action).join('. ');

    // Display results in UI
    resultsContainer.innerHTML = steps.map((step, idx) => `
      <div class="path-node-step">
        <div class="path-step-icon">${idx + 1}</div>
        <div class="path-step-desc">${window.Security.sanitizeHtml(step.action)}</div>
      </div>
    `).join('');

    // Update screen-reader live announcement region
    const liveRegion = document.getElementById('sr-live-route-announcement');
    if (liveRegion) {
      liveRegion.textContent = `Route calculated. Total of ${steps.length} steps. First step: ${steps[0].action}`;
    }

    // Show Speech synthesis play button helper
    if (ttsAlertBox) {
      ttsAlertBox.style.display = 'flex';
      const readBtn = document.getElementById('btn-tts-read-path');
      if (readBtn) {
        // Remove previous listeners by cloning
        const newReadBtn = readBtn.cloneNode(true);
        readBtn.parentNode.replaceChild(newReadBtn, readBtn);
        newReadBtn.addEventListener('click', () => {
          this.speakText(this.currentNavInstructions);
        });
      }
    }

    window.Security.AuditLogger.log('CALCULATE_ROUTE', 'Fan Seat Finder', 'SUCCESS', `Route computed from ${startBlock} to ${endGate} (Accessible: ${stepFree})`);
  }

  handleFanOrder() {
    const inputSeat = document.getElementById('order-seat');
    const selectFood = document.getElementById('order-food');
    const alertBox = document.getElementById('order-success-alert');

    if (!inputSeat || !selectFood) return;

    const seatVal = inputSeat.value;
    const foodVal = selectFood.value;

    // Validate seat input
    const validatedSeat = window.Security.validateField(seatVal, {
      required: true,
      pattern: window.Security.Patterns.SEAT,
      patternMessage: 'Seat must contain Block, Row and Seat info (e.g. Block 104, Row G, Seat 9).'
    });

    if (!validatedSeat.isValid) {
      alert(`Invalid Seat Address: ${validatedSeat.error}`);
      return;
    }

    // Place order
    const order = window.Store.placeOrder(seatVal, foodVal);
    
    // Save seat info locally so they can track their order next time
    sessionStorage.setItem('last_placed_seat', seatVal);
    
    // Reset form and show success notification
    selectFood.selectedIndex = 0;
    if (alertBox) {
      alertBox.style.display = 'block';
      alertBox.textContent = `Order placed successfully! Tracking ID: #${order.id}. Preparing food shortly.`;
      setTimeout(() => { alertBox.style.display = 'none'; }, 8000);
    }
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

    // Validate inputs
    const validatedSeat = window.Security.validateField(seatVal, {
      required: true,
      pattern: window.Security.Patterns.SEAT,
      patternMessage: 'Location must specify Block/Seat (e.g. Block 102).'
    });

    const validatedDesc = window.Security.validateField(descVal, {
      required: true,
      minLength: 5,
      maxLength: 200
    });

    if (!validatedSeat.isValid) {
      alert(`Invalid Location: ${validatedSeat.error}`);
      return;
    }

    if (!validatedDesc.isValid) {
      alert(`Invalid Description: ${validatedDesc.error}`);
      return;
    }

    // Submit incident
    const inc = window.Store.reportIncident(typeVal, seatVal, descVal, severityVal);

    // Reset fields
    inputSeat.value = '';
    textDesc.value = '';
    selectSeverity.selectedIndex = 0;

    if (alertBox) {
      alertBox.style.display = 'block';
      alertBox.textContent = `Incident ticket #${inc.id} submitted. TOC Operations has dispatched responders.`;
      setTimeout(() => { alertBox.style.display = 'none'; }, 8000);
    }
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
      alert('Validation error. Please verify match fields are correct.');
      return;
    }

    const matchData = {
      sport,
      tournament,
      venue,
      time,
      date: new Date().toISOString().split('T')[0],
      status: 'SCHEDULED',
      teamA: { name: teamAName, score: 0, color: teamAColor ? teamAColor.value : '#3b82f6' },
      teamB: { name: teamBName, score: 0, color: teamBColor ? teamBColor.value : '#ff4b4b' }
    };

    window.Store.addMatch(matchData);

    // Clear inputs
    sportInput.value = '';
    tourInput.value = '';
    venueInput.value = '';
    timeInput.value = '19:00';
    teamAInput.value = '';
    teamBInput.value = '';
  }

  // --- Accessibility Voice Synthesis engine ---

  speakText(text) {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported on this browser.');
      return;
    }

    // Cancel current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; // slightly slower for clarity
    
    // Choose clean standard voice if possible
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(voice => voice.lang.includes('en-'));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    window.speechSynthesis.speak(utterance);
    window.Security.AuditLogger.log('ACCESSIBILITY_TTS', 'System a11y Voice', 'SUCCESS', `Narrated text: "${text.substring(0, 50)}..."`);
  }

  speakActiveAnnouncements() {
    const anns = window.Store.state.announcements;
    if (anns.length === 0) {
      this.speakText("There are no active stadium announcements at this time.");
      return;
    }

    const annTexts = anns.map((ann, idx) => `Announcement ${idx + 1}: ${ann.title}. ${ann.content}`).join('. ');
    this.speakText(`Reading current announcements: ${annTexts}`);
  }

  // --- Built-in Custom Diagnostic Test Runner ---

  runSystemDiagnostics() {
    const consoleEl = document.getElementById('diagnostics-console-logs');
    if (!consoleEl) return;

    // Reset console output and print header
    consoleEl.innerHTML = '';
    
    const writeLog = (text, type = '') => {
      const div = document.createElement('div');
      div.className = `diag-log-line ${type}`;
      div.textContent = text;
      consoleEl.appendChild(div);
      consoleEl.scrollTop = consoleEl.scrollHeight;
    };

    writeLog('==================================================', 'diag-header');
    writeLog(' ARENAFLOW AUTOMATED DIAGNOSTIC SYSTEM TESTS      ', 'diag-header');
    writeLog(` RUN DATE: ${new Date().toLocaleString()}        `, 'diag-header');
    writeLog('==================================================', 'diag-header');
    writeLog('Initializing custom test runner environment...', 'diag-log-line');

    setTimeout(() => {
      // Execute the tests from TestSuite in test-runner.js
      const report = window.TestSuite.run();
      
      writeLog(`Found ${report.total} registered tests to execute.`, 'diag-log-line');
      writeLog('Running assertions...', 'diag-log-line');
      writeLog('--------------------------------------------------', 'diag-log-line');

      report.results.forEach(res => {
        if (res.success) {
          writeLog(`[PASS] ${res.name} (${res.durationMs}ms)`, 'diag-pass');
        } else {
          writeLog(`[FAIL] ${res.name} (${res.durationMs}ms): ${res.error}`, 'diag-fail');
        }
      });

      writeLog('--------------------------------------------------', 'diag-log-line');
      writeLog(`Test Run Complete. Passed: ${report.passed}/${report.total} tests.`, 'diag-log-line');
      
      if (report.failed === 0) {
        writeLog('SYSTEM HEALTH CHECK: EXCELLENT. All security sanitizers, state containers, and algorithms are verified healthy.', 'diag-pass');
        window.Security.AuditLogger.log('RUN_DIAGNOSTICS', 'Diagnostic System', 'SUCCESS', `Executed ${report.total} unit tests. All passed.`);
      } else {
        writeLog('SYSTEM HEALTH CHECK: WARNING. One or more assertions failed. Check details in the console above.', 'diag-fail');
        window.Security.AuditLogger.log('RUN_DIAGNOSTICS', 'Diagnostic System', 'FAILURE', `Executed ${report.total} unit tests. Failed: ${report.failed}`);
      }
    }, 800);
  }
}

// Instantiate and bind to window
const AppController = new ArenaFlowController();
window.AppController = AppController;

// Initialize app when DOM content is loaded
document.addEventListener('DOMContentLoaded', () => {
  AppController.init();
});
