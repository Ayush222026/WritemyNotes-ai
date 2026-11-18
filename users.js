(function () {
  'use strict';

  function mk(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtDate(d) {
    if (!d) return '\u2014';
    try {
      return new Date(d).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
      });
    } catch (e) { return d; }
  }

  const navBtn = document.getElementById('navUsersBtn');
  const view = document.getElementById('view-users');
  if (!navBtn || !view) { console.error('Users UI elements missing from index.html'); return; }

  const tableWrap = view.querySelector('#usersTableWrap');
  const statusEl = view.querySelector('#usersStatus');
  const searchEl = view.querySelector('#usersSearch');
  const refreshBtn = view.querySelector('#usersRefresh');

  function waitAuth(cb) {
    const iv = setInterval(() => {
      if (window.WMN && window.WMN.auth) { clearInterval(iv); cb(window.WMN.auth); }
    }, 150);
  }

  waitAuth(function (auth) {
    const sb = auth.client;
    let allRows = [];

    function render(rows) {
      tableWrap.textContent = '';
      if (!rows.length) { tableWrap.appendChild(mk('p', 'muted', 'No users yet.')); return; }
      const table = document.createElement('table');
      table.className = 'users-table';
      table.innerHTML = '<thead><tr><th>Name</th><th>Email</th><th>Signed Up</th><th>Last Login</th></tr></thead>';
      const tbody = document.createElement('tbody');
      rows.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + (r.name ? escapeHtml(r.name) : '<span class="muted">\u2014</span>') + '</td>' +
          '<td>' + escapeHtml(r.email) + '</td>' +
          '<td>' + fmtDate(r.created_at) + '</td>' +
          '<td>' + fmtDate(r.last_login) + '</td>';
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableWrap.appendChild(table);
    }

    async function loadUsers() {
      statusEl.textContent = 'Loading...';
      try {
        const { data, error } = await sb
          .from('profiles')
          .select('id,email,name,created_at,last_login')
          .order('created_at', { ascending: false });
        if (error) throw error;
        allRows = data || [];
        render(allRows);
        statusEl.textContent = allRows.length + (allRows.length === 1 ? ' registered user' : ' registered users');
      } catch (e) {
        console.error(e);
        statusEl.textContent = 'Error loading users: ' + (e && e.message ? e.message : 'unknown');
        toast('Could not load users', 'error');
      }
    }

    if (searchEl) {
      searchEl.addEventListener('input', () => {
        const q = searchEl.value.trim().toLowerCase();
        if (!q) { render(allRows); return; }
        render(allRows.filter(r =>
          (r.name || '').toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q)
        ));
      });
    }
    if (refreshBtn) refreshBtn.addEventListener('click', loadUsers);
    navBtn.addEventListener('click', loadUsers);

    function refreshVisibility(user) {
      navBtn.style.display = auth.isAdmin(user) ? '' : 'none';
    }

    sb.auth.onAuthStateChange((event, session) => {
      const user = session && session.user;
      refreshVisibility(user);
      if (user && auth.isAdmin(user)) loadUsers();
    });
    sb.auth.getSession().then(({ data }) => {
      const user = data && data.session && data.session.user;
      refreshVisibility(user);
      if (user && auth.isAdmin(user)) loadUsers();
    });
  });
})();
