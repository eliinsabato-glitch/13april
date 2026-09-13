// calendar.js — reads REAL events from an imported .ics file (never invents events)
// and analyzes how busy each day actually is, exactly like the native EventKit
// version would, just fed by a file instead of a live calendar permission.

const CalendarIntel = (() => {

  const DAY_START_HOUR = 8;
  const DAY_END_HOUR = 23;

  // ---------- .ics parsing ----------
  // Minimal but correct VEVENT parser: handles DTSTART/DTEND (date or date-time,
  // with or without VALUE=DATE, with or without TZID), SUMMARY, and line folding.
  function parseICS(text) {
    const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
    const lines = unfolded.split(/\r\n|\n|\r/);
    const events = [];
    let cur = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
      if (line === 'END:VEVENT') { if (cur && cur.start) events.push(cur); cur = null; continue; }
      if (!cur) continue;

      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const keyPart = line.slice(0, idx);
      const value = line.slice(idx + 1);
      const key = keyPart.split(';')[0];

      if (key === 'SUMMARY') cur.title = decodeICSText(value);
      else if (key === 'DTSTART') cur.start = parseICSDate(keyPart, value);
      else if (key === 'DTEND') cur.end = parseICSDate(keyPart, value);
      else if (key === 'DURATION' && cur.start && !cur.end) cur.end = addDuration(cur.start, value);
    }
    // Filter out anything we couldn't parse a valid start/end for.
    return events.filter(e => e.start && e.end && e.end > e.start);
  }

  function decodeICSText(v) {
    return v.replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
  }

  function parseICSDate(keyPart, value) {
    const isDateOnly = keyPart.includes('VALUE=DATE') || /^\d{8}$/.test(value);
    if (isDateOnly) {
      const y = +value.slice(0, 4), m = +value.slice(4, 6) - 1, d = +value.slice(6, 8);
      return new Date(y, m, d, 0, 0, 0);
    }
    // YYYYMMDDTHHMMSS or with trailing Z (UTC)
    const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
    if (!m) return null;
    const [, y, mo, d, h, mi, s, z] = m;
    if (z === 'Z') {
      return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
    }
    return new Date(+y, +mo - 1, +d, +h, +mi, +s);
  }

  function addDuration(start, iso) {
    // Very small subset of ISO 8601 durations: PT1H30M, P1D, etc.
    const m = iso.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
    if (!m) return new Date(start.getTime() + 3600000);
    const [, days, hours, mins, secs] = m;
    const ms = (+(days||0))*86400000 + (+(hours||0))*3600000 + (+(mins||0))*60000 + (+(secs||0))*1000;
    return new Date(start.getTime() + ms);
  }

  // ---------- Day analysis ----------

  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function isWeekend(date) {
    const d = date.getDay();
    return d === 0 || d === 6;
  }

  function eventsOnDay(events, date) {
    return events.filter(e => {
      // include events that overlap this calendar day at all
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0);
      return e.start < dayEnd && e.end > dayStart;
    });
  }

  function mergeIntervals(intervals) {
    const sorted = [...intervals].sort((a, b) => a.start - b.start);
    const merged = [];
    for (const iv of sorted) {
      const last = merged[merged.length - 1];
      if (last && iv.start <= last.end) {
        last.end = new Date(Math.max(last.end, iv.end));
      } else {
        merged.push({ start: new Date(iv.start), end: new Date(iv.end) });
      }
    }
    return merged;
  }

  function analyzeDay(events, date) {
    const dayStart = new Date(date); dayStart.setHours(DAY_START_HOUR, 0, 0, 0);
    const dayEnd = new Date(date); dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);
    const totalWakingMin = (dayEnd - dayStart) / 60000;

    const raw = eventsOnDay(events, date);
    const clipped = raw.map(e => ({
      start: e.start < dayStart ? dayStart : e.start,
      end: e.end > dayEnd ? dayEnd : e.end,
    })).filter(iv => iv.end > iv.start);

    const merged = mergeIntervals(clipped);
    const busyMin = merged.reduce((sum, iv) => sum + (iv.end - iv.start) / 60000, 0);
    const freeMin = Math.max(0, totalWakingMin - busyMin);

    // free windows
    const freeWindows = [];
    let cursor = dayStart;
    for (const block of merged) {
      if (block.start > cursor) {
        const gapMin = (block.start - cursor) / 60000;
        if (gapMin >= 30) freeWindows.push({ start: new Date(cursor), end: new Date(block.start) });
      }
      if (block.end > cursor) cursor = block.end;
    }
    if (cursor < dayEnd) {
      const gapMin = (dayEnd - cursor) / 60000;
      if (gapMin >= 30) freeWindows.push({ start: new Date(cursor), end: new Date(dayEnd) });
    }

    const busyRatio = totalWakingMin > 0 ? busyMin / totalWakingMin : 0;
    let load;
    if (busyRatio < 0.25) load = 'light';
    else if (busyRatio < 0.5) load = 'moderate';
    else if (busyRatio < 0.75) load = 'busy';
    else load = 'veryBusy';

    const longestBlockMin = merged.reduce((max, iv) => Math.max(max, (iv.end - iv.start) / 60000), 0);
    const looksLikeExamDay = longestBlockMin > 180 && freeMin < 120 && !isWeekend(date);

    return {
      date, load, busyMin, freeMin, freeWindows,
      isWeekend: isWeekend(date), eventCount: raw.length, looksLikeExamDay,
    };
  }

  function analyzeRange(events, startDate, days) {
    const out = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate); d.setDate(d.getDate() + i);
      out.push(analyzeDay(events, d));
    }
    return out;
  }

  function detectExamMode(events, lookaheadDays = 7, threshold = 0.5) {
    const analyses = analyzeRange(events, new Date(), lookaheadDays);
    const weekdayAnalyses = analyses.filter(a => !a.isWeekend);
    if (weekdayAnalyses.length === 0) return false;
    const examLike = weekdayAnalyses.filter(a => a.looksLikeExamDay || a.load === 'veryBusy').length;
    return (examLike / weekdayAnalyses.length) >= threshold;
  }

  // Finds the best free slot across candidate days, honoring preferred weekdays first.
  function bestSlot(events, minutes, preferredWeekdays, candidateDays) {
    const needed = minutes;
    const withWindows = (days) => days
      .map(d => ({ ...d, windows: d.freeWindows.filter(w => (w.end - w.start) / 60000 >= needed) }))
      .filter(d => d.windows.length > 0);

    if (preferredWeekdays && preferredWeekdays.length > 0) {
      const preferredSet = new Set(preferredWeekdays);
      const preferredDays = candidateDays.filter(d => preferredSet.has(d.date.getDay()));
      const withW = withWindows(preferredDays).sort((a, b) => b.freeMin - a.freeMin);
      if (withW.length > 0) return { day: withW[0], window: withW[0].windows[0] };
    }

    const loadRank = { light: 0, moderate: 1, busy: 2, veryBusy: 3 };
    const ranked = [...candidateDays].sort((a, b) => {
      const r = loadRank[a.load] - loadRank[b.load];
      return r !== 0 ? r : b.freeMin - a.freeMin;
    });
    const withW = withWindows(ranked);
    return withW.length > 0 ? { day: withW[0], window: withW[0].windows[0] } : null;
  }

  return { parseICS, analyzeDay, analyzeRange, detectExamMode, bestSlot, isSameDay, isWeekend };
})();
