// Small final Matchday detail refinements. Loaded after matchday-final.js.
(() => {
  if (typeof state === "undefined") return;

  const FOOTBALL_ICON = `
    <svg class="classic-football" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="13.5" fill="#fff" stroke="currentColor" stroke-width="2"/>
      <polygon points="16,8.2 20.3,11.3 18.7,16.3 13.3,16.3 11.7,11.3" fill="currentColor"/>
      <polygon points="7.2,10.5 10.6,8.3 11.7,11.3 9.8,15.2 6.4,14.6" fill="currentColor"/>
      <polygon points="24.8,10.5 21.4,8.3 20.3,11.3 22.2,15.2 25.6,14.6" fill="currentColor"/>
      <polygon points="9.1,22.9 7.1,19.4 9.8,15.2 13.3,16.3 13.8,20.3" fill="currentColor"/>
      <polygon points="22.9,22.9 24.9,19.4 22.2,15.2 18.7,16.3 18.2,20.3" fill="currentColor"/>
      <path d="M13.8 20.3h4.4M11.7 11.3l-1.1-3M20.3 11.3l1.1-3M9.1 22.9l-1.4 2.4M22.9 22.9l1.4 2.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;

  function sortedEvents() {
    return (state.events || []).map((event, index) => ({ event, index }))
      .sort((a, b) => Number(a.event.minute || 0) - Number(b.event.minute || 0));
  }

  function refreshIcons() {
    document.querySelectorAll('.matchday-player-action-grid button[data-player-action="Goal"] span').forEach(span => {
      span.innerHTML = FOOTBALL_ICON;
    });

    const records = document.getElementById("matchday-unified-records");
    if (!records) return;
    const items = sortedEvents();
    [...records.querySelectorAll(".matchday-event-row")].forEach((row, rowIndex) => {
      const event = items[rowIndex]?.event;
      if (!event) return;
      const icon = row.querySelector(".matchday-row-icon");
      if (!icon) return;
      if (["Goal", "Opponent Goal"].includes(event.type)) icon.innerHTML = FOOTBALL_ICON;
    });
  }

  // Opponent Goal in the unified form uses the existing Goal type control,
  // but only offers Open Play / Penalty because player/assist are irrelevant.
  const typeSelect = document.getElementById("matchday-unified-type");
  const goalTypeLabel = document.getElementById("matchday-unified-goal-type-label");
  const goalTypeSelect = document.getElementById("matchday-unified-goal-type");
  const addButton = document.getElementById("matchday-unified-add");

  function setGoalTypeOptions(values) {
    if (!goalTypeSelect) return;
    const previous = goalTypeSelect.value;
    goalTypeSelect.innerHTML = values.map(v => `<option value="${v}">${v}</option>`).join("");
    if (values.includes(previous)) goalTypeSelect.value = previous;
  }

  function refreshOpponentGoalFields() {
    if (!typeSelect || !goalTypeLabel || !goalTypeSelect) return;
    if (typeSelect.value === "Opponent Goal") {
      setGoalTypeOptions(["Open Play", "Penalty"]);
      goalTypeLabel.classList.remove("hidden");
    } else if (typeSelect.value === "Goal") {
      setGoalTypeOptions(["Open Play", "Penalty", "Free Kick", "Corner"]);
    }
  }
  typeSelect?.addEventListener("change", () => setTimeout(refreshOpponentGoalFields, 0));

  // Record Opponent Goal from unified form with its goalType attached.
  addButton?.addEventListener("click", event => {
    if (typeSelect?.value !== "Opponent Goal") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const minuteInput = document.getElementById("matchday-unified-minute");
    const minute = Math.max(0, Math.floor(Number(minuteInput?.value) || (typeof matchMinute === "function" ? matchMinute() : 0)));
    state.events.push({ type: "Opponent Goal", minute, goalType: goalTypeSelect?.value || "Open Play" });
    saveState();
    renderLive();
    if (typeof saveRecovery === "function") saveRecovery("opponent-goal");
  }, true);

  // The big scoreboard button gets a compact Open Play / Penalty chooser.
  const opponentButton = document.querySelector(".matchday-opponent-goal");
  let chooser = null;
  function ensureChooser() {
    if (chooser) return chooser;
    chooser = document.createElement("div");
    chooser.className = "opponent-goal-choice hidden";
    chooser.innerHTML = `
      <div class="opponent-goal-choice-card" role="dialog" aria-modal="true" aria-label="Opponent goal type">
        <strong>Opponent Goal</strong>
        <button type="button" data-opponent-goal-type="Open Play">${FOOTBALL_ICON}<span>Open Play</span></button>
        <button type="button" data-opponent-goal-type="Penalty">${FOOTBALL_ICON}<span>Penalty</span></button>
        <button type="button" class="opponent-goal-cancel">Cancel</button>
      </div>`;
    document.body.appendChild(chooser);
    chooser.addEventListener("click", event => {
      if (event.target === chooser || event.target.closest(".opponent-goal-cancel")) {
        chooser.classList.add("hidden");
        return;
      }
      const button = event.target.closest("button[data-opponent-goal-type]");
      if (!button) return;
      state.events.push({
        type: "Opponent Goal",
        minute: typeof matchMinute === "function" ? matchMinute() : 0,
        goalType: button.dataset.opponentGoalType
      });
      saveState();
      chooser.classList.add("hidden");
      renderLive();
      if (typeof saveRecovery === "function") saveRecovery("opponent-goal");
    });
    return chooser;
  }

  opponentButton?.addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    ensureChooser().classList.remove("hidden");
  }, true);

  // Add/preserve goal type when an existing Opponent Goal is edited.
  let pendingOpponentEdit = null;
  document.addEventListener("click", event => {
    const spanner = event.target.closest("#matchday-unified-records .matchday-spanner, #matchday-unified-records .matchday-spanner-icon");
    if (spanner) {
      const row = spanner.closest(".matchday-event-row");
      const rows = [...document.querySelectorAll("#matchday-unified-records .matchday-event-row")];
      const rowIndex = rows.indexOf(row);
      const item = sortedEvents()[rowIndex];
      pendingOpponentEdit = item?.event?.type === "Opponent Goal" ? { index: item.index, goalType: item.event.goalType || "Open Play" } : null;
      if (pendingOpponentEdit) {
        setTimeout(() => {
          const type = document.getElementById("edit-event-type");
          const fields = document.getElementById("matchday-edit-fields");
          if (!type || !fields || type.value !== "Opponent Goal") return;
          let label = document.getElementById("edit-opponent-goal-type-label");
          if (!label) {
            label = document.createElement("label");
            label.id = "edit-opponent-goal-type-label";
            label.innerHTML = `Goal type<select id="edit-opponent-goal-type" class="matchday-select"><option>Open Play</option><option>Penalty</option></select>`;
            fields.insertBefore(label, fields.querySelector("label:last-child"));
          }
          document.getElementById("edit-opponent-goal-type").value = pendingOpponentEdit.goalType;
        }, 0);
      }
    }

    const save = event.target.closest("#matchday-edit-save");
    if (save && pendingOpponentEdit) {
      const index = pendingOpponentEdit.index;
      const goalType = document.getElementById("edit-opponent-goal-type")?.value || pendingOpponentEdit.goalType || "Open Play";
      setTimeout(() => {
        if (state.events[index]?.type === "Opponent Goal") {
          state.events[index].goalType = goalType;
          saveState();
          renderLive();
          if (typeof saveRecovery === "function") saveRecovery("event-correction");
        }
        pendingOpponentEdit = null;
      }, 0);
    }
  }, true);

  if (typeof renderRecordedItems === "function") {
    const previous = renderRecordedItems;
    renderRecordedItems = function () {
      previous();
      refreshIcons();
    };
  }
  if (typeof renderLive === "function") {
    const previous = renderLive;
    renderLive = function () {
      previous();
      refreshOpponentGoalFields();
      refreshIcons();
    };
  }

  const style = document.createElement("style");
  style.textContent = `
    .classic-football { width:21px !important; height:21px !important; overflow:visible; }
    .matchday-row-icon.yellow svg, .quick-yellow svg { fill:#facc15 !important; stroke:#d97706 !important; }
    .matchday-row-icon.red svg, .quick-red svg { fill:#dc2626 !important; stroke:#991b1b !important; }
    .opponent-goal-choice { position:fixed; inset:0; z-index:12000; display:flex; align-items:center; justify-content:center; padding:18px; background:rgba(15,23,42,.66); }
    .opponent-goal-choice.hidden { display:none !important; }
    .opponent-goal-choice-card { width:min(100%,360px); background:#fff; border-radius:16px; padding:18px; display:grid; gap:10px; box-shadow:0 24px 60px rgba(0,0,0,.3); }
    .opponent-goal-choice-card > strong { font-size:1.12rem; margin-bottom:2px; }
    .opponent-goal-choice-card button { min-height:50px; border-radius:11px; border:1px solid #e2e8f0; background:#fff; display:flex; align-items:center; justify-content:center; gap:10px; font-weight:900; color:#111827; }
    .opponent-goal-choice-card button[data-opponent-goal-type] { background:#fff1f2; border-color:#fecdd3; color:#be123c; }
    .opponent-goal-choice-card .opponent-goal-cancel { background:#f8fafc; }
  `;
  document.head.appendChild(style);

  refreshOpponentGoalFields();
  refreshIcons();
})();
