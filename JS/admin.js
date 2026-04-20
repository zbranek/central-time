
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
function loadResults() {
  alert("Tady budou výsledky z Supabase 🙂");
}



//---------------

document.addEventListener("DOMContentLoaded", () => {
  loadRiders();
});