/*********************************
 * GLOBAL STATE + STORAGE
 *********************************/

/*********************************
 * CLOCK (CENTRAL TIME)
 *********************************/

/*********************************
 * LOG SYSTEM
 *********************************/

/*********************************
 * START MODULE
 *********************************/

/*********************************
 * FINISH MODULE
 *********************************/

/*********************************
 * SETUP MODULE
 *********************************/

/*********************************
 * UI NAVIGATION
 *********************************/




//==== Automaticky start ============

let startSchedule = null;
let startTimer = null;
let startPlan = null;
let startIntervalTimer = null;
let countdownTimer = null;
let pendingFinishIndex = null;



function openFinishModal() {
  document.getElementById("finishModal").classList.remove("hidden");
  document.getElementById("finishRiderInput").value = "";
}

function closeFinishModal() {
  document.getElementById("finishModal").classList.add("hidden");
  document.getElementById("finishRiderInput").value = "";
}



//==================== VYTVOŘENÍ PLÁNU STARTŮ =================

function startAutoStarts(firstTimeStr, intervalSec, firstRider) {
  const [h, m, s] = firstTimeStr.split(":").map(Number);

  const now = new Date();
  const firstStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    h, m, s || 0
  );

  startSchedule = {
    nextTime: firstStart.getTime(),
    interval: intervalSec * 1000,
    nextRider: firstRider,
    active: true
  };

  startTimer = setInterval(checkAutoStart, 500);
}

//=============== KONTROLA A VYTVOŘENÍ START LOGU ===========

function checkAutoStart() {
  if (!startSchedule || !startSchedule.active) return;

  const now = Date.now();

  if (now >= startSchedule.nextTime) {
    addStartEvent(
      startSchedule.nextRider,
      startSchedule.nextTime
    );

    startSchedule.nextRider++;
    startSchedule.nextTime += startSchedule.interval;
  }
}

//======== VYTVOŘENÍ START EVENTU S PEVNÝM ČASEM =========

//===== zastavení startu =============

 function stopAutoStarts() {
  if (startTimer) {
    clearInterval(startTimer);
    startTimer = null;
  }
  if (startSchedule) {
    startSchedule.active = false;
  }
}



// ===== LOKALNI DATA =====

const STORAGE_KEYS = {
  EVENTS: "rally_events",
  LOG: "rally_log", 
  STAGE: "rally_current_stage"
};

function saveEvents() {
  localStorage.setItem(
    STORAGE_KEYS.EVENTS,
    JSON.stringify(events)
  );
}

function saveLog() {
  localStorage.setItem(
    STORAGE_KEYS.LOG,
    logElement.innerHTML
  );
}

function saveStage() {
  localStorage.setItem(
    STORAGE_KEYS.STAGE,
    currentStage
  );
}

function loadStage() {
  const storedStage = localStorage.getItem(STORAGE_KEYS.STAGE);
  if (storedStage) {
    currentStage = Number(storedStage);
  }
  updateStageDisplay();
}


function loadFromStorage() {
  const storedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
  const storedLog = localStorage.getItem(STORAGE_KEYS.LOG);

  if (storedEvents) {
    events = JSON.parse(storedEvents);
  }

  if (storedLog) {
    logElement.innerHTML = storedLog;
  }

  renderResults();
}





// ===== CENTRÁLNÍ ČAS =====

const timeElement = document.getElementById("time");
let timeOffset = 0;

function getCentralTime() {
  return Date.now() + timeOffset;
}

function updateClockDisplay() {
  const date = new Date(getCentralTime());

  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");

  timeElement.textContent = `${hh}:${mm}:${ss}`;
}

// ===== SYNCHRONIZACE (NEBLOKUJE APLIKACI) =====

async function syncTimeWithServer() {
  try {
    const t0 = Date.now();

    const response = await fetch("http://localhost:3000/time");
    const data = await response.json();

    const t1 = Date.now();
    const roundTrip = t1 - t0;

    const estimatedServerTime = data.serverTime + roundTrip / 2;
    timeOffset = estimatedServerTime - t1;

    console.log("⏱ Čas synchronizován");

  } catch (err) {
    console.warn("⚠️ Synchronizace času selhala – běžím lokálně");
  }
}

// ===== MĚŘENÍ =====

const riderInput = document.getElementById("riderNumber");
const startBtn = document.getElementById("startBtn");
const finishBtn = document.getElementById("finishBtn");
const logElement = document.getElementById("log");

let events = [];
let currentStage = 1;

function addEvent(type) {
  const riderNumber = riderInput.value;

  if (!riderNumber) {
    alert("Zadej číslo závodníka!");
    return;
  }

const event = {
  rider: riderNumber,
  stage: currentStage,
  type,
  time: getCentralTime(),
  valid: true
};

  events.push(event);
  renderLog();

    const stageTime = calculateLastStageTime(riderNumber);

  if (stageTime !== null) {
    const seconds = Math.floor(stageTime / 1000);
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;

    alert(
      `Závodník #${riderNumber}\n` +
      `Čas RZ: ${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    );
  }

renderResults();

saveEvents();
saveLog();




}

const resultsElement = document.getElementById("results");

function formatStageTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  const hundredths = Math.floor((ms % 1000) / 10);

  return (
    String(min).padStart(2, "0") + ":" +
    String(sec).padStart(2, "0") + "." +
    String(hundredths).padStart(2, "0")
  );
}


function getUniqueRiders() {
  return [...new Set(events.map(e => e.rider))];
}

function calculateResults() {
  const results = [];

  getUniqueRiders().forEach(rider => {
    const totalTime = calculateTotalTime(rider);
    if (totalTime > 0) {
      results.push({ rider, totalTime });
    }
  });

  results.sort((a, b) => a.totalTime - b.totalTime);
  return results;
}


function renderResults() {
  const results = calculateResults();

  if (results.length === 0) {
    resultsElement.textContent = "Zatím žádné výsledky";
    return;
  }

  resultsElement.innerHTML = "";

  results.forEach((r, index) => {
    const div = document.createElement("div");
    div.textContent =
      `${index + 1}. #${r.rider} – ${formatStageTime(r.totalTime)}`;
    resultsElement.appendChild(div);
  });
}

//============== editace LOG==============

function editEvent(index) {
  const e = events[index];

  const newRider = prompt(
    "Číslo závodníka:",
    e.rider
  );
  if (newRider === null) return;

  const newStage = prompt(
    "RZ číslo:",
    e.stage
  );
  if (newStage === null) return;

  // validace
  const stageNumber = Number(newStage);
  if (!Number.isInteger(stageNumber) || stageNumber < 1) {
    alert("Neplatné číslo RZ");
    return;
  }

  e.rider = newRider.trim();
  e.stage = stageNumber;

  saveEvents();
  renderLog();
  renderResults();
}



function renderLog() {
  logElement.innerHTML = "";

  events
    .sort((a, b) => a.time - b.time)
    .forEach((e, index) => {
      const timeStr = formatTimeWithMs(e.time);
      const div = document.createElement("div");

      div.addEventListener("click", () => {
  editEvent(index);
});



      div.textContent =
        `RZ${e.stage} | ` +
        `${String(index + 1).padStart(2, "0")} | ` +
        `#${e.rider} | ` +
        `${e.type} | ` +
        `${timeStr}` +
        (e.valid ? "" : " ❌ NEPLATNÝ");

      if (!e.valid) {
        div.style.opacity = "0.5";
      }

      logElement.appendChild(div);
    });
}

function toggleEventValidity(index) {
  if (!confirm("Označit tento záznam jako neplatný / platný?")) return;

  events[index].valid = !events[index].valid;

  saveEvents();
  renderLog();
  renderResults();
}


//============Export CSV

function generateCSV() {
  const header = [
    "RZ",
    "Pořadí",
    "Závodník",
    "Typ",
    "Čas",
    "Timestamp_ms",
    "Platný"
  ];

  const rows = events
    .sort((a, b) => a.time - b.time)
    .map((e, index) => {
      const timeStr = formatTimeWithMs(e.time);

      return [
        `RZ${e.stage}`,
        index + 1,
        e.rider,
        e.type,
        timeStr,
        e.time,
        e.valid ? "ANO" : "NE"
      ].join(";");
    });

  return [header.join(";"), ...rows].join("\n");
}


function downloadCSV() {
  const csvContent = generateCSV();
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "rally_log.csv";
  a.click();

  URL.revokeObjectURL(url);
}

//==== uprava casu milisekundy =====

function formatTimeWithMs(timestamp) {
  const d = new Date(timestamp);

  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");

  const ms = Math.floor(d.getMilliseconds() / 10); // dvě desetiny
  const msStr = String(ms).padStart(2, "0");

  return `${hh}:${mm}:${ss}.${msStr}`;
}


function calculateLastStageTime(riderNumber) {
  const riderEvents = events
    .filter(e => e.rider === riderNumber)
    .sort((a, b) => a.time - b.time);

  const start = events.find(
   e => e.valid && e.rider === rider && e.stage === stage && e.type === "START"
      );
  const finish = events.find(
  e => e.valid && e.rider === rider && e.stage === stage && e.type === "FINISH"
      );


  let lastStart = null;

  for (const e of riderEvents) {
    if (e.type === "START") {
      lastStart = e;
    }

    if (e.type === "FINISH" && lastStart) {
      return e.time - lastStart.time;
    }
  }

  return null;
}

//=============Stage time

function calculateStageTime(rider, stage) {
  const start = events.find(
    e => e.rider === rider && e.stage === stage && e.type === "START"
  );
  const finish = events.find(
    e => e.rider === rider && e.stage === stage && e.type === "FINISH"
  );

  if (!start || !finish) return null;
  return finish.time - start.time;
}

// ==============Total Time
function calculateTotalTime(rider) {
  let total = 0;

  for (let stage = 1; stage <= currentStage; stage++) {
    const t = calculateStageTime(rider, stage);
    if (t !== null) total += t;
  }

  return total;
}


//=== zadani starovni cislo klavesnice =========

const keypad = document.getElementById("keypad");
const clearBtn = document.getElementById("clearBtn");

keypad.addEventListener("click", (e) => {
  if (e.target.dataset.num !== undefined) {
    riderInput.value += e.target.dataset.num;
  }
});

clearBtn.addEventListener("click", () => {
  riderInput.value = "";
});


//=====Reset vysledku====

document.getElementById("reset").addEventListener("click", () => {
  if (!confirm("Opravdu smazat všechna data?")) return;

  events = [];
  logElement.innerHTML = "";
  resultsElement.innerHTML = "";

  localStorage.clear();
});

// ====ovladani RZ=====

const stageDisplay = document.getElementById("stageDisplay");

function updateStageDisplay() {
  stageDisplay.textContent = `RZ ${currentStage}`;
}

document.getElementById("nextStage").addEventListener("click", () => {
  currentStage++;
  updateStageDisplay();
  saveStage();
});

document.getElementById("prevStage").addEventListener("click", () => {
  if (currentStage > 1) {
    currentStage--;
    updateStageDisplay();
    saveStage();
  }
});

startBtn.addEventListener("click", () => addEvent("START"));
finishBtn.addEventListener("click", handleFinish);

// ======= automat start =========

const autoStartIndicator = document.getElementById("autoStartIndicator");

function setAutoStartActive(active) {
  autoStartIndicator.classList.toggle("hidden", !active);
}


document.getElementById("startAutoBtn").addEventListener("click", () => {
  const timeStr = document.getElementById("firstStartTime").value;
  const interval = Number(document.getElementById("startInterval").value);

    setAutoStartActive(true);

  if (!timeStr) {
    alert("Zadej čas startu prvního závodníka");
    return;
  }

  autoStartRiderNumber = riderInput.value;

if (!autoStartRiderNumber) {
  alert("Zadej číslo prvního závodníka");
  return;
}


  const [h, m, s] = timeStr.split(":").map(Number);
  const now = new Date();

  const firstStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    h, m, s || 0
  ).getTime();

  startPlan = {
    nextTime: firstStart,
    intervalMs: interval * 1000,
    active: true
  };

  startIntervalTimer = setInterval(checkStart, 200);
});

//==== odpočet ======

function checkStart() {
  if (!startPlan || !startPlan.active) return;

  const now = Date.now();
  const diff = startPlan.nextTime - now;

  if (diff <= 5000 && diff > 0) {
    showCountdown(Math.ceil(diff / 1000));
  }

  if (diff <= 0) {
    doStart(startPlan.nextTime);
    startPlan.nextTime += startPlan.intervalMs;
  }
}

//==== 1-2-3-4-5-go ===========

function showCountdown(seconds) {
  const el = document.getElementById("countdown");

  if (seconds > 0) {
    el.textContent = seconds;
    el.classList.remove("go");
  } else {
    el.textContent = "GO";
    el.classList.add("go");
  }
}

//======start log ====


function doStart(fixedTime) {
  showCountdown(0);

  addEventWithFixedTime("START", fixedTime);

  // PO STARTU VŽDY ČISTÉ POLE
  riderInput.value = "";
}

function addEventWithFixedTime(type, fixedTime) {
  const riderNumber = riderInput.value.trim();

  const event = {
    rider: riderNumber || "",   // POVOLUJEME PRÁZDNÉ
    stage: currentStage,
    type,
    time: fixedTime
  };

  events.push(event);

  saveEvents();
  renderLog();
  renderResults();

  riderInput.value = ""; // vždy vyčistit
}

//====Finish log odlozeny =====
function handleFinish() {
  const event = {
    rider: "",               // ZATÍM NEZNÁME
    stage: currentStage,
    type: "FINISH",
    time: getCentralTime(),
    valid: true
  };

  events.push(event);
  pendingFinishIndex = events.length - 1;

  saveEvents();
  renderLog();
  renderResults();

  openFinishModal();
}

//======== prepinani stranek =====
function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");
}

document.querySelectorAll("nav button").forEach(btn => {
  btn.addEventListener("click", () => {
    showView(btn.dataset.view);
  });
});


const finishInput = document.getElementById("finishRiderInput");

document.getElementById("finishKeypad").addEventListener("click", e => {
  if (e.target.dataset.num !== undefined) {
    finishInput.value += e.target.dataset.num;
  }
});

document.getElementById("finishClear").addEventListener("click", () => {
  finishInput.value = "";
});

document.getElementById("finishConfirm").addEventListener("click", () => {
  if (pendingFinishIndex === null) return;

  const riderNumber = finishInput.value.trim();

  // POVOLUJEME I PRÁZDNÉ (jak jsi chtěl)
  events[pendingFinishIndex].rider = riderNumber;

  pendingFinishIndex = null;

  saveEvents();
  renderLog();
  renderResults();

  closeFinishModal();
});


//=====zastaveni startu ====
document.getElementById("stopAutoBtn").addEventListener("click", () => {
  if (startIntervalTimer) {
    clearInterval(startIntervalTimer);
    startIntervalTimer = null;
  }
  startPlan = null;
  document.getElementById("countdown").textContent = "";
  setAutoStartActive(false);

});


// ===== START APLIKACE =====

// hodiny běží VŽDY
updateClockDisplay();
setInterval(updateClockDisplay, 200);

// synchronizace běží NA POZADÍ
syncTimeWithServer();

loadStage();
loadFromStorage();

document
  .getElementById("exportCsv")
  .addEventListener("click", downloadCSV);


