// Matchday touchline UI v2
// Consolidates positional grouping, compact record actions and correction menus.
(() => {
  if (typeof state === "undefined" || typeof md === "undefined") return;

  // ---------- DOM helpers ----------
  const live = document.getElementById("matchday-live");
  const subSection = md.subList?.closest(".matchday-live-section");
  const eventsSection = md.eventList?.closest(".matchday-live-section");
  if (!live || !subSection || !eventsSection) return;

  // Remove emoji from headings/buttons.
  const goalCard = document.getElementById("matchday-goal-player")?.closest(".matchday-event-card");
  const oldCard = document.getElementById("matchday-card-player")?.closest(".matchday-event-card");
  const injectedNoteCard = document.getElementById("matchday-note-card");
  if (goalCard?.querySelector("strong")) goalCard.querySelector("strong").textContent = "Goal";
  if (injectedNoteCard) injectedNoteCard.classList.add("hidden");

  // Rebuild Card/Sin Bin as one Player Event control.
  if (oldCard) {
    oldCard.id = "matchday-player-event-card";
    const heading = oldCard.querySelector("strong");
    if (heading) heading.textContent = "Player Event";

    const typeLabel = md.cardType?.closest("label");
    if (typeLabel) {
      typeLabel.childNodes[0].textContent = "Type\n";
      md.cardType.innerHTML = `
        <option value="Yellow">Yellow Card</option>
        <option value="Red">Red Card</option>
        <option value="Sin Bin">Sin Bin</option>
        <option value="Other">Other</option>
      `;
    }

    const textLabel = document.createElement("label");
    textLabel.id = "matchday-player-event-text-label";
    textLabel.className = "hidden";
    textLabel.innerHTML = `Event<input id="matchday-player-event-text" class="matchday-input" type="text" placeholder="What happened?" />`;
    md.cardMinute?.closest(".matchday-event-grid")?.insertBefore(textLabel, md.cardMinute.closest("label"));
  }

  const playerEventText = document.getElementById("matchday-player-event-text");
  const playerEventTextLabel = document.getElementById("matchday-player-event-text-label");
  function updatePlayerEventFields() {
    const other = md.cardType?.value === "Other";
    playerEventTextLabel?.classList.toggle("hidden", !other);
    if (!other && playerEventText) playerEventText.value = "";
  }
  md.cardType?.addEventListener("change", updatePlayerEventFields);
  updatePlayerEventFields();

  // Separate recorded items so they appear directly under their own control.
  const goalList = document.createElement("div");
  goalList.id = "matchday-goal-list";
  goalList.className = "matchday-event-list";
  goalCard?.appendChild(goalList);

  const playerEventList = document.createElement("div");
  playerEventList.id = "matchday-player-event-list";
  playerEventList.className = "matchday-event-list";
  oldCard?.appendChild(playerEventList);
  md.eventList.classList.add("hidden");

  // Compact green tick record actions.
  function makeTick(button, grid, label) {
    if (!button || !grid) return;
    button.textContent = "✓";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.className = "matchday-tick-button";
    grid.appendChild(button);
  }
  makeTick(md.addSub, subSection.querySelector(".matchday-sub-grid"), "Record substitution");
  makeTick(md.addGoal, goalCard?.querySelector(".matchday-event-grid"), "Record goal");
  makeTick(md.addCard, oldCard?.querySelector(".matchday-event-grid"), "Record player event");

  // Existing addCard handler must be intercepted when Type=Other so free text is saved.
  md.addCard?.addEventListener("click", (event) => {
    if (md.cardType.value !== "Other") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (typeof syncLateArrivals === "function") syncLateArrivals();
    const playerId = md.cardPlayer.value;
    const text = playerEventText?.value.trim() || "";
    if (!playerId) return window.alert("Choose the player.");
    if (!text) return window.alert("Enter the event text.");
    state.events.push({ type: "Note", playerId, minute: Math.max(0, Number(md.cardMinute.value) || matchMinute()), text });
    playerEventText.value = "";
    saveState();
    renderLive();
  }, true);

  // ---------- Players on pitch: one block, ordered by positional group ----------
  const positionRank = pos => {
    const group = positionGroup(pos);
    return ({ Goalkeeper: 0, Defence: 1, Midfield: 2, Attack: 3, Other: 4 })[group] ?? 4;
  };
  renderLineup = function () {
    md.lineup.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "matchday-position-chips matchday-position-chips-flat";
    [...state.lineupIds]
      .sort((a, b) => positionRank(playerPosition(a)) - positionRank(playerPosition(b)))
      .forEach(id => {
        const group = positionGroup(playerPosition(id));
        const chip = document.createElement("span");
        chip.className = `matchday-lineup-chip position-${group.toLowerCase()}`;
        chip.textContent = playerPosition(id) ? `${playerName(id)} · ${playerPosition(id)}` : playerName(id);
        wrap.appendChild(chip);
      });
    md.lineup.appendChild(wrap);
  };

  // ---------- Correction menu ----------
  const overlay = document.createElement("div");
  overlay.id = "matchday-correction-overlay";
  overlay.className = "matchday-correction-overlay hidden";
  overlay.innerHTML = `
    <div class="matchday-correction-dialog">
      <strong id="matchday-correction-title">Recorded item</strong>
      <button id="matchday-correction-edit" class="secondary-button" type="button">Edit</button>
      <button id="matchday-correction-delete" class="danger-button" type="button">Delete</button>
      <button id="matchday-correction-cancel" class="small-button" type="button">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);
  const correctionTitle = document.getElementById("matchday-correction-title");
  const correctionEdit = document.getElementById("matchday-correction-edit");
  const correctionDelete = document.getElementById("matchday-correction-delete");
  const correctionCancel = document.getElementById("matchday-correction-cancel");
  let correctionAction = null;
  const closeCorrection = () => { overlay.classList.add("hidden"); correctionAction = null; };
  correctionCancel.addEventListener("click", closeCorrection);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeCorrection(); });

  function squadNames() { return (state.squadIds || []).map(id => playerName(id)).join(", "); }
  function askPlayer(current, label) {
    const v = window.prompt(`${label}\n\nSquad: ${squadNames()}`, playerName(current));
    if (v === null) return null;
    const id = state.squadIds.find(x => playerName(x).toLowerCase() === v.trim().toLowerCase());
    if (!id) { window.alert("Player not recognised."); return undefined; }
    return id;
  }
  function askMinute(current) {
    const v = window.prompt("Minute", String(current ?? 0));
    if (v === null) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) { window.alert("Enter a valid minute."); return undefined; }
    return Math.floor(n);
  }

  function editEvent(index) {
    const e = state.events[index]; if (!e) return;
    const backup = structuredClone(e);
    const minute = askMinute(e.minute); if (minute == null || minute === undefined) return;
    const pid = askPlayer(e.playerId, "Player"); if (pid == null || pid === undefined) return;
    e.minute = minute; e.playerId = pid;
    if (e.type === "Goal") {
      const gt = window.prompt("Goal type: Open Play or Penalty", e.goalType || "Open Play");
      if (gt === null) { state.events[index] = backup; return; }
      const type = gt.trim().toLowerCase();
      if (!["open play", "penalty"].includes(type)) { state.events[index] = backup; return window.alert("Use Open Play or Penalty."); }
      e.goalType = type === "penalty" ? "Penalty" : "Open Play";
      if (e.goalType === "Penalty") delete e.assistPlayerId;
      else {
        const av = window.prompt(`Assist (blank for none)\n\nSquad: ${squadNames()}`, e.assistPlayerId ? playerName(e.assistPlayerId) : "");
        if (av === null) { state.events[index] = backup; return; }
        if (!av.trim()) delete e.assistPlayerId;
        else {
          const aid = state.squadIds.find(x => playerName(x).toLowerCase() === av.trim().toLowerCase());
          if (!aid || aid === e.playerId) { state.events[index] = backup; return window.alert("Assist player not recognised."); }
          e.assistPlayerId = aid;
        }
      }
    } else if (e.type === "Card") {
      const cv = window.prompt("Type: Yellow Card, Red Card or Sin Bin", e.cardType === "Yellow" ? "Yellow Card" : e.cardType === "Red" ? "Red Card" : e.cardType);
      if (cv === null) { state.events[index] = backup; return; }
      const map = { "yellow card": "Yellow", "red card": "Red", "sin bin": "Sin Bin" };
      const val = map[cv.trim().toLowerCase()];
      if (!val) { state.events[index] = backup; return window.alert("Use Yellow Card, Red Card or Sin Bin."); }
      e.cardType = val;
    } else if (e.type === "Note") {
      const nv = window.prompt("Event", e.text || "");
      if (nv === null) { state.events[index] = backup; return; }
      if (!nv.trim()) { state.events[index] = backup; return window.alert("Event cannot be blank."); }
      e.text = nv.trim();
    }
    saveState(); renderLive();
  }

  function deleteEvent(index) {
    const e = state.events[index]; if (!e) return;
    if (!window.confirm("Delete this recorded item?")) return;
    state.events.splice(index, 1); saveState(); renderLive();
  }

  function rebuildSubs(proposed) {
    const intervals = {}; const lineup = [...state.starterIds];
    const open = (id,s) => { intervals[id] ||= []; intervals[id].push({start:s,end:null}); };
    const close = (id,s) => { const x=[...(intervals[id]||[])].reverse().find(i=>i.end===null); if(!x||s<x.start)return false; x.end=s; return true; };
    state.starterIds.forEach(id=>open(id,0));
    const ordered = proposed.map(x=>({...x})).sort((a,b)=>Number(a.second||0)-Number(b.second||0));
    for (const sub of ordered) {
      const sec = Math.max(0, Number(sub.second ?? Number(sub.minute||0)*60));
      if (!lineup.includes(sub.off) || lineup.includes(sub.on) || !close(sub.off,sec)) return null;
      open(sub.on,sec); lineup.splice(lineup.indexOf(sub.off),1,sub.on); sub.second=Math.round(sec); sub.minute=Math.floor(sec/60);
    }
    return {ordered,intervals,lineup};
  }
  function applySubs(proposed) {
    const r = rebuildSubs(proposed); if(!r) return window.alert("That would make the substitution sequence invalid.");
    state.substitutions=r.ordered; state.intervals=r.intervals; state.lineupIds=r.lineup; saveState(); renderLive();
  }
  function editSub(index) {
    const s=state.substitutions[index]; if(!s)return;
    const minute=askMinute(s.minute); if(minute==null||minute===undefined)return;
    const off=askPlayer(s.off,"Player off"); if(off==null||off===undefined)return;
    const on=askPlayer(s.on,"Player on"); if(on==null||on===undefined)return;
    if(off===on)return window.alert("Players must be different.");
    applySubs(state.substitutions.map((x,i)=>i===index?{...x,minute,second:minute*60,off,on}:{...x}));
  }
  function deleteSub(index) { if(!window.confirm("Delete this substitution?"))return; applySubs(state.substitutions.filter((_,i)=>i!==index)); }

  function openCorrection(title, edit, del) {
    correctionTitle.textContent = title;
    correctionAction = {edit,del};
    overlay.classList.remove("hidden");
  }
  correctionEdit.addEventListener("click", () => { const fn=correctionAction?.edit; closeCorrection(); fn?.(); });
  correctionDelete.addEventListener("click", () => { const fn=correctionAction?.del; closeCorrection(); fn?.(); });

  function spanner(title, edit, del) {
    const b=document.createElement("button"); b.type="button"; b.className="matchday-spanner"; b.textContent="🔧"; b.title="Edit or delete";
    b.addEventListener("click",()=>openCorrection(title,edit,del)); return b;
  }

  // Render each kind beneath its own control.
  const previousRenderLists = renderLists;
  renderLists = function () {
    previousRenderLists();
    md.eventList.classList.add("hidden");

    // substitutions already render in their own list
    [...md.subList.querySelectorAll(".matchday-sub-row")].forEach((row,index)=>{
      [...row.querySelectorAll("button")].forEach(b=>b.remove());
      const s=state.substitutions[index]; if(!s)return;
      row.appendChild(spanner(`${playerName(s.off)} off / ${playerName(s.on)} on · ${s.minute}'`,()=>editSub(index),()=>deleteSub(index)));
    });

    goalList.innerHTML=""; playerEventList.innerHTML="";
    state.events.map((event,index)=>({event,index})).sort((a,b)=>(a.event.minute||0)-(b.event.minute||0)).forEach(({event:e,index})=>{
      const row=document.createElement("div"); row.className="matchday-event-row";
      let text="";
      if(e.type==="Goal") {
        text=`${e.minute}' · ${playerName(e.playerId)} · ${e.goalType}${e.assistPlayerId?` · Assist: ${playerName(e.assistPlayerId)}`:""}`;
      } else if(e.type==="Card") {
        const label=e.cardType==="Yellow"?"Yellow Card":e.cardType==="Red"?"Red Card":e.cardType;
        text=`${e.minute}' · ${playerName(e.playerId)} · ${label}`;
      } else if(e.type==="Note") {
        text=`${e.minute}' · ${playerName(e.playerId)} · ${e.text}`;
      }
      const span=document.createElement("span"); span.textContent=text; row.append(span,spanner(text,()=>editEvent(index),()=>deleteEvent(index)));
      (e.type==="Goal"?goalList:playerEventList).appendChild(row);
    });
  };

  // ---------- Button colours / positions ----------
  md.pause?.classList.add("matchday-halftime-button");
  md.fullTime.className = "matchday-fulltime-button matchday-wide";

  const cancel = document.getElementById("matchday-cancel");
  if (cancel) {
    cancel.textContent = "Cancel Matchday";
    cancel.className = "danger-button matchday-wide matchday-cancel-bottom";
    live.appendChild(cancel);
  }

  renderLive();
})();
