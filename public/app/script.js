let allSessions = [];
let currentData = null;
let currentSeason = 1;
let qualiGapMode = "leader";
const charts = {};

// ---------------------------------------------------------------
// Embed / deep-link bootstrap
// The React shell iframes this app with ?season=&track=&view=
// to render a single focused view (standings, race-story, etc).
// ---------------------------------------------------------------
const EMBED_QP = (() => {
  try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(); }
})();
const EMBED_VIEW   = EMBED_QP.get("view");    // e.g. "race-story"
const EMBED_SEASON = EMBED_QP.get("season");  // "1" | "2" ...
const EMBED_TRACK  = EMBED_QP.get("track");   // track_name
const EMBED_CAT    = EMBED_QP.get("cat");     // optional category filter
if (EMBED_VIEW) {
  const cls = EMBED_VIEW === "upload" ? "embed-upload" : "embed-mode";
  document.documentElement.classList.add(cls);
  document.body && document.body.classList.add(cls);
  document.addEventListener("DOMContentLoaded", () => document.body.classList.add(cls));
}

function _embedApplyView() {
  if (!EMBED_VIEW) return;
  const targetId = "section-" + EMBED_VIEW;
  document.querySelectorAll(".collapsible-section").forEach((s) => {
    s.classList.toggle("active", s.id === targetId);
    if (s.id !== targetId) s.style.display = "none";
  });
  document.querySelectorAll(".section-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.target === targetId);
  });
}
function _embedNotifyReady(status) {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "f1-embed-ready", status: status || "ok", view: EMBED_VIEW }, "*");
    }
  } catch (e) { /* ignore */ }
}
function _embedSelectSession() {
  if (!EMBED_TRACK) { _embedNotifyReady("no-track"); return; }
  const wanted = String(EMBED_TRACK).toLowerCase();
  const wantedCat = EMBED_CAT ? String(EMBED_CAT).toLowerCase() : null;
  const seasonN = Number(EMBED_SEASON || currentSeason);
  const isPracticeView = EMBED_VIEW === "practice";
  // For the practice view we pick a Practice or Sprint session regardless of
  // `cat`, so the "Race → Practice" link surfaces every uploaded practice
  // AND the sprint for the same weekend.
  const isPracticeLikeSession = (s) => {
    const c = (s.category || "").toLowerCase();
    const st = (s.session_type || "").toLowerCase();
    // Only Practice sessions and the (race) Sprint. Exclude Qualifying and Sprint Shootout/Qualifying.
    return (
      c === "practice" || c.startsWith("practice") ||
      c === "sprint" ||
      /^p[123]$/.test(st) || st.includes("practice") || st.includes("fp")
    );
  };
  const match = allSessions.find((s) => {
    if (Number(s.season) !== seasonN) return false;
    if ((s.track_name || "").toLowerCase() !== wanted) return false;
    if (isPracticeView) return isPracticeLikeSession(s);
    return !wantedCat || (s.category || "").toLowerCase() === wantedCat;
  });
  if (match) {
    currentData = match;
    try { renderContent(); } catch (e) { console.warn(e); }
    if (isPracticeView) { try { _embedRenderPracticePicker(); } catch (e) { console.warn(e); } }
    _embedNotifyReady("ok");
  } else {
    if (isPracticeView) { try { _embedRenderPracticePicker(); } catch (e) { console.warn(e); } }
    _embedNotifyReady("no-match");
  }
}

// Render a session picker at the top of the practice section listing every
// Practice (and Sprint) session uploaded for this track so the user can
// switch between P1/P2/P3/Sprint.
function _embedRenderPracticePicker() {
  const section = document.getElementById("section-practice");
  if (!section) return;
  const wanted = String(EMBED_TRACK || "").toLowerCase();
  const seasonN = Number(EMBED_SEASON || currentSeason);
  const isPracticeLike = (s) => {
    const c = (s.category || "").toLowerCase();
    const st = (s.session_type || "").toLowerCase();
    return (
      c === "practice" || c.startsWith("practice") ||
      c === "sprint" ||
      /^p[123]$/.test(st) || st.includes("practice") || st.includes("fp")
    );
  };
  const orderKey = (s) => {
    const c = (s.category || "").toLowerCase();
    const st = (s.session_type || "").toLowerCase();
    if (/^p1$/.test(st) || st.includes("practice 1") || st.includes("fp1")) return "1";
    if (/^p2$/.test(st) || st.includes("practice 2") || st.includes("fp2")) return "2";
    if (/^p3$/.test(st) || st.includes("practice 3") || st.includes("fp3")) return "3";
    if (c === "sprint qualifying" || c === "sprint shootout") return "4";
    if (c === "sprint") return "5";
    return "9" + (s.session_type || "");
  };
  const list = allSessions
    .filter((s) =>
      Number(s.season) === seasonN &&
      (s.track_name || "").toLowerCase() === wanted &&
      isPracticeLike(s),
    )
    .sort((a, b) => orderKey(a).localeCompare(orderKey(b)));

  let picker = document.getElementById("embedPracticePicker");
  if (!picker) {
    picker = document.createElement("div");
    picker.id = "embedPracticePicker";
    picker.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 18px;padding:12px;border:1px solid var(--border-color);border-radius:10px;background:rgba(255,255,255,0.04);";
    const body = section.querySelector(".section-body");
    if (body) body.prepend(picker); else section.prepend(picker);
  }
  if (list.length === 0) {
    const totalPract = allSessions.filter(isPracticeLike).length;
    picker.innerHTML = `<div style="color:var(--secondary-text);font-size:0.9rem">No Practice or Sprint sessions uploaded for this track yet (season ${seasonN}, track "${wanted}"). Total practice/sprint sessions across all tracks: ${totalPract}. Upload a Practice_*.json or Sprint_*.json to see the summary here.</div>`;
    return;
  }
  const currentId = currentData && (currentData.id || currentData.created_at);
  const labelFor = (s) => {
    const st = s.session_type || "";
    const c = (s.category || "").toLowerCase();
    if (st) return st;
    if (c === "sprint") return "Sprint";
    if (c === "sprint qualifying" || c === "sprint shootout") return "Sprint Quali";
    return "Practice";
  };
  picker.innerHTML =
    '<div style="width:100%;font-size:0.72rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--secondary-text);margin-bottom:4px">Practice & Sprint Sessions</div>' +
    list.map((s) => {
      const id = s.id || s.created_at;
      const label = labelFor(s);
      const isActive = String(id) === String(currentId);
      const isSprint = (s.category || "").toLowerCase().startsWith("sprint");
      const accent = isSprint ? "#f59e0b" : "#ef4444";
      return `<button type="button" data-sid="${id}" style="padding:8px 14px;border-radius:8px;border:1px solid ${isActive ? accent : "rgba(255,255,255,0.15)"};background:${isActive ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.03)"};color:#fff;font-weight:700;font-size:0.85rem;cursor:pointer">${label}</button>`;
    }).join("");
  picker.querySelectorAll("button[data-sid]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sid = btn.getAttribute("data-sid");
      const next = list.find((s) => String(s.id || s.created_at) === String(sid));
      if (next) {
        currentData = next;
        try { renderContent(); } catch (e) { console.warn(e); }
        _embedRenderPracticePicker();
      }
    });
  });
}
if (EMBED_SEASON) currentSeason = Number(EMBED_SEASON) || 1;



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

// Initialize Supabase lazily so GitHub Pages stays interactive even if the CDN is slow/blocked.
const SUPABASE_URL = "https://kbjjtiajugxvhoboqxwb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtiamp0aWFqdWd4dmhvYm9xeHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwODE5NzUsImV4cCI6MjA5MTY1Nzk3NX0.VI2B5EcQXx_aaXyOB-eGXentTbMRG6obxu6IjUv7juI";
let supabaseClient = null;
let supabaseWarningShown = false;

function getSupabaseClient(options = {}) {
  if (supabaseClient) return supabaseClient;
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    if (!options.silent && !supabaseWarningShown) {
      console.warn("Supabase library is not available yet; DB features are temporarily disabled.");
      supabaseWarningShown = true;
    }
    return null;
  }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseClient;
}

function loadDatabaseBackedData() {
  return loadSavedSessions().then(async () => {
    await autoLoadDriverTeams();
  });
}

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

// 26 tracks available for personal notes (F1 game roster incl. legacy tracks)
const NOTES_TRACKS = [
  { key: "melbourne", label: "Melbourne", flag: "🇦🇺" },
  { key: "shanghai", label: "Shanghai", flag: "🇨🇳" },
  { key: "suzuka", label: "Suzuka", flag: "🇯🇵" },
  { key: "sakhir", label: "Bahrain", flag: "🇧🇭" },
  { key: "jeddah", label: "Jeddah", flag: "🇸🇦" },
  { key: "miami", label: "Miami", flag: "🇺🇸" },
  { key: "imola", label: "Imola", flag: "🇮🇹" },
  { key: "monaco", label: "Monaco", flag: "🇲🇨" },
  { key: "montreal", label: "Montreal", flag: "🇨🇦" },
  { key: "catalunya", label: "Catalunya", flag: "🇪🇸" },
  { key: "austria", label: "Red Bull Ring", flag: "🇦🇹" },
  { key: "silverstone", label: "Silverstone", flag: "🇬🇧" },
  { key: "spa", label: "Spa", flag: "🇧🇪" },
  { key: "hungaroring", label: "Hungaroring", flag: "🇭🇺" },
  { key: "zandvoort", label: "Zandvoort", flag: "🇳🇱" },
  { key: "monza", label: "Monza", flag: "🇮🇹" },
  { key: "madring", label: "Madring", flag: "🇪🇸" },
  { key: "baku", label: "Baku", flag: "🇦🇿" },
  { key: "singapore", label: "Singapore", flag: "🇸🇬" },
  { key: "texas", label: "COTA", flag: "🇺🇸" },
  { key: "mexico", label: "Mexico City", flag: "🇲🇽" },
  { key: "brazil", label: "Interlagos", flag: "🇧🇷" },
  { key: "las_vegas", label: "Las Vegas", flag: "🇺🇸" },
  { key: "losail", label: "Losail", flag: "🇶🇦" },
  { key: "abu_dhabi", label: "Yas Marina", flag: "🇦🇪" },
  { key: "portimao", label: "Portimão", flag: "🇵🇹" },
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

  renderSeasonSelector();
  initCollapsibleSections();
  _embedApplyView();

  // Load sessions then attempt to auto-load driver teams for the selected season.
  // This runs after the UI is wired so slow/failed DB startup cannot freeze clicks.
  loadDatabaseBackedData();
  loadTrackNotes();
  window.addEventListener("supabase-ready", () => { loadDatabaseBackedData(); loadTrackNotes(); }, {

    once: true,
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

  const _st = document.getElementById("searchTrack");
  if (_st) _st.addEventListener("input", () => renderSavedSessions(allSessions));
  const _fc = document.getElementById("filterCategory");
  if (_fc) _fc.addEventListener("change", () => renderSavedSessions(allSessions));
  const _ss = document.getElementById("sortSessions");
  if (_ss) _ss.addEventListener("change", () => renderSavedSessions(allSessions));
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

        // Persist every session, including Practice, so it shows up under the race weekend card
        sessionsToPersist.push(session);
        lastProcessedSession = session;
      }
    } catch (err) {
      console.error(`Error processing file ${file.name}:`, err);
    }
  }

  if (lastProcessedSession) {
    if (sessionsToPersist.length > 0) {
      await saveSessions(sessionsToPersist);
      currentData =
        allSessions.find(
          (s) => s.session_date === lastProcessedSession.created_at,
        ) || lastProcessedSession;
    } else {
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

function buildRaceStory(rootData, playerName, playerTeam, classification_data) {
  if (!rootData || typeof rootData !== "object") return null;
  const positionHistoryRoot = rootData["position-history"] || [];
  const overtakeRecords = rootData["overtakes"]?.records || [];
  const speedTraps = rootData["speed-trap-records"] || [];

  const playerPos = positionHistoryRoot.find((p) => p.name === playerName);
  if (!playerPos && !classification_data?.length) return null;

  const position_history = (playerPos?.["driver-position-history"] || [])
    .filter((p) => p["lap-number"] >= 0)
    .map((p) => ({ lap: p["lap-number"], position: p.position }));

  // Podium = top 3 by final-classification.position
  const podium = [];
  const sortedClass = [...(classification_data || [])]
    .filter((e) => e["final-classification"]?.position)
    .sort(
      (a, b) =>
        (a["final-classification"]?.position || 99) -
        (b["final-classification"]?.position || 99),
    )
    .slice(0, 3);
  sortedClass.forEach((entry) => {
    const name = String(entry["driver-name"] || "").toUpperCase();
    if (name === playerName) return; // shown as the main line
    const ph = positionHistoryRoot.find((p) => p.name === name);
    if (!ph) return;
    podium.push({
      name,
      team: entry.team || "",
      final: entry["final-classification"]?.position,
      history: (ph["driver-position-history"] || [])
        .filter((p) => p["lap-number"] >= 0)
        .map((p) => ({ lap: p["lap-number"], position: p.position })),
    });
  });

  const overtakes_made = overtakeRecords
    .filter((o) => o["overtaking-driver-name"] === playerName)
    .map((o) => ({ lap: o["overtaking-driver-lap"], opponent: o["overtaken-driver-name"] }));
  const overtakes_suffered = overtakeRecords
    .filter((o) => o["overtaken-driver-name"] === playerName)
    .map((o) => ({ lap: o["overtaken-driver-lap"], opponent: o["overtaking-driver-name"] }));

  // Pace delta vs field median (in ms)
  const driverLapTimes = (classification_data || []).map((e) => ({
    name: String(e["driver-name"] || "").toUpperCase(),
    laps: (e["lap-time-history"]?.["lap-history-data"] || []).map(
      (l) => l["lap-time-in-ms"] || 0,
    ),
  }));
  const playerLaps =
    driverLapTimes.find((d) => d.name === playerName)?.laps || [];
  const pace_delta = [];
  for (let i = 0; i < playerLaps.length; i++) {
    const playerMs = playerLaps[i];
    if (!playerMs || playerMs <= 0) continue;
    const others = driverLapTimes
      .map((d) => d.laps[i])
      .filter((v) => typeof v === "number" && v > 0);
    if (others.length < 3) continue;
    const sorted = [...others].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    pace_delta.push({
      lap: i + 1,
      delta_ms: playerMs - median,
      median_ms: median,
      player_ms: playerMs,
    });
  }

  const speed_traps = [...speedTraps]
    .sort(
      (a, b) =>
        (b["speed-trap-record-kmph"] || 0) - (a["speed-trap-record-kmph"] || 0),
    )
    .map((s) => ({
      name: s.name,
      team: s.team,
      kmph: Math.round(s["speed-trap-record-kmph"] || 0),
    }));

  // Fastest lap of the race (overall, across all drivers).
  // Guard against corrupted / stale telemetry entries (e.g. a lapped driver
  // showing a phantom 25s lap). Collect plausible laps, derive a race-wide
  // median, then reject anything unrealistically quick, with missing/zero
  // sectors, mismatched sector sum, or beyond the driver's completed laps.
  const flCandidates = [];
  (classification_data || []).forEach((e) => {
    const name = String(e["driver-name"] || "").toUpperCase();
    const team = e.team || "";
    const laps = e["lap-time-history"]?.["lap-history-data"] || [];
    const fc = e["final-classification"] || {};
    const completedLaps = fc["num-laps"] || laps.length;
    const driverBestMs = fc["best-lap-time-ms"] || 0;
    laps.forEach((l, i) => {
      const lapNum = i + 1;
      if (lapNum > completedLaps) return; // stale rows past retirement
      const ms = l["lap-time-in-ms"] || 0;
      if (ms <= 0) return;
      const s1 = l["sector-1-time-in-ms"] || 0;
      const s2 = l["sector-2-time-in-ms"] || 0;
      const s3 = l["sector-3-time-in-ms"] || 0;
      if (s1 <= 0 || s2 <= 0 || s3 <= 0) return;
      if (Math.abs(s1 + s2 + s3 - ms) > 500) return;
      const flags = l["lap-valid-bit-flags"];
      const valid = flags === undefined || (flags & 1);
      if (!valid) return;
      // Reject laps clearly faster than driver's own reported best
      if (driverBestMs > 0 && ms < driverBestMs - 50) return;
      flCandidates.push({ name, team, lap: lapNum, ms });
    });
  });
  let fastest_lap = null;
  if (flCandidates.length) {
    const sortedMs = flCandidates.map((c) => c.ms).sort((a, b) => a - b);
    const median = sortedMs[Math.floor(sortedMs.length / 2)];
    // Reject anything faster than 75% of median (impossible pace = corrupt)
    const floor = median * 0.75;
    const pool = flCandidates.filter((c) => c.ms >= floor);
    const finalPool = pool.length ? pool : flCandidates;
    finalPool.forEach((c) => {
      if (!fastest_lap || c.ms < fastest_lap.time_ms) {
        const totalSec = c.ms / 1000;
        const m = Math.floor(totalSec / 60);
        const s = (totalSec - m * 60).toFixed(3).padStart(6, "0");
        fastest_lap = { name: c.name, team: c.team, lap: c.lap, time_ms: c.ms, lap_time_str: `${m}:${s}` };
      }
    });
  }

  // Driver of the Day — pulled from common field names if game records it
  let driver_of_the_day = null;
  (classification_data || []).forEach((e) => {
    const fc = e["final-classification"] || {};
    if (fc["driver-of-the-day"] || fc["is-driver-of-the-day"] || e["driver-of-the-day"]) {
      driver_of_the_day = String(e["driver-name"] || "").toUpperCase();
    }
  });
  const rootDOTD = rootData?.["driver-of-the-day"] || rootData?.["records"]?.["driver-of-the-day"];
  if (!driver_of_the_day && rootDOTD) driver_of_the_day = String(rootDOTD).toUpperCase();

  // Final classification (every driver) with total time, best lap, status.
  // Include DNFs (no position / non-finished status / short on laps) with is_dnf flag.
  const rawEntries = (classification_data || []).map((e) => {
    const fc = e["final-classification"] || {};
    return {
      position: fc.position || null,
      name: String(e["driver-name"] || "").toUpperCase(),
      team: e.team || "",
      laps: fc["num-laps"] || 0,
      time_s: fc["total-race-time"] || 0,
      time_str: fc["total-race-time-str"] || "",
      best_lap_ms: fc["best-lap-time-ms"] || 0,
      best_lap_str: fc["best-lap-time-str"] || "",
      status: fc["result-status"] || "",
      points: fc.points || 0,
      pits: fc["num-pit-stops"] || 0,
    };
  }).filter((e) => e.name);
  const maxLaps = rawEntries.reduce((m, e) => Math.max(m, e.laps || 0), 0);
  const decorated = rawEntries.map((e) => {
    const statusStr = String(e.status || "").toUpperCase();
    const statusDnf = statusStr && !/FINISHED|ACTIVE/.test(statusStr);
    const missingPos = !e.position || e.position <= 0;
    const shortLaps = maxLaps >= 5 && e.laps > 0 && e.laps < maxLaps - 2 && !e.time_s;
    const is_dnf = statusDnf || (missingPos && (e.laps === 0 || !e.time_s)) || shortLaps;
    return { ...e, is_dnf };
  });
  const finishers = decorated
    .filter((e) => e.position && !e.is_dnf)
    .sort((a, b) => a.position - b.position);
  const dnfs = decorated
    .filter((e) => e.is_dnf || !e.position)
    .sort((a, b) => (b.laps || 0) - (a.laps || 0));
  let nextPos = (finishers[finishers.length - 1]?.position || finishers.length) + 1;
  dnfs.forEach((e) => {
    if (!e.position || e.position <= 0) e.position = nextPos++;
    e.is_dnf = true;
    if (!e.status) e.status = "DNF";
  });
  const classification = [...finishers, ...dnfs];

  // Per-driver lap times for the Compare tab
  const driver_lap_times = (classification_data || []).map((e) => ({
    name: String(e["driver-name"] || "").toUpperCase(),
    team: e.team || "",
    laps: (e["lap-time-history"]?.["lap-history-data"] || []).map((l, i) => ({
      lap: i + 1,
      ms: l["lap-time-in-ms"] || 0,
      s1: l["sector-1-time-in-ms"] || 0,
      s2: l["sector-2-time-in-ms"] || 0,
      s3: l["sector-3-time-in-ms"] || 0,
      valid: l["lap-valid-bit-flags"] === undefined || !!(l["lap-valid-bit-flags"] & 1),
    })),
  })).filter((d) => d.name && d.laps.length);

  return {
    player_name: playerName,
    player_team: playerTeam,
    position_history,
    podium,
    overtakes_made,
    overtakes_suffered,
    pace_delta,
    speed_traps,
    fastest_lap,
    driver_of_the_day,
    classification,
    driver_lap_times,
  };
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
            damage: {
              fl_wing: damage["front-left-wing-damage"] || 0,
              fr_wing: damage["front-right-wing-damage"] || 0,
              rear_wing: damage["rear-wing-damage"] || 0,
              floor: damage["floor-damage"] || 0,
              diffuser: damage["diffuser-damage"] || 0,
              sidepod: damage["sidepod-damage"] || 0,
              gearbox: damage["gear-box-damage"] || 0,
              engine: damage["engine-damage"] || 0,
              drs_fault: !!damage["drs-fault"],
              ers_fault: !!damage["ers-fault"],
            },
          });
        });

        summary.race_story = buildRaceStory(
          data,
          driver_name,
          obj.team || "",
          classification_data,
        );
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
    const db = getSupabaseClient();
    if (!db) return;

    const { data: sessions, error } = await db
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
        race_story: s.race_story || null,
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
  const db = getSupabaseClient();
  if (!db) {
    throw new Error("Database connection is still loading. Please try again in a moment.");
  }

  // Attach the signed-in user so RLS accepts the insert.
  let uid = null;
  try {
    const { data } = await db.auth.getUser();
    uid = data?.user?.id || null;
  } catch (e) { /* ignore */ }
  if (!uid) {
    throw new Error("You must be signed in to save sessions.");
  }

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
    race_story: session.race_story || null,
    user_id: uid,
  }));

  // Overwrite: delete any existing row matching driver+track+season+category (+ session_type for Practice/Quali) then insert
  for (const row of dataToInsert) {
    try {
      const match = {
        driver_name: row.driver_name,
        track_name: row.track_name,
        season: row.season,
        category: row.category,
      };
      // For sessions with distinct session_type (P1/P2/P3, Q1/Q2/Q3), scope
      // the overwrite so uploading FP2 doesn't wipe FP1 for the same weekend.
      if (row.session_type) match.session_type = row.session_type;
      await db.from("telemetry_sessions").delete().match(match);
    } catch (err) {
      console.warn("Pre-delete for overwrite failed (continuing):", err);
    }
  }

  const { error } = await db
    .from("telemetry_sessions")
    .insert(dataToInsert);

  if (error) throw error;
  await loadSavedSessions();
}

// Compute Win / Pole / Fastest-lap / Grand-slam flags for a saved session
function getSessionBadges(session) {
  const cat = (session.category || "").toLowerCase();
  const isRaceLike = cat === "race" || cat === "sprint";
  if (!isRaceLike) return { win: false, pole: false, fl: false, grandSlam: false };
  const finish = Number(session.finishing_position ?? session.finishing_pos);
  const start = Number(session.starting_position ?? session.starting_pos);
  const rs = session.race_story || {};
  const playerName = (rs.player_name || session.driver_name || "").toUpperCase();
  const win = finish === 1;
  const pole = start === 1;
  const fl =
    !!(rs.fastest_lap && (rs.fastest_lap.name || "").toUpperCase() === playerName);
  const ledEveryLap =
    Array.isArray(rs.position_history) &&
    rs.position_history.length > 1 &&
    rs.position_history.filter((p) => p.lap >= 1).every((p) => p.position === 1);
  const grandSlam = cat === "race" && win && pole && fl && ledEveryLap;
  return { win, pole, fl, grandSlam };
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
    const db = getSupabaseClient();
    if (!db) {
      alert("Database connection is still loading. Please try again in a moment.");
      return;
    }

    const { error } = await db
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
    const db = getSupabaseClient();
    if (!db) {
      alert("Database connection is still loading. Please try again in a moment.");
      return;
    }

    const { error } = await db
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

  // Render summary cards at the TOP of the main pane
  let summaryContainer = document.getElementById("seasonSummaryCards");
  if (!summaryContainer) {
    summaryContainer = document.createElement("div");
    summaryContainer.id = "seasonSummaryCards";
    summaryContainer.className = "season-summary";
  }
  const summaryHost = document.getElementById("seasonStatsHost");
  if (summaryHost && summaryContainer.parentElement !== summaryHost) {
    summaryHost.appendChild(summaryContainer);
  }
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

  // Build flat list of sessions for the active season, sorted newest first
  const displaySessions = sessions
    .filter((s) => s.season === currentSeason)
    .filter((s) => s.category !== "Qualifying" && s.category !== "Sprint Shootout")
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const catLabel = (c) => {
    if (!c) return "";
    if (c === "Sprint Shootout") return "SHOOTOUT";
    return c.toUpperCase();
  };

  displaySessions.forEach((session) => {
    const trackKey = (session.track_name || "").toLowerCase();
    const flag = trackToFlag[trackKey] || "🏁";
    const weatherIcon = determineWeatherIcon(session);
    const badges = getSessionBadges(session);
    const badgeHtml = [
      badges.grandSlam ? '<span class="result-tag mini tag-gs" title="Grand Slam">GS</span>' : "",
      badges.win ? '<span class="result-tag mini tag-w" title="Win">W</span>' : "",
      badges.pole ? '<span class="result-tag mini tag-p" title="Pole">P</span>' : "",
      badges.fl ? '<span class="result-tag mini tag-fl" title="Fastest Lap">FL</span>' : "",
    ].join("");

    const card = document.createElement("div");
    card.className = `session-row ${currentData && currentData.id === session.id ? "active" : ""}`;
    card.innerHTML = `
      <button class="delete-btn" title="Delete">🗑️</button>
      <div class="sr-left">
        <div class="sr-track">
          <span class="flag-icon">${flag}</span>
          <span class="sr-track-name">${session.track_name || "Unknown"}</span>
        </div>
      </div>
      <div class="sr-right">
        <span class="sr-cat">🏁 ${catLabel(session.category)}</span>
        <span class="sr-weather">${weatherIcon}</span>
        ${badgeHtml}
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
  if (EMBED_VIEW && !currentData) _embedSelectSession();
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
  renderRaceStory();
  renderCompareTab();
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

    const prCompKey = String(lap.current_tyre_compound).toUpperCase();
    const prDotColor = COMPOUND_COLORS[prCompKey] || "#888";
    const prRgba = (hex, a) => {
      const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${a})`;
    };
    const prCompoundBadge = `<span class="compound-badge" style="background:${prRgba(prDotColor, 0.12)};border-color:${prRgba(prDotColor, 0.45)};color:${prDotColor}"><span class="compound-dot" style="background-color:${prDotColor}"></span>${lap.current_tyre_compound}</span>`;

    row.innerHTML = `
            <td class="text-center"><input type="checkbox" class="lap-select-cb" ${selectedPracticeLaps.has(lap.lap) ? "checked" : ""}></td>
            <td class="text-center" style="padding: 8px 4px;">${lap.lap}</td>
            <td class="text-center" style="padding: 8px 4px;">${statusLabel}</td>
            <td class="text-center" style="padding: 8px 4px;">${lap.lap_time}</td>
            <td class="text-center group-start" style="padding: 8px 4px;">${lap.s1}</td>
            <td class="text-center" style="padding: 8px 4px;">${lap.s2}</td>
            <td class="text-center group-end" style="padding: 8px 4px;">${lap.s3}</td>
            <td class="text-center" style="padding: 8px 4px;">${prCompoundBadge}</td>
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

    const weatherIcon = determineWeatherIcon(session);
    let tableHtml = `
      <h3 style="margin-bottom: 12px; color: var(--accent-red); font-size: 0.9rem; text-transform: uppercase; display:flex; align-items:center; gap:8px;">
        <span>⏱️ ${segmentTitle}</span>
        <span style="font-size:1.1rem;">${weatherIcon}</span>
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
  enableTableRowReorder("#quali-results-container table");
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

  // Consistency rating: STINT-SEPARATED weighted CV across clean racing laps.
  // Each stint is measured on its own (accounts for fuel burn, tyre compound,
  // and track evolution), then combined by clean-lap weight into a Total CV.
  // Rating = max(0, min(100, 100 − Total CV × 2500)).
  const pitLapNumbers = new Set(
    laps
      .filter((l) => Number(l.pit_status || 0) === 1)
      .map((l) => Number(l.lap)),
  );
  const isCleanForConsistency = (l) => {
    if (!l) return false;
    const lapNum = Number(l.lap);
    if (lapNum === 1) return false;
    if (Number(l.pit_status || 0) === 1) return false;
    if (Number(l.sc_status || 0) > 0) return false; // SC, VSC, Red
    if (pitLapNumbers.has(lapNum - 1)) return false; // out-lap
    return true;
  };

  // Build stint lap groups. Prefer explicit stint boundaries when available,
  // otherwise segment on pit laps / compound changes.
  const stintGroups = [];
  if (Array.isArray(currentData.stints) && currentData.stints.length > 0) {
    currentData.stints.forEach((s) => {
      const sl = Number(s["start-lap"]);
      const el = Number(s["end-lap"]);
      const g = laps.filter((l) => {
        const n = Number(l.lap);
        return n >= sl && n <= el;
      });
      if (g.length) stintGroups.push(g);
    });
  } else if (laps.length) {
    let cur = [];
    let curCompound = laps[0].current_tyre_compound;
    laps.forEach((l) => {
      const comp = l.current_tyre_compound;
      if (cur.length && comp !== curCompound) {
        stintGroups.push(cur);
        cur = [];
        curCompound = comp;
      }
      cur.push(l);
      if (Number(l.pit_status || 0) === 1) {
        stintGroups.push(cur);
        cur = [];
        curCompound = null;
      }
    });
    if (cur.length) stintGroups.push(cur);
  }

  // Per-stint CV, with >107% of stint median trimmed as outliers.
  const stintStats = [];
  let totalCleanLaps = 0;
  stintGroups.forEach((group) => {
    const times = group
      .filter(isCleanForConsistency)
      .map((l) => timeStringToSeconds(l.lap_time))
      .filter((t) => typeof t === "number" && t > 0);
    if (times.length < 3) return;
    const sorted = [...times].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const trimmed = times.filter((t) => t <= median * 1.07);
    const sample = trimmed.length >= 3 ? trimmed : times;
    const mean = sample.reduce((a, b) => a + b, 0) / sample.length;
    const variance =
      sample.reduce((a, b) => a + (b - mean) * (b - mean), 0) / sample.length;
    const stddev = Math.sqrt(variance);
    const cv = mean > 0 ? stddev / mean : 0;
    stintStats.push({ cv, cleanLaps: sample.length });
    totalCleanLaps += sample.length;
  });

  let consistencyHtml = "—";
  let consistencyTitle =
    "Needs ≥3 clean racing laps in at least one stint (excludes lap 1, in/out laps, SC/VSC/Red, >107% of stint median)";
  if (totalCleanLaps >= 3 && stintStats.length > 0) {
    const totalCV = stintStats.reduce(
      (acc, s) => acc + s.cv * (s.cleanLaps / totalCleanLaps),
      0,
    );
    const rating = Math.max(0, Math.min(100, 100 - totalCV * 2500));
    const tier =
      rating >= 92 ? "elite" : rating >= 82 ? "good" : rating >= 68 ? "mid" : "low";
    consistencyHtml = `<span class="consistency-pill consistency-${tier}">${rating.toFixed(1)}<span class="consistency-unit">/100</span></span>`;
    const perStint = stintStats
      .map((s, i) => `S${i + 1}: CV ${(s.cv * 100).toFixed(2)}% (${s.cleanLaps} laps)`)
      .join(" · ");
    consistencyTitle =
      `Weighted Total CV ${(totalCV * 100).toFixed(3)}% across ${stintStats.length} stint${stintStats.length > 1 ? "s" : ""} · ${totalCleanLaps} clean laps · ${perStint}`;
  }

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
        <div class="info-item" title="${consistencyTitle.replace(/"/g, "&quot;")}">
            <div class="info-label" style="display:flex;align-items:center;gap:6px;">Consistency Rating<span class="hint-icon" data-tooltip="Stint-Separated Weighted CV. For each stint: filter clean laps (excl. lap 1, in/out laps, SC/VSC/Red, >107% of stint median), compute Stint CV = σ/mean. Total CV = Σ [Stint CV × (stint clean laps / total clean laps)]. Rating = max(0, min(100, 100 − Total CV × 2500)).">?</span></div>
            <div class="info-value">${consistencyHtml}</div>
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

// Exclude pit laps, the starting lap, and red-flag laps from "clean" race-pace metrics
function isCleanRaceLap(lap) {
  if (!lap) return false;
  if (Number(lap.lap) === 1) return false;
  if (Number(lap.pit_status || 0) === 1) return false;
  if (Number(lap.sc_status || 0) === 3) return false;
  return true;
}

// Group contiguous SC/VSC/Red-Flag laps into single periods.
// Returns [{ status, firstLap, lastLap, startOffset, endOffset, label }]
// where startOffset/endOffset ∈ [-0.5, 0.5] are added to the lap index to
// describe a half-lap shading boundary. We infer mid-lap start/end by
// comparing the first/last flagged lap time to the median clean lap time:
// a "normal" lap means the SC was only active for part of it.
function computeSafetyCarPeriods(laps) {
  if (!Array.isArray(laps) || laps.length === 0) return [];

  const cleanTimes = laps
    .filter(
      (l) =>
        Number(l.sc_status || 0) === 0 &&
        Number(l.pit_status || 0) === 0 &&
        Number(l.lap) > 1,
    )
    .map((l) => timeStringToSeconds(l.lap_time))
    .filter((t) => typeof t === "number" && t > 0);

  let median = null;
  if (cleanTimes.length) {
    const sorted = cleanTimes.slice().sort((a, b) => a - b);
    median = sorted[Math.floor(sorted.length / 2)];
  }
  // SC laps usually cost 15-30s; treat <8s over median as "barely affected"
  const PARTIAL_THRESHOLD = 8;

  const labelFor = (st) => (st === 3 ? "RED" : st === 2 ? "VSC" : "SC");

  const periods = [];
  let i = 0;
  while (i < laps.length) {
    const st = Number(laps[i].sc_status || 0);
    if (st === 0) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < laps.length && Number(laps[j + 1].sc_status || 0) === st) {
      j++;
    }
    let startOffset = -0.5;
    let endOffset = 0.5;
    if (median !== null) {
      const firstT = timeStringToSeconds(laps[i].lap_time);
      const lastT = timeStringToSeconds(laps[j].lap_time);
      if (
        typeof firstT === "number" &&
        firstT > 0 &&
        firstT - median < PARTIAL_THRESHOLD
      ) {
        // first SC lap is near normal pace → SC engaged near the end of it
        startOffset = 0;
      }
      if (
        typeof lastT === "number" &&
        lastT > 0 &&
        lastT - median < PARTIAL_THRESHOLD &&
        j !== i // don't collapse a single-lap period to zero width
      ) {
        // last SC lap is near normal pace → SC released near the start of it
        endOffset = 0;
      }
    }
    periods.push({
      status: st,
      firstLap: Number(laps[i].lap),
      lastLap: Number(laps[j].lap),
      startOffset,
      endOffset,
      label: labelFor(st),
    });
    i = j + 1;
  }
  return periods;
}

// Returns lap numbers where the player pitted, used to draw vertical lines on race charts
function getPlayerPitLaps() {
  const stints = currentData?.stints || [];
  if (stints.length > 1) {
    return stints
      .slice(0, -1)
      .map((s) => Number(s["end-lap"]))
      .filter((n) => Number.isFinite(n) && n > 0);
  }
  const laps = currentData?.lap_history || [];
  return laps
    .filter((l) => Number(l.pit_status) === 1)
    .map((l) => Number(l.lap))
    .filter((n) => Number.isFinite(n) && n > 0);
}

// Chart.js plugin: draws dashed vertical "PIT" markers at given lap numbers.
// Usage: register in `plugins: [pitLinesPlugin]` and pass options via
// `options.plugins.pitLines = { laps: [...], color: '#ffc233' }`.
const pitLinesPlugin = {
  id: "pitLines",
  afterDatasetsDraw(chart, _args, opts) {
    const laps = (opts && opts.laps) || [];
    if (!laps.length) return;
    const { ctx, chartArea, scales } = chart;
    const x = scales.x;
    if (!x) return;
    const color = (opts && opts.color) || "rgba(255, 194, 51, 0.75)";
    ctx.save();
    ctx.strokeStyle = color;
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.4;
    ctx.fillStyle = color;
    ctx.font = "10px 'JetBrains Mono', monospace";
    // Resolve a lap number to a pixel using the chart's actual label array.
    // Chart.js category scales treat the first arg to getPixelForValue() as
    // an index, so passing the lap number directly draws the line offset by
    // (labels[0] - 0) ticks — usually 1, sometimes 2 if the telemetry skips a
    // lap. Look up the label's real index to stay aligned with the data.
    const labels = (chart.data && chart.data.labels) || [];
    const resolveX = (lap) => {
      if (labels.length) {
        const idx = labels.findIndex((v) => Number(v) === Number(lap));
        if (idx >= 0) return x.getPixelForValue(idx);
      }
      return x.getPixelForValue(lap);
    };
    laps.forEach((lap) => {
      const xPos = resolveX(lap);
      if (xPos < chartArea.left || xPos > chartArea.right) return;
      ctx.beginPath();
      ctx.moveTo(xPos, chartArea.top);
      ctx.lineTo(xPos, chartArea.bottom);
      ctx.stroke();
      ctx.fillText("PIT L" + lap, xPos + 3, chartArea.top + 11);
    });
    ctx.restore();
  },
};

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
          .filter(isCleanRaceLap)
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
        .filter(isCleanRaceLap)
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

  renderPaceDeltaChart();


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

      // Chart.js category scales treat the first arg to getPixelForValue() as
      // an index, so passing the actual lap number draws everything offset by
      // (labels[0]) ticks. Convert lap → label index instead.
      const chartLabels = (chart.data && chart.data.labels) || [];
      const pixelForLap = (lapNum) => {
        const idx = chartLabels.findIndex((v) => Number(v) === Number(lapNum));
        return x.getPixelForValue(idx >= 0 ? idx : lapNum);
      };

      ctx.save();
      // 1. Background overlays for SC / VSC / Red Flag — grouped per period
      // with half-lap precision at the start/end boundaries.
      const COLORS = {
        1: "rgba(173, 216, 230, 0.22)", // SC – light blue
        2: "rgba(255, 215, 0, 0.18)",   // VSC – amber
        3: "rgba(255, 60, 60, 0.22)",   // Red Flag – red
      };
      const BORDERS = {
        1: "rgba(120, 180, 230, 0.55)",
        2: "rgba(255, 200, 0, 0.55)",
        3: "rgba(255, 80, 80, 0.7)",
      };
      const periods = computeSafetyCarPeriods(laps);
      periods.forEach((p) => {
        const xFirst = pixelForLap(p.firstLap);
        const xLast = pixelForLap(p.lastLap);
        const xLeft = xFirst + p.startOffset * barWidth;
        const xRight = xLast + p.endOffset * barWidth;
        const w = Math.max(2, xRight - xLeft);
        ctx.fillStyle = COLORS[p.status];
        ctx.fillRect(xLeft, chartArea.top, w, chartArea.bottom - chartArea.top);
        // soft borders so the boundary feels intentional, not noisy
        ctx.strokeStyle = BORDERS[p.status];
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(xLeft + 0.5, chartArea.top);
        ctx.lineTo(xLeft + 0.5, chartArea.bottom);
        ctx.moveTo(xLeft + w - 0.5, chartArea.top);
        ctx.lineTo(xLeft + w - 0.5, chartArea.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        // single centered label with lap range
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.font = `${isMobile ? 9 : 10}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const rangeTxt =
          p.firstLap === p.lastLap
            ? `${p.label} L${p.firstLap}`
            : `${p.label} L${p.firstLap}–${p.lastLap}`;
        ctx.fillText(rangeTxt, (xLeft + xRight) / 2, chartArea.top + 4);
      });

      // 2. Vertical lines for pit stops (kept per-lap)
      laps.forEach((lap) => {
        const xPos = pixelForLap(lap.lap);
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

      // 3. Fault overlays (ERS / DRS / engine / gearbox / aero)
      const FAULT_STYLES = {
        ers:     { color: "#ffb020", label: "ERS" },
        drs:     { color: "#5ad1ff", label: "DRS" },
        engine:  { color: "#ff5252", label: "ENG" },
        gearbox: { color: "#c084fc", label: "GBX" },
        aero:    { color: "#9aff9a", label: "AERO" },
      };
      let prevDmg = null;
      laps.forEach((lap) => {
        if (!lap || !lap.damage) return;
        const d = lap.damage;
        const faults = [];
        if (d.ers_fault) faults.push("ers");
        if (d.drs_fault) faults.push("drs");
        if (prevDmg) {
          if ((d.engine || 0) - (prevDmg.engine || 0) >= 5) faults.push("engine");
          if ((d.gearbox || 0) - (prevDmg.gearbox || 0) >= 5) faults.push("gearbox");
          const aeroNow  = (d.fl_wing||0)+(d.fr_wing||0)+(d.rear_wing||0)+(d.floor||0)+(d.diffuser||0)+(d.sidepod||0);
          const aeroPrev = (prevDmg.fl_wing||0)+(prevDmg.fr_wing||0)+(prevDmg.rear_wing||0)+(prevDmg.floor||0)+(prevDmg.diffuser||0)+(prevDmg.sidepod||0);
          if (aeroNow - aeroPrev >= 10) faults.push("aero");
        }
        prevDmg = d;
        if (!faults.length) return;
        const xPos = pixelForLap(lap.lap);
        faults.forEach((f, i) => {
          const style = FAULT_STYLES[f];
          ctx.strokeStyle = style.color;
          ctx.lineWidth = 2;
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.moveTo(xPos + i * 2, chartArea.top);
          ctx.lineTo(xPos + i * 2, chartArea.bottom);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = style.color;
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(style.label, xPos, chartArea.top + 14 + i * 11);
        });
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

                const chartLabels = (chart.data && chart.data.labels) || [];
                const flIdx = chartLabels.findIndex(
                  (v) => Number(v) === Number(fastestLapLap),
                );
                const xPos = x.getPixelForValue(flIdx >= 0 ? flIdx : fastestLapLap);
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

    const rtCompKey = String(lap.current_tyre_compound).toUpperCase();
    const rtDotColor = COMPOUND_COLORS[rtCompKey] || "#888";
    const rtRgba = (hex, a) => {
      const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${a})`;
    };
    const rtCompoundBadge = `<span class="compound-badge" style="background:${rtRgba(rtDotColor, 0.12)};border-color:${rtRgba(rtDotColor, 0.45)};color:${rtDotColor}"><span class="compound-dot" style="background-color:${rtDotColor}"></span>${lap.current_tyre_compound}</span>`;

    row.innerHTML = `
            <td class="text-center" style="padding: 8px 4px;">${lap.lap}</td>
            <td class="text-center" style="padding: 8px 4px;">${statusLabel}</td>
            <td class="text-center" style="padding: 8px 4px;">${lap.lap_time}</td>
            <td class="text-center group-start" style="padding: 8px 4px;">${lap.s1}</td>
            <td class="text-center" style="padding: 8px 4px;">${lap.s2}</td>
            <td class="text-center group-end" style="padding: 8px 4px;">${lap.s3}</td>
            <td class="text-center" style="padding: 8px 4px;">${rtCompoundBadge}</td>
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

  // Build per-session DNF sets from race_story.classification
  const sessionDnfSets = {};
  scoringSessions.forEach((s) => {
    const key = s.id || s.created_at;
    const set = new Set();
    (s.race_story?.classification || []).forEach((e) => {
      const isDNF = e.is_dnf || (e.status && !/FINISHED/i.test(e.status));
      if (isDNF && e.name) set.add(String(e.name).toUpperCase());
    });
    sessionDnfSets[key] = set;
  });

  scoringSessions.forEach((session) => {
    if (!session.results) return;
    const sKey = session.id || session.created_at;
    const dnfSet = sessionDnfSets[sKey] || new Set();
    session.results.forEach((res) => {
      const driverName = res.name;
      const isDNF = dnfSet.has(String(driverName || "").toUpperCase());
      driversMap[driverName].positions[sKey] = isDNF ? "DNF" : res.position;

      let pts = 0;
      const cat = (session.category || "").toLowerCase();
      const pos = parseInt(res.position);
      if (isDNF) pts = 0;
      else if (cat === "race")
        pts = [0, 25, 18, 15, 12, 10, 8, 6, 4, 2, 1][pos] || 0;
      else if (cat === "sprint") pts = [0, 8, 7, 6, 5, 4, 3, 2, 1][pos] || 0;
      driversMap[driverName].points += pts;
    });
  });

  const driverNames = Object.keys(driversMap).sort(
    (a, b) => driversMap[b].points - driversMap[a].points,
  );

  const teamsAssigned = getDriverTeams(); // This is used for constructor standings

  let html = `<div class="table-responsive standings-wrap"><table class="standings-table standings-v2"><thead><tr><th class="col-rank">#</th><th class="col-driver">Driver</th>`;

  scoringSessions.forEach((s, i) => {
    const flag = getFlagHtml(s, i + 1);
    const typeLabel = (s.category || "").toLowerCase() === "sprint" ? "S" : "R";
    const code = (s.track_code || s.track_name || "").toString().slice(0, 3).toUpperCase();
    html += `<th title="${s.track_name} - ${s.category}" class="col-race"><div class="race-head"><span class="race-flag">${flag}</span><span class="race-code">${code}</span><span class="race-type race-type-${typeLabel.toLowerCase()}">${typeLabel}</span></div></th>`;
  });

  html += `<th class="col-pts">Pts</th><th class="col-gap">Gap</th></tr></thead><tbody>`;

  driverNames.forEach((name, idx) => {
    const d = driversMap[name];
    const team = teamsAssigned[name] || "Unassigned";
    const teamColor = TEAM_COLORS[team] || "#444";
    const leaderClass = idx === 0 ? " is-leader" : "";
    html += `<tr class="standings-row${leaderClass}"><td class="col-rank rank-cell"><span class="rank-num">${idx + 1}</span></td><td class="col-driver driver-cell" style="--team-color:${teamColor};"><span class="driver-name">${name.toUpperCase()}</span><span class="driver-team">${team}</span></td>`;

    // Ensure the driver exists in the row even if they missed a race
    scoringSessions.forEach((s) => {
      const pos = d.positions[s.id || s.created_at];
      const posNum = parseInt(pos);
      let pillClass = "";
      let label = pos;
      if (pos === "DNF") {
        pillClass = " is-dnf";
        label = "DNF";
      } else if (posNum >= 1 && posNum <= 3) {
        pillClass = ` pos-${posNum}`;
      } else if (!pos) {
        pillClass = " is-dnf";
        label = "DNF";
      }
      html += `<td class="pos-cell"><span class="pos-pill${pillClass}" title="${label === "DNF" ? "Did Not Finish / no data" : ""}">${label}</span></td>`;
    });

    // Calculate gap to the driver ahead
    const gap =
      idx === 0
        ? "—"
        : `−${Math.abs(driversMap[driverNames[idx - 1]].points - d.points)}`;

    html += `<td class="col-pts pts-cell">${d.points}</td>`;
    html += `<td class="col-gap gap-cell">${gap}</td></tr>`;
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
  enableTableRowReorder("#standings-container .standings-table");
  // Render driver assignment UI below the standings
  try {
    renderDriverAssignments(driverNames);
  } catch (err) {
    console.error("Failed to render driver assignments", err);
  }
  try {
    renderRecordsTable();
  } catch (err) {
    console.error("Failed to render records", err);
  }
}

// ------- All-time Records / Stats -------
function getTeamsForSeason(season) {
  try {
    const raw = JSON.parse(localStorage.getItem("driverTeamsBySeason") || "{}");
    return raw[String(season)] || {};
  } catch (_) {
    return {};
  }
}

function computeSeasonStandings(season) {
  const drivers = {};
  const sessions = allSessions
    .filter(
      (s) =>
        s.season === season &&
        ((s.category || "").toLowerCase() === "race" ||
          (s.category || "").toLowerCase() === "sprint"),
    );
  sessions.forEach((session) => {
    const seen = new Set();
    const rsClass = session.race_story?.classification || [];
    const dnfNames = new Set(
      rsClass
        .filter((e) => e.is_dnf || (e.status && !/FINISHED/i.test(e.status)))
        .map((e) => (e.name || "").toUpperCase())
        .filter(Boolean),
    );
    (session.results || []).forEach((res) => {
      const name = res.name;
      if (!name) return;
      if (!drivers[name]) drivers[name] = { points: 0, wins: 0, podiums: 0, races: 0, fastest_laps: 0, dnfs: 0 };
      const pos = parseInt(res.position);
      const cat = (session.category || "").toLowerCase();
      let pts = 0;
      if (cat === "race") pts = [0, 25, 18, 15, 12, 10, 8, 6, 4, 2, 1][pos] || 0;
      else if (cat === "sprint") pts = [0, 8, 7, 6, 5, 4, 3, 2, 1][pos] || 0;
      drivers[name].points += pts;
      if (!seen.has(name)) {
        drivers[name].races += 1;
        seen.add(name);
        // Secondary DNF check: no valid finishing position OR classified as DNF in race_story
        if (cat === "race" && (dnfNames.has(name) || !pos || pos <= 0)) {
          drivers[name].dnfs += 1;
        }
      }
      if (cat === "race") {
        if (pos === 1) drivers[name].wins += 1;
        if (pos >= 1 && pos <= 3) drivers[name].podiums += 1;
      }
    });
    // Fallback: include drivers from race_story classification not already
    // counted from session.results — this makes DNFs (and any other missing
    // driver) count towards the GP (races) total.
    rsClass.forEach((e) => {
      const name = (e.name || "").toUpperCase();
      if (!name || seen.has(name)) return;
      const isDNF = e.is_dnf || (e.status && !/FINISHED/i.test(e.status));
      if (!drivers[name]) drivers[name] = { points: 0, wins: 0, podiums: 0, races: 0, fastest_laps: 0, dnfs: 0 };
      drivers[name].races += 1;
      if ((session.category || "").toLowerCase() === "race" && isDNF) drivers[name].dnfs += 1;
      seen.add(name);
    });
    // Fastest lap credit (race only)
    const flName = ((session.race_story?.fastest_lap?.name) || "").toUpperCase();
    if (flName && (session.category || "").toLowerCase() === "race") {
      if (!drivers[flName]) drivers[flName] = { points: 0, wins: 0, podiums: 0, races: 0, fastest_laps: 0, dnfs: 0 };
      drivers[flName].fastest_laps += 1;
    }
  });
  return drivers;
}


function renderRecordsTable() {
  const container = document.getElementById("records-container");
  if (!container) return;
  if (!allSessions || allSessions.length === 0) {
    container.innerHTML = `<div class="empty-hint" style="padding:18px;color:#888;">No saved sessions yet — upload some races to build all-time records.</div>`;
    return;
  }

  const seasons = Array.from(
    new Set(allSessions.map((s) => s.season).filter((x) => x != null)),
  ).sort((a, b) => a - b);

  // Driver aggregates across all seasons
  const driverAgg = {};
  const teamAgg = {};
  const driverChampions = {};
  const constructorChampions = {};

  seasons.forEach((season) => {
    const standings = computeSeasonStandings(season);
    const teams = getTeamsForSeason(season);

    Object.entries(standings).forEach(([name, s]) => {
      if (!driverAgg[name]) {
        driverAgg[name] = { points: 0, wins: 0, podiums: 0, races: 0, fastest_laps: 0, dnfs: 0, titles: 0, seasons: new Set(), lastTeam: null };
      }
      driverAgg[name].points += s.points;
      driverAgg[name].wins += s.wins;
      driverAgg[name].podiums += s.podiums;
      driverAgg[name].races += s.races;
      driverAgg[name].fastest_laps += s.fastest_laps || 0;
      driverAgg[name].dnfs += s.dnfs || 0;
      driverAgg[name].seasons.add(season);
      if (teams[name]) driverAgg[name].lastTeam = teams[name];
    });


    // Driver champion of season
    const driverRanked = Object.entries(standings).sort((a, b) => b[1].points - a[1].points);
    if (driverRanked.length && driverRanked[0][1].points > 0) {
      const champ = driverRanked[0][0];
      driverAgg[champ].titles += 1;
      driverChampions[season] = champ;
    }

    // Constructor aggregates for this season
    const teamSeason = {};
    Object.entries(standings).forEach(([name, s]) => {
      const team = teams[name] || "Unassigned";
      if (!teamSeason[team]) teamSeason[team] = { points: 0, wins: 0, podiums: 0 };
      teamSeason[team].points += s.points;
      teamSeason[team].wins += s.wins;
      teamSeason[team].podiums += s.podiums;
    });
    Object.entries(teamSeason).forEach(([team, s]) => {
      if (team === "Unassigned") return;
      if (!teamAgg[team]) {
        teamAgg[team] = { points: 0, wins: 0, podiums: 0, one_twos: 0, front_row_lockouts: 0, titles: 0, seasons: new Set() };
      }
      teamAgg[team].points += s.points;
      teamAgg[team].wins += s.wins;
      teamAgg[team].podiums += s.podiums;
      teamAgg[team].seasons.add(season);
    });

    // Front-row lockouts (Qualifying / Sprint Shootout) and 1-2 finishes (Race / Sprint)
    // Group sessions by track+category; for each, find P1 and P2 drivers and check same team.
    const seasonSessions = allSessions.filter((sn) => sn.season === season);
    const byEvent = {};
    seasonSessions.forEach((sn) => {
      const key = `${sn.track_name}||${sn.category}`;
      if (!byEvent[key]) byEvent[key] = [];
      byEvent[key].push(sn);
    });
    Object.entries(byEvent).forEach(([key, group]) => {
      const cat = (group[0].category || "").toLowerCase();
      const isQuali = cat === "qualifying" || cat === "sprint shootout";
      const isRace = cat === "race" || cat === "sprint";
      if (!isQuali && !isRace) return;
      // Prefer a session with a results array covering the full grid
      const src = group.find((g) => (g.results || []).length >= 2) || group[0];
      const results = src.results || [];
      const posFor = (p) => results.find((r) => parseInt(r.position) === p);
      const p1 = posFor(1);
      const p2 = posFor(2);
      if (!p1 || !p2) return;
      const t1 = teams[p1.name] || null;
      const t2 = teams[p2.name] || null;
      if (!t1 || !t2 || t1 !== t2 || t1 === "Unassigned") return;
      if (!teamAgg[t1]) {
        teamAgg[t1] = { points: 0, wins: 0, podiums: 0, one_twos: 0, front_row_lockouts: 0, titles: 0, seasons: new Set() };
      }
      if (isQuali) teamAgg[t1].front_row_lockouts = (teamAgg[t1].front_row_lockouts || 0) + 1;
      else teamAgg[t1].one_twos = (teamAgg[t1].one_twos || 0) + 1;
    });
    const teamRanked = Object.entries(teamSeason)
      .filter(([t]) => t !== "Unassigned")
      .sort((a, b) => b[1].points - a[1].points);
    if (teamRanked.length && teamRanked[0][1].points > 0) {
      const champTeam = teamRanked[0][0];
      teamAgg[champTeam].titles += 1;
      constructorChampions[season] = champTeam;
    }
  });

  const isSeasonComplete = (() => {
    // Heuristic: mark current/most-recent season as "in progress" if it equals max season
    // Champions list shows finalized seasons only — we'll show all with a "*" for current.
    return null;
  })();
  const currentMaxSeason = seasons[seasons.length - 1];

  const driverRows = Object.entries(driverAgg)
    .sort((a, b) => b[1].points - a[1].points)
    .map(([name, d], idx) => {
      const team = d.lastTeam || "Unassigned";
      const color = TEAM_COLORS[team] || "#444";
      const titleBadge = d.titles > 0
        ? `<span class="rec-title-badge" title="${d.titles} championship${d.titles > 1 ? "s" : ""}">★ ${d.titles}</span>`
        : "";
      return `<tr class="standings-row${idx === 0 ? " is-leader" : ""}">
        <td class="col-rank rank-cell"><span class="rank-num">${idx + 1}</span></td>
        <td class="col-driver driver-cell" style="--team-color:${color};">
          <span class="driver-name">${name.toUpperCase()} ${titleBadge}</span>
          <span class="driver-team">${team}</span>
        </td>
        <td class="pts-cell">${d.points}</td>
        <td class="rec-num">${d.wins}</td>
        <td class="rec-num">${d.podiums}</td>
        <td class="rec-num">${d.fastest_laps || 0}</td>
        <td class="rec-num">${d.races}</td>
        <td class="rec-num">${d.dnfs || 0}</td>
        <td class="rec-num">${d.seasons.size}</td>
      </tr>`;

    })
    .join("");

  const teamRows = Object.entries(teamAgg)
    .sort((a, b) => b[1].points - a[1].points)
    .map(([team, t], idx) => {
      const color = TEAM_COLORS[team] || "#444";
      const titleBadge = t.titles > 0
        ? `<span class="rec-title-badge" title="${t.titles} constructor title${t.titles > 1 ? "s" : ""}">★ ${t.titles}</span>`
        : "";
      return `<tr class="standings-row${idx === 0 ? " is-leader" : ""}">
        <td class="col-rank rank-cell"><span class="rank-num">${idx + 1}</span></td>
        <td class="driver-cell" style="--team-color:${color};">
          <span class="driver-name">${team.toUpperCase()} ${titleBadge}</span>
          <span class="driver-team">${t.seasons.size} season${t.seasons.size > 1 ? "s" : ""}</span>
        </td>
        <td class="pts-cell">${t.points}</td>
        <td class="rec-num">${t.wins}</td>
        <td class="rec-num">${t.podiums}</td>
        <td class="rec-num">${t.one_twos || 0}</td>
        <td class="rec-num">${t.front_row_lockouts || 0}</td>
      </tr>`;
    })
    .join("");

  const champRows = seasons
    .slice()
    .reverse()
    .map((season) => {
      const dChamp = driverChampions[season] || "—";
      const cChamp = constructorChampions[season] || "—";
      const isCurrent = season === currentMaxSeason;
      const dColor = TEAM_COLORS[(getTeamsForSeason(season)[dChamp]) || ""] || "#444";
      const cColor = TEAM_COLORS[cChamp] || "#444";
      return `<tr>
        <td class="rec-season">S${season}${isCurrent ? '<span class="rec-current">live</span>' : ""}</td>
        <td><span class="rec-champ-dot" style="background:${dColor};"></span>${dChamp.toUpperCase()}</td>
        <td><span class="rec-champ-dot" style="background:${cColor};"></span>${cChamp}</td>
      </tr>`;
    })
    .join("");

  container.innerHTML = `
    <div class="records-wrap">
      <div class="records-legend">
        <span><b>Pts</b> Total points</span>
        <span><b>Wins</b> Race wins (P1 in Race or Sprint)</span>
        <span><b>Pod</b> Podiums (P1–P3)</span>
        <span><b>FL</b> Fastest laps</span>
        <span><b>GP</b> Grands Prix entered (incl. DNFs)</span>
        <span><b>DNF</b> Did-not-finish count</span>
        <span><b>Sn</b> Seasons active</span>
        <span><b>1-2</b> Constructor 1-2 finishes</span>
        <span><b>FRL</b> Front-row lockouts (Qualifying)</span>
        <span><b>★</b> Championship titles</span>
      </div>
      <div class="records-block">
        <h3 class="records-title">Driver Records — All Seasons</h3>
        <div class="table-responsive standings-wrap">
          <table class="standings-table standings-v2 records-table">
            <thead>
              <tr>
                <th class="col-rank">#</th>
                <th class="col-driver">Driver</th>
                <th class="col-pts" title="Total points">Pts</th>
                <th class="rec-num" title="Race wins">Wins</th>
                <th class="rec-num" title="Podiums (P1–P3)">Pod</th>
                <th class="rec-num" title="Fastest Laps">FL</th>
                <th class="rec-num" title="Grands Prix entered (incl. DNFs)">GP</th>
                <th class="rec-num" title="Did not finish">DNF</th>
                <th class="rec-num" title="Seasons active">Sn</th>
              </tr>
            </thead>
            <tbody>${driverRows || `<tr><td colspan="9" class="rec-empty">No race results yet.</td></tr>`}</tbody>
          </table>

        </div>
      </div>

      <div class="records-block">
        <h3 class="records-title">Constructor Records — All Seasons</h3>
        <div class="table-responsive standings-wrap">
          <table class="standings-table standings-v2 records-table">
            <thead>
              <tr>
                <th class="col-rank">#</th>
                <th class="col-driver">Team</th>
                <th class="col-pts" title="Total points">Pts</th>
                <th class="rec-num" title="Race wins">Wins</th>
                <th class="rec-num" title="Podiums (P1–P3)">Pod</th>
                <th class="rec-num" title="1-2 finishes (both cars P1 &amp; P2 in the race)">1-2</th>
                <th class="rec-num" title="Front-row lockouts (both cars P1 &amp; P2 in qualifying)">FRL</th>
              </tr>
            </thead>
            <tbody>${teamRows || `<tr><td colspan="7" class="rec-empty">Assign drivers to teams to build constructor records.</td></tr>`}</tbody>
          </table>
        </div>
      </div>

      <div class="records-block">
        <h3 class="records-title">Champions by Season</h3>
        <div class="table-responsive standings-wrap">
          <table class="standings-table standings-v2 records-table records-champs">
            <thead>
              <tr>
                <th>Season</th>
                <th>Drivers' Champion</th>
                <th>Constructors' Champion</th>
              </tr>
            </thead>
            <tbody>${champRows || `<tr><td colspan="3" class="rec-empty">No completed seasons yet.</td></tr>`}</tbody>
          </table>
        </div>
        <div class="rec-footnote">The latest season is marked "live" — its champion may still change.</div>
      </div>
    </div>
  `;
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
  const db = getSupabaseClient();
  if (!db) {
    throw new Error("Database connection is still loading. Please try again in a moment.");
  }

  const { data: userData } = await db.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) throw new Error("You must be signed in to save.");
  const rows = Object.entries(obj).map(([driver, team]) => ({
    season: currentSeason,
    driver_name: driver,
    team: team,
    user_id: uid,
  }));

  // Upsert rows using season + driver_name as unique constraint
  const { error } = await db
    .from("driver_teams")
    .upsert(rows, { onConflict: "season,driver_name" });
  if (error) throw error;
}

async function loadDriverTeamsFromDB(season) {
  const db = getSupabaseClient({ silent: true });
  if (!db) return {};

  const { data, error } = await db
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
// ---------- Track Notes ----------
const trackNotesCache = {}; // key -> notes text
let trackNotesLoaded = false;
const notesSaveTimers = {};

async function loadTrackNotes() {
  const client = getSupabaseClient({ silent: true });
  if (!client) return;
  try {
    const { data, error } = await client.from("track_notes").select("track_key, notes");
    if (error) {
      console.warn("track_notes load failed", error);
      return;
    }
    (data || []).forEach((row) => {
      trackNotesCache[row.track_key] = row.notes || "";
    });
    trackNotesLoaded = true;
    // If notes section is already rendered, refresh values
    document.querySelectorAll("textarea.note-textarea[data-track]").forEach((ta) => {
      const k = ta.dataset.track;
      if (trackNotesCache[k] != null && !ta.dataset.dirty) {
        ta.value = trackNotesCache[k];
      }
    });
  } catch (err) {
    console.warn("track_notes load error", err);
  }
}

function setNotesStatus(msg, isError) {
  const el = document.getElementById("notesStatus");
  if (!el) return;
  el.textContent = msg || "";
  el.style.color = isError ? "#ff6666" : "";
}

async function saveTrackNote(trackKey, notes) {
  const client = getSupabaseClient();
  if (!client) {
    setNotesStatus("Notes need Supabase connection", true);
    return;
  }
  setNotesStatus("Saving…");
  try {
    const { data: userData } = await client.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) { setNotesStatus("Sign in to save notes", true); return; }
    const { error } = await client
      .from("track_notes")
      .upsert({ track_key: trackKey, notes, updated_at: new Date().toISOString(), user_id: uid }, { onConflict: "track_key" });
    if (error) {
      console.error("track_notes save failed", error);
      setNotesStatus("Save failed: " + (error.message || "unknown"), true);
      return;
    }
    trackNotesCache[trackKey] = notes;
    setNotesStatus("Saved ✓");
    setTimeout(() => setNotesStatus(""), 1500);
  } catch (err) {
    console.error(err);
    setNotesStatus("Save error", true);
  }
}

function renderNotesGrid() {
  const grid = document.getElementById("notesGrid");
  if (!grid) return;
  if (grid.dataset.rendered === "1") return;
  grid.dataset.rendered = "1";
  grid.innerHTML = NOTES_TRACKS.map((t, i) => `
    <div class="note-card">
      <div class="note-head">
        <span class="note-round">R${String(i + 1).padStart(2, "0")}</span>
        <span class="note-flag">${t.flag}</span>
        <span class="note-track">${t.label}</span>
      </div>
      <textarea
        class="note-textarea"
        data-track="${t.key}"
        placeholder="Setup notes, braking points, tyre strategy, reminders…"
      >${(trackNotesCache[t.key] || "").replace(/</g, "&lt;")}</textarea>
    </div>
  `).join("");

  grid.querySelectorAll("textarea.note-textarea").forEach((ta) => {
    ta.addEventListener("input", () => {
      ta.dataset.dirty = "1";
      const k = ta.dataset.track;
      clearTimeout(notesSaveTimers[k]);
      setNotesStatus("Editing…");
      notesSaveTimers[k] = setTimeout(() => {
        delete ta.dataset.dirty;
        saveTrackNote(k, ta.value);
      }, 700);
    });
    ta.addEventListener("blur", () => {
      const k = ta.dataset.track;
      if (ta.dataset.dirty) {
        clearTimeout(notesSaveTimers[k]);
        delete ta.dataset.dirty;
        saveTrackNote(k, ta.value);
      }
    });
  });

  if (!trackNotesLoaded) loadTrackNotes();
}

function initCollapsibleSections() {


  try {
    const tabContainer = document.querySelector(".collapsible-tabs");
    const tabs = Array.from(
      document.querySelectorAll(".section-tab[data-target]"),
    );
    const sections = Array.from(
      document.querySelectorAll(".collapsible-section"),
    );
    const activeKey = "active_collapsible_section";
    const orderKey = "collapsible_tab_order_v1";
    const storedActive = localStorage.getItem(activeKey);

    // Restore saved tab order
    try {
      const savedOrder = JSON.parse(localStorage.getItem(orderKey) || "null");
      if (Array.isArray(savedOrder) && tabContainer) {
        savedOrder.forEach((target) => {
          const tab = tabs.find((t) => t.dataset.target === target);
          if (tab) tabContainer.appendChild(tab);
        });
      }
    } catch (_) {}

    function activateSection(targetId) {
      sections.forEach((section) => {
        section.classList.toggle("active", section.id === targetId);
      });
      tabs.forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.target === targetId);
      });
      localStorage.setItem(activeKey, targetId);
      if (targetId === "section-notes") renderNotesGrid();
    }


    tabs.forEach((tab) => {
      const targetId = tab.dataset.target;
      tab.addEventListener("click", (e) => {
        // Ignore clicks that immediately follow a drag
        if (tab.dataset.justDragged === "1") {
          delete tab.dataset.justDragged;
          return;
        }
        activateSection(targetId);
      });
    });

    if (tabContainer) {
      enableDragReorder(tabContainer, ".section-tab[data-target]", {
        onReorder: () => {
          const order = Array.from(
            tabContainer.querySelectorAll(".section-tab[data-target]"),
          ).map((t) => t.dataset.target);
          localStorage.setItem(orderKey, JSON.stringify(order));
        },
      });
    }

    const defaultSection =
      storedActive && document.getElementById(storedActive)
        ? storedActive
        : "section-standings";
    activateSection(defaultSection);
  } catch (err) {
    console.warn("initCollapsibleSections failed", err);
  }
}

// Generic native HTML5 drag-and-drop reorder helper.
// Marks all matching children as draggable, swaps DOM order on drop,
// and calls opts.onReorder() afterwards. Safe to call repeatedly on the
// same container (re-binds listeners cleanly via dataset flag).
function enableDragReorder(container, itemSelector, opts = {}) {
  if (!container) return;
  const items = Array.from(container.querySelectorAll(itemSelector));
  let dragging = null;
  items.forEach((item) => {
    if (item.dataset.dragBound === "1") return;
    item.dataset.dragBound = "1";
    item.setAttribute("draggable", "true");
    item.addEventListener("dragstart", (e) => {
      dragging = item;
      item.classList.add("dragging");
      try {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", "");
      } catch (_) {}
    });
    item.addEventListener("dragend", () => {
      if (dragging) dragging.dataset.justDragged = "1";
      item.classList.remove("dragging");
      dragging = null;
      if (typeof opts.onReorder === "function") opts.onReorder();
    });
    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!dragging || dragging === item) return;
      const rect = item.getBoundingClientRect();
      // Decide horizontal vs vertical by the longer axis of the item
      const horizontal = rect.width >= rect.height;
      const before = horizontal
        ? e.clientX < rect.left + rect.width / 2
        : e.clientY < rect.top + rect.height / 2;
      if (before) item.parentNode.insertBefore(dragging, item);
      else item.parentNode.insertBefore(dragging, item.nextSibling);
    });
  });
}

// Drag-to-reorder for table rows is intentionally disabled — kept as a no-op
// so existing call sites don't need to change.
function enableTableRowReorder(_tableSelector) {
  /* no-op */
}



// ============================================================
//  Race Story (player-focused) — position, overtakes, stints, speed traps
// ============================================================

const COMPOUND_FILL = {
  Soft: "#ef3340",
  Medium: "#f4d03f",
  Hard: "#e8e8e8",
  Intermediate: "#27ae60",
  Wet: "#2e86de",
};

function normalizeTeamName(t) {
  if (!t) return "";
  let s = String(t).replace(/['’]?\d{2,4}$/, "").trim();
  s = s.replace(/_/g, " ").toLowerCase();
  if (s === "my team" || s === "myteam") return "My Team";
  // capitalize words
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function teamColorFor(team) {
  const norm = normalizeTeamName(team);
  return TEAM_COLORS[norm] || "#9aa0a6";
}

function renderRaceStory() {
  const empty = document.getElementById("raceStoryEmpty");
  const wrap = document.getElementById("raceStoryContent");
  if (!empty || !wrap) return;

  const rs = currentData && currentData.race_story;
  if (!rs || !rs.position_history || rs.position_history.length === 0) {
    empty.style.display = "block";
    wrap.style.display = "none";
    return;
  }

  empty.style.display = "none";
  wrap.style.display = "block";

  // Backfill lap 0 (grid position) for sessions saved before lap-0 support.
  const startPos =
    currentData.starting_position ?? currentData.starting_pos ?? null;
  if (
    startPos &&
    rs.position_history.length &&
    rs.position_history[0].lap !== 0
  ) {
    rs.position_history.unshift({ lap: 0, position: Number(startPos) });
  }
  (rs.podium || []).forEach((p) => {
    if (p.history?.length && p.history[0].lap !== 0 && p.history[0].lap === 1) {
      // Keep podium aligned visually; reuse lap-1 position as lap-0 fallback.
      p.history.unshift({ lap: 0, position: p.history[0].position });
    }
  });

  // Headline
  const start = rs.position_history[0]?.position;
  const end = rs.position_history[rs.position_history.length - 1]?.position;
  const gained = (start ?? 0) - (end ?? 0);
  const headline = document.getElementById("raceStoryHeadline");
  const badges = getSessionBadges(currentData);
  const fl = rs.fastest_lap;
  const fmtFl = (ms) => {
    if (!ms) return "";
    const m = Math.floor(ms / 60000);
    const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, "0");
    return `${m}:${s}`;
  };
  if (headline) {
    headline.innerHTML = `
      <span class="rs-pill"><b>${rs.player_name}</b></span>
      <span class="rs-pill">Start P${start ?? "?"}</span>
      <span class="rs-pill">Finish P${end ?? "?"}</span>
      <span class="rs-pill ${gained > 0 ? "rs-pos" : gained < 0 ? "rs-neg" : ""}">
        ${gained > 0 ? "▲ +" + gained : gained < 0 ? "▼ " + gained : "—"} positions
      </span>
      <span class="rs-pill">Overtakes made ${rs.overtakes_made.length}</span>
      <span class="rs-pill">Lost ${rs.overtakes_suffered.length}</span>
      ${badges.grandSlam ? `<span class="rs-pill rs-grand-slam">👑 GRAND SLAM</span>` : ""}
    `;
  }

  renderPositionChart(rs);
  renderOvertakesChart(rs);
  renderStintStrip();
  renderDamageSection();
  renderTopSpeedList(rs);
  renderFinalClassification(rs);
  renderCompareTab();
}


function renderFinalClassification(rs) {
  const el = document.getElementById("finalClassification");
  if (!el) return;
  const rawList = rs.classification || [];
  if (!rawList.length) {
    el.innerHTML = `<div class="race-story-empty">No classification data.</div>`;
    return;
  }
  // Sort: finishers first (by position asc), then DNFs at the bottom (by laps desc)
  const isDnfEntry = (e) => e.is_dnf || (e.status && !/FINISHED/i.test(e.status));
  const finishers = rawList
    .filter((e) => !isDnfEntry(e))
    .sort((a, b) => (parseInt(a.position) || 999) - (parseInt(b.position) || 999));
  const dnfs = rawList
    .filter(isDnfEntry)
    .sort((a, b) => (b.laps || 0) - (a.laps || 0));
  const list = [...finishers, ...dnfs];
  const fl = rs.fastest_lap;
  const flName = fl ? (fl.name || "").toUpperCase() : "";
  const leader = list[0];
  const fmtGap = (sec) => {
    if (!isFinite(sec) || sec <= 0) return "—";
    if (sec < 60) return `+${sec.toFixed(3)}`;
    const m = Math.floor(sec / 60);
    const s = (sec - m * 60).toFixed(3).padStart(6, "0");
    return `+${m}:${s}`;
  };

  const rows = list
    .map((e, i) => {
      const isLeader = i === 0;
      const isPlayer = e.name === (rs.player_name || "").toUpperCase();
      const isFL = flName && e.name === flName;
      const dnf = e.is_dnf || (e.status && !/FINISHED/i.test(e.status));
      let gapLeader = "—";
      let gapNext = "—";
      if (isLeader) {
        gapLeader = "LEADER";
        gapNext = "—";
      } else if (dnf) {
        gapLeader = e.status || "DNF";
        gapNext = "—";
      } else if (e.laps < leader.laps) {
        const lapDiff = leader.laps - e.laps;
        gapLeader = `+${lapDiff} lap${lapDiff > 1 ? "s" : ""}`;
        const prev = list[i - 1];
        if (prev && prev.laps > e.laps) {
          const d = prev.laps - e.laps;
          gapNext = `+${d} lap${d > 1 ? "s" : ""}`;
        } else if (prev) {
          gapNext = fmtGap(e.time_s - prev.time_s);
        }
      } else {
        gapLeader = fmtGap(e.time_s - leader.time_s);
        const prev = list[i - 1];
        gapNext = prev ? fmtGap(e.time_s - prev.time_s) : "—";
      }
      const color = teamColorFor(e.team) || "#444";
      const pos = e.position;
      const posClass =
        dnf ? "dnf" : pos === 1 ? "p1" : pos === 2 ? "p2" : pos === 3 ? "p3" : "";
      const posLabel = dnf ? "DNF" : pos;
      return `<tr class="fc-row${isPlayer ? " is-player" : ""}${isFL ? " is-fl" : ""}${dnf ? " is-dnf" : ""}" style="--team-color:${color};">
        <td class="fc-pos"><span class="fc-pos-pill ${posClass}">${posLabel}</span></td>
        <td class="fc-driver">
          <span class="fc-name">${e.name}${isFL ? ' <span class="fc-fl-badge" title="Fastest Lap">FL</span>' : ""}</span>
          <span class="fc-team">${e.team}</span>
        </td>
        <td class="fc-laps">${e.laps}</td>
        <td class="fc-time">${e.time_str || (dnf ? (e.status || "—") : "—")}</td>
        <td class="fc-gap">${gapLeader}</td>
        <td class="fc-gap">${gapNext}</td>
        <td class="fc-best">${e.best_lap_str || "—"}</td>
        <td class="fc-pits">${e.pits}</td>
        <td class="fc-pts">${e.points}</td>
      </tr>`;
    })
    .join("");

  const flBanner = fl
    ? `<div class="fc-fl-banner">
        <span class="fc-fl-chip">⚡ FASTEST LAP</span>
        <span class="fc-fl-driver">${(fl.name || "").toUpperCase()}</span>
        ${fl.lap_time_str ? `<span class="fc-fl-time">${fl.lap_time_str}</span>` : ""}
        ${fl.lap ? `<span class="fc-fl-meta">Lap ${fl.lap}</span>` : ""}
      </div>`

    : "";

  el.innerHTML = `
    ${flBanner}
    <table class="fc-table">
      <thead>
        <tr>
          <th>Pos</th>
          <th>Driver</th>
          <th>Laps</th>
          <th>Time</th>
          <th>Gap (Leader)</th>
          <th>Interval</th>
          <th>Best Lap</th>
          <th>Pits</th>
          <th>Pts</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderPositionChart(rs) {
  const ctx = document.getElementById("positionChart");
  if (!ctx) return;
  if (charts.positionChart) charts.positionChart.destroy();

  const labels = rs.position_history.map((p) => p.lap);
  const datasets = [
    {
      label: rs.player_name,
      data: rs.position_history.map((p) => p.position),
      borderColor: "#e10600",
      backgroundColor: "rgba(225, 6, 0, 0.12)",
      borderWidth: 3,
      tension: 0.25,
      pointRadius: 0,
      pointHoverRadius: 5,
      fill: false,
      order: 0,
    },
  ];

  rs.podium.forEach((p) => {
    const color = teamColorFor(p.team);
    datasets.push({
      label: `${p.name} (P${p.final})`,
      data: p.history.map((h) => h.position),
      borderColor: color,
      backgroundColor: color + "22",
      borderWidth: 1.5,
      borderDash: [4, 4],
      tension: 0.2,
      pointRadius: 0,
      pointHoverRadius: 4,
      fill: false,
      order: 1,
    });
  });

  const maxPos = Math.max(
    ...rs.position_history.map((p) => p.position),
    ...rs.podium.flatMap((p) => p.history.map((h) => h.position)),
    5,
  );

  charts.positionChart = new Chart(ctx.getContext("2d"), {
    type: "line",
    data: { labels, datasets },
    plugins: [pitLinesPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
        pitLines: { laps: getPlayerPitLaps() },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: P${ctx.parsed.y}`,
          },
        },
      },
      scales: {
        x: { title: { display: true, text: "Lap" }, min: 0, ticks: { stepSize: 1, precision: 0 } },
        y: {
          reverse: true,
          min: 1,
          max: maxPos,
          ticks: { stepSize: 1, precision: 0 },
          title: { display: true, text: "Position" },
        },
      },
    },
  });
}

function renderOvertakesChart(rs) {
  const ctx = document.getElementById("overtakesChart");
  if (!ctx) return;
  if (charts.overtakesChart) charts.overtakesChart.destroy();

  const lapMax = Math.max(
    ...rs.position_history.map((p) => p.lap),
    ...rs.overtakes_made.map((o) => o.lap),
    ...rs.overtakes_suffered.map((o) => o.lap),
    1,
  );
  const labels = Array.from({ length: lapMax }, (_, i) => i + 1);
  const made = labels.map(
    (l) => rs.overtakes_made.filter((o) => o.lap === l).length,
  );
  const suffered = labels.map(
    (l) => -rs.overtakes_suffered.filter((o) => o.lap === l).length,
  );

  charts.overtakesChart = new Chart(ctx.getContext("2d"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Overtakes Made",
          data: made,
          backgroundColor: "rgba(46, 204, 113, 0.85)",
          borderColor: "rgba(46, 204, 113, 1)",
          borderWidth: 1,
        },
        {
          label: "Positions Lost",
          data: suffered,
          backgroundColor: "rgba(225, 6, 0, 0.85)",
          borderColor: "rgba(225, 6, 0, 1)",
          borderWidth: 1,
        },
      ],
    },
    plugins: [pitLinesPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        pitLines: { laps: getPlayerPitLaps() },
        tooltip: {
          callbacks: {
            label: (c) => {
              const lap = c.label;
              const list =
                c.datasetIndex === 0
                  ? rs.overtakes_made.filter((o) => String(o.lap) === String(lap))
                  : rs.overtakes_suffered.filter((o) => String(o.lap) === String(lap));
              const verb = c.datasetIndex === 0 ? "Passed" : "Lost to";
              return [
                `${c.dataset.label}: ${Math.abs(c.parsed.y)}`,
                ...list.map((o) => `  ${verb} ${o.opponent}`),
              ];
            },
          },
        },
      },
      scales: {
        x: { stacked: true, title: { display: true, text: "Lap" } },
        y: {
          stacked: true,
          ticks: {
            stepSize: 1,
            precision: 0,
            callback: (v) => Math.abs(v),
          },
          title: { display: true, text: "Count" },
        },
      },
    },
  });

  // Notable battles list
  const summaryEl = document.getElementById("overtakesSummary");
  if (summaryEl) {
    const counts = {};
    [...rs.overtakes_made, ...rs.overtakes_suffered].forEach((o) => {
      counts[o.opponent] = (counts[o.opponent] || 0) + 1;
    });
    const top = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    summaryEl.innerHTML =
      `<div class="rs-list-title">Most battled drivers</div>` +
      top
        .map(
          ([name, n]) =>
            `<div class="rs-list-row"><span>${name}</span><span class="rs-mono">${n}× exchange${n > 1 ? "s" : ""}</span></div>`,
        )
        .join("");
  }
}

function renderStintStrip() {
  const el = document.getElementById("stintStrip");
  if (!el) return;
  const stints = currentData?.stints || [];
  if (!stints.length) {
    el.innerHTML = `<div class="race-story-empty">No stint data available.</div>`;
    return;
  }
  const totalLaps = stints[stints.length - 1]["end-lap"] || 1;
  el.innerHTML = stints
    .map((s, i) => {
      const compound =
        s["tyre-set-data"]?.["visual-tyre-compound"] || "Medium";
      const len = (s["end-lap"] - s["start-lap"] + 1) / totalLaps * 100;
      const color = COMPOUND_FILL[compound] || "#888";
      return `<div class="stint-block" style="flex-basis:${len}%;background:${color};color:${compound === "Hard" || compound === "Medium" ? "#111" : "#fff"}" title="Stint ${i + 1}: ${compound} (L${s["start-lap"]}–L${s["end-lap"]})">
        <span class="stint-compound">${compound}</span>
        <span class="stint-laps">L${s["start-lap"]}–L${s["end-lap"]}</span>
      </div>`;
    })
    .join("");
}

function renderTopSpeedList(rs) {
  const el = document.getElementById("topSpeedList");
  if (!el) return;
  const top = rs.speed_traps || [];
  if (!top.length) {
    el.innerHTML = `<div class="race-story-empty">No speed-trap data.</div>`;
    return;
  }
  const leader = top[0].kmph;
  const header = `<div class="speed-row speed-row-head">
      <span class="speed-rank">#</span>
      <span class="speed-name">Driver</span>
      <span class="speed-team">Team</span>
      <span class="speed-val">Top Speed</span>
      <span class="speed-bar-cell">Relative</span>
      <span class="speed-delta">Δ Leader</span>
    </div>`;
  const rows = top
    .map((s, i) => {
      const isPlayer = s.name === rs.player_name;
      const delta = s.kmph - leader;
      const pct = Math.max(20, Math.round((s.kmph / leader) * 100));
      const barColor = isPlayer ? "#e10600" : teamColorFor(s.team);
      return `<div class="speed-row${isPlayer ? " is-player" : ""}">
        <span class="speed-rank">${i + 1}</span>
        <span class="speed-name">${s.name}</span>
        <span class="speed-team" style="color:${teamColorFor(s.team)}">${normalizeTeamName(s.team)}</span>
        <span class="speed-val">${s.kmph} km/h</span>
        <span class="speed-bar-cell"><span class="speed-bar" style="width:${pct}%;background:${barColor}"></span></span>
        <span class="speed-delta">${delta === 0 ? "—" : delta + " km/h"}</span>
      </div>`;
    })
    .join("");
  el.innerHTML = header + rows;
}

function renderDamageSection() {
  const el = document.getElementById("damageSection");
  if (!el) return;
  const laps = (currentData?.lap_history || []).filter((l) => l && l.damage);
  if (!laps.length) {
    el.innerHTML = `<div class="race-story-empty">No per-lap damage data available. Re-upload the race JSON to view damage progression.</div>`;
    return;
  }
  const components = [
    ["fl_wing", "FL Wing", "#e10600"],
    ["fr_wing", "FR Wing", "#ff6b35"],
    ["rear_wing", "Rear Wing", "#f4d03f"],
    ["floor", "Floor", "#9b59b6"],
    ["diffuser", "Diffuser", "#3498db"],
    ["sidepod", "Sidepod", "#2ecc71"],
    ["gearbox", "Gearbox", "#e67e22"],
    ["engine", "Engine", "#c0392b"],
  ];
  // Only show components that had non-zero damage at some point
  const active = components.filter(([k]) => laps.some((l) => (l.damage[k] || 0) > 0));
  const finalLap = laps[laps.length - 1];
  const finals = components.map(([k, label, c]) => ({
    key: k, label, color: c, value: finalLap.damage[k] || 0,
  }));
  const pills = finals
    .map((f) => `<span class="damage-pill" style="border-color:${f.color};color:${f.value > 0 ? f.color : "var(--secondary-text)"}">
      <b>${f.label}</b> ${f.value}%
    </span>`)
    .join("");
  let chartWrap = "";
  if (active.length) {
    chartWrap = `<div class="rs-canvas-wrap" style="margin-top:12px"><canvas id="damageChart"></canvas></div>`;
  } else {
    chartWrap = `<div class="race-story-empty" style="margin-top:12px">No damage taken this race — clean drive!</div>`;
  }
  // System faults (DRS stuck closed, ERS fault) — telemetry only records these
  // when the game actually flags a fault; older uploads will simply show none.
  const drsLaps = laps.filter((l) => l.damage.drs_fault).map((l) => l.lap);
  const ersLaps = laps.filter((l) => l.damage.ers_fault).map((l) => l.lap);
  const faultPills = [];
  if (drsLaps.length) {
    faultPills.push(`<span class="damage-pill" style="border-color:#e10600;color:#e10600" title="Active Aero fault (wing did not open/close) on laps: ${drsLaps.join(", ")}"><b>⚠ Active Aero Fault</b> laps ${drsLaps[0]}${drsLaps.length > 1 ? "–" + drsLaps[drsLaps.length - 1] : ""}</span>`);
  }
  if (ersLaps.length) {
    faultPills.push(`<span class="damage-pill" style="border-color:#f4d03f;color:#f4d03f" title="ERS fault on laps: ${ersLaps.join(", ")}"><b>⚠ ERS Fault</b> laps ${ersLaps[0]}${ersLaps.length > 1 ? "–" + ersLaps[ersLaps.length - 1] : ""}</span>`);
  }
  const faultsHtml = faultPills.length ? `<div class="damage-pills" style="margin-bottom:8px">${faultPills.join("")}</div>` : "";
  el.innerHTML = `${faultsHtml}<div class="damage-pills">${pills}</div>${chartWrap}`;
  if (active.length) {
    const ctx = document.getElementById("damageChart");
    if (ctx) {
      if (charts.damageChart) charts.damageChart.destroy();
      charts.damageChart = new Chart(ctx.getContext("2d"), {
        type: "line",
        data: {
          labels: laps.map((l) => l.lap),
          datasets: active.map(([k, label, color]) => ({
            label,
            data: laps.map((l) => l.damage[k] || 0),
            borderColor: color,
            backgroundColor: color + "33",
            tension: 0.25,
            pointRadius: 0,
            borderWidth: 2,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          scales: {
            y: { beginAtZero: true, max: 100, title: { display: true, text: "Damage %" } },
            x: { title: { display: true, text: "Lap" } },
          },
          plugins: { legend: { position: "bottom" } },
        },
      });
    }
  }
}

// ==================== COMPARE TAB ====================

function fmtLapMs(ms) {
  if (!ms || ms <= 0) return "—";
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, "0");
  return `${m}:${s}`;
}

function renderCompareTab() {
  const empty = document.getElementById("compareEmpty");
  const wrap = document.getElementById("compareContent");
  if (!empty || !wrap) return;
  const rs = currentData?.race_story;
  const dlt = rs?.driver_lap_times || [];
  const playerName = (rs?.player_name || currentData?.driver_name || "").toUpperCase();
  const playerEntry = dlt.find((d) => d.name === playerName);
  const others = dlt.filter((d) => d.name !== playerName && d.laps.some((l) => l.ms > 0));
  if (!playerEntry || !others.length) {
    empty.style.display = "block";
    wrap.style.display = "none";
    return;
  }
  empty.style.display = "none";
  wrap.style.display = "block";

  const select = document.getElementById("compareDriverSelect");
  if (!select) return;
  // Save previous selection
  const prev = select.value;
  select.innerHTML = others
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => `<option value="${d.name}">${d.name} — ${normalizeTeamName(d.team)}</option>`)
    .join("");
  if (prev && others.some((d) => d.name === prev)) select.value = prev;
  if (!select.dataset.bound) {
    select.dataset.bound = "1";
    select.addEventListener("change", () => renderCompareCharts(playerEntry, select.value));
  }
  renderCompareCharts(playerEntry, select.value);
}

function renderCompareCharts(playerEntry, opponentName) {
  const rs = currentData?.race_story;
  const dlt = rs?.driver_lap_times || [];
  const opp = dlt.find((d) => d.name === opponentName);
  if (!opp) return;

  const maxLaps = Math.max(playerEntry.laps.length, opp.laps.length);
  const labels = [];
  const youMs = [];
  const oppMs = [];
  const deltas = [];
  for (let i = 0; i < maxLaps; i++) {
    labels.push(i + 1);
    const yl = playerEntry.laps[i];
    const ol = opp.laps[i];
    const y = yl && yl.ms > 0 ? yl.ms : null;
    const o = ol && ol.ms > 0 ? ol.ms : null;
    youMs.push(y);
    oppMs.push(o);
    deltas.push(y !== null && o !== null ? +((y - o) / 1000).toFixed(3) : null);
  }

  const validDeltas = deltas.filter((d) => d !== null);
  const avgDelta = validDeltas.length
    ? validDeltas.reduce((a, b) => a + b, 0) / validDeltas.length
    : 0;
  const totalYou = youMs.filter((v) => v).reduce((a, b) => a + b, 0);
  const totalOpp = oppMs.filter((v) => v).reduce((a, b) => a + b, 0);
  const summary = document.getElementById("compareSummary");
  if (summary) {
    summary.innerHTML = `Avg delta: <b style="color:${avgDelta < 0 ? "#2ecc71" : "#e10600"}">${avgDelta > 0 ? "+" : ""}${avgDelta.toFixed(3)}s</b> · Total: <b>${fmtLapMs(totalYou)}</b> vs <b>${fmtLapMs(totalOpp)}</b>`;
  }
  const thYou = document.getElementById("compareThYou");
  const thOpp = document.getElementById("compareThOpp");
  if (thYou) thYou.textContent = `You (${playerEntry.name})`;
  if (thOpp) thOpp.textContent = opp.name;

  // Delta bar chart
  const deltaCtx = document.getElementById("compareDeltaChart");
  if (deltaCtx) {
    if (charts.compareDeltaChart) charts.compareDeltaChart.destroy();
    charts.compareDeltaChart = new Chart(deltaCtx.getContext("2d"), {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Delta (s) — negative = you were faster",
          data: deltas,
          backgroundColor: deltas.map((d) =>
            d === null ? "rgba(120,120,120,0.3)" : d < 0 ? "rgba(46,204,113,0.85)" : "rgba(225,6,0,0.85)"
          ),
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { title: { display: true, text: "Δ seconds" } },
          x: { title: { display: true, text: "Lap" } },
        },
        plugins: { legend: { display: false } },
      },
    });
  }

  // Overlay line chart
  const overlayCtx = document.getElementById("compareOverlayChart");
  if (overlayCtx) {
    if (charts.compareOverlayChart) charts.compareOverlayChart.destroy();
    // Player is always red so it stays consistent across comparisons;
    // opponent uses their team color, falling back to a distinct cyan
    // and to another distinct hue if the opponent team also maps to red.
    const playerColor = "#e10600";
    let oppColor = teamColorFor(opp.team) || "#00b8d4";
    if (oppColor.toLowerCase() === playerColor.toLowerCase()) oppColor = "#00b8d4";
    charts.compareOverlayChart = new Chart(overlayCtx.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: `You (${playerEntry.name})`,
            data: youMs.map((v) => (v ? +(v / 1000).toFixed(3) : null)),
            borderColor: playerColor,
            backgroundColor: playerColor + "33",
            tension: 0.2,
            spanGaps: true,
          },
          {
            label: opp.name,
            data: oppMs.map((v) => (v ? +(v / 1000).toFixed(3) : null)),
            borderColor: oppColor,
            backgroundColor: oppColor + "33",
            tension: 0.2,
            spanGaps: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          y: { title: { display: true, text: "Lap time (s)" } },
          x: { title: { display: true, text: "Lap" } },
        },
        plugins: { legend: { position: "bottom" } },
      },
    });
  }

  // Table
  const tbody = document.getElementById("compareTableBody");
  if (tbody) {
    tbody.innerHTML = labels
      .map((lap, i) => {
        const d = deltas[i];
        const cls = d === null ? "" : d < 0 ? "delta-pos" : "delta-neg";
        return `<tr>
          <td class="text-center">${lap}</td>
          <td class="text-center">${fmtLapMs(youMs[i])}</td>
          <td class="text-center">${fmtLapMs(oppMs[i])}</td>
          <td class="text-center ${cls}">${d === null ? "—" : (d > 0 ? "+" : "") + d.toFixed(3)}</td>
        </tr>`;
      })
      .join("");
  }
}

function renderPaceDeltaChart() {
  const ctx = document.getElementById("paceDeltaChart");
  if (!ctx) return;
  if (charts.paceDeltaChart) charts.paceDeltaChart.destroy();

  const rs = currentData?.race_story;
  if (!rs || !rs.pace_delta || rs.pace_delta.length === 0) {
    const c = ctx.getContext("2d");
    c.clearRect(0, 0, ctx.width, ctx.height);
    c.fillStyle = "#888";
    c.font = "13px sans-serif";
    c.textAlign = "center";
    c.fillText(
      "Pace-vs-field requires a freshly uploaded race JSON.",
      ctx.width / 2,
      ctx.height / 2,
    );
    return;
  }

  const labels = rs.pace_delta.map((p) => p.lap);
  const data = rs.pace_delta.map((p) => +(p.delta_ms / 1000).toFixed(3));
  const colors = data.map((v) =>
    v < 0 ? "rgba(46, 204, 113, 0.85)" : "rgba(225, 6, 0, 0.85)",
  );

  charts.paceDeltaChart = new Chart(ctx.getContext("2d"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Δ vs field median (s)",
          data,
          backgroundColor: colors,
          borderWidth: 0,
        },
      ],
    },
    plugins: [pitLinesPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        pitLines: { laps: getPlayerPitLaps() },
        tooltip: {
          callbacks: {
            label: (c) =>
              `${c.parsed.y > 0 ? "+" : ""}${c.parsed.y.toFixed(3)} s vs median`,
          },
        },
      },
      scales: {
        x: { title: { display: true, text: "Lap" } },
        y: {
          title: { display: true, text: "Δ seconds (− = faster)" },
          grid: {
            color: (ctx) =>
              ctx.tick.value === 0
                ? "rgba(255,255,255,0.5)"
                : "rgba(255,255,255,0.08)",
          },
        },
      },
    },
  });
}

// Global floating tooltip for .hint-icon elements (escapes overflow:hidden parents)
(function initHintTooltip() {
  let tipEl = null;
  function ensureEl() {
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.id = "global-hint-tooltip";
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }
  function position(target) {
    const el = ensureEl();
    const r = target.getBoundingClientRect();
    el.style.left = "0px";
    el.style.top = "0px";
    const tw = el.offsetWidth;
    const th = el.offsetHeight;
    let left = r.left + r.width / 2 - tw / 2;
    let top = r.top - th - 8;
    if (top < 8) top = r.bottom + 8;
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    el.style.left = left + "px";
    el.style.top = top + "px";
  }
  document.addEventListener("mouseover", (e) => {
    const t = e.target.closest(".hint-icon");
    if (!t) return;
    const el = ensureEl();
    el.textContent = t.getAttribute("data-tooltip") || "";
    el.classList.add("show");
    position(t);
  });
  document.addEventListener("mouseout", (e) => {
    const t = e.target.closest(".hint-icon");
    if (!t) return;
    if (tipEl) tipEl.classList.remove("show");
  });
  window.addEventListener("scroll", () => { if (tipEl) tipEl.classList.remove("show"); }, true);
})();

// Sidebar collapse toggle + mobile drawer behavior
(function () {
  const MOBILE_BP = 880;
  const isMobile = () => window.matchMedia(`(max-width: ${MOBILE_BP}px)`).matches;

  const apply = (collapsed) => {
    document.getElementById("appShell")?.classList.toggle("sidebar-collapsed", collapsed);
    // On mobile, "collapsed" also means the drawer is closed
    if (isMobile()) {
      document.body.classList.toggle("sidebar-drawer-open", !collapsed);
    } else {
      document.body.classList.remove("sidebar-drawer-open");
    }
    try { localStorage.setItem("sidebarCollapsed", collapsed ? "1" : "0"); } catch (e) {}
  };

  const closeDrawer = () => apply(true);

  document.addEventListener("DOMContentLoaded", () => {
    // On mobile, always start with the drawer closed regardless of prior state
    const stored = (() => { try { return localStorage.getItem("sidebarCollapsed") === "1"; } catch (e) { return false; }})();
    const initial = isMobile() ? true : stored;
    apply(initial);

    document.getElementById("sidebarToggle")?.addEventListener("click", () => {
      const collapsed = !document.getElementById("appShell")?.classList.contains("sidebar-collapsed");
      apply(collapsed);
    });
    document.getElementById("sidebarExpand")?.addEventListener("click", () => apply(false));
    document.getElementById("sidebarBackdrop")?.addEventListener("click", closeDrawer);

    // Close drawer on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.body.classList.contains("sidebar-drawer-open")) closeDrawer();
    });

    // On mobile: tapping a session row or season box should close the drawer
    document.addEventListener("click", (e) => {
      if (!isMobile()) return;
      if (!document.body.classList.contains("sidebar-drawer-open")) return;
      const t = e.target.closest(".session-row, .season-box, .session-card");
      if (t && !e.target.closest(".delete-btn")) {
        // small delay so the click handler runs first
        setTimeout(closeDrawer, 60);
      }
    });

    // Auto-scroll the active section tab into view on mobile
    const scrollActiveTab = () => {
      const bar = document.querySelector(".collapsible-tabs.sticky-tabs");
      const active = bar?.querySelector(".section-tab.active");
      if (!bar || !active) return;
      const offset = active.offsetLeft - bar.clientWidth / 2 + active.clientWidth / 2;
      bar.scrollTo({ left: Math.max(0, offset), behavior: "smooth" });
    };
    document.querySelectorAll(".section-tab").forEach((t) => {
      t.addEventListener("click", () => setTimeout(scrollActiveTab, 30));
    });
    setTimeout(scrollActiveTab, 300);

    // React to viewport changes (rotation, resize)
    let wasMobile = isMobile();
    window.addEventListener("resize", () => {
      const nowMobile = isMobile();
      if (nowMobile !== wasMobile) {
        wasMobile = nowMobile;
        // Reset drawer state on breakpoint crossing
        if (nowMobile) apply(true);
        else {
          document.body.classList.remove("sidebar-drawer-open");
          apply(stored);
        }
      }
    });
  });
})();

