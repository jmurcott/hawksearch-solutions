/*
  HawkSearch Solutions portal: shared script for every page.
  - Portal.session: a FAKE sign-in kept in browser storage, until SSO from the core platform replaces it.
  - Portal.SERVICES: the four Professional Services tools, defined once and used by every page.
  - Portal.renderApp(): the signed-in layout (top navigation + page) for dashboard.html and each service page.
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
      } catch (e) { /* storage blocked: signed-in pages will send them back to sign in */ }
      return user;
    },
    signOut: function () {
      try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch (e) {}
      location.href = 'index.html';
    },
    // Signed-in pages call this first
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
    chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    scrape: '<path d="M4 4h10l6 6v10H4z"/><path d="M14 4v6h6M8 13h8M8 17h5"/>',
    chart: '<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>'
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

  // ---- The four services. Screens are screenshots for now; the working tools get connected later. ----
  var SERVICES = [
    {
      id: 'insights', page: 'insights.html', nav: 'Assistant Insights', name: 'Assistant Insights', icon: 'chat',
      image: 'assets/screens/insights.png', alt: 'Assistant Insights dashboard showing shopper prompts, topics and searches with no response',
      tagline: 'See what shoppers ask your AI Search Assistant.',
      desc: 'Browse and search every Search Assistant conversation, and get an analysis of what shoppers ask about: top product searches, searches that got no response, and customer-service questions the assistant can only redirect.',
      points: ['Search every prompt and response', 'Spot catalogue gaps from unanswered searches', 'Topic and response breakdowns'],
      headline: 'Know Exactly What Shoppers Ask Your AI Assistant',
      blurb: 'Every question a shopper types into your Search Assistant tells you something. Assistant Insights collects those conversations in one place so you can read and search them, and turns them into clear findings: the products people look for most, the searches that got no answer, and how often shoppers need customer service instead. Use it to close catalogue gaps and tune your merchandising around real demand.',
      cta: 'Open Assistant Insights'
    },
    {
      id: 'automations', page: 'automations.html', nav: 'Automations', name: 'Automations', icon: 'bolt',
      image: 'assets/screens/automations.png', alt: 'Automations list with client, automation type, status and dates',
      tagline: 'Run AI-powered jobs against your HawkSearch engine.',
      desc: 'Set up automations such as analyzing keywords, suggesting synonyms and scraping PDFs, and see the status and history of each one.',
      points: ['Analyze keywords', 'Suggest synonyms', 'Scrape PDF content'],
      headline: 'Put Routine Search Tuning on Autopilot',
      blurb: 'Keeping search sharp takes steady, repetitive work. Automations lets Professional Services set up AI-powered jobs for your HawkSearch engine, like analyzing keywords, suggesting synonyms and pulling content out of PDFs, and run them whenever you need. See the status and history of every automation at a glance, so nothing slips through the cracks.',
      cta: 'Open Automations'
    },
    {
      id: 'scraping', page: 'scraping.html', nav: 'Scraping', name: 'Scraping', icon: 'scrape',
      image: 'assets/screens/scraping.png', alt: 'Scraping jobs list with in progress and completed tabs',
      tagline: 'Pull content from websites and documents into HawkSearch.',
      desc: 'Create scraping jobs that collect content from your sites and documents for indexing, and follow each job from in progress to completed.',
      points: ['Create named scraping jobs', 'Track jobs in progress', 'Review completed jobs'],
      headline: 'Turn Websites and Documents into Searchable Content',
      blurb: 'Great answers depend on great content, and a lot of it lives outside your product catalogue. The Scraping tool collects content from your websites and documents and prepares it for your HawkSearch index. Create a job, give it a name, and follow it from in progress to completed, all without writing a line of code.',
      cta: 'Open Scraping'
    },
    {
      id: 'recommendations', page: 'recommendations.html', nav: 'Recommendations', name: 'Recommendations Revenue', icon: 'chart',
      image: 'assets/screens/recommendations.png', alt: 'Recommendations Revenue report with program timeline, attributed revenue and goal pace',
      tagline: 'Grow revenue from HawkSearch Recommendations with a 12-month program.',
      desc: 'Follow your Recommendations Revenue Optimization program: revenue, orders and click-through credited to recommendation widgets, incremental revenue since kickoff, and pace toward the program goal.',
      points: ['Attributed revenue, orders and CTR', 'Incremental revenue since kickoff', 'Pace against the 12-month goal'],
      headline: 'Grow Revenue from Every Recommendation',
      blurb: 'Recommendations should earn their place on the page. In this 12-month program, Professional Services works with your team to raise the revenue your recommendation widgets drive, and this report keeps score: revenue, orders and click-through credited to recommendations, the extra revenue since kickoff, and how you’re pacing against the program goal.',
      cta: 'View the Recommendations Report'
    }
  ];

  function logo(href) {
    return '<a class="brand" href="' + href + '" aria-label="HawkSearch Solutions home">' +
      '<span class="brand__logo"><img src="assets/hawksearchicon.png" alt=""><span class="brand__word">hawk<b>search</b></span></span>' +
      '<span class="brand__tag">Solutions</span></a>';
  }

  // ---- Signed-in layout ----
  function header(active, user) {
    return '<header class="app-top"><div class="app-top__row">' + logo('dashboard.html') +
      '<nav class="app-nav" aria-label="Services"><ul>' + SERVICES.map(function (s) {
        return '<li><a href="' + s.page + '"' + (s.id === active ? ' aria-current="page"' : '') + '>' + esc(s.nav) + '</a></li>';
      }).join('') + '</ul></nav>' +
      '<div class="app-user"><span class="avatar" aria-hidden="true">' + esc(user.initials) + '</span>' +
      '<span class="app-user__name">' + esc(user.name) + '<small>' + esc(user.company) + '</small></span>' +
      '<button class="app-signout" type="button" data-signout>Sign out</button></div>' +
      '</div></header>';
  }
  function footer() {
    return '<footer class="app-foot">© 2026 Bridgeline Digital Inc. All rights reserved.</footer>';
  }

  function serviceCard(s, opts) {
    opts = opts || {};
    return '<a class="svc" href="' + esc(opts.href || s.page) + '">' +
      '<span class="svc__shot"><img src="' + s.image + '" alt="" loading="lazy"></span>' +
      '<span class="svc__body">' +
        '<span class="svc__head"><span class="svc__icon">' + icon(s.icon) + '</span><span class="svc__name">' + esc(s.name) + '</span></span>' +
        '<span class="svc__tagline">' + esc(s.tagline) + '</span>' +
        '<span class="svc__points">' + s.points.map(function (p) { return '<span>' + icon('check') + esc(p) + '</span>'; }).join('') + '</span>' +
        '<span class="svc__open">' + (opts.locked ? icon('lock') + 'Sign in to open' : 'Open ' + esc(s.nav) + icon('right')) + '</span>' +
      '</span></a>';
  }

  // Signed-in home: one row per service, text and call to action on the left, screenshot on the right
  function homePage(user) {
    return '<main class="app-main">' +
      '<div class="page-head"><div><h1>Welcome back, ' + esc(user.firstName) + '</h1>' +
      '<p>Your HawkSearch Professional Services tools for ' + esc(user.company) + '.</p></div></div>' +
      '<div class="feature-rows">' + SERVICES.map(function (s) {
        return '<section class="feature-row" aria-labelledby="fr-' + s.id + '">' +
          '<div class="feature-row__text">' +
            '<p class="feature-row__eyebrow">' + icon(s.icon) + esc(s.name) + '</p>' +
            '<h2 id="fr-' + s.id + '">' + esc(s.headline) + '</h2>' +
            '<p>' + esc(s.blurb) + '</p>' +
            '<a class="btn-cta" href="' + s.page + '">' + esc(s.cta) + '</a>' +
          '</div>' +
          '<a class="feature-row__shot" href="' + s.page + '" tabindex="-1" aria-hidden="true">' +
            '<span class="screen__bar"><span></span><span></span><span></span></span>' +
            '<img src="' + s.image + '" alt="" loading="lazy">' +
          '</a>' +
        '</section>';
      }).join('') + '</div>' +
      '<div class="help-strip">' + icon('users') + '<span><b>Need something else?</b> Professional Services builds custom tools and programs for HawkSearch customers.</span>' +
      '<a class="btn btn--outline btn--sm" href="https://www.hawksearch.com/contact-us">Contact us</a></div>' +
      '</main>';
  }

  function servicePage(s) {
    return '<main class="app-main">' +
      '<div class="page-head"><div>' +
        '<h1><span class="svc__icon svc__icon--lg">' + icon(s.icon) + '</span>' + esc(s.name) + '<span class="preview-badge">Preview</span></h1>' +
        '<p>' + esc(s.desc) + '</p>' +
        '<div class="point-row">' + s.points.map(function (p) { return '<span>' + icon('check') + esc(p) + '</span>'; }).join('') + '</div>' +
      '</div></div>' +
      '<figure class="screen">' +
        '<div class="screen__bar" aria-hidden="true"><span></span><span></span><span></span></div>' +
        '<img src="' + s.image + '" alt="' + esc(s.alt) + '">' +
        '<figcaption>' + icon('image') + 'Screenshot of the current tool. The working version will appear here.</figcaption>' +
      '</figure>' +
      '<nav class="other-svcs" aria-label="Other services"><p>Other services</p><div>' +
        SERVICES.filter(function (o) { return o.id !== s.id; }).map(function (o) {
          return '<a href="' + o.page + '"><span class="svc__icon">' + icon(o.icon) + '</span>' + esc(o.name) + icon('right') + '</a>';
        }).join('') + '</div></nav>' +
      '</main>';
  }

  function wireSignOut() {
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-signout]')) session.signOut();
    });
  }

  // Renders the signed-in page named by <body data-page="home|automations|scraping|recommendations">
  function renderApp() {
    var user = session.require();
    if (!user) return;
    var id = document.body.getAttribute('data-page');
    var s = SERVICES.filter(function (x) { return x.id === id; })[0];
    if (s) document.title = s.name + ' – HawkSearch Solutions';
    document.getElementById('app').innerHTML = header(s ? s.id : '', user) + (s ? servicePage(s) : homePage(user)) + footer();
    wireSignOut();
  }

  // For a service page that brings its own content (the working Assistant Insights tool): just the portal header and footer
  function renderChrome(activeId) {
    var user = session.require();
    if (!user) return;
    document.getElementById('app-header').outerHTML = header(activeId, user);
    document.getElementById('app-footer').outerHTML = footer();
    wireSignOut();
  }

  window.Portal = {
    session: session,
    icon: icon,
    esc: esc,
    SERVICES: SERVICES,
    serviceCard: serviceCard,
    renderApp: renderApp,
    renderChrome: renderChrome
  };
})();
