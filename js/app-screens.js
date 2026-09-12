// app-screens.js — all screen rendering, built on top of the shared helpers
// exposed by app.js via window.__ta_shared and window.__thirteenApril.

(function () {
  'use strict';
  const S = window.__ta_shared;
  const A = window.__thirteenApril;

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  // ---------- Sheet (bottom modal) ----------
  function openSheet(html, onMount) {
    const overlay = document.getElementById('sheet-overlay');
    const sheet = document.getElementById('sheet');
    sheet.innerHTML = html;
    overlay.classList.remove('hidden');
    overlay.onclick = (e) => { if (e.target === overlay) closeSheet(); };
    if (onMount) onMount(sheet);
  }
  function closeSheet() {
    document.getElementById('sheet-overlay').classList.add('hidden');
  }
  window.__ta_sheet = { open: openSheet, close: closeSheet };

  // ================= TODAY =================
  function renderToday(root) {
    const db = S.getDB();
    const plan = S.generateTodayPlan();
    const checklist = S.todayChecklistState();
    const remaining = S.daysRemaining();
    const progress = S.journeyProgress();
    const targetDate = new Date(db.settings.targetDate);

    let modeBanner = '';
    if (plan.examMode) {
      modeBanner = `<div class="exam-banner"><strong>Exam Mode.</strong> Dimentica il superfluo. Studio, sonno, e il minimo indispensabile per il resto.</div>`;
    } else if (plan.recoveryMode) {
      modeBanner = `<div class="recovery-banner"><strong>Reset.</strong> Facciamo che oggi sia più leggero. Nulla è rovinato — questa è la strada per tornare in carreggiata.</div>`;
    }

    const minItems = S.minimumDayItems();
    const minDone = minItems.every(i => checklist[i.id]);

    root.appendChild(el(`
      <div>
        <div class="card hero-countdown">
          <div class="hero-date">13 APRIL</div>
          <div class="hero-days">${remaining}</div>
          <div class="hero-days-label">days to go</div>
          <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
          <div class="progress-pct">${progress}% of the journey</div>
        </div>

        ${modeBanner}

        <div class="card">
          <div class="section-label">Today's load</div>
          <span class="load-badge load-${plan.analysis.load}">${S.loadLabel(plan.analysis.load)}</span>
          <span class="muted small" style="margin-left:10px">${Math.round(plan.analysis.freeMin/60*10)/10}h libere &middot; ${plan.analysis.eventCount} impegni</span>

          <div class="section-label" style="margin-top:20px">Today's plan</div>
          <div id="priority-list"></div>

          ${minDone ? '<div class="minday-complete">Day completed — minimum day achieved</div>' : ''}
        </div>

        <div class="card">
          <div class="section-label">Minimum Day</div>
          <div id="minimum-list"></div>
        </div>

        <button class="btn-secondary" id="checkin-btn">Evening check-in</button>
      </div>
    `));

    const priorityList = root.querySelector('#priority-list');
    plan.priorities.forEach(p => {
      const done = !!checklist[p.id];
      const row = el(`
        <div class="priority-item ${done ? 'done' : ''}" data-id="${p.id}">
          <div class="checkbox">${done ? '✓' : ''}</div>
          <div class="priority-name">${p.name}</div>
          <div class="priority-tag">${p.tag}</div>
        </div>
      `);
      row.addEventListener('click', () => A.toggleChecklistItem(p.id));
      priorityList.appendChild(row);
    });

    const minList = root.querySelector('#minimum-list');
    minItems.forEach(item => {
      const done = !!checklist[item.id];
      const row = el(`
        <div class="priority-item ${done ? 'done' : ''}" data-id="${item.id}">
          <div class="checkbox">${done ? '✓' : ''}</div>
          <div class="priority-name">${item.label}</div>
        </div>
      `);
      row.addEventListener('click', () => A.toggleChecklistItem(item.id));
      minList.appendChild(row);
    });

    root.querySelector('#checkin-btn').addEventListener('click', openCheckInSheet);
  }

  function openCheckInSheet() {
    openSheet(`
      <div class="sheet-title">How was today?</div>
      <div class="checkin-row">
        <div class="checkin-label"><span>Energy</span></div>
        <div class="slider-track" data-field="energy">${[1,2,3,4,5].map(n=>`<button class="slider-dot" data-val="${n}">${n}</button>`).join('')}</div>
      </div>
      <div class="checkin-row">
        <div class="checkin-label"><span>Mood</span></div>
        <div class="slider-track" data-field="mood">${[1,2,3,4,5].map(n=>`<button class="slider-dot" data-val="${n}">${n}</button>`).join('')}</div>
      </div>
      <div class="checkin-row">
        <div class="checkin-label"><span>Stress</span></div>
        <div class="slider-track" data-field="stress">${[1,2,3,4,5].map(n=>`<button class="slider-dot" data-val="${n}">${n}</button>`).join('')}</div>
      </div>
      <div class="form-row">
        <label class="form-label">What made today easier or harder? (optional)</label>
        <input type="text" id="checkin-note" class="input-field" placeholder="...">
      </div>
      <button class="btn-primary" id="checkin-save">Save</button>
    `, (sheet) => {
      const values = { energy: 3, mood: 3, stress: 3 };
      sheet.querySelectorAll('.slider-track').forEach(track => {
        track.querySelectorAll('.slider-dot').forEach(dot => {
          if (+dot.dataset.val === values[track.dataset.field]) dot.classList.add('selected');
          dot.addEventListener('click', () => {
            track.querySelectorAll('.slider-dot').forEach(d => d.classList.remove('selected'));
            dot.classList.add('selected');
            values[track.dataset.field] = +dot.dataset.val;
          });
        });
      });
      sheet.querySelector('#checkin-save').addEventListener('click', () => {
        const note = sheet.querySelector('#checkin-note').value;
        DB.set(s => ({ ...s, checkIns: [...s.checkIns, { date: new Date().toISOString(), ...values, note }] }));
        closeSheet();
        S.render();
      });
    });
  }

  // ================= JOURNEY =================
  const PHASES = [
    { m: 9, name: 'October', phase: 'Build' },
    { m: 10, name: 'November', phase: 'Consistency' },
    { m: 11, name: 'December', phase: 'Maintain' },
    { m: 0, name: 'January', phase: 'Reset' },
    { m: 1, name: 'February', phase: 'Exam Mode' },
    { m: 2, name: 'March', phase: 'Rebuild' },
    { m: 3, name: 'April', phase: 'Final Stretch' },
  ];

  function renderJourney(root) {
    const db = S.getDB();
    const now = new Date();
    const targetPassed = now >= new Date(db.settings.targetDate);

    root.appendChild(el(`
      <div>
        <div class="card">
          <div class="section-label">Your journey</div>
          <div id="timeline"></div>
        </div>
        <div class="card">
          <div class="section-label">Areas</div>
          <div class="area-grid" id="area-grid"></div>
        </div>
        <button class="btn-secondary" id="weekly-reset-btn">Weekly Reset</button>
        <button class="btn-secondary" id="monthly-review-btn">Monthly Review</button>
        ${targetPassed ? '<button class="btn-primary" id="finale-btn">Open April 13</button>' : ''}
      </div>
    `));

    const timeline = root.querySelector('#timeline');
    const curMonth = now.getMonth();
    PHASES.forEach(p => {
      const isPast = monthOrder(p.m) < monthOrder(curMonth) && !(p.m === curMonth);
      const isActive = p.m === curMonth;
      timeline.appendChild(el(`
        <div class="timeline-month">
          <div class="timeline-dot ${isActive ? 'active' : isPast ? 'past' : ''}"></div>
          <div>
            <div class="timeline-month-name">${p.name}</div>
            <div class="timeline-month-phase">${p.phase}</div>
          </div>
        </div>
      `));
    });

    const areaGrid = root.querySelector('#area-grid');
    const stats = computeAreaStats();
    HabitEngine.AREAS.filter(a => a !== 'Consistency').forEach(area => {
      areaGrid.appendChild(el(`
        <div class="area-tile">
          <div class="area-value">${stats[area] ?? 0}%</div>
          <div class="area-name">${area}</div>
        </div>
      `));
    });

    root.querySelector('#weekly-reset-btn').addEventListener('click', openWeeklyReset);
    root.querySelector('#monthly-review-btn').addEventListener('click', openMonthlyReview);
    const finaleBtn = root.querySelector('#finale-btn');
    if (finaleBtn) finaleBtn.addEventListener('click', openFinale);
  }

  function monthOrder(m) {
    // Order months Oct(9)..Apr(3) as a linear 0..6 sequence
    const seq = [9,10,11,0,1,2,3];
    const i = seq.indexOf(m);
    return i === -1 ? 99 : i;
  }

  function computeAreaStats() {
    const db = S.getDB();
    const records = Object.values(db.dayRecords || {});
    const last14 = records.slice(-14);
    if (!last14.length) return {};
    const movementDone = last14.filter(r => r.checklist && (r.checklist['movement'] || r.checklist['movement-min'] || r.checklist['pilates-or-movement'])).length;
    const studyDone = last14.filter(r => r.checklist && (r.checklist['study'] || r.checklist['uni'] || r.checklist['study-min'])).length;
    const selfcareDone = last14.filter(r => r.checklist && (r.checklist['selfcare'] || r.checklist['selfcare-basic'] || r.checklist['selfcare-extra'])).length;
    return {
      Movement: Math.round(movementDone / last14.length * 100),
      Study: Math.round(studyDone / last14.length * 100),
      'Self-Care': Math.round(selfcareDone / last14.length * 100),
    };
  }

  function openWeeklyReset() {
    const db = S.getDB();
    const last7 = S.lastNDates(7).concat([new Date()]).map(d => db.dayRecords[S.isoDay(d)]).filter(Boolean);
    const minDays = last7.filter(r => r.minimumDayAchieved).length;
    const avgScore = last7.length ? Math.round(last7.reduce((a,r)=>a+(r.score||0),0)/last7.length) : 0;
    const nextWeekAnalyses = S.upcomingAnalyses(7);
    const heavyDays = nextWeekAnalyses.filter(a => a.load === 'busy' || a.load === 'veryBusy').length;

    const allSessions = db.pilates.sessions || [];
    const currentCycle = allSessions.length ? Math.max(...allSessions.map(s => s.cycleNumber || 1)) : 1;
    const completedInCycle = allSessions.filter(s => (s.cycleNumber || 1) === currentCycle && s.status === 'completed').length;
    const pilatesDone = `C${currentCycle}: ${completedInCycle}/${db.pilates.perCycle || 10}`;
    const nextWeekHeavyMsg = "La settimana prossima è più pesante del solito. L'app ridurrà automaticamente gli obiettivi extra nei giorni pieni.";
    const nextWeekLightMsg = "La settimana prossima sembra gestibile. Buon momento per spingere un po' su Pilates e self-care.";

    openSheet(`
      <div class="sheet-title">Weekly Reset</div>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-value">${minDays}/7</div><div class="stat-label">Minimum Days</div></div>
        <div class="stat-card"><div class="stat-value">${avgScore}</div><div class="stat-label">Avg score</div></div>
        <div class="stat-card"><div class="stat-value">${pilatesDone}</div><div class="stat-label">Pilates</div></div>
        <div class="stat-card"><div class="stat-value">${db.streak.current}</div><div class="stat-label">Streak</div></div>
      </div>
      <div class="section-label" style="margin-top:20px">Next week</div>
      <p class="muted small">${heavyDays >= 3 ? nextWeekHeavyMsg : nextWeekLightMsg}</p>
      <button class="btn-primary" id="close-weekly">Chiudi</button>
    `, (sheet) => sheet.querySelector('#close-weekly').addEventListener('click', closeSheet));
  }

  function openMonthlyReview() {
    const db = S.getDB();
    const records = Object.entries(db.dayRecords || {});
    const now = new Date();
    const thisMonth = records.filter(([k]) => new Date(k).getMonth() === now.getMonth());
    const minDays = thisMonth.filter(([,r]) => r.minimumDayAchieved).length;
    const avg = thisMonth.length ? Math.round(thisMonth.reduce((a,[,r])=>a+(r.score||0),0)/thisMonth.length) : 0;
    const allSessions = db.pilates.sessions || [];
    const cyclesCompleted = allSessions.length ? Math.max(...allSessions.map(s => s.cycleNumber || 1)) - 1 : 0;
    const totalPilatesDone = allSessions.filter(s => s.status === 'completed').length;

    openSheet(`
      <div class="sheet-title">Monthly Review</div>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-value">${minDays}</div><div class="stat-label">Minimum Days</div></div>
        <div class="stat-card"><div class="stat-value">${avg}</div><div class="stat-label">Avg score</div></div>
        <div class="stat-card"><div class="stat-value">${db.streak.best}</div><div class="stat-label">Best streak</div></div>
        <div class="stat-card"><div class="stat-value">${totalPilatesDone}</div><div class="stat-label">Pilates totali (${cyclesCompleted} cicli completi)</div></div>
      </div>
      <button class="btn-primary" id="close-monthly">Chiudi</button>
    `, (sheet) => sheet.querySelector('#close-monthly').addEventListener('click', closeSheet));
  }

  function openFinale() {
    const db = S.getDB();
    const records = Object.values(db.dayRecords || {});
    const minDays = records.filter(r => r.minimumDayAchieved).length;
    const allSessions = db.pilates.sessions || [];
    const totalPilatesDone = allSessions.filter(s => s.status === 'completed').length;
    document.getElementById('content').innerHTML = '';
    document.getElementById('content').appendChild(el(`
      <div class="finale-hero">
        <div class="finale-title">APRIL 13</div>
        <div class="finale-sub">You made it.</div>
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-value">${minDays}</div><div class="stat-label">Minimum Days</div></div>
          <div class="stat-card"><div class="stat-value">${totalPilatesDone}</div><div class="stat-label">Pilates sessions</div></div>
          <div class="stat-card"><div class="stat-value">${db.streak.best}</div><div class="stat-label">Best streak</div></div>
          <div class="stat-card"><div class="stat-value">${records.length}</div><div class="stat-label">Days tracked</div></div>
        </div>
        <p class="muted" style="margin-top:24px; padding: 0 20px;">Il successo non è un prima/dopo fisico. È aver costruito abitudini che riesci davvero a mantenere.</p>
      </div>
    `));
  }

  // ================= HABITS =================
  function renderHabits(root) {
    const db = S.getDB();
    const habits = db.habits.length ? db.habits : HabitEngine.defaultHabits();
    const pilates = db.pilates;

    root.appendChild(el(`
      <div>
        <div class="card" id="pilates-card">
          <div class="section-label">Pilates Reformer</div>
          <div id="pilates-cycle-header"></div>
          <div class="pilates-dots" id="pilates-dots"></div>
        </div>

        <div class="card">
          <div class="section-label">My habits</div>
          <div id="habit-rows"></div>
          <button class="btn-secondary" id="add-habit-btn">+ Add habit</button>
        </div>
      </div>
    `));

    const allSessions = pilates.sessions || [];
    const currentCycle = allSessions.length ? Math.max(...allSessions.map(s => s.cycleNumber || 1)) : 1;
    const currentSessions = allSessions.filter(s => (s.cycleNumber || 1) === currentCycle);
    const completedInCycle = currentSessions.filter(s => s.status === 'completed').length;
    const completedCycles = currentCycle - 1;

    const header = root.querySelector('#pilates-cycle-header');
    header.innerHTML = `
      <div class="hero-days" style="font-size:32px">Ciclo ${currentCycle}: ${completedInCycle}/${pilates.perCycle}</div>
      ${completedCycles > 0 ? `<div class="muted small">${completedCycles} ciclo${completedCycles > 1 ? 'i' : ''} completat${completedCycles > 1 ? 'i' : 'o'} finora</div>` : ''}
    `;

    if (pilates.justCompletedCycle) {
      root.querySelector('#pilates-card').insertAdjacentElement('afterbegin', el(`
        <div class="exam-banner" style="background:rgba(156,187,156,0.12); border-color:rgba(156,187,156,0.3); margin-bottom:14px;" id="cycle-complete-banner">
          <strong>Ciclo ${pilates.justCompletedCycle} completato.</strong> Ottimo ritmo — il ciclo successivo è già pronto, distribuito sul tuo calendario.
        </div>
      `));
      root.querySelector('#cycle-complete-banner').addEventListener('click', () => {
        S.dismissPilatesCycleMessage(); S.render();
      });
    }

    const dotsWrap = root.querySelector('#pilates-dots');
    currentSessions.forEach(s => {
      const cls = s.status === 'completed' ? 'done' : s.status === 'scheduled' ? 'scheduled' : '';
      const dot = el(`<div class="pilates-dot ${cls}" title="${s.date ? new Date(s.date).toLocaleDateString('it-IT') : ''}">${s.sessionNumber}</div>`);
      dot.addEventListener('click', () => openPilatesSheet(s));
      dotsWrap.appendChild(dot);
    });

    const rows = root.querySelector('#habit-rows');
    habits.forEach(h => {
      const weak = HabitEngine.weakestWeekday(db.skipTracking, h.id);
      const strong = HabitEngine.strongestWeekday(db.skipTracking, h.id);
      let hint = '';
      if (weak !== null) hint = `${HabitEngine.WEEKDAY_NAMES[weak]} doesn't seem to work for you.`;
      else if (strong !== null) hint = `${HabitEngine.WEEKDAY_NAMES[strong]} is one of your strongest days.`;

      const row = el(`
        <div class="habit-row">
          <div>
            <div>${h.name}</div>
            <div class="habit-meta">${h.area} &middot; ${h.timesPerWeek}x/week${hint ? ' &middot; ' + hint : ''}</div>
          </div>
          <button class="pill-btn" data-id="${h.id}">Edit</button>
        </div>
      `);
      row.querySelector('button').addEventListener('click', () => openHabitEditSheet(h));
      rows.appendChild(row);
    });

    root.querySelector('#add-habit-btn').addEventListener('click', () => openHabitEditSheet(null));
  }

  function openPilatesSheet(session) {
    openSheet(`
      <div class="sheet-title">Ciclo ${session.cycleNumber || 1} — Sessione ${session.sessionNumber}</div>
      <p class="muted">${session.date ? new Date(session.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Da programmare'}</p>
      <button class="btn-primary" id="mark-done">Mark completed</button>
      <button class="btn-secondary" id="mark-reschedule">Reschedule</button>
      <button class="btn-secondary" id="mark-close">Close</button>
    `, (sheet) => {
      sheet.querySelector('#mark-done').addEventListener('click', () => {
        DB.set(s => ({ ...s, pilates: { ...s.pilates, sessions: s.pilates.sessions.map(x => x.id === session.id ? { ...x, status: 'completed' } : x) } }));
        S.checkAndAdvancePilatesCycle();
        closeSheet(); S.render();
      });
      sheet.querySelector('#mark-reschedule').addEventListener('click', () => {
        const analyses = S.upcomingAnalyses(21);
        const slot = CalendarIntel.bestSlot(null, 60, [], analyses.filter(a => new Date(a.date) > new Date(session.date || Date.now())));
        const newDate = slot ? slot.day.date : new Date(Date.now() + 4 * 86400000);
        DB.set(s => ({ ...s, pilates: { ...s.pilates, sessions: s.pilates.sessions.map(x => x.id === session.id ? { ...x, status: 'scheduled', date: newDate.toISOString() } : x) } }));
        closeSheet(); S.render();
      });
      sheet.querySelector('#mark-close').addEventListener('click', closeSheet);
    });
  }

  function openHabitEditSheet(habit) {
    const isNew = !habit;
    const h = habit || { id: 'h-' + Date.now(), name: '', area: 'Routine', timesPerWeek: 1, estimatedMinutes: 20, priority: 2, active: true };
    openSheet(`
      <div class="sheet-title">${isNew ? 'New habit' : 'Edit habit'}</div>
      <div class="form-row"><label class="form-label">Name</label><input class="input-field" id="f-name" value="${h.name}"></div>
      <div class="form-row"><label class="form-label">Area</label>
        <select class="input-field" id="f-area">${HabitEngine.AREAS.map(a => `<option ${a===h.area?'selected':''}>${a}</option>`).join('')}</select>
      </div>
      <div class="form-row"><label class="form-label">Times per week</label><input type="number" min="1" max="7" class="input-field" id="f-freq" value="${h.timesPerWeek}"></div>
      <div class="form-row"><label class="form-label">Estimated minutes</label><input type="number" class="input-field" id="f-min" value="${h.estimatedMinutes}"></div>
      <button class="btn-primary" id="save-habit">Save</button>
      ${!isNew ? '<button class="btn-secondary" id="delete-habit">Delete</button>' : ''}
    `, (sheet) => {
      sheet.querySelector('#save-habit').addEventListener('click', () => {
        const updated = {
          ...h,
          name: sheet.querySelector('#f-name').value || h.name,
          area: sheet.querySelector('#f-area').value,
          timesPerWeek: +sheet.querySelector('#f-freq').value,
          estimatedMinutes: +sheet.querySelector('#f-min').value,
        };
        DB.set(s => {
          const habits = s.habits.length ? s.habits : HabitEngine.defaultHabits();
          const exists = habits.some(x => x.id === updated.id);
          return { ...s, habits: exists ? habits.map(x => x.id === updated.id ? updated : x) : [...habits, updated] };
        });
        closeSheet(); S.render();
      });
      const del = sheet.querySelector('#delete-habit');
      if (del) del.addEventListener('click', () => {
        DB.set(s => ({ ...s, habits: s.habits.filter(x => x.id !== h.id) }));
        closeSheet(); S.render();
      });
    });
  }

  // ================= INSIGHTS =================
  function renderInsights(root) {
    const db = S.getDB();
    const records = Object.entries(db.dayRecords || {}).sort((a,b) => a[0].localeCompare(b[0]));
    const last30 = records.slice(-30);

    root.appendChild(el(`
      <div>
        <div class="card">
          <div class="section-label">Consistency streak</div>
          <div class="hero-days" style="font-size:32px">${db.streak.current}</div>
          <div class="muted small">Best: ${db.streak.best} &middot; Flex days available: ${db.streak.flexDays}</div>
        </div>
        <div class="card">
          <div class="section-label">Last 30 days</div>
          <div id="bars" style="display:flex; align-items:flex-end; gap:3px; height:80px;"></div>
        </div>
        <div class="card">
          <div class="section-label">Patterns</div>
          <div id="patterns"></div>
        </div>
      </div>
    `));

    const bars = root.querySelector('#bars');
    if (last30.length === 0) {
      bars.appendChild(el(`<div class="muted small">Nessun dato ancora — inizia a completare le priorità di oggi.</div>`));
    } else {
      last30.forEach(([, r]) => {
        const h = Math.max(4, (r.score || 0) / 100 * 80);
        const color = r.minimumDayAchieved ? 'var(--success)' : 'var(--stroke)';
        bars.appendChild(el(`<div style="flex:1; height:${h}px; background:${color}; border-radius:3px;"></div>`));
      });
    }

    const patterns = root.querySelector('#patterns');
    const habits = db.habits.length ? db.habits : HabitEngine.defaultHabits();
    let any = false;
    habits.forEach(h => {
      const weak = HabitEngine.weakestWeekday(db.skipTracking, h.id);
      if (weak !== null) {
        any = true;
        patterns.appendChild(el(`<p class="muted small">${HabitEngine.WEEKDAY_NAMES[weak]} doesn't seem to work for "${h.name}".</p>`));
      }
    });
    if (!any) patterns.appendChild(el(`<p class="muted small">Non ci sono ancora abbastanza dati per riconoscere pattern. Continua a registrare i tuoi giorni.</p>`));
  }

  // ================= SETTINGS =================
  function renderSettings(root) {
    const db = S.getDB();
    root.appendChild(el(`
      <div>
        <div class="card">
          <div class="section-label">Journey</div>
          <div class="form-row"><label class="form-label">Target date</label>
            <input type="date" class="input-field" id="s-target" value="${S.isoDay(new Date(db.settings.targetDate))}">
          </div>
        </div>

        <div class="card">
          <div class="section-label">Calendar</div>
          <p class="muted small">Eventi importati: ${db.calendarEvents.length}</p>
          <label class="btn-secondary" for="settings-ics-input">Import .ics</label>
          <input type="file" id="settings-ics-input" accept=".ics" class="hidden">
          <div id="settings-ics-status" class="muted small" style="margin-top:6px"></div>
        </div>

        <div class="card">
          <div class="section-label">Notifications</div>
          <p class="muted small">Su iPhone, le notifiche push funzionano solo dopo aver aggiunto l'app alla schermata Home (iOS 16.4+) e richiedono di aprirla periodicamente. Qui sotto puoi attivarle se il tuo iPhone le supporta.</p>
          <button class="btn-secondary" id="enable-notifications">Enable notifications</button>
          <div id="notif-status" class="muted small" style="margin-top:6px">${Notification && Notification.permission ? 'Stato: ' + Notification.permission : ''}</div>
        </div>

        <div class="card">
          <div class="section-label">Data</div>
          <button class="btn-secondary" id="export-data">Export data (JSON)</button>
          <button class="btn-secondary" id="reset-data" style="color:var(--danger); margin-top:8px;">Reset all data</button>
        </div>
      </div>
    `));

    root.querySelector('#s-target').addEventListener('change', (e) => {
      DB.set(s => ({ ...s, settings: { ...s.settings, targetDate: new Date(e.target.value + 'T00:00:00').toISOString() } }));
    });

    root.querySelector('#settings-ics-input').addEventListener('change', S.handleICSImport);

    root.querySelector('#enable-notifications').addEventListener('click', async () => {
      const statusEl = root.querySelector('#notif-status');
      if (!('Notification' in window)) { statusEl.textContent = 'Le notifiche non sono supportate in questo contesto.'; return; }
      const perm = await Notification.requestPermission();
      statusEl.textContent = 'Stato: ' + perm;
    });

    root.querySelector('#export-data').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = '13april-backup.json'; a.click();
      URL.revokeObjectURL(url);
    });

    root.querySelector('#reset-data').addEventListener('click', () => {
      openSheet(`
        <div class="sheet-title">Reset all data?</div>
        <p class="muted">Questa azione cancella tutti i dati salvati sul dispositivo. Non può essere annullata.</p>
        <button class="btn-primary" id="confirm-reset" style="background:var(--danger)">Reset</button>
        <button class="btn-secondary" id="cancel-reset">Cancel</button>
      `, (sheet) => {
        sheet.querySelector('#confirm-reset').addEventListener('click', () => {
          DB.reset(); closeSheet(); location.reload();
        });
        sheet.querySelector('#cancel-reset').addEventListener('click', closeSheet);
      });
    });
  }

  window.__ta_screens = { renderToday, renderJourney, renderHabits, renderInsights, renderSettings };
  // patch the renderer map used in app.js
  const originalRender = window.__ta_shared.render;
})();
