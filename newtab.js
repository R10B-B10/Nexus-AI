var TIPS = [
  'Leads contacted within 5 minutes convert at significantly higher rates.',
  'Most agents quit after 2 follow-ups. Most deals close after 5.',
  'The agent who responds first wins 78% of the time.',
  'Referrals close 4x faster than cold leads.',
  '"No" today is often "yes" in 6 months.'
];

function updateClock() {
  var now = new Date();
  var h = now.getHours(), m = now.getMinutes();
  var hh = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  var mm = m < 10 ? '0' + m : String(m);
  var ampm = h >= 12 ? ' PM' : ' AM';
  document.getElementById('time-el').textContent = hh + ':' + mm;
  document.getElementById('tr').textContent = hh + ':' + mm + ampm;
  var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('date-el').textContent = days[now.getDay()] + ', ' + months[now.getMonth()] + ' ' + now.getDate();
}
updateClock();
setInterval(updateClock, 1000);

function openPanel() {
  chrome.tabs.getCurrent(function(tab) {
    if (tab) {
      chrome.sidePanel.open({ tabId: tab.id }, function() {
        if (chrome.runtime.lastError) {
          chrome.windows.getCurrent(function(w) { chrome.sidePanel.open({ windowId: w.id }); });
        }
      });
    }
  });
}

document.getElementById('open-btn').addEventListener('click', openPanel);
document.getElementById('no-key-btn').addEventListener('click', openPanel);
document.getElementById('ins-x').addEventListener('click', function() {
  document.getElementById('ins').style.display = 'none';
});

chrome.storage.local.get(['clients', 'cfg'], function(d) {
  var clients = d.clients || [], cfg = d.cfg || {}, now = Date.now();
  var fuDays = cfg.fuDays || 5;
  var h = new Date().getHours();
  var gr = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  var nm = cfg.name ? ', ' + cfg.name.split(' ')[0] : '';
  document.getElementById('greeting').textContent = gr + nm + '.';

  var active = 0, overdue = [], booked = 0, pv = 0;
  for (var i = 0; i < clients.length; i++) {
    var c = clients[i];
    if (c.status !== 'Closed') { active++; if (c.budget) pv += parseFloat(c.budget.replace(/[^0-9.]/g,'')) || 0; }
    if (c.status === 'Booked') booked++;
    if (c.lastContact && c.status !== 'Closed' && (now - c.lastContact) / 86400000 >= (c.fuDays || fuDays)) overdue.push(c);
  }

  if (clients.length === 0) {
    document.getElementById('sub').textContent = 'Add your first client to start tracking your pipeline.';
  } else {
    var sub = active + ' active lead' + (active !== 1 ? 's' : '');
    if (overdue.length > 0) sub = overdue.length + ' follow-up' + (overdue.length > 1 ? 's' : '') + ' need attention \u00b7 ' + sub;
    if (booked > 0) sub += ' \u00b7 ' + booked + ' appointment' + (booked > 1 ? 's' : '') + ' booked';
    document.getElementById('sub').textContent = sub;

    var pvStr = pv >= 1000000 ? '$' + (pv/1000000).toFixed(1) + 'M' : pv >= 1000 ? '$' + Math.round(pv/1000) + 'k' : '$' + Math.round(pv);
    var statsEl = document.getElementById('stats');
    statsEl.style.display = 'flex';
    statsEl.innerHTML = '<div class="sc"><div class="sn g">' + active + '</div><div class="sl">Active</div></div>'
      + '<div class="sc"><div class="sn w">' + overdue.length + '</div><div class="sl">Overdue</div></div>'
      + '<div class="sc"><div class="sn">' + booked + '</div><div class="sl">Booked</div></div>'
      + (pv > 0 ? '<div class="sc"><div class="sn" style="font-size:20px">' + pvStr + '</div><div class="sl">Pipeline</div></div>' : '');

    var cardData = [];
    for (var oi = 0; oi < overdue.length && oi < 2; oi++) {
      var oc = overdue[oi], od = Math.floor((now - oc.lastContact) / 86400000);
      cardData.push({ cls:'urg', tag:'Follow-Up Overdue', label:oc.name, sub:oc.type + (oc.budget?' \u00b7 '+oc.budget:'') + ' \u00b7 ' + od + ' days without contact' });
    }
    for (var hi = 0; hi < clients.length && cardData.length < 4; hi++) {
      var hc = clients[hi];
      if (hc.status !== 'Hot') continue;
      var inOv = false; for (var oi2=0;oi2<overdue.length;oi2++) if(overdue[oi2].id===hc.id){inOv=true;break;}
      if (inOv) continue;
      var hd = hc.lastContact ? Math.floor((now - hc.lastContact) / 86400000) : null;
      cardData.push({ cls:'act', tag:'Hot Lead', label:hc.name, sub:hc.type+(hc.budget?' \u00b7 '+hc.budget:'')+(hd?' \u00b7 last contact '+hd+'d ago':' \u00b7 never contacted') });
    }
    if (cardData.length < 4) {
      cardData.push({ cls:'', tag:'AI Ready', label:'Ask Nexus anything', sub:'Pipeline analysis, drafts, coaching \u2014 your AI is ready.' });
    }

    var cardsEl = document.getElementById('cards');
    cardsEl.style.display = 'grid';
    var html = '';
    for (var ci = 0; ci < cardData.length && ci < 4; ci++) {
      var cd = cardData[ci];
      html += '<div class="card ' + cd.cls + '">'
        + '<div class="ct">' + cd.tag + '</div>'
        + '<div class="cl">' + cd.label + '</div>'
        + '<div class="cs">' + cd.sub + '</div>'
        + '<div class="ca">Open in Nexus &#8594;</div></div>';
    }
    cardsEl.innerHTML = html;
    cardsEl.querySelectorAll('.card').forEach(function(el) {
      el.addEventListener('click', openPanel);
    });

    var insText = overdue.length > 0
      ? overdue[0].name + ' has not heard from you in ' + Math.floor((now - overdue[0].lastContact) / 86400000) + ' days. Every day you wait, that lead gets colder.'
      : TIPS[Math.floor(Math.random() * TIPS.length)];
    document.getElementById('ins-t').textContent = insText;
    document.getElementById('ins').style.display = 'flex';
  }

  if (!cfg.apiKey || cfg.apiKey.indexOf('sk-ant') !== 0) {
    document.getElementById('no-key').style.display = 'flex';
  }
});
