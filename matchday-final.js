// Final Matchday refinements loaded after ui-polish.js.
(() => {
  const FOOTBALL_ICON = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9"></circle>
      <path d="M9.2 8.2 12 6.4l2.8 1.8-1 3.2h-3.6l-1-3.2Z"></path>
      <path d="m7.1 10-2.6 1.8.9 3.4 3.1.2 1.7-4"></path>
      <path d="m16.9 10 2.6 1.8-.9 3.4-3.1.2-1.7-4"></path>
      <path d="m8.5 15.4 1.7 2.9h3.6l1.7-2.9-1.7-4h-3.6l-1.7 4Z"></path>
      <path d="M5.4 15.2 7 18.1m12-2.9-1.6 2.9M10.2 18.3 9.5 21m4.3-2.7.7 2.7"></path>
    </svg>`;

  function removeBottomQuickActions() {
    document.getElementById("matchday-quick-actions")?.remove();
  }

  function decoratePlayerChips() {
    if (typeof md === "undefined" || !md.lineup) return;
    md.lineup.querySelectorAll(".matchday-lineup-chip").forEach(chip => {
      if (chip.dataset.positionAligned === "true") return;
      const parts = chip.textContent.split("·");
      const name = (parts[0] || "").trim();
      const position = (parts[1] || "").trim();
      if (!name || !position) return;
      chip.innerHTML = `<span class="matchday-chip-name">${name}</span><span class="matchday-chip-separator">·</span><span class="matchday-chip-position">${position}</span>`;
      chip.dataset.positionAligned = "true";
    });
  }

  function refreshFootballIcons() {
    // Player action Goal button.
    document.querySelectorAll('.matchday-player-action-grid button[data-player-action="Goal"] span').forEach(span => {
      span.innerHTML = FOOTBALL_ICON;
    });

    // Recorded goal / opponent-goal rows. Do not replace card/note icons.
    if (typeof state !== "undefined") {
      const records = document.getElementById("matchday-unified-records");
      if (records) {
        const sorted = (state.events || [])
          .map((event, index) => ({ event, index }))
          .sort((a,b) => Number(a.event.minute || 0) - Number(b.event.minute || 0));
        [...records.querySelectorAll(".matchday-event-row")].forEach((row, rowIndex) => {
          const event = sorted[rowIndex]?.event;
          if (!event || !["Goal", "Opponent Goal"].includes(event.type)) return;
          const icon = row.querySelector(".matchday-row-icon");
          if (icon) icon.innerHTML = FOOTBALL_ICON;
        });
      }
    }
  }

  function yellowCount(playerId) {
    if (!playerId || typeof state === "undefined") return 0;
    return (state.events || []).filter(event =>
      event.type === "Card" &&
      event.playerId === playerId &&
      event.cardType === "Yellow"
    ).length;
  }

  function installSecondYellowRule() {
    const add = document.getElementById("matchday-unified-add");
    if (!add || add.dataset.secondYellowReady === "true") return;
    add.dataset.secondYellowReady = "true";

    // Capture phase means we change the selected event type before the existing
    // Matchday handler records it.
    add.addEventListener("click", () => {
      const type = document.getElementById("matchday-unified-type");
      const player = document.getElementById("matchday-unified-player");
      if (!type || !player || type.value !== "Yellow Card") return;
      if (yellowCount(player.value) < 1) return;

      type.value = "Red Card";
      type.dispatchEvent(new Event("change", { bubbles:true }));
    }, true);
  }

  function polish() {
    removeBottomQuickActions();
    decoratePlayerChips();
    refreshFootballIcons();
    installSecondYellowRule();
  }

  // Re-apply after Matchday render functions rebuild their DOM.
  if (typeof renderLineup === "function") {
    const previous = renderLineup;
    renderLineup = function () {
      previous();
      decoratePlayerChips();
      setTimeout(refreshFootballIcons, 0);
    };
  }

  if (typeof renderRecordedItems === "function") {
    const previous = renderRecordedItems;
    renderRecordedItems = function () {
      previous();
      removeBottomQuickActions();
      refreshFootballIcons();
    };
  }

  if (typeof renderLive === "function") {
    const previous = renderLive;
    renderLive = function () {
      previous();
      polish();
    };
  }

  const style = document.createElement("style");
  style.textContent = `
    #matchday-quick-actions { display:none !important; }
    .matchday-lineup-chip {
      display:grid !important;
      grid-template-columns:minmax(0,1fr) auto auto;
      align-items:center;
      column-gap:5px;
    }
    .matchday-chip-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:left; }
    .matchday-chip-separator { opacity:.5; }
    .matchday-chip-position { min-width:34px; text-align:right; font-variant-numeric:tabular-nums; }
    .matchday-row-icon svg,
    .matchday-player-action-grid .quick-goal svg {
      fill:none !important;
      stroke:currentColor !important;
      stroke-width:1.55 !important;
      stroke-linejoin:round !important;
      stroke-linecap:round !important;
    }
  `;
  document.head.appendChild(style);

  polish();
  setTimeout(polish, 150);
})();
