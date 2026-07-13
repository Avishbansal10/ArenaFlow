/**
 * ArenaFlow Security Utilities
 * Protects against common vulnerabilities (XSS, Injection) and tracks administrative actions.
 */

const Security = {
  /**
   * Escapes HTML special characters to prevent XSS (Cross-Site Scripting) attacks.
   * @param {string} str - Raw string to escape.
   * @returns {string} Safe, HTML-escaped string.
   */
  sanitizeHtml(str) {
    if (typeof str !== 'string') return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
      '`': '&grave;'
    };
    return str.replace(/[&<>"'`/]/g, (m) => map[m]);
  },

  /**
   * Validates form inputs based on strict rules.
   * @param {string} value - Value to check.
   * @param {Object} rules - Rules configuration (minLength, maxLength, pattern).
   * @returns {Object} { isValid: boolean, error: string }
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
      return { isValid: false, error: rules.patternMessage || 'Invalid format.' };
    }

    return { isValid: true, error: '' };
  },

  // Regex patterns for validation
  Patterns: {
    SEAT: /^[A-Za-z0-9\s-]{2,10}$/, // e.g. "Sec 102", "Row-A", "102-12"
    PHONE: /^\+?[0-9\s-]{10,15}$/,  // e.g. "+91 9876543210"
    NAME: /^[A-Za-z0-9\s.,'!-]{2,50}$/, // standard names/descriptions
  },

  /**
   * Audit Logger for tracking security-sensitive and operational events.
   * Simulates an immutable tamper-evident log in localStorage.
   */
  AuditLogger: {
    getLogs() {
      try {
        const logs = localStorage.getItem('arena_flow_audit_logs');
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
      
      // Limit to last 200 logs to preserve storage efficiency
      if (logs.length > 200) {
        logs.shift();
      }
      
      try {
        localStorage.setItem('arena_flow_audit_logs', JSON.stringify(logs));
      } catch (e) {
        console.error('Audit log write failed:', e);
      }

      // Dispatch event to update logs tab in real-time
      window.dispatchEvent(new CustomEvent('auditlogadded', { detail: logEntry }));
      return logEntry;
    },

    clearLogs() {
      try {
        localStorage.removeItem('arena_flow_audit_logs');
        this.log('CLEAR_LOGS', 'System Admin', 'SUCCESS', 'Audit log history cleared.');
      } catch (e) {
        console.error('Failed to clear audit logs:', e);
      }
    }
  }
};

// Export to window object for browser access
window.Security = Security;
