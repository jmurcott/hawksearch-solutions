/*
  HawkSearch Solutions portal: shared script for every page.
  - Portal.session: a FAKE sign-in kept in browser storage, until SSO from the core platform replaces it.
  - Icon sprite, injected once so pages can use <svg class="i"><use href="#i-name"/></svg>.
  - Portal.SOLUTIONS: the catalogue of Professional Services solutions (placeholder content).
*/
(function () {
  var KEY = 'hsPortalUser';

  // ---- Fake session ----
  function read() {
    try {
      return JSON.parse(sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || 'null');
    } catch (e) { return null; }
  }
  function titleCase(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // jordan.lee@acmeindustrial.com -> { name: "Jordan Lee", company: "Acmeindustrial" }
  function userFromEmail(email) {
    var parts = email.split('@');
    var name = parts[0].split(/[._-]+/).filter(Boolean).map(titleCase).join(' ') || 'Customer';
    var domain = (parts[1] || '').split('.')[0] || 'Your company';
    return {
      email: email,
      name: name,
      firstName: name.split(' ')[0],
      initials: name.split(' ').map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase(),
      company: titleCase(domain),
      signedInAt: new Date().toISOString()
    };
  }

  var session = {
    user: read,
    signIn: function (email, remember) {
      var user = userFromEmail(email.trim().toLowerCase());
      try {
        (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(user));
      } catch (e) { /* storage blocked: the dashboard will send them back to sign in */ }
      return user;
    },
    signOut: function () {
      try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch (e) {}
      location.href = 'index.html';
    },
    // Pages that need a signed-in user call this first
    require: function () {
      var u = read();
      if (!u) location.replace('login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search));
      return u;
    }
  };

  // ---- Icons (24×24, stroked) ----
  var P = {
    arrow: '<path d="M7 17 17 7M8 7h9v9"/>',
    right: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    plug: '<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/>',
    puzzle: '<path d="M10 3h4v3a2 2 0 1 0 4 0V3h3v7h-3a2 2 0 1 0 0 4h3v7h-7v-3a2 2 0 1 0-4 0v3H3v-7h3a2 2 0 1 0 0-4H3V3h7z"/>',
    rocket: '<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M14 4c3-1 6-1 6-1s0 3-1 6c-1 3-4 6-8 8l-4-4c2-4 5-7 7-9z"/><circle cx="15" cy="9" r="1.5"/>',
    code: '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 4l-4 16"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    chart: '<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-4-4 1.7-1.7a4 4 0 0 0-5-5L3 7l4-4z"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    home: '<path d="M3 11l9-7 9 7M5 10v10h14V10"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5"/>',
    inbox: '<path d="M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6H3v-6z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5V14M12 17.5v.01"/>',
    logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    sso: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>'
  };
  var sprite = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">' +
    Object.keys(P).map(function (k) {
      return '<symbol id="i-' + k + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + P[k] + '</symbol>';
    }).join('') + '</svg>';
  document.addEventListener('DOMContentLoaded', function () {
    document.body.insertAdjacentHTML('afterbegin', sprite);
  });
  function icon(name) { return '<svg class="i" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---- Solutions catalogue (placeholder content until the real catalogue exists) ----
  var CATEGORIES = {
    connector: { label: 'Connector', icon: 'plug' },
    integration: { label: 'Integration', icon: 'puzzle' },
    accelerator: { label: 'Accelerator', icon: 'rocket' },
    ai: { label: 'AI', icon: 'sparkle' },
    analytics: { label: 'Analytics', icon: 'chart' },
    tool: { label: 'Tool', icon: 'wrench' }
  };
  var SOLUTIONS = [
    { id: 'sitecore-ext', name: 'Sitecore Connector Extensions', cat: 'connector', tags: ['Sitecore', 'XM Cloud'], version: '3.2.0', updated: '2026-09-18',
      desc: 'Adds multi-site indexing, personalised boosts and preview support to the standard Sitecore connector.' },
    { id: 'opti-feed', name: 'Optimizely Commerce Index Feed', cat: 'integration', tags: ['Optimizely', 'Commerce'], version: '2.4.1', updated: '2026-09-02',
      desc: 'Incremental product and catalogue feed with price lists, inventory and variant roll-up.' },
    { id: 'react-starter', name: 'Headless React Search Starter', cat: 'accelerator', tags: ['React', 'Next.js'], version: '1.8.0', updated: '2026-09-25',
      desc: 'Production-ready search page, autocomplete and facets built on the HawkSearch React SDK.' },
    { id: 'smart-response-kit', name: 'Smart Response Widget Kit', cat: 'ai', tags: ['Smart Response', 'JavaScript'], version: '1.3.0', updated: '2026-09-28',
      desc: 'Drop-in AI answer card for results pages, with sources, follow-up questions and tracking.' },
    { id: 'b2b-pricing', name: 'B2B Customer-Specific Pricing', cat: 'integration', tags: ['B2B', 'ERP'], version: '2.0.3', updated: '2026-08-14',
      desc: 'Shows contract pricing and availability in results without re-indexing for every account.' },
    { id: 'bi-dashboards', name: 'Search Analytics for Power BI', cat: 'analytics', tags: ['Power BI', 'Reporting'], version: '1.1.0', updated: '2026-07-30',
      desc: 'Ready-made reports for zero-result searches, conversion by keyword and merchandising impact.' },
    { id: 'enrichment', name: 'AI Product Data Enrichment', cat: 'ai', tags: ['Catalog', 'Attributes'], version: '0.9.2', updated: '2026-09-10',
      desc: 'Fills missing attributes and writes search-friendly descriptions before products are indexed.' },
    { id: 'synonym-manager', name: 'Synonym & Redirect Bulk Manager', cat: 'tool', tags: ['Merchandising', 'CSV'], version: '1.5.0', updated: '2026-06-22',
      desc: 'Import, review and publish synonyms and keyword redirects in bulk from a spreadsheet.' },
    { id: 'bigcommerce-pack', name: 'BigCommerce Faceted Navigation Pack', cat: 'accelerator', tags: ['BigCommerce', 'Stencil'], version: '2.2.0', updated: '2026-08-05',
      desc: 'Category landing pages with HawkSearch facets, swatches and SEO-friendly URLs.' }
  ];

  function solutionCard(s, opts) {
    opts = opts || {};
    var c = CATEGORIES[s.cat];
    var tag = opts.href ? 'a' : 'div';
    return '<' + tag + ' class="sol' + (opts.mini ? ' sol--mini' : '') + '"' + (opts.href ? ' href="' + esc(opts.href) + '"' : '') + ' data-cat="' + s.cat + '">' +
      '<div class="sol__top"><span class="sol__icon">' + icon(c.icon) + '</span><span class="sol__cat">' + c.label + '</span></div>' +
      '<h3 class="sol__name">' + esc(s.name) + '</h3>' +
      (opts.mini ? '' :
        '<p class="sol__desc">' + esc(s.desc) + '</p>' +
        '<div class="sol__foot">' + s.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') +
        (opts.locked ? '<span class="sol__lock">' + icon('lock') + 'Sign in</span>' : '') + '</div>') +
      '</' + tag + '>';
  }

  window.Portal = {
    session: session,
    icon: icon,
    esc: esc,
    CATEGORIES: CATEGORIES,
    SOLUTIONS: SOLUTIONS,
    solutionCard: solutionCard
  };
})();
