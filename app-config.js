// Welling Match shared data configuration.
// Excel remains the source of truth. Welling Dashboard publishes the JSON and
// Welling Match consumes those same published files.

window.WELLING_APP_CONFIG = {
  dashboardPlayersUrl: "https://dansmith75.github.io/welling-dashboard/data/players.json",
  dashboardMatchesUrl: "https://dansmith75.github.io/welling-dashboard/data/matches.json"
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
// now reconciled from Supabase into Excel by UPDATE-WELLING.
window.addEventListener("load", () => {
  document.getElementById("export-excel-csv")?.remove();
});

function loadMatchdayExportNormalizer() {
  if (document.querySelector('script[data-welling-matchday-export-normalize]')) return;
  const normalizer = document.createElement("script");
  normalizer.src = "matchday-export-normalize.js";
  normalizer.dataset.wellingMatchdayExportNormalize = "true";
  document.body.appendChild(normalizer);
}

// Load the presentation layer after the core Attendance and Matchday scripts.
window.addEventListener("DOMContentLoaded", () => {
  if (document.querySelector('script[data-welling-ui-polish]')) return;
  const script = document.createElement("script");
  script.src = "ui-polish.js";
  script.dataset.wellingUiPolish = "true";
  script.addEventListener("load", () => {
    if (!document.querySelector('link[data-welling-ui-final]')) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "ui-final.css";
      css.dataset.wellingUiFinal = "true";
      document.head.appendChild(css);
    }

    if (!document.querySelector('script[data-welling-matchday-final]')) {
      const finalScript = document.createElement("script");
      finalScript.src = "matchday-final.js";
      finalScript.dataset.wellingMatchdayFinal = "true";
      finalScript.addEventListener("load", () => {
        if (document.querySelector('script[data-welling-matchday-details]')) {
          loadMatchdayExportNormalizer();
          return;
        }
        const detailScript = document.createElement("script");
        detailScript.src = "matchday-details.js";
        detailScript.dataset.wellingMatchdayDetails = "true";
        detailScript.addEventListener("load", loadMatchdayExportNormalizer, { once: true });
        document.body.appendChild(detailScript);
      }, { once: true });
      document.body.appendChild(finalScript);
    } else {
      loadMatchdayExportNormalizer();
    }
  }, { once: true });
  document.body.appendChild(script);
}, { once: true });
