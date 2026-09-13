// scoring.js — intelligent scoring: consistency over perfection.
// Direct port of the logic designed for the native version, so a future
// SwiftUI rebuild can reuse the same rules.

const Scoring = (() => {

  function minimumWeight(load) {
    return { veryBusy: 75, busy: 65, moderate: 55, light: 45 }[load] ?? 55;
  }

  function extrasWeight(load) {
    return {
      veryBusy: { good: 20, great: 5 },
      busy: { good: 22, great: 8 },
      moderate: { good: 25, great: 12 },
      light: { good: 28, great: 17 },
    }[load] ?? { good: 25, great: 12 };
  }

  function recoveryBonus(skippedDaysBefore) {
    if (skippedDaysBefore <= 0) return 0;
    if (skippedDaysBefore === 1) return 2;
    if (skippedDaysBefore === 2) return 4;
    return 6;
  }

  // inputs: { load, minimumDayAchieved, goodExtras, greatExtras, skippedDaysBefore }
  function score(inputs) {
    if (!inputs.minimumDayAchieved) {
      let base = 15 + recoveryBonus(inputs.skippedDaysBefore);
      return Math.min(base, 40);
    }
    let total = minimumWeight(inputs.load);
    const w = extrasWeight(inputs.load);
    if (inputs.goodExtras > 0) total += Math.min(inputs.goodExtras / 3, 1) * w.good;
    if (inputs.greatExtras > 0) total += Math.min(inputs.greatExtras / 2, 1) * w.great;
    total += recoveryBonus(inputs.skippedDaysBefore);
    return Math.min(total, 100);
  }

  function dayLevel(inputs) {
    if (!inputs.minimumDayAchieved) return 'none';
    if (inputs.greatExtras >= 1 && inputs.goodExtras >= 2) return 'great';
    if (inputs.goodExtras >= 1) return 'good';
    return 'minimum';
  }

  // Streak with "flex days" so a miss doesn't zero everything out.
  function updateStreak(state, achievedMinimum) {
    const next = { ...state };
    if (achievedMinimum) {
      next.current += 1;
      next.best = Math.max(next.best, next.current);
      if (next.current % 7 === 0) next.flexDays = Math.min(next.flexDays + 1, 3);
    } else if (next.flexDays > 0) {
      next.flexDays -= 1;
    } else {
      next.current = 0;
    }
    return next;
  }

  return { score, dayLevel, updateStreak };
})();
