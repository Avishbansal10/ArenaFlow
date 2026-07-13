/**
 * ArenaFlow Pro — Routing & Graph Pathfinder
 * Handles seat-to-gate pathfinding with dynamic node blocking (hazard rerouting).
 */

"use strict";

const Router = {
  // Seating blocks, access tunnels, lifts, and exits
  GraphData: {
    nodes: [
      { id: 'Block-102', label: 'Seat Area Block 102', type: 'block' },
      { id: 'Block-104', label: 'Seat Area Block 104', type: 'block' },
      { id: 'Block-212', label: 'Seat Area Block 212 (Upper Tier)', type: 'block' },
      { id: 'Stairwell-3', label: 'Stairwell 3 (High-steep stairs)', type: 'stairs' },
      { id: 'Stairwell-4', label: 'Stairwell 4 (Stairs)', type: 'stairs' },
      { id: 'Elevator-East', label: 'Elevator East (Step-Free Lift)', type: 'elevator' },
      { id: 'Elevator-West', label: 'Elevator West (Step-Free Lift)', type: 'elevator' },
      { id: 'Main-Concourse-North', label: 'Main Concourse North level', type: 'concourse' },
      { id: 'Main-Concourse-South', label: 'Main Concourse South level', type: 'concourse' },
      { id: 'Gate-A', label: 'Gate A (North Entrance)', type: 'gate' },
      { id: 'Gate-B', label: 'Gate B (South Entrance)', type: 'gate' },
      { id: 'Gate-C', label: 'Gate C (East Entrance)', type: 'gate' },
      { id: 'Gate-D', label: 'Gate D (West Entrance)', type: 'gate' }
    ],
    edges: [
      // Block 102 connects to Stairwell 3 and Elevator East
      { from: 'Block-102', to: 'Stairwell-3', weight: 2, accessible: false },
      { from: 'Block-102', to: 'Elevator-East', weight: 5, accessible: true }, 
      
      // Block 104 connects to Stairwell 4 and Elevator West
      { from: 'Block-104', to: 'Stairwell-4', weight: 2, accessible: false },
      { from: 'Block-104', to: 'Elevator-West', weight: 4, accessible: true },
      
      // Block 212 connects to Stairwell 4 and Elevator West
      { from: 'Block-212', to: 'Stairwell-4', weight: 3, accessible: false },
      { from: 'Block-212', to: 'Elevator-West', weight: 6, accessible: true },

      // Connectors down to concourses
      { from: 'Stairwell-3', to: 'Main-Concourse-North', weight: 3, accessible: false },
      { from: 'Elevator-East', to: 'Main-Concourse-North', weight: 2, accessible: true },
      { from: 'Stairwell-4', to: 'Main-Concourse-South', weight: 3, accessible: false },
      { from: 'Elevator-West', to: 'Main-Concourse-South', weight: 2, accessible: true },

      // Concourses to outer gates
      { from: 'Main-Concourse-North', to: 'Gate-A', weight: 2, accessible: true },
      { from: 'Main-Concourse-North', to: 'Gate-C', weight: 4, accessible: true },
      { from: 'Main-Concourse-South', to: 'Gate-B', weight: 2, accessible: true },
      { from: 'Main-Concourse-South', to: 'Gate-D', weight: 5, accessible: true },

      // Inter-concourse fallback connector
      { from: 'Main-Concourse-North', to: 'Main-Concourse-South', weight: 8, accessible: true }
    ]
  },

  // Dynamic set of currently blocked nodes (e.g. spilled zones, medical emergency blocks)
  blockedNodes: new Set(),

  /**
   * Scans active store incidents and locks/blocks corresponding nodes.
   * @param {Array} incidents - List of incidents from State.
   */
  updateBlockedNodes(incidents) {
    this.blockedNodes.clear();
    
    // Audit active incidents
    for (const inc of incidents) {
      if (inc.status !== 'Resolved' && (inc.severity === 'Medium' || inc.severity === 'High')) {
        // Match incident location to graph node IDs (e.g., "Stairwell-3" or "Block-104")
        const matchingNode = this.GraphData.nodes.find(
          n => n.id.toLowerCase() === inc.location.toLowerCase() ||
               n.label.toLowerCase().includes(inc.location.toLowerCase())
        );
        if (matchingNode) {
          this.blockedNodes.add(matchingNode.id);
          console.warn(`[ROUTER] Node blocked due to active hazard: ${matchingNode.id}`);
        }
      }
    }
  },

  /**
   * Dijkstra Single-Source Shortest Path.
   * Routes around active hazards (blockedNodes) and filters by accessibility constraints.
   */
  findShortestPath(startNodeId, targetNodeId, accessibleOnly = false) {
    const nodes = this.GraphData.nodes.map(n => n.id);
    
    const distances = {};
    const previous = {};
    const remaining = new Set(nodes);
    
    for (const node of nodes) {
      distances[node] = Infinity;
      previous[node] = null;
    }
    distances[startNodeId] = 0;

    // Build Adjacency Matrix
    const adjList = {};
    for (const node of nodes) {
      adjList[node] = [];
    }
    
    for (const edge of this.GraphData.edges) {
      if (accessibleOnly && !edge.accessible) {
        continue; // Filter stairs in step-free mode
      }
      
      // If either node is blocked, we cannot traverse this edge
      if (this.blockedNodes.has(edge.from) || this.blockedNodes.has(edge.to)) {
        continue; // Reroute around active security/maintenance hazard
      }

      adjList[edge.from].push({ node: edge.to, weight: edge.weight });
      adjList[edge.to].push({ node: edge.from, weight: edge.weight });
    }

    while (remaining.size > 0) {
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
        break; // Target node reached
      }

      remaining.delete(minNode);

      for (const neighbor of adjList[minNode]) {
        if (!remaining.has(neighbor.node)) continue;
        
        const alt = distances[minNode] + neighbor.weight;
        if (alt < distances[neighbor.node]) {
          distances[neighbor.node] = alt;
          previous[neighbor.node] = minNode;
        }
      }
    }

    // Reconstruct path array
    const path = [];
    let current = targetNodeId;
    while (current !== null) {
      path.unshift(current);
      current = previous[current];
    }

    if (path[0] !== startNodeId) {
      return { path: [], distance: Infinity, rerouted: false };
    }

    // Determine if we had to reroute (i.e. did standard shortest path differ from this one?)
    // Standard checks standard path ignoring hazard blocks
    const standardRoute = this.findStandardShortestPath(startNodeId, targetNodeId, accessibleOnly);
    const rerouted = standardRoute.path.join(',') !== path.join(',');

    return { path, distance: distances[targetNodeId], rerouted };
  },

  /**
   * Helper to compute standard route (ignores hazard blocks) for comparison metrics.
   */
  findStandardShortestPath(startNodeId, targetNodeId, accessibleOnly) {
    const nodes = this.GraphData.nodes.map(n => n.id);
    const distances = {};
    const previous = {};
    const remaining = new Set(nodes);
    
    for (const node of nodes) {
      distances[node] = Infinity;
      previous[node] = null;
    }
    distances[startNodeId] = 0;

    const adjList = {};
    for (const node of nodes) adjList[node] = [];
    
    for (const edge of this.GraphData.edges) {
      if (accessibleOnly && !edge.accessible) continue;
      adjList[edge.from].push({ node: edge.to, weight: edge.weight });
      adjList[edge.to].push({ node: edge.from, weight: edge.weight });
    }

    while (remaining.size > 0) {
      let minNode = null;
      for (const node of remaining) {
        if (minNode === null || distances[node] < distances[minNode]) minNode = node;
      }
      if (minNode === null || distances[minNode] === Infinity) break;
      if (minNode === targetNodeId) break;
      remaining.delete(minNode);
      for (const neighbor of adjList[minNode]) {
        if (!remaining.has(neighbor.node)) continue;
        const alt = distances[minNode] + neighbor.weight;
        if (alt < distances[neighbor.node]) {
          distances[neighbor.node] = alt;
          previous[neighbor.node] = minNode;
        }
      }
    }

    const path = [];
    let current = targetNodeId;
    while (current !== null) {
      path.unshift(current);
      current = previous[current];
    }
    return { path };
  },

  /**
   * Translates path nodes to navigation instructions list.
   */
  generateInstructions(path) {
    if (path.length === 0) {
      return [{ 
        node: 'Error', 
        action: "No safe path available. Active hazard blocks your route. Please request manual usher assistance." 
      }];
    }

    const steps = [];
    for (let i = 0; i < path.length; i++) {
      const node = this.GraphData.nodes.find(n => n.id === path[i]);
      if (i === 0) {
        steps.push({ node: node.id, action: `Depart from seating area: ${node.label}` });
      } else {
        const prevNode = this.GraphData.nodes.find(n => n.id === path[i-1]);
        let verb = "Walk towards";
        if (node.type === 'stairs') {
          verb = "Descend stairs via";
        } else if (node.type === 'elevator') {
          verb = "Take the accessibility lift at";
        } else if (node.type === 'gate') {
          verb = "Exit through terminal";
        }
        steps.push({ node: node.id, action: `${verb} ${node.label}` });
      }
    }
    return steps;
  }
};

window.Router = Router;
