
//výsledky format
function formatMs(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msPart = Math.floor(ms % 1000);

  return `${m}:${String(s).padStart(2, "0")}.${String(msPart).padStart(3, "0")}`;
}


function saveRaceId() {

  const val =
    document.getElementById("race-id-input").value;

  localStorage.setItem("rally_race_id", val);

  loadStages();

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

});

//nahravani výsledků automat po změně stage
async function loadStages() {

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

  const select =
    document.getElementById("stage-select");

  select.innerHTML = "";

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


function renderResults(results, ridersMap) {
  const tbody = document.querySelector("#results-table tbody");
  tbody.innerHTML = "";

  results.forEach(r => {
    const rider = ridersMap[r.rider] || {};

    const tr = document.createElement("tr");


//nový vizual, může rozbít výsledky v Admin sekci  - když tak použít ze zálohy 
tr.innerHTML = `
  <td class="pos">${r.dnf ? "DNF" : r.position}</td>

  <td>#${r.rider}</td>

  <td>
  <div class="driver-name">
    ${rider.name || "-"}
  </div>

  <div class="crew-name">
    ${rider.co_driver || ""}
  </div>
</td>

  <td>
    ${(rider.car_brand || "")}
    ${(rider.car_model || "")}
  </td>

  <td>${rider.category || "-"}</td>

  <td class="time">
    ${r.dnf ? "-" : formatMs(r.time)}
  </td>

  <td class="gap">
    ${r.dnf || r.position === 1
      ? "-"
      : "+" + formatMs(r.gap)}
  </td>
`;

if (r.position === 1) tr.classList.add("gold");
if (r.position === 2) tr.classList.add("silver");
if (r.position === 3) tr.classList.add("bronze");

if (r.dnf) tr.classList.add("dnf");

if (r.dnf) {
  tr.style.background = "#330000";
  tr.style.color = "#ff5555";
}

    tbody.appendChild(tr);
  });

}