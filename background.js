chrome.runtime.onInstalled.addListener(function() {
  chrome.alarms.create('check', { periodInMinutes: 60 });
});

chrome.action.onClicked.addListener(function(tab) {
  chrome.sidePanel.open({ tabId: tab.id }).catch(function() {});
});

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.type === 'OPEN_PANEL') {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs[0]) { sendResponse({ ok: false }); return; }
      chrome.sidePanel.open({ tabId: tabs[0].id }, function() {
        if (chrome.runtime.lastError) {
          chrome.windows.getCurrent(function(w) {
            chrome.sidePanel.open({ windowId: w.id }, function() {
              sendResponse({ ok: true });
            });
          });
        } else {
          sendResponse({ ok: true });
        }
      });
    });
    return true;
  }

  if (msg.type === 'AI_CALL') {
    var key = msg.key || '';
    if (!key || key.indexOf('sk-ant') !== 0) {
      sendResponse({ ok: true, text: null });
      return true;
    }
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'interleaved-thinking-2025-05-14',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: msg.maxTokens || 1024,
        system: msg.system,
        messages: msg.messages
      })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.error) {
        sendResponse({ ok: false, text: 'API Error [' + (d.error.type || 'unknown') + ']: ' + d.error.message });
        return;
      }
      var text = '';
      if (d.content && d.content.length) {
        for (var i = 0; i < d.content.length; i++) {
          if (d.content[i].type === 'text') { text = d.content[i].text; break; }
        }
      }
      sendResponse({ ok: true, text: text });
    })
    .catch(function(e) { sendResponse({ ok: false, text: 'Network error: ' + e.message }); });
    return true;
  }

  // ── RENTCAST API ────────────────────────────────────────────────
  if (msg.type === 'RENTCAST_CALL') {
    var rcKey = msg.key || '';
    if (!rcKey) { sendResponse({ ok: false, text: 'No RentCast API key set. Add it in Settings.' }); return true; }
    var rcParams = Object.keys(msg.params || {}).map(function(k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(msg.params[k]);
    }).join('&');
    var rcUrl = 'https://api.rentcast.io/v1/' + msg.endpoint + (rcParams ? '?' + rcParams : '');
    fetch(rcUrl, {
      method: 'GET',
      headers: { 'X-Api-Key': rcKey, 'Accept': 'application/json' }
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.message || d.error) { sendResponse({ ok: false, text: d.message || d.error, data: null }); return; }
      sendResponse({ ok: true, data: d });
    })
    .catch(function(e) { sendResponse({ ok: false, text: 'RentCast error: ' + e.message, data: null }); });
    return true;
  }

  // ── REALTY API (Realty in US via RapidAPI) ───────────────────────
  if (msg.type === 'REALTY_CALL') {
    var ralKey = msg.key || '';
    if (!ralKey) { sendResponse({ ok: false, text: 'No Realty API key set. Add it in Settings.' }); return true; }
    var ralOptions = {
      method: msg.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RapidAPI-Key': ralKey,
        'X-RapidAPI-Host': 'realty-in-us.p.rapidapi.com'
      }
    };
    if (msg.body) ralOptions.body = JSON.stringify(msg.body);
    fetch('https://realty-in-us.p.rapidapi.com/' + msg.endpoint, ralOptions)
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.message && !d.data) { sendResponse({ ok: false, text: d.message, data: null }); return; }
      sendResponse({ ok: true, data: d });
    })
    .catch(function(e) { sendResponse({ ok: false, text: 'Realty API error: ' + e.message, data: null }); });
    return true;
  }

  if (msg.type === 'LOG_CONTACT') {
    chrome.storage.local.get(['clients'], function(d) {
      var clients = d.clients || [];
      for (var i = 0; i < clients.length; i++) {
        if (clients[i].id === msg.id) {
          clients[i].lastContact = Date.now();
          clients[i].touchpoints = (clients[i].touchpoints || 0) + 1;
          break;
        }
      }
      chrome.storage.local.set({ clients: clients });
      sendResponse({ ok: true });
    });
    return true;
  }
});

chrome.alarms.onAlarm.addListener(function(a) {
  if (a.name !== 'check') return;
  chrome.storage.local.get(['clients', 'cfg'], function(d) {
    var clients = d.clients || [];
    var fuDays = (d.cfg && d.cfg.fuDays) || 5;
    var now = Date.now();
    var overdue = clients.filter(function(c) {
      return c.lastContact && c.status !== 'Closed' &&
        (now - c.lastContact) / 86400000 >= (c.fuDays || fuDays);
    });
    if (overdue.length > 0) {
      var days = Math.floor((now - overdue[0].lastContact) / 86400000);
      chrome.notifications.create({
        type: 'basic', iconUrl: 'icons/icon48.png',
        title: 'Nexus — ' + overdue.length + ' follow-up' + (overdue.length > 1 ? 's' : '') + ' overdue',
        message: overdue[0].name + ' — ' + days + ' days without contact.'
      });
    }
  });
});
