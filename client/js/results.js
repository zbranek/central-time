
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

//render results s F1 timing tower designem
function renderResults(results, ridersMap) {
  const tbody = document.querySelector("#results-table tbody");
  tbody.innerHTML = "";

  const leaderTime = results[0] && !results[0].dnf ? results[0].time : null;

  results.forEach((r, index) => {
    const rider = ridersMap[r.rider] || {};
    const tr = document.createElement("tr");

    if (r.dnf) tr.classList.add("dnf");

    // Position block
    let posHTML = "";
    if (r.dnf) {
      posHTML = `<span class="pos-dnf">DNF</span>`;
    } else {
      let posClass = "p4";
      if (r.position === 1) posClass = "p1";
      else if (r.position === 2) posClass = "p2";
      else if (r.position === 3) posClass = "p3";
      posHTML = `<span class="pos-block ${posClass}">${r.position}</span>`;
    }

    // Car number
    const carNumHTML = `<span class="car-num">#${r.rider}</span>`;

    // Crew
    const jmenoJezdce = rider.name || "Neznámý";
    const spolujezdec = rider.co_driver ? ` / ${rider.co_driver}` : "";
    const auto = `${rider.car_brand || ""} ${rider.car_model || ""}`.trim() || "-";
    const kategorie = rider.category || "-";

    const crewHTML = `
      <div class="crew-name">${jmenoJezdce}${spolujezdec}</div>
      <div class="crew-car">${auto}</div>
    `;

    // Group badge
    const groupHTML = `<span class="group-badge">${kategorie}</span>`;

    // Time
    const hlavniCas = r.dnf ? 'DNF' : formatMs(r.time);
    const penalizace = (r.penalty && r.penalty > 0) ? `+${formatMs(r.penalty)}` : "";
    
    const timeHTML = `
      <div class="time-main">${hlavniCas}</div>
      ${penalizace ? `<div class="time-penalty">${penalizace}</div>` : ""}
    `;

    // Gap
    let gapHTML = "";
    if (r.dnf) {
      gapHTML = `
        <div class="gap-container">
          <div class="gap-value">—</div>
        </div>
      `;
    } else if (r.position === 1) {
      gapHTML = `
        <div class="gap-container">
          <div class="gap-value leader">—</div>
        </div>
      `;
    } else {
      const gapToLeader = r.gap;
      const gapPercent = Math.max(20, Math.min(100, (gapToLeader / leaderTime) * 100));
      
      let gapToPrev = "-";
      if (index > 0 && !results[index - 1].dnf) {
        const diff = r.time - results[index - 1].time;
        gapToPrev = `+${formatMs(diff)}`;
      }

      gapHTML = `
        <div class="gap-container">
          <div class="gap-value">+${formatMs(gapToLeader)}</div>
          <div class="gap-bar-container">
            <div class="gap-bar" style="width: ${gapPercent}%"></div>
          </div>
          ${gapToPrev !== "-" ? `<div style="font-size: 10px; color: #666; margin-top: 2px;">Př: ${gapToPrev}</div>` : ""}
        </div>
      `;
    }

    tr.innerHTML = `
      <td class="col-position">${posHTML}</td>
      <td class="col-car-num">${carNumHTML}</td>
      <td class="col-crew">${crewHTML}</td>
      <td class="col-group">${groupHTML}</td>
      <td class="col-time">${timeHTML}</td>
      <td class="col-gap">${gapHTML}</td>
    `;

    tbody.appendChild(tr);
  });
}

// Render Overall Results s podiem kartami
function renderOverallResults(results, ridersMap) {
  const tbody = document.querySelector("#overall-results-table tbody");
  tbody.innerHTML = "";

  const leaderTime = results[0] && !results[0].dnf ? results[0].time : null;

  // Podium cards
  renderPodium(results, ridersMap);

  results.forEach((r, index) => {
    const rider = ridersMap[r.rider] || {};
    const tr = document.createElement("tr");

    if (r.dnf) tr.classList.add("dnf");

    // Position block
    let posHTML = "";
    if (r.dnf) {
      posHTML = `<span class="pos-dnf">DNF</span>`;
    } else {
      let posClass = "p4";
      if (r.position === 1) posClass = "p1";
      else if (r.position === 2) posClass = "p2";
      else if (r.position === 3) posClass = "p3";
      posHTML = `<span class="pos-block ${posClass}">${r.position}</span>`;
    }

    // Car number
    const carNumHTML = `<span class="car-num">#${r.rider}</span>`;

    // Crew
    const jmenoJezdce = rider.name || "Neznámý";
    const spolujezdec = rider.co_driver ? ` / ${rider.co_driver}` : "";
    const auto = `${rider.car_brand || ""} ${rider.car_model || ""}`.trim() || "-";
    const kategorie = rider.category || "-";

    const crewHTML = `
      <div class="crew-name">${jmenoJezdce}${spolujezdec}</div>
      <div class="crew-car">${auto}</div>
    `;

    // Group badge
    const groupHTML = `<span class="group-badge">${kategorie}</span>`;

    // Time
    const hlavniCas = r.dnf ? 'DNF' : formatMs(r.time);
    const penalizace = (r.penalty && r.penalty > 0) ? `+${formatMs(r.penalty)}` : "";
    
    const timeHTML = `
      <div class="time-main">${hlavniCas}</div>
      ${penalizace ? `<div class="time-penalty">${penalizace}</div>` : ""}
    `;

    // Gap
    let gapHTML = "";
    if (r.dnf) {
      gapHTML = `
        <div class="gap-container">
          <div class="gap-value">—</div>
        </div>
      `;
    } else if (r.position === 1) {
      gapHTML = `
        <div class="gap-container">
          <div class="gap-value leader">—</div>
        </div>
      `;
    } else {
      const gapToLeader = r.gap;
      const gapPercent = Math.max(20, Math.min(100, (gapToLeader / leaderTime) * 100));
      
      let gapToPrev = "-";
      if (index > 0 && !results[index - 1].dnf) {
        const diff = r.time - results[index - 1].time;
        gapToPrev = `+${formatMs(diff)}`;
      }

      gapHTML = `
        <div class="gap-container">
          <div class="gap-value">+${formatMs(gapToLeader)}</div>
          <div class="gap-bar-container">
            <div class="gap-bar" style="width: ${gapPercent}%"></div>
          </div>
          ${gapToPrev !== "-" ? `<div style="font-size: 10px; color: #666; margin-top: 2px;">Př: ${gapToPrev}</div>` : ""}
        </div>
      `;
    }

    tr.innerHTML = `
      <td class="col-position">${posHTML}</td>
      <td class="col-car-num">${carNumHTML}</td>
      <td class="col-crew">${crewHTML}</td>
      <td class="col-group">${groupHTML}</td>
      <td class="col-time">${timeHTML}</td>
      <td class="col-gap">${gapHTML}</td>
    `;

    tbody.appendChild(tr);
  });
}

// Render Podium Cards (P2 | P1 | P3 order)
function renderPodium(results, ridersMap) {
  const container = document.getElementById("podium-container");
  if (!container) return;

  container.innerHTML = "";

  // Get top 3
  const top3 = results.filter(r => !r.dnf).slice(0, 3);

  // Create cards in order: P2, P1, P3
  const order = [1, 0, 2]; // indices to pick from top3

  order.forEach(idx => {
    if (!top3[idx]) return;

    const r = top3[idx];
    const rider = ridersMap[r.rider] || {};
    const position = idx + 1;

    let posClass = "p2";
    if (position === 1) posClass = "p1";
    else if (position === 3) posClass = "p3";

    const card = document.createElement("div");
    card.className = `podium-card ${posClass}`;

    const jmenoJezdce = rider.name || "Neznámý";
    const spolujezdec = rider.co_driver ? ` / ${rider.co_driver}` : "";
    const cas = formatMs(r.time);

    card.innerHTML = `
      <div class="podium-rank ${posClass}">P${position}</div>
      <div class="podium-body">
        <div class="podium-car-num">#${r.rider}</div>
        <div class="podium-driver">${jmenoJezdce}</div>
        ${spolujezdec ? `<div style="font-size: 11px; color: #aaa;">${spolujezdec}</div>` : ""}
        <div class="podium-time">${cas}</div>
      </div>
    `;

    container.appendChild(card);
  });
}

function showView(id) {
  // Hide all views
  document.querySelectorAll(".view").forEach(v => {
    v.classList.remove("active");
  });

  // Show selected view
  const viewElement = document.getElementById("view-" + id);
  if (viewElement) {
    viewElement.classList.add("active");
  }

  // Update tab buttons
  document.querySelectorAll(".nav-tab").forEach(btn => {
    btn.classList.remove("active");
  });

  // Find and activate correct button
  document.querySelectorAll(".nav-tab").forEach(button => {
    const onclick = button.getAttribute("onclick") || "";
    if (onclick.includes(`'${id}'`)) {
      button.classList.add("active");
    }
  });
}

// Formátování data a času pro itinerář
function formatItineraryTime(isoString) {
  if (!isoString) return "-";
  
  try {
    const [datePart, timePart] = isoString.split("T");
    const [year, month, day] = datePart.split("-");
    const [hours, minutes] = timePart.split(":");
    
    return `${day}.${month}.${year} -- ${hours}:${minutes}`;
  } catch (e) {
    return isoString;
  }
}

// Get status badge class
function getStatusBadgeClass(status) {
  if (!status) return "status-planned";
  
  status = status.toLowerCase().trim();
  
  if (status.includes("hotovo") || status.includes("completed") || status.includes("finish")) {
    return "status-done";
  }
  if (status.includes("aktivní") || status.includes("active") || status.includes("running")) {
    return "status-active";
  }
  if (status.includes("plánováno") || status.includes("planned") || status.includes("upcoming")) {
    return "status-planned";
  }
  
  return "status-planned";
}

// Get status badge text
function getStatusBadgeText(status) {
  if (!status) return "Plánováno";
  
  status = status.toLowerCase().trim();
  
  if (status.includes("hotovo") || status.includes("completed") || status.includes("finish")) {
    return "Hotovo";
  }
  if (status.includes("aktivní") || status.includes("active") || status.includes("running")) {
    return "Aktivní";
  }
  if (status.includes("plánováno") || status.includes("planned") || status.includes("upcoming")) {
    return "Plánováno";
  }
  
  return "Plánováno";
}

// Load public itinerary with status badges
async function loadPublicItinerary() {
  const tbody = document.querySelector("#public-itinerary-table tbody");

  if (!tbody) {
    console.log("public-itinerary nenalezen");
    return;
  }

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

  tbody.innerHTML = "";

  data.forEach((stage, idx) => {
    const tr = document.createElement("tr");

    const stageNum = stage.stage_number || (idx + 1);
    const stageName = stage.name || "Neznámá RZ";
    const stageTime = formatItineraryTime(stage.start_time);
    const statusClass = getStatusBadgeClass(stage.status);
    const statusText = getStatusBadgeText(stage.status);

    tr.innerHTML = `
      <td class="col-stage-num">
        <span class="stage-badge">RZ${stageNum}</span>
      </td>
      <td class="col-stage-name">${stageName}</td>
      <td class="col-stage-time">${stageTime}</td>
      <td class="col-stage-status">
        <span class="status-badge ${statusClass}">${statusText}</span>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

