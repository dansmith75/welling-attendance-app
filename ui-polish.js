// Final UI polish layer. Presentation/toggle behaviour only; core Matchday data stays in matchday.js.
(() => {
  function initPolish() {
    const BRAND_NAME = "Welling United Youth & Development";

    const attendanceBrand = document.querySelector(".app-header .eyebrow");
    if (attendanceBrand) attendanceBrand.textContent = BRAND_NAME;

    // Turn the existing Change control into the current-user button on the far right.
    const appHeader = document.querySelector(".app-header");
    const headerText = appHeader?.querySelector(".header-text");
    const currentUserLine = document.querySelector(".current-user-line");
    const currentUserName = document.getElementById("current-user-name");
    const changeUser = document.getElementById("change-user");
    if (appHeader && headerText && changeUser) {
      changeUser.classList.remove("link-button");
      changeUser.classList.add("header-user-button");
      changeUser.setAttribute("aria-label", "Change user");
      appHeader.appendChild(changeUser);
      if (currentUserLine) currentUserLine.classList.add("header-user-line-hidden");

      const refreshHeaderUser = () => {
        const name = (typeof currentUser !== "undefined" && currentUser?.name) ? currentUser.name : "User";
        changeUser.textContent = name;
      };
      refreshHeaderUser();
      if (currentUserName) {
        new MutationObserver(refreshHeaderUser).observe(currentUserName, { childList:true, characterData:true, subtree:true });
      }
    }

    // Attendance status buttons are true toggles: tapping the selected status clears it.
    const list = document.getElementById("player-list");
    if (list && typeof attendance !== "undefined" && typeof players !== "undefined") {
      list.addEventListener("click", (event) => {
        const button = event.target.closest(".status-button.selected");
        if (!button) return;
        const card = button.closest(".player-card");
        const name = card?.querySelector(".player-name")?.textContent?.trim();
        const player = players.find(p => p.displayName === name);
        if (!player) return;
        const selectedStatus = getPlayerStatusForCurrentSession(player.id);
        if (selectedStatus !== button.textContent.trim()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        delete attendance[player.id];
        saveSession();
        renderPlayers();
        updateSummary();
      }, true);
    }

    if (typeof md === "undefined" || typeof state === "undefined") return;

    // Matchday header.
    const header = document.querySelector(".matchday-header");
    if (header) {
      md.close.textContent = "Back";
      md.close.setAttribute("aria-label", "Back to Attendance");
      const headerEyebrow = header.querySelector(".eyebrow");
      if (headerEyebrow) headerEyebrow.textContent = BRAND_NAME;
      const headerLeft = header.firstElementChild;
      if (headerLeft && !header.querySelector(".matchday-header-logo")) {
        const logo = document.createElement("img");
        logo.src = "Welling-Logo.jpg";
        logo.alt = "Welling United logo";
        logo.className = "matchday-header-logo";
        header.insertBefore(logo, headerLeft);
        headerLeft.classList.add("matchday-header-copy");
      }
    }

    [md.lineup, md.subList, md.legacyEventList].forEach(el => {
      const section = el?.closest(".matchday-live-section");
      const heading = section?.querySelector("h3");
      if (heading) heading.classList.add("matchday-polish-divider");
    });

    // Scoreboard 50/50 split.
    const board = md.clock?.closest(".matchday-scoreboard");
    const oldScore = document.getElementById("matchday-live-score");
    const opponentButton = document.querySelector(".matchday-opponent-goal");
    if (board && oldScore && opponentButton && !board.querySelector(".matchday-score-grid")) {
      const fixtureTitle = md.liveFixture;
      const grid = document.createElement("div");
      grid.className = "matchday-score-grid";

      const timePanel = document.createElement("div");
      timePanel.className = "matchday-score-panel matchday-time-panel";
      const timeLabel = document.createElement("div");
      timeLabel.className = "matchday-score-panel-label";
      timeLabel.textContent = "Match Time";
      timePanel.append(timeLabel, md.clock, md.clockState, md.pause, md.resume);

      const scorePanel = document.createElement("div");
      scorePanel.className = "matchday-score-panel matchday-result-panel";
      const scoreLabel = document.createElement("div");
      scoreLabel.className = "matchday-score-panel-label";
      scoreLabel.textContent = "Score";
      const teamLine = document.createElement("div");
      teamLine.id = "matchday-team-score";
      teamLine.className = "matchday-team-score";
      scorePanel.append(scoreLabel, teamLine, opponentButton);

      board.querySelector(".matchday-score-line")?.remove();
      fixtureTitle.insertAdjacentElement("afterend", grid);
      grid.append(timePanel, scorePanel);
    }

    function isAwayFixture(f) {
      const venue = String(f?.venue || f?.homeAway || f?.home_away || "").trim().toLowerCase();
      return venue === "away" || venue.startsWith("away ") || venue.includes(" away");
    }

    function fixtureLocation(f) {
      if (!f) return "";
      return isAwayFixture(f) ? "Away" : "Home";
    }

    function scoreCounts() {
      let ours = 0;
      let theirs = 0;
      (state.events || []).forEach(event => {
        if (event.type === "Goal") ours += 1;
        else if (event.type === "Opponent Goal") theirs += 1;
      });
      return { ours, theirs };
    }

    function renderFixtureAndScore() {
      const target = document.getElementById("matchday-team-score");
      const f = typeof fixture === "function" ? fixture() : null;
      if (!target || !f) return;

      const { ours, theirs } = scoreCounts();
      const away = isAwayFixture(f);
      const opposition = f?.opposition || "Opponent";
      const leftName = away ? opposition : "Welling";
      const rightName = away ? "Welling" : opposition;
      const leftScore = away ? theirs : ours;
      const rightScore = away ? ours : theirs;

      target.innerHTML = `
        <div class="matchday-score-value">${leftScore} - ${rightScore}</div>
        <div class="matchday-score-teamline">${leftName} vs ${rightName}</div>
      `;

      const location = fixtureLocation(f);
      if (md.liveFixture) {
        const base = `${f.date || ""} · ${opposition} · ${f.competition || ""}`.replace(/(^ · | · $)/g, "");
        md.liveFixture.textContent = `${base} · ${location}`;
      }
    }

    // Small inline SVG icons so they look consistent across iOS/Android/desktop.
    const ICONS = {
      goal: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m12 7 3 2-1 4h-4L9 9l3-2Zm-5 4-2 2 2 4 3-1m7-5 2 2-2 4-3-1m-4 4 2 1 2-1"/></svg>',
      yellow: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2"/></svg>',
      red: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2"/></svg>',
      note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5Z"/></svg>',
      sub: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 3-3 3 3M10 4v10m7 3-3 3-3-3m3 3V10"/></svg>',
      tool: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6a4 4 0 0 0-5 5L3 17l4 4 6-6a4 4 0 0 0 5-5l-3 3-3-3 2-4Z"/></svg>'
    };

    function iconForEvent(event) {
      if (event.type === "Goal" || event.type === "Opponent Goal") return ICONS.goal;
      if (event.type === "Card" && event.cardType === "Yellow") return ICONS.yellow;
      if (event.type === "Card" && event.cardType === "Red") return ICONS.red;
      if (event.type === "Card" && event.cardType === "Sin Bin") return ICONS.yellow;
      if (event.type === "Note") return ICONS.note;
      return ICONS.note;
    }

    function decorateRecordedRows() {
      // Substitutions: minute | red player | arrow | green player | spanner.
      const subRows = [...(md.subList?.querySelectorAll(".matchday-sub-row") || [])];
      subRows.forEach((row, index) => {
        const sub = state.substitutions[index];
        if (!sub) return;
        const spannerButton = row.querySelector("button");
        row.classList.add("matchday-sub-row-polished");
        row.innerHTML = `
          <span class="matchday-row-icon matchday-row-icon-sub">${ICONS.sub}</span>
          <strong class="matchday-row-minute">${sub.minute}'</strong>
          <span class="matchday-sub-player matchday-sub-off">${playerName(sub.off)}${playerPosition(sub.off) ? ` <small>${playerPosition(sub.off)}</small>` : ""}</span>
          <span class="matchday-sub-arrow">→</span>
          <span class="matchday-sub-player matchday-sub-on">${playerName(sub.on)}${playerPosition(sub.on) ? ` <small>${playerPosition(sub.on)}</small>` : ""}</span>
        `;
        if (spannerButton) {
          spannerButton.innerHTML = ICONS.tool;
          spannerButton.classList.add("matchday-spanner-icon");
          row.appendChild(spannerButton);
        }
      });

      const records = document.getElementById("matchday-unified-records");
      if (records) {
        const sorted = (state.events || []).map((event, index) => ({ event, index })).sort((a,b) => Number(a.event.minute||0)-Number(b.event.minute||0));
        [...records.querySelectorAll(".matchday-event-row")].forEach((row, rowIndex) => {
          const item = sorted[rowIndex];
          if (!item) return;
          const { event } = item;
          const span = row.querySelector("span");
          const button = row.querySelector("button");
          row.classList.add("matchday-event-row-polished");
          if (span && !row.querySelector(".matchday-row-icon")) {
            const icon = document.createElement("span");
            icon.className = `matchday-row-icon ${event.type === "Card" && event.cardType === "Yellow" ? "yellow" : event.type === "Card" && event.cardType === "Red" ? "red" : event.type === "Opponent Goal" ? "opponent-goal" : ""}`;
            icon.innerHTML = iconForEvent(event);
            row.insertBefore(icon, span);
          }
          if (button) {
            button.innerHTML = ICONS.tool;
            button.classList.add("matchday-spanner-icon");
          }
        });
      }
    }

    // Quick Actions --------------------------------------------------------
    const eventSection = document.getElementById("matchday-unified-records")?.closest(".matchday-live-section");
    let quickActions = document.getElementById("matchday-quick-actions");
    if (eventSection && !quickActions) {
      quickActions = document.createElement("section");
      quickActions.id = "matchday-quick-actions";
      quickActions.className = "matchday-quick-actions";
      quickActions.innerHTML = `
        <div class="matchday-quick-title">Quick actions</div>
        <div class="matchday-quick-grid">
          <button type="button" data-action="our-goal" class="quick-action quick-goal"><span>${ICONS.goal}</span>Our Goal</button>
          <button type="button" data-action="opponent-goal" class="quick-action quick-opponent"><span>${ICONS.goal}</span>Opponent Goal</button>
          <button type="button" data-action="yellow" class="quick-action quick-yellow"><span>${ICONS.yellow}</span>Yellow Card</button>
          <button type="button" data-action="red" class="quick-action quick-red"><span>${ICONS.red}</span>Red Card</button>
          <button type="button" data-action="event" class="quick-action quick-event"><span>${ICONS.note}</span>Player Event</button>
        </div>`;
      eventSection.insertAdjacentElement("afterend", quickActions);
    }

    function unifiedControl(id) { return document.getElementById(id); }
    function focusUnified(type, playerId = "") {
      const typeSelect = unifiedControl("matchday-unified-type");
      if (!typeSelect) return;
      typeSelect.value = type;
      typeSelect.dispatchEvent(new Event("change", { bubbles:true }));
      const playerSelect = unifiedControl("matchday-unified-player");
      if (playerId && playerSelect) {
        playerSelect.value = playerId;
        playerSelect.dispatchEvent(new Event("change", { bubbles:true }));
      }
      document.querySelector(".matchday-unified-event-card")?.scrollIntoView({ behavior:"smooth", block:"center" });
    }

    quickActions?.addEventListener("click", event => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const action = button.dataset.action;
      if (action === "opponent-goal") {
        document.querySelector(".matchday-opponent-goal")?.click();
        return;
      }
      if (action === "our-goal") focusUnified("Goal");
      if (action === "yellow") focusUnified("Yellow Card");
      if (action === "red") focusUnified("Red Card");
      if (action === "event") focusUnified("Event");
    });

    // Tap a player chip for player-specific quick actions.
    let playerActionOverlay = document.getElementById("matchday-player-action-overlay");
    if (!playerActionOverlay) {
      playerActionOverlay = document.createElement("div");
      playerActionOverlay.id = "matchday-player-action-overlay";
      playerActionOverlay.className = "matchday-player-action-overlay hidden";
      playerActionOverlay.innerHTML = `
        <div class="matchday-player-action-dialog">
          <strong id="matchday-player-action-name"></strong>
          <div class="matchday-player-action-grid">
            <button data-player-action="Goal" class="quick-action quick-goal"><span>${ICONS.goal}</span>Goal</button>
            <button data-player-action="Yellow Card" class="quick-action quick-yellow"><span>${ICONS.yellow}</span>Yellow Card</button>
            <button data-player-action="Red Card" class="quick-action quick-red"><span>${ICONS.red}</span>Red Card</button>
            <button data-player-action="Event" class="quick-action quick-event"><span>${ICONS.note}</span>Player Event</button>
            <button data-player-action="Substitution" class="quick-action quick-sub"><span>${ICONS.sub}</span>Substitution</button>
          </div>
          <button id="matchday-player-action-cancel" class="secondary-button matchday-wide" type="button">Cancel</button>
        </div>`;
      document.body.appendChild(playerActionOverlay);
    }
    let selectedPitchPlayer = "";

    function attachPitchActions() {
      md.lineup?.querySelectorAll(".matchday-lineup-chip").forEach(chip => {
        if (chip.dataset.actionReady === "true") return;
        chip.dataset.actionReady = "true";
        chip.tabIndex = 0;
        chip.setAttribute("role", "button");
        const activate = () => {
          const chipName = chip.textContent.split("·")[0].trim();
          const id = state.lineupIds.find(playerId => playerName(playerId) === chipName);
          if (!id) return;
          selectedPitchPlayer = id;
          document.getElementById("matchday-player-action-name").textContent = `${playerName(id)}${playerPosition(id) ? ` (${playerPosition(id)})` : ""}`;
          playerActionOverlay.classList.remove("hidden");
        };
        chip.addEventListener("click", activate);
        chip.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } });
      });
    }

    playerActionOverlay?.addEventListener("click", event => {
      if (event.target === playerActionOverlay || event.target.id === "matchday-player-action-cancel") {
        playerActionOverlay.classList.add("hidden");
        return;
      }
      const button = event.target.closest("button[data-player-action]");
      if (!button || !selectedPitchPlayer) return;
      const action = button.dataset.playerAction;
      playerActionOverlay.classList.add("hidden");
      if (action === "Substitution") {
        if (md.subOff) md.subOff.value = selectedPitchPlayer;
        md.subOff?.dispatchEvent(new Event("change", { bubbles:true }));
        md.subOff?.closest(".matchday-live-section")?.scrollIntoView({ behavior:"smooth", block:"center" });
        return;
      }
      focusUnified(action, selectedPitchPlayer);
    });

    if (typeof renderRecordedItems === "function") {
      const previousRenderRecordedItems = renderRecordedItems;
      renderRecordedItems = function () {
        previousRenderRecordedItems();
        renderFixtureAndScore();
        decorateRecordedRows();
      };
    }
    if (typeof renderLineup === "function") {
      const previousRenderLineup = renderLineup;
      renderLineup = function () {
        previousRenderLineup();
        attachPitchActions();
      };
    }
    if (typeof renderLive === "function") {
      const previousRenderLive = renderLive;
      renderLive = function () {
        previousRenderLive();
        renderFixtureAndScore();
        decorateRecordedRows();
        attachPitchActions();
      };
    }
    md.fixture?.addEventListener("change", () => setTimeout(renderFixtureAndScore, 0));
    renderFixtureAndScore();
    decorateRecordedRows();
    attachPitchActions();

    const style = document.createElement("style");
    style.textContent = `
      .app-header,.matchday-header{width:min(100%,760px)!important;min-height:110px;margin:0 auto!important;padding:18px 16px!important;display:grid!important;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;background:var(--primary);color:#fff}
      .app-header .club-logo,.matchday-header-logo{width:74px;height:74px;object-fit:contain;border-radius:50%;background:#fff;padding:5px}
      .header-text,.matchday-header-copy{min-width:0}.app-header .eyebrow,.matchday-header .eyebrow,.matchday-header .eyebrow.dark{margin:0!important;color:#fff!important;opacity:.9!important;font-size:.76rem!important;font-weight:900!important;text-transform:uppercase;letter-spacing:.06em}.app-header h1,.matchday-header h2{margin:2px 0 5px!important;color:#fff;font-size:2em!important;line-height:1.17;font-weight:bold}.header-user-line-hidden{display:none!important}.header-user-button,.matchday-header #close-matchday{justify-self:end;align-self:center;border:1px solid var(--border);border-radius:11px;padding:12px 16px;min-width:86px;background:#fff;color:#111827;font-weight:900;text-decoration:none}

      .matchday-scoreboard{padding:16px!important}.matchday-score-grid{display:grid;grid-template-columns:1fr 1fr;margin-top:12px;border-top:1px solid rgba(255,255,255,.24)}.matchday-score-panel{min-width:0;padding:14px 16px;display:flex;flex-direction:column;align-items:center}.matchday-score-panel+.matchday-score-panel{border-left:1px solid rgba(255,255,255,.24)}.matchday-score-panel-label{font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em;opacity:.78;margin-bottom:8px}.matchday-time-panel .matchday-clock,.matchday-score-value{margin:0;font-size:clamp(3rem,10vw,5rem);line-height:1.05;font-weight:1000;font-variant-numeric:tabular-nums;letter-spacing:-.05em;white-space:nowrap}.matchday-time-panel .matchday-clock-state,.matchday-score-teamline{margin:14px 0 0;min-height:22px;font-size:.78rem;line-height:1.35;font-weight:900;text-transform:uppercase;letter-spacing:.02em;opacity:.82;text-align:center}.matchday-time-panel #matchday-pause,.matchday-time-panel #matchday-resume,.matchday-result-panel .matchday-opponent-goal{width:100%;max-width:240px;min-height:50px;margin-top:24px!important;margin-bottom:0!important}.matchday-time-panel #matchday-pause,.matchday-time-panel #matchday-resume{background:#fff3df;border-color:#fdba74;color:#9a4d00}.matchday-result-panel .matchday-opponent-goal{display:block}.matchday-team-score{width:100%;display:flex;flex-direction:column;align-items:center}

      .matchday-live-actions{display:none!important}.matchday-live-section{margin-top:18px!important;padding-top:0!important;border-top:0!important}.matchday-polish-divider,.matchday-divider-title{width:100%;margin:0 0 14px!important;padding:11px 14px!important;border-radius:9px;background:#eef0f3;color:#1f2937;font-size:1.08rem;line-height:1.2;text-align:left;box-sizing:border-box}.matchday-lineup,.matchday-sub-grid,.matchday-sub-list,.matchday-unified-event-card{margin-left:0!important;margin-right:0!important}

      .matchday-lineup-chip[role="button"]{cursor:pointer;transition:transform .12s ease,box-shadow .12s ease}.matchday-lineup-chip[role="button"]:active{transform:scale(.97)}
      .matchday-row-icon{display:grid;place-items:center;width:26px;height:26px;flex:0 0 26px}.matchday-row-icon svg,.quick-action svg,.matchday-spanner-icon svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.matchday-row-icon.yellow svg{fill:#fbbf24;stroke:#f59e0b}.matchday-row-icon.red svg{fill:#dc2626;stroke:#b91c1c}.matchday-row-icon.opponent-goal{color:#c8102e}.matchday-row-icon-sub{color:#16a34a}
      .matchday-spanner-icon{display:grid!important;place-items:center!important;width:40px!important;height:40px!important;padding:8px!important;flex:0 0 40px}.matchday-spanner-icon svg{width:19px;height:19px}

      .matchday-sub-row-polished{display:grid!important;grid-template-columns:26px 42px minmax(0,1fr) 24px minmax(0,1fr) 40px;align-items:center;gap:8px;background:#fff!important;border-bottom:1px solid #eef0f3;border-radius:0!important;padding:10px 4px!important}.matchday-sub-row-polished:first-child{border-top:1px solid #eef0f3}.matchday-row-minute{font-variant-numeric:tabular-nums}.matchday-sub-player{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-width:0;border-radius:10px;padding:8px 10px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.matchday-sub-player small{font-size:.68rem;opacity:.8}.matchday-sub-off{background:#fee2e2;color:#b91c1c;border:1px solid #fecaca}.matchday-sub-on{background:#dcfce7;color:#15803d;border:1px solid #bbf7d0}.matchday-sub-arrow{text-align:center;font-size:1.25rem;font-weight:1000;color:#c8102e}
      .matchday-event-row-polished{display:grid!important;grid-template-columns:30px minmax(0,1fr) 40px;align-items:center;gap:8px;padding:9px 4px!important;background:#fff!important;border-bottom:1px solid #eef0f3;border-radius:0!important}

      .matchday-quick-actions{margin-top:18px;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:#fff}.matchday-quick-title{padding:11px 14px;background:#eef0f3;font-size:1.08rem;font-weight:900}.matchday-quick-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;padding:12px}.quick-action{min-width:0;min-height:48px;border-radius:10px;border:1px solid var(--border);padding:8px 7px;display:flex;align-items:center;justify-content:center;gap:7px;background:#fff;font-weight:900;font-size:.76rem}.quick-action span{display:grid;place-items:center;flex:0 0 21px}.quick-goal{background:#ecfdf3;border-color:#bbf7d0;color:#15803d}.quick-opponent{background:#fff1f2;border-color:#fecdd3;color:#be123c}.quick-yellow{background:#fffbeb;border-color:#fde68a;color:#a16207}.quick-yellow svg{fill:#fbbf24;stroke:#f59e0b}.quick-red{background:#fef2f2;border-color:#fecaca;color:#b91c1c}.quick-red svg{fill:#dc2626;stroke:#b91c1c}.quick-event{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8}.quick-sub{background:#f0fdf4;border-color:#bbf7d0;color:#15803d}

      .matchday-player-action-overlay{position:fixed;inset:0;z-index:11000;background:rgba(15,23,42,.64);display:flex;align-items:flex-end;justify-content:center;padding:16px}.matchday-player-action-overlay.hidden{display:none!important}.matchday-player-action-dialog{width:min(100%,520px);background:#fff;border-radius:16px;padding:16px;box-shadow:0 24px 60px rgba(0,0,0,.28)}.matchday-player-action-dialog>strong{display:block;font-size:1.1rem;margin-bottom:12px}.matchday-player-action-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.matchday-player-action-grid .quick-action{font-size:.86rem}.matchday-player-action-dialog>.matchday-wide{margin-top:12px}

      @media(max-width:760px){.matchday-quick-grid{grid-template-columns:1fr 1fr 1fr}.matchday-sub-row-polished{grid-template-columns:26px 38px minmax(0,1fr) 20px minmax(0,1fr) 40px;gap:5px}.matchday-sub-player{padding:7px 6px;font-size:.78rem}}
      @media(max-width:620px){.app-header,.matchday-header{min-height:94px;gap:10px}.app-header .club-logo,.matchday-header-logo{width:58px;height:58px}.app-header .eyebrow,.matchday-header .eyebrow,.matchday-header .eyebrow.dark{font-size:.68rem!important}.app-header h1,.matchday-header h2{font-size:1.7em!important}.header-user-button,.matchday-header #close-matchday{min-width:72px;padding:10px 12px}.matchday-score-panel{padding:12px 8px}.matchday-time-panel .matchday-clock,.matchday-score-value{font-size:clamp(2.6rem,12vw,4rem)}.matchday-time-panel .matchday-clock-state,.matchday-score-teamline{font-size:.68rem}.matchday-time-panel #matchday-pause,.matchday-time-panel #matchday-resume,.matchday-result-panel .matchday-opponent-goal{margin-top:18px!important}.matchday-quick-grid{grid-template-columns:1fr 1fr}.matchday-player-action-grid{grid-template-columns:1fr}}
      @media(max-width:420px){.matchday-sub-row-polished{grid-template-columns:34px minmax(0,1fr) 20px minmax(0,1fr) 38px}.matchday-row-icon-sub{display:none}.matchday-sub-player small{display:none}.matchday-quick-grid{grid-template-columns:1fr 1fr}.quick-action{font-size:.72rem}}
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initPolish, { once:true });
  else setTimeout(initPolish, 0);
})();
