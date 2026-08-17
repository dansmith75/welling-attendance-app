// Small compatibility helpers for Matchday v3.
// Core Matchday logic remains in matchday.js.
(() => {
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "matchday-v3.css";
  document.head.appendChild(css);

  // First-page manager toggle: tapping the currently selected manager deselects them.
  const container = document.getElementById("user-options");
  if (container) {
    container.addEventListener("click", (event) => {
      const button = event.target.closest(".user-option");
      if (!button) return;

      const selectedName = button.textContent.replace(" ✓", "").trim();
      if (!currentUser || currentUser.name !== selectedName) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      currentUser = null;
      localStorage.removeItem(USER_STORAGE_KEY);
      updateUserUi();
      renderUserOptions();
    }, true);
  }

  // Free Kick goal support.
  if (typeof md === "undefined" || !md.goalType) return;

  if (![...md.goalType.options].some(option => option.value === "Free Kick")) {
    const option = document.createElement("option");
    option.value = "Free Kick";
    option.textContent = "Free Kick";
    const penalty = [...md.goalType.options].find(item => item.value === "Penalty");
    if (penalty) penalty.insertAdjacentElement("afterend", option);
    else md.goalType.appendChild(option);
  }

  function goalAllowsAssist(type) {
    return type === "Open Play" || type === "Free Kick";
  }

  function applyAssistVisibility() {
    const show = goalAllowsAssist(md.goalType.value);
    md.assistLabel?.classList.toggle("hidden", !show);
    if (!show && md.goalAssist) md.goalAssist.value = "";
  }

  md.goalType.addEventListener("change", applyAssistVisibility);

  // v3 originally only treats Open Play as assist-capable. Keep the core
  // renderer, then correct the assist visibility for Free Kick.
  if (typeof renderControls === "function") {
    const coreRenderControls = renderControls;
    renderControls = function () {
      coreRenderControls();
      applyAssistVisibility();
    };
  }

  // Intercept only Free Kick before the core goal handler. Open Play and
  // Penalty continue through the single v3 core handler unchanged.
  md.addGoal?.addEventListener("click", (event) => {
    if (md.goalType.value !== "Free Kick") return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (typeof syncLateArrivals === "function") syncLateArrivals();
    const scorer = md.goalPlayer.value;
    if (!scorer) return window.alert("Choose the goal scorer.");

    const goal = {
      type: "Goal",
      playerId: scorer,
      minute: Math.max(0, Math.floor(Number(md.goalMinute.value) || matchMinute())),
      goalType: "Free Kick"
    };

    if (md.goalAssist.value) goal.assistPlayerId = md.goalAssist.value;

    state.events.push(goal);
    saveState();
    renderLive();
    if (typeof saveRecovery === "function") saveRecovery("goal");
  }, true);

  // Allow the spanner Edit flow to change a goal to/from Free Kick as well.
  if (typeof editEvent === "function") {
    editEvent = function (index) {
      const recorded = state.events[index];
      if (!recorded) return;

      const minute = askMinute(recorded.minute);
      if (minute == null || minute === undefined) return;
      const playerId = askPlayer(recorded.playerId, "Player");
      if (playerId == null || playerId === undefined) return;

      recorded.minute = minute;
      recorded.playerId = playerId;

      if (recorded.type === "Goal") {
        const entered = window.prompt(
          "Goal type: Open Play, Penalty or Free Kick",
          recorded.goalType || "Open Play"
        );
        if (entered === null) return;

        const types = {
          "open play": "Open Play",
          "penalty": "Penalty",
          "free kick": "Free Kick"
        };
        const goalType = types[entered.trim().toLowerCase()];
        if (!goalType) return window.alert("Use Open Play, Penalty or Free Kick.");

        recorded.goalType = goalType;
        if (!goalAllowsAssist(goalType)) {
          delete recorded.assistPlayerId;
        } else {
          const names = state.squadIds.map(id => playerName(id)).join(", ");
          const assist = window.prompt(
            `Assist (blank for none)\n\nSquad: ${names}`,
            recorded.assistPlayerId ? playerName(recorded.assistPlayerId) : ""
          );
          if (assist === null) return;

          if (!assist.trim()) {
            delete recorded.assistPlayerId;
          } else {
            const assistId = state.squadIds.find(
              id => playerName(id).toLowerCase() === assist.trim().toLowerCase()
            );
            if (!assistId || assistId === recorded.playerId) {
              return window.alert("Assist player not recognised.");
            }
            recorded.assistPlayerId = assistId;
          }
        }
      } else if (recorded.type === "Card") {
        const current = recorded.cardType === "Yellow"
          ? "Yellow Card"
          : recorded.cardType === "Red"
            ? "Red Card"
            : "Sin Bin";
        const type = window.prompt("Type: Yellow Card, Red Card or Sin Bin", current);
        if (type === null) return;
        const types = { "yellow card": "Yellow", "red card": "Red", "sin bin": "Sin Bin" };
        const mapped = types[type.trim().toLowerCase()];
        if (!mapped) return window.alert("Use Yellow Card, Red Card or Sin Bin.");
        recorded.cardType = mapped;
      } else {
        const text = window.prompt("Event", recorded.text || "");
        if (text === null) return;
        if (!text.trim()) return window.alert("Event cannot be blank.");
        recorded.text = text.trim();
      }

      saveState();
      renderLive();
      if (typeof saveRecovery === "function") saveRecovery("event-correction");
    };
  }

  applyAssistVisibility();
})();
