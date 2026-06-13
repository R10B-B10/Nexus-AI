// R&W Nexus Pro v11 — sidepanel.js
// Full realtor toolkit. External JS only. Zero async/await. Zero inline handlers.

var DATA = {
  clients: [],
  cfg: {name:'',apiKey:'',model:'claude-sonnet-4-5',brokerage:'',market:'',years:'',fuDays:5,rentcastKey:'',realtyKey:'',notifs:{fu:true,brief:true}},
  history: [],
  log: [],
  scripts: [],
  tipShown: false,
  filterStatus: 'all'
};

var TIPS = [
  'Leads contacted within 5 minutes are 100x more likely to connect. Speed is your moat.',
  'Most agents give up after 2 touches. Most deals close after 5–12. Stay in it.',
  'The agent who responds first wins 78% of the time.',
  'Personalization triples response rates. Use their name, budget, and exact neighborhood.',
  '"No" today is often "yes" in 6 months. Agents who stay in touch win.',
  'Asking for a referral after closing triples the chance you get one. Always ask.',
  'Your follow-up consistency determines your close rate more than your pitch.',
  'Buyers visit 10 homes on average. The agent who stays present wins the deal.',
  'Text messages have a 98% open rate. Email has 20%. Know your channel.',
  'The top 20% of agents do 80% of business — mostly through systematic follow-up.'
];

var SCRIPTS_DEFAULT = [
  {id:'s1',name:'Warm First Follow-Up',body:'Hi [Name],\n\nJust wanted to reach out personally — I\'ve been keeping an eye on [Area] for you and have a couple of options I think you\'d really love.\n\nWould you be open to a quick 10-minute call this week?\n\nBest,\n[Agent]'},
  {id:'s2',name:'Listing Pitch',body:'Hi [Name],\n\nBased on recent comparable sales in your area, your home could sell significantly above what you might expect. Motivated buyers are active right now.\n\nI\'d love to share a complimentary market analysis — no obligation, no pressure. Could we set up 15 minutes?\n\nBest,\n[Agent]'},
  {id:'s3',name:'New Lead Introduction',body:'Hi [Name],\n\nThanks for reaching out — I\'m genuinely excited to help you. I specialize in [Area] and have helped many buyers find exactly what they\'re looking for in this market.\n\nWhen would be a good time for a quick call this week?\n\nBest,\n[Agent]'},
  {id:'s4',name:'Price Objection Handler',body:'Hi [Name],\n\nI completely understand the hesitation. What I\'ve found consistently is that the cost of waiting often outweighs the savings — rising rates and low inventory mean today\'s price may look like a bargain in 6 months.\n\nCould we look at the numbers together? It usually changes the picture.\n\nBest,\n[Agent]'},
  {id:'s5',name:'Post-Showing Follow-Up',body:'Hi [Name],\n\nReally enjoyed showing you the property today — it was great getting a better sense of what you\'re looking for.\n\nDid anything stand out? I have a couple of other listings that just came to market that I think could be a great fit. Happy to arrange viewings whenever works for you.\n\nBest,\n[Agent]'},
  {id:'s6',name:'Referral Request',body:'Hi [Name],\n\nIt\'s been a while since we closed on your home and I hope you\'re loving it!\n\nI wanted to reach out because so much of my business comes from clients like you. If you know anyone who\'s thinking about buying or selling, I\'d be honored to help them the same way I helped you.\n\nNo pressure at all — just wanted you to know I\'m always here.\n\nWarm regards,\n[Agent]'},
  {id:'s7',name:'Expired Listing Pitch',body:'Hi [Name],\n\nI noticed your listing recently expired, and I wanted to reach out directly. I have a proven track record in [Area] and a specific strategy that gets results for homes in exactly your situation.\n\nI\'d love to share what I would do differently. Would you have 15 minutes this week?\n\nBest,\n[Agent]'},
  {id:'s8',name:'Investor Pitch',body:'Hi [Name],\n\nI work extensively with investors in [Area] and wanted to share a property that just came across my desk — strong cap rate potential with solid fundamentals.\n\nWould you be open to a quick call? I think this one is worth a look.\n\nBest,\n[Agent]'}
];

// ── BOOT ─────────────────────────────────────────────────────────
chrome.storage.local.get(
  ['clients','cfg','history','log','scripts','tipShown'],
  function(s) {
    if (s.clients)  DATA.clients  = s.clients;
    if (s.cfg)      DATA.cfg      = Object.assign({}, DATA.cfg, s.cfg);
    if (s.history)  DATA.history  = s.history;
    if (s.log)      DATA.log      = s.log;
    if (s.scripts)  DATA.scripts  = s.scripts;
    if (s.tipShown) DATA.tipShown = s.tipShown;
    if (!DATA.scripts.length) {
      DATA.scripts = SCRIPTS_DEFAULT.slice();
      save();
    }
    bindAll();
    renderAll();
    loadSettings();
    setAIIntro();
  }
);

function save() {
  chrome.storage.local.set({
    clients:DATA.clients, cfg:DATA.cfg, history:DATA.history,
    log:DATA.log, scripts:DATA.scripts, tipShown:DATA.tipShown
  });
}

// ── DOM HELPERS ──────────────────────────────────────────────────
function g(id) { return document.getElementById(id); }
function mk(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
function txt(e, s) { e.textContent = s; return e; }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function ago(ts) {
  var d = (Date.now()-ts)/1000;
  if (d < 60) return 'Just now';
  if (d < 3600) return Math.floor(d/60)+'m ago';
  if (d < 86400) return Math.floor(d/3600)+'h ago';
  return Math.floor(d/86400)+'d ago';
}
function fmtMoney(n) {
  if (n >= 1000000) return '$'+(n/1000000).toFixed(1)+'M';
  if (n >= 1000) return '$'+Math.round(n/1000)+'k';
  return n > 0 ? '$'+n : '—';
}
function pv() {
  return DATA.clients.reduce(function(t,c) {
    if (c.status==='Closed'||!c.budget) return t;
    var n = parseFloat(c.budget.replace(/[^0-9.]/g,''));
    return t + (isNaN(n)?0:n);
  }, 0);
}
function cSub(c) {
  var s = c.type;
  if (c.budget) s += ' · '+c.budget;
  if (c.neighborhood) s += ' · '+c.neighborhood;
  return s;
}
function findC(id) { return DATA.clients.find(function(c){return c.id===id;})||null; }
function getOv() {
  var now = Date.now();
  return DATA.clients.filter(function(c) {
    return c.lastContact && c.status!=='Closed' &&
      (now-c.lastContact)/86400000 >= (c.fuDays||DATA.cfg.fuDays||5);
  });
}
function isOv(c,now) {
  return c.lastContact && c.status!=='Closed' &&
    (now-c.lastContact)/86400000 >= (c.fuDays||DATA.cfg.fuDays||5);
}

// ── BIND ALL ─────────────────────────────────────────────────────
function bindAll() {
  // Tabs
  ['today','clients','ai','pipeline','tools','scripts','settings'].forEach(function(id) {
    var el = g('tab-'+id);
    if (el) el.addEventListener('click', function() { goTab(id); });
  });

  // Nav
  g('btn-nav-add').addEventListener('click', function() { openSheet('add'); });
  g('btn-nav-log').addEventListener('click', openLogSheet);
  g('btn-nav-calc').addEventListener('click', function() { openCalcSheet(); });
  g('btn-nav-settings').addEventListener('click', function() { goTab('settings'); });

  // Today
  g('intel-x').addEventListener('click', function() {
    DATA.tipShown = true; save();
    g('intel-strip').style.display = 'none';
  });
  g('today-see-log').addEventListener('click', function() { goTab('pipeline'); });

  // Clients
  g('client-search').addEventListener('input', function() { renderClients(this.value); });
  g('btn-add-from-clients').addEventListener('click', function() { openSheet('add'); });
  g('btn-add-from-clients2').addEventListener('click', function() { openSheet('add'); });
  g('client-filter-btn').addEventListener('click', cycleFilter);

  // AI Chat
  g('ai-send').addEventListener('click', doSend);
  g('ai-input').addEventListener('keydown', function(e) {
    if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
  });
  g('ai-input').addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight,80)+'px';
  });
  document.querySelectorAll('.chip').forEach(function(btn) {
    btn.addEventListener('click', function() { sendMsg(btn.textContent, false); });
  });

  // Pipeline
  g('btn-clear-log').addEventListener('click', function() {
    DATA.log=[]; save(); renderPipeline(); renderMiniLog();
  });

  // Scripts
  g('btn-new-script').addEventListener('click', function() { openSheet('script'); });

  // Settings
  g('s-key').addEventListener('input', checkKey);
  g('s-rentcast').addEventListener('input', checkKey);
  g('s-realty').addEventListener('input', checkKey);
  g('tog-fu').addEventListener('click', function() {
    this.classList.toggle('on');
    if (!DATA.cfg.notifs) DATA.cfg.notifs={};
    DATA.cfg.notifs.fu = this.classList.contains('on');
  });
  g('tog-brief').addEventListener('click', function() {
    this.classList.toggle('on');
    if (!DATA.cfg.notifs) DATA.cfg.notifs={};
    DATA.cfg.notifs.brief = this.classList.contains('on');
  });
  g('btn-save').addEventListener('click', saveSettings);

  // Sheet X buttons
  g('sheet-add-x').addEventListener('click',      function() { closeSheet('add'); });
  g('sheet-log-x').addEventListener('click',      function() { closeSheet('log'); });
  g('sheet-script-x').addEventListener('click',   function() { closeSheet('script'); });
  g('sheet-calc-x').addEventListener('click',     function() { closeSheet('calc'); });
  g('sheet-property-x').addEventListener('click', function() { closeSheet('property'); });

  // Property lookup buttons
  g('btn-lookup-rent').addEventListener('click',  function() { doPropertyLookup('rent'); });
  g('btn-lookup-value').addEventListener('click', function() { doPropertyLookup('value'); });
  g('btn-lookup-comps').addEventListener('click', function() { doPropertyLookup('comps'); });

  // Sheet backdrop
  ['add','detail','log','script','calc','property'].forEach(function(id) {
    var el = g('overlay-'+id);
    if (el) el.addEventListener('click', function(e) {
      if (e.target === this) closeSheet(id);
    });
  });

  // Sheet saves
  g('btn-save-client').addEventListener('click', saveClient);
  g('btn-save-log').addEventListener('click',    saveLog);
  g('btn-save-script').addEventListener('click', saveScript);

  // Escape
  document.addEventListener('keydown', function(e) {
    if (e.key==='Escape') ['add','detail','log','script','calc'].forEach(closeSheet);
  });

  // From popup/newtab
  chrome.runtime.onMessage.addListener(function(msg) {
    if (msg.type==='DO_ACTION') {
      if (msg.action==='chat'&&msg.msg) { goTab('ai'); setTimeout(function(){sendMsg(msg.msg,false);},200); }
      else if (msg.action==='add') openSheet('add');
    }
  });
}

// ── RENDER ALL ───────────────────────────────────────────────────
function renderAll() {
  renderToday();
  renderClients('');
  renderPipeline();
  renderTools();
  renderScripts();
}

// ── TODAY ────────────────────────────────────────────────────────
function renderToday() {
  var now = Date.now();
  var h = new Date().getHours();
  var gr = h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  var nm = DATA.cfg.name ? ', '+DATA.cfg.name.split(' ')[0] : '';
  g('hero-greeting').textContent = gr+nm+'.';

  var DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  var d = new Date();
  g('hero-date').textContent = DAYS[d.getDay()]+', '+MONTHS[d.getMonth()]+' '+d.getDate();

  // Hero summary lines
  var ov = getOv(), active=0, booked=0;
  for (var i=0;i<DATA.clients.length;i++){
    if(DATA.clients[i].status!=='Closed') active++;
    if(DATA.clients[i].status==='Booked') booked++;
  }
  var pvVal = pv();
  var lines = [];
  if (ov.length>0) lines.push({c:'amber',t:ov.length+(ov.length===1?' lead':' leads')+' overdue for follow-up.'});
  else if (active>0) lines.push({c:'jade',t:active+(active===1?' active lead':' active leads')+' in your pipeline.'});
  else lines.push({c:'dim',t:'Pipeline clear. Add your first client.'});
  if (booked>0) lines.push({c:'sky',t:booked+(booked===1?' appointment':' appointments')+' scheduled.'});
  if (pvVal>0) lines.push({c:'jade',t:'Estimated pipeline value: '+fmtMoney(pvVal)+'.'});

  var heroLines = g('hero-lines');
  heroLines.innerHTML='';
  for (var li=0;li<lines.length;li++){
    var row=mk('div','hero-line');
    var dot=mk('span','hline-dot hld-'+lines[li].c);
    var span=mk('span'); span.textContent=lines[li].t;
    row.appendChild(dot); row.appendChild(span);
    heroLines.appendChild(row);
  }

  // KPIs
  var kpiRow = g('kpi-row');
  kpiRow.innerHTML='';
  var kpis=[
    {v:active,l:'Active',c:'jade'},
    {v:ov.length,l:'Overdue',c:'amber'},
    {v:booked,l:'Booked',c:''},
    {v:fmtMoney(pvVal),l:'Pipeline',c:''}
  ];
  for (var ki=0;ki<kpis.length;ki++){
    var kDiv=mk('div','kpi');
    var kn=mk('div','kpi-val'+(kpis[ki].c?' '+kpis[ki].c:''));
    kn.textContent=kpis[ki].v;
    var kl=mk('div','kpi-lab'); kl.textContent=kpis[ki].l;
    kDiv.appendChild(kn); kDiv.appendChild(kl);
    kpiRow.appendChild(kDiv);
  }

  // Priority action cards
  var container = g('action-cards');
  container.innerHTML='';
  var cards=[];
  var ovLim = Math.min(ov.length,3);
  for (var oi=0;oi<ovLim;oi++){
    var c=ov[oi], dd=Math.floor((now-c.lastContact)/86400000);
    cards.push({type:'urgent',name:c.name,badge:dd+'d overdue',sub:cSub(c),id:c.id});
  }
  for (var hi=0;hi<DATA.clients.length&&cards.length<5;hi++){
    var hc=DATA.clients[hi];
    if(hc.status!=='Hot') continue;
    if(isOv(hc,now)) continue;
    var hd=hc.lastContact?Math.floor((now-hc.lastContact)/86400000):null;
    var hsub=cSub(hc)+(hd!==null?' · '+hd+'d ago':' · never contacted');
    cards.push({type:'hot',name:hc.name,badge:'Hot lead',sub:hsub,id:hc.id});
  }
  for (var bi=0;bi<DATA.clients.length&&cards.length<5;bi++){
    if(DATA.clients[bi].status==='Booked'){
      var bc=DATA.clients[bi];
      cards.push({type:'info',name:'Appointment: '+bc.name,badge:'Booked',sub:(bc.notes||'').substring(0,60)||'Check your calendar',id:bc.id});
    }
  }
  if(!cards.length){
    var e=mk('div'); e.style.cssText='text-align:center;padding:18px 0;color:rgba(245,243,240,.22);font-size:12px';
    e.textContent=DATA.clients.length===0?'Add your first client to get started.':'✓ All clear — no urgent actions right now.';
    container.appendChild(e);
  } else {
    for(var ci=0;ci<cards.length;ci++) container.appendChild(buildActionCard(cards[ci]));
  }

  // Intel tip
  if(!DATA.tipShown && DATA.clients.length>0){
    var ov2=getOv(), tipTxt;
    if(ov2.length>0){
      var td=Math.floor((now-ov2[0].lastContact)/86400000);
      tipTxt=ov2[0].name+' has not heard from you in '+td+' day'+(td>1?'s':'')+'. Every day you wait, that lead gets colder.';
    } else {
      tipTxt=TIPS[Math.floor(Math.random()*TIPS.length)];
    }
    g('intel-text').textContent=tipTxt;
    g('intel-strip').style.display='flex';
  } else {
    g('intel-strip').style.display='none';
  }

  renderMiniLog();
}

function buildActionCard(card) {
  var wrap = mk('div','action-card '+card.type);
  wrap.setAttribute('data-id',card.id);

  var top=mk('div','ac-top');
  var nameEl=mk('div','ac-name'); nameEl.textContent=card.name;
  var tag=mk('span','ac-tag tag-'+card.type); tag.textContent=card.badge;
  top.appendChild(nameEl); top.appendChild(tag);

  var sub=mk('div','ac-sub'); sub.textContent=card.sub;

  var btns=mk('div','ac-btns');
  var doneBtn=mk('button','ac-btn primary');
  doneBtn.textContent='✓ Mark Done';
  doneBtn.setAttribute('data-act','done');
  doneBtn.setAttribute('data-id',card.id);

  var draftBtn=mk('button','ac-btn');
  draftBtn.textContent='Draft Message';
  draftBtn.setAttribute('data-act','draft');
  draftBtn.setAttribute('data-id',card.id);

  var viewBtn=mk('button','ac-btn');
  viewBtn.textContent='View Client';
  viewBtn.setAttribute('data-act','view');
  viewBtn.setAttribute('data-id',card.id);

  btns.appendChild(doneBtn); btns.appendChild(draftBtn); btns.appendChild(viewBtn);
  wrap.appendChild(top); wrap.appendChild(sub); wrap.appendChild(btns);

  doneBtn.addEventListener('click',function(e){e.stopPropagation();markContacted(card.id);});
  draftBtn.addEventListener('click',function(e){e.stopPropagation();quickDraft(card.id);});
  viewBtn.addEventListener('click',function(e){e.stopPropagation();openDetail(card.id);});
  wrap.addEventListener('click',function(){openDetail(card.id);});
  return wrap;
}

// ── MINI LOG ─────────────────────────────────────────────────────
function renderMiniLog() {
  buildLog(g('mini-log'), 4);
}

function buildLog(container, limit) {
  container.innerHTML='';
  if(!DATA.log.length){
    var e=mk('div'); e.style.cssText='text-align:center;padding:12px 0;color:rgba(245,243,240,.22);font-size:11px';
    e.textContent='No activity logged yet.';
    container.appendChild(e); return;
  }
  var n = limit ? Math.min(DATA.log.length,limit) : DATA.log.length;
  for(var i=0;i<n;i++) container.appendChild(buildLogRow(DATA.log[i]));
}

function buildLogRow(entry) {
  var row=mk('div','log-row');
  var ico=mk('div','log-ico'); ico.textContent=entry.ico;
  var body=mk('div','log-body');
  var name=mk('div','log-name'); name.textContent=entry.name;
  var det=mk('div','log-det'); det.textContent=entry.detail;
  var time=mk('div','log-time'); time.textContent=ago(entry.time);
  body.appendChild(name); body.appendChild(det); body.appendChild(time);
  row.appendChild(ico); row.appendChild(body);
  return row;
}

// ── CLIENTS ──────────────────────────────────────────────────────
function cycleFilter() {
  var order=['all','Hot','Warm','Cold','Booked','Overdue'];
  var idx=order.indexOf(DATA.filterStatus);
  DATA.filterStatus = order[(idx+1)%order.length];
  g('client-filter-btn').textContent=DATA.filterStatus;
  renderClients(g('client-search').value);
}

function renderClients(q) {
  q=q||'';
  var container=g('client-list'), countEl=g('client-count'), now=Date.now();
  var list=DATA.clients;

  if(q){var ql=q.toLowerCase();list=list.filter(function(c){return(c.name+' '+(c.notes||'')+' '+(c.neighborhood||'')+' '+(c.budget||'')).toLowerCase().indexOf(ql)!==-1;});}

  if(DATA.filterStatus!=='all'){
    if(DATA.filterStatus==='Overdue'){
      list=list.filter(function(c){return isOv(c,now);});
    } else {
      list=list.filter(function(c){return c.status===DATA.filterStatus;});
    }
  }

  countEl.textContent=list.length+' Client'+(list.length!==1?'s':'');
  container.innerHTML='';

  if(!list.length){
    var e=mk('div'); e.style.cssText='text-align:center;padding:24px 0;color:rgba(245,243,240,.22);font-size:12px';
    e.textContent=q?'No results for "'+q+'"':'No clients. Add your first one.';
    container.appendChild(e); return;
  }

  list=list.slice().sort(function(a,b){
    var ao=isOv(a,now),bo=isOv(b,now);
    if(ao&&!bo)return-1; if(!ao&&bo)return 1;
    return (b.priority||5)-(a.priority||5);
  });

  for(var i=0;i<list.length;i++) container.appendChild(buildClientCard(list[i],now));
}

function buildClientCard(c,now) {
  var ov=isOv(c,now);
  var days=c.lastContact?Math.floor((now-c.lastContact)/86400000):null;
  var chipCls=ov?'chip-overdue':'chip-'+c.status.toLowerCase().replace(' ','-');
  var chipTxt=ov?'Overdue':c.status;

  var card=mk('div','client-card');
  card.setAttribute('data-id',c.id);

  var row1=mk('div','cc-row1');
  var name=mk('div','cc-name'); name.textContent=c.name;
  var chip=mk('span','status-chip '+chipCls); chip.textContent=chipTxt;
  row1.appendChild(name); row1.appendChild(chip);

  var det=mk('div','cc-det');
  var detStr=cSub(c);
  if(c.notes&&c.notes.length>0) detStr+=' · '+c.notes.substring(0,50)+(c.notes.length>50?'…':'');
  det.textContent=detStr;

  var lastStr=days===null?'Never contacted':days===0?'Contacted today':'Last: '+days+'d ago';
  if(c.touchpoints) lastStr+=' · '+c.touchpoints+'×';

  var foot=mk('div','cc-foot');
  var last=mk('div','cc-last'); last.textContent=lastStr;
  var btns=mk('div','cc-btns');

  var doneBtn=mk('button','mini-btn green'); doneBtn.textContent='✓';
  doneBtn.setAttribute('data-act','done'); doneBtn.setAttribute('data-id',c.id);
  var draftBtn=mk('button','mini-btn'); draftBtn.textContent='Draft';
  draftBtn.setAttribute('data-act','draft'); draftBtn.setAttribute('data-id',c.id);

  btns.appendChild(doneBtn); btns.appendChild(draftBtn);
  foot.appendChild(last); foot.appendChild(btns);
  card.appendChild(row1); card.appendChild(det); card.appendChild(foot);

  doneBtn.addEventListener('click',function(e){e.stopPropagation();markContacted(c.id);});
  draftBtn.addEventListener('click',function(e){e.stopPropagation();quickDraft(c.id);});
  card.addEventListener('click',function(){openDetail(c.id);});
  return card;
}

function saveClient() {
  var fn=g('nc-fn').value.trim();
  if(!fn){alert('First name required.');return;}
  var c={
    id:'c_'+Date.now(), name:(fn+' '+g('nc-ln').value.trim()).trim(),
    phone:g('nc-ph').value.trim(), email:g('nc-em').value.trim(),
    status:g('nc-st').value, type:g('nc-ty').value,
    budget:g('nc-bu').value.trim(), neighborhood:g('nc-nb').value.trim(),
    preferences:g('nc-pr').value.trim(), timeline:g('nc-tl').value.trim(),
    notes:g('nc-no').value.trim(), source:g('nc-src').value.trim(),
    fuDays:parseInt(g('nc-fd').value)||5, priority:parseInt(g('nc-pri').value)||5,
    lastContact:null, touchpoints:0, callNotes:[], createdAt:Date.now()
  };
  DATA.clients.push(c);
  addLog('👤',c.name,'Added · '+c.type+' · '+c.status+(c.budget?' · '+c.budget:''));
  save(); closeSheet('add');
  ['nc-fn','nc-ln','nc-ph','nc-em','nc-bu','nc-nb','nc-pr','nc-tl','nc-no','nc-src'].forEach(function(id){var e=g(id);if(e)e.value='';});
  g('nc-st').value='Warm'; g('nc-fd').value='5'; g('nc-pri').value='5';
  DATA.tipShown=false; renderAll();
  if(c.status==='Hot'){
    setTimeout(function(){
      goTab('ai');
      sendMsg('I just added '+c.name+' as a hot '+c.type+(c.budget?', budget '+c.budget:'')+'. Give me my best strategy and draft the first message to send them right now.',true);
    },400);
  }
}

function markContacted(id) {
  var c=findC(id); if(!c)return;
  c.lastContact=Date.now(); c.touchpoints=(c.touchpoints||0)+1;
  addLog('✓',c.name,'Contacted · touch #'+c.touchpoints);
  chrome.runtime.sendMessage({type:'LOG_CONTACT',id:id});
  save(); renderAll();
}

function setStatus(id,st) {
  var c=findC(id); if(!c)return;
  var old=c.status; c.status=st;
  addLog('◈',c.name,'Status: '+old+' → '+st);
  save(); renderAll(); closeSheet('detail');
  if(st==='Closed'){
    setTimeout(function(){
      goTab('ai');
      var q='I just closed a deal with '+c.name+'.';
      if(c.budget) q+=' Around '+c.budget+'.';
      q+=' What should I do in the next 48 hours to maximize the chance of getting a referral and a 5-star review?';
      sendMsg(q,false);
    },300);
  }
}

function deleteClient(id) {
  var c=findC(id); if(c) addLog('✗',c.name,'Removed from pipeline');
  DATA.clients=DATA.clients.filter(function(x){return x.id!==id;});
  save(); renderAll(); closeSheet('detail');
}

function openDetail(id) {
  var c=findC(id); if(!c)return;
  var now=Date.now();
  var days=c.lastContact?Math.floor((now-c.lastContact)/86400000):null;
  var lastStr=days===null?'Never contacted':days===0?'Contacted today':'Last: '+days+'d ago';
  if(c.touchpoints) lastStr+=' · '+c.touchpoints+' touches';

  var sheet=g('sheet-detail');
  sheet.innerHTML='';

  // Header
  var top=mk('div','sheet-top');
  var title=mk('div','sheet-title'); title.textContent=c.name;
  var xBtn=mk('button','sheet-x'); xBtn.innerHTML='&#10005;';
  xBtn.addEventListener('click',function(){closeSheet('detail');});
  top.appendChild(title); top.appendChild(xBtn); sheet.appendChild(top);

  // Meta
  var meta=mk('div','det-meta');
  meta.textContent=c.type+' · '+c.status+(c.priority?' · P'+c.priority:'')+' · '+lastStr;
  sheet.appendChild(meta);

  // Primary actions
  var ag=mk('div','det-action-grid');
  var doneBtn=mk('button','det-action-btn primary'); doneBtn.textContent='✓ Mark Contacted';
  doneBtn.addEventListener('click',function(){markContacted(id);closeSheet('detail');});
  var draftBtn=mk('button','det-action-btn'); draftBtn.textContent='Draft Message';
  draftBtn.addEventListener('click',function(){closeSheet('detail');quickDraft(id);});
  ag.appendChild(doneBtn); ag.appendChild(draftBtn); sheet.appendChild(ag);

  // Ask AI
  var askBtn=mk('button','det-action-wide');
  askBtn.textContent='Ask Nexus AI about this client →';
  askBtn.addEventListener('click',function(){closeSheet('detail');askAbout(id);});
  sheet.appendChild(askBtn);

  // Fields
  var fields=mk('div','det-fields-block');
  var fDefs=[];
  if(c.phone) fDefs.push({html:'<a href="tel:'+esc(c.phone)+'">'+esc(c.phone)+'</a>'});
  if(c.email) fDefs.push({html:'<a href="mailto:'+esc(c.email)+'">'+esc(c.email)+'</a>'});
  if(c.budget) fDefs.push({html:'<span style="opacity:.5;font-size:10px">Budget: </span>'+esc(c.budget)});
  if(c.neighborhood) fDefs.push({html:'<span style="opacity:.5;font-size:10px">Areas: </span>'+esc(c.neighborhood)});
  if(c.preferences) fDefs.push({html:'<span style="opacity:.5;font-size:10px">Wants: </span>'+esc(c.preferences)});
  if(c.timeline) fDefs.push({html:'<span style="opacity:.5;font-size:10px">Timeline: </span>'+esc(c.timeline)});
  if(c.notes) fDefs.push({html:esc(c.notes)});
  if(c.source) fDefs.push({html:'<span style="opacity:.4;font-size:10px">Source: '+esc(c.source)+'</span>'});
  for(var fi=0;fi<fDefs.length;fi++){
    var fd=mk('div','det-field'); fd.innerHTML=fDefs[fi].html; fields.appendChild(fd);
  }
  sheet.appendChild(fields);

  // Status update
  var sec1=mk('div','det-sec'); sec1.textContent='Update Status'; sheet.appendChild(sec1);
  var stRow=mk('div','status-row');
  ['Hot','Warm','Cold','Booked','Closed'].forEach(function(st){
    var btn=mk('button','st-pill'+(c.status===st?' on':''));
    btn.textContent=st; btn.setAttribute('data-st',st);
    btn.addEventListener('click',function(){setStatus(id,st);});
    stRow.appendChild(btn);
  });
  sheet.appendChild(stRow);

  // Call notes
  var sec2=mk('div','det-sec'); sec2.textContent='Call Notes'; sheet.appendChild(sec2);
  var notesBlk=mk('div','det-fields-block');
  if(c.callNotes&&c.callNotes.length>0){
    var recent=c.callNotes.slice(-4).reverse();
    for(var ni=0;ni<recent.length;ni++){
      var nItem=mk('div','call-note-item'); nItem.textContent=recent[ni].text;
      var nTime=mk('div','call-note-t'); nTime.textContent=ago(recent[ni].time);
      nItem.appendChild(nTime); notesBlk.appendChild(nItem);
    }
  } else {
    var noN=mk('div','call-note-item'); noN.textContent='No call notes yet.'; notesBlk.appendChild(noN);
  }
  sheet.appendChild(notesBlk);

  var cnBar=mk('div','cn-bar');
  var cnInp=mk('input','cn-input'); cnInp.placeholder='Add a note from this call…';
  var cnSave=mk('button','cn-save'); cnSave.textContent='Save';
  cnSave.addEventListener('click',function(){
    if(!cnInp.value.trim())return;
    var note=cnInp.value.trim();
    if(!c.callNotes)c.callNotes=[];
    c.callNotes.push({text:note,time:Date.now()});
    addLog('📝',c.name,'Note: '+note.substring(0,60));
    save(); cnInp.value='';
    renderMiniLog(); renderPipeline();
  });
  cnBar.appendChild(cnInp); cnBar.appendChild(cnSave); sheet.appendChild(cnBar);

  // Delete
  var delBtn=mk('button','det-remove'); delBtn.textContent='Remove client';
  delBtn.addEventListener('click',function(){if(confirm('Remove '+c.name+'?'))deleteClient(id);});
  sheet.appendChild(delBtn);

  openSheet('detail');
}

function askAbout(id) {
  var c=findC(id); if(!c)return;
  goTab('ai');
  var parts=['Deep analysis for '+c.name+'. '+c.type];
  if(c.budget) parts.push(', budget '+c.budget);
  if(c.neighborhood) parts.push(', target areas: '+c.neighborhood);
  if(c.preferences) parts.push(', property wants: '+c.preferences);
  if(c.timeline) parts.push(', timeline: '+c.timeline);
  if(c.notes) parts.push('. Context: '+c.notes);
  if(c.source) parts.push('. Lead source: '+c.source);
  if(c.touchpoints) parts.push('. Contacted '+c.touchpoints+' times.');
  if(c.lastContact){
    var d=Math.floor((Date.now()-c.lastContact)/86400000);
    parts.push(' Last contact '+d+' days ago.');
  }
  parts.push(' Give me: (1) specific strategy for this exact person, (2) the best message to send them right now, (3) what to say on the call.');
  sendMsg(parts.join(''),true);
}

// ── PIPELINE ─────────────────────────────────────────────────────
function renderPipeline() {
  var now=Date.now(), ov=getOv();
  var hot=0,warm=0,cold=0,bkd=0,closed=0;
  for(var i=0;i<DATA.clients.length;i++){
    var s=DATA.clients[i].status;
    if(s==='Hot')hot++; if(s==='Warm')warm++; if(s==='Cold')cold++;
    if(s==='Booked')bkd++; if(s==='Closed')closed++;
  }
  var pvVal=pv(), total=DATA.clients.length, rate=total>0?Math.round((closed/total)*100):0;

  var stats=g('pipeline-stats');
  stats.innerHTML='';
  var pStats=[
    {l:'Active Leads',v:hot+warm+bkd,c:'jade'},
    {l:'Pipeline Value',v:fmtMoney(pvVal),c:''},
    {l:'Overdue Follow-Ups',v:ov.length,c:ov.length>0?'amber':''},
    {l:'Close Rate',v:rate+'%',c:''}
  ];
  for(var pi=0;pi<pStats.length;pi++){
    var ps=pStats[pi];
    var div=mk('div','pipe-stat');
    var lbl=mk('div','pipe-stat-lbl'); lbl.textContent=ps.l;
    var val=mk('div','pipe-stat-val'+(ps.c?' '+ps.c:'')); val.textContent=ps.v;
    div.appendChild(lbl); div.appendChild(val); stats.appendChild(div);
  }

  // Kanban
  var kanban=g('pipeline-kanban');
  kanban.innerHTML='';
  var klbl=mk('div','kanban-label'); klbl.textContent='Pipeline Breakdown';
  var kRow=mk('div','kanban-row');
  var cols=[
    {n:'Hot',v:hot,c:'jade'},{n:'Warm',v:warm,c:''},{n:'Cold',v:cold,c:''},
    {n:'Booked',v:bkd,c:'jade'},{n:'Closed',v:closed,c:''}
  ];
  for(var ci=0;ci<cols.length;ci++){
    var col=mk('div','kanban-col');
    var cn=mk('div','kanban-col-name'); cn.textContent=cols[ci].n;
    var cv=mk('div','kanban-col-n'+(cols[ci].c?' '+cols[ci].c:'')); cv.textContent=cols[ci].v;
    var cs=mk('div','kanban-col-sub'); cs.textContent=cols[ci].v===1?'lead':'leads';
    col.appendChild(cn); col.appendChild(cv); col.appendChild(cs);
    kRow.appendChild(col);
  }
  kanban.appendChild(klbl); kanban.appendChild(kRow);

  // Follow-up queue
  var fuQ=g('fu-queue');
  fuQ.innerHTML='';
  var fuItems=[];
  for(var j=0;j<DATA.clients.length;j++){
    var fc=DATA.clients[j]; if(fc.status==='Closed')continue;
    var elapsed=fc.lastContact?(now-fc.lastContact)/86400000:999;
    var thr=fc.fuDays||DATA.cfg.fuDays||5;
    if(elapsed>=thr||(elapsed>=thr-2&&elapsed<thr)){
      fuItems.push({c:fc,days:Math.floor(elapsed),ov:elapsed>=thr});
    }
  }
  fuItems.sort(function(a,b){return b.days-a.days;});
  if(!fuItems.length){
    var fe=mk('div'); fe.style.cssText='text-align:center;padding:14px 0;color:rgba(245,243,240,.22);font-size:12px';
    fe.textContent='✓ No follow-ups due.'; fuQ.appendChild(fe);
  } else {
    for(var fi=0;fi<fuItems.length;fi++) fuQ.appendChild(buildFUItem(fuItems[fi]));
  }

  // Full log
  buildLog(g('full-log'), 0);
}

function buildFUItem(item) {
  var c=item.c;
  var card=mk('div','fu-item'+(item.ov?' overdue':''));

  var top=mk('div','fu-top');
  var name=mk('div','fu-name'); name.textContent=c.name;
  var days=mk('div','fu-days '+(item.ov?'overdue':'soon'));
  days.textContent=item.days+'d';
  top.appendChild(name); top.appendChild(days);

  var sub=mk('div','fu-sub');
  var subTxt=cSub(c);
  if(c.notes&&c.notes.length>0) subTxt+=' · '+c.notes.substring(0,55)+(c.notes.length>55?'…':'');
  sub.textContent=subTxt;

  var btns=mk('div','fu-btns');
  var doneBtn=mk('button','ac-btn primary'); doneBtn.textContent='✓ Done';
  doneBtn.addEventListener('click',function(){markContacted(c.id);});
  var draftBtn=mk('button','ac-btn'); draftBtn.textContent='Draft';
  draftBtn.addEventListener('click',function(){quickDraft(c.id);});
  var viewBtn=mk('button','ac-btn'); viewBtn.textContent='View';
  viewBtn.addEventListener('click',function(){openDetail(c.id);});
  btns.appendChild(doneBtn); btns.appendChild(draftBtn); btns.appendChild(viewBtn);

  card.appendChild(top); card.appendChild(sub); card.appendChild(btns);
  return card;
}

// ── TOOLS ────────────────────────────────────────────────────────
function renderTools() {
  var grid=g('tools-grid');
  grid.innerHTML='';
  var tools=[
    {ico:'🧮',name:'Deal Calculator',desc:'Commission, mortgage, affordability, and ROI calculations',action:function(){openCalcSheet();}},
    {ico:'📊',name:'Market Snapshot',desc:'Analyze current pipeline stats and conversion metrics',action:function(){goTab('ai');setTimeout(function(){sendMsg('Give me a full market and pipeline analysis. How am I performing? What should I change?',false);},100);}},
    {ico:'📞',name:'Call List',desc:'Generate a prioritized call list for today',action:function(){goTab('ai');setTimeout(function(){sendMsg('Generate my complete prioritized call list for today. Include each person\'s details, why they\'re a priority, and a suggested opener.',false);},100);}},
    {ico:'✉',name:'Email Sequences',desc:'Build a multi-touch follow-up campaign for any lead',action:function(){goTab('ai');setTimeout(function(){sendMsg('Build me a 5-email follow-up sequence for a new warm buyer lead. Subject lines, timing, and full body copy for each.',false);},100);}},
    {ico:'🎯',name:'Objection Bank',desc:'Responses to any objection buyers or sellers throw at you',action:function(){goTab('ai');setTimeout(function(){sendMsg('Give me the ultimate objection handling guide. Cover: price too high, not ready yet, need to think about it, going with another agent, market is uncertain. For each: 3 responses ranked by effectiveness.',false);},100);}},
    {ico:'🏡',name:'Listing Pitch Kit',desc:'AI-powered scripts for winning any listing appointment',action:function(){goTab('ai');setTimeout(function(){sendMsg('Build me a complete listing appointment pitch. Pre-appointment script, pricing conversation, commission objection handler, and closing ask. Make it feel natural, not scripted.',false);},100);}},
    {ico:'💼',name:'Investor Brief',desc:'Analyze any deal for investor clients',action:function(){goTab('ai');setTimeout(function(){sendMsg('My investor client is looking at a property. Walk me through the key analysis framework: cap rate, cash-on-cash, appreciation potential, and red flags to check. Give me the questions I should be asking.',false);},100);}},
    {ico:'🤝',name:'Referral System',desc:'Scripts and strategies to systematize referral generation',action:function(){goTab('ai');setTimeout(function(){sendMsg('Build me a complete referral system. When to ask, exactly what to say, how to follow up, and how to keep past clients warm so referrals come naturally. Include specific scripts.',false);},100);}},
    {ico:'📋',name:'CMA Assistant',desc:'Guide to building a compelling comparative market analysis',action:function(){goTab('ai');setTimeout(function(){sendMsg('Walk me through how to build a compelling CMA presentation that wins the listing. What data to pull, how to present it, and how to use it to justify your pricing recommendation.',false);},100);}},
    {ico:'🧠',name:'Negotiation Playbook',desc:'Tactical negotiation strategies for buyers and sellers',action:function(){goTab('ai');setTimeout(function(){sendMsg('Give me a negotiation playbook for real estate. Cover: anchoring strategies, how to handle multiple offers, when to counter vs accept, reading the other side\'s urgency, and protecting my client\'s position.',false);},100);}},
    {ico:'📱',name:'Social & Listing Copy',desc:'Turn any property into a week of Instagram, TikTok & LinkedIn content',action:function(){openContentSheet();}},
    {ico:'📨',name:'Outreach & Follow-Up',desc:'Personalized cold outreach and re-engagement sequences for old leads',action:function(){openOutreachSheet();}},
    {ico:'📍',name:'Local Market Script',desc:'Turn live MLS/market data into a clean, textable client update',action:function(){openMarketSheet();}},
    {ico:'🏠',name:'Property Lookup',desc:'Pull live value estimates, rent data & comparable listings for any address',action:function(){openPropertySheet();}},
    {ico:'💰',name:'Rent Estimator',desc:'Instant rent estimate for any address — great for investor clients',action:function(){openPropertySheet('rent');}},
    {ico:'🔍',name:'Comparable Listings',desc:'Search active listings near any address via Realty API',action:function(){openPropertySheet('comps');}}
  ];
  for(var i=0;i<tools.length;i++){
    var t=tools[i];
    var tile=mk('div','tool-tile');
    var ico=mk('div','tool-ico'); ico.textContent=t.ico;
    var name=mk('div','tool-name'); name.textContent=t.name;
    var desc=mk('div','tool-desc'); desc.textContent=t.desc;
    tile.appendChild(ico); tile.appendChild(name); tile.appendChild(desc);
    tile.addEventListener('click', t.action);
    grid.appendChild(tile);
  }
}

// ── PROPERTY LOOKUP ──────────────────────────────────────────────
// ── SOCIAL MEDIA & LISTING COPY ────────────────────────────────────
function openContentSheet() {
  var addr=window.prompt('Property address or short description:');
  if(!addr) return;
  var details=window.prompt('Key details (beds/baths/sqft, price, standout features, neighborhood highlights):')||'';
  goTab('ai');
  setTimeout(function(){
    sendMsg('Generate a full week of multi-platform marketing content for this listing.\n\n'
      +'Property: '+addr+'\n'
      +'Details: '+details+'\n\n'
      +'Give me:\n'
      +'1. A polished MLS-ready property description (2 versions: one luxury/aspirational tone, one concise/factual).\n'
      +'2. A 7-day content calendar with one post per day, covering Instagram, TikTok, and LinkedIn — rotate formats (just-listed announcement, feature highlight/reel script, neighborhood lifestyle, behind-the-scenes, open house countdown, social proof/testimonial style, final call-to-action).\n'
      +'3. For each post: platform, caption (with line breaks and emojis where appropriate), and a hashtag set.\n'
      +'4. For any video/reel posts, include a short shot list or script.\n'
      +'Make it ready to copy-paste and post immediately.', false);
  },100);
}

// ── COLD OUTREACH & FOLLOW-UP AUTOMATION ───────────────────────────
function openOutreachSheet() {
  var clientName=window.prompt('Client name (leave blank for a general/cold-lead sequence):')||'';
  var notes=window.prompt('Anything specific to tailor this to (neighborhood, how old the lead is, why they went quiet, etc.)?')||'';
  goTab('ai');
  setTimeout(function(){
    var who=clientName?('my lead '+clientName):'an old lead that has gone cold';
    sendMsg('Build a complete re-engagement and follow-up sequence for '+who+'.\n'
      +(notes?('Context: '+notes+'\n'):'')
      +'\nInclude:\n'
      +'1. A personalized first-touch email (subject line + body) referencing their neighborhood and likely current situation in the market.\n'
      +'2. A short, casual check-in text message version of the same touch.\n'
      +'3. A 4-touch follow-up cadence over 3 weeks (mix of email and text) for if they don\'t respond — each with timing and full copy.\n'
      +'4. A final "permission to close the file" message for if there\'s still no response.\n'
      +'Use specific neighborhood/market data where relevant to make it feel personal, not templated. No fluff, ready to send.', false);
  },100);
}

// ── LOCAL MARKET & DATA SUMMARIES ───────────────────────────────────
function openMarketSheet() {
  var area=window.prompt('Neighborhood, city, or zip code to summarize:');
  if(!area) return;
  var audience=window.prompt('Who is this for? (e.g. "buyer client", "seller thinking of listing", "general newsletter")')||'a client';
  goTab('ai');
  setTimeout(function(){
    sendMsg('Pull together a local market snapshot for '+area+' and turn it into a clean, textable script for '+audience+'.\n\n'
      +'1. Summarize the key stats an agent should know right now: median sale price, recent price trend, average days on market, inventory levels, and whether it leans buyer or seller market. If you don\'t have live data, give realistic current-market estimates and clearly note they should be verified against the agent\'s MLS before sending.\n'
      +'2. Translate that into a short, friendly text message (3-5 sentences) the agent can send as-is — confident, hyper-local, no jargon.\n'
      +'3. Also give a slightly longer version (for email or a social caption) that positions the agent as the local expert.\n'
      +'4. Suggest one natural follow-up question or call-to-action to include.', false);
  },100);
}

function openPropertySheet(defaultMode) {
  g('prop-address').value='';
  g('prop-sqft').value='';
  g('prop-results').innerHTML='';
  openSheet('property');
  if(defaultMode==='rent') setTimeout(function(){doPropertyLookup('rent');},100);
  if(defaultMode==='comps') setTimeout(function(){
    var addr=g('prop-address').value.trim();
    if(addr) doPropertyLookup('comps');
  },100);
}

function showPropLoading(msg) {
  var el=g('prop-results');
  el.innerHTML='';
  var loader=mk('div','prop-loading'); loader.textContent=msg||'Fetching data…';
  el.appendChild(loader);
}

function showPropError(msg) {
  var el=g('prop-results');
  el.innerHTML='';
  var err=mk('div','prop-error'); err.textContent='⚠ '+msg;
  el.appendChild(err);
}

function showPropResult(rows, title, talkToAI) {
  var el=g('prop-results');
  el.innerHTML='';
  if(title){
    var h=mk('div','prop-result-title'); h.textContent=title; el.appendChild(h);
  }
  for(var i=0;i<rows.length;i++){
    var row=mk('div','prop-result-row');
    var lbl=mk('span','prop-result-lbl'); lbl.textContent=rows[i].l+':';
    var val=mk('span','prop-result-val'); val.textContent=rows[i].v;
    row.appendChild(lbl); row.appendChild(val); el.appendChild(row);
  }
  if(talkToAI){
    var aiBtn=mk('button','sheet-cta secondary');
    aiBtn.textContent='Discuss with Nexus AI →';
    aiBtn.addEventListener('click',function(){
      closeSheet('property');
      goTab('ai');
      sendMsg(talkToAI, false);
    });
    el.appendChild(aiBtn);
  }
}

function doPropertyLookup(mode) {
  var addr=g('prop-address').value.trim();
  if(!addr){showPropError('Please enter a property address first.');return;}

  var beds=g('prop-beds').value;
  var baths=g('prop-baths').value;
  var type=g('prop-type').value;
  var sqft=g('prop-sqft').value;

  if(mode==='rent'){
    var rcKey=DATA.cfg.rentcastKey||'';
    if(!rcKey){showPropError('RentCast API key not set. Add it in Settings → Market Data APIs.');return;}
    showPropLoading('Fetching rent estimate from RentCast…');
    var rcParams={address:addr,propertyType:type,bedrooms:beds,bathrooms:baths};
    if(sqft) rcParams.squareFootage=sqft;
    chrome.runtime.sendMessage({
      type:'RENTCAST_CALL', key:rcKey,
      endpoint:'avm/rent/long-term', params:rcParams
    },function(r){
      if(chrome.runtime.lastError){showPropError('Extension error: '+chrome.runtime.lastError.message);return;}
      if(!r||!r.ok){showPropError(r&&r.text?r.text:'Failed to fetch rent estimate.');return;}
      var d=r.data;
      var low=d.rentRangeLow?fmtFull(d.rentRangeLow):null;
      var high=d.rentRangeHigh?fmtFull(d.rentRangeHigh):null;
      var rows=[
        {l:'Estimated Rent',v:d.rent?fmtFull(d.rent)+'/mo':'—'},
        {l:'Rent Range',v:(low&&high)?low+' – '+high+'/mo':'—'},
        {l:'Property Type',v:d.propertyType||type},
        {l:'Bedrooms',v:d.bedrooms||beds},
        {l:'Bathrooms',v:d.bathrooms||baths}
      ];
      if(d.latitude&&d.longitude) rows.push({l:'Coordinates',v:d.latitude.toFixed(4)+', '+d.longitude.toFixed(4)});
      var aiCtx='I looked up the rent estimate for '+addr+'. '
        +'The RentCast estimate is '+(d.rent?'$'+d.rent+'/month':'unavailable')+'.'
        +(low&&high?' The rent range is $'+d.rentRangeLow+'–$'+d.rentRangeHigh+'.'  :'')
        +' Property type: '+type+', '+beds+' bed/'+baths+' bath.'
        +' What does this mean for my investor client? Is this a good rental? What cap rate and cash-on-cash should we target?';
      showPropResult(rows,'Rent Estimate — '+addr, aiCtx);
    });

  } else if(mode==='value'){
    var rcKey2=DATA.cfg.rentcastKey||'';
    if(!rcKey2){showPropError('RentCast API key not set. Add it in Settings → Market Data APIs.');return;}
    showPropLoading('Fetching property value estimate from RentCast…');
    var valParams={address:addr,propertyType:type,bedrooms:beds,bathrooms:baths};
    if(sqft) valParams.squareFootage=sqft;
    chrome.runtime.sendMessage({
      type:'RENTCAST_CALL', key:rcKey2,
      endpoint:'avm/value', params:valParams
    },function(r){
      if(chrome.runtime.lastError){showPropError('Extension error: '+chrome.runtime.lastError.message);return;}
      if(!r||!r.ok){showPropError(r&&r.text?r.text:'Failed to fetch value estimate.');return;}
      var d=r.data;
      var rows=[
        {l:'Estimated Value',v:d.price?fmtFull(d.price):'—'},
        {l:'Value Range Low',v:d.priceRangeLow?fmtFull(d.priceRangeLow):'—'},
        {l:'Value Range High',v:d.priceRangeHigh?fmtFull(d.priceRangeHigh):'—'},
        {l:'Price/Sq Ft',v:d.pricePerSquareFoot?'$'+Math.round(d.pricePerSquareFoot)+'/sqft':'—'},
        {l:'Listing Type',v:d.listingType||'—'}
      ];
      if(d.comparables&&d.comparables.length) rows.push({l:'Comparable Sales Used',v:d.comparables.length+''});
      var aiCtx='I looked up the property value for '+addr+'. '
        +'RentCast estimates it at '+(d.price?'$'+d.price.toLocaleString():'an unknown amount')+'.'
        +(d.priceRangeLow&&d.priceRangeHigh?' Range: $'+d.priceRangeLow.toLocaleString()+' to $'+d.priceRangeHigh.toLocaleString()+'.'  :'')
        +' '+beds+' bed/'+baths+' bath '+type+'.'
        +' What pricing strategy should I discuss with my client? Is this priced well for the market?';
      showPropResult(rows,'Value Estimate — '+addr, aiCtx);
    });

  } else if(mode==='comps'){
    var ralKey=DATA.cfg.realtyKey||'';
    if(!ralKey){showPropError('Realty API key not set. Add it in Settings → Market Data APIs.');return;}
    showPropLoading('Searching comparable listings via Realty API…');
    chrome.runtime.sendMessage({
      type:'REALTY_CALL', key:ralKey,
      endpoint:'properties/v3/list',
      method:'POST',
      body:{
        location: addr,
        status:['for_sale'],
        type:[type.toLowerCase().replace(' ','_')],
        limit:5
      }
    },function(r){
      if(chrome.runtime.lastError){showPropError('Extension error: '+chrome.runtime.lastError.message);return;}
      if(!r||!r.ok){showPropError(r&&r.text?r.text:'Failed to fetch listings.');return;}
      var d=r.data;
      var props=(d.data&&d.data.results)||d.results||d.properties||[];
      if(!props.length){showPropError('No active listings found near that address.');return;}
      var el=g('prop-results');
      el.innerHTML='';
      var titleEl=mk('div','prop-result-title'); titleEl.textContent='Comparable Listings near '+addr; el.appendChild(titleEl);
      var summary='';
      for(var pi=0;pi<Math.min(props.length,5);pi++){
        var p=props[pi];
        var pAddr=(p.location&&p.location.address)||(p.address&&(p.address.line||p.address.street_address))||'Unknown address';
        var pPrice=p.list_price||p.price||(p.description&&p.description.list_price)||0;
        var pBeds=(p.description&&p.description.beds)||p.beds||'?';
        var pBaths=(p.description&&p.description.baths_consolidated)||p.baths||'?';
        var pSqft=(p.description&&p.description.sqft)||p.sqft||null;
        var pDom=(p.list_date||p.listing_date)?Math.floor((Date.now()-new Date(p.list_date||p.listing_date).getTime())/86400000)+' days on market':'';
        var card=mk('div','comp-card');
        var cAddr=mk('div','comp-addr'); cAddr.textContent=pAddr; card.appendChild(cAddr);
        var cDetails=mk('div','comp-details');
        var parts2=[pBeds+' bd',pBaths+' ba'];
        if(pSqft) parts2.push(parseInt(pSqft).toLocaleString()+' sqft');
        if(pDom) parts2.push(pDom);
        cDetails.textContent=parts2.join(' · ');
        card.appendChild(cDetails);
        var cPrice=mk('div','comp-price'); cPrice.textContent=pPrice?'$'+parseInt(pPrice).toLocaleString():'Price N/A'; card.appendChild(cPrice);
        el.appendChild(card);
        summary+=(pi+1)+'. '+pAddr+' — '+(pPrice?'$'+parseInt(pPrice).toLocaleString():' price N/A')+', '+pBeds+'bd/'+pBaths+'ba'+(pSqft?', '+pSqft+' sqft':'')+(pDom?', '+pDom:'')+'\n';
      }
      var aiBtn=mk('button','sheet-cta secondary');
      aiBtn.textContent='Analyze comps with Nexus AI →';
      aiBtn.addEventListener('click',function(){
        closeSheet('property');
        goTab('ai');
        sendMsg('I pulled '+Math.min(props.length,5)+' comparable listings near '+addr+':\n\n'+summary+'\nAnalyze these comps for me. What do they tell me about pricing, days on market, and market temperature? What should I tell my client?',false);
      });
      el.appendChild(aiBtn);
    });
  }
}

// ── SCRIPTS ──────────────────────────────────────────────────────
function renderScripts() {
  var list=g('scripts-list');
  list.innerHTML='';
  if(!DATA.scripts.length){
    var e=mk('div'); e.style.cssText='text-align:center;padding:24px 0;color:rgba(245,243,240,.22);font-size:12px';
    e.textContent='No scripts. Add templates and Nexus personalizes them.';
    list.appendChild(e); return;
  }
  for(var i=0;i<DATA.scripts.length;i++){
    var s=DATA.scripts[i];
    var card=mk('div','script-card');
    card.setAttribute('data-sid',s.id);
    var name=mk('div','script-name'); name.textContent=s.name;
    var prev=mk('div','script-preview'); prev.textContent=s.body.substring(0,90)+'…';
    card.appendChild(name); card.appendChild(prev);
    card.addEventListener('click',function(sid){return function(){useScript(sid);};}(s.id));
    list.appendChild(card);
  }
}

function saveScript() {
  var nm=g('sc-name').value.trim(), bd=g('sc-body').value.trim();
  if(!nm||!bd){alert('Name and body required.');return;}
  DATA.scripts.push({id:'s_'+Date.now(),name:nm,body:bd});
  save(); closeSheet('script'); renderScripts();
  g('sc-name').value=''; g('sc-body').value='';
}

function useScript(id) {
  var s=DATA.scripts.find(function(x){return x.id===id;}); if(!s)return;
  var sorted=DATA.clients.filter(function(c){return c.status!=='Closed';}).sort(function(a,b){return(b.priority||5)-(a.priority||5);});
  var top=sorted[0]||null;
  var who=top?top.name+' ('+top.type+(top.budget?', '+top.budget:'')+(top.neighborhood?', '+top.neighborhood:'')+')'    :'my most relevant active client';
  goTab('ai');
  sendMsg('Personalize this script for '+who+':\n\n'+s.body+'\n\nReplace every placeholder with real, specific data. Make it sound completely natural — not like a template. Add any relevant personal details you know about this client.',true);
}

// ── LOG ──────────────────────────────────────────────────────────
function addLog(ico,name,detail){
  DATA.log.unshift({ico:ico,name:name,detail:detail,time:Date.now()});
  if(DATA.log.length>100) DATA.log=DATA.log.slice(0,100);
}

function openLogSheet() {
  var sel=g('log-client');
  sel.innerHTML='<option value="">Select client…</option>';
  for(var i=0;i<DATA.clients.length;i++){
    var c=DATA.clients[i]; if(c.status==='Closed')continue;
    var opt=document.createElement('option');
    opt.value=c.id; opt.textContent=c.name; sel.appendChild(opt);
  }
  openSheet('log');
}

function saveLog() {
  var cid=g('log-client').value, type=g('log-type').value, note=g('log-note').value.trim();
  if(!cid){alert('Please select a client.');return;}
  var c=findC(cid); if(!c)return;
  var icons={call:'📞',meeting:'🤝',showing:'🏡',offer:'📋',email:'✉',text:'💬',note:'📝'};
  var detail=type.charAt(0).toUpperCase()+type.slice(1)+(note?': '+note.substring(0,60):'');
  addLog(icons[type]||'◎',c.name,detail);
  if(['call','meeting','showing'].indexOf(type)!==-1){c.lastContact=Date.now();c.touchpoints=(c.touchpoints||0)+1;}
  if(note){if(!c.callNotes)c.callNotes=[];c.callNotes.push({text:'['+type+']: '+note,time:Date.now()});}
  save(); closeSheet('log'); renderAll(); g('log-note').value='';
}

// ── CALCULATOR ───────────────────────────────────────────────────
function openCalcSheet() {
  openSheet('calc');
  renderCalc('commission');
  g('calc-tabs').querySelectorAll('.calc-tab').forEach(function(btn){
    btn.addEventListener('click',function(){
      g('calc-tabs').querySelectorAll('.calc-tab').forEach(function(b){b.classList.remove('active');});
      btn.classList.add('active');
      renderCalc(btn.getAttribute('data-calc'));
    });
  });
}

function renderCalc(type) {
  var body=g('calc-body');
  body.innerHTML='';

  if(type==='commission'){
    body.appendChild(buildCalcSection([
      {id:'cc-price',label:'Sale Price ($)',ph:'650000',type:'number'},
      {id:'cc-rate',label:'Commission Rate (%)',ph:'2.8',type:'number'}
    ],function(){
      var price=parseFloat(g('cc-price').value)||0;
      var rate=parseFloat(g('cc-rate').value)||2.8;
      var comm=price*(rate/100);
      var split=comm*0.5;
      return [{l:'Total Commission',v:fmtFull(comm)},{l:'Your Split (50%)',v:fmtFull(split)},{l:'After 30% Brokerage',v:fmtFull(split*0.7)}];
    },'Your Commission'));
  } else if(type==='mortgage'){
    body.appendChild(buildCalcSection([
      {id:'mc-price',label:'Home Price ($)',ph:'650000',type:'number'},
      {id:'mc-down',label:'Down Payment (%)',ph:'20',type:'number'},
      {id:'mc-rate',label:'Interest Rate (%)',ph:'6.8',type:'number'},
      {id:'mc-years',label:'Loan Term (years)',ph:'30',type:'number'}
    ],function(){
      var price=parseFloat(g('mc-price').value)||0;
      var down=(parseFloat(g('mc-down').value)||20)/100;
      var annualRate=(parseFloat(g('mc-rate').value)||6.8)/100;
      var years=parseFloat(g('mc-years').value)||30;
      var loan=price*(1-down);
      var r=annualRate/12, n=years*12;
      var monthly=r>0?loan*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1):loan/n;
      var total=monthly*n;
      return [{l:'Loan Amount',v:fmtFull(loan)},{l:'Monthly Payment',v:fmtFull(monthly)},{l:'Total Interest Paid',v:fmtFull(total-loan)},{l:'Total Cost',v:fmtFull(total)}];
    },'Monthly Payment'));
  } else if(type==='affordability'){
    body.appendChild(buildCalcSection([
      {id:'af-income',label:'Annual Gross Income ($)',ph:'120000',type:'number'},
      {id:'af-debt',label:'Monthly Debt Payments ($)',ph:'500',type:'number'},
      {id:'af-rate',label:'Interest Rate (%)',ph:'6.8',type:'number'},
      {id:'af-down',label:'Down Payment ($)',ph:'50000',type:'number'}
    ],function(){
      var income=parseFloat(g('af-income').value)||0;
      var debt=parseFloat(g('af-debt').value)||0;
      var annualRate=(parseFloat(g('af-rate').value)||6.8)/100;
      var down=parseFloat(g('af-down').value)||0;
      var monthlyIncome=income/12;
      var maxHousing=monthlyIncome*0.28;
      var maxAll=monthlyIncome*0.36-debt;
      var maxPayment=Math.min(maxHousing,maxAll);
      var r=annualRate/12, n=360;
      var maxLoan=r>0?maxPayment*(1-Math.pow(1+r,-n))/r:maxPayment*n;
      var maxPrice=maxLoan+down;
      return [{l:'Max Monthly Payment',v:fmtFull(maxPayment)},{l:'Max Loan Amount',v:fmtFull(maxLoan)},{l:'Max Home Price',v:fmtFull(maxPrice)},{l:'Debt-to-Income',v:Math.round((debt/monthlyIncome)*100)+'%'}];
    },'Maximum Home Price'));
  } else if(type==='roi'){
    body.appendChild(buildCalcSection([
      {id:'roi-price',label:'Purchase Price ($)',ph:'450000',type:'number'},
      {id:'roi-rent',label:'Monthly Rent ($)',ph:'2500',type:'number'},
      {id:'roi-expenses',label:'Monthly Expenses ($)',ph:'800',type:'number'},
      {id:'roi-down',label:'Down Payment (%)',ph:'25',type:'number'}
    ],function(){
      var price=parseFloat(g('roi-price').value)||0;
      var rent=parseFloat(g('roi-rent').value)||0;
      var expenses=parseFloat(g('roi-expenses').value)||0;
      var downPct=(parseFloat(g('roi-down').value)||25)/100;
      var downAmt=price*downPct;
      var noi=(rent-expenses)*12;
      var capRate=price>0?(noi/price)*100:0;
      var cashFlow=(rent-expenses)*12;
      var coc=downAmt>0?(cashFlow/downAmt)*100:0;
      return [{l:'Annual NOI',v:fmtFull(noi)},{l:'Cap Rate',v:capRate.toFixed(2)+'%'},{l:'Cash-on-Cash Return',v:coc.toFixed(2)+'%'},{l:'Monthly Cash Flow',v:fmtFull(rent-expenses)}];
    },'Cap Rate'));
  }
}

function buildCalcSection(fields, calculate, resultLabel) {
  var sec=mk('div','calc-section');
  for(var i=0;i<fields.length;i++){
    var f=fields[i];
    var wrap=mk('div','field-wrap');
    var lbl=mk('label','field-lbl'); lbl.textContent=f.label;
    var inp=mk('input','field-in');
    inp.id=f.id; inp.type=f.type||'text'; inp.placeholder=f.ph;
    inp.addEventListener('input',updateResult);
    wrap.appendChild(lbl); wrap.appendChild(inp); sec.appendChild(wrap);
  }
  var result=mk('div','calc-result');
  var rlbl=mk('div','calc-result-lbl'); rlbl.textContent=resultLabel;
  var rval=mk('div','calc-result-val'); rval.id='calc-result-val'; rval.textContent='—';
  result.appendChild(rlbl); result.appendChild(rval);
  sec.appendChild(result);
  function updateResult(){
    var results=calculate();
    var primary=results[0];
    rval.textContent=primary.v;
    // Show breakdown rows
    var existing=sec.querySelectorAll('.calc-row');
    existing.forEach(function(e){e.remove();});
    for(var ri=1;ri<results.length;ri++){
      var row=mk('div','calc-row');
      var rl=mk('div','calc-lbl'); rl.textContent=results[ri].l;
      var rv=mk('div','calc-val'); rv.textContent=results[ri].v;
      row.appendChild(rl); row.appendChild(rv);
      sec.insertBefore(row,result);
    }
  }
  sec._update=updateResult;
  return sec;
}

function fmtFull(n) {
  return '$'+Math.round(n).toLocaleString();
}

// ── AI CHAT ──────────────────────────────────────────────────────
function doSend() {
  var inp=g('ai-input'), text=inp.value.trim();
  if(!text)return;
  inp.value=''; inp.style.height='auto';
  sendMsg(text,false);
}

function quickDraft(id) {
  var c=findC(id); if(!c)return;
  goTab('ai');
  var parts=['Write the perfect follow-up message for '+c.name+' ('+c.type];
  if(c.budget) parts.push(', budget '+c.budget);
  if(c.neighborhood) parts.push(', target areas: '+c.neighborhood);
  if(c.preferences) parts.push(', wants: '+c.preferences);
  if(c.timeline) parts.push(', timeline: '+c.timeline);
  if(c.notes) parts.push(', notes: '+c.notes);
  parts.push(').');
  if(c.touchpoints) parts.push(' This is touch #'+(c.touchpoints+1)+'.');
  if(c.lastContact){var d=Math.floor((Date.now()-c.lastContact)/86400000);parts.push(' Last contact was '+d+' days ago.');}
  parts.push(' Be warm, personal, specific. Reference what you know about them. Create gentle urgency without pressure.');
  sendMsg(parts.join(''),true);
}

function sendMsg(text, isDraft) {
  appendAIMsg('user',text,null);
  setTyping(true);
  DATA.history.push({role:'user',content:text});

  chrome.runtime.sendMessage({
    type:'AI_CALL', key:DATA.cfg.apiKey||'',
    model: DATA.cfg.model || 'claude-sonnet-4-5',
    system:buildSystem(), messages:DATA.history.slice(-16), maxTokens:1000
  },function(r){
    setTyping(false);
    var reply;
    if(chrome.runtime.lastError) reply='Connection error — please try again.';
    else if(!r) reply='No response from extension.';
    else if(r.text===null){
      var lr=localAI(text); reply=lr.text;
      DATA.history.push({role:'assistant',content:reply});
      if(DATA.history.length>20) DATA.history=DATA.history.slice(-20);
      save(); appendAIMsg('ai',reply,isDraft?lr.draft:null); return;
    } else reply=r.text||'Something went wrong.';

    DATA.history.push({role:'assistant',content:reply});
    if(DATA.history.length>20) DATA.history=DATA.history.slice(-20);
    save();
    var looksLikeDraft=isDraft&&(reply.indexOf('Hi ')===0||reply.indexOf('Hey ')===0||reply.indexOf('Dear ')===0||(reply.indexOf('\n\n')!==-1&&reply.length>100));
    appendAIMsg('ai',reply,looksLikeDraft?reply:null);
  });
}

function buildSystem() {
  var name=DATA.cfg.name||'this agent', brok=DATA.cfg.brokerage?'at '+DATA.cfg.brokerage:'';
  var market=DATA.cfg.market?'Market focus: '+DATA.cfg.market+'. ':'';
  var exp=DATA.cfg.years?DATA.cfg.years+' years in the industry. ':'';
  var now=Date.now(), ov=getOv(), pvVal=pv(), cl='';

  for(var i=0;i<DATA.clients.length;i++){
    var c=DATA.clients[i], d=c.lastContact?Math.floor((now-c.lastContact)/86400000):null, ovr=isOv(c,now);
    cl+='• '+c.name+' ['+c.type+', '+c.status+(ovr?' ⚠OVERDUE':'')+', P'+(c.priority||5);
    if(c.budget) cl+=', '+c.budget;
    if(c.neighborhood) cl+=', areas: '+c.neighborhood;
    if(c.preferences) cl+=', wants: '+c.preferences;
    if(c.timeline) cl+=', timeline: '+c.timeline;
    if(c.notes) cl+=', notes: '+c.notes;
    if(c.source) cl+=', source: '+c.source;
    cl+=', last contact: '+(d!==null?d+'d ago':'never');
    cl+=', touches: '+(c.touchpoints||0)+']\n';
  }

  var ovStr=ov.map(function(c){return c.name+' ('+Math.floor((now-c.lastContact)/86400000)+'d)';}).join(', ');
  var actStr=DATA.log.slice(0,10).map(function(a){return a.name+': '+a.detail;}).join('; ');

  return 'You are Nexus Pro — the elite AI operating system for real estate agent '+name+' '+brok+'.\n\n'
    +'You are the best real estate coach, strategist, and writing partner this agent has ever had. You are outgoing, sharp, tactical, encouraging, and deeply expert in real estate sales, negotiation, marketing, and client psychology.\n\n'
    +'AGENT PROFILE:\n'
    +'Name: '+name+(brok?' · '+brok:'')+'\n'
    +market+exp+'\n'
    +'LIVE PIPELINE ('+DATA.clients.length+' clients · '+fmtMoney(pvVal)+' estimated value):\n'
    +(cl||'No clients yet.\n')+'\n'
    +'OVERDUE FOLLOW-UPS: '+(ovStr||'None')+'\n'
    +'RECENT ACTIVITY: '+(actStr||'None')+'\n\n'
    +'YOUR OPERATING PRINCIPLES:\n'
    +'1. When asked to draft: write the message immediately, no preamble. Lead with the draft, then add context and strategy after.\n'
    +'2. Always push the agent toward their next highest-leverage action. Never just answer and stop.\n'
    +'3. Reference specific client data naturally — their name, exact budget, neighborhood preferences, notes.\n'
    +'4. Give specific, tactical, real-world advice. Not generic. Not theoretical. What works in the field today.\n'
    +'5. After every response, name the single most valuable next thing to do.\n'
    +'6. Celebrate wins genuinely and enthusiastically. Turn losses into crisp, actionable learning.\n'
    +'7. Surface overdue leads proactively when contextually relevant.\n'
    +'8. No emojis in prose. No "Great question!". No filler. No fluff. Sharp, warm, professional.\n'
    +'9. When giving scripts or templates, make them sound like a human wrote them — confident, warm, specific.\n'
    +'10. You know the full real estate toolkit: pricing strategy, negotiation, CMA, investor analysis, listing presentations, buyer consultations, referral systems, social media, open houses. Use all of it.\n\n'
    +'CORE DELIVERABLES YOU EXCEL AT:\n'
    +'A. Social Media & Listing Copy — given raw property details, instantly produce MLS-ready listing descriptions and a full week of multi-platform content (Instagram, TikTok, LinkedIn): captions, hashtags, post calendars, and short-form video scripts. Always copy-paste ready.\n'
    +'B. Cold Outreach & Lead Follow-Up Automation — write personalized email sequences, text check-ins, and cold outreach tailored to a lead\'s neighborhood, timeline, and history. Default to multi-touch cadences (not single messages) since most leads need 5-12 touches.\n'
    +'C. Local Market & Data Summaries — turn market stats (price trends, days on market, inventory) into short, hyper-local, textable scripts that make the agent look like the local expert with zero extra effort. Always offer a short text version and a longer email/social version.';
}

function localAI(text) {
  var t=text.toLowerCase(), ov=getOv(), now=Date.now(), cl=DATA.clients;

  if(t.indexOf('follow')!==-1&&(t.indexOf('who')!==-1||t.indexOf('overdue')!==-1||t.indexOf('today')!==-1)){
    if(!ov.length){return{text:'All clear — no overdue follow-ups. You\'re disciplined.\n\nNext: reach out proactively to your warm leads before they go cold. You have '+cl.filter(function(c){return c.status==='Warm';}).length+' warm leads right now. Want me to draft outreach for the highest priority one?',draft:null};}
    var lines='';for(var i=0;i<Math.min(ov.length,5);i++){var d=Math.floor((now-ov[i].lastContact)/86400000);lines+=(i+1)+'. '+ov[i].name+' — '+d+'d · '+ov[i].type+(ov[i].budget?', '+ov[i].budget:'')+(ov[i].phone?' · '+ov[i].phone:'')+'\n';}
    return{text:ov.length+' overdue right now:\n\n'+lines+'\nPriority #1: '+ov[0].name+'. Every day you wait, this lead gets colder. Want me to draft the message right now?',draft:null};
  }

  if(t.indexOf('pipeline')!==-1||t.indexOf('summar')!==-1||t.indexOf('overview')!==-1){
    if(!cl.length)return{text:'No clients in your pipeline yet. Add your first client and I\'ll start tracking everything.',draft:null};
    var hot=0,warm=0,bkd=0,closed=0;
    for(var pi=0;pi<cl.length;pi++){var s=cl[pi].status;if(s==='Hot')hot++;if(s==='Warm')warm++;if(s==='Booked')bkd++;if(s==='Closed')closed++;}
    var pvv=pv(), total=cl.length, rate=total>0?Math.round((closed/total)*100):0;
    var out='Pipeline snapshot:\n\n';
    out+='• '+hot+' hot · '+warm+' warm · '+bkd+' booked · '+closed+' closed\n';
    out+='• '+ov.length+' overdue follow-ups\n';
    if(pvv>0) out+='• Estimated value: '+fmtMoney(pvv)+'\n';
    out+='• Close rate: '+rate+'%\n\n';
    out+=ov.length>0?'Immediate priority: '+ov[0].name+' is '+Math.floor((now-ov[0].lastContact)/86400000)+'d overdue. Want the draft?':'You\'re on top of your follow-ups. Focus on converting your '+warm+' warm leads.';
    return{text:out,draft:null};
  }

  if(t.indexOf('coach')!==-1||t.indexOf('tip')!==-1||t.indexOf('advice')!==-1){
    var tip=TIPS[Math.floor(Math.random()*TIPS.length)];
    var ctx=ov.length>0?'Your highest-leverage action right now: clear '+ov.length+' overdue follow-up'+(ov.length>1?'s':'')+'. Agents who follow up 5+ times close 3x more deals.':'You\'re caught up on follow-ups. Excellent. Now focus on your '+cl.filter(function(c){return c.status==='Hot';}).length+' hot leads.';
    return{text:tip+'\n\n'+ctx,draft:null};
  }

  if(t.indexOf('objection')!==-1||t.indexOf('price')!==-1||t.indexOf('too expensive')!==-1||t.indexOf('not ready')!==-1){
    return{text:'Objection responses that actually work:\n\n1. "Too expensive": "I understand. Let me ask you this — if the price isn\'t the only factor, what would make this feel right? Because I can often find ways to restructure the deal."\n\n2. "Not ready yet": "I hear you. Most of my clients say that right before they find the home that changes everything. Can I just keep you informed when something that fits your criteria comes up? No pressure."\n\n3. "Need to think about it": "Of course. What would help you feel more confident about making a decision? Usually it\'s one specific thing I can help clarify."\n\n4. "Using another agent": "I respect that. My only ask is — if for any reason it doesn\'t work out, would you be open to a conversation? I\'d love to show you what I do differently."\n\nWant me to personalize one for a specific client?',draft:null};
  }

  if(t.indexOf('draft')!==-1||t.indexOf('message')!==-1||t.indexOf('write')!==-1||t.indexOf('text')!==-1){
    var match=null;
    for(var mi=0;mi<cl.length;mi++){var fn=cl[mi].name.toLowerCase().split(' ')[0];if(fn.length>3&&t.indexOf(fn)!==-1){match=cl[mi];break;}}
    if(!match){var al=cl.filter(function(c){return c.status!=='Closed';}).sort(function(a,b){return(b.priority||5)-(a.priority||5);});if(al.length>0)match=al[0];}
    if(!match)return{text:'Add a client first and I\'ll write a personalized message for them.',draft:null};
    var dt='Hi '+match.name.split(' ')[0]+',\n\nJust checking in';
    if(match.notes) dt+=' — I\'ve had '+match.notes.substring(0,60)+' on my radar for you, and I think I have a couple of options worth a conversation.';
    else dt+=' — wanted to make sure I\'m keeping you updated on anything that fits what you\'re looking for.';
    dt+='\n\nWould you be free for a quick call this week?\n\nBest,\n'+(DATA.cfg.name||'Your Agent');
    return{text:'Draft for '+match.name+' (add your API key in Settings for fully AI-personalized messages):',draft:dt};
  }

  if(t.indexOf('call')!==-1&&(t.indexOf('who')!==-1||t.indexOf('today')!==-1||t.indexOf('list')!==-1)){
    var callList=ov.length>0?ov:cl.filter(function(c){return c.status==='Hot'||c.status==='Warm';}).sort(function(a,b){return(b.priority||5)-(a.priority||5);}).slice(0,6);
    if(!callList.length)return{text:'No urgent calls right now. Add more clients to build your call list.',draft:null};
    var co='Priority call list:\n\n';
    for(var ci=0;ci<callList.length;ci++){
      var cc=callList[ci], cd=cc.lastContact?Math.floor((now-cc.lastContact)/86400000):null;
      co+=(ci+1)+'. '+cc.name+(cd?' ('+cd+'d ago)':' (first contact)')+(cc.phone?' — '+cc.phone:'')+(cc.budget?' · '+cc.budget:'')+'\n';
    }
    return{text:co+'\nStart at the top. Want me to draft openers for any of these?',draft:null};
  }

  if(t.indexOf('worth')!==-1||t.indexOf('value')!==-1||t.indexOf('commission')!==-1){
    var pv2=pv(), comm=Math.round(pv2*0.028), agentComm=Math.round(comm*0.5*0.7);
    return{text:'Pipeline value breakdown:\n\n• Total active value: '+fmtMoney(pv2)+'\n• Total commission (2.8%): '+fmtMoney(comm)+'\n• Your estimated take-home (50/30 split): '+fmtMoney(agentComm)+'\n• Active leads: '+cl.filter(function(c){return c.status!=='Closed';}).length+'\n• Overdue follow-ups risking that number: '+ov.length+'\n\nEvery overdue follow-up is a threat to this pipeline. Get current.',draft:null};
  }

  if(t.indexOf('close rate')!==-1||t.indexOf('analyze')!==-1||t.indexOf('performance')!==-1){
    var tot=cl.length, closedN=cl.filter(function(c){return c.status==='Closed';}).length;
    var rt=tot>0?Math.round((closedN/tot)*100):0;
    var adv=rt<15?'Your close rate suggests the biggest gains come from follow-up volume and consistency — most leads need 5-12 touches before closing.':rt<30?'Solid rate. Your next level comes from speed-to-lead and personalizing outreach based on what you know about each client.':rt<50?'Strong close rate. You\'ve built a real system. Scale your lead volume — your conversion engine is working.':'Exceptional. You\'re in the top percentile. Document your process and consider mentoring others — or hiring help to handle volume.';
    return{text:'Performance snapshot:\n\n• Total clients tracked: '+tot+'\n• Deals closed: '+closedN+'\n• Close rate: '+rt+'%\n• Overdue follow-ups: '+ov.length+'\n\n'+adv+'\n\nAdd your Anthropic API key for deeper AI-powered analysis.',draft:null};
  }

  if(t.indexOf('what can')!==-1||t.indexOf('help')!==-1||t.indexOf('tools')!==-1){
    return{text:'Everything I can do for you:\n\n📱 Social & listing copy — a full week of Instagram/TikTok/LinkedIn content + MLS descriptions from raw property details\n📨 Cold outreach & follow-up — personalized email/text sequences for old and new leads\n📍 Local market scripts — turn market data into textable client updates\n📋 Client management — full profiles, priority tracking, contact history\n✉ Drafting — personalized follow-ups, first-contact messages, listing pitches\n📊 Pipeline analysis — value, close rate, conversion metrics\n📞 Call lists — prioritized by urgency and opportunity\n🧮 Calculators — commission, mortgage, affordability, ROI\n🎯 Objection handling — buyer and seller objections, ranked responses\n🏡 Listing pitch — scripts to win any listing appointment\n💼 Investor analysis — cap rate, cash-on-cash, due diligence framework\n🤝 Referral system — timing, scripts, and follow-up strategy\n📋 CMA guide — how to build and present a compelling market analysis\n🧠 Negotiation — tactical playbooks for any situation\n\nAdd your Anthropic API key in Settings to unlock full Claude AI on all of this.\n\nWhat do you want to tackle right now?',draft:null};
  }

  return{text:'I\'m your full real estate operations system. Ask me anything:\n\n• Draft a message for any client\n• Analyze your pipeline\n• Build a call list for today\n• Handle objections\n• Create listing pitches\n• Run deal calculations\n• Get coaching on any situation\n\nAdd your Anthropic API key in Settings for full AI power.',draft:null};
}

function appendAIMsg(role, text, draft) {
  var msgs=g('ai-messages'), time=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  var msg=mk('div','ai-msg '+role);

  var bubble=mk('div','ai-bubble');
  bubble.innerHTML=text.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');

  var timeEl=mk('div','ai-time');
  timeEl.textContent=role==='user'?'You':'Nexus AI · '+time;

  msg.appendChild(bubble); msg.appendChild(timeEl);

  if(draft&&role==='ai'){
    var dw=mk('div','draft-block');
    var dl=mk('div','draft-lbl'); dl.textContent='Draft Message';
    var db=mk('div','draft-text'); db.textContent=draft;
    var da=mk('div','draft-btns');
    var cp=mk('button','draft-act'); cp.textContent='Copy Draft';
    cp.addEventListener('click',function(){
      navigator.clipboard.writeText(db.textContent).then(function(){
        cp.textContent='Copied!'; setTimeout(function(){cp.textContent='Copy Draft';},2000);
      });
    });
    var dm=mk('button','draft-act dismiss'); dm.textContent='Dismiss';
    dm.addEventListener('click',function(){dw.remove();});
    da.appendChild(cp); da.appendChild(dm);
    dw.appendChild(dl); dw.appendChild(db); dw.appendChild(da);
    msg.appendChild(dw);
  }

  msgs.appendChild(msg); msgs.scrollTop=99999;
}

function setTyping(on){
  g('ai-typing').classList.toggle('on',on);
  if(on) g('ai-messages').scrollTop=99999;
}

function setAIIntro() {
  var ov=getOv(), el=g('ai-intro-text');
  if(!DATA.clients.length) el.textContent='Add your first client and I\'ll start tracking follow-ups, drafting messages, and surfacing your biggest opportunities.';
  else if(ov.length>0){var d=Math.floor((Date.now()-ov[0].lastContact)/86400000);el.textContent=ov[0].name+' is '+d+' days overdue. Say "draft for '+ov[0].name.split(' ')[0]+'" and I\'ll write the perfect message.';}
  else{var active=DATA.clients.filter(function(c){return c.status!=='Closed';}).length;el.textContent='Pipeline looking healthy — '+active+' active leads. Ask me anything: drafts, analysis, coaching, objections, scripts.';}
}

// ── SETTINGS ─────────────────────────────────────────────────────
function loadSettings() {
  g('s-key').value=DATA.cfg.apiKey||'';
  g('s-model').value=DATA.cfg.model||'claude-sonnet-4-5';
  g('s-name').value=DATA.cfg.name||'';
  g('s-brok').value=DATA.cfg.brokerage||''; g('s-mkt').value=DATA.cfg.market||'';
  g('s-yrs').value=DATA.cfg.years||''; g('s-fu').value=DATA.cfg.fuDays||5;
  g('s-rentcast').value=DATA.cfg.rentcastKey||'';
  g('s-realty').value=DATA.cfg.realtyKey||'';
  checkApiKeys();
  var n=DATA.cfg.notifs||{};
  if(n.fu===false) g('tog-fu').classList.remove('on');
  if(n.brief===false) g('tog-brief').classList.remove('on');
}

function checkKey() { checkApiKeys(); }

function checkApiKeys() {
  // Anthropic key
  var key=g('s-key').value.trim(), el=g('key-status');
  el.className='key-status'; el.textContent='';
  if(key){
    if(key.indexOf('sk-ant')===0&&key.length>20){el.className='key-status ok';el.textContent='✓ Valid key — Claude AI fully enabled';}
    else{el.className='key-status err';el.textContent='⚠ Key must start with sk-ant-';}
  }
  // RentCast key
  var rcEl=g('rentcast-status'); rcEl.className='key-status'; rcEl.textContent='';
  var rcKey=g('s-rentcast').value.trim();
  if(rcKey){rcEl.className='key-status ok';rcEl.textContent='✓ RentCast key set — rent estimates enabled';}
  // Realty key
  var ralEl=g('realty-status'); ralEl.className='key-status'; ralEl.textContent='';
  var ralKey=g('s-realty').value.trim();
  if(ralKey){ralEl.className='key-status ok';ralEl.textContent='✓ Realty API key set — property search enabled';}
}

function saveSettings() {
  DATA.cfg.apiKey=g('s-key').value.trim();
  DATA.cfg.model=(g('s-model').value.trim()||'claude-sonnet-4-5');
  DATA.cfg.name=g('s-name').value.trim();
  DATA.cfg.brokerage=g('s-brok').value.trim(); DATA.cfg.market=g('s-mkt').value.trim();
  DATA.cfg.years=g('s-yrs').value.trim(); DATA.cfg.fuDays=parseInt(g('s-fu').value)||5;
  DATA.cfg.rentcastKey=g('s-rentcast').value.trim();
  DATA.cfg.realtyKey=g('s-realty').value.trim();
  save(); renderAll(); setAIIntro(); checkApiKeys();
  var btn=g('btn-save'); btn.textContent='Saved ✓';
  setTimeout(function(){btn.textContent='Save Settings';},2000);
}

// ── NAVIGATION ───────────────────────────────────────────────────
function goTab(name) {
  document.querySelectorAll('.view').forEach(function(v){v.classList.remove('active');v.style.display='none';});
  document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});
  var view=g('view-'+name), tab=g('tab-'+name);
  if(view){view.style.display='flex';view.classList.add('active');}
  if(tab) tab.classList.add('active');
}

function openSheet(id){var o=g('overlay-'+id);if(o)o.classList.add('open');}
function closeSheet(id){var o=g('overlay-'+id);if(o)o.classList.remove('open');}
