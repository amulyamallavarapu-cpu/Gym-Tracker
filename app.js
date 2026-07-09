/* ==========================================================================
   GYM TRACKER — app logic
   ========================================================================== */

const STORAGE_KEY = "gymtracker_v1";
const LEGACY_STORAGE_KEY = "ironlog_v1"; // migrate anyone who used the app before the rename

let state = loadState();
let ui = {
  activeView: "today",
  activeDayId: state.currentDayId || state.program[0].id,
  swapTarget: null,   // { dayId, exId }
  editTarget: null,   // { dayId, exId }
  openHistoryId: null,
  charts: {}
};

function loadState(){
  let loaded = null;
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(parsed && parsed.program) loaded = parsed;
    }
    if(!loaded){
      // migrate anyone who has data under the old IronLog key
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if(legacyRaw){
        const legacyParsed = JSON.parse(legacyRaw);
        if(legacyParsed && legacyParsed.program){
          localStorage.setItem(STORAGE_KEY, legacyRaw);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          loaded = legacyParsed;
        }
      }
    }
  }catch(e){ console.warn("Could not read saved data", e); }

  if(!loaded){
    loaded = {
      program: defaultProgram(),
      history: [],
      currentDayId: null,
      draftsByDay: {}
    };
  }
  if(!loaded.dailyLogs) loaded.dailyLogs = {};
  return loaded;
}

function sortHistoryDesc(){
  state.history.sort((a, b) => new Date(b.date) - new Date(a.date));
}

function dateKeyFromInput(dateStr){
  // dateStr is 'YYYY-MM-DD' from an <input type="date">
  return dateStr;
}

function isoAtNoonFromDateInput(dateStr){
  return new Date(dateStr + "T12:00:00").toISOString();
}

function todayDateInputValue(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function saveState(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }catch(e){ console.warn("Could not save data", e); }
  scheduleCloudSync();
}

function findDay(dayId){ return state.program.find(d => d.id === dayId); }
function findExercise(dayId, exId){
  const day = findDay(dayId);
  return day ? day.exercises.find(e => e.id === exId) : null;
}

function getDraft(dayId, exId, targetSets, timed){
  if(!state.draftsByDay[dayId]) state.draftsByDay[dayId] = {};
  if(!state.draftsByDay[dayId][exId]){
    state.draftsByDay[dayId][exId] = Array.from({length: targetSets}, () => ({weight:"", reps: timed ? "1" : ""}));
  }
  return state.draftsByDay[dayId][exId];
}

/* ---------------------------------------------------------------------- */
/* TOAST                                                                   */
/* ---------------------------------------------------------------------- */
function toast(msg){
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("is-visible");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("is-visible"), 2200);
}

/* ---------------------------------------------------------------------- */
/* TAB NAVIGATION                                                          */
/* ---------------------------------------------------------------------- */
function switchView(view){
  ui.activeView = view;
  document.querySelectorAll(".view").forEach(v => v.hidden = true);
  document.getElementById("view-" + view).hidden = false;
  document.querySelectorAll(".tab-btn").forEach(b => {
    b.classList.toggle("is-active", b.dataset.view === view);
  });
  if(view === "today") renderToday();
  if(view === "stats") renderStats();
  if(view === "program") renderProgram();
  if(view === "history") renderHistory();
}

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

/* ---------------------------------------------------------------------- */
/* TODAY VIEW                                                              */
/* ---------------------------------------------------------------------- */
function renderDaySwitcher(){
  const wrap = document.getElementById("daySwitcher");
  wrap.innerHTML = "";
  state.program.forEach(day => {
    const chip = document.createElement("button");
    chip.className = "day-chip" + (day.id === ui.activeDayId ? " is-active" : "");
    chip.style.setProperty("--chip-color", `var(--${day.plate})`);
    chip.style.setProperty("--chip-dim", `var(--${day.plate}-dim)`);
    chip.innerHTML = `<span class="dot plate-${day.plate}-dot"></span>${day.name}`;
    chip.addEventListener("click", () => {
      ui.activeDayId = day.id;
      state.currentDayId = day.id;
      saveState();
      renderToday();
    });
    wrap.appendChild(chip);
  });
}

function updateStreakBadge(){
  document.getElementById("streakCount").textContent = computeStreak();
}

function getLastPerformance(exerciseName){
  // state.history is newest-first, so the first match is the most recent session
  for(const sess of state.history){
    const found = sess.exercises.find(e => e.name === exerciseName);
    if(found && found.sets && found.sets.length) return found.sets;
  }
  return null;
}

function renderToday(){
  updateStreakBadge();
  renderDaySwitcher();
  const day = findDay(ui.activeDayId);
  document.getElementById("dayPicker").textContent = day.name;

  const list = document.getElementById("exerciseList");
  list.innerHTML = "";

  let totalSets = 0, completeSets = 0;

  day.exercises.forEach(ex => {
    const draft = getDraft(day.id, ex.id, ex.sets, ex.timed);
    totalSets += draft.length;
    completeSets += draft.filter(s => s.weight !== "" && s.reps !== "").length;

    const card = document.createElement("div");
    const allDone = draft.length > 0 && draft.every(s => s.weight !== "" && s.reps !== "");
    card.className = "ex-card" + (allDone ? " is-done" : "");

    card.innerHTML = `
      <div class="ex-card-head">
        <div class="ex-name-wrap">
          <span class="ex-name">${ex.name}</span>
          <span class="ex-target">TARGET ${ex.sets} × ${ex.reps}${ex.timed ? "" : ""}</span>
        </div>
        <div class="ex-actions">
          <button class="icon-btn" data-action="edit" title="Edit targets"><svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <button class="icon-btn" data-action="swap" title="Swap exercise">⇄</button>
        </div>
      </div>
      <div class="set-labels">
        <span>#</span><span>${ex.timed ? "SECONDS" : "WEIGHT"}</span><span>${ex.timed ? "—" : "REPS"}</span><span></span>
      </div>
      <div class="set-rows" data-ex="${ex.id}"></div>
      <button class="add-set-btn" data-action="add-set">+ Add set</button>
    `;

    const rowsWrap = card.querySelector(".set-rows");
    const lastSets = getLastPerformance(ex.name);
    draft.forEach((s, idx) => {
      const row = document.createElement("div");
      row.className = "set-row";
      const lastSet = lastSets && lastSets[idx];
      const weightPlaceholder = lastSet ? String(lastSet.weight) : (ex.timed ? "sec" : "kg");
      const repsPlaceholder = ex.timed ? "—" : (lastSet ? String(lastSet.reps) : "reps");
      row.innerHTML = `
        <span class="set-idx">${idx + 1}</span>
        <input type="number" inputmode="decimal" placeholder="${weightPlaceholder}" value="${s.weight}" data-field="weight" data-idx="${idx}">
        <input type="number" inputmode="numeric" placeholder="${repsPlaceholder}" value="${s.reps}" data-field="reps" data-idx="${idx}" ${ex.timed ? "disabled" : ""}>
        <button class="set-remove" data-action="remove-set" data-idx="${idx}">✕</button>
      `;
      if(ex.timed){
        row.querySelector('[data-field="reps"]').value = "1";
      }
      rowsWrap.appendChild(row);
    });

    // input events
    rowsWrap.querySelectorAll("input").forEach(inp => {
      inp.addEventListener("input", () => {
        const idx = Number(inp.dataset.idx);
        const field = inp.dataset.field;
        draft[idx][field] = inp.value;
        saveState();
        updateProgressRing();
        card.classList.toggle("is-done", draft.every(s => s.weight !== "" && s.reps !== ""));
      });
    });
    rowsWrap.querySelectorAll('[data-action="remove-set"]').forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        draft.splice(idx, 1);
        saveState();
        renderToday();
      });
    });

    card.querySelector('[data-action="add-set"]').addEventListener("click", () => {
      draft.push({weight:"", reps: ex.timed ? "1" : ""});
      saveState();
      renderToday();
    });
    card.querySelector('[data-action="swap"]').addEventListener("click", () => openSwapModal(day.id, ex.id));
    card.querySelector('[data-action="edit"]').addEventListener("click", () => openEditModal(day.id, ex.id));

    list.appendChild(card);
  });

  document.getElementById("setsCompleteCount").textContent = completeSets;
  document.getElementById("setsTotalCount").textContent = totalSets;
  updateProgressRing();
}

function updateProgressRing(){
  const day = findDay(ui.activeDayId);
  let total = 0, done = 0;
  day.exercises.forEach(ex => {
    const draft = getDraft(day.id, ex.id, ex.sets, ex.timed);
    total += draft.length;
    done += draft.filter(s => s.weight !== "" && s.reps !== "").length;
  });
  document.getElementById("setsCompleteCount").textContent = done;
  document.getElementById("setsTotalCount").textContent = total;
  const circumference = 2 * Math.PI * 40;
  const pct = total > 0 ? done / total : 0;
  const offset = circumference * (1 - pct);
  const ring = document.getElementById("ringFill");
  ring.style.strokeDasharray = circumference;
  ring.style.strokeDashoffset = offset;

  const card = document.getElementById("plateProgressCard");
  card.style.setProperty("--chip-color", `var(--${day.plate})`);
  card.style.setProperty("--chip-dim", `var(--${day.plate}-dim)`);

  const titleEl = card.querySelector(".ppc-title");
  const subEl = card.querySelector(".ppc-sub");
  if(total > 0 && done === total){
    titleEl.textContent = "All done! 🎉";
    subEl.textContent = "Hit finish to save this session";
  } else if(done > 0){
    titleEl.textContent = "Keep going!";
    subEl.textContent = `${total - done} set${total - done === 1 ? "" : "s"} left`;
  } else {
    titleEl.textContent = "Ready?";
    subEl.textContent = "Log each set as you finish it";
  }
}

document.getElementById("finishSessionBtn").addEventListener("click", finishSession);

function finishSession(){
  const day = findDay(ui.activeDayId);
  const loggedExercises = [];
  day.exercises.forEach(ex => {
    const draft = getDraft(day.id, ex.id, ex.sets, ex.timed);
    const validSets = draft
      .filter(s => s.weight !== "" && s.reps !== "")
      .map(s => ({ weight: parseFloat(s.weight), reps: parseFloat(s.reps) }));
    if(validSets.length > 0){
      loggedExercises.push({ name: ex.name, sets: validSets, timed: !!ex.timed });
    }
  });

  if(loggedExercises.length === 0){
    toast("Log at least one set before finishing");
    return;
  }

  const session = {
    id: uid("sess"),
    dayId: day.id,
    dayName: day.name,
    plate: day.plate,
    date: new Date().toISOString(),
    exercises: loggedExercises
  };
  state.history.unshift(session);
  sortHistoryDesc();
  state.draftsByDay[day.id] = {};
  saveState();
  toast("Session saved 🏁");
  renderToday();
}

/* ---------------------------------------------------------------------- */
/* SWAP MODAL                                                              */
/* ---------------------------------------------------------------------- */
function openSwapModal(dayId, exId){
  ui.swapTarget = { dayId, exId };
  const ex = findExercise(dayId, exId);
  const options = getSwapOptions(ex.name);
  const wrap = document.getElementById("swapOptions");
  wrap.innerHTML = "";
  options.forEach(name => {
    const btn = document.createElement("button");
    btn.className = "swap-option" + (name === ex.name ? " is-current" : "");
    btn.textContent = name;
    btn.addEventListener("click", () => applySwap(name));
    wrap.appendChild(btn);
  });
  document.getElementById("customExerciseInput").value = "";
  document.getElementById("swapModalBackdrop").hidden = false;
}
function closeSwapModal(){ document.getElementById("swapModalBackdrop").hidden = true; ui.swapTarget = null; }
document.getElementById("closeSwapModal").addEventListener("click", closeSwapModal);
document.getElementById("swapModalBackdrop").addEventListener("click", e => { if(e.target.id === "swapModalBackdrop") closeSwapModal(); });

function applySwap(newName){
  const { dayId, exId } = ui.swapTarget;
  const ex = findExercise(dayId, exId);
  const oldDraft = state.draftsByDay[dayId] && state.draftsByDay[dayId][exId];
  ex.name = newName;
  // reset in-progress draft for this slot since exercise changed
  if(oldDraft) delete state.draftsByDay[dayId][exId];
  saveState();
  closeSwapModal();
  toast(`Swapped in ${newName}`);
  if(ui.activeView === "today") renderToday();
  if(ui.activeView === "program") renderProgram();
}

document.getElementById("addCustomExercise").addEventListener("click", () => {
  const input = document.getElementById("customExerciseInput");
  const val = input.value.trim();
  if(!val) return;
  applySwap(val);
});

/* ---------------------------------------------------------------------- */
/* EDIT TARGETS MODAL                                                      */
/* ---------------------------------------------------------------------- */
function openEditModal(dayId, exId){
  ui.editTarget = { dayId, exId };
  const ex = findExercise(dayId, exId);
  document.getElementById("editSetsInput").value = ex.sets;
  document.getElementById("editRepsInput").value = ex.reps;
  document.getElementById("editModalBackdrop").hidden = false;
}
function closeEditModal(){ document.getElementById("editModalBackdrop").hidden = true; ui.editTarget = null; }
document.getElementById("closeEditModal").addEventListener("click", closeEditModal);
document.getElementById("editModalBackdrop").addEventListener("click", e => { if(e.target.id === "editModalBackdrop") closeEditModal(); });

document.getElementById("saveEditTargets").addEventListener("click", () => {
  const { dayId, exId } = ui.editTarget;
  const ex = findExercise(dayId, exId);
  const newSets = Math.max(1, parseInt(document.getElementById("editSetsInput").value) || ex.sets);
  const newReps = document.getElementById("editRepsInput").value.trim() || ex.reps;
  ex.sets = newSets;
  ex.reps = newReps;
  // adjust draft length if it exists
  const draft = state.draftsByDay[dayId] && state.draftsByDay[dayId][exId];
  if(draft){
    while(draft.length < newSets) draft.push({weight:"", reps:""});
    while(draft.length > newSets) draft.pop();
  }
  saveState();
  closeEditModal();
  if(ui.activeView === "today") renderToday();
  if(ui.activeView === "program") renderProgram();
});

/* ---------------------------------------------------------------------- */
/* PROGRAM VIEW                                                            */
/* ---------------------------------------------------------------------- */
function renderProgram(){
  const wrap = document.getElementById("programList");
  wrap.innerHTML = "";
  state.program.forEach(day => {
    const block = document.createElement("div");
    block.className = "program-day";
    block.style.setProperty("--chip-dim", `var(--${day.plate}-dim)`);
    block.innerHTML = `
      <div class="program-day-head">
        <span class="dot plate-${day.plate}-dot"></span>
        <h3>${day.name}</h3>
      </div>
      <div class="program-ex-body"></div>
    `;
    const body = block.querySelector(".program-ex-body");
    day.exercises.forEach(ex => {
      const row = document.createElement("div");
      row.className = "program-ex-row";
      row.innerHTML = `
        <div class="program-ex-info">
          <span class="pname">${ex.name}</span>
          <span class="ptarget">${ex.sets} × ${ex.reps}</span>
        </div>
        <div class="program-ex-btns">
          <button class="icon-btn" data-action="edit" title="Edit targets"><svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <button class="icon-btn" data-action="swap" title="Swap exercise">⇄</button>
        </div>
      `;
      row.querySelector('[data-action="edit"]').addEventListener("click", () => openEditModal(day.id, ex.id));
      row.querySelector('[data-action="swap"]').addEventListener("click", () => openSwapModal(day.id, ex.id));
      body.appendChild(row);
    });
    wrap.appendChild(block);
  });
}

/* ---------------------------------------------------------------------- */
/* HISTORY VIEW                                                            */
/* ---------------------------------------------------------------------- */
const ACTIVITY_ICONS = {
  Swimming: "🏊", Running: "🏃", Jogging: "🏃", Cycling: "🚴", Walking: "🚶", Yoga: "🧘", Other: "⚡"
};

function getHistoryItems(){
  const items = [];
  state.history.forEach(sess => items.push({ kind: "session", date: sess.date, data: sess }));
  Object.keys(state.dailyLogs || {}).forEach(dateKey => {
    const log = state.dailyLogs[dateKey];
    if(log && (log.steps || (log.activities && log.activities.length))){
      items.push({ kind: "activity", date: dateKey + "T12:00:00", data: log, dateKey });
    }
  });
  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  return items;
}

function renderHistory(){
  const wrap = document.getElementById("historyList");
  wrap.innerHTML = "";

  const items = getHistoryItems();

  if(items.length === 0){
    wrap.innerHTML = `
      <div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.5"/></svg>
        <p>Nothing logged yet.<br>Finish a workout on the Today tab, or tap "+ Log an entry" above.</p>
      </div>`;
    return;
  }

  items.forEach(item => {
    if(item.kind === "session") wrap.appendChild(buildSessionCard(item.data));
    else wrap.appendChild(buildActivityCard(item.data, item.dateKey));
  });
}

function buildSessionCard(sess){
  const card = document.createElement("div");
  card.className = "history-card";
  const dateStr = new Date(sess.date).toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" });
  const isOpen = ui.openHistoryId === sess.id;

  const totalVolume = sess.exercises.reduce((sum, ex) => sum + ex.sets.reduce((s2, s) => s2 + (ex.timed ? 0 : s.weight * s.reps), 0), 0);

  card.innerHTML = `
    <div class="history-card-head" data-action="toggle">
      <div class="hc-left">
        <span class="dot plate-${sess.plate}-dot"></span>
        <h4>${sess.dayName}</h4>
      </div>
      <span class="history-date">${dateStr}</span>
    </div>
    <div class="history-detail ${isOpen ? "is-open" : ""}">
      ${sess.exercises.map(ex => `
        <div class="history-ex-line">
          <span>${ex.name}</span>
          <span class="hex-sets">${ex.sets.map(s => ex.timed ? `${s.weight}s` : `${s.weight}kg×${s.reps}`).join(", ")}</span>
        </div>
      `).join("")}
      <div class="history-ex-line"><span class="muted">Total volume</span><span class="hex-sets">${Math.round(totalVolume)} kg</span></div>
      <button class="history-delete" data-action="delete">Delete session</button>
    </div>
  `;
  card.querySelector('[data-action="toggle"]').addEventListener("click", () => {
    ui.openHistoryId = isOpen ? null : sess.id;
    renderHistory();
  });
  card.querySelector('[data-action="delete"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    state.history = state.history.filter(s => s.id !== sess.id);
    saveState();
    renderHistory();
  });
  return card;
}

function buildActivityCard(log, dateKey){
  const card = document.createElement("div");
  card.className = "history-card";
  const syntheticId = "activity_" + dateKey;
  const isOpen = ui.openHistoryId === syntheticId;
  const dateStr = new Date(dateKey + "T12:00:00").toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" });

  const activityLines = (log.activities || []).map(a => `
    <div class="history-ex-line">
      <span>${ACTIVITY_ICONS[a.type] || "⚡"} ${a.type}</span>
      <span class="hex-sets">${a.duration} min${a.distance ? " · " + a.distance + " km" : ""}</span>
    </div>
  `).join("");

  card.innerHTML = `
    <div class="history-card-head" data-action="toggle">
      <div class="hc-left">
        <span class="dot plate-sage-dot"></span>
        <h4>Steps & Activity</h4>
      </div>
      <span class="history-date">${dateStr}</span>
    </div>
    <div class="history-detail ${isOpen ? "is-open" : ""}">
      ${log.steps ? `<div class="history-ex-line"><span>Steps</span><span class="hex-sets">${Number(log.steps).toLocaleString()}</span></div>` : ""}
      ${activityLines}
      <button class="history-delete" data-action="delete">Delete entry</button>
    </div>
  `;
  card.querySelector('[data-action="toggle"]').addEventListener("click", () => {
    ui.openHistoryId = isOpen ? null : syntheticId;
    renderHistory();
  });
  card.querySelector('[data-action="delete"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    delete state.dailyLogs[dateKey];
    saveState();
    renderHistory();
  });
  return card;
}

/* ---------------------------------------------------------------------- */
/* LOG ENTRY MODAL (past workouts + steps/activities)                     */
/* ---------------------------------------------------------------------- */
const ACTIVITY_TYPES = ["Swimming", "Running", "Jogging", "Cycling", "Walking", "Yoga", "Other"];

let logEntryState = { type: "workout", workoutDayId: null, workoutSets: {}, activities: [] };

function openLogEntryModal(){
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateInputVal = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,"0")}-${String(yesterday.getDate()).padStart(2,"0")}`;

  logEntryState = { type: "workout", workoutDayId: state.program[0].id, workoutSets: {}, activities: [] };
  document.getElementById("logEntryDate").value = dateInputVal;

  const daySelect = document.getElementById("logEntryDaySelect");
  daySelect.innerHTML = state.program.map(d => `<option value="${d.id}">${d.name}</option>`).join("");
  daySelect.value = logEntryState.workoutDayId;
  renderLogEntryWorkoutExercises();

  document.getElementById("logEntrySteps").value = "";
  logEntryState.activities = [];
  addLogEntryActivityRow();

  setLogEntryType("workout");
  document.getElementById("logEntryModalBackdrop").hidden = false;
}

function closeLogEntryModal(){
  document.getElementById("logEntryModalBackdrop").hidden = true;
}

function setLogEntryType(type){
  logEntryState.type = type;
  document.querySelectorAll("#logEntryTypeToggle .segmented-btn").forEach(btn => {
    btn.classList.toggle("is-active", btn.dataset.type === type);
  });
  document.getElementById("logEntryWorkoutSection").hidden = type !== "workout";
  document.getElementById("logEntryActivitySection").hidden = type !== "activity";
}

function renderLogEntryWorkoutExercises(){
  const day = findDay(logEntryState.workoutDayId);
  const wrap = document.getElementById("logEntryExerciseList");
  wrap.innerHTML = "";
  day.exercises.forEach(ex => {
    logEntryState.workoutSets[ex.id] = [{ weight: "", reps: ex.timed ? "1" : "" }];
    const block = document.createElement("div");
    block.className = "log-entry-exercise";
    block.innerHTML = `
      <span class="le-name">${ex.name}</span>
      <div class="set-rows" data-ex="${ex.id}"></div>
      <button class="add-set-btn" data-action="add-set" data-ex="${ex.id}" type="button">+ Add set</button>
    `;
    wrap.appendChild(block);
    renderLogEntrySetRows(ex);
    block.querySelector('[data-action="add-set"]').addEventListener("click", () => {
      logEntryState.workoutSets[ex.id].push({ weight: "", reps: ex.timed ? "1" : "" });
      renderLogEntrySetRows(ex);
    });
  });
}

function renderLogEntrySetRows(ex){
  const rowsWrap = document.querySelector(`#logEntryExerciseList .set-rows[data-ex="${ex.id}"]`);
  const sets = logEntryState.workoutSets[ex.id];
  rowsWrap.innerHTML = "";
  sets.forEach((s, idx) => {
    const row = document.createElement("div");
    row.className = "set-row";
    row.innerHTML = `
      <span class="set-idx">${idx + 1}</span>
      <input type="number" inputmode="decimal" placeholder="${ex.timed ? "sec" : "kg"}" value="${s.weight}" data-field="weight" data-idx="${idx}">
      <input type="number" inputmode="numeric" placeholder="${ex.timed ? "—" : "reps"}" value="${s.reps}" data-field="reps" data-idx="${idx}" ${ex.timed ? "disabled" : ""}>
      <button class="set-remove" data-action="remove-set" data-idx="${idx}" type="button">✕</button>
    `;
    rowsWrap.appendChild(row);
    row.querySelectorAll("input").forEach(inp => {
      inp.addEventListener("input", () => {
        sets[Number(inp.dataset.idx)][inp.dataset.field] = inp.value;
      });
    });
    row.querySelector('[data-action="remove-set"]').addEventListener("click", () => {
      sets.splice(idx, 1);
      renderLogEntrySetRows(ex);
    });
  });
}

function addLogEntryActivityRow(){
  logEntryState.activities.push({ id: uid("act"), type: "Swimming", duration: "", distance: "" });
  renderLogEntryActivities();
}

function renderLogEntryActivities(){
  const wrap = document.getElementById("logEntryActivitiesList");
  wrap.innerHTML = "";
  logEntryState.activities.forEach(act => {
    const row = document.createElement("div");
    row.className = "activity-row";
    row.innerHTML = `
      <select data-field="type" data-id="${act.id}">
        ${ACTIVITY_TYPES.map(t => `<option value="${t}" ${act.type === t ? "selected" : ""}>${t}</option>`).join("")}
      </select>
      <input type="number" inputmode="numeric" placeholder="min" value="${act.duration}" data-field="duration" data-id="${act.id}">
      <input type="number" inputmode="decimal" placeholder="km" value="${act.distance}" data-field="distance" data-id="${act.id}">
      <button class="set-remove" data-action="remove-activity" data-id="${act.id}" type="button">✕</button>
    `;
    wrap.appendChild(row);
  });
  wrap.querySelectorAll("select, input").forEach(el => {
    const evt = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(evt, () => {
      const act = logEntryState.activities.find(a => a.id === el.dataset.id);
      if(act) act[el.dataset.field] = el.value;
    });
  });
  wrap.querySelectorAll('[data-action="remove-activity"]').forEach(btn => {
    btn.addEventListener("click", () => {
      logEntryState.activities = logEntryState.activities.filter(a => a.id !== btn.dataset.id);
      renderLogEntryActivities();
    });
  });
}

document.getElementById("openLogEntryModal").addEventListener("click", openLogEntryModal);
document.getElementById("closeLogEntryModal").addEventListener("click", closeLogEntryModal);
document.getElementById("logEntryModalBackdrop").addEventListener("click", e => {
  if(e.target.id === "logEntryModalBackdrop") closeLogEntryModal();
});
document.querySelectorAll("#logEntryTypeToggle .segmented-btn").forEach(btn => {
  btn.addEventListener("click", () => setLogEntryType(btn.dataset.type));
});
document.getElementById("logEntryDaySelect").addEventListener("change", (e) => {
  logEntryState.workoutDayId = e.target.value;
  renderLogEntryWorkoutExercises();
});
document.getElementById("addActivityRowBtn").addEventListener("click", addLogEntryActivityRow);

document.getElementById("saveLogEntryBtn").addEventListener("click", () => {
  const dateVal = document.getElementById("logEntryDate").value;
  if(!dateVal){ toast("Pick a date first"); return; }

  if(logEntryState.type === "workout"){
    const day = findDay(logEntryState.workoutDayId);
    const loggedExercises = [];
    day.exercises.forEach(ex => {
      const sets = logEntryState.workoutSets[ex.id] || [];
      const validSets = sets
        .filter(s => s.weight !== "" && s.reps !== "")
        .map(s => ({ weight: parseFloat(s.weight), reps: parseFloat(s.reps) }));
      if(validSets.length > 0){
        loggedExercises.push({ name: ex.name, sets: validSets, timed: !!ex.timed });
      }
    });
    if(loggedExercises.length === 0){
      toast("Log at least one set");
      return;
    }
    const session = {
      id: uid("sess"),
      dayId: day.id,
      dayName: day.name,
      plate: day.plate,
      date: isoAtNoonFromDateInput(dateVal),
      exercises: loggedExercises
    };
    state.history.push(session);
    sortHistoryDesc();
    saveState();
    closeLogEntryModal();
    toast("Workout logged 📝");
    if(ui.activeView === "history") renderHistory();
    if(ui.activeView === "stats") renderStats();
  } else {
    const stepsVal = document.getElementById("logEntrySteps").value;
    const activities = logEntryState.activities
      .filter(a => a.duration !== "" && a.duration !== undefined && a.duration !== null)
      .map(a => ({ type: a.type, duration: parseFloat(a.duration), distance: a.distance ? parseFloat(a.distance) : null }));

    if(!stepsVal && activities.length === 0){
      toast("Add steps or at least one activity");
      return;
    }
    state.dailyLogs[dateVal] = {
      steps: stepsVal ? parseInt(stepsVal, 10) : null,
      activities
    };
    saveState();
    closeLogEntryModal();
    toast("Entry logged 📝");
    if(ui.activeView === "history") renderHistory();
  }
});

/* ---------------------------------------------------------------------- */
/* STATS VIEW                                                              */
/* ---------------------------------------------------------------------- */
function computeStreak(){
  if(state.history.length === 0) return 0;
  const days = new Set(state.history.map(s => new Date(s.date).toDateString()));
  let streak = 0;
  let cursor = new Date();
  // allow today to be "unlogged yet" without breaking streak
  if(!days.has(cursor.toDateString())){
    cursor.setDate(cursor.getDate() - 1);
  }
  while(days.has(cursor.toDateString())){
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function computeStats(){
  const totalWorkouts = state.history.length;
  const now = new Date();
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
  const thisWeek = state.history.filter(s => new Date(s.date) >= weekAgo).length;
  const totalVolume = state.history.reduce((sum, sess) =>
    sum + sess.exercises.reduce((s2, ex) => s2 + ex.sets.reduce((s3, s) => s3 + (ex.timed ? 0 : s.weight * s.reps), 0), 0), 0);
  const streak = computeStreak();
  return { totalWorkouts, thisWeek, totalVolume, streak };
}

function computePRs(){
  const prs = {};
  state.history.forEach(sess => {
    sess.exercises.forEach(ex => {
      if(ex.timed) return;
      ex.sets.forEach(s => {
        const oneRM = s.weight * (1 + s.reps / 30); // Epley
        if(!prs[ex.name] || oneRM > prs[ex.name].oneRM){
          prs[ex.name] = { oneRM, weight: s.weight, reps: s.reps };
        }
      });
    });
  });
  return prs;
}

function getAllExerciseNames(){
  const seen = new Set();
  const ordered = [];
  // state.history is newest-first, so this naturally orders by most recently logged
  state.history.forEach(sess => sess.exercises.forEach(ex => {
    if(!ex.timed && !seen.has(ex.name)){
      seen.add(ex.name);
      ordered.push(ex.name);
    }
  }));
  return ordered;
}

function renderStats(){
  const { totalWorkouts, thisWeek, totalVolume, streak } = computeStats();
  document.getElementById("streakCount").textContent = streak;

  const grid = document.getElementById("statGrid");
  grid.innerHTML = `
    <div class="stat-box"><span class="stat-num">${totalWorkouts}</span><span class="stat-label">Total sessions</span></div>
    <div class="stat-box"><span class="stat-num">${thisWeek}</span><span class="stat-label">This week</span></div>
    <div class="stat-box"><span class="stat-num">${streak}</span><span class="stat-label">Day streak</span></div>
    <div class="stat-box"><span class="stat-num">${Math.round(totalVolume/1000)}k</span><span class="stat-label">Total volume (kg)</span></div>
  `;

  renderVolumeChart();
  renderExerciseSelectAndChart();
  renderPRTable();
}

function renderVolumeChart(){
  const ctx = document.getElementById("volumeChart");
  const sessions = [...state.history].reverse().slice(-20);
  const labels = sessions.map(s => new Date(s.date).toLocaleDateString(undefined, {month:"short", day:"numeric"}));
  const data = sessions.map(s => Math.round(s.exercises.reduce((sum, ex) => sum + ex.sets.reduce((s2, st) => s2 + (ex.timed?0:st.weight*st.reps), 0), 0)));

  if(ui.charts.volume) ui.charts.volume.destroy();
  if(sessions.length === 0){
    ctx.parentElement.querySelector(".chart-empty")?.remove();
    return;
  }
  ui.charts.volume = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{
      data, borderColor: "#ef6f9b", backgroundColor: "rgba(239,111,155,0.22)",
      fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: "#ef6f9b"
    }]},
    options: chartBaseOptions()
  });
}

function renderExerciseSelectAndChart(){
  const select = document.getElementById("exerciseSelect");
  const names = getAllExerciseNames();
  const prevVal = select.value;

  if(names.length === 0){
    select.innerHTML = "";
    select.hidden = true;
    if(ui.charts.exercise) ui.charts.exercise.destroy();
    document.getElementById("exerciseChart").hidden = true;
    document.getElementById("exerciseHistoryTable").innerHTML =
      `<div class="empty-state"><p>Log a few sessions to start seeing progress here.</p></div>`;
    return;
  }

  select.hidden = false;
  document.getElementById("exerciseChart").hidden = false;
  select.innerHTML = names.map(n => `<option value="${n}">${n}</option>`).join("");
  select.value = names.includes(prevVal) ? prevVal : names[0];
  select.onchange = renderExerciseChart;
  renderExerciseChart();
}

function renderExerciseChart(){
  const ctx = document.getElementById("exerciseChart");
  const select = document.getElementById("exerciseSelect");
  const name = select.value;
  if(ui.charts.exercise) ui.charts.exercise.destroy();

  if(!name){
    return;
  }
  const points = [];
  const tableRows = []; // newest first, for the list below the chart
  [...state.history].reverse().forEach(sess => {
    sess.exercises.forEach(ex => {
      if(ex.name === name && !ex.timed && ex.sets.length){
        const top = Math.max(...ex.sets.map(s => s.weight));
        points.push({ date: new Date(sess.date), weight: top });
      }
    });
  });
  state.history.forEach(sess => {
    sess.exercises.forEach(ex => {
      if(ex.name === name && !ex.timed && ex.sets.length){
        tableRows.push({ date: new Date(sess.date), sets: ex.sets });
      }
    });
  });

  ui.charts.exercise = new Chart(ctx, {
    type: "line",
    data: {
      labels: points.map(p => p.date.toLocaleDateString(undefined, {month:"short", day:"numeric"})),
      datasets: [{
        data: points.map(p => p.weight),
        borderColor: "#7b87d9", backgroundColor: "rgba(183,192,240,0.35)",
        fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: "#7b87d9"
      }]
    },
    options: chartBaseOptions()
  });

  const tableWrap = document.getElementById("exerciseHistoryTable");
  tableWrap.innerHTML = tableRows.slice(0, 8).map(row => `
    <div class="pr-row">
      <span class="pr-name">${row.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
      <span class="pr-value">${row.sets.map(s => `${s.weight}×${s.reps}`).join(", ")}</span>
    </div>
  `).join("");
}

function chartBaseOptions(){
  return {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: "#8a8073", font: { family: "JetBrains Mono", size: 10 } }, grid: { color: "#f3e9db" } },
      y: { ticks: { color: "#8a8073", font: { family: "JetBrains Mono", size: 10 } }, grid: { color: "#f3e9db" } }
    }
  };
}

function renderPRTable(){
  const prs = computePRs();
  const wrap = document.getElementById("prTable");
  const names = Object.keys(prs);
  if(names.length === 0){
    wrap.innerHTML = `<div class="empty-state"><p>No records yet — log a session to start tracking.</p></div>`;
    return;
  }
  wrap.innerHTML = names.map(name => `
    <div class="pr-row">
      <span class="pr-name">${name}</span>
      <span class="pr-value">${prs[name].weight}kg × ${prs[name].reps} · est. ${Math.round(prs[name].oneRM)}kg</span>
    </div>
  `).join("");
}

/* ---------------------------------------------------------------------- */
/* BACKUP / RESTORE                                                        */
/* ---------------------------------------------------------------------- */
function openBackupModal(){
  renderSyncStatus();
  document.getElementById("backupModalBackdrop").hidden = false;
}
function closeBackupModal(){ document.getElementById("backupModalBackdrop").hidden = true; }
document.getElementById("openBackupModal").addEventListener("click", openBackupModal);
document.getElementById("closeBackupModal").addEventListener("click", closeBackupModal);
document.getElementById("backupModalBackdrop").addEventListener("click", e => { if(e.target.id === "backupModalBackdrop") closeBackupModal(); });

document.getElementById("exportDataBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `gym-tracker-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("Backup downloaded 📥");
});

document.getElementById("importDataBtn").addEventListener("click", () => {
  document.getElementById("importFileInput").click();
});

document.getElementById("importFileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try{
      const parsed = JSON.parse(evt.target.result);
      if(!parsed || !parsed.program || !Array.isArray(parsed.history)){
        toast("That file doesn't look like a valid backup");
        return;
      }
      state = parsed;
      if(!state.draftsByDay) state.draftsByDay = {};
      saveState();
      ui.activeDayId = state.currentDayId || state.program[0].id;
      closeBackupModal();
      toast("Backup restored ✅");
      switchView(ui.activeView);
    }catch(err){
      toast("Couldn't read that file");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

/* ---------------------------------------------------------------------- */
/* SUPABASE SYNC                                                           */
/* ---------------------------------------------------------------------- */
let supabaseClient = null;
let currentUser = null;
let authMode = "signin";
let cloudSyncTimer = null;

function initSupabase(){
  const configured = typeof SUPABASE_URL !== "undefined" && typeof SUPABASE_ANON_KEY !== "undefined"
    && SUPABASE_URL && SUPABASE_ANON_KEY
    && SUPABASE_URL !== "YOUR_SUPABASE_URL" && SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";
  if(configured && typeof supabase !== "undefined"){
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return !!supabaseClient;
}

async function restoreSession(){
  if(!supabaseClient) return;
  const { data } = await supabaseClient.auth.getSession();
  if(data && data.session){
    currentUser = data.session.user;
    await pullCloudState(true);
  }
  renderSyncStatus();
}

async function pullCloudState(initial){
  if(!supabaseClient || !currentUser) return;
  const { data, error } = await supabaseClient
    .from("gym_tracker_states")
    .select("data")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if(error){ console.warn("Cloud fetch failed", error); return; }

  if(data && data.data){
    const hasLocalHistory = state.history && state.history.length > 0;
    if(initial && hasLocalHistory){
      const useCloud = confirm(
        "Found existing cloud data for this account.\n\nOK = load the cloud version (replaces what's on this device)\nCancel = keep this device's data (overwrites the cloud)"
      );
      if(useCloud){
        state = data.data;
        if(!state.draftsByDay) state.draftsByDay = {};
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } else {
        await pushCloudState();
      }
    } else {
      state = data.data;
      if(!state.draftsByDay) state.draftsByDay = {};
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } else {
    await pushCloudState();
  }
  ui.activeDayId = state.currentDayId || state.program[0].id;
  switchView(ui.activeView);
}

async function pushCloudState(){
  if(!supabaseClient || !currentUser) return;
  const { error } = await supabaseClient
    .from("gym_tracker_states")
    .upsert({ user_id: currentUser.id, data: state, updated_at: new Date().toISOString() });
  if(error) console.warn("Cloud sync failed", error);
}

function scheduleCloudSync(){
  if(!supabaseClient || !currentUser) return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(pushCloudState, 1200);
}

function renderSyncStatus(){
  const wrap = document.getElementById("syncStatusBlock");
  if(!supabaseClient){
    wrap.innerHTML = `
      <div class="sync-status is-offline">
        <div class="sync-status-left">
          <span class="ss-title">Offline only</span>
          <span class="ss-sub">Add your Supabase keys to config.js to sync across devices</span>
        </div>
      </div>`;
    return;
  }
  if(currentUser){
    wrap.innerHTML = `
      <div class="sync-status">
        <div class="sync-status-left">
          <span class="ss-title">Synced ✓</span>
          <span class="ss-sub">${currentUser.email}</span>
        </div>
        <button id="signOutBtn">Sign out</button>
      </div>`;
    document.getElementById("signOutBtn").addEventListener("click", handleSignOut);
  } else {
    wrap.innerHTML = `
      <div class="sync-status is-offline">
        <div class="sync-status-left">
          <span class="ss-title">Not synced</span>
          <span class="ss-sub">Sign in to access your log on any device</span>
        </div>
        <button id="signInPromptBtn">Sign in</button>
      </div>`;
    document.getElementById("signInPromptBtn").addEventListener("click", openAuthModal);
  }
}

function openAuthModal(){
  authMode = "signin";
  updateAuthModalCopy();
  document.getElementById("authError").hidden = true;
  document.getElementById("authEmailInput").value = "";
  document.getElementById("authPasswordInput").value = "";
  document.getElementById("authModalBackdrop").hidden = false;
}
function closeAuthModal(){ document.getElementById("authModalBackdrop").hidden = true; }

function updateAuthModalCopy(){
  document.getElementById("authModalTitle").textContent = authMode === "signin" ? "Sign in to sync" : "Create your account";
  document.getElementById("authSubmitBtn").textContent = authMode === "signin" ? "Sign in" : "Sign up";
  document.getElementById("authToggleModeBtn").textContent = authMode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in";
}

document.getElementById("closeAuthModal").addEventListener("click", closeAuthModal);
document.getElementById("authModalBackdrop").addEventListener("click", e => { if(e.target.id === "authModalBackdrop") closeAuthModal(); });
document.getElementById("authToggleModeBtn").addEventListener("click", () => {
  authMode = authMode === "signin" ? "signup" : "signin";
  updateAuthModalCopy();
});

document.getElementById("authSubmitBtn").addEventListener("click", async () => {
  const email = document.getElementById("authEmailInput").value.trim();
  const password = document.getElementById("authPasswordInput").value;
  const errEl = document.getElementById("authError");
  errEl.hidden = true;

  if(!email || !password){
    errEl.textContent = "Enter both email and password";
    errEl.hidden = false;
    return;
  }
  if(!supabaseClient){
    errEl.textContent = "Supabase isn't configured yet — check config.js";
    errEl.hidden = false;
    return;
  }

  const btn = document.getElementById("authSubmitBtn");
  btn.disabled = true;
  try{
    const result = authMode === "signin"
      ? await supabaseClient.auth.signInWithPassword({ email, password })
      : await supabaseClient.auth.signUp({ email, password });

    if(result.error){
      errEl.textContent = result.error.message;
      errEl.hidden = false;
      btn.disabled = false;
      return;
    }
    if(authMode === "signup" && !result.data.session){
      toast("Check your email to confirm your account");
      closeAuthModal();
      btn.disabled = false;
      return;
    }
    currentUser = result.data.user;
    closeAuthModal();
    toast(authMode === "signin" ? "Signed in ✅" : "Account created ✅");
    await pullCloudState(true);
    renderSyncStatus();
  }catch(err){
    errEl.textContent = "Something went wrong. Try again.";
    errEl.hidden = false;
  }
  btn.disabled = false;
});

async function handleSignOut(){
  if(supabaseClient) await supabaseClient.auth.signOut();
  currentUser = null;
  renderSyncStatus();
  toast("Signed out — this device stays offline");
}

/* ---------------------------------------------------------------------- */
/* INIT                                                                    */
/* ---------------------------------------------------------------------- */
switchView("today");
initSupabase();
restoreSession();
