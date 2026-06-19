/**
 * Popup script — bridges the extension popup UI with the content script
 * injected on learning.servicenow.com.
 */
document.addEventListener('DOMContentLoaded', async function () {
  /* ---- DOM refs ---- */
  const toggleBtn = document.getElementById('toggleBtn');
  const btnText = document.getElementById('btnText');
  const btnIcon = document.getElementById('btnIcon');
  const statusPill = document.getElementById('statusPill');

  /* ---- Helpers ---- */
  async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  function isServiceNowPage(url) {
    return url && url.includes('learning.servicenow.com');
  }

  /* ---- State read from content script ---- */
  async function getState() {
    try {
      const tab = await getCurrentTab();
      if (!isServiceNowPage(tab.url)) return false;
      const resp = await chrome.tabs.sendMessage(tab.id, { action: 'getState' });
      return resp.hidden;
    } catch {
      return false;
    }
  }

  /* ---- UI update ---- */
  function render(hidden) {
    if (hidden) {
      statusPill.textContent = 'Hidden';
      statusPill.className = 'pill pill-hidden';
      btnText.textContent = 'Show Header';
      btnIcon.innerHTML = '&#x1F440;'; // 👀
      toggleBtn.className = 'btn btn-show';
    } else {
      statusPill.textContent = 'Visible';
      statusPill.className = 'pill pill-visible';
      btnText.textContent = 'Hide Header';
      btnIcon.innerHTML = '&#x1F648;'; // 🙈
      toggleBtn.className = 'btn btn-hide';
    }
  }

  /* ---- Toggle action ---- */
  async function handleToggle() {
    const tab = await getCurrentTab();

    if (!isServiceNowPage(tab.url)) {
      alert('This extension only works on learning.servicenow.com.\n\nOpen that site and try again.');
      return;
    }

    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
      render(resp.hidden);
    } catch (err) {
      console.error('Toggle failed:', err);
      alert('Could not reach the page.\n\nPlease refresh learning.servicenow.com and try again.');
    }
  }

  /* ---- Init ---- */
  const hidden = await getState();
  render(hidden);
  toggleBtn.addEventListener('click', handleToggle);
});
