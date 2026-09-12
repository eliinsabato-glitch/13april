// db.js — local, on-device persistence. No data ever leaves the phone.
// Uses localStorage (simple, synchronous, survives offline / reinstalled-to-homescreen use).

const DB = (() => {
  const KEY = 'thirteenApril.v1';

  function defaultState() {
    return {
      settings: {
        onboardingComplete: false,
        targetDate: null,       // ISO date string, e.g. "2027-04-13"
        journeyStartDate: new Date().toISOString(),
      },
      calendarEvents: [],       // [{start, end, title}] imported from .ics
      habits: [],               // see habits.js for shape
      habitInstances: [],       // {id, habitId, date, status}
      pilates: {
        perCycle: 10,
        cycleSpanDays: 84,        // ~12 weeks per package, realistic pacing
        sessions: [],             // {id, cycleNumber, sessionNumber, date, status}
        justCompletedCycle: null, // cycle number to show a completion message for, then cleared
      },
      checkIns: [],              // {date, energy, mood, stress, movement, study, selfCare, minimumDay, note}
      dayRecords: {},            // date -> {load, score, level, examMode, recoveryMode}
      streak: { current: 0, best: 0, flexDays: 0, lastDate: null },
      skipTracking: {},           // habitId -> {weekday: {skips, completes}}
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      // shallow-merge with defaults so new fields added in updates don't break old saves
      return { ...defaultState(), ...parsed };
    } catch (e) {
      console.error('DB load failed', e);
      return defaultState();
    }
  }

  let state = load();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error('DB save failed', e);
    }
  }

  return {
    get: () => state,
    set: (updater) => {
      state = typeof updater === 'function' ? updater(state) : updater;
      save();
    },
    reset: () => { state = defaultState(); save(); },
  };
})();
