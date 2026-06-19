/**
 * ServiceNow Learning Full View — Background Service Worker
 *
 * - Forwards the keyboard shortcut to the content script.
 * - Manages the extension icon badge (ON / OFF indicator).
 * - Clears badge state when the user navigates away from ServiceNow.
 */
(function () {
  'use strict';

  var SN_URL_GLOB = 'learning.servicenow.com';

  // Per-tab hidden state: Map<tabId, boolean>
  var tabState = new Map();

  /* ------------------------------------------------------------------ */
  /*  Badge helpers                                                      */
  /* ------------------------------------------------------------------ */

  function isServiceNowTab(tab) {
    return tab && tab.url && tab.url.includes(SN_URL_GLOB);
  }

  /** Reflect a tab's toggle state onto the extension icon badge. */
  function updateBadge(tabId, hidden) {
    if (hidden) {
      chrome.action.setBadgeText({ tabId: tabId, text: 'ON' });
      chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#22c55e' }); // green
    } else {
      chrome.action.setBadgeText({ tabId: tabId, text: '' });
    }
  }

  /** Clear badge (called when navigating away from ServiceNow). */
  function clearBadge(tabId) {
    chrome.action.setBadgeText({ tabId: tabId, text: '' });
    tabState.delete(tabId);
  }

  /** Sync badge for the active tab based on what we last know. */
  async function syncActiveTabBadge() {
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    var tab = tabs[0];
    if (!tab || !tab.id) return;

    if (!isServiceNowTab(tab)) {
      clearBadge(tab.id);
      return;
    }

    var hidden = tabState.get(tab.id);
    updateBadge(tab.id, !!hidden);
  }

  /* ------------------------------------------------------------------ */
  /*  Shortcut handler                                                   */
  /* ------------------------------------------------------------------ */

  chrome.commands.onCommand.addListener(async function (command) {
    if (command !== 'toggle-header') return;

    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    var tab = tabs[0];

    if (!tab || !tab.id || !isServiceNowTab(tab)) return;

    try {
      var resp = await chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
      if (resp && typeof resp.hidden === 'boolean') {
        tabState.set(tab.id, resp.hidden);
        updateBadge(tab.id, resp.hidden);
      }
    } catch (_) {
      // Content script not ready — ignore silently.
    }
  });

  /* ------------------------------------------------------------------ */
  /*  State reports from content script                                  */
  /* ------------------------------------------------------------------ */

  chrome.runtime.onMessage.addListener(function (message, sender) {
    if (message.action !== 'stateChanged') return;

    var tabId = sender.tab && sender.tab.id;
    if (tabId == null) return;

    tabState.set(tabId, message.hidden);
    updateBadge(tabId, message.hidden);
  });

  /* ------------------------------------------------------------------ */
  /*  Tab lifecycle — clear stale badges                                 */
  /* ------------------------------------------------------------------ */

  // When the user switches to a different tab
  chrome.tabs.onActivated.addListener(function (activeInfo) {
    syncActiveTabBadge();
  });

  // When a tab finishes loading (navigate away / refresh)
  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete') {
      // If it's the active tab, re-sync; otherwise clear stale state
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0] && tabs[0].id === tabId) {
          syncActiveTabBadge();
        } else if (!isServiceNowTab(tab)) {
          clearBadge(tabId);
        }
      });
    }
  });
})();
