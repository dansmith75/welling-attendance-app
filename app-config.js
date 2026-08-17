// Welling Attendance / Matchday shared data configuration.
// Excel remains the source of truth. The Dashboard publishes the JSON and
// Attendance / Matchday consume those same published files.

window.WELLING_APP_CONFIG = {
  dashboardPlayersUrl: "https://dansmith75.github.io/Welling-Utd-Red-OBDSFL/data/players.json",
  dashboardMatchesUrl: "https://dansmith75.github.io/Welling-Utd-Red-OBDSFL/data/matches.json"
};

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

// The old manual Excel CSV workflow is retired. Attendance / Matchday data is
// now reconciled from Supabase into Excel by UPDATE-WELLING. Remove the legacy
// control after app.js has initialised so its old listener cannot affect startup.
window.addEventListener("load", () => {
  document.getElementById("export-excel-csv")?.remove();
});
