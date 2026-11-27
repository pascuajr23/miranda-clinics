// Phone menu: a button that opens the About / Services / Schedule / Contact links (shown only on phones by CSS).
(() => {
  const header = document.querySelector('.site-header');
  const nav = header?.querySelector('.nav-links');
  if (!nav) return;
  nav.id ||= 'site-menu';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'menu-toggle';
  button.setAttribute('aria-controls', nav.id);
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', 'Menu');
  button.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  header.append(button);

  const setOpen = (open) => {
    header.classList.toggle('menu-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
  };
  button.addEventListener('click', () => setOpen(!header.classList.contains('menu-open')));
  nav.addEventListener('click', (e) => e.target.closest('a') && setOpen(false));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && setOpen(false));
  document.addEventListener('click', (e) => !header.contains(e.target) && setOpen(false));
})();
