// Matchday hotfix: single goal submission + reliable substitution spanners.
(() => {
  if (typeof state === "undefined" || typeof md === "undefined") return;

  // ---- GOALS: own the click in capture phase so older handlers cannot double-add. ----
  if (md.addGoal) {
    md.addGoal.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (typeof syncLateArrivals === "function") syncLateArrivals();

      const scorer = md.goalPlayer?.value;
      if (!scorer) return window.alert("Choose the goal scorer.");

      const goalType = md.goalType?.value || "Open Play";
      const minute = Math.max(0, Number(md.goalMinute?.value) || (typeof matchMinute === "function" ? matchMinute() : 0));
      const goal = { type: "Goal", playerId: scorer, minute, goalType };

      if (goalType === "Open Play" && md.goalAssist?.value) {
        goal.assistPlayerId = md.goalAssist.value;
      }

      state.events.push(goal);
      saveState();
      renderLive();

      // Recovery autosave code will pick this up on its normal cycle.
    }, true);
  }

  // ---- SUBSTITUTIONS: attach one spanner every time the list is rebuilt. ----
  const subList = md.subList;
  if (!subList) return;

  function squadNames() {
    return (state.squadIds || []).map(id => playerName(id)).join(", ");
  }

  function askPlayer(currentId, label) {
    const value = window.prompt(`${label}\n\nSquad: ${squadNames()}`, playerName(currentId));
    if (value === null) return null;
    const id = (state.squadIds || []).find(x => playerName(x).toLowerCase() === value.trim().toLowerCase());
    if (!id) {
      window.alert("Player not recognised.");
      return undefined;
    }
    return id;
  }

  function askMinute(current) {
    const value = window.prompt("Minute", String(current ?? 0));
    if (value === null) return null;
    const minute = Number(value);
    if (!Number.isFinite(minute) || minute < 0) {
      window.alert("Enter a valid minute.");
      return undefined;
    }
    return Math.floor(minute);
  }

  function rebuildSubs(proposed) {
    const intervals = {};
    const lineup = [...state.starterIds];
    const open = (id, second) => {
      intervals[id] ||= [];
      intervals[id].push({ start: second, end: null });
    };
    const close = (id, second) => {
      const current = [...(intervals[id] || [])].reverse().find(i => i.end === null);
      if (!current || second < current.start) return false;
      current.end = second;
      return true;
    };

    state.starterIds.forEach(id => open(id, 0));
    const ordered = proposed.map(s => ({ ...s })).sort((a, b) => Number(a.second || 0) - Number(b.second || 0));

    for (const sub of ordered) {
      const second = Math.max(0, Number(sub.second ?? (Number(sub.minute || 0) * 60)));
      if (!lineup.includes(sub.off) || lineup.includes(sub.on) || !close(sub.off, second)) return null;
      open(sub.on, second);
      lineup.splice(lineup.indexOf(sub.off), 1, sub.on);
      sub.second = Math.round(second);
      sub.minute = Math.floor(second / 60);
    }

    return { ordered, intervals, lineup };
  }

  function applySubs(proposed) {
    const rebuilt = rebuildSubs(proposed);
    if (!rebuilt) return window.alert("That would make the substitution sequence invalid.");
    state.substitutions = rebuilt.ordered;
    state.intervals = rebuilt.intervals;
    state.lineupIds = rebuilt.lineup;
    saveState();
    renderLive();
  }

  function editSub(index) {
    const sub = state.substitutions[index];
    if (!sub) return;
    const minute = askMinute(sub.minute);
    if (minute == null || minute === undefined) return;
    const off = askPlayer(sub.off, "Player off");
    if (off == null || off === undefined) return;
    const on = askPlayer(sub.on, "Player on");
    if (on == null || on === undefined) return;
    if (off === on) return window.alert("Players must be different.");

    applySubs(state.substitutions.map((s, i) => i === index
      ? { ...s, minute, second: minute * 60, off, on }
      : { ...s }));
  }

  function deleteSub(index) {
    if (!window.confirm("Delete this substitution?")) return;
    applySubs(state.substitutions.filter((_, i) => i !== index).map(s => ({ ...s })));
  }

  function decorateSubRows() {
    const rows = [...subList.querySelectorAll(".matchday-sub-row")];
    rows.forEach((row, index) => {
      // Remove any older edit/delete/spanner controls so there is only one tool.
      row.querySelectorAll("button, .matchday-correction-actions").forEach(el => el.remove());
      const sub = state.substitutions[index];
      if (!sub) return;

      const tool = document.createElement("button");
      tool.type = "button";
      tool.className = "matchday-spanner";
      tool.textContent = "🔧";
      tool.title = "Edit or delete substitution";
      tool.setAttribute("aria-label", "Edit or delete substitution");
      tool.addEventListener("click", () => {
        const choice = window.prompt("Substitution\n\nType EDIT or DELETE", "EDIT");
        if (choice === null) return;
        const action = choice.trim().toLowerCase();
        if (action === "edit") editSub(index);
        else if (action === "delete") deleteSub(index);
      });
      row.appendChild(tool);
    });
  }

  const observer = new MutationObserver(decorateSubRows);
  observer.observe(subList, { childList: true, subtree: true });
  decorateSubRows();
})();
