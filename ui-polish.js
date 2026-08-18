// Final UI polish layer. Presentation/toggle behaviour only; core Matchday data stays in matchday.js.
(() => {
  function initPolish() {
    const BRAND_NAME = "Welling United Youth & Development";

    // Update branding on the main Attendance page and Matchday header.
    const attendanceBrand = document.querySelector(".app-header .eyebrow");
    if (attendanceBrand) attendanceBrand.textContent = BRAND_NAME;

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

    // Matchday header: same visual language and typography as Attendance, with logo and Back button.
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

    // Consistent full-width divider alignment.
    [md.lineup, md.subList, md.legacyEventList].forEach(el => {
      const section = el?.closest(".matchday-live-section");
      const heading = section?.querySelector("h3");
      if (heading) heading.classList.add("matchday-polish-divider");
    });

    // Rebuild scoreboard as a true 50/50 split.
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

      const oldLine = board.querySelector(".matchday-score-line");
      oldLine?.remove();
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

    if (typeof renderRecordedItems === "function") {
      const previousRenderRecordedItems = renderRecordedItems;
      renderRecordedItems = function () {
        previousRenderRecordedItems();
        renderFixtureAndScore();
      };
    }
    if (typeof renderLive === "function") {
      const previousRenderLive = renderLive;
      renderLive = function () {
        previousRenderLive();
        renderFixtureAndScore();
      };
    }
    md.fixture?.addEventListener("change", () => setTimeout(renderFixtureAndScore, 0));
    renderFixtureAndScore();

    const style = document.createElement("style");
    style.textContent = `
      .matchday-header { display:grid !important; grid-template-columns:auto 1fr auto; gap:14px; align-items:center; padding:18px 16px !important; }
      .matchday-header-logo { width:74px; height:74px; object-fit:contain; border-radius:50%; background:#fff; padding:5px; }
      .matchday-header-copy { min-width:0; }
      .matchday-header .eyebrow,
      .matchday-header .eyebrow.dark { margin:0 !important; color:#fff !important; opacity:.9 !important; font-size:.76rem !important; font-weight:900 !important; text-transform:uppercase; letter-spacing:.06em; }
      .matchday-header h2 { margin:2px 0 5px !important; color:#fff; font-size:2em !important; line-height:1.17; font-weight:bold; }
      .matchday-header #close-matchday { align-self:center; }

      .matchday-scoreboard { padding:16px !important; }
      .matchday-score-grid { display:grid; grid-template-columns:1fr 1fr; margin-top:12px; border-top:1px solid rgba(255,255,255,.24); }
      .matchday-score-panel { min-width:0; min-height:300px; padding:14px 16px 12px; display:flex; flex-direction:column; align-items:center; }
      .matchday-score-panel + .matchday-score-panel { border-left:1px solid rgba(255,255,255,.24); }
      .matchday-score-panel-label { font-size:.72rem; font-weight:900; text-transform:uppercase; letter-spacing:.06em; opacity:.78; margin-bottom:8px; }
      .matchday-time-panel .matchday-clock,
      .matchday-score-value { margin:0; font-size:clamp(3rem,10vw,5rem); line-height:1.05; font-weight:1000; font-variant-numeric:tabular-nums; letter-spacing:-.05em; white-space:nowrap; }
      .matchday-time-panel .matchday-clock-state,
      .matchday-score-teamline { margin:14px 0 0; min-height:22px; font-size:.78rem; line-height:1.35; font-weight:900; text-transform:uppercase; letter-spacing:.02em; opacity:.82; text-align:center; }
      .matchday-time-panel #matchday-pause,
      .matchday-time-panel #matchday-resume,
      .matchday-result-panel .matchday-opponent-goal { width:100%; max-width:240px; min-height:50px; margin-top:auto !important; margin-bottom:0 !important; }
      .matchday-time-panel #matchday-pause,
      .matchday-time-panel #matchday-resume { background:#fff3df; border-color:#fdba74; color:#9a4d00; }
      .matchday-result-panel .matchday-opponent-goal { display:block; }
      .matchday-team-score { width:100%; display:flex; flex:0 0 auto; flex-direction:column; align-items:center; }

      .matchday-live-actions { display:none !important; }
      .matchday-live-section { margin-top:18px !important; padding-top:0 !important; border-top:0 !important; }
      .matchday-polish-divider, .matchday-divider-title { width:100%; margin:0 0 14px !important; padding:11px 14px !important; border-radius:9px; background:#eef0f3; color:#1f2937; font-size:1.08rem; line-height:1.2; text-align:left; box-sizing:border-box; }
      .matchday-lineup, .matchday-sub-grid, .matchday-sub-list, .matchday-unified-event-card { margin-left:0 !important; margin-right:0 !important; }

      @media (max-width:620px) {
        .matchday-header-logo { width:58px; height:58px; }
        .matchday-header { gap:10px; }
        .matchday-header .eyebrow,
        .matchday-header .eyebrow.dark { font-size:.76rem !important; }
        .matchday-header h2 { font-size:2em !important; }
        .matchday-score-panel { min-height:255px; padding:12px 8px 10px; }
        .matchday-time-panel .matchday-clock,
        .matchday-score-value { font-size:clamp(2.6rem,12vw,4rem); }
        .matchday-time-panel .matchday-clock-state,
        .matchday-score-teamline { font-size:.68rem; }
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initPolish, { once:true });
  else setTimeout(initPolish, 0);
})();
