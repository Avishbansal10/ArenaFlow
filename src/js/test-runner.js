/**
 * ArenaFlow Pro — Diagnostics & Automated Unit Tests
 * Verifies NLU query parsers, Dijkstra hazard rerouting, PIN authenticators, and form rate limiters.
 */

"use strict";

const TestSuite = {
  assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  },

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected: "${expected}", but got: "${actual}"`);
    }
  },

  tests: {
    // --- Security Tests ---
    'Security.sanitizeHtml escapes dangerous tags': function() {
      const input = '<script src="malicious.js">evil()</script>';
      const expected = '&lt;script src=&quot;malicious.js&quot;&gt;evil()&lt;&#x2F;script&gt;';
      const actual = window.Security.sanitizeHtml(input);
      TestSuite.assertEqual(actual, expected, 'Should sanitize script tags completely');
    },

    'Security.Auth verifies valid/invalid role PINs': async function() {
      sessionStorage.removeItem('arena_flow_toc_auth');
      
      const fail = await window.Security.Auth.verifyPIN('wrong123', 'operator');
      TestSuite.assertEqual(fail, false, 'Invalid PIN should return false');
      TestSuite.assertEqual(window.Security.Auth.isAuthorized('operator'), false, 'Should not be authorized');

      const pass = await window.Security.Auth.verifyPIN('admin789', 'operator');
      TestSuite.assertEqual(pass, true, 'Valid PIN should return true');
      TestSuite.assertEqual(window.Security.Auth.isAuthorized('operator'), true, 'Should now be authorized');
      
      window.Security.Auth.logout('operator');
      TestSuite.assertEqual(window.Security.Auth.isAuthorized('operator'), false, 'Should be unauthorized after logout');
    },

    'Security.RateLimiter blocks flood submissions': function() {
      window.Security.RateLimiter.history['test_key'] = [];

      TestSuite.assertEqual(window.Security.RateLimiter.checkLimit('test_key', 3, 5), true);
      TestSuite.assertEqual(window.Security.RateLimiter.checkLimit('test_key', 3, 5), true);
      TestSuite.assertEqual(window.Security.RateLimiter.checkLimit('test_key', 3, 5), true);

      TestSuite.assertEqual(window.Security.RateLimiter.checkLimit('test_key', 3, 5), false, '4th consecutive call must be blocked');
    },

    'Security.Csprng generates secure random IDs': function() {
      const id1 = window.Security.Csprng.generateId('test');
      const id2 = window.Security.Csprng.generateId('test');
      TestSuite.assert(id1.startsWith('test-'), 'ID should start with prefix');
      TestSuite.assert(id1 !== id2, 'Two secure random IDs should not be equal');
    },

    'Security.AuditLogger hash chain verifies integrity and detects tampering': function() {
      // Clean start
      const originalLogsJson = localStorage.getItem('arena_flow_audit_logs_v3');
      localStorage.removeItem('arena_flow_audit_logs_v3');
      
      // Log some entries
      window.Security.AuditLogger.log('TEST_EVENT_1', 'Tester', 'SUCCESS', 'Check 1');
      window.Security.AuditLogger.log('TEST_EVENT_2', 'Tester', 'SUCCESS', 'Check 2');

      // Verify chain is valid
      const checkValid = window.Security.AuditLogger.verifyChain();
      TestSuite.assertEqual(checkValid.verified, true, 'Cryptographic hash chain should initially be fully verified');

      // Tamper with the log data in localStorage
      const logs = window.Security.AuditLogger.getLogs();
      logs[0].details = 'Tampered Check 1'; // alter content
      localStorage.setItem('arena_flow_audit_logs_v3', JSON.stringify(logs));

      // Verify chain detects tampering
      const checkTampered = window.Security.AuditLogger.verifyChain();
      TestSuite.assertEqual(checkTampered.verified, false, 'Tampering with details should break the hash-chain validation');

      // Restore
      if (originalLogsJson) {
        localStorage.setItem('arena_flow_audit_logs_v3', originalLogsJson);
      } else {
        localStorage.removeItem('arena_flow_audit_logs_v3');
      }
    },

    // --- State Tests ---
    'Store.init boots up state and config': function() {
      window.Store.init();
      TestSuite.assert(window.Store.state !== null, 'State should load');
      TestSuite.assertEqual(window.STADIUM_CONFIG.tournament, 'FIFA World Cup 2026', 'Preset config should match');
    },

    'Store.reportIncident blocks node in Router': function() {
      window.Store.init();
      
      const inc = window.Store.reportIncident(
        'Spill', 
        'Stairwell-3', 
        'Soda spill reported', 
        'High'
      );
      
      TestSuite.assert(window.Router.blockedNodes.has('Stairwell-3'), 'Stairwell-3 node should be blocked in router');

      window.Store.resolveIncident(inc.id);
      TestSuite.assert(!window.Router.blockedNodes.has('Stairwell-3'), 'Stairwell-3 should be unblocked after resolution');
    },

    // --- Dijkstra Hazard Rerouting Tests ---
    'Dijkstra pathfinder routes around blocked nodes': function() {
      window.Router.blockedNodes.clear();

      const stdRoute = window.Router.findShortestPath('Block-102', 'Gate-A', false);
      TestSuite.assert(stdRoute.path.includes('Stairwell-3'), 'Standard path should naturally route through Stairwell-3');

      window.Router.blockedNodes.add('Stairwell-3');

      const newRoute = window.Router.findShortestPath('Block-102', 'Gate-A', false);
      TestSuite.assert(!newRoute.path.includes('Stairwell-3'), 'Recalculated path must avoid Stairwell-3');
      TestSuite.assert(newRoute.path.includes('Elevator-East'), 'Path should reroute through Elevator-East');
      TestSuite.assertEqual(newRoute.rerouted, true, 'Rerouted flag should be true');

      window.Router.blockedNodes.clear();
    },

    // --- Aura AI NLU chatbot Tests ---
    'AuraAI chatbot parses pathfinding query': async function() {
      const textQuery = 'how do I get from Block 102 to Gate C';
      const reply = await AuraAI.processFanQuery(textQuery);
      
      TestSuite.assert(reply.includes('Calculated navigation route'), 'Should parse as pathfinding command');
      TestSuite.assert(reply.includes('Block-102'), 'Path start should match block input');
    },

    'AuraAI chatbot parses concession orders': async function() {
      const textQuery = 'order a burger to Block 104';
      const beforeCount = window.Store.state.concessions.length;
      
      const reply = await AuraAI.processFanQuery(textQuery);
      TestSuite.assert(reply.includes('Order placed successfully'), 'Should place concession order');
      TestSuite.assertEqual(window.Store.state.concessions.length, beforeCount + 1, 'Store concessions count should grow');
    },

    'AuraAI chatbot parses translation query': async function() {
      const textQuery = 'translate announcements to Spanish';
      const reply = await AuraAI.processFanQuery(textQuery);
      TestSuite.assert(reply.includes('Anuncios del estadio traducidos al español'), 'Should confirm translation to Spanish');
    }
  },

  async run() {
    const report = {
      total: 0,
      passed: 0,
      failed: 0,
      results: []
    };

    for (const [testName, testFn] of Object.entries(this.tests)) {
      report.total++;
      const startTime = performance.now();
      try {
        await testFn();
        const duration = (performance.now() - startTime).toFixed(2);
        report.passed++;
        report.results.push({
          name: testName,
          success: true,
          durationMs: duration
        });
      } catch (err) {
        const duration = (performance.now() - startTime).toFixed(2);
        report.failed++;
        report.results.push({
          name: testName,
          success: false,
          error: err.message,
          durationMs: duration
        });
      }
    }
    return report;
  }
};

window.TestSuite = TestSuite;
