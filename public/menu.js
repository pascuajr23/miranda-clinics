// Phone menu: a button that opens the About / Services / Schedule / Contact links (shown only on phones by CSS).
(() => {
  const header = document.querySelector('.site-header');
  const nav = header && header.querySelector('.nav-links');
  if (!nav) return;
  if (!nav.id) nav.id = 'site-menu';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'menu-toggle';
  button.hidden = true; // hidden unless the phone-size CSS shows it, so an old cached stylesheet can't show it on desktop
  button.setAttribute('aria-controls', nav.id);
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', 'Menu');
  button.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  header.append(button);

  // Header buttons (Login, Home, Logout, Admin) move into the menu on phones: copies that press the real button,
  // rebuilt on each open so only the ones currently shown (not .hidden-btn) appear.
  const extras = document.createElement('div');
  extras.className = 'menu-actions';
  nav.append(extras);
  const buildExtras = () => {
    extras.innerHTML = '';
    header.querySelectorAll('.header-right > .login-btn').forEach((real) => {
      if (real.classList.contains('hidden-btn')) return;
      const copy = document.createElement(real.tagName === 'A' ? 'a' : 'button');
      copy.className = 'login-btn';
      copy.textContent = real.textContent;
      if (real.tagName === 'A') copy.href = real.getAttribute('href');
      else { copy.type = 'button'; copy.addEventListener('click', () => real.click()); }
      extras.append(copy);
    });
  };

  const setOpen = (open) => {
    if (open) buildExtras();
    header.classList.toggle('menu-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
  };
  button.addEventListener('click', () => setOpen(!header.classList.contains('menu-open')));
  nav.addEventListener('click', (e) => e.target.closest('a, button') && setOpen(false));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && setOpen(false));
  document.addEventListener('click', (e) => !header.contains(e.target) && setOpen(false));
})();
