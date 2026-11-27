// Shared by the admin page and the queue control panel.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const COLORS = ['blue', 'green', 'purple', 'orange']; // same list as server.js
let toastTimer;

function toast(message, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// onLoggedOut runs when the server says the session ended.
async function api(method, path, body, onLoggedOut) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && path !== '/api/login') onLoggedOut?.();
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Request failed (${res.status})`);
  return res.status === 204 ? null : res.json();
}

// Two-tap confirm instead of window.confirm(), which some browsers and in-app views block (it then returns false).
function confirmTap(button, prompt) {
  if (button.dataset.armed) return true;
  const original = button.textContent;
  button.dataset.armed = '1';
  button.textContent = prompt;
  setTimeout(() => { delete button.dataset.armed; button.textContent = original; }, 4000);
  return false;
}

// Ties each <label> to the field right after it (for/id), so screen readers and taps on the label work.
// Runs on every render instead of hand-writing ids in each template.
let fieldSeq = 0;
function linkLabels(root = document) {
  for (const label of root.querySelectorAll('label:not([for])')) {
    const field = label.nextElementSibling;
    if (!field || !field.matches('input, select, textarea') || label.contains(field)) continue;
    field.id ||= `f${++fieldSeq}`;
    label.htmlFor = field.id;
  }
}
new MutationObserver(() => linkLabels()).observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('DOMContentLoaded', () => linkLabels());
