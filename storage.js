/* Хранилище. Интерфейс один, реализации можно менять.
 * Сейчас: LocalStorageAdapter (данные в браузере телефона).
 * Позже: SupabaseAdapter с теми же методами (заготовка внизу).
 */
const DB_KEY = 'ecomlena_tasks_v2';
const OLD_KEYS = ['ecomlena_tasks_v1'];

/* id треков стабильные: при переименовании меняется только title,
   поэтому задачи из старой версии сами попадают в переименованные треки */
const TRACKS = [
  { id: 'social',   title: 'Соцсети',            icon: '📱', color: '#8B5CF6', sort: 1 },
  { id: 'clients',  title: 'Клиенты',            icon: '🤝', color: '#F43F5E', sort: 2 },
  { id: 'course',   title: 'Мой курс',           icon: '🎓', color: '#D946EF', sort: 3 },
  { id: 'agents',   title: 'Разработка агентов', icon: '🤖', color: '#38BDF8', sort: 4 },
  { id: 'personal', title: 'Время на себя',      icon: '🌱', color: '#22C3A6', sort: 5 },
  { id: 'home',     title: 'Домашние дела',      icon: '🏡', color: '#F5A524', sort: 6 },
];

/* У «Клиентов» и «Домашних дел» подкатегорий нет */
const SUBCATEGORIES = [
  { id: 'scripts',   track_id: 'social',   title: 'Сценарии',              sort: 1 },
  { id: 'longshoot', track_id: 'social',   title: 'Съёмка длинных видео',  sort: 2 },
  { id: 'montage',   track_id: 'social',   title: 'Монтаж коротких видео', sort: 3 },
  { id: 'posts',     track_id: 'social',   title: 'Написание постов',      sort: 4 },
  { id: 'publish',   track_id: 'social',   title: 'Выкладка в соцсети',    sort: 5 },
  { id: 'lessons',   track_id: 'course',   title: 'Уроки и материалы',     sort: 1 },
  { id: 'launch',    track_id: 'course',   title: 'Запуск и продажи',      sort: 2 },
  { id: 'students',  track_id: 'course',   title: 'Работа с учениками',    sort: 3 },
  { id: 'ideas',     track_id: 'agents',   title: 'Идеи и ТЗ',             sort: 1 },
  { id: 'build',     track_id: 'agents',   title: 'Разработка',            sort: 2 },
  { id: 'testing',   track_id: 'agents',   title: 'Тестирование',          sort: 3 },
  { id: 'expo',      track_id: 'personal', title: 'Экспо и мероприятия',   sort: 1 },
  { id: 'rest',      track_id: 'personal', title: 'Отдых',                 sort: 2 },
];

function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));
}
function nowIso() { return new Date().toISOString(); }
function ymd(d) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return ymd(new Date(y, m - 1, d + n));
}

function makeTask(title, track_id, extra = {}) {
  return {
    id: uid(), title, track_id,
    subcategory_id: null, client_id: null,
    note: '', due_date: null, due_time: null, priority: 'normal', status: 'new',
    progress: 0, source: 'manual', raw_input: null, ai_confidence: null,
    recurrence_rule: null, parent_task_id: null,
    created_at: nowIso(), updated_at: nowIso(), completed_at: null,
    ...extra,
  };
}
const createdEvent = x => ({ id: uid(), task_id: x.id, type: 'created', from_value: null, to_value: x.status, source: 'manual', at: x.created_at });

/* Примеры для новых треков (добавляются и в свежие демо-данные, и при переходе со старой версии) */
function newTrackExamples(t) {
  return [
    makeTask('Пример: записать урок для модуля 1', 'course', { subcategory_id: 'lessons', due_date: addDays(t, 1), due_time: '11:00' }),
    makeTask('Пример: ответить ученикам в чате', 'course', { subcategory_id: 'students', due_date: t, due_time: '18:00' }),
    makeTask('Пример: описать ТЗ для агента-аналитика', 'agents', { subcategory_id: 'ideas', due_date: t, due_time: '15:00' }),
    makeTask('Пример: протестировать промпт поставки', 'agents', { subcategory_id: 'testing', due_date: addDays(t, 2) }),
  ];
}

/* Демо-данные: заведомо примерные задачи */
function seedData() {
  const t = ymd(new Date());
  const clientA = { id: uid(), name: 'Клиент А', status: 'active', created_at: nowIso() };
  const clientB = { id: uid(), name: 'Клиент Б', status: 'active', created_at: nowIso() };
  const mk = makeTask;
  const tasks = [
    mk('Пример: сценарий рилса про карточку товара', 'social', { subcategory_id: 'scripts', due_date: t, due_time: '10:00', priority: 'high' }),
    mk('Пример: снять длинное видео для YouTube', 'social', { subcategory_id: 'longshoot', due_date: addDays(t, 2), due_time: '12:00' }),
    mk('Пример: смонтировать 3 коротких ролика', 'social', { subcategory_id: 'montage', due_date: addDays(t, 1) }),
    mk('Пример: пост в Telegram', 'social', { subcategory_id: 'posts', due_date: t }),
    mk('Пример: выложить рилс', 'social', { subcategory_id: 'publish', due_date: addDays(t, 3), due_time: '19:00' }),
    mk('Пример: созвон по аудиту карточек', 'clients', { client_id: clientA.id, due_date: t, due_time: '12:30', priority: 'high' }),
    mk('Пример: отчёт по рекламе', 'clients', { client_id: clientA.id, due_date: addDays(t, 2) }),
    mk('Пример: подготовить план поставки', 'clients', { client_id: clientB.id, due_date: addDays(t, -1) }),
    mk('Пример: собрать вопросы к стратегии', 'clients', { client_id: clientB.id }),
    ...newTrackExamples(t),
    mk('Пример: регистрация на выставку', 'personal', { subcategory_id: 'expo', due_date: addDays(t, 4) }),
    mk('Пример: прогулка без телефона', 'personal', { subcategory_id: 'rest', due_date: t, due_time: '20:00' }),
    mk('Пример: купить продукты', 'home', { due_date: t, status: 'done', completed_at: nowIso(), progress: 100 }),
    mk('Пример: записать ребёнка к врачу', 'home', { due_date: addDays(t, 1), due_time: '09:00' }),
  ];
  return { version: 2, clients: [clientA, clientB], tasks, events: tasks.map(createdEvent) };
}

/* Переход с версии 1: треки остаются по id (названия уже новые),
   подкатегории «Дом»/«Ребёнок» и «Время для себя» сводятся к новой схеме,
   добавляется поле due_time и примеры для новых треков. */
function migrateV1(db) {
  const subMap = { house: null, child: null, selftime: 'rest' };
  db.tasks.forEach(x => {
    if (x.subcategory_id in subMap) x.subcategory_id = subMap[x.subcategory_id];
    if (x.track_id === 'clients') x.subcategory_id = null;
    if (!('due_time' in x)) x.due_time = null;
  });
  const ex = newTrackExamples(ymd(new Date()));
  db.tasks.push(...ex);
  db.events.push(...ex.map(createdEvent));
  db.version = 2;
  return db;
}

/* ===== Адаптер: localStorage ===== */
const LocalStorageAdapter = {
  _load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) return JSON.parse(raw);
      const old = localStorage.getItem(OLD_KEYS[0]);
      if (old) {
        const db = migrateV1(JSON.parse(old));
        this._save(db);
        OLD_KEYS.forEach(k => localStorage.removeItem(k));
        return db;
      }
    } catch (e) { console.warn('storage read failed', e); }
    const s = seedData();
    this._save(s);
    return s;
  },
  _save(db) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
    catch (e) { console.warn('storage write failed', e); }
  },
  async getTracks() { return TRACKS; },
  async getSubcategories() { return SUBCATEGORIES; },
  async listClients() { return this._load().clients; },
  async addClient(name) {
    const db = this._load();
    const c = { id: uid(), name, status: 'active', created_at: nowIso() };
    db.clients.push(c); this._save(db); return c;
  },
  async listTasks() { return this._load().tasks; },
  async addTask(data) {
    const db = this._load();
    const task = {
      id: uid(), subcategory_id: null, client_id: null, note: '', due_date: null, due_time: null,
      priority: 'normal', status: 'new', progress: 0, source: 'manual',
      raw_input: null, ai_confidence: null, recurrence_rule: null, parent_task_id: null,
      created_at: nowIso(), updated_at: nowIso(), completed_at: null, ...data,
    };
    db.tasks.push(task);
    db.events.push({ id: uid(), task_id: task.id, type: 'created', from_value: null, to_value: task.status, source: task.source, at: task.created_at });
    this._save(db); return task;
  },
  /* patch: изменённые поля; eventType: status_changed | date_moved | time_moved | track_moved | edited */
  async updateTask(id, patch, eventType = 'edited') {
    const db = this._load();
    const task = db.tasks.find(x => x.id === id);
    if (!task) return null;
    const field = { status_changed: 'status', date_moved: 'due_date', time_moved: 'due_time', track_moved: 'track_id' }[eventType];
    const from = field ? task[field] : null;
    Object.assign(task, patch, { updated_at: nowIso() });
    db.events.push({ id: uid(), task_id: id, type: eventType, from_value: from, to_value: field ? task[field] : null, source: 'manual', at: task.updated_at });
    this._save(db); return task;
  },
  async deleteTask(id) {
    const db = this._load();
    db.tasks = db.tasks.filter(x => x.id !== id);
    db.events.push({ id: uid(), task_id: id, type: 'deleted', from_value: null, to_value: null, source: 'manual', at: nowIso() });
    this._save(db);
  },
  async listEvents(taskId) { return this._load().events.filter(e => !taskId || e.task_id === taskId); },
  async reset() { localStorage.removeItem(DB_KEY); OLD_KEYS.forEach(k => localStorage.removeItem(k)); return this._load(); },
};

/* ===== Чтение локальных задач для переноса в облако (без демо-данных) ===== */
function readLocalForImport() {
  let db = null;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) db = JSON.parse(raw);
    else {
      const old = localStorage.getItem(OLD_KEYS[0]);
      if (old) {
        db = JSON.parse(old);
        // та же схема переноса v1 -> v2, но без добавления примеров
        const subMap = { house: null, child: null, selftime: 'rest' };
        db.tasks.forEach(x => {
          if (x.subcategory_id in subMap) x.subcategory_id = subMap[x.subcategory_id];
          if (x.track_id === 'clients') x.subcategory_id = null;
        });
      }
    }
  } catch (e) { return { clients: [], tasks: [] }; }
  if (!db) return { clients: [], tasks: [] };
  const tasks = (db.tasks || []).filter(t => !/^Пример:/.test(t.title || ''));
  return { clients: db.clients || [], tasks };
}

/* ===== Адаптер: Supabase ===== */
/* ссылка из письма «сбросить пароль»: запоминаем до того, как клиент очистит адрес */
const RECOVERY_LINK = /type=recovery/.test(location.hash);
const cfg = window.APP_CONFIG || {};
const sb = (cfg.SUPABASE_URL && window.supabase)
  ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

function check({ data, error }) { if (error) { console.error(error); throw new Error(error.message); } return data; }
const hhmm = t => (t ? String(t).slice(0, 5) : null);
const normTask = t => ({ ...t, due_time: hhmm(t.due_time) });
const TASK_FIELDS = ['title', 'note', 'track_id', 'subcategory_id', 'client_id', 'due_date', 'due_time', 'priority', 'status',
  'progress', 'parent_task_id', 'recurrence_rule', 'source', 'raw_input', 'ai_confidence', 'completed_at', 'created_at', 'updated_at'];
const pick = (o, keys) => Object.fromEntries(keys.filter(k => k in o).map(k => [k, o[k]]));

const SupabaseAdapter = {
  async getTracks() {
    let rows = check(await sb.from('tracks').select('*').order('sort'));
    if (!rows.length) { // подстраховка: если триггер не создал треки
      check(await sb.from('tracks').upsert(TRACKS.map(t => pick(t, ['id', 'title', 'icon', 'color', 'sort'])), { onConflict: 'user_id,id', ignoreDuplicates: true }));
      check(await sb.from('subcategories').upsert(SUBCATEGORIES, { onConflict: 'user_id,id', ignoreDuplicates: true }));
      rows = check(await sb.from('tracks').select('*').order('sort'));
    }
    return rows;
  },
  async getSubcategories() { return check(await sb.from('subcategories').select('*').order('sort')); },
  async listClients() { return check(await sb.from('clients').select('*').order('created_at')); },
  async addClient(name) { return check(await sb.from('clients').insert({ name }).select().single()); },
  async listTasks() { return check(await sb.from('tasks').select('*').order('created_at')).map(normTask); },
  async _event(task_id, type, from_value = null, to_value = null, source = 'manual') {
    check(await sb.from('task_events').insert({ task_id, type, from_value, to_value, source }));
  },
  async addTask(data) {
    const row = pick({ source: 'manual', ...data }, TASK_FIELDS);
    const task = normTask(check(await sb.from('tasks').insert(row).select().single()));
    await this._event(task.id, data.source === 'import' ? 'imported' : 'created', null, task.status, task.source);
    return task;
  },
  async updateTask(id, patch, eventType = 'edited') {
    const field = { status_changed: 'status', date_moved: 'due_date', time_moved: 'due_time', track_moved: 'track_id' }[eventType];
    let from = null;
    if (field) from = check(await sb.from('tasks').select(field).eq('id', id).single())[field];
    const task = normTask(check(await sb.from('tasks').update({ ...pick(patch, TASK_FIELDS), updated_at: new Date().toISOString() }).eq('id', id).select().single()));
    await this._event(id, eventType, field ? hhmmIf(field, from) : null, field ? task[field] : null);
    return task;
  },
  async deleteTask(id) {
    check(await sb.from('tasks').delete().eq('id', id));
    await this._event(id, 'deleted');
  },
  async listEvents(taskId) {
    let q = sb.from('task_events').select('*').order('at');
    if (taskId) q = q.eq('task_id', taskId);
    return check(await q);
  },
  async reset() { /* в рабочей версии сброса нет */ },
};
function hhmmIf(field, v) { return field === 'due_time' ? hhmm(v) : v; }

/* Перенос локальных задач (с этого телефона) в облако */
async function importLocalTasks(local) {
  const clients = check(await sb.from('clients').select('*'));
  const subs = check(await sb.from('subcategories').select('id'));
  const tracks = check(await sb.from('tracks').select('id'));
  const trackIds = new Set(tracks.map(t => t.id)), subIds = new Set(subs.map(s => s.id));
  const clientMap = {};
  for (const c of local.clients) {
    if (!local.tasks.some(t => t.client_id === c.id)) continue;
    let found = clients.find(x => x.name === c.name);
    if (!found) found = check(await sb.from('clients').insert({ name: c.name }).select().single());
    clientMap[c.id] = found.id;
  }
  let n = 0;
  for (const t of local.tasks) {
    const track_id = trackIds.has(t.track_id) ? t.track_id : 'home';
    await SupabaseAdapter.addTask({
      ...pick(t, ['title', 'note', 'due_date', 'due_time', 'priority', 'status', 'progress', 'created_at', 'completed_at']),
      track_id,
      subcategory_id: t.subcategory_id && subIds.has(t.subcategory_id) && track_id !== 'clients' ? t.subcategory_id : null,
      client_id: track_id === 'clients' ? (clientMap[t.client_id] || null) : null,
      source: 'import',
    });
    n++;
  }
  return n;
}

/* Вход и регистрация */
const Auth = {
  enabled: !!sb,
  async session() { return sb ? (await sb.auth.getSession()).data.session : null; },
  signIn(email, password) { return sb.auth.signInWithPassword({ email, password }); },
  signUp(email, password) { return sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } }); },
  resetPassword(email) { return sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }); },
  updatePassword(password) { return sb.auth.updateUser({ password }); },
  signOut() { return sb.auth.signOut(); },
  onChange(cb) { if (sb) sb.auth.onAuthStateChange(cb); },
};

/* Без настроек Supabase (одиночный файл-прототип) работаем локально с демо-данными */
let Store = LocalStorageAdapter;
