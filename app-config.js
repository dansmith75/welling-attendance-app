// Welling Attendance / Matchday shared data configuration.
// Excel remains the source of truth. The Dashboard publishes the JSON and
// Attendance / Matchday consume those same published files.

window.WELLING_APP_CONFIG = {
  dashboardPlayersUrl: "https://dansmith75.github.io/Welling-Utd-Red-OBDSFL/data/players.json",
  dashboardMatchesUrl: "https://dansmith75.github.io/Welling-Utd-Red-OBDSFL/data/matches.json"
};

// Keep the existing app code simple: redirect legacy local JSON requests to
// the shared Dashboard feeds. This means both sites always use one squad and
// one fixture source without maintaining duplicate JSON files here.
(() => {
  const nativeFetch = window.fetch.bind(window);

  window.fetch = (input, init) => {
    if (typeof input === "string") {
      const cleanPath = input.split("?")[0].replace(/^\.\//, "");

      if (cleanPath === "players.json") {
        return nativeFetch(window.WELLING_APP_CONFIG.dashboardPlayersUrl, {
          ...init,
          cache: "no-store"
        });
      }

      if (cleanPath === "matches.json") {
        return nativeFetch(window.WELLING_APP_CONFIG.dashboardMatchesUrl, {
          ...init,
          cache: "no-store"
        });
      }
    }

    return nativeFetch(input, init);
  };
})();

// Matchday starting XI guard.
(() => {
  const MAX_STARTERS = 11;
  const starterList = document.getElementById("matchday-starter-list");
  const startButton = document.getElementById("matchday-start");

  if (!starterList || !startButton) return;

  starterList.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "checkbox" || !input.checked) return;
    const selectedCount = starterList.querySelectorAll('input[type="checkbox"]:checked').length;
    if (selectedCount > MAX_STARTERS) {
      event.stopImmediatePropagation();
      input.checked = false;
      window.alert("Starting lineup is limited to a maximum of 11 players.");
    }
  }, true);

  document.addEventListener("click", (event) => {
    if (event.target !== startButton) return;
    const selectedCount = starterList.querySelectorAll('input[type="checkbox"]:checked').length;
    if (selectedCount > MAX_STARTERS) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.alert(`You currently have ${selectedCount} starters selected. Reduce the starting lineup to 11 or fewer.`);
    }
  }, true);
})();

// Load Matchday extensions after the core scripts have initialised.
window.addEventListener("load", () => {
  const resilience = document.createElement("script");
  resilience.src = "matchday-resilience.js";
  resilience.onload = () => {
    const hooks = document.createElement("script");
    hooks.src = "matchday-resilience-hooks.js";
    hooks.onload = () => {
      const ui = document.createElement("script");
      ui.src = "matchday-ui-v2.js";
      document.body.appendChild(ui);
    };
    document.body.appendChild(hooks);
  };
  document.body.appendChild(resilience);
});
