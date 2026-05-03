// ------------------------------------------------------------
// Constantes, funções puras e algoritmo SM-2
// ------------------------------------------------------------
const BOOT_KEY = 'fct_boot_v1';
const POMO_DEF = { focusDuration: 25, shortBreak: 5, longBreak: 15, longBreakInterval: 4, flashcardMode: 'due' };
const DEF = {
  subjects: ['Filosofia', 'Matematica'],
  cards: [
    { id: 'c1', subject: 'Filosofia', front: 'O que e o imperativo categorico?', back: 'Principio moral de Kant: age apenas segundo maximas que possas querer que se tornem lei universal.', correct: 0, wrong: 0, interval: 0, reps: 0, ease: 2.5, due: null },
    { id: 'c2', subject: 'Filosofia', front: 'O que e a alegoria da caverna?', back: 'Metafora de Platao: prisioneiros veem sombras; o filosofo sai e ve as Formas (realidade).', correct: 0, wrong: 0, interval: 0, reps: 0, ease: 2.5, due: null },
    { id: 'c3', subject: 'Matematica', front: 'Derivada de x^2', back: '2x', correct: 0, wrong: 0, interval: 0, reps: 0, ease: 2.5, due: null },
  ],
  streak: { count: 0, lastDate: null },
  history: [], pomodoroHistory: [], pomodoroSettings: { ...POMO_DEF },
};

function normalizeData(p) {
  return {
    ...DEF, ...p,
    cards: (p.cards || []).map(c => ({
      interval: 0, reps: 0, ease: 2.5, due: null, dueAt: null, state: 'new',
      stepIndex: 0, lapses: 0, correct: 0, wrong: 0, hard: 0, easy: 0,
      frontImage: null, backImage: null, updatedAt: null, ...c
    })),
    deletedCardIds: p.deletedCardIds || [],
    history: p.history || [],
    pomodoroHistory: p.pomodoroHistory || [],
    pomodoroSettings: { ...POMO_DEF, ...(p.pomodoroSettings || {}) },
  };
}

function stampData(d) { return { ...d, _savedAt: Date.now() }; }
function newerData(a, b) { return (a && a._savedAt || 0) > (b && b._savedAt || 0) ? a : b; }

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function uid() { return Math.random().toString(36).slice(2, 9); }

function localDateKey(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function today() { return localDateKey(); }
function nowISO() { return new Date().toISOString(); }
function addMinutes(n) { const d = new Date(); d.setMinutes(d.getMinutes() + n); return d.toISOString(); }
function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return localDateKey(d); }
function addDaysISO(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString(); }
function dateOffset(n) { const d = new Date(); d.setDate(d.getDate() + n); return d; }
function dueDateKey(c) { return c.dueAt ? localDateKey(new Date(c.dueAt)) : (c.due || ''); }
function isDue(c) { if (c.dueAt) return new Date(c.dueAt) <= new Date(); return !c.due || c.due <= today(); }
function dueLabel(c) {
  if (!c.dueAt && !c.due) return 'novo';
  const due = c.dueAt ? new Date(c.dueAt) : new Date(`${c.due}T00:00:00`);
  const mins = Math.round((due - new Date()) / 60000);
  if (mins <= 0) return 'vencido';
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return localDateKey(due);
}
function intervalLabel(days) {
  if (!days) return '--';
  if (days < 1) return `${Math.round(days * 24 * 60)}m`;
  return `${Math.round(days)}d`;
}
function weekKey(d = new Date()) {
  const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return localDateKey(x);
}
function formatHours(minutes) {
  if (!minutes) return '-';
  const h = minutes / 60;
  return h < 10 ? `${Math.round(h * 10) / 10}h` : `${Math.round(h)}h`;
}
function markToday(d) {
  const td = today();
  const streak = { ...d.streak };
  if (streak.lastDate === td) return d;
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  streak.count = streak.lastDate === localDateKey(yest) ? (streak.count || 0) + 1 : 1;
  streak.lastDate = td;
  return { ...d, streak };
}

// ------------------------------------------------------------
// Algoritmo SM-2 (Anki)
// ------------------------------------------------------------
const ANKI = { learningSteps: [1, 10], relearningSteps: [10], graduatingInterval: 1, easyInterval: 4, hardFactor: 1.2, easyBonus: 1.3, minEase: 1.3 };

function scheduleCard(card, grade) {
  const state = card.state || 'new';
  let ease = card.ease || 2.5, interval = card.interval || 0, reps = card.reps || 0,
    stepIndex = card.stepIndex || 0, lapses = card.lapses || 0, nextState = state, dueAt = null;

  const graduate = days => { nextState = 'review'; stepIndex = 0; interval = Math.max(1, Math.round(days)); reps++; dueAt = addDaysISO(interval); };
  const learn = (step, mins) => { nextState = state === 'relearning' ? 'relearning' : 'learning'; stepIndex = step; dueAt = addMinutes(mins); };

  if (state === 'review') {
    if (grade === 'again') { ease = Math.max(ANKI.minEase, ease - .2); lapses++; nextState = 'relearning'; stepIndex = 0; dueAt = addMinutes(ANKI.relearningSteps[0]); }
    if (grade === 'hard') { ease = Math.max(ANKI.minEase, ease - .15); graduate(Math.max(interval + 1, interval * ANKI.hardFactor)); }
    if (grade === 'good') graduate(Math.max(interval + 1, interval * ease));
    if (grade === 'easy') { ease += .15; graduate(Math.max(interval + 2, interval * ease * ANKI.easyBonus)); }
  } else if (state === 'learning' || state === 'new') {
    if (grade === 'again') learn(0, ANKI.learningSteps[0]);
    if (grade === 'hard') learn(stepIndex, 6);
    if (grade === 'good') {
      const next = stepIndex + 1;
      if (next < ANKI.learningSteps.length) learn(next, ANKI.learningSteps[next]);
      else graduate(ANKI.graduatingInterval);
    }
    if (grade === 'easy') { ease += .15; graduate(ANKI.easyInterval); }
  } else {
    if (grade === 'again') { lapses++; dueAt = addMinutes(ANKI.relearningSteps[0]); nextState = 'relearning'; stepIndex = 0; }
    if (grade === 'hard') dueAt = addMinutes(ANKI.relearningSteps[0]);
    if (grade === 'good') graduate(Math.max(1, interval * .5));
    if (grade === 'easy') { ease += .15; graduate(Math.max(ANKI.graduatingInterval, interval)); }
  }

  const reviewedAt = nowISO();
  return { state: nextState, stepIndex, interval, reps, ease, lapses, dueAt, due: localDateKey(new Date(dueAt)), lastReviewed: reviewedAt, updatedAt: reviewedAt };
}

function nextIntervals(card) {
  return {
    again: '1m',
    hard: (card.state === 'review') ? intervalLabel(Math.max((card.interval || 1) + 1, (card.interval || 1) * ANKI.hardFactor)) : '6m',
    good: (card.state === 'review') ? intervalLabel(Math.max((card.interval || 1) + 1, (card.interval || 1) * (card.ease || 2.5))) : ((card.stepIndex || 0) + 1 < ANKI.learningSteps.length ? `${ANKI.learningSteps[(card.stepIndex || 0) + 1]}m` : `${ANKI.graduatingInterval}d`),
    easy: (card.state === 'review') ? intervalLabel(Math.max((card.interval || 1) + 2, (card.interval || 1) * (card.ease || 2.5) * ANKI.easyBonus)) : `${ANKI.easyInterval}d`,
  };
}
