/* Assistant Insights: loads assistant log CSVs and renders the Insights and Logs views. */
(function () {
  var A = window.LogAnalysis;
  // Loaded automatically when the page is served (not from file://). Later this becomes the S3 listing.
  // A page can set window.INSIGHTS_DEFAULT_FILES first (the Solutions portal loads the made-up sample instead).
  var DEFAULT_FILES = window.INSIGHTS_DEFAULT_FILES || [];
  // When the defaults are only sample data, the first files someone adds replace them instead of mixing in
  var DEFAULTS_ARE_SAMPLE = !!window.INSIGHTS_DEFAULTS_ARE_SAMPLE;
  var defaultNames = [];
  var REQUIRED = ['Exchange ID', 'Timestamp', 'Exact Prompt', 'Exact Response'];
  var PAGE = 50;

  var files = [];          // { name, rows }
  var data = null;         // { exchanges, duplicates, summary, rowCount }
  var filters = { q: '', intent: '', outcome: '', sort: 'new', hideFollowups: false };
  var limit = PAGE;

  var $ = function (id) { return document.getElementById(id); };
  var OUTCOME_ICON = { none: 'none', redirect: 'redirect', clarify: 'question', products: 'check', answered: 'chat' };
  var TZ = (new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date()).filter(function (p) { return p.type === 'timeZoneName'; })[0] || {}).value || 'local time';

  // ---- Helpers ----
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function icon(name) { return '<svg class="i" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }
  function pct(n, d) { return d ? Math.round(n / d * 100) : 0; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function fmtTime(d) { return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
  function fmtDate(d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  function fmtHour(h) { return (h % 12 || 12) + (h < 12 ? ' AM' : ' PM'); }
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(function () { t.hidden = true; }, 4000);
  }

  // Responses mix markdown with raw HTML links (some malformed). Show them as safe text with light formatting.
  function plainResponse(r) {
    return String(r || '')
      .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1')
      .replace(/<[^>]+>/g, '');
  }
  function renderResponse(r) {
    var src = plainResponse(r).trim();
    if (!src) return '<p><em class="empty">No response was recorded.</em></p>';
    var html = '', list = null;
    function inline(s) {
      return esc(s)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(https?:\/\/[^\s<"')]+)/g, function (u) {
          var clean = u.replace(/[*.,;:]+$/, '');
          return '<a href="' + clean + '" target="_blank" rel="noopener noreferrer">' + clean + '</a>' + u.slice(clean.length);
        });
    }
    function closeList() { if (list) { html += '</' + list + '>'; list = null; } }
    src.split(/\n/).forEach(function (line) {
      var t = line.trim(), m;
      if (!t) { closeList(); return; }
      if ((m = t.match(/^#{1,6}\s+(.*)/))) { closeList(); html += '<h4>' + inline(m[1]) + '</h4>'; }
      else if ((m = t.match(/^[-*•]\s+(.*)/))) { if (list !== 'ul') { closeList(); html += '<ul>'; list = 'ul'; } html += '<li>' + inline(m[1]) + '</li>'; }
      else if ((m = t.match(/^\d+[.)]\s+(.*)/))) { if (list !== 'ol') { closeList(); html += '<ol>'; list = 'ol'; } html += '<li>' + inline(m[1]) + '</li>'; }
      else { closeList(); html += '<p>' + inline(t) + '</p>'; }
    });
    closeList();
    return html;
  }

  // Wrap search words in <mark> inside already-rendered HTML (text nodes only, so links stay intact)
  function highlight(root, words) {
    if (!words.length) return;
    var re = new RegExp('(' + words.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'gi');
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [], n;
    while ((n = walker.nextNode())) if (re.test(n.nodeValue)) nodes.push(n);
    nodes.forEach(function (node) {
      var span = document.createElement('span');
      span.innerHTML = esc(node.nodeValue).replace(re, '<mark>$1</mark>');
      node.parentNode.replaceChild(span, node);
    });
  }

  // ---- Loading files ----
  function parseText(name, text) {
    var out = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: function (h) { return h.replace(/^﻿/, '').trim(); } });
    var fields = out.meta.fields || [];
    var missing = REQUIRED.filter(function (c) { return fields.indexOf(c) === -1; });
    if (missing.length) { toast(name + ' is missing ' + missing.join(', ') + ', so it was skipped.'); return; }
    files = files.filter(function (f) { return f.name !== name; }).concat([{ name: name, rows: out.data }]);
  }
  function addFiles(list) {
    var csvs = Array.prototype.filter.call(list, function (f) { return /\.csv$/i.test(f.name) || f.type === 'text/csv'; });
    if (!csvs.length) { toast('Only CSV files can be added.'); return; }
    Promise.all(csvs.map(function (f) {
      return f.text().then(function (t) { parseText(f.name, t); });
    })).then(function () {
      var added = files.some(function (f) { return defaultNames.indexOf(f.name) === -1; });
      if (DEFAULTS_ARE_SAMPLE && added) files = files.filter(function (f) { return defaultNames.indexOf(f.name) === -1; });
      rebuild();
    });
  }
  function loadDefaults() {
    if (location.protocol === 'file:') { rebuild(); return; }
    // ?file=samples/x.csv opens a specific file from this site instead (relative paths only)
    var requested = new URLSearchParams(location.search).getAll('file').filter(function (p) { return /^[\w\/.-]+\.csv$/i.test(p) && p.indexOf('..') === -1; });
    Promise.all((requested.length ? requested : DEFAULT_FILES).map(function (path) {
      return fetch(path).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(function (t) { var name = path.split('/').pop(); parseText(name, t); defaultNames.push(name); })
        .catch(function () { /* not present: the empty state explains how to add files */ });
    })).then(rebuild);
  }

  function rebuild() {
    var rows = [];
    files.forEach(function (f) { rows = rows.concat(f.rows); });
    var prepared = A.prepare(rows);
    data = { exchanges: prepared.exchanges, duplicates: prepared.duplicates, rowCount: rows.length, summary: A.summarize(prepared.exchanges, prepared.duplicates) };
    renderFiles();
    var note = $('sample-note');   // optional "showing sample data" message on the page
    if (note) note.hidden = !files.some(function (f) { return defaultNames.indexOf(f.name) !== -1; });
    var has = data.exchanges.length > 0;
    $('empty').hidden = has;
    $('view-insights').hidden = !has || currentTab() !== 'insights';
    $('view-logs').hidden = !has || currentTab() !== 'logs';
    $('range').hidden = !has;
    if (!has) { $('logs-count').textContent = '0'; return; }
    renderInsights();
    limit = PAGE;
    renderLogs();
  }

  function renderFiles() {
    $('file-chips').innerHTML = files.map(function (f, i) {
      return '<span class="file-chip" title="' + esc(f.name) + '"><span>' + esc(f.name) + '</span>' +
        '<button type="button" data-remove-file="' + i + '" aria-label="Remove ' + esc(f.name) + '">' + icon('x') + '</button></span>';
    }).join('');
  }

  // ---- Insights ----
  function barList(el, items, total, labelFn, onClickAttr) {
    var max = Math.max.apply(null, items.map(function (i) { return i.n; }).concat([1]));
    el.innerHTML = items.map(function (i) {
      return '<li><button class="bar-row" type="button" ' + onClickAttr(i) + ' data-tip="' + esc(labelFn(i) + ': ' + plural(i.n, 'prompt') + ' (' + pct(i.n, total) + '%)') + '">' +
        '<span class="bar-row__label">' + esc(labelFn(i)) + '</span>' +
        '<span class="bar-row__track"><span class="bar-row__fill" style="width:' + (i.n / max * 100) + '%"></span></span>' +
        '<span class="bar-row__value">' + i.n + ' <small>' + pct(i.n, total) + '%</small></span></button></li>';
    }).join('');
  }

  function renderInsights() {
    var s = data.summary;
    $('range').textContent = (s.first ? fmtDate(s.first) + ', ' + fmtTime(s.first) + ' – ' + (fmtDate(s.last) === fmtDate(s.first) ? '' : fmtDate(s.last) + ', ') + fmtTime(s.last) : '') + ' ' + TZ +
      ' · ' + plural(files.length, 'file');
    $('logs-count').textContent = s.total;

    var redirects = (s.outcomes.filter(function (o) { return o.key === 'redirect'; })[0] || { n: 0 }).n;
    $('stats').innerHTML = [
      { cls: 'stat--hero', label: 'Shopper prompts', value: s.prompted, note: s.total + ' exchanges incl. follow-ups' },
      { label: 'Product searches', value: pct(s.productCount, s.prompted) + '%', note: s.productCount + ' of ' + s.prompted + ' prompts' },
      { label: 'Support questions', value: pct(s.supportCount, s.prompted) + '%', note: 'Orders, promos, tax, refunds' },
      { label: 'Sent to customer service', value: redirects, note: pct(redirects, s.prompted) + '% of prompts' },
      { label: 'No response', value: s.unanswered.length, note: 'Prompts the assistant didn’t answer' }
    ].map(function (t) {
      return '<div class="stat ' + (t.cls || '') + '"><span class="stat__label">' + t.label + '</span><p class="stat__value">' + t.value + '</p><span class="stat__note">' + t.note + '</span></div>';
    }).join('');

    // "What we noticed": plain-language highlights, each linked to the logs behind it
    var notes = [];
    notes.push({ html: '<b>' + pct(s.productCount, s.prompted) + '%</b> of shopper prompts (' + s.productCount + ' of ' + s.prompted + ') were product searches, and <b>' + pct(s.supportCount, s.prompted) + '%</b> (' + s.supportCount + ') were customer-service questions about orders, promotions, tax or refunds, which the assistant can only redirect.',
      link: { label: 'Read the support questions', f: { intent: 'support' } } });
    if (s.unanswered.length) {
      var topMiss = s.unansweredTerms[0];
      notes.push({ alert: true, html: '<b>' + plural(s.unanswered.length, 'prompt') + ' got no response at all</b>' +
        (topMiss && topMiss.n > 1 ? ', including ' + topMiss.n + ' asking about <b>“' + esc(topMiss.key) + '”</b>' : '') + '. Check that these products are in the catalogue and indexed.',
        link: { label: 'See them', f: { outcome: 'none' } } });
    }
    if (redirects) notes.push({ html: '<b>' + plural(redirects, 'prompt') + '</b> ended with the shopper being sent to customer service.', link: { label: 'See them', f: { outcome: 'redirect' } } });
    if (s.agentRequests) notes.push({ html: 'Shoppers asked for a <b>live agent or customer service ' + plural(s.agentRequests, 'time') + '</b>.', link: { label: 'See them', f: { intent: 'agent' } } });
    var top = s.terms.filter(function (t) { return t.n > 1; }).slice(0, 6);
    if (!top.length) top = s.terms.slice(0, 5);
    if (top.length) notes.push({ html: 'Most searched for: ' + top.map(function (t) { return '<button class="link-btn" type="button" data-search="' + esc(t.key) + '">' + esc(t.key) + '</button>'; }).join(', ') + '.' });
    var peak = s.byHour.indexOf(Math.max.apply(null, s.byHour));
    if (s.byHour[peak]) notes.push({ html: 'Busiest hour: <b>' + fmtHour(peak) + '–' + fmtHour((peak + 1) % 24) + '</b> with ' + plural(s.byHour[peak], 'exchange') + '.' });
    if (s.brokenLinks) notes.push({ alert: true, html: '<b>' + plural(s.brokenLinks, 'response') + '</b> ' + (s.brokenLinks === 1 ? 'contains' : 'contain') + ' a broken link (formatting got into the web address), so the shopper may not reach the page.', link: { label: 'See ' + (s.brokenLinks === 1 ? 'it' : 'them'), f: { outcome: 'broken' } } });
    $('notices').innerHTML = notes.map(function (n) {
      var link = n.link ? ' <button class="link-btn" type="button" data-filter=\'' + esc(JSON.stringify(n.link.f)) + '\'>' + n.link.label + '</button>' : '';
      return '<li' + (n.alert ? ' class="is-alert"' : '') + '>' + icon(n.alert ? 'alert' : 'bulb') + '<span>' + n.html + link + '</span></li>';
    }).join('');

    barList($('intent-bars'), s.intents, s.prompted, function (i) { return A.intentLabel(i.key); },
      function (i) { return 'data-filter=\'' + esc(JSON.stringify({ intent: i.key })) + '\''; });
    barList($('outcome-bars'), s.outcomes, s.prompted, function (i) { return A.OUTCOMES[i.key].label; },
      function (i) { return 'data-filter=\'' + esc(JSON.stringify({ outcome: i.key })) + '\''; });

    $('terms').innerHTML = s.terms.slice(0, 24).map(function (t) {
      return '<button class="chip" type="button" data-search="' + esc(t.key) + '">' + esc(t.key) + '<span>' + t.n + '</span></button>';
    }).join('') || '<p class="card__sub">No product searches in this log.</p>';

    $('unanswered-terms').innerHTML = s.unansweredTerms.filter(function (t) { return t.n > 1; }).map(function (t) {
      return '<button class="chip" type="button" data-search="' + esc(t.key) + '">' + esc(t.key) + '<span>' + t.n + '×</span></button>';
    }).join('');
    $('unanswered').innerHTML = s.unanswered.slice(0, 8).map(function (x) {
      return '<li><span>“' + esc(x.prompt) + '”</span><time>' + fmtTime(x.time) + '</time></li>';
    }).join('') || '<li style="background:var(--good-tint)">Every prompt got a response.</li>';

    renderHours(s.byHour);

    $('dq').innerHTML = [
      'Read ' + plural(data.rowCount, 'row') + ' from ' + plural(files.length, 'file') + ' and removed <b>' + plural(s.duplicates, 'duplicate row') + '</b> (same Exchange ID), leaving ' + plural(s.total, 'unique exchange') + '.',
      '<b>' + plural(s.followups, 'follow-up message') + '</b> ' + (s.followups === 1 ? 'has' : 'have') + ' no prompt: the assistant sent more than one message for a single question. The export has no conversation or session ID, so they can’t be linked back to the question. Adding a session ID to the export would fix this and allow whole conversations to be shown.',
      'When the assistant shows products, the log only has its lead-in text (for example “Here are the best picks:”), not the products in the carousel.',
      'Topics and response types come from keyword rules, so a few prompts may be misfiled.',
      'Times are shown in your time zone (' + TZ + '); the file stores them in UTC.'
    ].map(function (t) { return '<li>' + t + '</li>'; }).join('');
  }

  function renderHours(byHour) {
    var max = Math.max.apply(null, byHour.concat([1]));
    var step = max <= 4 ? 1 : Math.ceil(max / 4);
    var top = Math.ceil(max / step) * step;
    var grid = '';
    for (var v = step; v <= top; v += step) grid += '<div class="cols__gridline" style="bottom:' + (v / top * 100) + '%"><span style="left:-22px">' + v + '</span></div>';
    $('hours').innerHTML = grid + byHour.map(function (n, h) {
      var tip = fmtHour(h) + '–' + fmtHour((h + 1) % 24) + ': ' + plural(n, 'exchange');
      return '<div class="col" tabindex="0" data-tip="' + tip + '" aria-label="' + tip + '"><span class="col__fill' + (n ? '' : ' col__fill--zero') + '" style="height:' + (n / top * 100) + '%"></span></div>';
    }).join('');
    $('hours').setAttribute('aria-label', 'Exchanges by hour of day, busiest ' + fmtHour(byHour.indexOf(max)));
    $('hours-axis').innerHTML = byHour.map(function (n, h) { return '<span>' + (h % 3 === 0 ? (h % 12 || 12) + (h < 12 ? 'a' : 'p') : '') + '</span>'; }).join('');
    $('hour-sub').textContent = 'Exchanges per hour of the day, in your time zone (' + TZ + '). Hover a column for its count.';
  }

  // ---- Logs ----
  function searchWords() { return filters.q.trim().toLowerCase().split(/\s+/).filter(Boolean); }

  function filtered() {
    var words = searchWords();
    var list = data.exchanges.filter(function (x) {
      if (filters.hideFollowups && !x.prompt) return false;
      if (filters.intent === 'support') { if (A.SUPPORT_IDS.indexOf(x.intent) === -1) return false; }
      else if (filters.intent && x.intent !== filters.intent) return false;
      if (filters.outcome === 'broken') { if (!x.brokenLink) return false; }
      else if (filters.outcome && x.outcome !== filters.outcome) return false;
      if (words.length) {
        var hay = (x.prompt + ' ' + plainResponse(x.response)).toLowerCase();
        for (var i = 0; i < words.length; i++) if (hay.indexOf(words[i]) === -1) return false;
      }
      return true;
    });
    if (filters.sort === 'old') list = list.slice().reverse();
    return list;
  }

  function badge(x) {
    var o = A.OUTCOMES[x.outcome];
    return '<span class="badge badge--intent">' + esc(A.intentLabel(x.intent)) + '</span>' +
      '<span class="badge badge--' + x.outcome + '">' + icon(OUTCOME_ICON[x.outcome]) + o.label + '</span>' +
      (x.brokenLink ? '<span class="badge badge--broken">' + icon('link') + 'Broken link</span>' : '');
  }

  function renderLogs() {
    var list = filtered();
    var words = searchWords();
    var active = filters.q || filters.intent || filters.outcome || filters.hideFollowups;
    $('results-count').innerHTML = '<b>' + list.length + '</b> of ' + plural(data.exchanges.length, 'exchange') + (active ? ' match your filters' : '');
    $('clear-filters').hidden = !active;
    var el = $('logs');
    if (!list.length) {
      el.innerHTML = '<li class="empty-state"><h2>No matching exchanges</h2><p>Try fewer words or clear the filters.</p></li>';
      $('more').hidden = true;
      return;
    }
    el.innerHTML = list.slice(0, limit).map(function (x) {
      var preview = plainResponse(x.response).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
      return '<li><details class="log" data-id="' + esc(x.id) + '"><summary>' +
        '<span class="log__time"><b>' + fmtTime(x.time) + '</b>' + fmtDate(x.time) + '</span>' +
        '<span>' + (x.prompt ? '<p class="log__prompt">' + esc(x.prompt) + '</p>' : '<p class="log__prompt log__prompt--none">Follow-up message (no prompt)</p>') +
        '<p class="log__preview">' + (preview ? esc(preview) : '<em>No response</em>') + '</p></span>' +
        '<span class="log__tags">' + badge(x) + '</span></summary>' +
        '<div class="log__body"></div></details></li>';
    }).join('');
    $('more').hidden = list.length <= limit;
    $('more').textContent = 'Show more (' + (list.length - limit) + ' left)';
    if (words.length) highlight(el, words);
  }

  // Full response is rendered when a row is opened
  $('logs').addEventListener('toggle', function (e) {
    var d = e.target;
    if (!d.open || d.dataset.ready) return;
    var x = data.exchanges.filter(function (y) { return y.id === d.dataset.id; })[0];
    if (!x) return;
    var body = d.querySelector('.log__body');
    body.innerHTML = '<p class="log__label">Assistant response</p><div class="log__response">' + renderResponse(x.response) + '</div>' +
      '<p class="log__meta">Exchange ID ' + esc(x.id) + ' · ' + x.time.toISOString() + '</p>';
    highlight(body, searchWords());
    d.dataset.ready = '1';
  }, true);

  function applyFilters(f) {
    filters = Object.assign({ q: '', intent: '', outcome: '', sort: filters.sort, hideFollowups: false }, f);
    $('q').value = filters.q;
    $('f-intent').value = filters.intent;
    $('f-outcome').value = filters.outcome;
    $('f-followups').checked = filters.hideFollowups;
    limit = PAGE;
    renderLogs();
    showTab('logs');
    window.scrollTo({ top: 0 });
  }

  // ---- Tabs ----
  function currentTab() { return $('tab-logs').getAttribute('aria-selected') === 'true' ? 'logs' : 'insights'; }
  function showTab(name) {
    ['insights', 'logs'].forEach(function (t) {
      $('tab-' + t).setAttribute('aria-selected', String(t === name));
      $('view-' + t).hidden = t !== name || !(data && data.exchanges.length);
    });
    history.replaceState(null, '', name === 'logs' ? '#logs' : location.pathname + location.search);
  }
  $('tab-insights').addEventListener('click', function () { showTab('insights'); });
  $('tab-logs').addEventListener('click', function () { showTab('logs'); });

  // ---- Filter controls ----
  $('f-intent').innerHTML = '<option value="">All topics</option><option value="support">All support questions</option>' +
    A.INTENT_IDS.map(function (id) { return '<option value="' + id + '">' + esc(A.intentLabel(id)) + '</option>'; }).join('');
  $('f-outcome').innerHTML = '<option value="">All responses</option>' +
    Object.keys(A.OUTCOMES).map(function (k) { return '<option value="' + k + '">' + A.OUTCOMES[k].label + '</option>'; }).join('') +
    '<option value="broken">Has a broken link</option>';

  var qTimer;
  $('q').addEventListener('input', function () {
    clearTimeout(qTimer);
    qTimer = setTimeout(function () { filters.q = $('q').value; limit = PAGE; renderLogs(); }, 150);
  });
  $('f-intent').addEventListener('change', function () { filters.intent = this.value; limit = PAGE; renderLogs(); });
  $('f-outcome').addEventListener('change', function () { filters.outcome = this.value; limit = PAGE; renderLogs(); });
  $('f-sort').addEventListener('change', function () { filters.sort = this.value; renderLogs(); });
  $('f-followups').addEventListener('change', function () { filters.hideFollowups = this.checked; limit = PAGE; renderLogs(); });
  $('clear-filters').addEventListener('click', function () { applyFilters({}); });
  $('more').addEventListener('click', function () { limit += PAGE; renderLogs(); });

  $('export').addEventListener('click', function () {
    var rows = filtered().map(function (x) {
      return { 'Exchange ID': x.id, 'Timestamp': x.time.toISOString(), 'Prompt': x.prompt, 'Response': x.response,
        'Topic': A.intentLabel(x.intent), 'Assistant response': A.OUTCOMES[x.outcome].label, 'Broken link': x.brokenLink ? 'Yes' : '' };
    });
    var blob = new Blob(['﻿' + Papa.unparse(rows)], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'assistant-log-results.csv';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  // Links from Insights into the logs, and removing files
  document.addEventListener('click', function (e) {
    var f = e.target.closest('[data-filter]');
    // Insights counts shopper prompts only, so hide follow-up messages to make the list match the number
    if (f) { applyFilters(Object.assign({ hideFollowups: true }, JSON.parse(f.getAttribute('data-filter')))); return; }
    var s = e.target.closest('[data-search]');
    if (s) { applyFilters({ q: s.getAttribute('data-search') }); return; }
    var rm = e.target.closest('[data-remove-file]');
    if (rm) { files.splice(+rm.getAttribute('data-remove-file'), 1); rebuild(); }
  });

  // ---- Tooltip for bars and columns ----
  var tip = $('tooltip');
  function showTip(el, x, y) {
    tip.innerHTML = esc(el.getAttribute('data-tip')).replace(/: (\d+)/, ': <b>$1</b>');
    tip.hidden = false;
    var r = tip.getBoundingClientRect();
    tip.style.left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2)) + 'px';
    tip.style.top = Math.max(8, y - r.height - 12) + 'px';
  }
  document.addEventListener('mousemove', function (e) {
    var el = e.target.closest('[data-tip]');
    if (el) showTip(el, e.clientX, e.clientY); else tip.hidden = true;
  });
  document.addEventListener('focusin', function (e) {
    var el = e.target.closest('[data-tip]');
    if (!el) { tip.hidden = true; return; }
    var r = el.getBoundingClientRect();
    showTip(el, r.left + r.width / 2, r.top);
  });
  document.addEventListener('focusout', function () { tip.hidden = true; });

  // ---- Adding files: picker and drag & drop ----
  $('file-input').addEventListener('change', function () { addFiles(this.files); this.value = ''; });
  var depth = 0;
  window.addEventListener('dragenter', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') !== -1) { depth++; $('drop').hidden = false; } });
  window.addEventListener('dragleave', function () { depth = Math.max(0, depth - 1); if (!depth) $('drop').hidden = true; });
  window.addEventListener('dragover', function (e) { e.preventDefault(); });
  window.addEventListener('drop', function (e) {
    e.preventDefault(); depth = 0; $('drop').hidden = true;
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });

  if (location.hash === '#logs') showTab('logs');
  loadDefaults();
})();
