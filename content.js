(function() {
  if (document.getElementById('nx-fab')) return;
  var fab = document.createElement('div');
  fab.id = 'nx-fab';
  fab.title = 'R&W Nexus AI';
  fab.textContent = 'N';
  var badge = document.createElement('div');
  badge.id = 'nx-badge';
  fab.appendChild(badge);
  document.body.appendChild(fab);
  fab.addEventListener('click', function() {
    chrome.runtime.sendMessage({ type: 'OPEN_PANEL' });
  });
  function updateBadge() {
    chrome.storage.local.get(['clients','cfg'], function(d) {
      var clients = d.clients || [], cfg = d.cfg || {}, now = Date.now(), n = 0;
      for (var i = 0; i < clients.length; i++) {
        var c = clients[i];
        if (c.lastContact && c.status !== 'Closed' && (now - c.lastContact) / 86400000 >= (c.fuDays || cfg.fuDays || 5)) n++;
      }
      badge.textContent = n;
      badge.style.display = n > 0 ? 'flex' : 'none';
      fab.classList.toggle('alert', n > 0);
    });
  }
  updateBadge();
  chrome.storage.onChanged.addListener(updateBadge);
})();
