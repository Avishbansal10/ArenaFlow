/**
 * ArenaFlow Pro — Diagnostics & Automated Unit Tests
 * Verifies NLU query parsers, Dijkstra hazard rerouting, PIN authenticators, and form rate limiters.
 */

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

    'Security.Auth verifies valid/invalid role PINs': function() {
      // Clean previous session state
      sessionStorage.removeItem('arena_flow_toc_auth');
      
      // Test invalid PIN
      const fail = window.Security.Auth.verifyPIN('wrong123', 'operator');
      TestSuite.assertEqual(fail, false, 'Invalid PIN should return false');
      TestSuite.assertEqual(window.Security.Auth.isAuthorized('operator'), false, 'Should not be authorized');

      // Test valid PIN
      const pass = window.Security.Auth.verifyPIN('admin789', 'operator');
      TestSuite.assertEqual(pass, true, 'Valid PIN should return true');
      TestSuite.assertEqual(window.Security.Auth.isAuthorized('operator'), true, 'Should now be authorized');
      
      // Logout
      window.Security.Auth.logout('operator');
      TestSuite.assertEqual(window.Security.Auth.isAuthorized('operator'), false, 'Should be unauthorized after logout');
    },

    'Security.RateLimiter blocks flood submissions': function() {
      // Clear limiter history
      window.Security.RateLimiter.history['test_key'] = [];

      // Submit 3 times (should pass)
      TestSuite.assertEqual(window.Security.RateLimiter.checkLimit('test_key', 3, 5), true);
      TestSuite.assertEqual(window.Security.RateLimiter.checkLimit('test_key', 3, 5), true);
      TestSuite.assertEqual(window.Security.RateLimiter.checkLimit('test_key', 3, 5), true);

      // 4th time should be rate-limited (blocked)
      TestSuite.assertEqual(window.Security.RateLimiter.checkLimit('test_key', 3, 5), false, '4th consecutive call must be blocked');
    },

    // --- State Tests ---
    'Store.init boots up state and config': function() {
      window.Store.init();
      TestSuite.assert(window.Store.state !== null, 'State should load');
      TestSuite.assertEqual(window.STADIUM_CONFIG.tournament, 'FIFA World Cup 2026', 'Preset config should match');
    },

    'Store.reportIncident blocks node in Router': function() {
      window.Store.init();
      
      // Report incident at Stairwell-3
      const inc = window.Store.reportIncident(
        'Spill', 
        'Stairwell-3', 
        'Soda spill reported', 
        'High'
      );
      
      TestSuite.assert(window.Router.blockedNodes.has('Stairwell-3'), 'Stairwell-3 node should be blocked in router');

      // Resolve it
      window.Store.resolveIncident(inc.id);
      TestSuite.assert(!window.Router.blockedNodes.has('Stairwell-3'), 'Stairwell-3 should be unblocked after resolution');
    },

    // --- Dijkstra Hazard Rerouting Tests ---
    'Dijkstra pathfinder routes around blocked nodes': function() {
      // Clean blocks
      window.Router.blockedNodes.clear();

      // standard path from Block 102 to Gate A
      const stdRoute = window.Router.findShortestPath('Block-102', 'Gate-A', false);
      TestSuite.assert(stdRoute.path.includes('Stairwell-3'), 'Standard path should naturally route through Stairwell-3');

      // Block Stairwell-3 (due to hazard)
      window.Router.blockedNodes.add('Stairwell-3');

      // Recalculate path
      const newRoute = window.Router.findShortestPath('Block-102', 'Gate-A', false);
      TestSuite.assert(!newRoute.path.includes('Stairwell-3'), 'Recalculated path must avoid Stairwell-3');
      TestSuite.assert(newRoute.path.includes('Elevator-East'), 'Path should reroute through Elevator-East');
      TestSuite.assertEqual(newRoute.rerouted, true, 'Rerouted flag should be true');

      // Reset
      window.Router.blockedNodes.clear();
    },

    // --- Aura AI NLU chatbot Tests ---
    'AuraAI chatbot parses pathfinding query': function() {
      const textQuery = 'how do I get from Block 102 to Gate C';
      const reply = AuraAI.processFanQuery(textQuery);
      
      TestSuite.assert(reply.includes('Calculated navigation route'), 'Should parse as pathfinding command');
      TestSuite.assert(reply.includes('Block-102'), 'Path start should match block input');
    },

    'AuraAI chatbot parses concession orders': function() {
      const textQuery = 'order a burger to Block 104';
      const beforeCount = window.Store.state.concessions.length;
      
      const reply = AuraAI.processFanQuery(textQuery);
      TestSuite.assert(reply.includes('Order placed successfully'), 'Should place concession order');
      TestSuite.assertEqual(window.Store.state.concessions.length, beforeCount + 1, 'Store concessions count should grow');
    }
  },

  run() {
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
        testFn();
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
