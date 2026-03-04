/**
 * i18n helper for Chrome extension.
 * Wraps chrome.i18n.getMessage with fallback for non-extension contexts.
 */

const DRP_i18n = {
  /**
   * Get a localized message.
   * @param {string} key - Message key from _locales/{locale}/messages.json
   * @param {string|string[]} [substitutions] - Placeholder substitutions
   * @returns {string} The localized string, or the key itself as fallback
   */
  msg(key, ...substitutions) {
    if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
      const subs = substitutions.length === 1 && Array.isArray(substitutions[0])
        ? substitutions[0]
        : substitutions.length > 0 ? substitutions : undefined;
      return chrome.i18n.getMessage(key, subs) || key;
    }
    return key;
  },

  /**
   * Get the current UI language.
   * @returns {string} e.g., "en", "zh_CN"
   */
  getLanguage() {
    if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getUILanguage) {
      return chrome.i18n.getUILanguage();
    }
    return navigator.language || 'en';
  },
};

if (typeof globalThis !== 'undefined') {
  globalThis.DRP_i18n = DRP_i18n;
}
