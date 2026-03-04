/**
 * Shadow DOM tooltip component for displaying password rules.
 * Renders a tooltip near the password input field with smart positioning.
 */

const DRP_Tooltip = {
  TOOLTIP_HOST_ATTR: 'data-drp-tooltip',

  /**
   * Create and attach a tooltip to a password input element.
   * @param {HTMLInputElement} input - The password input element
   * @param {object} data - { rules, domain, confidence_score, contributor_count, upvotes, downvotes, rule_id }
   * @returns {HTMLElement} The tooltip host element
   */
  create(input, data) {
    // Don't create duplicate tooltips
    if (input.getAttribute(this.TOOLTIP_HOST_ATTR)) return null;

    const host = document.createElement('div');
    host.setAttribute(this.TOOLTIP_HOST_ATTR, 'true');
    host.style.cssText = 'position: absolute; z-index: 2147483647; pointer-events: auto; opacity: 0;';

    const shadow = host.attachShadow({ mode: 'open' });

    // Inject styles
    const style = document.createElement('style');
    style.textContent = this._getStyles();
    shadow.appendChild(style);

    // Build tooltip content
    const tooltip = this._buildTooltip(data);
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-label', DRP_i18n.msg('tooltipTitle', data.domain));
    shadow.appendChild(tooltip);

    // Insert into page
    document.body.appendChild(host);
    input.setAttribute(this.TOOLTIP_HOST_ATTR, 'true');

    // Position then animate in
    this._position(host, input);
    requestAnimationFrame(() => {
      host.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      host.style.opacity = '1';
    });

    // Reposition on scroll/resize
    const reposition = this._throttle(() => this._position(host, input), 100);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);

    // Store cleanup data on host
    host._drpCleanup = { reposition, input, domain: data.domain };

    // Close button
    const closeBtn = shadow.querySelector('.drp-close');
    if (closeBtn) {
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.setAttribute('tabindex', '0');
      closeBtn.addEventListener('click', () => {
        this._dismiss(host, input, data.domain);
      });
    }

    // Toggle collapse
    const header = shadow.querySelector('.drp-header');
    if (header) {
      header.addEventListener('click', (e) => {
        if (e.target.closest('.drp-close') || e.target.closest('.drp-vote-btn')) return;
        const body = shadow.querySelector('.drp-body');
        if (body) body.classList.toggle('drp-collapsed');
      });
    }

    // Vote buttons
    const upBtn = shadow.querySelector('.drp-vote-up');
    const downBtn = shadow.querySelector('.drp-vote-down');
    if (upBtn) upBtn.setAttribute('tabindex', '0');
    if (downBtn) downBtn.setAttribute('tabindex', '0');

    if (upBtn && data.rule_id) {
      upBtn.addEventListener('click', () => {
        try {
          chrome.runtime.sendMessage({ type: 'VOTE', ruleId: data.rule_id, vote: 'up', domain: data.domain });
        } catch (e) { /* extension context invalidated */ }
        // Optimistic UI: increment count and highlight
        const currentCount = parseInt(upBtn.textContent.replace(/\D/g, '')) || 0;
        upBtn.textContent = `\uD83D\uDC4D ${currentCount + 1}`;
        upBtn.classList.add('drp-voted');
        // Reset downvote if previously voted
        if (downBtn.classList.contains('drp-voted')) {
          const downCount = parseInt(downBtn.textContent.replace(/\D/g, '')) || 0;
          downBtn.textContent = `\uD83D\uDC4E ${Math.max(0, downCount - 1)}`;
        }
        downBtn.classList.remove('drp-voted');
      });
    }
    if (downBtn && data.rule_id) {
      downBtn.addEventListener('click', () => {
        try {
          chrome.runtime.sendMessage({ type: 'VOTE', ruleId: data.rule_id, vote: 'down', domain: data.domain });
        } catch (e) { /* extension context invalidated */ }
        // Optimistic UI: increment count and highlight
        const currentCount = parseInt(downBtn.textContent.replace(/\D/g, '')) || 0;
        downBtn.textContent = `\uD83D\uDC4E ${currentCount + 1}`;
        downBtn.classList.add('drp-voted');
        // Reset upvote if previously voted
        if (upBtn.classList.contains('drp-voted')) {
          const upCount = parseInt(upBtn.textContent.replace(/\D/g, '')) || 0;
          upBtn.textContent = `\uD83D\uDC4D ${Math.max(0, upCount - 1)}`;
        }
        upBtn.classList.remove('drp-voted');
      });
    }

    // Keyboard accessibility
    shadow.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this._dismiss(host, input, data.domain);
      }
    });

    return host;
  },

  /**
   * Create a "no rules found" prompt tooltip.
   */
  createNoRulesPrompt(input, domain) {
    if (input.getAttribute(this.TOOLTIP_HOST_ATTR)) return null;

    const host = document.createElement('div');
    host.setAttribute(this.TOOLTIP_HOST_ATTR, 'true');
    host.style.cssText = 'position: absolute; z-index: 2147483647; pointer-events: auto; opacity: 0;';

    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = this._getStyles();
    shadow.appendChild(style);

    const msg = DRP_i18n.msg;
    const prompt = document.createElement('div');
    prompt.className = 'drp-tooltip drp-prompt';
    prompt.setAttribute('role', 'tooltip');
    prompt.setAttribute('aria-label', msg('contributePrompt'));

    const text = document.createElement('span');
    text.className = 'drp-prompt-text';
    text.textContent = msg('contributePrompt');
    prompt.appendChild(text);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'drp-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.setAttribute('tabindex', '0');
    closeBtn.addEventListener('click', () => {
      host.style.display = 'none';
      input.removeAttribute(this.TOOLTIP_HOST_ATTR);
    });
    prompt.appendChild(closeBtn);

    prompt.addEventListener('click', (e) => {
      if (e.target.closest('.drp-close')) return;
      try {
        chrome.runtime.sendMessage({ type: 'OPEN_POPUP', domain });
      } catch (e) { /* extension context invalidated */ }
    });

    shadow.appendChild(prompt);
    document.body.appendChild(host);
    input.setAttribute(this.TOOLTIP_HOST_ATTR, 'true');

    this._position(host, input);
    requestAnimationFrame(() => {
      host.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      host.style.opacity = '1';
    });

    const reposition = this._throttle(() => this._position(host, input), 100);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);

    host._drpCleanup = { reposition, input, domain };

    // Keyboard: Escape to dismiss
    shadow.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        host.style.display = 'none';
        input.removeAttribute(this.TOOLTIP_HOST_ATTR);
      }
    });

    return host;
  },

  /**
   * Remove a tooltip host and clean up event listeners.
   */
  removeTooltip(host) {
    if (!host) return;
    if (host._drpCleanup) {
      const { reposition, input } = host._drpCleanup;
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      if (input) input.removeAttribute(this.TOOLTIP_HOST_ATTR);
    }
    host.remove();
  },

  _dismiss(host, input, domain) {
    host.style.opacity = '0';
    setTimeout(() => {
      host.style.display = 'none';
      input.removeAttribute(this.TOOLTIP_HOST_ATTR);
    }, 200);
    this._saveDismissal(domain);
  },

  _buildTooltip(data) {
    const msg = DRP_i18n.msg;
    const { rules, domain, confidence_score, contributor_count, upvotes, downvotes } = data;
    const displayItems = DRP_Rules.formatRulesForDisplay(rules);

    const tooltip = document.createElement('div');
    tooltip.className = 'drp-tooltip';

    // Header
    const header = document.createElement('div');
    header.className = 'drp-header';

    const icon = document.createElement('span');
    icon.className = 'drp-icon';
    icon.textContent = '\uD83D\uDD11';
    header.appendChild(icon);

    const title = document.createElement('span');
    title.className = 'drp-title';
    title.textContent = msg('tooltipTitle', domain);
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'drp-close';
    closeBtn.textContent = '\u00d7';
    header.appendChild(closeBtn);

    tooltip.appendChild(header);

    // Body (rules list)
    const body = document.createElement('div');
    body.className = 'drp-body';

    const rulesList = document.createElement('div');
    rulesList.className = 'drp-rules';

    for (const item of displayItems) {
      const ruleEl = document.createElement('div');
      ruleEl.className = `drp-rule drp-rule-${item.type}`;
      const prefix = item.type === 'requirement' ? '\u2713 ' : item.type === 'warning' ? '\u26A0 ' : '\u2139 ';
      ruleEl.textContent = prefix + item.text;
      rulesList.appendChild(ruleEl);
    }
    body.appendChild(rulesList);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'drp-footer';

    const confidenceLevel = DRP_Rules.getConfidenceLevel(confidence_score || 0);
    const confidence = document.createElement('span');
    confidence.className = 'drp-confidence';
    confidence.textContent = msg('confidenceLabel', confidenceLevel, String(contributor_count || 0));
    footer.appendChild(confidence);

    const votes = document.createElement('span');
    votes.className = 'drp-votes';

    const upBtn = document.createElement('button');
    upBtn.className = 'drp-vote-btn drp-vote-up';
    upBtn.setAttribute('aria-label', 'Upvote');
    upBtn.textContent = `\uD83D\uDC4D ${upvotes || 0}`;
    votes.appendChild(upBtn);

    const downBtn = document.createElement('button');
    downBtn.className = 'drp-vote-btn drp-vote-down';
    downBtn.setAttribute('aria-label', 'Downvote');
    downBtn.textContent = `\uD83D\uDC4E ${downvotes || 0}`;
    votes.appendChild(downBtn);

    footer.appendChild(votes);
    body.appendChild(footer);
    tooltip.appendChild(body);

    return tooltip;
  },

  _position(host, input) {
    const rect = input.getBoundingClientRect();
    const tooltipWidth = Math.max(rect.width, 280);
    const gap = 4;

    // Get tooltip height (measure from shadow DOM content)
    const tooltipEl = host.shadowRoot && host.shadowRoot.querySelector('.drp-tooltip');
    const tooltipHeight = tooltipEl ? tooltipEl.offsetHeight : 120;

    // Default: position below the input
    let top = window.scrollY + rect.bottom + gap;
    let left = window.scrollX + rect.left;

    // If tooltip would go below viewport, position above the input
    if (rect.bottom + gap + tooltipHeight > window.innerHeight) {
      top = window.scrollY + rect.top - tooltipHeight - gap;
    }

    // If tooltip would go off-screen right, shift left
    if (rect.left + tooltipWidth > window.innerWidth) {
      left = window.scrollX + window.innerWidth - tooltipWidth - 8;
    }

    // Don't go off-screen left
    if (left < window.scrollX) {
      left = window.scrollX + 4;
    }

    host.style.left = `${left}px`;
    host.style.top = `${top}px`;
    host.style.width = `${tooltipWidth}px`;
  },

  _throttle(fn, ms) {
    let last = 0;
    return function () {
      const now = Date.now();
      if (now - last >= ms) {
        last = now;
        fn();
      }
    };
  },

  async _saveDismissal(domain) {
    try {
      const data = await chrome.storage.local.get('drp_dismissed');
      const dismissed = data.drp_dismissed || {};
      dismissed[domain] = Date.now();
      await chrome.storage.local.set({ drp_dismissed: dismissed });
    } catch (e) { /* extension context invalidated */ }
  },

  async isDismissed(domain) {
    try {
      const data = await chrome.storage.local.get('drp_dismissed');
      const dismissed = data.drp_dismissed || {};
      return !!dismissed[domain];
    } catch (e) {
      return false;
    }
  },

  _getStyles() {
    return `
      .drp-tooltip {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        line-height: 1.5;
        background: #ffffff;
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.10), 0 1px 3px rgba(0, 0, 0, 0.06);
        padding: 0;
        color: #333;
        box-sizing: border-box;
      }

      .drp-header {
        display: flex;
        align-items: center;
        padding: 10px 12px;
        background: #f8f9fa;
        border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        border-radius: 8px 8px 0 0;
        cursor: pointer;
        user-select: none;
      }

      .drp-icon {
        margin-right: 8px;
        font-size: 14px;
        line-height: 1;
      }

      .drp-title {
        flex: 1;
        font-weight: 600;
        font-size: 12px;
        color: #444;
      }

      .drp-close {
        background: none;
        border: none;
        font-size: 18px;
        color: #999;
        cursor: pointer;
        padding: 0 4px;
        line-height: 1;
        border-radius: 4px;
        transition: color 0.15s ease, background 0.15s ease;
      }
      .drp-close:hover {
        color: #333;
        background: rgba(0, 0, 0, 0.06);
      }
      .drp-close:focus-visible {
        outline: 2px solid #4A90D9;
        outline-offset: 1px;
      }

      .drp-body {
        padding: 10px 12px;
        overflow: hidden;
        max-height: 500px;
        transition: max-height 0.25s ease, padding 0.25s ease, opacity 0.2s ease;
        opacity: 1;
      }
      .drp-body.drp-collapsed {
        max-height: 0;
        padding-top: 0;
        padding-bottom: 0;
        opacity: 0;
      }

      .drp-rules {
        margin: 0;
      }

      .drp-rule {
        padding: 3px 0;
        font-size: 12.5px;
      }

      .drp-rule-requirement {
        color: #1b7a2b;
      }

      .drp-rule-warning {
        color: #c44000;
      }

      .drp-rule-info {
        color: #1565c0;
        font-style: italic;
      }

      .drp-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #f0f0f0;
      }

      .drp-confidence {
        font-size: 11px;
        color: #777;
      }

      .drp-votes {
        display: flex;
        gap: 6px;
      }

      .drp-vote-btn {
        background: none;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 2px 8px;
        font-size: 11px;
        cursor: pointer;
        color: #555;
        transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
      }
      .drp-vote-btn:hover {
        background: #f0f0f0;
        border-color: #ccc;
        transform: scale(1.05);
      }
      .drp-vote-btn:active {
        transform: scale(0.97);
      }
      .drp-vote-btn:focus-visible {
        outline: 2px solid #4A90D9;
        outline-offset: 1px;
      }
      .drp-vote-btn.drp-voted {
        background: #e3f2fd;
        border-color: #90caf9;
        color: #1565c0;
      }

      /* No-rules prompt */
      .drp-prompt {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        cursor: pointer;
        transition: background 0.15s ease;
      }
      .drp-prompt:hover {
        background: #f8f9fa;
      }
      .drp-prompt-text {
        flex: 1;
        font-size: 12px;
        color: #2b6cb0;
      }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .drp-tooltip {
          background: #2b2b2b;
          border-color: rgba(255, 255, 255, 0.10);
          color: #e8e8e8;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5), 0 1px 3px rgba(0, 0, 0, 0.3);
        }
        .drp-header {
          background: #333;
          border-color: rgba(255, 255, 255, 0.08);
        }
        .drp-title { color: #d4d4d4; }
        .drp-close { color: #999; }
        .drp-close:hover { color: #e0e0e0; background: rgba(255, 255, 255, 0.08); }
        .drp-rule-requirement { color: #6fcf76; }
        .drp-rule-warning { color: #ffab40; }
        .drp-rule-info { color: #64b5f6; }
        .drp-footer { border-color: rgba(255, 255, 255, 0.08); }
        .drp-confidence { color: #aaa; }
        .drp-vote-btn { border-color: #555; color: #bbb; }
        .drp-vote-btn:hover { background: #3d3d3d; border-color: #666; }
        .drp-vote-btn.drp-voted { background: #1a3a5c; border-color: #4a7aa8; color: #82bdf5; }
        .drp-prompt:hover { background: #333; }
        .drp-prompt-text { color: #64b5f6; }
      }
    `;
  },
};

if (typeof globalThis !== 'undefined') {
  globalThis.DRP_Tooltip = DRP_Tooltip;
}
