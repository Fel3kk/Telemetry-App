let allSessions = [];
let currentData = null;
let currentSeason = 1;
let qualiGapMode = "leader";
const charts = {};

// Global state for Practice Fuel Calculator
let selectedPracticeLaps = new Set();
let practiceFuelMap = new Map();
let lastPracticeSessionId = null;

const COMPOUND_COLORS = {
  SOFT: "#ff3333",
  MEDIUM: "#ffff33",
  HARD: "#ffffff",
  INTERMEDIATE: "#33ff33",
  WET: "#3333ff",
};

const TEAM_COLORS = {
  Mercedes: "#27f4d2",
  Ferrari: "#f91536",
  "Red Bull": "#3671C6",
  McLaren: "#f58020",
  "Aston Martin": "#229971",
  Alpine: "#0093cc",
  Williams: "#64c4ff",
  "Racing Bulls": "#6692ff",
  Haas: "#b6babd",
  Audi: "rgb(240, 70, 70)",
  Cadillac: "#7c7c7c",
  "My Team": "#b81d89",
};

// Mapping track IDs to country flags
const trackToFlag = {
  melbourne: "🇦🇺",
  shanghai: "🇨🇳",
  suzuka: "🇯🇵",
  sakhir: "🇧🇭",
  jeddah: "🇸🇦",
  miami: "🇺🇸",
  imola: "🇮🇹",
  monaco: "🇲🇨",
  catalunya: "🇪🇸",
  montreal: "🇨🇦",
  austria: "🇦🇹",
  silverstone: "🇬🇧",
  spa: "🇧🇪",
  hungaroring: "🇭🇺",
  zandvoort: "🇳🇱",
  monza: "🇮🇹",
  madrid: "🇪🇸",
  baku: "🇦🇿",
  singapore: "🇸🇬",
  texas: "🇺🇸",
  austin: "🇺🇸",
  mexico: "🇲🇽",
  mexico_city: "🇲🇽",
  interlagos: "🇧🇷",
  brazil: "🇧🇷",
  las_vegas: "🇺🇸",
  lasvegas: "🇺🇸",
  "las vegas": "🇺🇸",
  vegas: "🇺🇸",
  losail: "🇶🇦",
  qatar: "🇶🇦",
  abu_dhabi: "🇦🇪",
  yas_marina: "🇦🇪",
  abu: "🇦🇪",
  "abu dhabi": "🇦🇪",
};

// Initialize Supabase
// Replace these with your actual Supabase project credentials
const SUPABASE_URL = "https://kbjjtiajugxvhoboqxwb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtiamp0aWFqdWd4dmhvYm9xeHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwODE5NzUsImV4cCI6MjA5MTY1Nzk3NX0.VI2B5EcQXx_aaXyOB-eGXentTbMRG6obxu6IjUv7juI";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// F1 2026 Calendar Order for sorting
const F1_2026_CALENDAR = [
  "melbourne",
  "shanghai",
  "suzuka",
  "sakhir",
  "jeddah",
  "miami",
  "montreal",
  "monaco",
  "catalunya",
  "austria",
  "silverstone",
  "spa",
  "hungaroring",
  "zandvoort",
  "monza",
  "madring",
  "baku",
  "singapore",
  "texas",
  "mexico",
  "brazil",
  "las_vegas",
  "losail",
  "abu_dhabi",
];

// Suggested team list for driver assignment (datalist/autofill)
const DRIVER_TEAM_SUGGESTIONS = [
  "My Team",
  "Mercedes",
  "Ferrari",
  "McLaren",
  "Red Bull",
  "Racing Bulls",
  "Haas",
  "Audi",
  "Cadillac",
  "Alpine",
  "Williams",
  "Aston Martin",
];

document
  .getElementById("fileInput")
  .addEventListener("change", handleFileUpload);

window.addEventListener("DOMContentLoaded", () => {
  // Initialize Theme
  const themeToggle = document.getElementById("themeToggle");
  const savedTheme = localStorage.getItem("theme");

  if (savedTheme === "light") {
    document.body.classList.add("light-theme");
  }

  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("light-theme");
    const isLight = document.body.classList.contains("light-theme");
    localStorage.setItem("theme", isLight ? "light" : "dark");
  });

  // Load sessions then attempt to auto-load driver teams for the selected season
  loadSavedSessions().then(async () => {
    await autoLoadDriverTeams();
    initCollapsibleSections();
  });

  const qualiGapToggleBtn = document.getElementById("qualiGapToggleBtn");
  if (qualiGapToggleBtn) {
    qualiGapToggleBtn.addEventListener("click", () => {
      qualiGapMode = qualiGapMode === "leader" ? "next" : "leader";
      updateQualiGapButton();
      renderQualiResults();
    });
    updateQualiGapButton();
  }
  // Setup download template button
  const dlBtn = document.getElementById("downloadTemplateBtn");
  if (dlBtn) dlBtn.addEventListener("click", handleDownloadTemplate);

  const dlQualiBtn = document.getElementById("downloadQualiTemplateBtn");
  if (dlQualiBtn)
    dlQualiBtn.addEventListener("click", handleDownloadQualiTemplate);

  document
    .getElementById("searchTrack")
    .addEventListener("input", () => renderSavedSessions(allSessions));
  document
    .getElementById("filterCategory")
    .addEventListener("change", () => renderSavedSessions(allSessions));
  document
    .getElementById("sortSessions")
    .addEventListener("change", () => renderSavedSessions(allSessions));
});

async function handleDownloadTemplate() {
  // Prefer serving the workspace template file if present
  try {
    const resp = await fetch("telemetry_template.json");
    if (resp.ok) {
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "telemetry_template.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return;
    }
  } catch (err) {
    // fall through to fallback template
  }

  // Fallback: build a basic universal template
  const template = {
    track_name: "",
    created_at: new Date().toISOString(),
    driver_name: "X",
    category: "Race",
    season: 1,
    starting_position: null,
    finishing_position: null,
    starting_fuel: null,
    stints: [],
    lap_history: [],
    results: [],
  };

  const blob = new Blob([JSON.stringify([template], null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `telemetry_template.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function handleDownloadQualiTemplate() {
  // Prefer serving the workspace qualifying template file if present
  try {
    const resp = await fetch("qualifying_template.json");
    if (resp.ok) {
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "qualifying_template.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return;
    }
  } catch (err) {
    // fall through to fallback template
  }

  // Fallback: build a basic qualifying template
  const qualiTemplates = [
    {
      track_name: "Silverstone",
      created_at: new Date().toISOString(),
      driver_name: "X",
      category: "Qualifying",
      season: 1,
      session_type: "Q1",
      starting_position: null,
      finishing_position: null,
      starting_fuel: null,
      stints: [],
      lap_history: [],
      results: Array.from({ length: 22 }, (_, i) => ({
        name: `Driver ${i + 1}`,
        position: i + 1,
        q1: `1:${27 + Math.floor(i / 5)}:${(543 + i * 10).toString().padStart(3, "0")}`,
        q2: null,
        q3: null,
        best_lap: `1:${27 + Math.floor(i / 5)}:${(543 + i * 10).toString().padStart(3, "0")}`,
      })),
    },
    {
      track_name: "Silverstone",
      created_at: new Date().toISOString(),
      driver_name: "X",
      category: "Qualifying",
      season: 1,
      session_type: "Q2",
      starting_position: null,
      finishing_position: null,
      starting_fuel: null,
      stints: [],
      lap_history: [],
      results: Array.from({ length: 11 }, (_, i) => ({
        name: `Driver ${i + 1}`,
        position: i + 1,
        q1: null,
        q2: `1:${26 + Math.floor(i / 6)}:${(123 + i * 10).toString().padStart(3, "0")}`,
        q3: null,
        best_lap: `1:${26 + Math.floor(i / 6)}:${(123 + i * 10).toString().padStart(3, "0")}`,
      })),
    },
    {
      track_name: "Silverstone",
      created_at: new Date().toISOString(),
      driver_name: "X",
      category: "Qualifying",
      season: 1,
      session_type: "Q3",
      starting_position: null,
      finishing_position: null,
      starting_fuel: null,
      stints: [],
      lap_history: [],
      results: Array.from({ length: 10 }, (_, i) => ({
        name: `Driver ${i + 1}`,
        position: i + 1,
        q1: null,
        q2: null,
        q3: `1:${25 + Math.floor(i / 10)}:${(987 + i * 10).toString().padStart(3, "0")}`,
        best_lap: `1:${25 + Math.floor(i / 10)}:${(987 + i * 10).toString().padStart(3, "0")}`,
      })),
    },
  ];

  const blob = new Blob([JSON.stringify(qualiTemplates, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `qualifying_template.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Global track normalization for linking sessions
function normalizeTrackName(name) {
  const n = (name || "").toLowerCase().replace(/[\s-]/g, "_");
  if (n === "canada" || n === "canadian_grand_prix") return "montreal";
  if (n === "spain" || n === "spanish_grand_prix" || n === "barcelona") return "catalunya";
  if (n === "madrid" || n === "madring") return "madring";
  if (n === "vegas" || n === "lasvegas") return "las_vegas";
  if (n === "interlagos") return "brazil";
  if (n === "mexico_city") return "mexico";
  if (n === "abu") return "abu_dhabi";
  return n;
}

function getTrackCalendarIndex(trackName) {
  const index = F1_2026_CALENDAR.indexOf(normalizeTrackName(trackName));
  return index === -1 ? 999 : index;
}

function sortSessionsByCalendar(a, b) {
  if ((a.season || 1) !== (b.season || 1)) return (a.season || 1) - (b.season || 1);
  const calendarDiff = getTrackCalendarIndex(a.track_name) - getTrackCalendarIndex(b.track_name);
  if (calendarDiff !== 0) return calendarDiff;
  const categoryOrder = { Sprint: 0, Race: 1 };
  const categoryDiff = (categoryOrder[a.category] ?? 2) - (categoryOrder[b.category] ?? 2);
  if (categoryDiff !== 0) return categoryDiff;
  return new Date(a.created_at || a.session_date || 0) - new Date(b.created_at || b.session_date || 0);
}

let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (currentData) {
      renderContent();
    }
  }, 250);
});

async function handleFileUpload(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  showLoading(true);
  hideError();

  const sessionsToPersist = [];
  let lastProcessedSession = null;

  for (const file of files) {
    const filename = file.name.toLowerCase();
    let category = "Race";
    if (filename.includes("shootout") || filename.includes("sprint_shootout")) {
      category = "Sprint Shootout";
    } else if (filename.includes("qualifying") || filename.includes("quali")) {
      category = "Qualifying";
    } else if (filename.includes("sprint")) {
      category = "Sprint";
    } else if (
      filename.includes("practice") ||
      filename.includes("practise") ||
      filename.includes("fp1") ||
      filename.includes("fp2") ||
      filename.includes("fp3")
    ) {
      category = "Practice";
    } else if (filename.includes("time trial") || filename.includes("tt")) {
      category = "Time Trial";
    }

    try {
      const rawText = await file.text();
      let data = null;
      try {
        data = JSON.parse(rawText);
      } catch (error) {
        const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
        const parsedLines = [];
        for (const line of lines) {
          try {
            parsedLines.push(JSON.parse(line));
          } catch (err) {
            continue;
          }
        }
        data = parsedLines;
      }

      const playerData = processTelemetryData(data);
      if (playerData && playerData.length > 0) {
        const session = playerData[0];
        session.category = category;
        session.season = currentSeason;

        // Fallback: If track is unknown, try to guess from filename
        if (session.track_name === "Unknown" || !session.track_name) {
          const parts = filename.replace(".json", "").split(/[_-]/);
          const trackGuess = parts.find(
            (p) =>
              p !== "race" &&
              p !== "sprint" &&
              p !== "quali" &&
              p !== "qualifying",
          );
          if (trackGuess) session.track_name = trackGuess;
        }

        if (category !== "Practice") {
          sessionsToPersist.push(session);
        }
        lastProcessedSession = session;
      }
    } catch (err) {
      console.error(`Error processing file ${file.name}:`, err);
    }
  }

  if (lastProcessedSession) {
    if (sessionsToPersist.length > 0) {
      // Persist only non-Practice uploaded sessions to the database
      await saveSessions(sessionsToPersist);

      // Set the view to the last uploaded session (finding the persisted version to get its database ID if applicable)
      if (lastProcessedSession.category !== "Practice") {
        currentData =
          allSessions.find(
            (s) => s.session_date === lastProcessedSession.created_at,
          ) || lastProcessedSession;
      } else {
        currentData = lastProcessedSession;
      }
    } else {
      // Practice sessions are treated as temporary previews and not saved to the database
      currentData = lastProcessedSession;
    }

    renderContent();
  } else {
    showError("No valid player data found in the selected files.");
  }

  showLoading(false);
  // Reset input value to allow re-uploading the same files if needed
  e.target.value = "";
}

function showLoading(show) {
  document.getElementById("loading").style.display = show ? "block" : "none";
}

function showError(message) {
  const errorEl = document.getElementById("error");
  errorEl.textContent = message;
  errorEl.style.display = "block";
}

function hideError() {
  document.getElementById("error").style.display = "none";
}

function processTelemetryData(data) {
  // Check if data is already processed summary from get_data.py
  if (Array.isArray(data) && data.length > 0 && data[0].lap_history) {
    console.log("Loading pre-processed telemetry summary");
    return data;
  }

  const results = [];
  let track_name = null;
  let session_type = null;
  let created_at = null;
  let tyre_stints_v2 = [];
  let classification_data = [];

  const dataList = Array.isArray(data) ? data : [data];

  // Thorough search for metadata across packets
  for (const entry of dataList) {
    if (entry && typeof entry === "object") {
      if (!track_name) track_name = entry["session-info"]?.["track-id"];
      if (!session_type) session_type = entry["session-info"]?.["session-type"];
      if (!tyre_stints_v2 || tyre_stints_v2.length === 0) {
        tyre_stints_v2 = entry["tyre-stint-history-v2"] || [];
      }
      if (!classification_data || classification_data.length === 0) {
        classification_data = entry["classification-data"] || [];
      }
      const timestamp_str = entry["debug"]?.["timestamp"];
      if (timestamp_str) {
        created_at = parseTimestamp(timestamp_str);
      }
    }
  }

  if (!track_name) track_name = "Unknown";
  if (!created_at) {
    created_at = new Date().toISOString();
  }

  function findPlayerInObj(obj) {
    if (Array.isArray(obj)) {
      obj.forEach(findPlayerInObj);
      return;
    }
    if (obj && typeof obj === "object") {
      const isPlayerVal = obj["is-player"];
      if (
        isPlayerVal === true ||
        String(isPlayerVal).toLowerCase() === "true"
      ) {
        const driver_name = String(
          obj["driver-name"] || "PLAYER",
        ).toUpperCase();

        // Extract player-specific stints from global V2 history
        let player_stints_data = [];
        let pit_laps_from_stints = {};
        if (Array.isArray(tyre_stints_v2)) {
          const entry = tyre_stints_v2.find((e) => e.name === driver_name);
          if (entry) {
            player_stints_data = entry["tyre-stint-history"] || [];
            player_stints_data.forEach((stint, i) => {
              // Mark pit stops: if a stint ends and another follows, they pitted on end-lap
              if (i < player_stints_data.length - 1) {
                pit_laps_from_stints[stint["end-lap"]] = 1;
              }
            });
          }
        }

        const summary = {
          track_name,
          session_type,
          created_at,
          driver_name: driver_name,
          starting_position: null,
          finishing_position: null,
          starting_fuel: null,
          stints: player_stints_data,
          results:
            classification_data.length > 0
              ? classification_data.map((e) => ({
                  name: String(
                    e["driver-name"] || e.name || "UNKNOWN",
                  ).toUpperCase(),
                  position:
                    e["final-classification"]?.["position"] ||
                    e["track-position"] ||
                    e.position,
                  best_lap:
                    e["final-classification"]?.["best-lap-time-str"] ||
                    e["best-lap-time-str"] ||
                    "N/A",
                  q1:
                    e["final-classification"]?.["q1-time"] ||
                    e["q1-time"] ||
                    e["final-classification"]?.["best-lap-time-str"] ||
                    e["best-lap-time-str"] ||
                    "",
                  q2:
                    e["final-classification"]?.["q2-time"] ||
                    e["q2-time"] ||
                    "",
                  q3:
                    e["final-classification"]?.["q3-time"] ||
                    e["q3-time"] ||
                    "",
                }))
              : Array.isArray(tyre_stints_v2)
                ? tyre_stints_v2.map((e) => ({
                    name: String(
                      e.name || e.driver_name || "UNKNOWN",
                    ).toUpperCase(),
                    position:
                      e["final-classification"]?.["position"] ||
                      e["track-position"] ||
                      e.position,
                    best_lap:
                      e["best-lap-time-str"] || e["best_lap_time_str"] || "N/A",
                    q1: e["q1-time"] || e["q1_time"] || "",
                    q2: e["q2-time"] || e["q2_time"] || "",
                    q3: e["q3-time"] || e["q3_time"] || "",
                  }))
                : [],
          lap_history: [],
        };

        const session_history = obj["session-history"] || {};
        const lap_times_list = session_history["lap-history-data"] || [];
        const per_lap_info = obj["per-lap-info"] || [];
        const final_classification = obj["final-classification"] || {};
        const lap_data = obj["lap-data"] || {};

        summary.starting_position =
          final_classification["grid-position"] ?? null;
        summary.finishing_position = lap_data["car-position"] ?? null;

        const lap0 = per_lap_info.find((l) => l["lap-number"] === 0);
        if (lap0) {
          summary.starting_fuel = Number(
            (lap0["car-status-data"]?.["fuel-in-tank"] || 0).toFixed(2),
          );
        }

        per_lap_info.forEach((lap) => {
          const lap_num = lap["lap-number"];
          if (lap_num === 0 || lap_num === undefined || lap_num === null) {
            return;
          }

          const status = lap["car-status-data"] || {};
          const damage = lap["car-damage-data"] || {};
          const ers = lap["ers-stats"] || {};
          const ldata = lap["lap-data"] || {};

          let time_data = {};
          if (lap_num > 0 && lap_num - 1 < lap_times_list.length) {
            time_data = lap_times_list[lap_num - 1] || {};
          }

          // Robust mapping for SC/VSC/Red Flag strings
          const scMap = {
            SAFETY_CAR: 1,
            FULL_SAFETY_CAR: 1,
            SC: 1,
            VIRTUAL_SAFETY_CAR: 2,
            VSC: 2,
            RED_FLAG: 3,
            RED: 3,
          };
          // Robust mapping for Pit strings
          const pitMap = {
            PITTING: 1,
            PIT: 1,
            IN_PITS: 2,
            PIT_LANE: 2,
            IN_PIT_LANE: 2,
          };

          const scRaw = String(
            lap["max-safety-car-status"] ||
              ldata["safety-car-status"] ||
              ldata["sc_status"] ||
              "0",
          ).toUpperCase();
          const pitRaw = String(
            ldata["pit-status"] || ldata["pit_status"] || "0",
          ).toUpperCase();

          // Check multiple possible keys for FIA flags
          const fiaFlags = String(
            status["vehicle-fia-flags"] ||
              status["fia-flags"] ||
              ldata["fia-flags"] ||
              "NONE",
          ).toUpperCase();

          let sc_status =
            scMap[scRaw] || (isNaN(parseInt(scRaw)) ? 0 : parseInt(scRaw));
          let pit_status =
            pitMap[pitRaw] || (isNaN(parseInt(pitRaw)) ? 0 : parseInt(pitRaw));

          // Override pit status using explicit stint history data
          if (pit_laps_from_stints[lap_num]) {
            pit_status = 1;
          }

          // Red Flag logic from FIA flags (Value 5 or "RED")
          if (fiaFlags === "4" || fiaFlags === "5" || fiaFlags === "RED") {
            sc_status = 3;
          }

          const tyre_wear_values = damage["tyres-wear"] || [0, 0, 0, 0];

          summary.lap_history.push({
            lap: lap_num,
            pit_status: pit_status,
            sc_status: sc_status,
            lap_time: time_data["lap-time-str"] || "00:00.000",
            s1: time_data["sector-1-time-str"] || "0.000",
            s2: time_data["sector-2-time-str"] || "0.000",
            s3: time_data["sector-3-time-str"] || "0.000",
            current_tyre_compound: status["visual-tyre-compound"],
            fuel_kg: Number((status["fuel-in-tank"] || 0).toFixed(2)),
            tyre_wear: {
              FL: Number((tyre_wear_values[0] || 0).toFixed(2)),
              FR: Number((tyre_wear_values[1] || 0).toFixed(2)),
              RL: Number((tyre_wear_values[2] || 0).toFixed(2)),
              RR: Number((tyre_wear_values[3] || 0).toFixed(2)),
            },
            ers_deployed_j: Number((ers["ers-deployed-j"] || 0).toFixed(0)),
            ers_remaining_j: Number(
              (status["ers-store-energy"] || 0).toFixed(0),
            ),
          });
        });

        results.push(summary);
      } else {
        Object.values(obj).forEach(findPlayerInObj);
      }
    }
  }

  findPlayerInObj(data);
  return results;
}

async function loadSavedSessions() {
  try {
    const { data: sessions, error } = await supabaseClient
      .from("telemetry_sessions")
      .select("*")
      .order("season", { ascending: true })
      .order("session_date", { ascending: true });

    if (error) throw error;

    if (sessions && sessions.length) {
      // Map Supabase column names back to our app's object structure if they differ
      const mappedSessions = sessions.map((s) => ({
        ...s,
        starting_position: s.starting_pos,
        finishing_position: s.finishing_pos,
        created_at: s.session_date,
        category: s.category || "Race",
        session_type: s.session_type,
        season: s.season || 1,
        starting_fuel: s.starting_fuel,
        stints: s.stints || [],
        results: s.results || [],
      }));

      // Custom sorting: Season -> F1 2026 Calendar -> Date
      mappedSessions.sort(sortSessionsByCalendar);

      allSessions = mappedSessions;
      renderSeasonSelector();

      renderSavedSessions(allSessions);

      if (!currentData) {
        // Prioritize showing a Race or Sprint as the default session
        currentData =
          mappedSessions.find(
            (s) =>
              s.category !== "Qualifying" && s.category !== "Sprint Shootout",
          ) || mappedSessions[0];
      }
      renderContent();
    }
  } catch (err) {
    console.error("Failed to fetch sessions from Supabase", err);
  }
}

async function saveSessions(sessions) {
  if (!sessions || sessions.length === 0) return;

  const dataToInsert = sessions.map((session) => ({
    driver_name: session.driver_name,
    track_name: session.track_name,
    session_date: session.created_at,
    starting_pos: session.starting_position,
    finishing_pos: session.finishing_position,
    lap_history: session.lap_history,
    category: session.category,
    session_type: session.session_type,
    season: session.season,
    starting_fuel: session.starting_fuel,
    stints: session.stints,
    results: session.results,
  }));

  const { error } = await supabaseClient
    .from("telemetry_sessions")
    .insert(dataToInsert);

  if (error) throw error;
  await loadSavedSessions();
}

async function clearSessionStatus(statusType) {
  if (!currentData || !currentData.id) {
    alert("Please select a saved session first.");
    return;
  }

  const label = statusType === 1 ? "Safety Car" : "VSC";
  if (
    !confirm(
      `Are you sure you want to clear all ${label} statuses for this session?`,
    )
  )
    return;

  currentData.lap_history.forEach((lap) => {
    if (parseInt(lap.sc_status) === statusType) {
      lap.sc_status = 0;
    }
  });

  try {
    const { error } = await supabaseClient
      .from("telemetry_sessions")
      .update({ lap_history: currentData.lap_history })
      .eq("id", currentData.id);

    if (error) throw error;

    renderContent();
    renderSavedSessions(allSessions);
  } catch (err) {
    console.error("Error clearing status:", err);
    alert("Failed to update session: " + (err.message || err));
  }
}

async function deleteSession(id, event) {
  event.stopPropagation();
  if (
    !confirm(
      "Are you sure you want to PERMANENTLY delete this session? This action cannot be undone.",
    )
  )
    return;

  try {
    const { error } = await supabaseClient
      .from("telemetry_sessions")
      .delete()
      .eq("id", id);

    if (error) throw error;
    await loadSavedSessions();
  } catch (err) {
    console.error("Error deleting session", err);
    alert("Failed to delete session.");
  }
}

function renderSeasonSelector() {
  const container = document.getElementById("seasonSelector");
  if (!container) return;

  container.innerHTML = "";

  for (let i = 1; i <= 10; i++) {
    const box = document.createElement("div");
    box.className = `season-box ${currentSeason === i ? "active" : ""}`;
    box.textContent = i;
    box.onclick = () => {
      currentSeason = i;
      renderSeasonSelector();
      renderSavedSessions(allSessions);
    };
    container.appendChild(box);
  }
}

function renderSavedSessions(sessions) {
  const container = document.getElementById("savedSessions");
  const grid = document.getElementById("savedSessionsGrid");
  if (!grid) return;

  // Calculate season-wide statistics
  const seasonSessions = allSessions.filter((s) => s.season === currentSeason);
  const raceWins = seasonSessions.filter(
    (s) => s.category === "Race" && Number(s.finishing_position) === 1,
  ).length;
  const sprintWins = seasonSessions.filter(
    (s) => s.category === "Sprint" && Number(s.finishing_position) === 1,
  ).length;
  const gpPoles = seasonSessions.filter(
    (s) => s.category === "Race" && Number(s.starting_position) === 1,
  ).length;
  const sprintPoles = seasonSessions.filter(
    (s) => s.category === "Sprint" && Number(s.starting_position) === 1,
  ).length;

  grid.innerHTML = "";

  // Render summary cards below the session grid instead of above it
  let summaryContainer = document.getElementById("seasonSummaryCards");
  if (!summaryContainer) {
    summaryContainer = document.createElement("div");
    summaryContainer.id = "seasonSummaryCards";
    summaryContainer.className = "season-summary";
  }
  grid.insertAdjacentElement("afterend", summaryContainer);
  summaryContainer.innerHTML = `
    <div class="stat-card">
      <span class="stat-label">Race Wins</span>
      <span class="stat-value">🏆 ${raceWins}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Sprint Wins</span>
      <span class="stat-value">🏁 ${sprintWins}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">GP Poles</span>
      <span class="stat-value">⏱️ ${gpPoles}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Sprint Poles</span>
      <span class="stat-value">⚡ ${sprintPoles}</span>
    </div>
  `;
  const searchQuery = document
    .getElementById("searchTrack")
    .value.toLowerCase();
  const catFilter = document.getElementById("filterCategory").value;
  const sortVal = document.getElementById("sortSessions").value;

  // Group sessions by Track + Season + Event type (GP vs Sprint)
  const trackGroups = {};
  sessions.forEach((s) => {
    if (s.season !== currentSeason) return;

    // Separate GP (Race/Quali) from Sprint (Sprint/Shootout) into different cards
    // while keeping Qualifying data attached to its corresponding main session.
    let eventGroup = s.category;
    if (s.category === "Qualifying") eventGroup = "Race";
    if (s.category === "Sprint Shootout") eventGroup = "Sprint";

    const key = `${normalizeTrackName(s.track_name)}_${s.season}_${eventGroup}`;
    if (!trackGroups[key]) trackGroups[key] = [];
    trackGroups[key].push(s);
  });

  // Priority for which session represents the "Card" in the sidebar
  const priority = {
    Race: 0,
    Sprint: 1,
    "Sprint Shootout": 2,
    Qualifying: 3,
    Practice: 4,
  };

  let displaySessions = [];
  for (const key in trackGroups) {
    const group = trackGroups[key];

    // Sort group so Race > Sprint > Quali
    group.sort(
      (a, b) => (priority[a.category] ?? 99) - (priority[b.category] ?? 99),
    );

    const rep = group[0]; // Representative session (usually the Race)

    const matchSearch = (rep.track_name || "")
      .toLowerCase()
      .includes(searchQuery);
    const matchCat = catFilter === "all" || rep.category === catFilter;

    if (matchSearch && matchCat) {
      displaySessions.push(rep);
    }
  }

  if (sortVal === "date_desc")
    displaySessions.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    );
  if (sortVal === "date_asc")
    displaySessions.sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at),
    );

  displaySessions.forEach((session) => {
    const trackKey = (session.track_name || "").toLowerCase();
    const flag = `<span class="flag-icon" title="${session.track_name}">${trackToFlag[trackKey] || "🏁"}</span>`;

    const isWin = Number(session.finishing_position) === 1;
    const winMarker = isWin
      ? '<span class="result-tag win-marker">🏁 WIN</span>'
      : "";
    const startPos = session.starting_position || 0;
    const isPole = startPos === 1;
    const poleMarker = isPole
      ? '<span class="result-tag pole-marker">🥇 POLE</span>'
      : "";
    const weatherIcon = determineWeatherIcon(session);

    const finPos = session.finishing_position || 0;
    const diff = startPos - finPos;
    const diffText = diff > 0 ? `+${diff}` : diff < 0 ? diff : "0";
    const diffClass = diff > 0 ? "pos-gain" : diff < 0 ? "pos-loss" : "";

    const card = document.createElement("div");
    card.className = `session-card ${currentData && currentData.id === session.id ? "active" : ""}`;

    card.innerHTML = `
      <button class="delete-btn" title="Delete">🗑️</button>
      <div class="session-badges">
        <span class="category-badge">${session.category}</span>
        ${winMarker}
        ${poleMarker}
      </div>
      <div class="track-title" style="margin-bottom: 2px; font-size: 0.85rem;">${flag} ${session.track_name} ${weatherIcon}</div>
      <div style="display: flex; justify-content: space-between; align-items: flex-end;">
        <div style="font-size: 0.75em; color: #888; line-height: 1.2;">
          ${new Date(session.created_at).toLocaleDateString()}<br>
          ${session.driver_name}
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.65em; color: #aaa; text-transform: uppercase;">Pos</div>
          <div style="font-size: 1.05em; font-weight: bold;">
            ${startPos || "?"}→${finPos || "?"} 
            <span class="${diffClass}" style="font-size: 0.8em; margin-left: 2px;">(${diffText})</span>
          </div>
        </div>
      </div>
    `;

    card.querySelector(".delete-btn").onclick = (e) =>
      deleteSession(session.id, e);

    card.addEventListener("click", (e) => {
      if (e.target.closest(".delete-btn")) return;
      currentData = session;
      renderContent();
      renderSavedSessions(allSessions);
    });

    grid.appendChild(card);
  });

  renderStandingsTable();

  container.style.display = sessions.length ? "block" : "none";
}

function determineWeatherIcon(session) {
  const laps = session.lap_history || [];
  if (laps.length === 0)
    return '<span class="weather-icon" title="Dry Conditions">☀️</span>';

  let hasDry = false;
  let hasWet = false;

  laps.forEach((l) => {
    const val = l.current_tyre_compound;
    if (val === undefined || val === null) return;

    const c = String(val).toUpperCase().trim();
    if (!c) return;

    // Check for Wet compounds (Keywords, Shorthand, or F1 Game IDs 7, 8, 15)
    if (
      c.includes("INTER") ||
      c.includes("WET") ||
      c.includes("RAIN") ||
      c === "I" ||
      c === "W" ||
      c === "7" ||
      c === "8" ||
      c === "15"
    ) {
      hasWet = true;
    }
    // Check for Dry compounds (Keywords, Shorthand, or F1 Game IDs 16-20)
    else if (
      c.includes("SOFT") ||
      c.includes("MEDIUM") ||
      c.includes("HARD") ||
      c === "S" ||
      c === "M" ||
      c === "H" ||
      (parseInt(c) >= 16 && parseInt(c) <= 20)
    ) {
      hasDry = true;
    }
  });

  if (hasDry && hasWet)
    return '<span class="weather-icon" title="Mixed Conditions">⛅</span>';
  if (hasWet)
    return '<span class="weather-icon" title="Rainy Conditions">🌧️</span>';
  return '<span class="weather-icon" title="Dry Conditions">☀️</span>';
}

function parseTimestamp(timestampStr) {
  try {
    const cleaned = String(timestampStr).split(" Central")[0].trim();
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  } catch (err) {
    // fall back
  }
  return new Date().toISOString();
}

function renderContent() {
  if (!currentData) return;

  renderSessionInfo();
  renderCharts();
  renderStints();
  renderTable();
  renderQualiResults();
  renderPracticeSection();
  document.getElementById("content").style.display = "block";
}

function showPracticeSectionIfNeeded() {
  const practiceButton = document.querySelector(
    '.section-tab[data-target="section-practice"]',
  );
  if (!practiceButton) return;

  const practiceSection = document.getElementById("section-practice");
  if (!practiceSection) return;

  if (
    currentData &&
    (currentData.category === "Practice" || currentData.category === "Sprint")
  ) {
    practiceSection.style.display = "block";
  } else {
    practiceSection.style.display = "none";
  }
}

function renderPracticeSection() {
  const practiceStintSection = document.getElementById("practiceStintSection");
  const practiceLapContainer = document.getElementById("practiceLapContainer");
  const practiceNotice = document.getElementById("practiceNotice");
  if (!practiceStintSection || !practiceLapContainer) return;

  const isEligibleForReview =
    currentData &&
    (currentData.category === "Practice" || currentData.category === "Sprint");

  if (!isEligibleForReview) {
    practiceStintSection.style.display = "none";
    practiceLapContainer.style.display = "none";
    if (practiceNotice) practiceNotice.style.display = "block";
    return;
  }

  // Reset selection if session changed
  const sessId = currentData.id || currentData.created_at;
  if (sessId !== lastPracticeSessionId) {
    selectedPracticeLaps.clear();
    lastPracticeSessionId = sessId;
  }

  practiceStintSection.style.display = "block";
  practiceLapContainer.style.display = "block";
  if (practiceNotice) practiceNotice.style.display = "none";

  // Ensure Fuel Calculator container exists
  let calcContainer = document.getElementById("practiceFuelCalculator");
  if (!calcContainer) {
    calcContainer = document.createElement("div");
    calcContainer.id = "practiceFuelCalculator";
    calcContainer.className = "fuel-calc-container";
    practiceLapContainer.insertAdjacentElement("beforebegin", calcContainer);
  }
  renderFuelCalculatorUI(calcContainer);

  renderPracticeStints();
  renderPracticeTable();
  updateFuelCalculator();
}

function renderPracticeStints() {
  const stintTableBody = document.getElementById("practiceStintTableBody");
  const stintSection = document.getElementById("practiceStintSection");
  if (!stintTableBody || !stintSection) return;

  const stints = calculateStints();
  if (stints.length === 0) {
    stintSection.style.display = "none";
    return;
  }

  stintSection.style.display = "block";
  stintTableBody.innerHTML = "";

  stints.forEach((stint, index) => {
    const compKey = String(stint.compound).toUpperCase();
    const dotColor = COMPOUND_COLORS[compKey] || "#888";
    const rgba = (hex, a) => {
      const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${a})`;
    };
    const wearCls = (v) => v < 1.0 ? "wear-low" : v < 2.0 ? "wear-med" : "wear-high";
    const compoundBadge = `<span class="compound-badge" style="background:${rgba(dotColor, 0.12)};border-color:${rgba(dotColor, 0.45)};color:${dotColor}"><span class="compound-dot" style="background-color:${dotColor}"></span>${stint.compound}</span>`;
    const row = document.createElement("tr");
    row.innerHTML = `
        <td class="text-center"><strong>Stint ${index + 1}</strong></td>
        <td class="text-center">${compoundBadge}</td>
        <td class="text-center">${stint.lapCount}</td>
        <td class="text-center">${stint.avgLapSeconds ? secondsToTimeString(stint.avgLapSeconds) : "N/A"}</td>
        <td class="text-center">${stint.avgFuel.toFixed(3)}</td>
        <td class="text-center">${stint.status}</td>
        <td class="text-center group-start ${wearCls(stint.avgWear.FL)}">${stint.avgWear.FL.toFixed(2)}</td>
        <td class="text-center ${wearCls(stint.avgWear.FR)}">${stint.avgWear.FR.toFixed(2)}</td>
        <td class="text-center ${wearCls(stint.avgWear.RL)}">${stint.avgWear.RL.toFixed(2)}</td>
        <td class="text-center group-end ${wearCls(stint.avgWear.RR)}">${stint.avgWear.RR.toFixed(2)}</td>
      `;
    stintTableBody.appendChild(row);
  });
}

function renderPracticeTable() {
  const tbody = document.getElementById("practiceLapTableBody");
  const table = tbody?.closest("table");
  if (!tbody || !table) return;

  // Add selection column header if it doesn't exist
  const thead = table.querySelector("thead tr");
  if (thead && !thead.querySelector(".select-header")) {
    const th = document.createElement("th");
    th.className = "text-center select-header";
    th.style.width = "40px";
    th.innerHTML =
      '<input type="checkbox" id="selectAllPracticeLaps" style="cursor:pointer;" title="Select All Laps">';
    thead.prepend(th);

    const selectAllCb = th.querySelector("#selectAllPracticeLaps");
    selectAllCb.onclick = (e) => {
      e.stopPropagation();
      const isChecked = selectAllCb.checked;
      const rowCheckboxes = tbody.querySelectorAll(".lap-select-cb");

      currentData.lap_history.forEach((lap) => {
        if (isChecked) {
          selectedPracticeLaps.add(lap.lap);
        } else {
          selectedPracticeLaps.delete(lap.lap);
        }
      });

      rowCheckboxes.forEach((cb) => {
        cb.checked = isChecked;
        const row = cb.closest("tr");
        if (isChecked) row.classList.add("lap-row-selected");
        else row.classList.remove("lap-row-selected");
      });

      updateFuelCalculator();
    };
  }

  tbody.innerHTML = "";
  practiceFuelMap.clear();

  const startFuel =
    currentData.starting_fuel ||
    (currentData.lap_history.length > 0
      ? currentData.lap_history[0].fuel_kg
      : 0);

  let lastCompound = null;
  currentData.lap_history.forEach((lap, index) => {
    const prevFuel =
      index === 0 ? startFuel : currentData.lap_history[index - 1].fuel_kg;
    const fuelConsumed = Math.max(0, prevFuel - lap.fuel_kg);

    // Cache fuel usage for this lap
    practiceFuelMap.set(lap.lap, fuelConsumed);

    const pitStatus = Number(lap.pit_status || 0);
    const scStatus = Number(lap.sc_status || 0);
    let statusLabel = "";
    if (scStatus === 3 && pitStatus === 1) statusLabel = "Red Flag Pit";
    else if (scStatus === 3) statusLabel = "Red Flag";
    else if (pitStatus === 1) statusLabel = "Pitting";
    else if (pitStatus === 2) statusLabel = "In Pits";
    else if (scStatus === 1) statusLabel = "Safety Car";
    else if (scStatus === 2) statusLabel = "VSC";

    const getWearClass = (val) =>
      val >= 80 ? "wear-critical" : val >= 60 ? "wear-warning" : "";

    const row = document.createElement("tr");
    row.style.cursor = "pointer";
    if (selectedPracticeLaps.has(lap.lap)) {
      row.classList.add("lap-row-selected");
    }

    const currentComp = String(lap.current_tyre_compound).toUpperCase();
    if (
      index > 0 &&
      (currentComp !== lastCompound ||
        Number(currentData.lap_history[index - 1].pit_status) === 1)
    ) {
      row.classList.add("stint-boundary");
    }
    lastCompound = currentComp;

    row.innerHTML = `
            <td class="text-center"><input type="checkbox" class="lap-select-cb" ${selectedPracticeLaps.has(lap.lap) ? "checked" : ""}></td>
            <td class="text-center" style="padding: 8px 4px;">${lap.lap}</td>
            <td class="text-center" style="padding: 8px 4px;">${statusLabel}</td>
            <td class="text-center" style="padding: 8px 4px;">${lap.lap_time}</td>
            <td class="text-center group-start" style="padding: 8px 4px;">${lap.s1}</td>
            <td class="text-center" style="padding: 8px 4px;">${lap.s2}</td>
            <td class="text-center group-end" style="padding: 8px 4px;">${lap.s3}</td>
            <td class="text-center" style="padding: 8px 4px;">${lap.current_tyre_compound}</td>
            <td class="text-center" style="padding: 8px 4px;">${lap.fuel_kg.toFixed(2)}</td>
            <td class="text-center" style="padding: 8px 4px;">${fuelConsumed.toFixed(2)}</td>
            <td class="text-center group-start ${getWearClass(lap.tyre_wear.FL)}" style="padding: 8px 4px;">${lap.tyre_wear.FL.toFixed(2)}</td>
            <td class="text-center ${getWearClass(lap.tyre_wear.FR)}" style="padding: 8px 4px;">${lap.tyre_wear.FR.toFixed(2)}</td>
            <td class="text-center ${getWearClass(lap.tyre_wear.RL)}" style="padding: 8px 4px;">${lap.tyre_wear.RL.toFixed(2)}</td>
            <td class="text-center group-end ${getWearClass(lap.tyre_wear.RR)}" style="padding: 8px 4px;">${lap.tyre_wear.RR.toFixed(2)}</td>
            <td class="text-center" style="padding: 8px 4px;">${(lap.ers_deployed_j / 1000000).toFixed(2)}</td>
            <td class="text-center" style="padding: 8px 4px;">${(lap.ers_remaining_j / 1000000).toFixed(2)}</td>
        `;

    const cb = row.querySelector(".lap-select-cb");
    cb.onclick = (e) => {
      e.stopPropagation();
      if (cb.checked) {
        selectedPracticeLaps.add(lap.lap);
        row.classList.add("lap-row-selected");
      } else {
        selectedPracticeLaps.delete(lap.lap);
        row.classList.remove("lap-row-selected");
      }

      // Sync the select-all checkbox state
      const selectAllCb = document.getElementById("selectAllPracticeLaps");
      if (selectAllCb) {
        selectAllCb.checked =
          selectedPracticeLaps.size === currentData.lap_history.length;
      }

      updateFuelCalculator();
    };

    row.onclick = () => cb.click();

    tbody.appendChild(row);
  });
}

function renderFuelCalculatorUI(container) {
  container.innerHTML = `
    <div class="fuel-calc-item">
      <label>Avg Usage (Selected)</label>
      <div id="avgFuelResult" class="fuel-calc-result">0.000 kg/lp</div>
    </div>
    <div class="fuel-calc-item">
      <label>Target Laps</label>
      <input type="number" id="targetLapsInput" value="10" min="1" step="1">
    </div>
    <div class="fuel-calc-item">
      <label>Fuel Needed</label>
      <div id="totalFuelNeeded" class="fuel-calc-result">0.00 kg</div>
    </div>
    <div style="font-size: 0.75rem; color: #888; max-width: 220px; line-height: 1.4;">
      Select laps in the table below to calculate average consumption for your race setup.
    </div>
  `;
  const input = container.querySelector("#targetLapsInput");
  input.oninput = () => updateFuelCalculator();
}

function updateFuelCalculator() {
  const avgEl = document.getElementById("avgFuelResult");
  const totalEl = document.getElementById("totalFuelNeeded");
  const targetInput = document.getElementById("targetLapsInput");
  if (!avgEl || !totalEl || !targetInput) return;

  if (selectedPracticeLaps.size === 0) {
    avgEl.textContent = "0.000 kg/lp";
    totalEl.textContent = "0.00 kg";
    return;
  }

  let sum = 0;
  selectedPracticeLaps.forEach((lap) => {
    sum += practiceFuelMap.get(lap) || 0;
  });

  const avg = sum / selectedPracticeLaps.size;
  const target = parseFloat(targetInput.value) || 0;
  const needed = avg * target;

  avgEl.textContent = `${avg.toFixed(3)} kg/lp`;
  totalEl.textContent = `${needed.toFixed(2)} kg`;
}

function renderQualiResults() {
  const section = document.getElementById("section-quali-results");
  const bodyContainer = document.getElementById("quali-results-container");
  if (!section || !bodyContainer) return;

  const targetCat =
    currentData.category === "Race" || currentData.category === "Qualifying"
      ? "Qualifying"
      : currentData.category === "Sprint" ||
          currentData.category === "Sprint Shootout"
        ? "Sprint Shootout"
        : null;

  const currentNormalized = normalizeTrackName(currentData.track_name);

  // Find ALL matching segments for this track and season
  const qualiSessions = allSessions.filter(
    (s) =>
      normalizeTrackName(s.track_name) === currentNormalized &&
      s.season === currentData.season &&
      s.category === targetCat,
  );

  if (qualiSessions.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  bodyContainer.innerHTML = ""; // Clear old content

  const segmentsGridContainer = document.createElement("div");
  segmentsGridContainer.className = "quali-segments-grid";
  bodyContainer.appendChild(segmentsGridContainer);

  const teamsAssigned = getDriverTeams();

  // Sort segments logically (usually by their session_type name)
  qualiSessions.sort((a, b) =>
    (a.session_type || "").localeCompare(b.session_type || ""),
  );

  qualiSessions.forEach((session) => {
    const segmentTitle = session.session_type || session.category || "Results";
    const tableDiv = document.createElement("div");
    tableDiv.className = "table-container";

    let tableHtml = `
      <h3 style="margin-bottom: 12px; color: var(--accent-red); font-size: 0.9rem; text-transform: uppercase;">
        ⏱️ ${segmentTitle}
      </h3>
      <table>
        <thead>
          <tr>
            <th class="text-center" style="width: 60px;">Pos</th>
            <th>Driver</th>
            <th class="text-center">Best Lap</th>
            <th class="text-center" style="width: 105px;">Gap</th>
          </tr>
        </thead>
        <tbody>`;

    const sortedResults = [...session.results].sort(
      (a, b) => (parseInt(a.position) || 99) - (parseInt(b.position) || 99),
    );

    const lapTimes = sortedResults.map((res) =>
      timeStringToSeconds(res.best_lap || res.q1 || res.q2 || res.q3 || ""),
    );

    sortedResults.forEach((res, idx) => {
      const isPlayer = res.name === currentData.driver_name;
      const pos = parseInt(res.position);
      const lowerTitle = segmentTitle.toLowerCase();
      let isEliminated = false;

      // Thresholds: Q1/S1 (17-22 eliminated), Q2/S2 (11-16 eliminated)
      if (lowerTitle.includes("1") && pos > 16) isEliminated = true;
      else if (lowerTitle.includes("2") && pos > 10) isEliminated = true;

      const team = teamsAssigned[res.name] || "Unassigned";
      const teamColor = TEAM_COLORS[team] || "#444";

      let rowStyle = "";
      if (isPlayer) {
        rowStyle =
          "background: rgba(225, 6, 0, 0.15); border-left: 3px solid var(--accent-red);";
      } else if (isEliminated) {
        rowStyle = "background: rgba(255, 75, 75, 0.08); color: #ff6b6b;";
      }

      const currentTime = lapTimes[idx];
      const leaderTime = lapTimes[0];
      const previousTime = idx > 0 ? lapTimes[idx - 1] : null;
      let gapLabel = "-";
      if (typeof currentTime === "number" && currentTime > 0) {
        let gapTo = null;
        if (qualiGapMode === "leader") {
          gapTo = leaderTime;
        } else if (idx > 0) {
          gapTo = previousTime;
        }
        if (gapTo && gapTo > 0 && currentTime > gapTo) {
          gapLabel = "+" + secondsToTimeString(currentTime - gapTo);
        } else if (gapTo && gapTo > 0 && currentTime <= gapTo) {
          gapLabel = "-";
        }
      }

      tableHtml += `
        <tr style="${rowStyle}">
          <td class="text-center"><strong>${res.position || "-"}</strong></td>
          <td style="border-left: 4px solid ${teamColor} !important; padding-left: 10px;">
            <strong>${res.name}</strong><br>
            <span class="team-name-sub">${team}</span>
          </td>
          <td class="text-center">${res.q1 || res.best_lap || "-"}</td>
          <td class="text-center">${gapLabel}</td>
        </tr>`;
    });

    tableHtml += `</tbody></table>`;
    tableDiv.innerHTML = tableHtml;
    segmentsGridContainer.appendChild(tableDiv);
  });
}

function updateQualiGapButton() {
  const btn = document.getElementById("qualiGapToggleBtn");
  if (!btn) return;
  if (qualiGapMode === "leader") {
    btn.textContent = "Switch to Gap to Next";
  } else {
    btn.textContent = "Switch to Gap to Leader";
  }
}

function renderSessionInfo() {
  const info = currentData;
  const laps = info.lap_history;
  const startFuel =
    info.starting_fuel || (laps.length > 0 ? laps[0].fuel_kg : 0);
  const lastFuel = laps.length > 0 ? laps[laps.length - 1].fuel_kg : startFuel;
  const totalFuelConsumed = Math.max(0, startFuel - lastFuel);
  const avgFuelPerLap = laps.length > 0 ? totalFuelConsumed / laps.length : 0;

  const statusCounts = laps.reduce(
    (counts, lap) => {
      if (Number(lap.sc_status) === 1) counts.sc += 1;
      if (Number(lap.sc_status) === 2) counts.vsc += 1;
      if (Number(lap.sc_status) === 3) counts.red += 1;
      if (Number(lap.pit_status) === 1) counts.pits += 1;
      return counts;
    },
    { sc: 0, vsc: 0, red: 0, pits: 0 },
  );

  const html = `
        <div class="info-item">
            <div class="info-label">Season</div>
            <div class="info-value">Season ${info.season || 1}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Category</div>
            <div class="info-value">${info.category || "Race"}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Driver</div>
            <div class="info-value">${String(info.driver_name).toUpperCase()}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Track</div>
            <div class="info-value">${info.track_name}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Session Date</div>
            <div class="info-value">${new Date(info.created_at).toLocaleDateString()}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Starting Position</div>
            <div class="info-value">${info.starting_position || "N/A"}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Finishing Position</div>
            <div class="info-value">${info.finishing_position || "N/A"}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Total Laps</div>
            <div class="info-value">${laps.length}</div>
        </div>
        <div class="info-item">
            <div class="info-label">SC Laps</div>
            <div class="info-value">
              ${statusCounts.sc} 
              ${statusCounts.sc > 0 ? `<button class="clear-status-btn" data-status="1" title="Clear SC" style="background:transparent; border:none; cursor:pointer; font-size:0.8em; margin-left:8px; vertical-align:middle;">🗑️</button>` : ""}
            </div>
        </div>
        <div class="info-item">
            <div class="info-label">VSC Laps</div>
            <div class="info-value">
              ${statusCounts.vsc} 
              ${statusCounts.vsc > 0 ? `<button class="clear-status-btn" data-status="2" title="Clear VSC" style="background:transparent; border:none; cursor:pointer; font-size:0.8em; margin-left:8px; vertical-align:middle;">🗑️</button>` : ""}
            </div>
        </div>
        <div class="info-item">
            <div class="info-label">Red Flag Laps</div>
            <div class="info-value">${statusCounts.red}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Pit Stops</div>
            <div class="info-value">${statusCounts.pits}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Avg Fuel / Lap</div>
            <div class="info-value">${avgFuelPerLap.toFixed(3)} kg</div>
        </div>
    `;
  document.getElementById("sessionInfo").innerHTML = html;

  document.querySelectorAll(".clear-status-btn").forEach((btn) => {
    btn.onclick = () => {
      const statusType = parseInt(btn.getAttribute("data-status"));
      clearSessionStatus(statusType);
    };
  });
}

function calculateStints() {
  const laps = currentData.lap_history;
  if (!laps || laps.length === 0) return [];

  // If we have explicit stints from get_data.py (tyre-stint-history-v2)
  if (currentData.stints && currentData.stints.length > 0) {
    return currentData.stints
      .map((stint) => {
        const startLap = stint["start-lap"];
        const endLap = stint["end-lap"];
        const stintLaps = laps.filter(
          (l) => l.lap >= startLap && l.lap <= endLap,
        );

        if (stintLaps.length === 0) return null;

        // Exclude red flag and pit laps from lap count
        const countableLaps = stintLaps.filter(
          (l) =>
            Number(l.sc_status || 0) !== 3 && Number(l.pit_status || 0) === 0,
        );
        const lapCount = countableLaps.length;
        const lastLap = stintLaps[lapCount - 1];

        // Check if the tyre change to this stint happened under a Red Flag
        const transitionLap = laps.filter((l) => l.lap < startLap).pop();
        const wasRedFlagPit = transitionLap && transitionLap.sc_status === 3;

        // Calculate fuel: difference between the start of the first lap and end of the last
        const firstLapIndex = laps.findIndex((l) => l.lap === startLap);
        let prevFuel = 0;
        if (firstLapIndex === 0) {
          prevFuel = currentData.starting_fuel || laps[0].fuel_kg;
        } else if (firstLapIndex > 0) {
          prevFuel = laps[firstLapIndex - 1].fuel_kg;
        } else {
          prevFuel = stintLaps[0].fuel_kg;
        }
        const fuelConsumed = Math.max(0, prevFuel - lastLap.fuel_kg);

        let status = "Normal";
        if (wasRedFlagPit) status = "Red Flag Pit";
        else if (stintLaps.some((l) => l.sc_status === 3)) status = "Red Flag";
        else if (stintLaps.some((l) => l.sc_status === 1))
          status = "Safety Car";
        else if (stintLaps.some((l) => l.sc_status === 2)) status = "VSC";

        // Average lap time for the stint (seconds)
        const stintLapTimes = stintLaps
          .map((l) => timeStringToSeconds(l.lap_time))
          .filter((v) => typeof v === "number" && v > 0);
        const avgLapSeconds =
          stintLapTimes.length > 0
            ? stintLapTimes.reduce((a, b) => a + b, 0) / stintLapTimes.length
            : null;

        return {
          compound:
            stint["tyre-set-data"]?.["visual-tyre-compound"] || "Unknown",
          lapCount: lapCount,
          avgLapSeconds: avgLapSeconds,
          avgFuel: fuelConsumed / lapCount,
          status: status,
          avgWear: {
            FL: lastLap.tyre_wear.FL / lapCount,
            FR: lastLap.tyre_wear.FR / lapCount,
            RL: lastLap.tyre_wear.RL / lapCount,
            RR: lastLap.tyre_wear.RR / lapCount,
          },
        };
      })
      .filter((s) => s !== null);
  }

  const stints = [];
  const startFuelOverall = currentData.starting_fuel || laps[0].fuel_kg;

  let currentStint = {
    compound: laps[0].current_tyre_compound,
    laps: [],
    startFuel: startFuelOverall,
    stintStatus: "Normal",
  };

  laps.forEach((lap, index) => {
    const prevLap = index > 0 ? laps[index - 1] : null;

    // Detect stint change via compound switch OR exiting the pits
    let isNewStint = false;
    if (prevLap) {
      if (lap.current_tyre_compound !== prevLap.current_tyre_compound) {
        isNewStint = true;
      } else if (
        Number(prevLap.pit_status || 0) > 0 &&
        Number(lap.pit_status || 0) === 0
      ) {
        // Just came out of pits onto track
        isNewStint = true;
      }
    }

    // Note if session status changed during this stint
    const sc = Number(lap.sc_status || 0);
    if (sc === 3) currentStint.stintStatus = "Red Flag";
    else if (sc === 1 && currentStint.stintStatus !== "Red Flag")
      currentStint.stintStatus = "Safety Car";
    else if (sc === 2 && currentStint.stintStatus === "Normal")
      currentStint.stintStatus = "VSC";

    // Special check for Red Flag Pit in fallback logic
    if (isNewStint && prevLap && prevLap.sc_status === 3) {
      currentStint.wasRedFlagPit = true;
    }

    if (isNewStint) {
      currentStint.endFuel = prevLap.fuel_kg;
      stints.push(currentStint);

      currentStint = {
        compound: lap.current_tyre_compound,
        laps: [],
        startFuel: prevLap.fuel_kg,
        stintStatus:
          sc === 3
            ? "Red Flag"
            : sc === 1
              ? "Safety Car"
              : sc === 2
                ? "VSC"
                : "Normal",
      };
    }
    currentStint.laps.push(lap);
  });

  currentStint.endFuel = laps[laps.length - 1].fuel_kg;
  stints.push(currentStint);

  return stints
    .map((s) => {
      // Exclude red flag and pit laps from lap count
      const countableLaps = s.laps.filter(
        (l) =>
          Number(l.sc_status || 0) !== 3 && Number(l.pit_status || 0) === 0,
      );
      const lapCount = countableLaps.length;
      if (lapCount === 0) return null;

      const fuelConsumed = Math.max(0, s.startFuel - s.endFuel);
      const lastLap = s.laps[s.laps.length - 1];

      // compute avg lap time for this generated stint
      const stintLapTimes = s.laps
        .map((l) => timeStringToSeconds(l.lap_time))
        .filter((v) => typeof v === "number" && v > 0);
      const avgLapSeconds =
        stintLapTimes.length > 0
          ? stintLapTimes.reduce((a, b) => a + b, 0) / stintLapTimes.length
          : null;

      return {
        compound: s.compound,
        lapCount: lapCount,
        avgLapSeconds: avgLapSeconds,
        avgFuel: fuelConsumed / lapCount,
        status: s.wasRedFlagPit ? "Red Flag Pit" : s.stintStatus,
        avgWear: {
          FL: lastLap.tyre_wear.FL / lapCount,
          FR: lastLap.tyre_wear.FR / lapCount,
          RL: lastLap.tyre_wear.RL / lapCount,
          RR: lastLap.tyre_wear.RR / lapCount,
        },
      };
    })
    .filter((s) => s !== null);
}

function renderStints() {
  const stintSection = document.getElementById("stintSection");
  const stintTableBody = document.getElementById("stintTableBody");
  const stints = calculateStints();

  if (stints.length === 0) {
    stintSection.style.display = "none";
    return;
  }

  stintSection.style.display = "block";
  stintTableBody.innerHTML = "";

  stints.forEach((stint, index) => {
    const compKey = String(stint.compound).toUpperCase();
    const dotColor = COMPOUND_COLORS[compKey] || "#888";
    const rgba = (hex, a) => {
      const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${a})`;
    };
    const wearCls = (v) => v < 1.0 ? "wear-low" : v < 2.0 ? "wear-med" : "wear-high";
    const compoundBadge = `<span class="compound-badge" style="background:${rgba(dotColor, 0.12)};border-color:${rgba(dotColor, 0.45)};color:${dotColor}"><span class="compound-dot" style="background-color:${dotColor}"></span>${stint.compound}</span>`;
    const row = document.createElement("tr");
    row.innerHTML = `
        <td class="text-center"><strong>Stint ${index + 1}</strong></td>
        <td class="text-center">${compoundBadge}</td>
        <td class="text-center">${stint.lapCount}</td>
        <td class="text-center">${stint.avgLapSeconds ? secondsToTimeString(stint.avgLapSeconds) : "N/A"}</td>
        <td class="text-center">${stint.avgFuel.toFixed(3)}</td>
        <td class="text-center">${stint.status}</td>
        <td class="text-center group-start ${wearCls(stint.avgWear.FL)}">${stint.avgWear.FL.toFixed(2)}</td>
        <td class="text-center ${wearCls(stint.avgWear.FR)}">${stint.avgWear.FR.toFixed(2)}</td>
        <td class="text-center ${wearCls(stint.avgWear.RL)}">${stint.avgWear.RL.toFixed(2)}</td>
        <td class="text-center group-end ${wearCls(stint.avgWear.RR)}">${stint.avgWear.RR.toFixed(2)}</td>
      `;
    stintTableBody.appendChild(row);
  });
}

function renderCharts() {
  const laps = currentData.lap_history;

  if (!laps || laps.length === 0) {
    // Clear existing charts if viewing a placeholder session
    Object.values(charts).forEach((chart) => chart.destroy());
    return;
  }

  const lapNumbers = laps.map((l) => l.lap);

  // Lap Times Chart - compute average-based Y-axis to avoid huge 0..2:00 ranges
  const lapTimes = laps.map((l) => timeStringToSeconds(l.lap_time));

  // Filter for valid times and non-red flag laps for fastest lap calculation
  const validIndices = lapTimes.reduce((acc, v, i) => {
    if (typeof v === "number" && v > 0 && Number(laps[i].sc_status) !== 3) {
      acc.push(i);
    }
    return acc;
  }, []);

  let fastestLapSeconds = null;
  let fastestLapLap = null;

  if (validIndices.length > 0) {
    const validTimes = validIndices.map((i) => lapTimes[i]);
    fastestLapSeconds = Math.min(...validTimes);
    const bestIdx = validIndices.find((i) => lapTimes[i] === fastestLapSeconds);
    fastestLapLap = lapNumbers[bestIdx];
  }

  const validLapTimes = lapTimes.filter((v) => typeof v === "number" && v > 0);

  // Compute average and stddev to derive a sensible min/max around the mean
  let avgLapSeconds = null;
  if (validLapTimes.length > 0) {
    const sum = validLapTimes.reduce((a, b) => a + b, 0);
    avgLapSeconds = sum / validLapTimes.length;
  }

  let yMinForAvg = null;
  let yMaxForAvg = null;
  if (avgLapSeconds !== null) {
    const mean = avgLapSeconds;
    const variance =
      validLapTimes.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) /
      validLapTimes.length;
    const stddev = Math.sqrt(variance);
    const padding = Math.max(3, stddev * 1.5, 5); // seconds padding
    yMinForAvg = Math.max(0, mean - padding);
    yMaxForAvg = mean + padding;
  }

  // Round bounds to nicer steps (quarters of a second)
  if (yMinForAvg !== null && yMaxForAvg !== null) {
    yMinForAvg = roundDownTo(yMinForAvg, 0.25);
    yMaxForAvg = roundUpTo(yMaxForAvg, 0.25);
  }

  createChart(
    "lapTimesChart",
    "line",
    {
      labels: lapNumbers,
      datasets: [
        {
          label: "Lap Time",
          data: maskPitLapValues(lapTimes, laps, lapNumbers),
          borderColor: "#667eea",
          backgroundColor: "rgba(102, 126, 234, 0.1)",
          tension: 0.4,
          fill: true,
          spanGaps: false,
        },
      ],
    },
    true,
    {
      fastestLapSeconds,
      fastestLapLap,
      // Use average-based trimming rather than global data trimming
      trimYAxisToData: false,
      ignorePitLaps: true,
      yAxis: Object.assign(
        {
          ticks: {
            maxTicksLimit: 6,
            stepSize: 0.5,
          },
        },
        yMinForAvg !== null && yMaxForAvg !== null
          ? { min: yMinForAvg, max: yMaxForAvg }
          : {},
      ),
    },
  );

  // Fuel Chart
  // compute avg-based bounds for fuel (kg)
  let fuelMin = null;
  let fuelMax = null;
  const fuelValues = laps
    .map((l) => l.fuel_kg)
    .filter((v) => typeof v === "number" && !isNaN(v));
  if (fuelValues.length > 0) {
    const sumFuel = fuelValues.reduce((a, b) => a + b, 0);
    const avgFuel = sumFuel / fuelValues.length;
    const varianceFuel =
      fuelValues.reduce((acc, v) => acc + Math.pow(v - avgFuel, 2), 0) /
      fuelValues.length;
    const stdFuel = Math.sqrt(varianceFuel);
    const paddingFuel = Math.max(1, stdFuel * 1.5, 2);
    fuelMin = Math.max(0, avgFuel - paddingFuel);
    fuelMax = avgFuel + paddingFuel;
    fuelMin = roundDownTo(fuelMin, 0.5);
    fuelMax = roundUpTo(fuelMax, 0.5);
  }
  createChart(
    "fuelChart",
    "line",
    {
      labels: lapNumbers,
      datasets: [
        {
          label: "Fuel Level",
          data: laps.map((l) => l.fuel_kg),
          borderColor: "#ff6b6b",
          backgroundColor: "rgba(255, 107, 107, 0.1)",
          tension: 0.4,
          fill: true,
        },
      ],
    },
    false,
    {
      fastestLapSeconds,
      fastestLapLap,
      yAxis: Object.assign(
        {
          ticks: {
            maxTicksLimit: 6,
            stepSize: 0.5,
          },
        },
        fuelMin !== null && fuelMax !== null
          ? { min: fuelMin, max: fuelMax }
          : {},
      ),
    },
  );

  // Fuel Consumption Chart - Calculate fuel consumed per lap
  const fuelConsumption = [];
  const startFuel =
    currentData.starting_fuel || (laps.length > 0 ? laps[0].fuel_kg : 0);

  for (let i = 0; i < laps.length; i++) {
    const prevFuel = i === 0 ? startFuel : laps[i - 1].fuel_kg;
    const consumed = Math.max(0, prevFuel - laps[i].fuel_kg);
    fuelConsumption.push(parseFloat(consumed.toFixed(2)));
  }

  createChart(
    "fuelConsumptionChart",
    "line",
    {
      labels: lapNumbers,
      datasets: [
        {
          label: "Fuel Consumed (kg)",
          data: fuelConsumption,
          borderColor: "#ffd93d",
          backgroundColor: "rgba(255, 217, 61, 0.1)",
          tension: 0.4,
          fill: true,
        },
      ],
    },
    false,
    (() => {
      // compute average-based bounds for fuel per lap
      const valid = fuelConsumption.filter(
        (v) => typeof v === "number" && !isNaN(v) && v > 0,
      );
      let minF = null;
      let maxF = null;
      if (valid.length > 0) {
        const sum = valid.reduce((a, b) => a + b, 0);
        const avg = sum / valid.length;
        const variance =
          valid.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) /
          valid.length;
        const std = Math.sqrt(variance);
        const padding = Math.max(0.2, std * 1.5, 0.5);
        minF = roundDownTo(Math.max(0, avg - padding), 0.25);
        maxF = roundUpTo(avg + padding, 0.25);
      }
      return {
        fastestLapSeconds,
        fastestLapLap,
        averageCentering: true,
        yAxis: Object.assign(
          {
            ticks: {
              maxTicksLimit: 5,
              stepSize: 0.25,
            },
          },
          minF !== null && maxF !== null ? { min: minF, max: maxF } : {},
        ),
      };
    })(),
  );

  // Tire Wear Charts - Combined
  createChart(
    "tireWearChart",
    "line",
    {
      labels: lapNumbers,
      datasets: [
        {
          label: "FL",
          data: laps.map((l) => l.tyre_wear.FL),
          borderColor: "#51cf66",
          backgroundColor: "rgba(81, 207, 102, 0.1)",
          tension: 0.4,
          fill: false,
          borderWidth: 2,
        },
        {
          label: "FR",
          data: laps.map((l) => l.tyre_wear.FR),
          borderColor: "#ffd43b",
          backgroundColor: "rgba(255, 212, 59, 0.1)",
          tension: 0.4,
          fill: false,
          borderWidth: 2,
        },
        {
          label: "RL",
          data: laps.map((l) => l.tyre_wear.RL),
          borderColor: "#a78bfa",
          backgroundColor: "rgba(167, 139, 250, 0.1)",
          tension: 0.4,
          fill: false,
          borderWidth: 2,
        },
        {
          label: "RR",
          data: laps.map((l) => l.tyre_wear.RR),
          borderColor: "#ff922b",
          backgroundColor: "rgba(255, 146, 43, 0.1)",
          tension: 0.4,
          fill: false,
          borderWidth: 2,
        },
      ],
    },
    false,
    {
      fastestLapSeconds,
      fastestLapLap,
    },
  );

  // Sector Times Chart - compute avg across sectors and set rounded bounds
  const s1 = laps.map((l) => timeStringToSeconds(l.s1));
  const s2 = laps.map((l) => timeStringToSeconds(l.s2));
  const s3 = laps.map((l) => timeStringToSeconds(l.s3));
  const sectorValues = []
    .concat(s1, s2, s3)
    .filter((v) => typeof v === "number" && v > 0);
  let sectorMin = null;
  let sectorMax = null;
  if (sectorValues.length > 0) {
    const sumS = sectorValues.reduce((a, b) => a + b, 0);
    const avgS = sumS / sectorValues.length;
    const varianceS =
      sectorValues.reduce((acc, v) => acc + Math.pow(v - avgS, 2), 0) /
      sectorValues.length;
    const stdS = Math.sqrt(varianceS);
    const paddingS = Math.max(0.5, stdS * 1.5, 1);
    sectorMin = Math.max(0, avgS - paddingS);
    sectorMax = avgS + paddingS;
    sectorMin = roundDownTo(sectorMin, 0.25);
    sectorMax = roundUpTo(sectorMax, 0.25);
  }

  createChart(
    "sectorChart",
    "line",
    {
      labels: lapNumbers,
      datasets: [
        {
          label: "S1",
          data: maskPitLapValues(
            laps.map((l) => timeStringToSeconds(l.s1)),
            laps,
            lapNumbers,
          ),
          borderColor: "rgba(102, 126, 234, 0.8)",
          backgroundColor: "rgba(102, 126, 234, 0.1)",
          tension: 0.4,
          fill: false,
          spanGaps: false,
          borderWidth: 2,
        },
        {
          label: "S2",
          data: maskPitLapValues(
            laps.map((l) => timeStringToSeconds(l.s2)),
            laps,
            lapNumbers,
          ),
          borderColor: "rgba(255, 107, 107, 0.8)",
          backgroundColor: "rgba(255, 107, 107, 0.1)",
          tension: 0.4,
          fill: false,
          spanGaps: false,
          borderWidth: 2,
        },
        {
          label: "S3",
          data: maskPitLapValues(
            laps.map((l) => timeStringToSeconds(l.s3)),
            laps,
            lapNumbers,
          ),
          borderColor: "rgba(81, 207, 102, 0.8)",
          backgroundColor: "rgba(81, 207, 102, 0.1)",
          tension: 0.4,
          fill: false,
          spanGaps: false,
          borderWidth: 2,
        },
      ],
    },
    true,
    {
      fastestLapSeconds,
      fastestLapLap,
      // center around average sector times
      trimYAxisToData: false,
      ignorePitLaps: true,
      averageCentering: true,
      yAxis: Object.assign(
        {
          ticks: {
            maxTicksLimit: 4,
            stepSize: 0.25,
          },
        },
        sectorMin !== null && sectorMax !== null
          ? { min: sectorMin, max: sectorMax }
          : {},
      ),
    },
  );

  // ERS Chart
  createChart(
    "ersChart",
    "line",
    {
      labels: lapNumbers,
      datasets: [
        {
          label: "Deployed",
          data: laps.map((l) => l.ers_deployed_j / 1000000),
          borderColor: "#667eea",
          backgroundColor: "rgba(102, 126, 234, 0.1)",
          tension: 0.4,
          fill: true,
        },
        {
          label: "Remaining",
          data: laps.map((l) => l.ers_remaining_j / 1000000),
          borderColor: "#ff6b6b",
          backgroundColor: "rgba(255, 107, 107, 0.1)",
          tension: 0.4,
          fill: true,
          borderDash: [5, 5],
        },
      ],
    },
    false,
    {
      fastestLapSeconds,
      fastestLapLap,
    },
  );
}

function isMobileDevice() {
  return window.innerWidth <= 768;
}

function maskPitLapValues(values, lapHistory, labels = []) {
  return values;
}

function computeScaleBounds(
  config,
  formatAsTime = false,
  trimToData = false,
  ignorePitLaps = false,
  lapHistory = [],
) {
  const values = [];
  const lapHistoryArray = Array.isArray(lapHistory) ? lapHistory : [];

  if (config && Array.isArray(config.datasets)) {
    config.datasets.forEach((dataset) => {
      if (Array.isArray(dataset.data)) {
        dataset.data.forEach((value, index) => {
          if (ignorePitLaps && lapHistoryArray.length > 0) {
            let lapEntry = null;
            if (
              Array.isArray(config.labels) &&
              config.labels.length > index &&
              Number(config.labels[index]) ===
                Number(lapHistoryArray[index]?.lap)
            ) {
              lapEntry = lapHistoryArray[index];
            } else if (Array.isArray(config.labels)) {
              const label = config.labels[index];
              const lapNumber = Number(label);
              lapEntry = lapHistoryArray.find(
                (lap) => Number(lap.lap) === lapNumber,
              );
            } else {
              lapEntry = lapHistoryArray[index];
            }

            if (
              lapEntry &&
              (Number(lapEntry.pit_status) === 1 ||
                Number(lapEntry.sc_status) === 3)
            ) {
              return;
            }
          }

          if (
            typeof value === "number" &&
            !isNaN(value) &&
            (!formatAsTime || value > 0)
          ) {
            values.push(value);
          }
        });
      }
    });
  }

  if (values.length === 0) {
    return {};
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const padding = range > 0 ? range * 0.08 : Math.max(1, Math.abs(min) * 0.05);
  const suggestedMin = trimToData ? min - padding : Math.max(0, min - padding);
  const suggestedMax = max + padding;

  return {
    suggestedMin,
    suggestedMax,
  };
}

// Rounding helpers for nicer axis bounds
function roundDownTo(value, step) {
  if (typeof value !== "number" || typeof step !== "number" || step <= 0)
    return value;
  return Math.floor(value / step) * step;
}

function roundUpTo(value, step) {
  if (typeof value !== "number" || typeof step !== "number" || step <= 0)
    return value;
  return Math.ceil(value / step) * step;
}

function createChart(
  canvasId,
  type,
  config,
  formatAsTime = false,
  extraOptions = {},
) {
  const ctx = document.getElementById(canvasId).getContext("2d");
  const isMobile = isMobileDevice();
  const bounds = computeScaleBounds(
    config,
    formatAsTime,
    extraOptions.trimYAxisToData,
    extraOptions.ignorePitLaps,
    currentData?.lap_history || [],
  );
  const yAxisOverride = extraOptions.yAxis || {};
  const shouldTrimYAxis = Boolean(extraOptions.trimYAxisToData);

  const yAxis = {
    beginAtZero: !formatAsTime,
    suggestedMin: bounds.suggestedMin,
    suggestedMax: bounds.suggestedMax,
    ...(shouldTrimYAxis
      ? {
          min: bounds.suggestedMin,
          max: bounds.suggestedMax,
        }
      : {}),
    ticks: formatAsTime
      ? {
          callback: function (value) {
            return secondsToTimeString(value);
          },
          font: {
            size: isMobile ? 9 : 11,
          },
          maxTicksLimit: isMobile ? 5 : 8,
          ...(yAxisOverride.ticks && typeof yAxisOverride.ticks === "object"
            ? yAxisOverride.ticks
            : {}),
        }
      : {
          font: {
            size: isMobile ? 9 : 11,
          },
          maxTicksLimit: isMobile ? 5 : 8,
          ...(yAxisOverride.ticks && typeof yAxisOverride.ticks === "object"
            ? yAxisOverride.ticks
            : {}),
        },
    grid: {
      color: isMobile
        ? "rgba(255, 255, 255, 0.05)"
        : "rgba(255, 255, 255, 0.1)",
      ...(yAxisOverride.grid && typeof yAxisOverride.grid === "object"
        ? yAxisOverride.grid
        : {}),
    },
    ...Object.fromEntries(
      Object.entries(yAxisOverride).filter(
        ([key]) => key !== "ticks" && key !== "grid",
      ),
    ),
  };

  const updateVisibleBounds = (chart) => {
    if (!extraOptions.trimYAxisToData && !extraOptions.averageCentering) return;
    const visibleDatasets = chart.data.datasets.filter((dataset, idx) => {
      const meta = chart.getDatasetMeta(idx);
      return !meta.hidden;
    });
    // If averageCentering is requested, compute mean/stddev across visible values
    if (extraOptions.averageCentering) {
      const labels = chart.data.labels || [];
      const lapHistory = currentData?.lap_history || [];
      const vals = [];
      visibleDatasets.forEach((ds) => {
        if (!Array.isArray(ds.data)) return;
        ds.data.forEach((value, idx) => {
          if (value === null || value === undefined) return;
          const num = Number(value);
          if (isNaN(num)) return;
          if (formatAsTime && num <= 0) return;

          if (extraOptions.ignorePitLaps && lapHistory.length > 0) {
            let lapEntry = null;
            if (
              Array.isArray(labels) &&
              labels.length > idx &&
              Number(labels[idx]) === Number(lapHistory[idx]?.lap)
            ) {
              lapEntry = lapHistory[idx];
            } else if (Array.isArray(labels)) {
              const label = labels[idx];
              const lapNumber = Number(label);
              lapEntry = lapHistory.find(
                (lap) => Number(lap.lap) === lapNumber,
              );
            } else {
              lapEntry = lapHistory[idx];
            }
            if (lapEntry && Number(lapEntry.pit_status) === 1) return;
          }

          vals.push(num);
        });
      });

      if (vals.length > 0) {
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const variance =
          vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / vals.length;
        const stddev = Math.sqrt(variance);
        const padding = formatAsTime
          ? Math.max(0.5, stddev * 1.5, 1)
          : Math.max(0.5, stddev * 1.5, 1);

        const step = formatAsTime
          ? 0.25
          : extraOptions.yAxis &&
              extraOptions.yAxis.ticks &&
              extraOptions.yAxis.ticks.stepSize
            ? extraOptions.yAxis.ticks.stepSize
            : 0.5;
        const vmin = roundDownTo(Math.max(0, mean - padding), step);
        const vmax = roundUpTo(mean + padding, step);
        chart.options.scales.y.suggestedMin = vmin;
        chart.options.scales.y.suggestedMax = vmax;
        chart.options.scales.y.min = vmin;
        chart.options.scales.y.max = vmax;
      }
      return;
    }

    const visibleBounds = computeScaleBounds(
      {
        labels: chart.data.labels,
        datasets: visibleDatasets,
      },
      formatAsTime,
      true,
      extraOptions.ignorePitLaps,
      currentData?.lap_history || [],
    );
    if (
      typeof visibleBounds.suggestedMin === "number" &&
      typeof visibleBounds.suggestedMax === "number"
    ) {
      chart.options.scales.y.suggestedMin = visibleBounds.suggestedMin;
      chart.options.scales.y.suggestedMax = visibleBounds.suggestedMax;
      chart.options.scales.y.min = visibleBounds.suggestedMin;
      chart.options.scales.y.max = visibleBounds.suggestedMax;
    }
  };

  // Destroy existing chart if it exists
  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }

  // Custom plugin to draw backgrounds for SC/Red Flag and lines for Pits
  const statusPlugin = {
    id: "statusPlugin",
    beforeDraw: (chart) => {
      const {
        ctx,
        chartArea,
        scales: { x },
      } = chart;
      if (!currentData || !currentData.lap_history) return;

      const laps = currentData.lap_history;
      const barWidth = x.width / laps.length;

      ctx.save();
      laps.forEach((lap) => {
        const xPos = x.getPixelForValue(lap.lap);

        // 1. Draw Background Overlays for SC/Red Flag
        let bgColor = null;
        let statusLabel = null;
        if (lap.sc_status === 3) {
          bgColor = "rgba(255, 0, 0, 0.2)"; // Red Flag
          statusLabel = "RED";
        } else if (lap.sc_status === 2) {
          bgColor = "rgba(255, 255, 0, 0.15)"; // VSC
          statusLabel = "VSC";
        } else if (lap.sc_status === 1) {
          bgColor = "rgba(173, 216, 230, 0.2)"; // SC
          statusLabel = "SC";
        }

        if (bgColor) {
          ctx.fillStyle = bgColor;
          // Draw a box covering the width of this lap's category
          ctx.fillRect(
            xPos - barWidth / 2,
            chartArea.top,
            barWidth,
            chartArea.bottom - chartArea.top,
          );

          ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
          ctx.font = `${isMobile ? 9 : 10}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(statusLabel, xPos, chartArea.top + 4);
        }

        // 2. Draw Vertical Lines for Pit Stops
        if (Number(lap.pit_status) === 1) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(xPos, chartArea.top);
          ctx.lineTo(xPos, chartArea.bottom);
          ctx.stroke();
          ctx.setLineDash([]); // Reset for other drawings
        }
      });
      ctx.restore();
    },
  };

  charts[canvasId] = new Chart(ctx, {
    type: type,
    data: config,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: isMobile
          ? {
              top: 5,
              bottom: 5,
              left: 0,
              right: 0,
            }
          : {
              top: 10,
              bottom: 10,
              left: 0,
              right: 0,
            },
      },
      plugins: {
        legend: {
          position: isMobile ? "bottom" : "top",
          font: {
            size: isMobile ? 10 : 12,
          },
          labels: {
            boxWidth: isMobile ? 12 : 15,
            padding: isMobile ? 8 : 15,
          },
          onClick: (e, legendItem, legend) => {
            const index = legendItem.datasetIndex;
            const chart = legend.chart;
            const meta = chart.getDatasetMeta(index);
            meta.hidden = !meta.hidden;
            updateVisibleBounds(chart);
            chart.update();
          },
        },
        tooltip: formatAsTime
          ? {
              callbacks: {
                label: function (context) {
                  const value = context.parsed.y;
                  return (
                    context.dataset.label + ": " + secondsToTimeString(value)
                  );
                },
              },
              titleFont: {
                size: isMobile ? 10 : 12,
              },
              bodyFont: {
                size: isMobile ? 9 : 11,
              },
            }
          : {
              titleFont: {
                size: isMobile ? 10 : 12,
              },
              bodyFont: {
                size: isMobile ? 9 : 11,
              },
            },
      },
      scales: {
        x: {
          ticks: {
            font: {
              size: isMobile ? 9 : 11,
            },
            maxRotation: isMobile ? 45 : 0,
            autoSkip: true,
            maxTicksLimit: isMobile ? 8 : 12,
          },
          grid: {
            display: !isMobile,
          },
        },
        y: yAxis,
      },
    },
    plugins: [statusPlugin].concat(
      extraOptions.fastestLapLap && extraOptions.fastestLapSeconds
        ? [
            {
              id: "fastestLapLine",
              afterDatasetsDraw: (chart) => {
                const fastestLapLap = extraOptions.fastestLapLap;
                const fastestLapSeconds = extraOptions.fastestLapSeconds;
                if (
                  typeof fastestLapLap !== "number" ||
                  isNaN(fastestLapLap) ||
                  typeof fastestLapSeconds !== "number" ||
                  isNaN(fastestLapSeconds)
                )
                  return;

                const {
                  ctx,
                  chartArea,
                  scales: { x },
                } = chart;

                const xPos = x.getPixelForValue(fastestLapLap);
                ctx.save();
                ctx.strokeStyle = "rgba(170, 88, 255, 0.95)";
                ctx.fillStyle = "rgba(170, 88, 255, 0.95)";
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 4]);
                ctx.beginPath();
                ctx.moveTo(xPos, chartArea.top);
                ctx.lineTo(xPos, chartArea.bottom);
                ctx.stroke();
                ctx.setLineDash([]);

                const label = `Fastest lap ${fastestLapLap}: ${secondsToTimeString(fastestLapSeconds)}`;
                ctx.font = `${isMobile ? 10 : 12}px sans-serif`;
                ctx.textBaseline = "top";
                ctx.textAlign = "center";
                const yText = chartArea.top + (isMobile ? 8 : 10);
                ctx.fillText(label, xPos, yText);
                ctx.restore();
              },
            },
          ]
        : [],
    ),
  });
}

function renderTable() {
  const tbody = document.getElementById("lapTableBody");
  const table = tbody.closest("table");
  if (table) {
    table.classList.add("table-sm");
    table.style.fontSize = "0.85rem";
  }
  tbody.innerHTML = "";

  const startFuel =
    currentData.starting_fuel ||
    (currentData.lap_history.length > 0
      ? currentData.lap_history[0].fuel_kg
      : 0);

  const lapTimes = currentData.lap_history.map((lap) =>
    timeStringToSeconds(lap.lap_time),
  );
  const validLapTimes = lapTimes.filter((v) => typeof v === "number" && v > 0);
  const fastestLapSeconds =
    validLapTimes.length > 0 ? Math.min(...validLapTimes) : null;
  const fastestLapIndex =
    fastestLapSeconds !== null ? lapTimes.indexOf(fastestLapSeconds) : -1;

  const hist = currentData.lap_history;
  const tableLapTimes = hist.map((lap) => timeStringToSeconds(lap.lap_time));
  const tableValidIndices = tableLapTimes.reduce((acc, v, i) => {
    if (typeof v === "number" && v > 0 && Number(hist[i].sc_status) !== 3) {
      acc.push(i);
    }
    return acc;
  }, []);

  let tableFastestLapNumber = null;
  if (tableValidIndices.length > 0) {
    const minT = Math.min(...tableValidIndices.map((i) => tableLapTimes[i]));
    const bestI = tableValidIndices.find((i) => tableLapTimes[i] === minT);
    tableFastestLapNumber = hist[bestI].lap;
  }

  let lastCompound = null;
  hist.forEach((lap, index) => {
    const prevFuel =
      index === 0 ? startFuel : currentData.lap_history[index - 1].fuel_kg;
    const fuelConsumed = Math.max(0, prevFuel - lap.fuel_kg);

    const pitStatus = Number(lap.pit_status || 0);
    const scStatus = Number(lap.sc_status || 0);
    let statusLabel = "";
    if (scStatus === 3 && pitStatus === 1) statusLabel = "Red Flag Pit";
    else if (scStatus === 3) statusLabel = "Red Flag";
    else if (pitStatus === 1) statusLabel = "Pitting";
    else if (pitStatus === 2) statusLabel = "In Pits";
    else if (scStatus === 1) statusLabel = "Safety Car";
    else if (scStatus === 2) statusLabel = "VSC";

    const getWearClass = (val) =>
      val >= 80 ? "wear-critical" : val >= 60 ? "wear-warning" : "";

    const row = document.createElement("tr");
    if (lap.lap === tableFastestLapNumber) {
      row.classList.add("fastest-lap-row");
    }

    // Stint Boundary Grouping
    const currentComp = String(lap.current_tyre_compound).toUpperCase();
    if (
      index > 0 &&
      (currentComp !== lastCompound ||
        Number(currentData.lap_history[index - 1].pit_status) === 1)
    ) {
      row.classList.add("stint-boundary");
    }
    lastCompound = currentComp;

    row.innerHTML = `
            <td class="text-center" style="padding: 8px 4px;">${lap.lap}</td>
            <td class="text-center" style="padding: 8px 4px;">${statusLabel}</td>
            <td class="text-center" style="padding: 8px 4px;">${lap.lap_time}</td>
            <td class="text-center group-start" style="padding: 8px 4px;">${lap.s1}</td>
            <td class="text-center" style="padding: 8px 4px;">${lap.s2}</td>
            <td class="text-center group-end" style="padding: 8px 4px;">${lap.s3}</td>
            <td class="text-center" style="padding: 8px 4px;">${lap.current_tyre_compound}</td>
            <td class="text-center" style="padding: 8px 4px;">${lap.fuel_kg.toFixed(2)}</td>
            <td class="text-center" style="padding: 8px 4px;">${fuelConsumed.toFixed(2)}</td>
            <td class="text-center group-start ${getWearClass(lap.tyre_wear.FL)}" style="padding: 8px 4px;">${lap.tyre_wear.FL.toFixed(2)}</td>
            <td class="text-center ${getWearClass(lap.tyre_wear.FR)}" style="padding: 8px 4px;">${lap.tyre_wear.FR.toFixed(2)}</td>
            <td class="text-center ${getWearClass(lap.tyre_wear.RL)}" style="padding: 8px 4px;">${lap.tyre_wear.RL.toFixed(2)}</td>
            <td class="text-center group-end ${getWearClass(lap.tyre_wear.RR)}" style="padding: 8px 4px;">${lap.tyre_wear.RR.toFixed(2)}</td>
            <td class="text-center" style="padding: 8px 4px;">${(lap.ers_deployed_j / 1000000).toFixed(2)}</td>
            <td class="text-center" style="padding: 8px 4px;">${(lap.ers_remaining_j / 1000000).toFixed(2)}</td>
        `;
    tbody.appendChild(row);
  });
}

function getFlagHtml(session, roundNum) {
  const trackKey = (session.track_name || "").toLowerCase();
  const flag = trackToFlag[trackKey] || `RD${roundNum}`;
  if (trackToFlag[trackKey]) {
    return `<span class="flag-icon" title="${session.track_name}">${flag}</span>`;
  }
  return flag;
}

function renderStandingsTable() {
  const container = document.getElementById("standings-container");
  if (!container || allSessions.length === 0) return;

  const driversMap = {};
  allSessions
    .filter((s) => s.season === currentSeason)
    .forEach((session) => {
      if (session.driver_name && !driversMap[session.driver_name]) {
        driversMap[session.driver_name] = { points: 0, positions: {} };
      }
      if (session.results) {
        session.results.forEach((res) => {
          if (!driversMap[res.name]) {
            driversMap[res.name] = { points: 0, positions: {} };
          }
        });
      }
    });

  const scoringSessions = allSessions
    .filter(
      (s) =>
        s.season === currentSeason &&
        ((s.category || "").toLowerCase() === "race" ||
          (s.category || "").toLowerCase() === "sprint"),
    )
    .sort(sortSessionsByCalendar);

  scoringSessions.forEach((session) => {
    if (!session.results) return;
    session.results.forEach((res) => {
      const driverName = res.name;
      driversMap[driverName].positions[session.id || session.created_at] =
        res.position;

      let pts = 0;
      const cat = (session.category || "").toLowerCase();
      const pos = parseInt(res.position);
      if (cat === "race")
        pts = [0, 25, 18, 15, 12, 10, 8, 6, 4, 2, 1][pos] || 0;
      else if (cat === "sprint") pts = [0, 8, 7, 6, 5, 4, 3, 2, 1][pos] || 0;
      driversMap[driverName].points += pts;
    });
  });

  const driverNames = Object.keys(driversMap).sort(
    (a, b) => driversMap[b].points - driversMap[a].points,
  );

  const teamsAssigned = getDriverTeams(); // This is used for constructor standings

  let html = `<div class="table-responsive"><table class="table table-sm table-dark table-striped standings-table" style="font-size: 0.7rem;"><thead><tr><th style="padding: 12px 4px; width: 40px;" class="text-center">#</th><th style="padding: 12px 4px; width: 180px;" class="text-start">Driver</th>`;

  scoringSessions.forEach((s, i) => {
    const flag = getFlagHtml(s, i + 1);
    const typeLabel = (s.category || "").toLowerCase() === "sprint" ? "S" : "R";
    html += `<th title="${s.track_name} - ${s.category}" class="text-center" style="padding: 12px 2px;">${flag}<br><small style="font-size: 0.6em; opacity: 0.8;">${typeLabel}</small></th>`;
  });

  html += `<th class="text-end" style="padding: 12px 4px;">Pts</th><th class="text-end" style="padding: 12px 4px;">Gap</th></tr></thead><tbody>`;

  driverNames.forEach((name, idx) => {
    const d = driversMap[name];
    const team = teamsAssigned[name] || "Unassigned";
    const teamColor = TEAM_COLORS[team] || "#444";
    html += `<tr class="standings-row"><td class="text-center" style="padding: 10px 2px;">${idx + 1}</td><td class="text-start team-accent-cell" style="padding: 10px 4px; white-space: nowrap; border-left: 4px solid ${teamColor} !important;"><strong>${name.toUpperCase()}</strong><span class="team-name-sub">${team}</span></td>`;

    // Ensure the driver exists in the row even if they missed a race
    scoringSessions.forEach((s) => {
      const pos = d.positions[s.id || s.created_at];
      html += `<td class="text-center pos-${pos}" style="padding: 10px 2px;">${pos || "-"}</td>`;
    });

    // Calculate gap to the driver ahead
    const gap =
      idx === 0
        ? "-"
        : `-${Math.abs(driversMap[driverNames[idx - 1]].points - d.points)}`;

    html += `<td class="text-end" style="padding: 10px 4px;"><strong>${d.points}</strong></td>`;
    html += `<td class="text-end" style="color: #aaa; font-size: 0.85em; padding: 10px 4px;">${gap}</td></tr>`;
  });

  html += `</tbody></table></div>`;
  // Build constructor standings based on assigned teams
  try {
    const teamAgg = {};
    driverNames.forEach((name) => {
      const team = teamsAssigned[name] || "Unassigned";
      if (!teamAgg[team]) teamAgg[team] = { points: 0, drivers: [] };
      teamAgg[team].points += driversMap[name].points || 0;
      teamAgg[team].drivers.push(name);
    });

    const teamNames = Object.keys(teamAgg).sort(
      (a, b) => teamAgg[b].points - teamAgg[a].points,
    ); // Sort teams by points

    let constructorsHtml = `<div class="mt-5"><h3 class="mb-3" style="font-size: 1.1rem; color: #ddd; text-transform: uppercase; letter-spacing: 1px;">Constructor Standings</h3><div class="table-responsive constructor-table-container"><table class="table table-sm table-dark table-striped standings-table" style="font-size:0.75rem;"><thead><tr><th style="padding:12px 8px; width: 40px;" class="text-center">#</th><th style="padding:12px 8px; width: 160px;" class="text-start">Team</th><th style="padding:12px 8px;" class="text-start">Drivers</th><th style="padding:12px 8px; width: 70px;" class="text-end">Pts</th><th style="padding:12px 8px; width: 70px;" class="text-end">Gap</th></tr></thead><tbody>`;

    teamNames.forEach((t, idx) => {
      const info = teamAgg[t];
      const teamColor = TEAM_COLORS[t] || "#444";
      const gap =
        idx === 0
          ? "-"
          : `-${Math.abs(teamAgg[teamNames[idx - 1]].points - info.points)}`;
      constructorsHtml += `<tr class="standings-row"><td class="text-center" style="padding:10px 4px;">${idx + 1}</td><td class="text-start team-accent-cell" style="padding:10px 4px; white-space:nowrap; border-left: 4px solid ${teamColor} !important;"><strong>${t}</strong></td><td class="text-start" style="padding:10px 4px;">${info.drivers.map((d) => d.toUpperCase()).join(", ")}</td><td class="text-end" style="padding:10px 4px;"><strong>${info.points}</strong></td><td class="text-end" style="padding:10px 4px; color:#aaa;">${gap}</td></tr>`;
    });

    constructorsHtml += `</tbody></table></div>`;
    html += constructorsHtml;
  } catch (err) {
    console.warn("Failed to build constructor standings:", err);
  }

  container.innerHTML = html;
  // Render driver assignment UI below the standings
  try {
    renderDriverAssignments(driverNames);
  } catch (err) {
    console.error("Failed to render driver assignments", err);
  }
}

// Driver team assignment helpers
function getDriverTeams() {
  try {
    const raw = JSON.parse(localStorage.getItem("driverTeamsBySeason") || "{}");
    return raw[String(currentSeason)] || {};
  } catch (err) {
    return {};
  }
}

function saveDriverTeams(obj) {
  try {
    const key = "driverTeamsBySeason";
    const store = JSON.parse(localStorage.getItem(key) || "{}");
    store[String(currentSeason)] = obj || {};
    localStorage.setItem(key, JSON.stringify(store));
  } catch (err) {
    console.error("Failed to save driver teams", err);
  }
}

async function autoLoadDriverTeams() {
  try {
    const key = "driverTeamsBySeason";
    const store = JSON.parse(localStorage.getItem(key) || "{}");
    if (
      store &&
      store[String(currentSeason)] &&
      Object.keys(store[String(currentSeason)]).length > 0
    ) {
      // already have local teams for this season
      renderDriverAssignments(Object.keys(store[String(currentSeason)]));
      return;
    }

    // Try loading from DB and persist locally if present
    const dbTeams = await loadDriverTeamsFromDB(currentSeason);
    if (dbTeams && Object.keys(dbTeams).length > 0) {
      saveDriverTeams(dbTeams);
      // re-render assignments (standings render will call it too)
      const container = document.getElementById("driver-assignments-container");
      if (container) {
        // Need driver list; try to extract from current standings
        const drivers = Object.keys(dbTeams);
        renderDriverAssignments(drivers);
      }
    }
  } catch (err) {
    console.warn("Auto-load driver teams failed:", err.message || err);
  }
}

function renderDriverAssignments(driverNames) {
  const container = document.getElementById("driver-assignments-container");
  if (!container) return;

  const teams = getDriverTeams();

  // Header + control buttons
  let html = `<div class="action-header" style="margin-bottom: 12px;"><div style="display:flex; gap:8px; flex-wrap:wrap;"><button id="saveAllDriverTeams" class="download-btn">Save All</button><button id="saveDriverTeamsDB" class="download-btn" style="background:#2b9348;">Save to DB</button><button id="loadDriverTeamsDB" class="download-btn" style="background:#2b6cb0;">Load from DB</button><button id="exportDriverTeams" class="download-btn" style="background:#444;">Export JSON</button></div></div>`;

  // Grid container for cards
  html += `<div class="driver-card-grid" id="driverCardGrid"></div>`;
  container.innerHTML = html;

  const grid = container.querySelector("#driverCardGrid");
  if (!grid) return;

  // Build cards
  driverNames.forEach((name) => {
    const teamVal = teams[name] || "";
    const card = document.createElement("div");
    card.className = "driver-card";
    card.setAttribute("data-driver", name);

    const nameDiv = document.createElement("div");
    nameDiv.className = "driver-name";
    nameDiv.textContent = name;

    const select = document.createElement("select");
    select.className = "team-select";
    // add suggestion options
    DRIVER_TEAM_SUGGESTIONS.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      select.appendChild(opt);
    });
    // custom option
    const customOpt = document.createElement("option");
    customOpt.value = "__custom__";
    customOpt.textContent = "Custom...";
    select.appendChild(customOpt);

    const customInput = document.createElement("input");
    customInput.className = "driver-team-custom";
    customInput.placeholder = "Custom team";
    customInput.style.display = "none";

    // set initial values
    if (teamVal) {
      const match = DRIVER_TEAM_SUGGESTIONS.find((t) => t === teamVal);
      if (match) select.value = teamVal;
      else {
        select.value = "__custom__";
        customInput.style.display = "block";
        customInput.value = teamVal;
      }
    }

    // Save button per card
    const actions = document.createElement("div");
    actions.className = "card-actions";
    const saveBtn = document.createElement("button");
    // keep semantic class and add download-btn for consistent styling
    saveBtn.className = "save-driver-team-btn download-btn";
    saveBtn.textContent = "Save";
    actions.appendChild(saveBtn);

    card.appendChild(nameDiv);
    card.appendChild(select);
    card.appendChild(customInput);
    card.appendChild(actions);
    grid.appendChild(card);

    // event: select change
    select.addEventListener("change", () => {
      if (select.value === "__custom__") {
        customInput.style.display = "block";
        customInput.focus();
      } else {
        customInput.style.display = "none";
        customInput.value = "";
      }
    });

    // event: save button
    saveBtn.addEventListener("click", () => {
      const driver = card.getAttribute("data-driver");
      const teamsObj = getDriverTeams();
      let val = select.value;
      if (val === "__custom__") val = customInput.value.trim();
      if (val) teamsObj[driver] = val;
      else delete teamsObj[driver];
      saveDriverTeams(teamsObj);
      saveBtn.textContent = "Saved";
      setTimeout(() => (saveBtn.textContent = "Save"), 900);
    });
  });

  // Attach control handlers (Save All, Save to DB, Load from DB, Export)
  const saveAll = container.querySelector("#saveAllDriverTeams");
  if (saveAll)
    saveAll.addEventListener("click", () => {
      const cards = container.querySelectorAll(".driver-card");
      const teamsObj = getDriverTeams();
      cards.forEach((card) => {
        const driver = card.getAttribute("data-driver");
        const sel = card.querySelector(".team-select");
        const custom = card.querySelector(".driver-team-custom");
        let val =
          sel.value === "__custom__" ? (custom.value || "").trim() : sel.value;
        if (val) teamsObj[driver] = val;
        else delete teamsObj[driver];
      });
      saveDriverTeams(teamsObj);
      saveAll.textContent = "Saved";
      setTimeout(() => (saveAll.textContent = "Save All"), 900);
    });

  const saveToDbBtn = container.querySelector("#saveDriverTeamsDB");
  if (saveToDbBtn)
    saveToDbBtn.addEventListener("click", async () => {
      const cards = container.querySelectorAll(".driver-card");
      const teamsObj = getDriverTeams();
      cards.forEach((card) => {
        const driver = card.getAttribute("data-driver");
        const sel = card.querySelector(".team-select");
        const custom = card.querySelector(".driver-team-custom");
        let val =
          sel.value === "__custom__" ? (custom.value || "").trim() : sel.value;
        if (val) teamsObj[driver] = val;
        else delete teamsObj[driver];
      });
      try {
        await saveDriverTeamsToDB(teamsObj);
        saveToDbBtn.textContent = "Saved to DB";
        setTimeout(() => (saveToDbBtn.textContent = "Save to DB"), 1200);
      } catch (err) {
        console.error(err);
        alert("Failed to save to DB: " + (err.message || err));
      }
    });

  const loadFromDbBtn = container.querySelector("#loadDriverTeamsDB");
  if (loadFromDbBtn)
    loadFromDbBtn.addEventListener("click", async () => {
      try {
        const dbTeams = await loadDriverTeamsFromDB(currentSeason);
        saveDriverTeams(dbTeams);
        // re-render with same driverNames
        renderDriverAssignments(driverNames);
      } catch (err) {
        console.error(err);
        alert("Failed to load from DB: " + (err.message || err));
      }
    });

  const exportBtn = container.querySelector("#exportDriverTeams");
  if (exportBtn)
    exportBtn.addEventListener("click", () => {
      const data = getDriverTeams();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "driver_teams.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
}

// ------------------ Supabase persistence helpers ------------------
async function saveDriverTeamsToDB(obj) {
  if (!obj || Object.keys(obj).length === 0) return;
  const rows = Object.entries(obj).map(([driver, team]) => ({
    season: currentSeason,
    driver_name: driver,
    team: team,
  }));

  // Upsert rows using season + driver_name as unique constraint
  const { error } = await supabaseClient
    .from("driver_teams")
    .upsert(rows, { onConflict: "season,driver_name" });
  if (error) throw error;
}

async function loadDriverTeamsFromDB(season) {
  const { data, error } = await supabaseClient
    .from("driver_teams")
    .select("driver_name,team")
    .eq("season", season);
  if (error) throw error;
  const map = {};
  (data || []).forEach((r) => (map[r.driver_name] = r.team));
  return map;
}

function timeStringToSeconds(timeStr) {
  // Convert "01:23.456" or "23.456" to seconds
  if (!timeStr || timeStr === "0.000" || timeStr === "00:00.000") return null;

  const parts = timeStr.split(":");
  if (parts.length === 2) {
    // Format: MM:SS.mmm
    const minutes = parseInt(parts[0]);
    const seconds = parseFloat(parts[1]);
    return minutes * 60 + seconds;
  } else if (parts.length === 1) {
    // Format: SS.mmm
    return parseFloat(parts[0]);
  }
  return 0;
}

function secondsToTimeString(seconds) {
  // Convert seconds to "M:SS.mmm" format
  if (!seconds || seconds < 0) return "0:00.000";

  const totalMinutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  // Pad seconds to SS.mmm (e.g., 04.123 or 42.394)
  const secondsFormatted = secs.toFixed(3);
  const secondsInt = Math.floor(secs);
  const secondsPadded =
    String(secondsInt).padStart(2, "0") +
    secondsFormatted.substring(secondsFormatted.indexOf("."));

  return `${totalMinutes}:${secondsPadded}`;
}

// Collapsible sections helpers
function initCollapsibleSections() {
  try {
    const tabs = Array.from(document.querySelectorAll(".section-tab"));
    const sections = Array.from(
      document.querySelectorAll(".collapsible-section"),
    );
    const activeKey = "active_collapsible_section";
    const storedActive = localStorage.getItem(activeKey);

    function activateSection(targetId) {
      sections.forEach((section) => {
        section.classList.toggle("active", section.id === targetId);
      });
      tabs.forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.target === targetId);
      });
      localStorage.setItem(activeKey, targetId);
    }

    tabs.forEach((tab) => {
      const targetId = tab.dataset.target;
      tab.addEventListener("click", () => {
        activateSection(targetId);
      });
    });

    const defaultSection =
      storedActive && document.getElementById(storedActive)
        ? storedActive
        : "section-standings";
    activateSection(defaultSection);
  } catch (err) {
    console.warn("initCollapsibleSections failed", err);
  }
}
