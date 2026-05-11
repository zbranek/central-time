

//globalni promen. 

let editingRiderId = null;
let riders = [];

//vlozeni cisla zavodu - automat. ulozeni

const input = document.getElementById("race-id-input");

//POTVRZENÍ ZADÁNÍ ČÍSLA ZÁVODU AUTOMATICKY BEZ TLAČÍTKA
/*input.addEventListener("input", () => {
  if (input.value.length === 5) {
    saveRaceId();
  }
});*/

function getRaceId() {
  return localStorage.getItem('rally_race_id') || "";
}
const raceId = getRaceId();

//DNF 
function parsePenalty(code) {
  if (!code) return { time: 0, dnf: false };

  code = code.trim().toUpperCase();

  // 🚨 DNF
  if (code === "DNF") {
    return { time: 0, dnf: true };
  }

  // ➕ odstranění "+"
  if (code.startsWith("+")) {
    code = code.substring(1);
  }

  // ⏱ sekundy (výchozí)
  if (!isNaN(code)) {
    return { time: parseInt(code) * 1000, dnf: false };
  }

  // ⏱ "10S"
  if (code.endsWith("S")) {
    return { time: parseInt(code) * 1000, dnf: false };
  }

  // ⏱ "1M"
  if (code.endsWith("M")) {
    return { time: parseInt(code) * 60000, dnf: false };
  }

  return { time: 0, dnf: false };
}


async function loadResults() {

  const stage = parseInt(document.getElementById("stage-select").value);
  const raceId = getRaceId();

  if (!raceId) {
    alert("Není nastaveno Race ID");
    return;
  }

  // 1️⃣ logy
  const { data: logs, error } = await supabaseClient
    .from("rally_logs")
    .select("*")
    .eq("race_id", raceId)
    .eq("stage", stage);

  if (error) {
    console.error(error);
    alert("Chyba při načítání logů");
    return;
  }

  // 2️⃣ riders
  const { data: riders } = await supabaseClient
    .from("riders")
    .select("*")
    .eq("race_id", raceId);

  const ridersMap = {};
  riders.forEach(r => {
    ridersMap[r.rider_number] = r;

  });

  // 3️⃣ výpočet
 const map = {};

logs.forEach(log => {
  const rider = String(log.rider);
  if (!rider) return;

  if (!map[rider]) {
    map[rider] = {
      rider,
      start: null,
      finish: null,
      penalty: 0,
      dnf: false
    };
  }

  if (log.type === "START") {
    map[rider].start = log.time_ms;
  }

  if (log.type === "FINISH") {
    map[rider].finish = log.time_ms;

    if (log.penalty) {
      const p = parsePenalty(log.penalty);

      map[rider].penalty += p.time;

      if (p.dnf) {
        map[rider].dnf = true;
      }
    }
  }
});

  // 4️⃣ výsledky
  let results = Object.values(map).map(r => {

   if (!r.start || !r.finish || r.dnf) {
  return {
    rider: r.rider,
    dnf: true
  };
}

    return {
      rider: r.rider,
      time: r.finish - r.start + r.penalty,
      penalty: r.penalty,
      dnf: false
    };
  });

  // 5️⃣ třídění
  const classified = results
    .filter(r => !r.dnf)
    .sort((a, b) => a.time - b.time);

  const dnf = results.filter(r => r.dnf);

  // 6️⃣ pořadí
  classified.forEach((r, i) => {
    r.position = i + 1;
    r.gap = i === 0 ? 0 : r.time - classified[0].time;
  });

  // 7️⃣ final
  const finalResults = [...classified, ...dnf];

  renderResults(finalResults, ridersMap);
}

//výsledky format
function formatMs(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msPart = Math.floor(ms % 1000);

  return `${m}:${String(s).padStart(2, "0")}.${String(msPart).padStart(3, "0")}`;
}

function renderResults(results, ridersMap) {
  const tbody = document.querySelector("#results-table tbody");
  tbody.innerHTML = "";

  results.forEach(r => {
    const rider = ridersMap[r.rider] || {};

    const tr = document.createElement("tr");

   tr.innerHTML = `
  <td>${r.dnf ? "DNF" : r.position}</td>
  <td>#${r.rider}</td>
  <td>${rider.name || "-"}</td>
  <td>${(rider.car_brand || "") + " " + (rider.car_model || "")}</td>
  <td>${rider.category || "-"}</td>
  <td>${r.dnf ? "-" : formatMs(r.time)}</td>
  <td>${r.dnf || r.position === 1 ? "-" : "+" + formatMs(r.gap)}</td>
  <td>${r.penalty ? formatMs(r.penalty) : "-"}</td>
`;

if (r.dnf) {
  tr.style.background = "#330000";
  tr.style.color = "#ff5555";
}

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
  window.APP.raceId = val;

  loadRiders();
}

/*********************************
 * ADMIN - RIDERS
 *********************************/


async function addRider() {
  if (!window.APP.raceId) {
    alert("Nejprve nastav ID závodu!");
    return;
  }

const rider = {
  id: editingRiderId || undefined,

  race_id: window.APP.raceId,
  rider_number: document.getElementById('rider-number').value,
  name: document.getElementById('rider-name').value,
  co_driver: document.getElementById('co-driver').value,
  nationality: document.getElementById('nationality').value,
  car_brand: document.getElementById('car-brand').value,
  car_model: document.getElementById('car-model').value,
  category: document.getElementById('category').value,
  team: document.getElementById('team').value
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

  editingRiderId = null;

const btn = document.getElementById("save-rider-btn");

if (btn) {
  btn.textContent = "➕ Přidat jezdce";
  btn.style.background = "";
  }
}

function clearRiderForm() {
  document.getElementById('rider-number').value = "";
  document.getElementById('rider-name').value = "";
  document.getElementById('co-driver').value = "";
  document.getElementById('nationality').value = "";
  document.getElementById('car-brand').value = "";
  document.getElementById('car-model').value = "";
  document.getElementById('category').value = "";
  document.getElementById('team').value = "";
}



function renderRiders(riders) {
  const tbody = document.querySelector("#riders-table tbody");
  const status = document.getElementById("riders-status");

  if (!tbody) {
    console.error("❌ Nenalezen #riders-table tbody");
    return;
  }

  tbody.innerHTML = "";

  // 🔥 STATUS
  if (status) {
    if (riders.length === 0) {
      status.textContent = "Žádní jezdci pro tento závod";
      status.style.color = "#f55";
    } else {
      status.textContent = `Načteno ${riders.length} jezdců`;
      status.style.color = "#0f0";
    }
  }

  if (!status) {
  console.warn("⚠️ Nenalezen #riders-status");
}
//tabulka v Administraci - zobrazeni info k registraci
//<td>${r.co_driver_nationality || ""}</td>
  riders.forEach(r => {
    const tr = document.createElement("tr");

tr.style.cursor = "pointer";
tr.onclick = () => editRider(r);

    tr.innerHTML = `
  <td>${r.rider_number || ""}</td>
  <td>${r.name || ""}</td>
  <td>${r.nationality || ""}</td>
  <td>${r.co_driver || ""}</td>
  <td>${r.car_brand || ""} ${r.car_model || ""}</td>
  <td>${r.category || ""}</td>
  <td>${r.team || ""}</td>
  <td>
  <button onclick="deleteRider(${r.id})">❌</button>
  </td>
`;


    tbody.appendChild(tr);
  });
}

function editRider(rider) {

  editingRiderId = rider.id;

  document.getElementById("rider-number").value = rider.rider_number || "";
  document.getElementById("rider-name").value = rider.name || "";
  document.getElementById("nationality").value = rider.nationality || "";
  document.getElementById("co-driver").value = rider.co_driver || "";
  document.getElementById("car-brand").value = rider.car_brand || "";
  document.getElementById("car-model").value = rider.car_model || "";
  document.getElementById("category").value = rider.category || "";
  document.getElementById("team").value = rider.team || "";

  const btn = document.getElementById("save-rider-btn");

  if (btn) {
    btn.textContent = "💾 Uložit změny";
    btn.style.background = "#664400";
  }
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

async function loadRiders() {
  if (!currentRaceId) {
    console.warn("Chybí race_id");
    return;
  }

  const { data, error } = await supabaseClient
    .from("riders")
    .select("*")
    .eq("race_id", currentRaceId)
    .order("rider_number", { ascending: true });

  if (error) {
    console.error("Chyba při načítání riders:", error);
    alert("Nepodařilo se načíst startovní listinu");
    return;
  }

  renderRiders(data);
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

//tabulka Stages - napojeni
async function addItinerary() {
  const type = document.getElementById('it-type').value;
  const label = document.getElementById('it-label').value;
  const time = document.getElementById('it-time').value;

  if (!label) {
    alert("Zadej popis");
    return;
  }

  const raceId = getRaceId(); // musíš mít funkci

  const stageNumber = type === "stage"
    ? await getNextStageNumber(raceId)
    : null;

  const { error } = await supabaseClient
    .from("stages")
    .insert({
      race_id: raceId,
      stage_number: stageNumber,
      name: label,
      start_time: time || null,
      status: type
    });

  if (error) {
    console.error(error);
    alert("Chyba při ukládání");
    return;
  }

  loadItinerary();
}

//dalši číslo RZ
async function getNextStageNumber(raceId) {
  const { data, error } = await supabaseClient
    .from("stages")
    .select("stage_number")
    .eq("race_id", raceId)
    .eq("status", "stage")
    .order("stage_number", { ascending: false })
    .limit(1);

  if (error || !data.length) return 1;

  return data[0].stage_number + 1;
}

//načtení itineráře
async function loadItinerary() {
  const raceId = getRaceId();

  const { data, error } = await supabaseClient
    .from("stages")
    .select("*")
    .eq("race_id", raceId)
    .order("start_time", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  const tbody = document.querySelector("#itinerary-table tbody");
  tbody.innerHTML = "";

  data.forEach(row => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${row.status}</td>
      <td>${row.name}</td>
      <td>${row.start_time || "-"}</td>
      <td>
        <button onclick="deleteStage('${row.id}')">❌</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

//mazání 
async function deleteStage(id) {
  if (!confirm("Smazat?")) return;

  const { error } = await supabaseClient
    .from("stages")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    return;
  }

  loadItinerary();
}

//načist číslo závodu
function getRaceId() {
  return localStorage.getItem('rally_race_id') || "00000";
}

/*********************************
 * VÝSLEDKY (placeholder)
 *********************************/



//výpočet výsledů




//---------------

document.addEventListener("DOMContentLoaded", () => {

  currentRaceId = getRaceId();
  window.APP.raceId = currentRaceId;

  loadRiders();
});

loadItinerary();