/**
 * ServiceNow Learning Full View — Content Script
 *
 * Injected into learning.servicenow.com at document_idle.
 * Manipulates the header + content container and reports state
 * back to the background service worker for badge updates.
 */
(function () {
  'use strict';

  var HEADER_SELECTOR = 'header.sn-cx-navigation';
  var CONTENT_SELECTOR = 'div.content-main-container.panel-side.content-type-on_demand';

  var hidden = false;

  /* ------------------------------------------------------------------ */
  /*  DOM helpers                                                        */
  /* ------------------------------------------------------------------ */

  function getHeader() {
    return document.querySelector(HEADER_SELECTOR);
  }

  function getContent() {
    return document.querySelector(CONTENT_SELECTOR);
  }

  function elementsReady() {
    return getHeader() !== null && getContent() !== null;
  }

  /* ------------------------------------------------------------------ */
  /*  Notify background so the badge stays in sync                       */
  /* ------------------------------------------------------------------ */

  function notifyBackground() {
    chrome.runtime.sendMessage({ action: 'stateChanged', hidden: hidden });
  }

  /* ------------------------------------------------------------------ */
  /*  Apply / remove overrides                                           */
  /* ------------------------------------------------------------------ */

  function applyOverrides() {
    var header = getHeader();
    var content = getContent();

    if (header) {
      header.style.setProperty('display', 'none', 'important');
    }
    if (content) {
      content.style.setProperty('height', '100%', 'important');
    }
    hidden = true;
  }

  function removeOverrides() {
    var header = getHeader();
    var content = getContent();

    if (header) {
      header.style.removeProperty('display');
    }
    if (content) {
      content.style.removeProperty('height');
    }
    hidden = false;
  }

  function toggle() {
    if (hidden) {
      removeOverrides();
    } else {
      applyOverrides();
    }
    // Persist across page reloads
    chrome.storage.local.set({ snHeaderHidden: hidden });
    // Update the extension icon badge
    notifyBackground();
    return hidden;
  }

  /* ------------------------------------------------------------------ */
  /*  Restore state after page load — wait for Angular to render         */
  /* ------------------------------------------------------------------ */

  function restoreState() {
    chrome.storage.local.get('snHeaderHidden', function (result) {
      if (!result.snHeaderHidden) return;

      // Elements already in DOM?
      if (elementsReady()) {
        applyOverrides();
        notifyBackground();
        return;
      }

      // Not yet — watch with MutationObserver (SPA-aware)
      var observer = new MutationObserver(function () {
        if (elementsReady()) {
          observer.disconnect();
          applyOverrides();
          notifyBackground();
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });

      // Safety timeout (15 s) — stop watching regardless
      setTimeout(function () {
        observer.disconnect();
        // One last attempt
        if (!hidden && elementsReady()) {
          applyOverrides();
          notifyBackground();
        }
      }, 15000);
    });
  }

  restoreState();

  /* ------------------------------------------------------------------ */
  /*  Message bridge (popup / background → content script)              */
  /* ------------------------------------------------------------------ */

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    switch (message.action) {
      case 'toggle':
        sendResponse({ hidden: toggle() });
        break;
      case 'getState':
        sendResponse({ hidden: hidden });
        break;
      default:
        sendResponse({ error: 'Unknown action' });
    }
    return true; // keep the message channel open for async sendResponse
  });
})();
