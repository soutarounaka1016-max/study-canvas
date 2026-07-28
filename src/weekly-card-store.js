export const WEEKLY_CARD_STORE_VERSION = 1;
export const WEEKLY_CARD_STORAGE_KEY = "study-canvas:weekly-cards:v1";
export const WEEKLY_CARD_SUBJECTS = ["数学", "英語", "物理", "化学", "その他"];

const MAX_WEEKS = 520;
const MAX_CARDS_PER_SUBJECT = 120;
const MAX_TITLE_LENGTH = 120;
const MAX_WARNING_LENGTH = 160;

export function emptyWeeklyCardStore() {
  return { version: WEEKLY_CARD_STORE_VERSION, weeks: {} };
}

export function loadWeeklyCardStore(raw) {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { store: emptyWeeklyCardStore(), recovered: false };
  }

  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== WEEKLY_CARD_STORE_VERSION || !isPlainObject(value.weeks)) {
      return { store: emptyWeeklyCardStore(), recovered: true };
    }

    const weeks = {};
    let recovered = false;
    let weekCount = 0;
    for (const [weekStart, week] of Object.entries(value.weeks)) {
      if (weekCount >= MAX_WEEKS || !isMonday(weekStart) || !isPlainObject(week?.subjects)) {
        recovered = true;
        continue;
      }
      const subjects = {};
      for (const subject of WEEKLY_CARD_SUBJECTS) {
        const cards = week.subjects[subject];
        if (cards === undefined) continue;
        if (!Array.isArray(cards)) {
          recovered = true;
          continue;
        }
        const ids = new Set();
        const normalized = [];
        for (const card of cards.slice(0, MAX_CARDS_PER_SUBJECT)) {
          const safe = normalizeStoredCard(card);
          if (!safe || ids.has(safe.id)) {
            recovered = true;
            continue;
          }
          ids.add(safe.id);
          normalized.push(safe);
        }
        if (cards.length > MAX_CARDS_PER_SUBJECT) recovered = true;
        if (normalized.length > 0) subjects[subject] = normalized;
      }
      if (Object.keys(subjects).length > 0) weeks[weekStart] = { subjects };
      weekCount += 1;
    }
    return { store: { version: WEEKLY_CARD_STORE_VERSION, weeks }, recovered };
  } catch {
    return { store: emptyWeeklyCardStore(), recovered: true };
  }
}

export function serializeWeeklyCardStore(store) {
  const loaded = loadWeeklyCardStore(JSON.stringify(store));
  if (loaded.recovered) throw new Error("週間カードデータの形式が正しくありません");
  return JSON.stringify(loaded.store);
}

export function getWeeklyCards(store, weekStart, subject) {
  assertWeekStart(weekStart);
  assertSubject(subject);
  return (store?.weeks?.[weekStart]?.subjects?.[subject] || []).map(cloneCard);
}

export function addWeeklyCards(store, weekStart, subject, cards) {
  assertWeekStart(weekStart);
  assertSubject(subject);
  if (!Array.isArray(cards) || cards.length === 0) throw new Error("カード候補を選んでください");

  const current = getWeeklyCards(store, weekStart, subject);
  if (current.length + cards.length > MAX_CARDS_PER_SUBJECT) {
    throw new Error("この科目の週間カードはこれ以上追加できません");
  }
  const ids = new Set(current.map((card) => card.id));
  const nextCards = cards.map((card) => {
    const safe = normalizeNewCard(card);
    if (ids.has(safe.id)) throw new Error("同じIDの週間カードがあります");
    ids.add(safe.id);
    return safe;
  });

  return setCards(store, weekStart, subject, [...current, ...nextCards]);
}

export function deleteWeeklyCard(store, weekStart, subject, cardId) {
  const current = getWeeklyCards(store, weekStart, subject);
  const safeId = validateId(cardId);
  const next = current.filter((card) => card.id !== safeId);
  if (next.length === current.length) throw new Error("削除する週間カードが見つかりません");
  return setCards(store, weekStart, subject, next);
}

export function updateWeeklyCard(store, weekStart, subject, cardId, title) {
  const current = getWeeklyCards(store, weekStart, subject);
  const safeId = validateId(cardId);
  const safeTitle = normalizeTitle(title);
  let found = false;
  const next = current.map((card) => {
    if (card.id !== safeId) return card;
    found = true;
    return { ...card, title: safeTitle };
  });
  if (!found) throw new Error("変更する週間カードが見つかりません");
  return setCards(store, weekStart, subject, next);
}

export function getWeeklyCardsForWeek(store, weekStart) {
  assertWeekStart(weekStart);
  return WEEKLY_CARD_SUBJECTS.flatMap((subject) =>
    getWeeklyCards(store, weekStart, subject).map((card) => ({ ...card, subject })),
  );
}

export function replaceStoredWeeklyCardStore(storage, key, nextStore) {
  const nextRaw = serializeWeeklyCardStore(nextStore);
  const previousRaw = storage.getItem(key);
  try {
    storage.setItem(key, nextRaw);
    if (storage.getItem(key) !== nextRaw) throw new Error("保存結果を確認できませんでした");
    return nextRaw;
  } catch (error) {
    try {
      if (previousRaw === null) storage.removeItem(key);
      else storage.setItem(key, previousRaw);
    } catch {
      // 元データの復元に失敗しても最初の保存エラーを優先する。
    }
    throw error;
  }
}

export function countWeeklyCards(store) {
  let count = 0;
  for (const week of Object.values(store?.weeks || {})) {
    for (const cards of Object.values(week?.subjects || {})) count += Array.isArray(cards) ? cards.length : 0;
  }
  return count;
}

function setCards(store, weekStart, subject, cards) {
  const weeks = { ...(store?.weeks || {}) };
  const currentWeek = weeks[weekStart] || { subjects: {} };
  const subjects = { ...(currentWeek.subjects || {}) };
  if (cards.length === 0) delete subjects[subject];
  else subjects[subject] = cards.map(cloneCard);
  if (Object.keys(subjects).length === 0) delete weeks[weekStart];
  else weeks[weekStart] = { subjects };
  return { version: WEEKLY_CARD_STORE_VERSION, weeks };
}

function normalizeNewCard(card) {
  if (!isPlainObject(card)) throw new Error("週間カードの形式が正しくありません");
  const id = validateId(card.id);
  const title = normalizeTitle(card.title);
  const confidence = normalizeConfidence(card.confidence);
  const warning = normalizeWarning(card.warning);
  const createdAt = normalizeCreatedAt(card.createdAt);
  const source = card.source === "manual" ? "manual" : "ai";
  return { id, title, confidence, warning, createdAt, source };
}

function normalizeStoredCard(card) {
  try {
    return normalizeNewCard(card);
  } catch {
    return null;
  }
}

function cloneCard(card) {
  return { ...card };
}

function normalizeTitle(value) {
  const title = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!title) throw new Error("カードの内容を入力してください");
  if (title.length > MAX_TITLE_LENGTH) throw new Error(`カードの内容は${MAX_TITLE_LENGTH}文字以内にしてください`);
  return title;
}

function normalizeConfidence(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
}

function normalizeWarning(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, MAX_WARNING_LENGTH) : "";
}

function normalizeCreatedAt(value) {
  const date = new Date(value);
  if (typeof value !== "string" || Number.isNaN(date.getTime())) throw new Error("カードの作成日時が正しくありません");
  return date.toISOString();
}

function validateId(value) {
  if (typeof value !== "string" || value.trim() === "" || value.length > 100) throw new Error("カードIDが正しくありません");
  return value;
}

function assertSubject(subject) {
  if (!WEEKLY_CARD_SUBJECTS.includes(subject)) throw new Error("科目が正しくありません");
}

function assertWeekStart(value) {
  if (!isMonday(value)) throw new Error("週の開始日が正しくありません");
}

function isMonday(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getUTCDay() === 1;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
