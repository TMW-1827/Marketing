/* ==========================================================================
   Бізнес-логіка процесу (за «Положенням про порядок обліку та управління
   торговельним обладнанням»). Усі зміни статусів проходять через цей модуль,
   щоб історія руху та журнал аудиту заповнювалися послідовно.
   ========================================================================== */

import {
  raw, all, get, insert, update, persist, nextNumber, addMovement, logAudit, notify,
  statusName, settings, holderLabel,
} from './store.js';
import { nowISO, uid, workdaysSince } from './util.js';

/* ---------- Зміна статусу ---------- */
export function setStatus(eq, newStatus, user, { comment = '', doc = null, holder = null } = {}) {
  const from = eq.status;
  const patch = { status: newStatus };
  if (holder) {
    patch.holderType = holder.holderType ?? eq.holderType;
    patch.holderId = holder.holderId ?? eq.holderId;
    patch.outletId = holder.outletId !== undefined ? holder.outletId : eq.outletId;
    if (holder.responsibleManagerId !== undefined) patch.responsibleManagerId = holder.responsibleManagerId;
  }
  update('equipment', eq.id, patch, { silent: true });
  addMovement({
    equipmentId: eq.id, type: 'status', fromStatus: from, toStatus: newStatus,
    userId: user.id, comment, doc,
    holderAfter: holderLabel({ ...eq, ...patch }),
  });
  logAudit(user.id, 'status', 'equipment', eq.id, `${statusName(from)} → ${statusName(newStatus)}${comment ? '. ' + comment : ''}`);
  persist();
  return get('equipment', eq.id);
}

/* ==========================================================================
   Заявки на передачу (п. 3–5)
   ========================================================================== */
export function createRequest(data, user) {
  const rec = insert('requests', {
    number: nextNumber('ЗАЯВКА'),
    createdBy: user.id,
    status: 'pending',
    approval: null, planning: null, shipment: null, actId: null,
    ...data,
  }, { silent: true });
  logAudit(user.id, 'create', 'request', rec.id, `Створено заявку ${rec.number}`);
  const directors = all('users').filter((u) => u.role === 'commercial_director' && u.active).map((u) => u.id);
  notify(directors, `Нова заявка на передачу ТО ${rec.number} потребує погодження`, `#/requests/${rec.id}`);
  persist();
  return rec;
}

export function approveRequest(req, user, decision, comment = '') {
  const status = decision === 'approved' ? 'approved' : 'rejected';
  update('requests', req.id, {
    status,
    approval: { userId: user.id, at: nowISO(), decision, comment },
  }, { silent: true });
  logAudit(user.id, decision, 'request', req.id,
    `${decision === 'approved' ? 'Погоджено' : 'Відхилено'} заявку ${req.number}${comment ? '. ' + comment : ''}`);
  const targets = [req.createdBy];
  if (decision === 'approved') {
    targets.push(...all('users').filter((u) => u.role === 'sales_admin' && u.active).map((u) => u.id));
  }
  notify(targets, `Заявку ${req.number} ${decision === 'approved' ? 'погоджено' : 'відхилено'}`, `#/requests/${req.id}`);
  persist();
  return get('requests', req.id);
}

export function planRequest(req, user, data) {
  update('requests', req.id, {
    status: 'planned',
    planning: { userId: user.id, at: nowISO(), ...data },
  }, { silent: true });
  logAudit(user.id, 'plan', 'request', req.id, `Заплановано передачу за заявкою ${req.number}`);
  const whUsers = all('users').filter((u) => u.role === 'warehouse' && u.active).map((u) => u.id);
  notify([...whUsers, req.createdBy], `Заявку ${req.number} заплановано до відвантаження`, `#/requests/${req.id}`);
  persist();
  return get('requests', req.id);
}

export function shipRequest(req, user, comment = '') {
  update('requests', req.id, { status: 'shipped', shipment: { userId: user.id, at: nowISO(), comment } }, { silent: true });
  for (const id of req.equipmentIds) {
    const eq = get('equipment', id);
    if (eq) setStatus(eq, 'in_transit', user, { comment: `Відвантажено за заявкою ${req.number}`, doc: req.number });
  }
  logAudit(user.id, 'ship', 'request', req.id, `Відвантажено за заявкою ${req.number}`);
  notify([req.createdBy], `Обладнання за заявкою ${req.number} відвантажено`, `#/requests/${req.id}`);
  persist();
  return get('requests', req.id);
}

/** Оформлення Акта приймання-передачі (п. 5) та переведення ТО до отримувача */
export function createAct(req, user, data) {
  const act = insert('acts', {
    number: nextNumber('АКТ'),
    requestId: req.id,
    date: data.date || nowISO(),
    transferType: req.transferType,
    recipientId: req.recipientId,
    viaDistributorId: req.viaDistributorId || null,
    outletId: data.outletId || req.outletId || null,
    equipmentIds: [...req.equipmentIds],
    responsibleManagerId: data.responsibleManagerId || req.createdBy,
    recipientSigner: data.recipientSigner || '',
    managerSigned: !!data.managerSigned,
    ttn: data.ttn || (req.planning && req.planning.ttn) || '',
    note: data.note || '',
    createdBy: user.id,
  }, { silent: true });

  const recipient = get('counterparties', req.recipientId);
  const newStatus = recipient && recipient.type === 'distributor' && req.transferType === 'distributor'
    ? 'at_distributor' : 'at_client';

  for (const id of act.equipmentIds) {
    const eq = get('equipment', id);
    if (!eq) continue;
    setStatus(eq, newStatus, user, {
      comment: `Передано за Актом ${act.number}`,
      doc: act.number,
      holder: {
        holderType: 'counterparty',
        holderId: req.recipientId,
        outletId: act.outletId || null,
        responsibleManagerId: act.responsibleManagerId,
      },
    });
    update('equipment', id, { transferredAt: act.date, locationDueAt: null, lastConfirmedAt: null }, { silent: true });
  }
  update('requests', req.id, { status: 'completed', actId: act.id }, { silent: true });
  logAudit(user.id, 'act', 'request', req.id, `Оформлено Акт приймання-передачі ${act.number}`);
  notify([act.responsibleManagerId], `Оформлено Акт ${act.number}. Внесіть фактичне місцезнаходження ТО протягом ${settings().locationDeadlineDays} робочих днів (п. 6.1)`, `#/equipment`);
  persist();
  return act;
}

export function cancelRequest(req, user, reason) {
  update('requests', req.id, { status: 'cancelled', cancelReason: reason }, { silent: true });
  logAudit(user.id, 'cancel', 'request', req.id, `Скасовано заявку ${req.number}. ${reason || ''}`);
  persist();
}

/* ==========================================================================
   Місцезнаходження (п. 6) та щомісячний контроль (п. 8)
   ========================================================================== */
export function setLocation(eq, user, { outletId, geo, comment, photoIds }) {
  const patch = { outletId: outletId || eq.outletId, lastConfirmedAt: nowISO() };
  if (geo) patch.lastGeo = geo;
  if (photoIds && photoIds.length) patch.photos = [...new Set([...(eq.photos || []), ...photoIds])];
  update('equipment', eq.id, patch, { silent: true });
  addMovement({
    equipmentId: eq.id, type: 'location', userId: user.id,
    comment: comment || 'Внесено/актуалізовано фактичне місцезнаходження (п. 6)',
    geo: geo || null, photoIds: photoIds || [],
  });
  logAudit(user.id, 'location', 'equipment', eq.id, comment || 'Оновлено місцезнаходження');
  persist();
}

/** ТО, у якого прострочено внесення місцезнаходження після передачі (п. 6.1) */
export function locationOverdue() {
  const limit = settings().locationDeadlineDays;
  return all('equipment').filter((e) => {
    if (!['at_client', 'at_distributor'].includes(e.status)) return false;
    if (e.lastConfirmedAt) return false;
    if (!e.transferredAt) return false;
    return (workdaysSince(e.transferredAt) || 0) > limit;
  });
}

/** ТО без підтвердження наявності понад рік (п. 12.1) */
export function confirmationOverdue() {
  const months = settings().inventoryPeriodMonths;
  const cutoff = Date.now() - months * 30.4 * 86400000;
  return all('equipment').filter((e) => {
    if (!['at_client', 'at_distributor'].includes(e.status)) return false;
    const base = e.lastConfirmedAt || e.transferredAt;
    if (!base) return true;
    return new Date(base).getTime() < cutoff;
  });
}

/* ==========================================================================
   Переміщення та повернення (п. 9)
   ========================================================================== */
export function moveEquipment(eq, user, { targetType, counterpartyId, outletId, warehouseId, responsibleManagerId, docNumber, comment }) {
  let status = eq.status, holder = {};
  if (targetType === 'warehouse') {
    status = 'returned';
    holder = { holderType: 'warehouse', holderId: warehouseId, outletId: null, responsibleManagerId: null };
  } else {
    const cp = get('counterparties', counterpartyId);
    status = cp && cp.type === 'distributor' ? 'at_distributor' : 'at_client';
    holder = { holderType: 'counterparty', holderId: counterpartyId, outletId: outletId || null, responsibleManagerId };
  }
  setStatus(eq, status, user, { comment: comment || 'Переміщення ТО (п. 9)', doc: docNumber, holder });
  update('equipment', eq.id, { lastConfirmedAt: null, lastGeo: null, transferredAt: nowISO() }, { silent: true });
  persist();
}

export function returnToWarehouse(eq, user, { warehouseId, docNumber, condition, comment }) {
  setStatus(eq, 'returned', user, {
    comment: `Повернення на склад. Стан: ${condition || 'робочий'}. ${comment || ''}`.trim(),
    doc: docNumber,
    holder: { holderType: 'warehouse', holderId: warehouseId, outletId: null, responsibleManagerId: null },
  });
  update('equipment', eq.id, { lastConfirmedAt: nowISO(), transferredAt: null }, { silent: true });
  persist();
}

/* ==========================================================================
   Ремонт (п. 10)
   ========================================================================== */
export function createRepair(data, user) {
  const rec = insert('repairs', {
    number: nextNumber('РЕМ'),
    createdBy: user.id,
    createdAt: nowISO(),
    status: 'new',
    log: [],
    ...data,
  }, { silent: true });
  logAudit(user.id, 'create', 'repair', rec.id, `Створено заявку на ремонт ${rec.number}`);
  const tms = all('users').filter((u) => u.role === 'trade_marketing' && u.active).map((u) => u.id);
  notify(tms, `Нова заявка на ремонт ${rec.number}`, `#/repairs/${rec.id}`);
  addMovement({ equipmentId: data.equipmentId, type: 'repair', userId: user.id, comment: `Подано заявку на ремонт ${rec.number}` });
  persist();
  return rec;
}

export function updateRepair(rep, user, patch, logText) {
  const log = [...(rep.log || []), { at: nowISO(), userId: user.id, text: logText }];
  update('repairs', rep.id, { ...patch, log }, { silent: true });
  logAudit(user.id, 'update', 'repair', rep.id, logText);
  persist();
  return get('repairs', rep.id);
}

export function startRepair(rep, user) {
  const eq = get('equipment', rep.equipmentId);
  if (eq) {
    setStatus(eq, 'in_repair', user, {
      comment: `Передано в ремонт за заявкою ${rep.number}`,
      doc: rep.number,
      holder: rep.serviceCompanyId ? { holderType: 'service', holderId: rep.serviceCompanyId } : null,
    });
  }
  return updateRepair(rep, user, { status: 'in_repair', startedAt: nowISO() }, 'Обладнання передано в ремонт');
}

export function finishRepair(rep, user, { actNumber, cost, resultStatus, returnTo, comment }) {
  const eq = get('equipment', rep.equipmentId);
  if (eq) {
    if (resultStatus === 'written_off') {
      setStatus(eq, 'to_write_off', user, { comment: 'Ремонт визнано недоцільним (п. 11.1)', doc: actNumber });
    } else if (returnTo === 'warehouse') {
      setStatus(eq, 'returned', user, {
        comment: `Повернення з ремонту. Акт ${actNumber || ''}`.trim(), doc: actNumber,
        holder: { holderType: 'warehouse', holderId: returnTo === 'warehouse' ? (all('warehouses')[0] || {}).id : null },
      });
    } else {
      const prev = [...all('movements')].filter((m) => m.equipmentId === eq.id && ['at_client', 'at_distributor'].includes(m.toStatus))
        .sort((a, b) => new Date(b.at) - new Date(a.at))[0];
      setStatus(eq, prev ? prev.toStatus : 'returned', user, {
        comment: `Повернення з ремонту в експлуатацію (п. 10.4). Акт ${actNumber || ''}`.trim(), doc: actNumber,
      });
    }
  }
  return updateRepair(rep, user, {
    status: 'done', completedAt: nowISO(), actNumber, cost, resultStatus, comment,
  }, `Ремонт завершено. Акт виконаних робіт ${actNumber || '—'}, вартість ${cost || 0} грн`);
}

/* ==========================================================================
   Втрата / пошкодження (п. 11)
   ========================================================================== */
export function createIncident(data, user) {
  const rec = insert('incidents', {
    number: nextNumber('ІНЦ'),
    createdBy: user.id,
    createdAt: nowISO(),
    status: 'investigating',
    decision: '', decidedBy: null, decidedAt: null,
    ...data,
  }, { silent: true });
  const targets = all('users')
    .filter((u) => ['commercial_director', 'accountant', 'trade_marketing'].includes(u.role) && u.active)
    .map((u) => u.id);
  notify(targets, `Повідомлення про ${data.type === 'loss' ? 'втрату' : 'пошкодження'} ТО — ${rec.number}`, `#/operations`);
  logAudit(user.id, 'create', 'incident', rec.id, `Зареєстровано інцидент ${rec.number}`);
  addMovement({ equipmentId: data.equipmentId, type: 'incident', userId: user.id, comment: `Інцидент ${rec.number}: ${data.description}` });
  persist();
  return rec;
}

export function decideIncident(inc, user, { decision, comment }) {
  update('incidents', inc.id, { status: 'closed', decision, comment, decidedBy: user.id, decidedAt: nowISO() }, { silent: true });
  const eq = get('equipment', inc.equipmentId);
  if (eq) {
    if (decision === 'write_off') setStatus(eq, 'to_write_off', user, { comment: `Рішення за інцидентом ${inc.number}: списання` });
    else if (decision === 'repair') setStatus(eq, 'in_repair', user, { comment: `Рішення за інцидентом ${inc.number}: ремонт` });
    else if (decision === 'return') setStatus(eq, 'returned', user, { comment: `Рішення за інцидентом ${inc.number}: повернення` });
  }
  logAudit(user.id, 'decide', 'incident', inc.id, `Рішення: ${decision}. ${comment || ''}`);
  persist();
}

/* ==========================================================================
   Списання (п. 11.3)
   ========================================================================== */
export function createWriteOff(data, user) {
  const rec = insert('writeoffs', {
    number: nextNumber('СПИС'),
    createdBy: user.id,
    createdAt: nowISO(),
    status: 'pending',
    ...data,
  }, { silent: true });
  for (const id of data.equipmentIds) {
    const eq = get('equipment', id);
    if (eq) setStatus(eq, 'to_write_off', user, { comment: `Ініційовано списання, документ ${rec.number}`, doc: rec.number });
  }
  const directors = all('users').filter((u) => u.role === 'commercial_director' && u.active).map((u) => u.id);
  notify(directors, `Акт на списання ${rec.number} потребує затвердження`, `#/operations`);
  logAudit(user.id, 'create', 'writeoff', rec.id, `Ініційовано списання ${rec.number}`);
  persist();
  return rec;
}

export function approveWriteOff(wo, user, approved, comment = '') {
  update('writeoffs', wo.id, {
    status: approved ? 'approved' : 'rejected',
    decidedBy: user.id, decidedAt: nowISO(), decisionComment: comment,
  }, { silent: true });
  for (const id of wo.equipmentIds) {
    const eq = get('equipment', id);
    if (!eq) continue;
    if (approved) setStatus(eq, 'written_off', user, { comment: `Списано за документом ${wo.number}`, doc: wo.number });
    else setStatus(eq, 'returned', user, { comment: `Списання відхилено (${wo.number}). ${comment}` });
  }
  logAudit(user.id, approved ? 'approve' : 'reject', 'writeoff', wo.id, `${approved ? 'Затверджено' : 'Відхилено'} списання ${wo.number}`);
  persist();
}

/* ==========================================================================
   Інвентаризація (п. 12)
   ========================================================================== */
export function createInventory(data, user) {
  const scope = data.scope || { statuses: ['at_client', 'at_distributor'], managerIds: [] };
  const items = all('equipment')
    .filter((e) => scope.statuses.includes(e.status))
    .filter((e) => !scope.managerIds.length || scope.managerIds.includes(e.responsibleManagerId))
    .map((e) => ({
      equipmentId: e.id, status: 'pending', method: null, photoIds: [], geo: null,
      confirmedAt: null, userId: null, comment: '',
    }));
  const rec = insert('inventories', {
    number: nextNumber('ІНВ'),
    createdBy: user.id, createdAt: nowISO(),
    status: 'active', scope, items,
    ...data,
  }, { silent: true });
  const targets = [...new Set(all('equipment').filter((e) => items.some((i) => i.equipmentId === e.id))
    .map((e) => e.responsibleManagerId).filter(Boolean))];
  notify(targets, `Розпочато інвентаризацію ${rec.number}. Підтвердіть наявність закріпленого ТО.`, '#/inventory');
  logAudit(user.id, 'create', 'inventory', rec.id, `Створено інвентаризацію ${rec.number} (${items.length} од.)`);
  persist();
  return rec;
}

/** Підтвердження однієї позиції (п. 12.3) */
export function confirmInventoryItem(inv, equipmentId, user, { method, photoIds, geo, comment, discrepancy }) {
  const item = inv.items.find((i) => i.equipmentId === equipmentId);
  if (!item) return null;
  Object.assign(item, {
    status: discrepancy ? 'discrepancy' : 'confirmed',
    method, photoIds: photoIds || [], geo: geo || null,
    confirmedAt: nowISO(), userId: user.id, comment: comment || '', discrepancy: discrepancy || null,
  });
  update('inventories', inv.id, { items: inv.items }, { silent: true });

  const eq = get('equipment', equipmentId);
  if (eq && !discrepancy) {
    update('equipment', equipmentId, {
      lastConfirmedAt: item.confirmedAt,
      lastGeo: geo || eq.lastGeo,
      photos: [...new Set([...(eq.photos || []), ...(photoIds || [])])],
    }, { silent: true });
  }
  addMovement({
    equipmentId, type: 'inventory', userId: user.id, geo: geo || null, photoIds: photoIds || [],
    comment: `Інвентаризація ${inv.number}: ${discrepancy ? 'розбіжність — ' + discrepancy : 'наявність підтверджено'}${comment ? '. ' + comment : ''}`,
  });
  logAudit(user.id, 'confirm', 'inventory', inv.id, `Підтверджено ${eq ? eq.invNumber : equipmentId}`);
  persist();
  return item;
}

export function closeInventory(inv, user) {
  update('inventories', inv.id, { status: 'closed', closedAt: nowISO(), closedBy: user.id }, { silent: true });
  logAudit(user.id, 'close', 'inventory', inv.id, `Закрито інвентаризацію ${inv.number}`);
  persist();
}

/* ==========================================================================
   Щомісячний звіт (п. 8)
   ========================================================================== */
export function monthlyReportRows() {
  return all('equipment')
    .filter((e) => e.status !== 'written_off')
    .map((e) => ({
      eq: e,
      manager: e.responsibleManagerId,
      needsCheck: ['at_client', 'at_distributor'].includes(e.status),
    }));
}

/** Чи настав час щомісячного контролю (до 5 числа) */
export function monthlyControlDue() {
  const day = new Date().getDate();
  return day <= settings().monthlyReportDay;
}
