// Final Matchday UI refinements layered after matchday-ui-v2.js.
(() => {
  if (typeof state === "undefined" || typeof md === "undefined") return;

  const style = document.createElement("style");
  style.textContent = `
    .matchday-live-section > h3 {
      margin: 0 -12px 12px;
      padding: 10px 12px;
      background: #eef0f3;
      border-top: 1px solid #d9dde5;
      border-bottom: 1px solid #d9dde5;
      font-size: .95rem;
    }
    .matchday-position-chips-flat { display:flex; flex-wrap:wrap; align-items:center; gap:7px 16px; }
    .matchday-pos-run { display:inline-flex; flex-wrap:wrap; gap:7px; align-items:center; }
    .matchday-tick-button {
      align-self:end;
      width:44px;
      min-width:44px;
      height:44px;
      border:0;
      border-radius:11px;
      background:#16a34a;
      color:#fff;
      font-size:1.25rem;
      font-weight:950;
      padding:0;
      margin:0;
    }
    .matchday-tick-button:hover { background:#15803d; }
    .matchday-sub-grid { grid-template-columns:minmax(0,1fr) minmax(0,1fr) 90px 44px; align-items:end; }
    .matchday-event-grid { grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 90px 44px; align-items:end; }
    #matchday-player-event-card .matchday-event-grid { grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 90px 44px; }
    .matchday-halftime-button {
      background:#fff1df !important;
      border-color:#f3c27b !important;
      color:#8a4b08 !important;
    }
    .matchday-fulltime-button {
      border:0;
      border-radius:11px;
      padding:13px;
      font-weight:950;
      background:#16a34a;
      color:#fff;
    }
    .matchday-cancel-bottom { margin-top:28px !important; }
    .matchday-spanner {
      border:1px solid #d9dde5;
      background:#fff;
      border-radius:8px;
      padding:5px 8px;
      font-size:1rem;
      flex:0 0 auto;
    }
    .matchday-event-row, .matchday-sub-row { align-items:center; }
    .matchday-correction-overlay {
      position:fixed;
      inset:0;
      z-index:3000;
      display:grid;
      place-items:center;
      background:rgba(0,0,0,.55);
      padding:18px;
    }
    .matchday-correction-dialog {
      width:min(100%,360px);
      display:grid;
      gap:10px;
      background:#fff;
      border-radius:16px;
      padding:18px;
      box-shadow:0 16px 45px rgba(0,0,0,.25);
    }
    .matchday-correction-dialog strong { margin-bottom:4px; }
    @media (max-width:620px) {
      .matchday-sub-grid,
      .matchday-event-grid,
      #matchday-player-event-card .matchday-event-grid {
        grid-template-columns:minmax(0,1fr) minmax(0,1fr) !important;
      }
      .matchday-tick-button { grid-column:2; justify-self:end; }
    }
  `;
  document.head.appendChild(style);

  if (md.open) md.open.textContent = "Matchday";

  // Type=Event reveals the free-text field. Structured disciplinary events do not.
  const option = [...(md.cardType?.options || [])].find(o => o.value === "Other");
  if (option) {
    option.value = "Event";
    option.textContent = "Event";
  }

  const eventTextLabel = document.getElementById("matchday-player-event-text-label");
  const eventText = document.getElementById("matchday-player-event-text");
  function updateEventTextVisibility() {
    const show = md.cardType?.value === "Event";
    eventTextLabel?.classList.toggle("hidden", !show);
    if (!show && eventText) eventText.value = "";
  }
  md.cardType?.addEventListener("change", updateEventTextVisibility);
  updateEventTextVisibility();

  // Intercept the compact tick for free-text Event entries.
  md.addCard?.addEventListener("click", event => {
    if (md.cardType?.value !== "Event") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (typeof syncLateArrivals === "function") syncLateArrivals();
    const playerId = md.cardPlayer?.value || "";
    const text = eventText?.value.trim() || "";
    if (!playerId) return window.alert("Choose the player.");
    if (!text) return window.alert("Enter the event text.");
    state.events.push({
      type: "Note",
      playerId,
      minute: Math.max(0, Number(md.cardMinute?.value) || matchMinute()),
      text
    });
    eventText.value = "";
    saveState();
    renderLive();
  }, true);

  // One Players on Pitch area, but each positional family stays visually clustered.
  const groups = ["Goalkeeper", "Defence", "Midfield", "Attack", "Other"];
  renderLineup = function () {
    md.lineup.innerHTML = "";
    const flat = document.createElement("div");
    flat.className = "matchday-position-chips-flat";
    groups.forEach(group => {
      const ids = state.lineupIds.filter(id => positionGroup(playerPosition(id)) === group);
      if (!ids.length) return;
      const run = document.createElement("span");
      run.className = "matchday-pos-run";
      ids.forEach(id => {
        const chip = document.createElement("span");
        chip.className = `matchday-lineup-chip position-${group.toLowerCase()}`;
        chip.textContent = playerPosition(id) ? `${playerName(id)} · ${playerPosition(id)}` : playerName(id);
        run.appendChild(chip);
      });
      flat.appendChild(run);
    });
    md.lineup.appendChild(flat);
  };

  md.pause?.classList.add("matchday-halftime-button");
  if (md.fullTime) md.fullTime.className = "matchday-fulltime-button matchday-wide";

  const cancel = document.getElementById("matchday-cancel");
  if (cancel) {
    cancel.textContent = "Cancel Matchday";
    cancel.className = "danger-button matchday-wide matchday-cancel-bottom";
    document.getElementById("matchday-live")?.appendChild(cancel);
  }

  renderLive();
})();
