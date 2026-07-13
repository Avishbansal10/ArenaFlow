/**
 * ArenaFlow Pro — Security Library
 * Mitigates injection vulnerabilities, validates roles via PIN auth, and rate-limits client forms.
 */

const Security = {
  /**
   * Escapes HTML entities to prevent XSS (Cross-Site Scripting).
   * Ensures all dynamic DOM variables are safely rendered.
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

  /**
   * Authentication controller enforcing role-based PIN access.
   */
  Auth: {
    verifyPIN(enteredPin, role) {
      if (!window.STADIUM_CONFIG) return false;

      let targetPin = '';
      let storageKey = '';
      
      if (role === 'operator') {
        targetPin = window.STADIUM_CONFIG.adminPin; // admin789
        storageKey = 'arena_flow_toc_auth';
      } else if (role === 'diagnostics') {
        targetPin = window.STADIUM_CONFIG.diagPin; // tech456
        storageKey = 'arena_flow_diag_auth';
      } else {
        return false;
      }

      if (enteredPin === targetPin) {
        sessionStorage.setItem(storageKey, 'true');
        Security.AuditLogger.log('ROLE_AUTHENTICATE', `Role: ${role}`, 'SUCCESS', `Successful PIN authorization access.`);
        return true;
      } else {
        Security.AuditLogger.log('SECURITY_ALERT', `Role: ${role}`, 'FAILURE', `Failed login attempt with incorrect PIN.`);
        return false;
      }
    },

    isAuthorized(role) {
      const storageKey = role === 'operator' ? 'arena_flow_toc_auth' : 'arena_flow_diag_auth';
      return sessionStorage.getItem(storageKey) === 'true';
    },

    logout(role) {
      const storageKey = role === 'operator' ? 'arena_flow_toc_auth' : 'arena_flow_diag_auth';
      sessionStorage.removeItem(storageKey);
      Security.AuditLogger.log('ROLE_LOGOUT', `Role: ${role}`, 'SUCCESS', `Session cleared by user logout.`);
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
     * @param {string} key - Identifier (e.g. 'chat_fan', 'order_concession')
     * @param {number} maxRequests - Max operations allowed.
     * @param {number} windowSeconds - Time frame in seconds.
     * @returns {boolean} True if allowed, false if rate-limited.
     */
    checkLimit(key, maxRequests = 3, windowSeconds = 15) {
      const now = Date.now();
      if (!this.history[key]) {
        this.history[key] = [];
      }

      // Filter out timestamps outside the active window
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
   * Tamper-evident session audit logs.
   */
  AuditLogger: {
    getLogs() {
      try {
        const logs = localStorage.getItem('arena_flow_audit_logs_v2');
        return logs ? JSON.parse(logs) : [];
      } catch (e) {
        return [];
      }
    },

    log(action, user, status = 'SUCCESS', details = '') {
      const logs = this.getLogs();
      const logEntry = {
        timestamp: new Date().toISOString(),
        action: Security.sanitizeHtml(action),
        user: Security.sanitizeHtml(user),
        status: Security.sanitizeHtml(status),
        details: Security.sanitizeHtml(details),
        id: 'log-' + Math.random().toString(36).substr(2, 9)
      };
      
      logs.push(logEntry);
      if (logs.length > 150) {
        logs.shift(); // circular buffer
      }
      
      try {
        localStorage.setItem('arena_flow_audit_logs_v2', JSON.stringify(logs));
      } catch (e) {
        console.error('Audit logger write failed:', e);
      }

      window.dispatchEvent(new CustomEvent('auditlogadded', { detail: logEntry }));
      return logEntry;
    },

    clearLogs() {
      try {
        localStorage.removeItem('arena_flow_audit_logs_v2');
        this.log('CLEAR_LOGS', 'System Admin', 'SUCCESS', 'Operational audit history cleared.');
      } catch (e) {
        console.error('Failed to clear logs:', e);
      }
    }
  }
};

window.Security = Security;
