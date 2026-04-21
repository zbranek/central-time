
function saveRaceId() {
    const input = document.getElementById('race-id-input').value.trim();

    if (input.length !== 5 || isNaN(input)) {
        alert("ID musí být 5 číslic");
        return;
    }

    localStorage.setItem("rally_race_id", input);
    window.APP.raceId = input;

    document.getElementById('race-id-status').textContent = "✅ " + input;
}


async function loadResults() {
  const btn = document.querySelector("#view-results button");

  btn.textContent = "Načítám...";
  btn.disabled = true;

  try {
    // 1️⃣ načtení logů ze Supabase
    const { data: logs, error } = await supabaseClient
      .from("rally_logs")
      .select("*")
      .eq("race_id", currentRaceId);

    if (error) throw error;

    if (!logs || logs.length === 0) {
      alert("Žádná data pro tento závod.");
      return;
    }

    // 2️⃣ výpočet výsledků
    const results = computeResults(logs);

    console.log("RESULTS:", results);

    // 3️⃣ vykreslení
    renderResults(results);

    btn.textContent = "✅ Hotovo";
  } catch (err) {
    console.error("Chyba:", err);
    alert("Chyba při načítání výsledků: " + err.message);
    btn.textContent = "❌ Chyba";
  }

  setTimeout(() => {
    btn.textContent = "🔄 Načíst výsledky";
    btn.disabled = false;
  }, 2000);
}

function renderResults(results) {
  const table = document.getElementById("results-table");
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  // 🧠 zjisti všechny RZ
  const stagesSet = new Set();

  results.forEach(r => {
    Object.keys(r.stages).forEach(s => stagesSet.add(s));
  });

  const stages = Array.from(stagesSet).sort((a, b) => a - b);

  // ===== HEADER =====
  thead.innerHTML = `
    <tr>
      <th>#</th>
      <th>Jezdec</th>
      ${stages.map(s => `<th>RZ${s}</th>`).join("")}
      <th>Celkem</th>
    </tr>
  `;

  // ===== BODY =====
  tbody.innerHTML = "";

  results.forEach((r, index) => {
    const tr = document.createElement("tr");

    const stageCells = stages.map(s => {
      const stage = r.stages[s];
      if (!stage || !stage.time) return "<td>-</td>";
      return `<td>${formatStageTime(stage.time)}</td>`;
    }).join("");

    tr.innerHTML = `
      <td>${r.dnf ? "DNF" : index + 1}</td>
      <td>#${r.rider}</td>
      ${stageCells}
      <td>${r.dnf ? "DNF" : formatStageTime(r.totalTime)}</td>
    `;

    tbody.appendChild(tr);
  });
}

function formatStageTime(ms) {
  if (!ms) return "-";
  const s = Math.floor(ms / 1000);
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

/*********************************
 * NAVIGACE
 *********************************/
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + id).classList.add('active');

  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
}

function saveRaceId() {
  const val = document.getElementById('race-id-input').value;
  localStorage.setItem('rally_race_id', val);
  currentRaceId = val;
}

/*********************************
 * ADMIN - RIDERS
 *********************************/
let riders = [];

async function addRider() {
  if (!window.APP.raceId) {
    alert("Nejprve nastav ID závodu!");
    return;
  }

  const rider = {
    race_id: window.APP.raceId,
    rider_number: document.getElementById('rider-number').value,
    name: document.getElementById('rider-name').value,
    co_driver: document.getElementById('co-driver').value,
    nationality: document.getElementById('nationality').value,
    car_brand: document.getElementById('car-brand').value,
    car_model: document.getElementById('car-model').value,
    category: document.getElementById('category').value
  };

  const { error } = await window.supabaseClient
  .from("riders")
  .upsert([rider], { onConflict: ['race_id', 'rider_number'] });

  if (error) {
    console.error(error);
    alert("Chyba při ukládání");
    return;
  }

  clearRiderForm();
  loadRiders();
}

function clearRiderForm() {
  document.getElementById('rider-number').value = "";
  document.getElementById('rider-name').value = "";
  document.getElementById('co-driver').value = "";
  document.getElementById('nationality').value = "";
  document.getElementById('car-brand').value = "";
  document.getElementById('car-model').value = "";
  document.getElementById('category').value = "";
}

async function loadRiders() {
  if (!window.APP.raceId) return;

  const { data, error } = await window.supabaseClient
    .from("riders")
    .select("*")
    .eq("race_id", window.APP.raceId)
    .order("rider_number", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  renderRiders(data);
}

function renderRiders(riders) {
  const tbody = document.querySelector("#riders-table tbody");
  tbody.innerHTML = "";

  riders.forEach(r => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${r.rider_number}</td>
      <td>${r.name}</td>
      <td>${r.co_driver || ""}</td>
      <td>${r.car_brand || ""} ${r.car_model || ""}</td>
      <td>${r.category || ""}</td>
      <td>
        <button onclick="deleteRider(${r.id})">❌</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

async function deleteRider(id) {
  if (!confirm("Smazat jezdce?")) return;

  const { error } = await window.supabaseClient
    .from("riders")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    alert("Chyba při mazání");
    return;
  }

  loadRiders();
}


/*********************************
 * ITINERÁŘ
 *********************************/
let itinerary = [];

function addItinerary() {
  const item = {
    type: document.getElementById('it-type').value,
    label: document.getElementById('it-label').value,
    time: document.getElementById('it-time').value
  };

  itinerary.push(item);
  renderItinerary();
}

function renderItinerary() {
  const tbody = document.querySelector('#itinerary-table tbody');
  tbody.innerHTML = "";

  itinerary.forEach((it, i) => {
    const row = `
      <tr>
        <td>${it.type}</td>
        <td>${it.label}</td>
        <td>${it.time}</td>
        <td><button onclick="deleteIt(${i})">X</button></td>
      </tr>
    `;
    tbody.innerHTML += row;
  });
}

function deleteIt(i) {
  itinerary.splice(i, 1);
  renderItinerary();
}

/*********************************
 * VÝSLEDKY (placeholder)
 *********************************/



//výpočet výsledů
function computeResults(logs) {
  const ridersMap = {};

  // 1️⃣ seskupení podle jezdec + RZ
  logs.forEach(log => {
    if (!log.rider) return;

    const rider = log.rider;
    const stage = log.stage;

    if (!ridersMap[rider]) {
      ridersMap[rider] = {
        rider: rider,
        stages: {},
        totalTime: 0,
        totalPenalty: 0,
        dnf: false
      };
    }

    if (!ridersMap[rider].stages[stage]) {
      ridersMap[rider].stages[stage] = {
        starts: [],
        finishes: [],
        penalty: 0,
        rawPenalty: ""
      };
    }

    const stageObj = ridersMap[rider].stages[stage];

    if (log.type === "START") {
      stageObj.starts.push(log.time_ms);
    }

    if (log.type === "FINISH") {
      stageObj.finishes.push(log.time_ms);

      // penalizace bereme z FINISH logu
      if (log.penalty) {
        stageObj.rawPenalty = log.penalty;

        if (log.penalty.toUpperCase() === "DNF") {
          ridersMap[rider].dnf = true;
        }

        // časová penalizace např. "+10"
        if (log.penalty.startsWith("+")) {
          const val = parseInt(log.penalty.replace("+", ""));
          if (!isNaN(val)) {
            stageObj.penalty = val * 1000; // převod na ms
          }
        }
      }
    }
  });

  // 2️⃣ výpočet časů
  const results = [];

  Object.values(ridersMap).forEach(r => {
    let total = 0;
    let totalPenalty = 0;

    Object.entries(r.stages).forEach(([stage, s]) => {
      if (s.starts.length === 0 || s.finishes.length === 0) {
        r.dnf = true;
        return;
      }

      // první START, poslední FINISH
      const start = Math.min(...s.starts);
      const finish = Math.max(...s.finishes);

      let stageTime = finish - start;

      // přičti penalizaci
      stageTime += s.penalty;

      s.time = stageTime;
      s.start = start;
      s.finish = finish;

      total += stageTime;
      totalPenalty += s.penalty;
    });

    r.totalTime = total;
    r.totalPenalty = totalPenalty;

    results.push(r);
  });

  // 3️⃣ seřazení
  results.sort((a, b) => {
    if (a.dnf && !b.dnf) return 1;
    if (!a.dnf && b.dnf) return -1;
    return a.totalTime - b.totalTime;
  });

  return results;
}



//---------------

document.addEventListener("DOMContentLoaded", () => {
  loadRiders();
});