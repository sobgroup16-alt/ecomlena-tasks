/* ECOMLENA · Задачи. Прототип. Вся логика экранов здесь. */
const STATUS = {
  new: 'Новая', in_progress: 'В работе', done: 'Готово', postponed: 'Перенесена',
};
const PRIORITY = { low: 'Низкий', normal: 'Обычный', high: 'Высокий' };
const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const DOW_FULL = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];

const state = {
  tab: 'week',            // week | tracks
  screen: 'week',         // week | tracks | track | client
  date: ymd(new Date()),  // выбранный день
  trackId: null, clientId: null,
  showDone: false,
  sheet: null,            // { mode: 'add'|'edit', taskId?, draft }
  authMode: 'in',         // in | up | reset | newpass
  authMsg: '', authErr: '',
  user: null,             // вошедший пользователь Supabase
  importCount: 0,         // сколько локальных задач можно перенести
};
let data = { tracks: [], subs: [], clients: [], tasks: [] };

const $app = document.getElementById('app');
const $tabbar = document.getElementById('tabbar');
const $sheet = document.getElementById('sheet');

/* ---------- утилиты ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => ymd(new Date());
function parse(d) { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd); }
function mondayOf(d) { const x = parse(d); const wd = (x.getDay() + 6) % 7; return addDays(d, -wd); }
function human(d) { const x = parse(d); return x.getDate() + ' ' + MONTHS[x.getMonth()]; }
function dayTitle(d) {
  if (d === today()) return 'Сегодня, ' + human(d);
  if (d === addDays(today(), 1)) return 'Завтра, ' + human(d);
  return DOW_FULL[(parse(d).getDay() + 6) % 7] + ', ' + human(d);
}
const isOverdue = t => t.due_date && t.due_date < today() && t.status !== 'done';
const track = id => data.tracks.find(t => t.id === id);
const sub = id => data.subs.find(s => s.id === id);
const client = id => data.clients.find(c => c.id === id);
function toast(msg) {
  document.querySelectorAll('.toast').forEach(x => x.remove());
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el); setTimeout(() => el.remove(), 1600);
}

async function reload() {
  data.tracks = await Store.getTracks();
  data.subs = await Store.getSubcategories();
  data.clients = await Store.listClients();
  data.tasks = await Store.listTasks();
}

/* ---------- карточка задачи ---------- */
function taskRow(t, opts = {}) {
  const tr = track(t.track_id);
  const where = t.client_id ? client(t.client_id)?.name : (t.subcategory_id ? sub(t.subcategory_id)?.title : '');
  const chips = [];
  if (t.due_time) chips.push(`<span class="chip time">🕒 ${esc(t.due_time)}</span>`);
  if (opts.showTrack !== false) chips.push(`<span class="chip track" style="background:${tr.color}33">${tr.icon} ${esc(tr.title)}</span>`);
  if (where) chips.push(`<span class="chip">${esc(where)}</span>`);
  if (opts.showDate && t.due_date) chips.push(`<span class="chip">${esc(human(t.due_date))}</span>`);
  if (isOverdue(t)) chips.push(`<span class="chip overdue">просрочена</span>`);
  if (t.priority === 'high' && t.status !== 'done') chips.push(`<span class="chip high">важно</span>`);
  if (t.status === 'in_progress' || t.status === 'postponed') chips.push(`<span class="chip st-${t.status}">${STATUS[t.status]}</span>`);
  const action = opts.moveToday ? `<button class="mini" data-act="today" data-id="${t.id}">На сегодня</button>` : '';
  return `<div class="task ${t.status === 'done' ? 'done' : ''}" data-act="open" data-id="${t.id}">
    <button class="check" data-act="toggle" data-id="${t.id}" aria-label="Отметить">${t.status === 'done' ? '✓' : ''}</button>
    <div class="body"><div class="title">${esc(t.title)}</div><div class="meta">${chips.join('')}</div></div>${action}
  </div>`;
}
const sortTasks = arr => arr.slice().sort((a, b) =>
  (a.status === 'done') - (b.status === 'done') ||
  (b.priority === 'high') - (a.priority === 'high') ||
  (a.due_date || '9999').localeCompare(b.due_date || '9999') ||
  (a.due_time || '99:99').localeCompare(b.due_time || '99:99'));
/* день: сначала задачи со временем по возрастанию, потом без времени (важные выше) */
const sortDay = arr => arr.slice().sort((a, b) =>
  (a.due_time || '99:99').localeCompare(b.due_time || '99:99') ||
  (b.priority === 'high') - (a.priority === 'high'));

/* ---------- экран: неделя ---------- */
function renderWeek() {
  const mon = mondayOf(state.date);
  const days = DOW.map((_, i) => addDays(mon, i));
  const strip = days.map((d, i) => {
    const n = data.tasks.filter(t => t.due_date === d && t.status !== 'done').length;
    const dots = '<span></span>'.repeat(Math.min(n, 3));
    return `<button class="day ${d === state.date ? 'sel' : ''} ${d === today() ? 'today' : ''}" data-act="day" data-date="${d}">
      <div class="dw">${DOW[i]}</div><div class="dn">${parse(d).getDate()}</div><div class="dots">${dots}</div></button>`;
  }).join('');

  const dayTasks = sortDay(data.tasks.filter(t => t.due_date === state.date));
  const done = dayTasks.filter(t => t.status === 'done').length;
  const pct = dayTasks.length ? Math.round(done / dayTasks.length * 100) : 0;
  const overdue = state.date === today() ? sortTasks(data.tasks.filter(isOverdue)) : [];

  $app.innerHTML = `
    <div class="topbar"><h1>Неделя</h1><div class="brand">ECOM<b>LENA</b><i>.</i></div></div>
    <div class="weeknav">
      <button data-act="week" data-dir="-1">‹</button>
      <span>${esc(human(days[0]))} – ${esc(human(days[6]))}</span>
      <button data-act="week" data-dir="1">›</button>
    </div>
    ${state.importCount ? `<div class="banner">На этом телефоне есть ваши задачи из прототипа: ${state.importCount}.
      <div class="row"><button class="mini" data-act="import">Перенести задачи с этого телефона</button><button class="ghost" data-act="import_skip">Не нужно</button></div></div>` : ''}
    <div class="days">${strip}</div>
    ${state.date !== today() ? `<button class="ghost" data-act="gotoday" style="margin-bottom:10px">← Сегодня</button>` : ''}
    <div class="dayhead"><h2>${esc(dayTitle(state.date))}</h2><span class="progress">${done} из ${dayTasks.length}</span></div>
    <div class="bar"><div style="width:${pct}%"></div></div>
    ${overdue.length ? `<div class="section-title alert">Просроченные · ${overdue.length}</div>${overdue.map(t => taskRow(t, { showDate: true, moveToday: true })).join('')}<div class="section-title">На сегодня</div>` : ''}
    ${dayTasks.length ? dayTasks.map(t => taskRow(t)).join('') : `<div class="empty">На этот день задач нет.<br>Нажмите «+», чтобы добавить.</div>`}
  `;
}

/* ---------- экран: треки ---------- */
function renderTracks() {
  const cards = data.tracks.map(tr => {
    const open = data.tasks.filter(t => t.track_id === tr.id && t.status !== 'done').length;
    const extra = tr.id === 'clients' ? ` · клиентов: ${data.clients.length}` : '';
    return `<button class="trackcard" style="--c:${tr.color}" data-act="track" data-id="${tr.id}">
      <div class="ic">${tr.icon}</div><h3>${esc(tr.title)}</h3><div class="cnt">Открытых: ${open}${extra}</div></button>`;
  }).join('');
  const noDate = data.tasks.filter(t => !t.due_date && t.status !== 'done');
  $app.innerHTML = `
    <div class="topbar"><h1>Треки</h1><div class="brand">ECOM<b>LENA</b><i>.</i></div></div>
    <div class="tracks">${cards}</div>
    <div class="section-title">Без даты · ${noDate.length}</div>
    ${noDate.length ? sortTasks(noDate).map(t => taskRow(t)).join('') : '<div class="empty">Все задачи распределены по дням.</div>'}
    ${state.user
      ? `<button class="reset" data-act="signout">Выйти (${esc(state.user.email)})</button>`
      : `<button class="reset" data-act="reset">Сбросить демо-данные</button>`}`;
}

function groupBlock(title, tasks) {
  const list = sortTasks(tasks.filter(t => state.showDone || t.status !== 'done'));
  return `<div class="section-title">${esc(title)} · ${list.length}</div>` +
    (list.length ? list.map(t => taskRow(t, { showTrack: false, showDate: true })).join('') : '<div class="empty">Пока пусто</div>');
}

function renderTrack() {
  const tr = track(state.trackId);
  const tasks = data.tasks.filter(t => t.track_id === tr.id);
  let body = '';
  if (tr.id === 'clients') {
    body = data.clients.map(c => {
      const n = tasks.filter(t => t.client_id === c.id && t.status !== 'done').length;
      return `<button class="listbtn" data-act="client" data-id="${c.id}">${esc(c.name)} <span>${n} открытых ›</span></button>`;
    }).join('') + `<div class="row"><input id="newClient" placeholder="Новый клиент"><button class="ghost" data-act="addclient">Добавить</button></div>`;
    const noClient = tasks.filter(t => !t.client_id);
    if (noClient.length) body += groupBlock('Без клиента', noClient);
  } else {
    const subs = data.subs.filter(s => s.track_id === tr.id);
    body = subs.map(s => groupBlock(s.title, tasks.filter(t => t.subcategory_id === s.id))).join('');
    const rest = tasks.filter(t => !t.subcategory_id);
    if (!subs.length) body += groupBlock('Задачи', rest);
    else if (rest.length) body += groupBlock('Без подкатегории', rest);
  }
  $app.innerHTML = `
    <div class="topbar"><button class="back" data-act="back">‹</button><h1>${tr.icon} ${esc(tr.title)}</h1></div>
    ${tr.id !== 'clients' ? `<label class="toggle"><input type="checkbox" data-act="showdone" ${state.showDone ? 'checked' : ''} style="width:auto"> Показать выполненные</label>` : ''}
    ${body}`;
}

function renderClient() {
  const c = client(state.clientId);
  const tasks = data.tasks.filter(t => t.client_id === c.id);
  $app.innerHTML = `
    <div class="topbar"><button class="back" data-act="back">‹</button><h1>${esc(c.name)}</h1></div>
    <label class="toggle"><input type="checkbox" data-act="showdone" ${state.showDone ? 'checked' : ''} style="width:auto"> Показать выполненные</label>
    ${groupBlock('Задачи клиента', tasks)}`;
}

/* ---------- шторка: добавить / редактировать ---------- */
function openAdd() {
  const draft = { title: '', track_id: state.trackId || 'social', subcategory_id: null, client_id: state.clientId || null,
    due_date: state.screen === 'week' ? state.date : '', due_time: '', priority: 'normal', note: '', status: 'new' };
  state.sheet = { mode: 'add', draft }; renderSheet();
  setTimeout(() => document.getElementById('f_title')?.focus(), 50);
}
function openEdit(id) {
  const t = data.tasks.find(x => x.id === id);
  state.sheet = { mode: 'edit', taskId: id, draft: { ...t, due_date: t.due_date || '', due_time: t.due_time || '' } }; renderSheet();
}
function closeSheet() { state.sheet = null; $sheet.innerHTML = ''; }

async function renderSheet() {
  const d = state.sheet.draft;
  const isClients = d.track_id === 'clients';
  const subs = data.subs.filter(s => s.track_id === d.track_id);
  const optionsSub = isClients
    ? `<option value="">Без клиента</option>` + data.clients.map(c => `<option value="${c.id}" ${d.client_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')
    : `<option value="">Без подкатегории</option>` + subs.map(s => `<option value="${s.id}" ${d.subcategory_id === s.id ? 'selected' : ''}>${esc(s.title)}</option>`).join('');
  const t0 = today();
  const quick = [['Сегодня', t0], ['Завтра', addDays(t0, 1)], ['Через неделю', addDays(t0, 7)], ['Без даты', '']];
  let history = '';
  if (state.sheet.mode === 'edit') {
    const ev = await Store.listEvents(d.id);
    const label = { created: 'создана', status_changed: 'статус', date_moved: 'дата', time_moved: 'время', track_moved: 'трек', edited: 'правка' };
    history = '<div class="history"><b>История</b><br>' + ev.slice(-6).map(e => {
      const at = new Date(e.at); const val = e.to_value ? (STATUS[e.to_value] || (track(e.to_value)?.title) || e.to_value) : '';
      return `${at.toLocaleDateString('ru-RU')} ${at.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} · ${label[e.type] || e.type}${val ? ': ' + esc(val) : ''}`;
    }).join('<br>') + '</div>';
  }
  $sheet.innerHTML = `<div class="sheet-bg" data-act="closesheet"><div class="sheet">
    <h2>${state.sheet.mode === 'add' ? 'Новая задача' : 'Задача'} <button data-act="closesheet">✕</button></h2>
    <label>Что сделать</label>
    <input id="f_title" value="${esc(d.title)}" placeholder="Например: сценарий рилса" enterkeyhint="done">
    <label>Трек</label>
    <div class="seg">${data.tracks.map(tr => `<button data-act="f_track" data-id="${tr.id}" class="${d.track_id === tr.id ? 'on' : ''}">${tr.icon} ${esc(tr.title)}</button>`).join('')}</div>
    ${isClients || subs.length ? `<label>${isClients ? 'Клиент' : 'Подкатегория'}</label>
    <select id="f_sub">${optionsSub}</select>` : ''}
    <label>День</label>
    <div class="seg" style="margin-bottom:8px">${quick.map(([n, v]) => `<button data-act="f_date" data-v="${v}" class="${d.due_date === v ? 'on' : ''}">${n}</button>`).join('')}</div>
    <input type="date" id="f_date" value="${d.due_date || ''}">
    <label>Время (необязательно)</label>
    <div class="row" style="margin:0"><input type="time" id="f_time" value="${d.due_time || ''}">
      <button class="ghost" data-act="f_notime">Без времени</button></div>
    ${state.sheet.mode === 'edit' ? `<label>Статус</label>
    <div class="seg">${Object.entries(STATUS).map(([k, v]) => `<button data-act="f_status" data-v="${k}" class="${d.status === k ? 'on' : ''}">${v}</button>`).join('')}</div>` : ''}
    <label>Приоритет</label>
    <div class="seg">${Object.entries(PRIORITY).map(([k, v]) => `<button data-act="f_prio" data-v="${k}" class="${d.priority === k ? 'on' : ''}">${v}</button>`).join('')}</div>
    <label>Заметка</label>
    <textarea id="f_note" placeholder="Детали, ссылки">${esc(d.note)}</textarea>
    <button class="primary" data-act="save">${state.sheet.mode === 'add' ? 'Добавить' : 'Сохранить'}</button>
    ${state.sheet.mode === 'edit' ? '<button class="danger" data-act="delete">Удалить задачу</button>' : ''}
    ${history}
  </div></div>`;
}
/* перед перерисовкой формы сохраняем то, что уже напечатано */
function syncDraft() {
  const d = state.sheet.draft;
  const v = id => document.getElementById(id)?.value ?? '';
  d.title = v('f_title'); d.note = v('f_note'); d.due_date = v('f_date'); d.due_time = v('f_time');
  const s = v('f_sub') || null;
  if (d.track_id === 'clients') { d.client_id = s; d.subcategory_id = null; } else { d.subcategory_id = s; d.client_id = null; }
}

async function saveSheet() {
  syncDraft();
  const d = state.sheet.draft;
  if (!d.title.trim()) { toast('Напишите, что сделать'); return; }
  const fields = { title: d.title.trim(), track_id: d.track_id, subcategory_id: d.subcategory_id, client_id: d.client_id,
    due_date: d.due_date || null, due_time: d.due_time || null, priority: d.priority, note: d.note };
  if (state.sheet.mode === 'add') {
    await Store.addTask({ ...fields, source: 'manual', raw_input: null });
    toast('Задача добавлена');
  } else {
    const old = data.tasks.find(x => x.id === d.id);
    if (old.track_id !== fields.track_id) await Store.updateTask(d.id, { track_id: fields.track_id }, 'track_moved');
    if (old.due_date !== fields.due_date) {
      await Store.updateTask(d.id, { due_date: fields.due_date }, 'date_moved');
      // перенос на более поздний день незавершённой задачи = «Перенесена»
      if (old.due_date && fields.due_date && fields.due_date > old.due_date && d.status === old.status && old.status !== 'done') d.status = 'postponed';
    }
    if ((old.due_time || null) !== fields.due_time) await Store.updateTask(d.id, { due_time: fields.due_time }, 'time_moved');
    if (old.status !== d.status) await setStatus(d.id, d.status);
    await Store.updateTask(d.id, fields, 'edited');
    toast('Сохранено');
  }
  closeSheet(); await refresh();
}

async function setStatus(id, status) {
  const patch = { status };
  if (status === 'done') { patch.completed_at = new Date().toISOString(); patch.progress = 100; }
  else { patch.completed_at = null; if (status !== 'done') patch.progress = 0; }
  await Store.updateTask(id, patch, 'status_changed');
}

/* ---------- вход и регистрация ---------- */
function renderAuth() {
  const m = state.authMode;
  const title = { in: 'Вход', up: 'Регистрация', reset: 'Восстановить пароль', newpass: 'Новый пароль' }[m];
  const btn = { in: 'Войти', up: 'Создать аккаунт', reset: 'Отправить ссылку', newpass: 'Сохранить пароль' }[m];
  $app.innerHTML = `
    <div class="auth">
      <div class="brand big">ECOM<b>LENA</b><i>.</i></div>
      <p class="sub">Задачи и планы на неделю</p>
      <h1>${title}</h1>
      <form id="authForm" onsubmit="return false">
        ${m !== 'newpass' ? `<label>Почта</label><input id="a_email" type="email" autocomplete="username" inputmode="email" required>` : ''}
        ${m !== 'reset' ? `<label>Пароль</label><input id="a_pass" type="password" minlength="8" autocomplete="${m === 'in' ? 'current-password' : 'new-password'}" required>
          ${m !== 'in' ? '<div class="hint">Не короче 8 символов</div>' : ''}` : ''}
        <button class="primary" data-act="auth_submit">${btn}</button>
      </form>
      ${state.authErr ? `<div class="msg err">${esc(state.authErr)}</div>` : ''}
      ${state.authMsg ? `<div class="msg">${esc(state.authMsg)}</div>` : ''}
      <div class="links">
        ${m !== 'in' ? '<button data-act="auth_mode" data-m="in">У меня есть аккаунт</button>' : ''}
        ${m === 'in' ? '<button data-act="auth_mode" data-m="up">Создать аккаунт</button><button data-act="auth_mode" data-m="reset">Забыли пароль?</button>' : ''}
      </div>
    </div>`;
}
const AUTH_ERRORS = [
  [/invalid login credentials/i, 'Неверная почта или пароль'],
  [/email not confirmed/i, 'Почта ещё не подтверждена. Откройте письмо от Supabase и нажмите ссылку'],
  [/already registered|already been registered/i, 'Такой аккаунт уже есть. Попробуйте войти'],
  [/signups? not allowed|signup.*disabled/i, 'Регистрация закрыта'],
  [/password should be at least|weak/i, 'Пароль слишком короткий или простой'],
  [/rate limit|too many/i, 'Слишком много попыток. Подождите немного и попробуйте снова'],
];
const authError = e => (AUTH_ERRORS.find(([re]) => re.test(e?.message || '')) || [0, 'Не получилось: ' + (e?.message || 'нет связи')])[1];

async function authSubmit() {
  const email = document.getElementById('a_email')?.value.trim();
  const pass = document.getElementById('a_pass')?.value;
  state.authErr = state.authMsg = '';
  const m = state.authMode;
  if (m !== 'newpass' && !email) { state.authErr = 'Введите почту'; return render(); }
  if (m !== 'reset' && (!pass || pass.length < 8) && m !== 'in') { state.authErr = 'Пароль не короче 8 символов'; return render(); }
  let res;
  if (m === 'in') res = await Auth.signIn(email, pass);
  if (m === 'up') res = await Auth.signUp(email, pass);
  if (m === 'reset') res = await Auth.resetPassword(email);
  if (m === 'newpass') res = await Auth.updatePassword(pass);
  if (res.error) { state.authErr = authError(res.error); return render(); }
  if (m === 'up' && !res.data.session) { state.authMode = 'in'; state.authMsg = `Мы отправили письмо на ${email}. Откройте его, нажмите ссылку подтверждения и потом войдите здесь.`; return render(); }
  if (m === 'reset') { state.authMsg = 'Если такой аккаунт есть, письмо со ссылкой уже в пути.'; return render(); }
  const session = await Auth.session();
  if (session) await enterApp(session);
}
function showAuth(mode = 'in') {
  state.screen = 'auth'; state.authMode = mode; state.user = null; state.importCount = 0;
  Store = LocalStorageAdapter; closeSheet(); render();
}
async function enterApp(session) {
  state.user = session.user; Store = SupabaseAdapter;
  state.screen = state.tab = 'week'; state.authErr = state.authMsg = '';
  const done = localStorage.getItem('ecomlena_import_done_' + session.user.id);
  state.importCount = done ? 0 : readLocalForImport().tasks.length;
  await refresh();
}

/* ---------- навигация и события ---------- */
function renderTabbar() {
  $tabbar.innerHTML = `
    <button data-act="tab" data-tab="week" class="${state.tab === 'week' ? 'on' : ''}"><span class="ti">📅</span>Неделя</button>
    <button data-act="add" class="plus" aria-label="Добавить задачу">+</button>
    <button data-act="tab" data-tab="tracks" class="${state.tab === 'tracks' ? 'on' : ''}"><span class="ti">🗂</span>Треки</button>`;
}
function render() {
  document.body.classList.toggle('noauth', state.screen === 'auth');
  if (state.screen === 'auth') { renderAuth(); $tabbar.innerHTML = ''; return; }
  ({ week: renderWeek, tracks: renderTracks, track: renderTrack, client: renderClient })[state.screen]();
  renderTabbar();
}
async function refresh() { await reload(); render(); }

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  try { await handle(e, el); }
  catch (err) { console.error(err); toast('Не получилось. Проверьте интернет и попробуйте ещё раз'); }
});

async function handle(e, el) {
  const act = el.dataset.act, id = el.dataset.id;
  switch (act) {
    case 'auth_submit': el.disabled = true; try { await authSubmit(); } finally { el.disabled = false; } break;
    case 'auth_mode': state.authMode = el.dataset.m; state.authErr = state.authMsg = ''; render(); break;
    case 'signout': if (confirm('Выйти из аккаунта?')) { await Auth.signOut(); showAuth(); } break;
    case 'import': {
      el.disabled = true;
      const n = await importLocalTasks(readLocalForImport());
      localStorage.setItem('ecomlena_import_done_' + state.user.id, new Date().toISOString());
      state.importCount = 0; toast('Перенесено задач: ' + n); await refresh(); break;
    }
    case 'import_skip': localStorage.setItem('ecomlena_import_done_' + state.user.id, 'skipped'); state.importCount = 0; render(); break;
    case 'tab': state.tab = state.screen = el.dataset.tab; state.trackId = state.clientId = null; render(); window.scrollTo(0, 0); break;
    case 'day': state.date = el.dataset.date; render(); break;
    case 'week': state.date = addDays(state.date, 7 * Number(el.dataset.dir)); render(); break;
    case 'gotoday': state.date = today(); render(); break;
    case 'track': state.trackId = id; state.screen = 'track'; state.showDone = false; render(); window.scrollTo(0, 0); break;
    case 'client': state.clientId = id; state.screen = 'client'; state.showDone = false; render(); window.scrollTo(0, 0); break;
    case 'back':
      if (state.screen === 'client') { state.clientId = null; state.screen = 'track'; }
      else { state.trackId = null; state.screen = 'tracks'; }
      render(); break;
    case 'showdone': state.showDone = el.checked; render(); break;
    case 'addclient': {
      const name = document.getElementById('newClient').value.trim();
      if (name) { await Store.addClient(name); toast('Клиент добавлен'); await refresh(); }
      break;
    }
    case 'toggle': {
      e.stopPropagation();
      const t = data.tasks.find(x => x.id === id);
      await setStatus(id, t.status === 'done' ? 'in_progress' : 'done');
      await refresh(); break;
    }
    case 'today': e.stopPropagation(); await Store.updateTask(id, { due_date: today() }, 'date_moved'); await setStatus(id, 'postponed'); toast('Перенесено на сегодня'); await refresh(); break;
    case 'open': openEdit(id); break;
    case 'add': openAdd(); break;
    case 'closesheet': if (e.target === el || el.tagName === 'BUTTON') closeSheet(); break;
    case 'f_track': syncDraft(); state.sheet.draft.track_id = id; state.sheet.draft.subcategory_id = null; state.sheet.draft.client_id = null; renderSheet(); break;
    case 'f_notime': syncDraft(); state.sheet.draft.due_time = ''; renderSheet(); break;
    case 'f_date': syncDraft(); state.sheet.draft.due_date = el.dataset.v; renderSheet(); break;
    case 'f_status': syncDraft(); state.sheet.draft.status = el.dataset.v; renderSheet(); break;
    case 'f_prio': syncDraft(); state.sheet.draft.priority = el.dataset.v; renderSheet(); break;
    case 'save': await saveSheet(); break;
    case 'delete': if (confirm('Удалить задачу?')) { await Store.deleteTask(state.sheet.taskId); closeSheet(); toast('Удалено'); await refresh(); } break;
    case 'reset': if (confirm('Вернуть демо-данные? Ваши записи в прототипе удалятся.')) { await Store.reset(); state.date = today(); toast('Демо-данные восстановлены'); await refresh(); } break;
  }
}

/* PWA: service worker только когда страница открыта по http(s) */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW не зарегистрирован', err));
}

async function boot() {
  if (!Auth.enabled) { await refresh(); return; }   // одиночный файл: локальный прототип
  Auth.onChange((event) => {
    if (event === 'PASSWORD_RECOVERY') { state.screen = 'auth'; state.authMode = 'newpass'; render(); }
    if (event === 'SIGNED_OUT' && state.screen !== 'auth') showAuth();
  });
  const session = await Auth.session();
  if (RECOVERY_LINK && session) { state.screen = 'auth'; state.authMode = 'newpass'; render(); return; }
  if (session) await enterApp(session); else showAuth();
}
boot().catch(err => { console.error(err); toast('Нет связи с сервером'); });
