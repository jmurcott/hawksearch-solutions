/*
  Assistant log analysis: turns raw CSV rows (Exchange ID, Timestamp, Exact Prompt, Exact Response)
  into cleaned exchanges plus the numbers behind the Insights view.
  Rule-based on purpose: it runs in the browser with no AI service or API key, and every label
  can be traced back to a keyword rule below.
*/
(function (root) {
  // ---- What the shopper asked about (first matching rule wins; no match = product search) ----
  var INTENTS = [
    { id: 'agent', label: 'Live agent / customer service', re: /\b(live (agent|person|chat)|human|real person|custo?m?er serv|costumer serv|representative|speak (to|with)|talk (to|with) (a|someone))/ },
    { id: 'tax', label: 'Tax exemption', re: /\btax\b|tax[- ]exempt/ },
    { id: 'refund', label: 'Returns & refunds', re: /\b(refund|return|money back)/ },
    { id: 'promo', label: 'Promotions & shipping cost', re: /\b(free shipping|promo|coupon|codes?\b|discount|% off|\$\d+ off|reward|price adjust)/ },
    { id: 'order', label: 'Order status & delivery', re: /\b(my order|order ?#|order number|orders?\b.*\b(status|shipped)|package|deliver|arriv|backorder|delay|tracking|shipping address|invoi?ce|expedited)/ },
    { id: 'cart', label: 'Cart & account', re: /\b(cart|account|log ?in|sign ?in|password|checkout)/ },
    { id: 'other', label: 'Other support', re: /attached file/ }
  ];
  var PRODUCT = { id: 'product', label: 'Product search' };
  var FOLLOWUP = { id: 'followup', label: 'Follow-up message' };
  var SUPPORT_IDS = ['agent', 'tax', 'refund', 'promo', 'order', 'cart', 'other'];

  // ---- How the assistant responded ----
  var OUTCOMES = {
    none: { label: 'No response' },
    clarify: { label: 'Asked for details' },
    redirect: { label: 'Sent to customer service' },
    products: { label: 'Showed products' },
    answered: { label: 'Answered' }
  };

  var STOP = ('a an and are as at be but by can could do does for from get got have i i\'m im in is it its looking look me my need of on or our please show some that the their them there these they this to too want was we what when where which with would you your yes no not just like any items item stuff find shop shopping buy purchase here sorry ok okay thanks thank hi hello other').split(' ');

  function text(v) { return String(v == null ? '' : v); }

  function intentOf(prompt) {
    var p = text(prompt).trim().toLowerCase();
    if (!p) return FOLLOWUP;
    for (var i = 0; i < INTENTS.length; i++) if (INTENTS[i].re.test(p)) return INTENTS[i];
    return PRODUCT;
  }

  function outcomeOf(response, intentId) {
    var r = text(response).trim();
    if (!r) return 'none';
    var plain = r.toLowerCase();
    if (/customer service|contact-us|support team|help center|contact our|contact oriental/.test(plain)) return 'redirect';
    if (/need (a bit )?more information|could you describe|need to clarify|which product|can you tell me more|could you (share|tell)/.test(plain)) return 'clarify';
    // "Here are the best picks:" = products shown in a carousel, which the log doesn't capture.
    // For support questions a trailing colon is a list of steps instead, so only count shopping turns.
    if ((intentId === 'product' || intentId === 'followup') &&
        (/:\s*$/.test(r) || /\b(i found|here are|here's|found it|options include|we have:)/.test(plain))) return 'products';
    return 'answered';
  }

  // Anchor tags whose href picked up markdown (e.g. "...fltr**") don't open the right page
  function hasBrokenLink(response) {
    var m, re = /<a\b[^>]*href="([^"]*)"/gi, r = text(response);
    while ((m = re.exec(r))) if (/\*|\s/.test(m[1])) return true;
    return false;
  }

  var SAME = { bday: 'birthday' };
  // Light plural folding so "toys" and "toy" count together
  function fold(w) {
    if (SAME[w]) return SAME[w];
    if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (w.length > 3 && /s$/.test(w) && !/(ves|ses|us|ss|is|xes)$/.test(w)) return w.slice(0, -1);
    return w;
  }

  function words(s) {
    return text(s).toLowerCase().replace(/[^a-z0-9'\s-]/g, ' ').split(/\s+/)
      .map(function (w) { return w.replace(/^['-]+|['-]+$/g, ''); })
      .filter(function (w) { return w.length > 2 && STOP.indexOf(w) === -1 && !/^\d+$/.test(w); })
      .map(fold);
  }

  // Raw CSV rows -> cleaned, de-duplicated exchanges (newest first)
  function prepare(rows) {
    var seen = {}, list = [], dupes = 0;
    rows.forEach(function (row) {
      var id = text(row['Exchange ID']).trim();
      var ts = text(row['Timestamp']).trim();
      if (!id && !ts) return;
      var key = id || ts + '|' + row['Exact Prompt'];
      if (seen[key]) { dupes++; return; }
      seen[key] = true;
      var prompt = text(row['Exact Prompt']).trim();
      var response = text(row['Exact Response']).trim();
      var intent = intentOf(prompt);
      list.push({
        id: id,
        time: new Date(ts),
        prompt: prompt,
        response: response,
        intent: intent.id,
        outcome: outcomeOf(response, intent.id),
        brokenLink: hasBrokenLink(response),
        terms: intent.id === 'product' ? words(prompt) : []
      });
    });
    list = list.filter(function (x) { return !isNaN(x.time); });
    list.sort(function (a, b) { return b.time - a.time; });
    return { exchanges: list, duplicates: dupes };
  }

  function count(arr, keyFn) {
    var c = {};
    arr.forEach(function (x) { var k = keyFn(x); if (k != null) c[k] = (c[k] || 0) + 1; });
    return c;
  }
  function ranked(counts) {
    return Object.keys(counts).map(function (k) { return { key: k, n: counts[k] }; })
      .sort(function (a, b) { return b.n - a.n || a.key.localeCompare(b.key); });
  }

  function summarize(exchanges, duplicates) {
    var prompted = exchanges.filter(function (x) { return x.prompt; });
    var product = prompted.filter(function (x) { return x.intent === 'product'; });
    var support = prompted.filter(function (x) { return SUPPORT_IDS.indexOf(x.intent) !== -1; });
    var unanswered = prompted.filter(function (x) { return x.outcome === 'none'; });

    var termCounts = {};
    product.forEach(function (x) {
      x.terms.filter(function (t, i, a) { return a.indexOf(t) === i; })   // count each term once per prompt
        .forEach(function (t) { termCounts[t] = (termCounts[t] || 0) + 1; });
    });
    var unansweredTerms = {};
    unanswered.forEach(function (x) {
      words(x.prompt).filter(function (t, i, a) { return a.indexOf(t) === i; })
        .forEach(function (t) { unansweredTerms[t] = (unansweredTerms[t] || 0) + 1; });
    });

    var byHour = new Array(24).fill(0);
    exchanges.forEach(function (x) { byHour[x.time.getHours()]++; });   // viewer's local time

    return {
      total: exchanges.length,
      duplicates: duplicates,
      prompted: prompted.length,
      followups: exchanges.length - prompted.length,
      productCount: product.length,
      supportCount: support.length,
      unanswered: unanswered,
      intents: ranked(count(prompted, function (x) { return x.intent; })),
      outcomes: ranked(count(prompted, function (x) { return x.outcome; })),
      terms: ranked(termCounts),
      unansweredTerms: ranked(unansweredTerms),
      agentRequests: prompted.filter(function (x) { return x.intent === 'agent'; }).length,
      brokenLinks: exchanges.filter(function (x) { return x.brokenLink; }).length,
      byHour: byHour,
      first: exchanges.length ? exchanges[exchanges.length - 1].time : null,
      last: exchanges.length ? exchanges[0].time : null
    };
  }

  function intentLabel(id) {
    if (id === 'product') return PRODUCT.label;
    if (id === 'followup') return FOLLOWUP.label;
    var m = INTENTS.filter(function (i) { return i.id === id; })[0];
    return m ? m.label : id;
  }

  root.LogAnalysis = {
    prepare: prepare,
    summarize: summarize,
    intentLabel: intentLabel,
    OUTCOMES: OUTCOMES,
    SUPPORT_IDS: SUPPORT_IDS,
    INTENT_IDS: ['product'].concat(INTENTS.map(function (i) { return i.id; })).concat(['followup'])
  };
})(typeof window !== 'undefined' ? window : globalThis);
