
//výsledky format
function formatMs(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msPart = Math.floor(ms % 1000);

  return `${m}:${String(s).padStart(2, "0")}.${String(msPart).padStart(3, "0")}`;
}

/* Formátování data a času pro itinerář (vstup: "2026-05-11T15:30:00")
function formatItineraryTime(isoString) {
  if (!isoString) return "-";
  
  try {
    // Rozdělíme text na část před "T" (datum) a za "T" (čas)
    const [datePart, timePart] = isoString.split("T");
    
    // Rozdělíme datum na RRRR, MM, DD
    const [year, month, day] = datePart.split("-");
    
    // Rozdělíme čas na HH, MM, SS
    const [hours, minutes] = timePart.split(":");
    
    // Vrátíme výsledek v čistém českém formátu (můžete si upravit oddělovač)
    return `${day}.${month}.${year} --- ${hours}:${minutes}`;
  } catch (e) {
    // Kdyby náhodou v DB byl jiný formát, vrátíme původní text, ať kód nespadne
    return isoString;
  }
} */

function getRaceId() {

  const raceId =
    localStorage.getItem("rally_race_id");

  if (
    !raceId ||
    raceId === "undefined" ||
    raceId === "null"
  ) {
    return "";
  }

  return raceId;
}


function saveRaceIdResults() {

  console.log("SAVE CLICK");

  const val = document.getElementById("race-id-input").value;

  
   console.log("VALUE:", val);

  localStorage.setItem("rally_race_id", val);

  // 🔥 reload stages
  loadStages();
  loadPublicItinerary();

  // 🔥 vyčistit tabulku výsledků
  const tbody = document.querySelector("#results-table tbody");

  if (tbody) {
    tbody.innerHTML = "";
  }
}


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


document.addEventListener("DOMContentLoaded", () => {

  const raceId =
    localStorage.getItem("rally_race_id");

  if (raceId) {
    document.getElementById("race-id-input").value =
      raceId;
  }

  

  loadStages();
  loadPublicItinerary();


});



//nahravani výsledků automat po změně stage
async function loadStages() {

    const select = document.getElementById("stage-select");

    if (!select) {
    return;
  }
   const tbody = document.querySelector("#stages-table tbody");



  if (!tbody) {
    console.log("stages-table nenalezena");
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

  //console.log("STAGES", raceId, data);



  select.innerHTML = "";

  if (data.length === 0) {

  select.innerHTML =
    `<option>Žádné RZ</option>`;

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

  if (data.length > 0) {
  select.value = data[0].stage_number;
  loadResults();
}
}

async function loadResults() {



  const stage = parseInt(document.getElementById("stage-select").value);

   if (isNaN(stage)) {
    console.warn("Nebyla vybrána žádná RZ");
    return;
  }

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
  renderOverallResults(finalResults, ridersMap);
}

//render results změna podle Gemini -  
function renderResults(results, ridersMap) {
  const tbody = document.querySelector("#results-table tbody");
  tbody.innerHTML = "";

  results.forEach((r, index) => {
    const rider = ridersMap[r.rider] || {};
    const tr = document.createElement("tr");

    // Zachování vašich medailových tříd a DNF stavů
    if (r.position === 1) tr.classList.add("gold");
    if (r.position === 2) tr.classList.add("silver");
    if (r.position === 3) tr.classList.add("bronze");
    if (r.dnf) tr.classList.add("dnf");

    // Příprava textů posádky a vozu
    const pozice = r.dnf ? "DNF" : `${r.position}.`;
    const jmenoJezdce = rider.name || "Neznámý";
    const spolujezdec = rider.co_driver ? ` / ${rider.co_driver}` : "";
    const auto = `${rider.car_brand || ""} ${rider.car_model || ""}`.trim() || "-";
    const kategorie = rider.category || "-";

    // Čas a penalizace (po vzoru Lukov)
    const hlavniCas = r.dnf ? '<span class="badge-dnf">DNF</span>' : formatMs(r.time);
    const penalizace = (r.penalty && r.penalty > 0) ? `+${formatMs(r.penalty)}` : "";

    // Ztráta na 1. místo
    const ztrataNaPrvniho = (r.dnf || r.position === 1) ? "-" : "+" + formatMs(r.gap);
    
    // Výpočet ztráty na předchozího jezdce (dopočítáváme z pole výsledků)
    let ztrataNaPredchoziho = "-";
    if (!r.dnf && index > 0 && !results[index - 1].dnf) {
      const gapPrev = r.time - results[index - 1].time;
      ztrataNaPredchoziho = "+" + formatMs(gapPrev);
    }

    // Nová štíhlá struktura řádku
    tr.innerHTML = `
      <td class="col-pos">${pozice}</td>
      <td class="col-no">#${r.rider}</td>
      <td class="crew-cell">
        <div class="crew-names">${jmenoJezdce}${spolujezdec}</div>
        <div class="crew-car">${auto}</div>
      </td>
      <td class="col-cat">${kategorie}</td>
      <td>
        <div class="time-block">
          <div class="time-main">${hlavniCas}</div>
          ${penalizace ? `<div class="time-penalty" style="color: #ef4444; font-size: 0.8rem; font-weight: bold;">${penalizace}</div>` : ""}
        </div>
      </td>
      <td>
        <div class="gap-block">
          <div class="gap-leader">${ztrataNaPrvniho}</div>
          <div class="gap-prev" style="color: #64748b; font-size: 0.8rem;">${ztrataNaPredchoziho}</div>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

//funce overall results podle Gemini  
//overall výsledky pro pravou část tabulky   
// Celkové výsledky uděláme identické, aby obě tabulky měly stejný čistý vzhled
function renderOverallResults(results, ridersMap) {
  const tbody = document.querySelector("#overall-results-table tbody");
  tbody.innerHTML = "";

  results.forEach((r, index) => {
    const rider = ridersMap[r.rider] || {};
    const tr = document.createElement("tr");

    if (r.dnf) tr.classList.add("dnf");

    const pozice = r.dnf ? "DNF" : `${r.position}.`;
    const jmenoJezdce = rider.name || "Neznámý";
    const spolujezdec = rider.co_driver ? ` / ${rider.co_driver}` : "";
    const auto = `${rider.car_brand || ""} ${rider.car_model || ""}`.trim() || "-";
    const kategorie = rider.category || "-";

    const hlavniCas = r.dnf ? '<span class="badge-dnf">DNF</span>' : formatMs(r.time);
    const penalizace = (r.penalty && r.penalty > 0) ? `+${formatMs(r.penalty)}` : "";

    const ztrataNaPrvniho = (r.dnf || r.position === 1) ? "-" : "+" + formatMs(r.gap);
    
    let ztrataNaPredchoziho = "-";
    if (!r.dnf && index > 0 && !results[index - 1].dnf) {
      const gapPrev = r.time - results[index - 1].time;
      ztrataNaPredchoziho = "+" + formatMs(gapPrev);
    }

    tr.innerHTML = `
      <td class="col-pos">${pozice}</td>
      <td class="col-no">#${r.rider}</td>
      <td class="crew-cell">
        <div class="crew-names">${jmenoJezdce}${spolujezdec}</div>
        <div class="crew-car">${auto}</div>
      </td>
      <td class="col-cat">${kategorie}</td>
      <td>
        <div class="time-block">
          <div class="time-main">${hlavniCas}</div>
          ${penalizace ? `<div class="time-penalty" style="color: #ef4444; font-size: 0.8rem; font-weight: bold;">${penalizace}</div>` : ""}
        </div>
      </td>
      <td>
        <div class="gap-block">
          <div class="gap-leader">${ztrataNaPrvniho}</div>
          <div class="gap-prev" style="color: #64748b; font-size: 0.8rem;">${ztrataNaPredchoziho}</div>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function showView(id) {

  document
    .querySelectorAll(".view")
    .forEach(v =>
      v.classList.remove("active")
    );

  document
    .getElementById("view-" + id)
    .classList.add("active");

  document
    .querySelectorAll(".tab-btn")
    .forEach(b =>
      b.classList.remove("active")
    );

  event.target.classList.add("active");
}

// 1. Pomocná funkce pro úpravu formátu (vložte ji kamkoliv do results.js, např. na začátek nebo konec)
function formatItineraryTime(isoString) {
  if (!isoString) return "-";
  
  try {
    // Rozdělíme "2026-05-11T15:30:00" na datum a čas
    const [datePart, timePart] = isoString.split("T");
    const [year, month, day] = datePart.split("-");
    const [hours, minutes] = timePart.split(":");
    
    // Výsledný formát: "11.05.2026 -- 15:30"
    return `${day}.${month}.${year} -- ${hours}:${minutes}`;
  } catch (e) {
    // Kdyby formát v DB z nějakého důvodu neseděl, vrátíme původní text, ať kód nespadne
    return isoString;
  }
}

// 2. Vaše upravená funkce s nasazeným formátováním
async function loadPublicItinerary() {

  const tbody =
    document.querySelector("#public-itinerary-table tbody");

  if (!tbody) {
    console.log("public-itinerary nenalezen");
    return;
  }

  const raceId = getRaceId();

  const { data, error } =
    await supabaseClient
      .from("stages")
      .select("*")
      .eq("race_id", raceId)
      .order("start_time", {
        ascending: true
      });

  if (error) {
    console.error(error);
    return;
  }

  tbody.innerHTML = "";

  data.forEach(stage => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${stage.status || ""}</td>
      <td>${stage.name || ""}</td>
      <td>${formatItineraryTime(stage.start_time)}</td>
    `;

    tbody.appendChild(tr);
  });
}