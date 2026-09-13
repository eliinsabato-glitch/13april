// app.js — main application: state orchestration + rendering for every screen.
// Deliberately framework-free (vanilla JS) so it stays inspectable, hostable
// on any static file host, and portable to a future native rewrite.

(function () {
  'use strict';

  let db = DB.get();
  let currentTab = 'today';

  // ---------- Utilities ----------

  function fmt(date, opts) {
    return new Intl.DateTimeFormat('it-IT', opts).format(date);
  }
  function isoDay(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function daysBetween(a, b) {
    const ms = new Date(b).setHours(0,0,0,0) - new Date(a).setHours(0,0,0,0);
    return Math.round(ms / 86400000);
  }
  function loadEvents() {
    const real = (db.calendarEvents || []).map(e => ({ ...e, start: new Date(e.start), end: new Date(e.end) }));
    const tiro = TirocinioEngine.syntheticEvents(db.tirocinio?.linea || 'gialla', db.tirocinio?.myGroup || null);
    return [...real, ...tiro];
  }
  function todayAnalysis() {
    return CalendarIntel.analyzeDay(loadEvents(), new Date());
  }
  function upcomingAnalyses(days) {
    return CalendarIntel.analyzeRange(loadEvents(), new Date(), days);
  }
  function loadLabel(load) {
    return { light: 'Light', moderate: 'Moderate', busy: 'Busy', veryBusy: 'Very Busy' }[load] || 'Moderate';
  }

  // Journey progress: percentage of days elapsed from journeyStartDate to targetDate,
  // weighted slightly by average recent score so it reflects consistency, not just time.
  function journeyProgress() {
    const start = new Date(db.settings.journeyStartDate);
    const target = new Date(db.settings.targetDate);
    const now = new Date();
    const totalDays = Math.max(1, daysBetween(start, target));
    const elapsed = Math.min(totalDays, Math.max(0, daysBetween(start, now)));
    const timePct = elapsed / totalDays;

    const recentScores = Object.values(db.dayRecords || {}).slice(-14).map(r => r.score || 0);
    const avgRecent = recentScores.length ? recentScores.reduce((a,b) => a+b, 0) / recentScores.length : 60;
    const consistencyFactor = avgRecent / 100;

    // Blend: mostly time-based (this is a calendar journey), lightly nudged by consistency.
    const pct = Math.min(1, timePct * 0.85 + consistencyFactor * timePct * 0.15);
    return Math.round(pct * 100);
  }

  function daysRemaining() {
    return Math.max(0, daysBetween(new Date(), new Date(db.settings.targetDate)));
  }

  // ---------- Exam / Recovery mode detection ----------

  function isExamMode() {
    return CalendarIntel.detectExamMode(loadEvents(), 7, 0.5);
  }

  function isRecoveryMode() {
    const last3 = lastNDates(3).map(d => db.dayRecords[isoDay(d)]);
    const missedCount = last3.filter(r => !r || !r.minimumDayAchieved).length;
    return missedCount >= 2;
  }

  function lastNDates(n) {
    const out = [];
    for (let i = n; i >= 1; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      out.push(d);
    }
    return out;
  }

  function skippedDaysBeforeToday() {
    const last3 = lastNDates(3).map(d => db.dayRecords[isoDay(d)]);
    return last3.filter(r => !r || !r.minimumDayAchieved).length;
  }

  // ---------- Exams ----------

  function examList() {
    return [...(db.exams || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  function upcomingExams() {
    const now = new Date();
    return examList().filter(e => e.status !== 'done' && new Date(e.date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  function nextExam() {
    return upcomingExams()[0] || null;
  }

  function daysUntilExam(exam) {
    return daysBetween(new Date(), new Date(exam.date));
  }

  // Weighted average by CFU when available, otherwise a simple mean.
  function weightedAverage() {
    const done = examList().filter(e => e.status === 'done' && e.grade != null && e.grade !== '');
    if (!done.length) return null;
    const totalCFU = done.reduce((s, e) => s + (+e.cfu || 0), 0);
    if (totalCFU === 0) {
      return Math.round((done.reduce((s, e) => s + (+e.grade), 0) / done.length) * 10) / 10;
    }
    const weighted = done.reduce((s, e) => s + (+e.grade) * (+e.cfu || 0), 0);
    return Math.round((weighted / totalCFU) * 10) / 10;
  }

  function totalCFUDone() {
    return examList().filter(e => e.status === 'done').reduce((s, e) => s + (+e.cfu || 0), 0);
  }

  // Days remaining before an exam that are NOT veryBusy (i.e. realistically usable for study).
  function studyDaysAvailable(exam) {
    const days = daysUntilExam(exam);
    if (days <= 0) return 0;
    const analyses = upcomingAnalyses(days);
    return analyses.filter(a => a.load !== 'veryBusy').length;
  }

  function saveExam(exam) {
    DB.set(s => {
      const exams = s.exams || [];
      const exists = exams.some(x => x.id === exam.id);
      return { ...s, exams: exists ? exams.map(x => x.id === exam.id ? exam : x) : [...exams, exam] };
    });
    db = DB.get();
  }

  function deleteExam(id) {
    DB.set(s => ({ ...s, exams: (s.exams || []).filter(x => x.id !== id) }));
    db = DB.get();
  }

  function setTirocinioGroup(group) {
    DB.set(s => ({ ...s, tirocinio: { ...s.tirocinio, myGroup: group } }));
    db = DB.get();
  }

  // ---------- Today's plan generation (the heart of the app) ----------

  function generateTodayPlan() {
    const analysis = todayAnalysis();
    const examMode = isExamMode();
    const recoveryMode = !examMode && isRecoveryMode();
    const habits = db.habits.length ? db.habits : HabitEngine.defaultHabits();

    let priorities = [];

    if (examMode) {
      priorities = [
        { id: 'study', name: 'Studio essenziale', tag: 'MUST', area: 'Study' },
        { id: 'sleep', name: 'Sonno regolare', tag: 'MUST', area: 'Routine' },
        { id: 'movement-min', name: 'Movimento minimo (15-20 min)', tag: 'SHOULD', area: 'Movement' },
        { id: 'selfcare-basic', name: 'Self-care essenziale', tag: 'NICE', area: 'Self-Care' },
      ];
    } else if (recoveryMode) {
      priorities = [
        { id: 'study-min', name: 'Studio essenziale', tag: 'MUST', area: 'Study' },
        { id: 'movement-min', name: 'Movimento minimo', tag: 'MUST', area: 'Movement' },
        { id: 'selfcare-basic', name: 'Self-care di base', tag: 'SHOULD', area: 'Self-Care' },
        { id: 'sleep', name: 'Dormire bene stanotte', tag: 'MUST', area: 'Routine' },
      ];
    } else {
      switch (analysis.load) {
        case 'veryBusy':
          priorities = [
            { id: 'uni', name: 'Università / studio', tag: 'MUST', area: 'Study' },
            { id: 'movement-min', name: '15-30 min movimento', tag: 'SHOULD', area: 'Movement' },
            { id: 'selfcare-basic', name: 'Self-care di base', tag: 'SHOULD', area: 'Self-Care' },
            { id: 'reset', name: 'Evening reset', tag: 'NICE', area: 'Routine' },
          ];
          break;
        case 'busy':
          priorities = [
            { id: 'uni', name: 'Università / studio', tag: 'MUST', area: 'Study' },
            { id: 'movement', name: 'Movimento (30 min)', tag: 'SHOULD', area: 'Movement' },
            { id: 'selfcare', name: 'Self-care', tag: 'SHOULD', area: 'Self-Care' },
            { id: 'reset', name: 'Evening reset', tag: 'NICE', area: 'Routine' },
          ];
          break;
        default: // light / moderate — room to push a bit
          priorities = [
            { id: 'study', name: 'Studio / lezioni', tag: 'MUST', area: 'Study' },
            { id: 'pilates-or-movement', name: 'Pilates o movimento più lungo', tag: 'SHOULD', area: 'Movement' },
            { id: 'selfcare-extra', name: 'Self-care con calma', tag: 'SHOULD', area: 'Self-Care' },
            { id: 'routine-extra', name: 'Routine / organizzazione', tag: 'NICE', area: 'Routine' },
          ];
      }
    }

    // cap to 3-5 priorities (spec: max 3-5, never 12 tasks)
    return { analysis, examMode, recoveryMode, priorities: priorities.slice(0, 5) };
  }

  function minimumDayItems() {
    return [
      { id: 'min-study', label: 'Studio essenziale' },
      { id: 'min-movement', label: 'Movimento minimo' },
      { id: 'min-selfcare', label: 'Self-care di base' },
      { id: 'min-hydration', label: 'Idratazione' },
      { id: 'min-prep', label: 'Prepara domani' },
      { id: 'min-sleep', label: 'Orario ragionevole a letto' },
    ];
  }

  function todayChecklistState() {
    const key = isoDay(new Date());
    return db.dayRecords[key]?.checklist || {};
  }

  function toggleChecklistItem(itemId) {
    const key = isoDay(new Date());
    DB.set(s => {
      const rec = s.dayRecords[key] || { checklist: {} };
      rec.checklist = { ...(rec.checklist || {}), [itemId]: !rec.checklist?.[itemId] };

      const minItems = minimumDayItems().map(i => i.id);
      const minDone = minItems.every(id => rec.checklist[id]);
      const goodExtras = ['pilates-or-movement', 'selfcare-extra', 'routine-extra', 'movement', 'selfcare']
        .filter(id => rec.checklist[id]).length;
      const greatExtras = ['routine-extra'].filter(id => rec.checklist[id]).length;

      rec.minimumDayAchieved = minDone;
      const examMode = isExamMode();
      const load = rec.load || todayAnalysis().load;
      rec.load = load;
      rec.examMode = examMode;
      const scoreInputs = {
        load, minimumDayAchieved: minDone, goodExtras, greatExtras,
        skippedDaysBefore: skippedDaysBeforeToday(),
      };
      rec.score = Scoring.score(scoreInputs);
      rec.level = Scoring.dayLevel(scoreInputs);

      s.dayRecords = { ...s.dayRecords, [key]: rec };

      // update streak whenever minimum-day status changes
      s.streak = Scoring.updateStreak(s.streak, minDone);

      // feed the adaptive habit engine so it can learn which weekdays work
      const movementIds = ['movement', 'movement-min', 'pilates-or-movement'];
      if (movementIds.includes(itemId)) {
        s.skipTracking = HabitEngine.recordOutcome(s.skipTracking, 'h-movement', new Date(), !!rec.checklist[itemId]);
      }
      return { ...s };
    });
    db = DB.get();
    render();
  }

  window.__thirteenApril = { toggleChecklistItem };

  // ---------- Pilates cycle management ----------
  // Pilates is a continuous habit made of successive 10-session packages, not a
  // one-time goal. When a cycle is finished, the next one is prepared automatically
  // and tracking continues until the April 13 target.
  function checkAndAdvancePilatesCycle() {
    const s = DB.get();
    const sessions = s.pilates.sessions || [];
    if (!sessions.length) return;
    const currentCycle = Math.max(...sessions.map(x => x.cycleNumber || 1));
    const currentSessions = sessions.filter(x => (x.cycleNumber || 1) === currentCycle);
    const allDone = currentSessions.every(x => x.status === 'completed');
    const nextExists = sessions.some(x => (x.cycleNumber || 1) === currentCycle + 1);
    const target = new Date(s.settings.targetDate);
    const now = new Date();

    if (allDone && !nextExists && now < target) {
      const remainingDays = Math.max(14, daysBetween(now, target));
      const span = Math.min(s.pilates.cycleSpanDays || 84, remainingDays);
      const analyses = CalendarIntel.analyzeRange(loadEvents(), new Date(), span);
      const nextSessions = HabitEngine.planCycle(analyses, s.pilates.perCycle, currentCycle + 1);
      DB.set(st => ({
        ...st,
        pilates: {
          ...st.pilates,
          sessions: [...st.pilates.sessions, ...nextSessions],
          justCompletedCycle: currentCycle,
        },
      }));
      db = DB.get();
    }
  }

  function dismissPilatesCycleMessage() {
    DB.set(s => ({ ...s, pilates: { ...s.pilates, justCompletedCycle: null } }));
    db = DB.get();
  }

  // ---------- Boot ----------

  function boot() {
    db = DB.get();
    if (!db.settings.targetDate) {
      const now = new Date();
      let target = new Date(now.getFullYear(), 3, 13); // April is month index 3
      if (target <= now) target = new Date(now.getFullYear() + 1, 3, 13);
      DB.set(s => ({ ...s, settings: { ...s.settings, targetDate: target.toISOString() } }));
      db = DB.get();
    }

    if (db.settings.onboardingComplete) {
      showApp();
    } else {
      showOnboarding();
    }
    registerServiceWorker();
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    }
  }

  // ---------- Onboarding ----------

  function showOnboarding() {
    document.getElementById('onboarding').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    let step = 1;
    const steps = document.querySelectorAll('.onboard-step');

    const dateInput = document.getElementById('target-date-input');
    if (db.settings.targetDate) dateInput.value = isoDay(new Date(db.settings.targetDate));

    document.querySelectorAll('[data-next]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (step === 2 && dateInput.value) {
          DB.set(s => ({ ...s, settings: { ...s.settings, targetDate: new Date(dateInput.value + 'T00:00:00').toISOString() } }));
          db = DB.get();
        }
        steps[step - 1].classList.add('hidden');
        step++;
        if (steps[step - 1]) steps[step - 1].classList.remove('hidden');
      });
    });

    document.getElementById('ics-input-onboard').addEventListener('change', handleICSImport);

    document.querySelector('[data-action="finish-onboarding"]').addEventListener('click', () => {
      DB.set(s => {
        const habits = HabitEngine.defaultHabits();
        const analyses = CalendarIntel.analyzeRange(loadEvents(), new Date(), s.pilates.cycleSpanDays || 84);
        const sessions = HabitEngine.planCycle(analyses, s.pilates.perCycle, 1);
        return {
          ...s,
          habits,
          pilates: { ...s.pilates, sessions },
          settings: { ...s.settings, onboardingComplete: true },
        };
      });
      db = DB.get();
      showApp();
    });
  }

  function handleICSImport(evt) {
    const file = evt.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = CalendarIntel.parseICS(reader.result);
        DB.set(s => ({
          ...s,
          calendarEvents: parsed.map(e => ({ start: e.start.toISOString(), end: e.end.toISOString(), title: e.title || 'Evento' })),
        }));
        db = DB.get();
        const statusEl = document.getElementById('onboard-ics-status') || document.getElementById('settings-ics-status');
        if (statusEl) statusEl.textContent = `Importati ${parsed.length} eventi.`;
        if (document.getElementById('app') && !document.getElementById('app').classList.contains('hidden')) render();
      } catch (e) {
        console.error(e);
        const statusEl = document.getElementById('onboard-ics-status') || document.getElementById('settings-ics-status');
        if (statusEl) statusEl.textContent = 'Impossibile leggere il file. Assicurati sia un .ics valido.';
      }
    };
    reader.readAsText(file);
  }

  // ---------- Navigation ----------

  function showApp() {
    document.getElementById('onboarding').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentTab = btn.dataset.nav;
        document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.nav === currentTab));
        render();
      });
    });
    render();
  }

  function render() {
    db = DB.get();
    const titleMap = { today: 'Today', journey: 'Journey', habits: 'Habits', exams: 'Esami', insights: 'Insights', settings: 'Settings' };
    document.getElementById('top-bar-title').textContent = titleMap[currentTab];
    const content = document.getElementById('content');
    content.innerHTML = '';
    const screens = window.__ta_screens;
    if (!screens) return; // app-screens.js not loaded yet
    const renderers = {
      today: screens.renderToday, journey: screens.renderJourney, habits: screens.renderHabits,
      exams: screens.renderExams, insights: screens.renderInsights, settings: screens.renderSettings,
    };
    (renderers[currentTab] || screens.renderToday)(content);
  }

  window.addEventListener('DOMContentLoaded', boot);

  // expose shared helpers to the other render sections defined in app-screens.js
  window.__ta_shared = {
    fmt, isoDay, daysBetween, loadEvents, todayAnalysis, upcomingAnalyses, loadLabel,
    journeyProgress, daysRemaining, isExamMode, isRecoveryMode, lastNDates,
    generateTodayPlan, minimumDayItems, todayChecklistState, toggleChecklistItem,
    handleICSImport, getDB: () => db, render, openSheet: null, closeSheet: null,
    checkAndAdvancePilatesCycle, dismissPilatesCycleMessage,
    examList, upcomingExams, nextExam, daysUntilExam, weightedAverage, totalCFUDone,
    studyDaysAvailable, saveExam, deleteExam, setTirocinioGroup,
  };
})();
