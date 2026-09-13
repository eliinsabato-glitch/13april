// habits.js — habit definitions, Pilates 10-session distribution,
// recurring self-care scheduling, and adaptive "this day doesn't work for you" logic.

const HabitEngine = (() => {

  const AREAS = ['Movement', 'Study', 'Self-Care', 'Routine', 'Consistency'];

  function defaultHabits() {
    return [
      { id: 'h-movement', name: 'Movement (any)', area: 'Movement', timesPerWeek: 3,
        preferredWeekdays: [], estimatedMinutes: 30, priority: 2, isMinimumComponent: true, active: true },
      { id: 'h-selftan', name: 'Autobronzante', area: 'Self-Care', timesPerWeek: 1,
        preferredWeekdays: [], preferredWindow: 'evening', estimatedMinutes: 20, priority: 2, isMinimumComponent: false, active: true },
      { id: 'h-laser', name: 'Laser at home', area: 'Self-Care', timesPerWeek: 1,
        preferredWeekdays: [0, 6], preferredWindow: 'weekend', estimatedMinutes: 30, priority: 2, isMinimumComponent: false, active: true },
      { id: 'h-skincare', name: 'Skincare', area: 'Self-Care', timesPerWeek: 7,
        preferredWeekdays: [], estimatedMinutes: 10, priority: 1, isMinimumComponent: true, active: true },
      { id: 'h-eveningreset', name: 'Evening reset', area: 'Routine', timesPerWeek: 7,
        preferredWeekdays: [], estimatedMinutes: 15, priority: 3, isMinimumComponent: true, active: true },
    ];
  }

  // --- Pilates: distribute one package of `perCycle` sessions across `spanDays`
  // (a package, not the whole October-to-April journey). Realistic rhythm: roughly
  // one session every spanDays/perCycle days, but each date is chosen from real
  // free slots rather than a rigid grid, and periods that look exam-heavy are
  // naturally skipped in favor of lighter days nearby.
  function planCycle(dayAnalyses, perCycle, cycleNumber, startingSessionId = 1) {
    const spacingDays = Math.max(3, Math.floor(dayAnalyses.length / perCycle));
    const sessions = [];
    let searchStart = 0;

    for (let i = 0; i < perCycle; i++) {
      const windowStart = Math.max(searchStart, i * spacingDays - 2);
      const windowEnd = Math.min(dayAnalyses.length, (i + 1) * spacingDays + 3);
      const candidateDays = dayAnalyses.slice(windowStart, windowEnd);
      const slot = CalendarIntel.bestSlot(null, 60, [], candidateDays);
      const chosenDate = slot ? slot.day.date : dayAnalyses[Math.min(windowStart, dayAnalyses.length - 1)]?.date;
      sessions.push({
        id: `pil-c${cycleNumber}-${i + 1}`,
        cycleNumber,
        sessionNumber: i + 1,
        date: chosenDate ? chosenDate.toISOString() : null,
        status: 'scheduled',
      });
      searchStart = windowEnd;
    }
    return sessions;
  }

  // Backwards-compatible name used by onboarding for the very first cycle.
  function planPilates(dayAnalyses, perCycle = 10, startDate = new Date()) {
    return planCycle(dayAnalyses, perCycle, 1);
  }

  // --- Adaptive suggestion: detect a weekday that this habit keeps getting skipped on ---
  function weakestWeekday(skipTracking, habitId) {
    const data = skipTracking[habitId];
    if (!data) return null;
    let worst = null, worstRatio = 0;
    for (const wd of Object.keys(data)) {
      const { skips = 0, completes = 0 } = data[wd];
      const total = skips + completes;
      if (total >= 3) {
        const ratio = skips / total;
        if (ratio > worstRatio && ratio >= 0.66) { worstRatio = ratio; worst = +wd; }
      }
    }
    return worst; // 0=Sunday ... 6=Saturday, or null
  }

  function strongestWeekday(skipTracking, habitId) {
    const data = skipTracking[habitId];
    if (!data) return null;
    let best = null, bestRatio = 0;
    for (const wd of Object.keys(data)) {
      const { skips = 0, completes = 0 } = data[wd];
      const total = skips + completes;
      if (total >= 2) {
        const ratio = completes / total;
        if (ratio > bestRatio) { bestRatio = ratio; best = +wd; }
      }
    }
    return best;
  }

  const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function recordOutcome(skipTracking, habitId, date, completed) {
    const wd = date.getDay();
    const st = { ...skipTracking };
    st[habitId] = { ...(st[habitId] || {}) };
    const cur = st[habitId][wd] || { skips: 0, completes: 0 };
    st[habitId][wd] = completed
      ? { ...cur, completes: cur.completes + 1 }
      : { ...cur, skips: cur.skips + 1 };
    return st;
  }

  return { defaultHabits, planPilates, planCycle, weakestWeekday, strongestWeekday, WEEKDAY_NAMES, recordOutcome, AREAS };
})();
