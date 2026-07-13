

//globalni promen. 

let editingRiderId = null;
let riders = [];
let currentRaceId = "";

const AUTH_SESSION_KEY = "rally_admin_fake_login";
const FAKE_ADMIN_PASSWORD = "admin";

const adminAuthProvider = {
  async signIn(password) {
    if (password !== FAKE_ADMIN_PASSWORD) {
      return {
        ok: false,
        message: "Neplatné heslo"
      };
    }

    sessionStorage.setItem(AUTH_SESSION_KEY, "1");
    return { ok: true };
  },

  async signOut() {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  },

  async isAuthenticated() {
    return sessionStorage.getItem(AUTH_SESSION_KEY) === "1";
  }
};

async function initAdminAuth() {
  const loginScreen = document.getElementById("admin-login");
  const adminApp = document.getElementById("admin-app");
  const loginForm = document.getElementById("admin-login-form");
  const passwordInput = document.getElementById("admin-password");
  const loginError = document.getElementById("admin-login-error");
  const logoutButton = document.getElementById("admin-logout-btn");

  const showAdmin = async () => {
    if (loginScreen) loginScreen.hidden = true;
    if (adminApp) adminApp.hidden = false;
    await initAdminData();
  };

  const showLogin = () => {
    if (adminApp) adminApp.hidden = true;
    if (loginScreen) loginScreen.hidden = false;
    if (passwordInput) {
      passwordInput.value = "";
      passwordInput.focus();
    }
  };

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (loginError) loginError.textContent = "";

      const result = await adminAuthProvider.signIn(passwordInput ? passwordInput.value : "");

      if (!result.ok) {
        if (loginError) loginError.textContent = result.message || "Přihlášení se nezdařilo";
        return;
      }

      await showAdmin();
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      await adminAuthProvider.signOut();
      showLogin();
    });
  }

  if (await adminAuthProvider.isAuthenticated()) {
    await showAdmin();
  } else {
    showLogin();
  }
}

async function initAdminData() {
  currentRaceId = getRaceId();
  window.APP.raceId = currentRaceId;

  updateRaceDisplay();
  await loadRaceInfo();
  await loadRiders();
  await loadItinerary();
}

//vlozeni cisla zavodu - automat. ulozeni

const input = document.getElementById("race-id-input");

//POTVRZENÍ ZADÁNÍ ČÍSLA ZÁVODU AUTOMATICKY BEZ TLAČÍTKA
/*input.addEventListener("input", () => {
  if (input.value.length === 5) {
    saveRaceId();
  }
});*/

//const raceId = getRaceId();











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
  // Skrýt všechny pohledy a odebrat active třídu
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  
  const targetView = document.getElementById('view-' + id);
  if (targetView) targetView.classList.add('active');

  // Správné přepnutí aktivního tlačítka bez použití globálního 'event'
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('active');
    // Pokud tlačítko v onclick textu obsahuje dané ID, aktivujeme ho
    if (b.getAttribute('onclick') && b.getAttribute('onclick').includes(`'${id}'`)) {
      b.classList.add('active');
    }
  });
}

async function saveRaceId() {

  const val =
    document.getElementById('race-id-input')
      .value.trim();

  if (!val) return;

  localStorage.setItem('rally_race_id', val);

  currentRaceId = val;
  window.APP.raceId = val;

  updateRaceDisplay();

  await loadRaceInfo();

  loadRiders();
  loadItinerary();
}

function updateRaceDisplay() {
    const raceId = localStorage.getItem('rally_race_id') || "-----";

    document.getElementById('current-race-display').textContent = raceId;
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

  // CSV začíná rovnou prvním jezdcem
  function parseCSVLine(line, sep = ",") {
    const res = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        // support escaped double quotes ""
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (ch === sep && !inQuotes) {
        res.push(cur);
        cur = "";
        continue;
      }

      cur += ch;
    }

    res.push(cur);
    return res;
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (!line) continue;
    // normalize CRLF and trim
    line = line.replace(/\r/g, '').trim();
    if (!line) continue;

    const cols = parseCSVLine(line, ',').map(c => c.replace(/^\"|\"$/g, '').trim());

    // basic validation: need at least rider number and name
    if (!cols[0] || !cols[1]) continue;

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
  }

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

//  informace o závodu  -----------------------------------------

//načtení závodu  ---------------
async function loadRaceInfo() {

  const raceId = getRaceId();

  if (!raceId) return;

  const { data, error } = await supabaseClient
    .from("races")
    .select("*")
    .eq("race_id", raceId)
    .maybeSingle();

  // závod neexistuje -> vyčistit formulář
  if (error || !data) {

    document.getElementById("race-name").value = "";
    document.getElementById("race-location").value = "";
    document.getElementById("race-date").value = "";
    document.getElementById("race-organizer").value = "";

    document.getElementById("current-race-display").textContent =
      raceId;

    return;
  }

  // načtení dat do formuláře
  document.getElementById("race-name").value =
    data.race_name || "";

  document.getElementById("race-location").value =
    data.location || "";

  document.getElementById("race-date").value =
    data.race_date || "";

  document.getElementById("race-organizer").value =
    data.organizer || "";

  // horní lišta
  document.getElementById("current-race-display").textContent =
    `${data.race_id} | ${data.race_name}`;
}

// Uložení informací o závodu  ---------------------  

async function saveRaceInfo() {

  const raceId = getRaceId();

  if (!raceId) {
    alert("Nejprve nastav ID závodu");
    return;
  }

  const race = {
    race_id: raceId,
    race_name: document.getElementById("race-name").value.trim(),
    location: document.getElementById("race-location").value.trim(),
    race_date: document.getElementById("race-date").value,
    organizer: document.getElementById("race-organizer").value.trim()
  };

  const { error } = await supabaseClient
    .from("races")
    .upsert([race]);

  if (error) {
    console.error(error);
    alert("Chyba při ukládání závodu");
    return;
  }

  console.log("Race info uloženo:", race);
  alert("Údaje o závodu byly uloženy");
}

async function loadRiders() {

  const raceId = getRaceId();
 
 // if (!currentRaceId) {
 //   console.warn("Chybí race_id");
 //   return;
 // }

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

  // Vyčištění polí po úspěšném přidání
document.getElementById("it-label").value = "";
document.getElementById("it-time").value = "";
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

async function loadStages() {

 


  if (!select) {
    return;
  }

  const raceId = getRaceId();

  if (!raceId) {
    console.warn("Chybí Race ID");
    return;
  }

  const { data, error } = await supabaseClient
    .from("stages")
    .select("*")
    .eq("race_id", raceId)
    .eq("status", "stage")
    .order("stage_number", { ascending: true });

  if (error) {
    console.error("Chyba načítání stages:", error);
    return;
  }

  select.innerHTML = "";

  if (data.length === 0) {

    select.innerHTML = `<option>Žádné RZ</option>`;

    const tbody =
      document.querySelector("#results-table tbody");

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8">
            Pro tento závod nejsou vytvořeny RZ
          </td>
        </tr>
      `;
    }

    return;
  }

  data.forEach(stage => {

    const option =
      document.createElement("option");

    option.value = stage.stage_number;

    option.textContent =
      `RZ${stage.stage_number} - ${stage.name}`;

    select.appendChild(option);

  });

  select.value = data[0].stage_number;

  loadResults();
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

  if (error) {
  console.error(error);
  alert("Chyba při komunikaci s databází: " + error.message);
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
  console.log("LOAD ITINERARY CALLED");
console.trace();
  console.log("Itinerary race_id =", getRaceId());
  const raceId = getRaceId();

  const { data, error } = await supabaseClient
    .from("stages")
    .select("*")
    .eq("race_id", raceId)
    .order("start_time", { ascending: true });

    console.log(data);


  if (error) {
    console.error(error);
    return;
  }

  const tbody = document.querySelector("#itinerary-table tbody");

  console.log("tbody =", tbody);
  console.log("Rows loaded:", data.length);
  
  tbody.innerHTML = "";

  

  data.forEach(row => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${row.status}</td>
      <td>${row.name}</td>
      <td>${formatDateTime(row.start_time)}</td>
      <td>
        <button onclick="deleteStage('${row.id}')">❌</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

//format data pro zobrazení v itineráři

function formatDateTime(dateString) {
  if (!dateString) return "-";

  const d = new Date(dateString);

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${day}. ${month}. ${year} ${hours}:${minutes}`;
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

/*********************************
 * VÝSTUPY - EXPORT
 *********************************/

async function exportStartovniListina() {
  const raceId = getRaceId();
  
  if (!raceId || raceId === "00000") {
    alert("Nejprve nastav ID závodu");
    return;
  }

  const { data: raceData } = await supabaseClient
    .from("races")
    .select("*")
    .eq("race_id", raceId)
    .maybeSingle();

  const { data: riders } = await supabaseClient
    .from("riders")
    .select("*")
    .eq("race_id", raceId)
    .order("rider_number", { ascending: true });

  if (!riders || riders.length === 0) {
    alert("Žádní jezdci k exportu");
    return;
  }

  // Vytvoření dočasného HTML prvku pro renderování
  const container = document.createElement("div");
  container.style.width = "1000px";
  container.style.padding = "20px";
  container.style.fontFamily = "Arial, sans-serif";
  container.style.fontSize = "14px";
  container.style.lineHeight = "1.6";
  container.style.backgroundColor = "white";
  
  // HTML obsah
  let html = `
    <div style="margin-bottom: 20px;">
      <h1 style="font-size: 28px; margin: 10px 0; text-align: center;">STARTOVNÍ LISTINA</h1>
      <p style="font-size: 16px; margin: 5px 0;"><strong>Závod:</strong> ${raceData?.race_name || "-"}</p>
      <p style="font-size: 16px; margin: 5px 0;"><strong>Místo:</strong> ${raceData?.location || "-"}</p>
      <p style="font-size: 16px; margin: 5px 0;"><strong>Datum:</strong> ${raceData?.race_date || "-"}</p>
    </div>
    
    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
      <thead>
        <tr style="background-color: #2980b9; color: white;">
          <th style="border: 1px solid #bbb; padding: 12px; text-align: left; font-weight: bold; font-size: 14px;">Č.</th>
          <th style="border: 1px solid #bbb; padding: 12px; text-align: left; font-weight: bold; font-size: 14px;">Jezdec</th>
          <th style="border: 1px solid #bbb; padding: 12px; text-align: left; font-weight: bold; font-size: 14px;">Spolujezdec</th>
          <th style="border: 1px solid #bbb; padding: 12px; text-align: left; font-weight: bold; font-size: 14px;">Národnost</th>
          <th style="border: 1px solid #bbb; padding: 12px; text-align: left; font-weight: bold; font-size: 14px;">Auto</th>
          <th style="border: 1px solid #bbb; padding: 12px; text-align: left; font-weight: bold; font-size: 14px;">Kategorie</th>
          <th style="border: 1px solid #bbb; padding: 12px; text-align: left; font-weight: bold; font-size: 14px;">Tým</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  riders.forEach((r, index) => {
    const bgColor = index % 2 === 0 ? "white" : "#f5f5f5";
    html += `
      <tr style="background-color: ${bgColor};">
        <td style="border: 1px solid #bbb; padding: 10px; font-size: 14px;">${r.rider_number || "-"}</td>
        <td style="border: 1px solid #bbb; padding: 10px; font-size: 14px;">${r.name || "-"}</td>
        <td style="border: 1px solid #bbb; padding: 10px; font-size: 14px;">${r.co_driver || "-"}</td>
        <td style="border: 1px solid #bbb; padding: 10px; font-size: 14px;">${r.nationality || "-"}</td>
        <td style="border: 1px solid #bbb; padding: 10px; font-size: 14px;">${`${r.car_brand || ""} ${r.car_model || ""}`.trim() || "-"}</td>
        <td style="border: 1px solid #bbb; padding: 10px; font-size: 14px;">${r.category || "-"}</td>
        <td style="border: 1px solid #bbb; padding: 10px; font-size: 14px;">${r.team || "-"}</td>
      </tr>
    `;
  });
  
  html += `
      </tbody>
    </table>
  `;
  
  container.innerHTML = html;
  document.body.appendChild(container);
  
  // Render do canvas a PDF
  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff"
    });
    
    const { jsPDF } = window.jspdf;
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });
    
    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    
    // Přidat obrázky na stránky (pokud je obsah delší)
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    pdf.save(`Startovni_listina_${raceId}.pdf`);
  } catch (error) {
    console.error("Chyba při vytváření PDF:", error);
    alert("Chyba při exportu PDF");
  } finally {
    document.body.removeChild(container);
  }
}

async function exportItinerar() {
  const raceId = getRaceId();
  
  if (!raceId || raceId === "00000") {
    alert("Nejprve nastav ID závodu");
    return;
  }

  const { data: raceData } = await supabaseClient
    .from("races")
    .select("*")
    .eq("race_id", raceId)
    .maybeSingle();

  const { data: stages } = await supabaseClient
    .from("stages")
    .select("*")
    .eq("race_id", raceId)
    .order("start_time", { ascending: true });

  if (!stages || stages.length === 0) {
    alert("Žádný itinerář k exportu");
    return;
  }

  // Vytvoření dočasného HTML prvku pro renderování
  const container = document.createElement("div");
  container.style.width = "1000px";
  container.style.padding = "20px";
  container.style.fontFamily = "Arial, sans-serif";
  container.style.fontSize = "14px";
  container.style.lineHeight = "1.6";
  container.style.backgroundColor = "white";
  
  // HTML obsah
  let html = `
    <div style="margin-bottom: 20px;">
      <h1 style="font-size: 28px; margin: 10px 0; text-align: center;">ITINERÁŘ</h1>
      <p style="font-size: 16px; margin: 5px 0;"><strong>Závod:</strong> ${raceData?.race_name || "-"}</p>
      <p style="font-size: 16px; margin: 5px 0;"><strong>Datum:</strong> ${raceData?.race_date || "-"}</p>
      <p style="font-size: 16px; margin: 5px 0;"><strong>Místo:</strong> ${raceData?.location || "-"}</p>
    </div>
    
    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
      <thead>
        <tr style="background-color: #2980b9; color: white;">
          <th style="border: 1px solid #bbb; padding: 12px; text-align: left; font-weight: bold; font-size: 14px;">Typ</th>
          <th style="border: 1px solid #bbb; padding: 12px; text-align: left; font-weight: bold; font-size: 14px;">Popis</th>
          <th style="border: 1px solid #bbb; padding: 12px; text-align: left; font-weight: bold; font-size: 14px;">Čas</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  stages.forEach((s, index) => {
    const bgColor = index % 2 === 0 ? "white" : "#f5f5f5";
    const typeLabel = s.status === "stage" ? "RZ" : s.status === "service" ? "Servis" : "Přejezd";
    const time = s.start_time ? formatDateTime(s.start_time) : "-";
    
    html += `
      <tr style="background-color: ${bgColor};">
        <td style="border: 1px solid #bbb; padding: 10px; font-size: 14px; font-weight: bold;">${typeLabel}</td>
        <td style="border: 1px solid #bbb; padding: 10px; font-size: 14px;">${s.name || "-"}</td>
        <td style="border: 1px solid #bbb; padding: 10px; font-size: 14px;">${time}</td>
      </tr>
    `;
  });
  
  html += `
      </tbody>
    </table>
  `;
  
  container.innerHTML = html;
  document.body.appendChild(container);
  
  // Render do canvas a PDF
  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff"
    });
    
    const { jsPDF } = window.jspdf;
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });
    
    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    
    // Přidat obrázky na stránky (pokud je obsah delší)
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    pdf.save(`Itinerar_${raceId}.pdf`);
  } catch (error) {
    console.error("Chyba při vytváření PDF:", error);
    alert("Chyba při exportu PDF");
  } finally {
    document.body.removeChild(container);
  }
}

async function exportKartaZavodnika() {
  const raceId = getRaceId();
  
  if (!raceId || raceId === "00000") {
    alert("Nejprve nastav ID závodu");
    return;
  }

  const { data: riders } = await supabaseClient
    .from("riders")
    .select("*")
    .eq("race_id", raceId)
    .order("rider_number", { ascending: true });

  if (!riders || riders.length === 0) {
    alert("Žádní jezdci k exportu");
    return;
  }

  let csv = "KARTA ZÁVODNÍKA\n";
  csv += `\n`;

  riders.forEach(r => {
    csv += `Startovní číslo,${r.rider_number}\n`;
    csv += `Jezdec,${r.name}\n`;
    csv += `Spolujezdec,${r.co_driver}\n`;
    csv += `Národnost,${r.nationality}\n`;
    csv += `Značka vozu,${r.car_brand}\n`;
    csv += `Model vozu,${r.car_model}\n`;
    csv += `Kategorie,${r.category}\n`;
    csv += `Tým,${r.team}\n`;
    csv += `\n`;
  });

  downloadCSV(csv, `Karta_zavodnika_${raceId}.csv`);
}

function downloadCSV(csvContent, fileName) {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

//---------------

document.addEventListener("DOMContentLoaded", () => {
  initAdminAuth();
});
