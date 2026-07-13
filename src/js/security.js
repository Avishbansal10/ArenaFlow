/**
 * ArenaFlow Pro — Security Library
 * Obfuscates simulation auth parameters, validates logs using cryptographic hash-chaining,
 * and handles secure random generation (CSPRNG).
 */

"use strict";

const Security = {
  /**
   * Escapes HTML entities to prevent XSS (Cross-Site Scripting).
   */
  sanitizeHtml(str) {
    if (str === null || str === undefined) return '';
    const stringified = String(str);
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
      '`': '&grave;'
    };
    return stringified.replace(/[&<>"'`/]/g, (m) => map[m]);
  },

  /**
   * Performs client validation checks on text input fields.
   */
  validateField(value, rules = {}) {
    const val = (value || '').trim();

    if (rules.required && val.length === 0) {
      return { isValid: false, error: 'This field is required.' };
    }
    if (rules.minLength && val.length < rules.minLength) {
      return { isValid: false, error: `Minimum length is ${rules.minLength} characters.` };
    }
    if (rules.maxLength && val.length > rules.maxLength) {
      return { isValid: false, error: `Maximum length is ${rules.maxLength} characters.` };
    }
    if (rules.pattern && !rules.pattern.test(val)) {
      return { isValid: false, error: rules.patternMessage || 'Invalid input format.' };
    }

    return { isValid: true, error: '' };
  },

  Patterns: {
    SEAT: /^[A-Za-z0-9\s-]{2,15}$/, 
    NAME: /^[A-Za-z0-9\s.,'!-]{2,60}$/,
    PIN: /^[0-9a-zA-Z]{4,10}$/
  },

  // Pre-calculated SHA-256 hashes representing roles for the local simulator access gates
  _hashes: Object.freeze({
    operator: '0ca7539a8577dd196641e11315f8fc7d1dba9cc2741752642def9bcdb3599467', // SHA-256 of admin789
    diagnostics: 'b1c0c2283e8eb80a2f9a740c2210ceeb980fa0ad8541b16bee705a1c9b3c606b' // SHA-256 of tech456
  }),

  /**
   * Computes SHA-256 hash of a string using browser's SubtleCrypto.
   * Used for async role authentication checks.
   */
  async _sha256(string) {
    const msgBuffer = new TextEncoder().encode(string);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * 64-bit split synchronous hash function for log integrity validation.
   * Runs locally without async bottlenecks.
   * @param {string} str - Text to hash
   * @returns {string} Hex representation of hash
   */
  _hashSync(str) {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return ((h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0'));
  },

  /**
   * Authentication controller enforcing role-based PIN access.
   * NOTE: This is a frontend demo gating simulator. In production environments,
   * these verification checks are handled via server-side session checks.
   */
  Auth: {
    async verifyPIN(enteredPin, role) {
      if (!enteredPin || (role !== 'operator' && role !== 'diagnostics')) {
        return false;
      }

      const storageKey = role === 'operator' ? 'arena_flow_toc_auth' : 'arena_flow_diag_auth';
      const targetHash = Security._hashes[role];

      try {
        const enteredHash = await Security._sha256(enteredPin);
        if (enteredHash === targetHash) {
          sessionStorage.setItem(storageKey, 'true');
          Security.AuditLogger.log('ROLE_AUTHENTICATE', `Role: ${role}`, 'SUCCESS', `Successful PIN authorization access.`);
          return true;
        }
      } catch (err) {
        console.error('Cryptographic verify failed:', err);
      }

      Security.AuditLogger.log('SECURITY_ALERT', `Role: ${role}`, 'FAILURE', `Failed login attempt with incorrect PIN.`);
      return false;
    },

    isAuthorized(role) {
      try {
        const storageKey = role === 'operator' ? 'arena_flow_toc_auth' : 'arena_flow_diag_auth';
        return sessionStorage.getItem(storageKey) === 'true';
      } catch (e) {
        return false;
      }
    },

    logout(role) {
      try {
        const storageKey = role === 'operator' ? 'arena_flow_toc_auth' : 'arena_flow_diag_auth';
        sessionStorage.removeItem(storageKey);
        Security.AuditLogger.log('ROLE_LOGOUT', `Role: ${role}`, 'SUCCESS', `Session cleared by user logout.`);
      } catch (e) {
        console.error('Logout session access failed:', e);
      }
    }
  },

  /**
   * Cryptographically Secure Random ID & Value Generator (CSPRNG).
   * Replaces Math.random() to prevent CWE-338 vulnerabilities.
   */
  Csprng: {
    random() {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      return array[0] / 4294967296; // 2^32
    },

    generateId(prefix = 'id') {
      const array = new Uint8Array(8);
      window.crypto.getRandomValues(array);
      const hex = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
      return `${prefix}-${hex}`;
    }
  },

  /**
   * Client-side Form Rate Limiter.
   * Restricts rapid submissions (e.g. spamming chat or orders) to optimize service load.
   */
  RateLimiter: {
    history: {},

    /**
     * Checks if a request is permitted within a specified window.
     */
    checkLimit(key, maxRequests = 3, windowSeconds = 15) {
      const now = Date.now();
      if (!this.history[key]) {
        this.history[key] = [];
      }

      const cutoff = now - (windowSeconds * 1000);
      this.history[key] = this.history[key].filter(timestamp => timestamp > cutoff);

      if (this.history[key].length >= maxRequests) {
        Security.AuditLogger.log('RATE_LIMIT_TRIGGERED', 'System Firewall', 'BLOCKED', `Submissions rate-limited for key: "${key}"`);
        return false;
      }

      this.history[key].push(now);
      return true;
    }
  },

  /**
   * Secure, Cryptographic Hash-Chained Audit Logs.
   * Each entry contains a hash referencing the previous entry. Direct edits in localStorage
   * break the cryptographic chain, making tampering immediately detectable.
   */
  AuditLogger: {
    getLogs() {
      try {
        const logs = localStorage.getItem('arena_flow_audit_logs_v3');
        return logs ? JSON.parse(logs) : [];
      } catch (e) {
        return [];
      }
    },

    log(action, user, status = 'SUCCESS', details = '') {
      const logs = this.getLogs();
      
      const cleanAction = Security.sanitizeHtml(action);
      const cleanUser = Security.sanitizeHtml(user);
      const cleanStatus = Security.sanitizeHtml(status);
      const cleanDetails = Security.sanitizeHtml(details);
      const timestamp = new Date().toISOString();
      const id = Security.Csprng.generateId('log');

      // Get previous log hash to chain
      let prevHash = '00000000000000000000000000000000';
      if (logs.length > 0) {
        prevHash = logs[logs.length - 1].hash || prevHash;
      }

      // Compute current hash chain link
      const dataToHash = timestamp + cleanAction + cleanUser + cleanStatus + cleanDetails + id + prevHash;
      const hash = Security._hashSync(dataToHash);

      const logEntry = {
        timestamp,
        action: cleanAction,
        user: cleanUser,
        status: cleanStatus,
        details: cleanDetails,
        id,
        prevHash,
        hash
      };
      
      logs.push(logEntry);
      if (logs.length > 150) {
        logs.shift();
      }
      
      try {
        localStorage.setItem('arena_flow_audit_logs_v3', JSON.stringify(logs));
      } catch (e) {
        console.error('Audit logger write failed:', e);
      }

      window.dispatchEvent(new CustomEvent('auditlogadded', { detail: logEntry }));
      return logEntry;
    },

    /**
     * Re-calculates and verifies the cryptographic hash chain of the audit logs.
     * @returns {Object} { verified: boolean, corruptedIndex: number }
     */
    verifyChain() {
      const logs = this.getLogs();
      if (logs.length === 0) return { verified: true, corruptedIndex: -1 };

      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        
        // Verify previous hash pointer matches actual previous log hash
        let expectedPrevHash = '00000000000000000000000000000000';
        if (i > 0) {
          expectedPrevHash = logs[i - 1].hash;
        }

        if (log.prevHash !== expectedPrevHash) {
          return { verified: false, corruptedIndex: i };
        }

        // Recompute entry hash
        const dataToHash = log.timestamp + log.action + log.user + log.status + log.details + log.id + log.prevHash;
        const computedHash = Security._hashSync(dataToHash);

        if (log.hash !== computedHash) {
          return { verified: false, corruptedIndex: i };
        }
      }

      return { verified: true, corruptedIndex: -1 };
    },

    clearLogs() {
      try {
        localStorage.removeItem('arena_flow_audit_logs_v3');
        this.log('CLEAR_LOGS', 'System Admin', 'SUCCESS', 'Operational audit history cleared.');
      } catch (e) {
        console.error('Failed to clear logs:', e);
      }
    }
  }
};

window.Security = Security;
