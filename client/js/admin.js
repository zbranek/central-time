

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

const raceId = getRaceId();











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

if (editingRiderId) {
  rider.id = editingRiderId;
}

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

async function importCSV() {

  const file = document.getElementById("csv-file").files[0];

  if (!file) {
    alert("Vyber CSV soubor");
    return;
  }

  const text = await file.text();

  const lines = text.split("\n");

  const riders = [];

  // první řádek = hlavička
  lines.slice(1).forEach(line => {

    if (!line.trim()) return;

    const cols = line.split(";");

    riders.push({
      race_id: window.APP.raceId,

      rider_number: cols[0]?.trim(),
      name: cols[1]?.trim(),
      nationality: cols[2]?.trim(),
      co_driver: cols[3]?.trim(),
      car_brand: cols[4]?.trim(),
      car_model: cols[5]?.trim(),
      category: cols[6]?.trim(),
      team: cols[7]?.trim()
    });
  });

  const { error } = await window.supabaseClient
    .from("riders")
    .upsert(riders, {
      onConflict: "race_id,rider_number"
    });

  if (error) {
    console.error(error);
    alert("Chyba při importu CSV");
    return;
  }

  alert(`Importováno ${riders.length} jezdců`);

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