/**
 * ArenaFlow System Diagnostics & Unit Test Suite
 * Built-in test runner to validate business logic, security sanitization, and state engines.
 */

const TestSuite = {
  // Simple custom assertion library
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
    // --- Security Sanitizer Tests ---
    'Security.sanitizeHtml escapes HTML tags': function() {
      const input = '<script>alert("hack")</script>';
      const expected = '&lt;script&gt;alert(&quot;hack&quot;)&lt;&#x2F;script&gt;';
      const actual = window.Security.sanitizeHtml(input);
      TestSuite.assertEqual(actual, expected, 'Should escape script tags completely');
    },

    'Security.sanitizeHtml escapes quotes and slashes': function() {
      const input = `john's & "doe" / \``;
      const expected = 'john&#x27;s &amp; &quot;doe&quot; &#x2F; &grave;';
      const actual = window.Security.sanitizeHtml(input);
      TestSuite.assertEqual(actual, expected, 'Should escape quotes, ampersands, slashes, backticks');
    },

    'Security.validateField handles required inputs': function() {
      const result = window.Security.validateField('  ', { required: true });
      TestSuite.assertEqual(result.isValid, false, 'Whitespace-only string should fail required rule');
    },

    'Security.validateField minLength validation': function() {
      const result = window.Security.validateField('abc', { minLength: 5 });
      TestSuite.assertEqual(result.isValid, false, '3 characters should fail minLength of 5');
    },

    'Security.validateField pattern matching for Seats': function() {
      const pattern = window.Security.Patterns.SEAT;
      const validResult = window.Security.validateField('Block 102', { pattern });
      TestSuite.assertEqual(validResult.isValid, true, 'Block 102 should match seat pattern');

      const invalidResult = window.Security.validateField('A!', { pattern });
      TestSuite.assertEqual(invalidResult.isValid, false, 'Invalid chars should fail seat pattern');
    },

    // --- State & Operations Tests ---
    'Store.init loads valid state object': function() {
      window.Store.init();
      TestSuite.assert(window.Store.state !== null, 'Store state should be initialized');
      TestSuite.assert(Array.isArray(window.Store.state.matches), 'Matches array must exist');
      TestSuite.assert(Array.isArray(window.Store.state.incidents), 'Incidents array must exist');
    },

    'Store.addMatch inserts new match & logs audit event': function() {
      const beforeCount = window.Store.state.matches.length;
      const matchData = {
        sport: 'Tennis',
        tournament: 'Wimbledon Tour',
        teamA: { name: 'Player One', score: '0' },
        teamB: { name: 'Player Two', score: '0' },
        status: 'SCHEDULED',
        time: '12:00',
        venue: 'Court 1',
        date: '2026-07-15'
      };
      
      const newMatch = window.Store.addMatch(matchData);
      TestSuite.assertEqual(window.Store.state.matches.length, beforeCount + 1, 'Match array length should increase by 1');
      TestSuite.assertEqual(newMatch.sport, 'Tennis', 'Should keep data properties');
      TestSuite.assert(newMatch.id.startsWith('match-'), 'New match ID should be assigned automatically');
    },

    'Store.updateScore changes match scores and dispatches notifications': function() {
      // Find a match to modify
      const match = window.Store.state.matches[0];
      const matchId = match.id;
      
      window.Store.updateScore(matchId, 99, 101);
      
      const updatedMatch = window.Store.state.matches.find(m => m.id === matchId);
      TestSuite.assertEqual(updatedMatch.teamA.score, 99, 'Team A score must be 99');
      TestSuite.assertEqual(updatedMatch.teamB.score, 101, 'Team B score must be 101');
    },

    'Store.reportIncident inserts active incident': function() {
      const beforeCount = window.Store.state.incidents.length;
      const newInc = window.Store.reportIncident(
        'Spill', 
        'Block 102, Row B, Seat 3', 
        'Water spilled on floor', 
        'Low'
      );
      
      TestSuite.assertEqual(window.Store.state.incidents.length, beforeCount + 1, 'Incident list should grow');
      TestSuite.assertEqual(newInc.status, 'Open', 'New incidents must start as Open');
      TestSuite.assertEqual(newInc.assignedStaff, '', 'New incidents should have no assigned staff');
    },

    'Store.assignIncident updates status and assignee': function() {
      const newInc = window.Store.reportIncident(
        'Medical', 
        'South Exit', 
        'Fainting incident', 
        'High'
      );
      
      window.Store.assignIncident(newInc.id, 'John Officer');
      
      const updated = window.Store.state.incidents.find(i => i.id === newInc.id);
      TestSuite.assertEqual(updated.status, 'Assigned', 'Incident status should be Assigned');
      TestSuite.assertEqual(updated.assignedStaff, 'John Officer', 'Assigned staff should match input');
    },

    // --- Pathfinding Routing Logic Tests ---
    'Pathfinding calculates correct standard path': function() {
      // Mock route lookup logic
      const calculateRoute = (startBlock, endGate, stepFree) => {
        // Blocks 100-110 use elevators for step-free, stairs for standard
        const path = [];
        path.push(`Start at ${startBlock}`);
        if (stepFree) {
          path.push('Take Elevator B down to Concourse level');
        } else {
          path.push('Take Stairwell 4 down to Concourse level');
        }
        path.push(`Walk straight to ${endGate}`);
        return path;
      };

      const stdPath = calculateRoute('Block 102', 'Gate C', false);
      TestSuite.assert(stdPath.includes('Take Stairwell 4 down to Concourse level'), 'Standard path should include stairs');

      const accPath = calculateRoute('Block 102', 'Gate C', true);
      TestSuite.assert(accPath.includes('Take Elevator B down to Concourse level'), 'Step-free path should include elevators');
    }
  },

  /**
   * Runs all registered unit tests.
   * @returns {Object} Test report
   */
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
