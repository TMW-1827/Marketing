/* ==========================================================================
   Автентифікація та права доступу.

   УВАГА: у цій версії перевірка пароля виконується на клієнті — цього
   достатньо для внутрішнього пілота, але для промислової експлуатації
   автентифікацію треба винести на сервер (SSO / Microsoft Entra ID або
   обліковий запис BAS). Точка інтеграції — функції login() та hashPassword().
   ========================================================================== */

import { all, get, update, ROLES, ALL_PERMS, logAudit, persist } from './store.js';

const SESSION_KEY = 'tmw_eq_session';

/** SHA-256 → hex. Резервний варіант — для незахищеного контексту (file://) */
export async function hashPassword(plain) {
  const data = new TextEncoder().encode('tmw::' + plain);
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (const b of data) { h1 = (h1 ^ b) * 16777619 >>> 0; h2 = (h2 + b * 31) >>> 0; }
  return 'fnv' + h1.toString(16) + h2.toString(16);
}

let _current = null;

export function currentUser() {
  if (_current) return _current;
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  const u = get('users', id);
  if (!u || !u.active) { localStorage.removeItem(SESSION_KEY); return null; }
  _current = u;
  return u;
}

export async function login(loginName, password) {
  const u = all('users').find((x) => x.login.toLowerCase() === String(loginName).trim().toLowerCase());
  if (!u) throw new Error('Користувача не знайдено');
  if (!u.active) throw new Error('Обліковий запис заблоковано. Зверніться до адміністратора.');
  const h = await hashPassword(password);
  if (h !== u.passwordHash) throw new Error('Невірний пароль');
  localStorage.setItem(SESSION_KEY, u.id);
  _current = u;
  update('users', u.id, { lastLoginAt: new Date().toISOString() }, { silent: true });
  logAudit(u.id, 'login', 'user', u.id, 'Вхід у портал');
  persist();
  return u;
}

/** Вхід демо-користувачем в один клік (кнопки на екрані входу) */
export function loginAs(userId) {
  const u = get('users', userId);
  if (!u || !u.active) throw new Error('Користувача недоступний');
  localStorage.setItem(SESSION_KEY, u.id);
  _current = u;
  update('users', u.id, { lastLoginAt: new Date().toISOString() }, { silent: true });
  logAudit(u.id, 'login', 'user', u.id, 'Вхід у портал (демо-режим)');
  persist();
  return u;
}

export function logout() {
  const u = currentUser();
  if (u) { logAudit(u.id, 'logout', 'user', u.id, 'Вихід із порталу'); persist(); }
  localStorage.removeItem(SESSION_KEY);
  _current = null;
}

export function refreshCurrent() {
  _current = null;
  return currentUser();
}

/** Повний перелік прав користувача: права ролі + індивідуальні − відкликані */
export function permsOf(user) {
  if (!user) return [];
  const role = ROLES.find((r) => r.id === user.role);
  const base = new Set(role ? role.perms : []);
  for (const p of user.extraPerms || []) base.add(p);
  for (const p of user.deniedPerms || []) base.delete(p);
  return [...base].filter((p) => ALL_PERMS.includes(p));
}

export function can(perm, user = currentUser()) {
  if (!user) return false;
  if (user.role === 'admin' && !(user.deniedPerms || []).includes(perm)) return true;
  return permsOf(user).includes(perm);
}

export const canAny = (...perms) => perms.some((p) => can(p));

/** Чи є користувач відповідальним менеджером саме цієї одиниці обладнання */
export function isResponsibleFor(eq, user = currentUser()) {
  return !!(eq && user && eq.responsibleManagerId === user.id);
}
