function openPanel() {
  chrome.runtime.sendMessage({ type: 'OPEN_PANEL' }, function() {
    window.close();
  });
}

document.getElementById('open-btn').addEventListener('click', openPanel);

chrome.storage.local.get(['clients', 'cfg'], function(d) {
  var clients = d.clients || [];
  var cfg = d.cfg || {};
  var now = Date.now();
  var fuDays = cfg.fuDays || 5;
  var active = 0, overdue = [], booked = 0;

  for (var i = 0; i < clients.length; i++) {
    var c = clients[i];
    if (c.status !== 'Closed') active++;
    if (c.status === 'Booked') booked++;
    if (c.lastContact && c.status !== 'Closed' &&
        (now - c.lastContact) / 86400000 >= (c.fuDays || fuDays)) {
      overdue.push(c);
    }
  }

  if (clients.length > 0) {
    document.getElementById('stats-area').innerHTML =
      '<div class="stats">'
      + '<div class="sc"><div class="sn g">' + active + '</div><div class="sl">Active</div></div>'
      + '<div class="sc"><div class="sn w">' + overdue.length + '</div><div class="sl">Overdue</div></div>'
      + '<div class="sc"><div class="sn">' + booked + '</div><div class="sl">Booked</div></div>'
      + '</div>';
  }

  if (!cfg.apiKey || cfg.apiKey.indexOf('sk-ant') !== 0) {
    var nk = document.getElementById('no-key');
    nk.style.display = 'block';
    nk.addEventListener('click', openPanel);
  }

  var btns = [];
  if (overdue.length > 0) {
    var d0 = Math.floor((now - overdue[0].lastContact) / 86400000);
    btns.push({ text: overdue[0].name + ' \u2014 ' + d0 + 'd overdue', urgent: true });
  }
  if (overdue.length > 1) {
    btns.push({ text: 'All ' + overdue.length + ' overdue leads', urgent: true });
  }
  btns.push({ text: '+ Add new client', urgent: false });
  btns.push({ text: 'Ask Nexus AI anything', urgent: false });
  btns.push({ text: 'Pipeline summary', urgent: false });

  var container = document.getElementById('quick-btns');
  var limit = btns.length < 4 ? btns.length : 4;
  for (var j = 0; j < limit; j++) {
    var btn = document.createElement('button');
    btn.className = 'qb' + (btns[j].urgent ? ' u' : '');
    btn.textContent = btns[j].text;
    btn.addEventListener('click', openPanel);
    container.appendChild(btn);
  }

  document.getElementById('footer').textContent =
    clients.length + ' client' + (clients.length !== 1 ? 's' : '') + ' tracked \u00b7 works on every tab';
});
