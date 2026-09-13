// tirocinio.js — clinical rotation ("tirocinio"/APRO) calendar intelligence.
//
// The week-by-week schedule below is reference/academic data (the same for
// every student on a given "linea"), transcribed from the official
// "Calendario APRO 2026/27" PDF for LINEA GIALLA. It is NOT personal state,
// so it doesn't live in db.js — only the student's own linea/group selection
// does (tirocinio.myGroup, editable anytime in Settings once known).
//
// Some weeks are assigned to a specific PSD sub-group (1-4) within the linea;
// others (plain "SimLab" or "OSR" entries) apply to the whole linea regardless
// of sub-group. Until myGroup is known, group-specific weeks are shown as
// "da confermare" rather than guessed.

const TirocinioEngine = (() => {

  // group: null = applies to everyone in the linea; 1-4 = only that PSD sub-group
  const SCHEDULE_GIALLA = [
    { start: '2026-09-21', end: '2026-09-26', activity: 'Nessun impegno APRO', group: null, free: true },
    { start: '2026-09-28', end: '2026-10-03', activity: 'Nessun impegno APRO', group: null, free: true },
    { start: '2026-10-05', end: '2026-10-10', activity: 'SimLab2 Chirurgia', group: null },
    { start: '2026-10-12', end: '2026-10-17', activity: 'Nessun impegno APRO', group: null, free: true },
    { start: '2026-10-19', end: '2026-10-24', activity: 'Nessun impegno APRO', group: null, free: true },
    { start: '2026-10-26', end: '2026-10-31', activity: 'Nessun impegno APRO', group: null, free: true },
    { start: '2026-11-02', end: '2026-11-07', activity: 'Nessun impegno APRO', group: null, free: true },
    { start: '2026-11-09', end: '2026-11-14', activity: 'Nessun impegno APRO', group: null, free: true },
    { start: '2026-11-16', end: '2026-11-21', activity: 'Nessun impegno APRO', group: null, free: true },
    { start: '2026-11-23', end: '2026-11-28', activity: 'OSR — APRO Medicina interna (II parte, VII semestre)', group: null },
    { start: '2026-11-30', end: '2026-12-05', activity: 'Internato in Chirurgia e Specializzazioni Chirurgiche', group: 1 },
    { start: '2026-12-07', end: '2026-12-12', activity: 'Internato in Chirurgia e Specializzazioni Chirurgiche', group: 2 },
    { start: '2026-12-14', end: '2026-12-19', activity: 'Internato in Chirurgia e Specializzazioni Chirurgiche', group: 3 },
    { start: '2027-03-01', end: '2027-03-06', activity: 'Internato in Chirurgia e Specializzazioni Chirurgiche', group: 4 },
    { start: '2027-03-08', end: '2027-03-13', activity: 'APRO Medicina interna (II parte, VII semestre)', group: 1 },
    { start: '2027-03-15', end: '2027-03-20', activity: 'OSR — Internato in Chirurgia e Specializzazioni Chirurgiche', group: null },
    { start: '2027-03-22', end: '2027-03-27', activity: 'APRO Medicina interna (II parte, VII semestre)', group: 2 },
    { start: '2027-03-29', end: '2027-04-03', activity: 'APRO Medicina interna (II parte, VII semestre)', group: 3 },
    { start: '2027-04-05', end: '2027-04-10', activity: 'Nessun impegno APRO', group: null, free: true },
    { start: '2027-04-12', end: '2027-04-17', activity: 'APRO Medicina interna (II parte, VII semestre)', group: 4 },
    { start: '2027-04-19', end: '2027-04-24', activity: 'Nessun impegno APRO', group: null, free: true },
    { start: '2027-04-26', end: '2027-05-01', activity: 'Nessun impegno APRO', group: null, free: true },
    { start: '2027-05-03', end: '2027-05-08', activity: 'Nessun impegno APRO', group: null, free: true },
    { start: '2027-05-10', end: '2027-05-15', activity: 'SimLab2 Medicina (10-11-12 mattina)', group: null },
    { start: '2027-05-17', end: '2027-05-22', activity: 'Nessun impegno APRO', group: null, free: true },
    { start: '2027-05-24', end: '2027-05-29', activity: 'Nessun impegno APRO', group: null, free: true },
    { start: '2027-05-31', end: '2027-06-05', activity: 'Nessun impegno APRO', group: null, free: true },
    { start: '2027-06-07', end: '2027-06-12', activity: 'Nessun impegno APRO', group: null, free: true },
  ];

  const SCHEDULES = { gialla: SCHEDULE_GIALLA };

  function scheduleFor(linea) {
    return SCHEDULES[linea] || [];
  }

  function parseDate(s) {
    return new Date(s + 'T00:00:00');
  }

  function weekFor(date, linea) {
    const sched = scheduleFor(linea);
    const d = new Date(date); d.setHours(12, 0, 0, 0);
    return sched.find(w => d >= parseDate(w.start) && d <= parseDate(w.end)) || null;
  }

  // Does this week's activity actually involve the student, given her group?
  // - free weeks: never a commitment
  // - group === null: applies to the whole linea
  // - group === N: applies only if myGroup === N; if myGroup is unknown, we
  //   flag it as "unconfirmed" rather than silently including or excluding it
  function status(week, myGroup) {
    if (!week || week.free) return 'free';
    if (week.group === null) return 'confirmed';
    if (!myGroup) return 'unconfirmed';
    return week.group === myGroup ? 'confirmed' : 'not-me';
  }

  function currentWeek(linea) {
    return weekFor(new Date(), linea);
  }

  function upcoming(linea, n = 8) {
    const sched = scheduleFor(linea);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return sched.filter(w => parseDate(w.end) >= now).slice(0, n);
  }

  // Synthetic "busy" events fed into CalendarIntel alongside real .ics events,
  // so tirocinio weeks affect Today's load, Exam Mode detection, and Pilates
  // scheduling exactly like a real calendar commitment would. Assumes typical
  // weekday clinical-rotation hours (08:00–14:00, Mon–Fri) — adjust in
  // Settings if your actual hours differ.
  function syntheticEvents(linea, myGroup) {
    const sched = scheduleFor(linea);
    const events = [];
    sched.forEach(w => {
      if (status(w, myGroup) !== 'confirmed') return;
      let d = new Date(parseDate(w.start));
      const end = parseDate(w.end);
      while (d <= end) {
        const wd = d.getDay();
        if (wd >= 1 && wd <= 5) {
          const start = new Date(d); start.setHours(8, 0, 0, 0);
          const stop = new Date(d); stop.setHours(14, 0, 0, 0);
          events.push({ start, end: stop, title: w.activity, synthetic: true });
        }
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      }
    });
    return events;
  }

  function weekLabel(week) {
    const s = parseDate(week.start), e = parseDate(week.end);
    const fmt = (d) => `${d.getDate()} ${['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'][d.getMonth()]}`;
    return `${fmt(s)} – ${fmt(e)}`;
  }

  return { scheduleFor, weekFor, status, currentWeek, upcoming, syntheticEvents, weekLabel };
})();
