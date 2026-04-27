
// Supabase inicializace
window.supabaseClient

/*********************************
 * 1. GLOBÁLNÍ STAV (Paměť aplikace)
 *********************************/
let events = JSON.parse(localStorage.getItem('rally_events')) || [];
let currentStage = parseInt(localStorage.getItem('rally_stage')) || 1;
let startPlan = null; // Zde bude uložen naplánovaný start jednoho jezdce
let pendingFinishIndex = null;
//let timeOffset = 0; 
let timeOffset = parseInt(localStorage.getItem('rally_time_offset')) || 0;

let lastFinishTime = 0;
const FINISH_DEBOUNCE_MS = 2000;
let currentRaceId =
  window.APP?.raceId ||
  localStorage.getItem('rally_race_id') ||
  "";



/*********************************
 * 2. POMOCNÉ FUNKCE (Formátování a výpočty)
 *********************************/

// Převede milisekundy na čitelný čas HH:MM:SS.ss
function formatTime(ms) {
    const d = new Date(ms);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    const msPart = String(Math.floor((d.getMilliseconds() / 10))).padStart(2, '0');
    return `${h}:${m}:${s}.${msPart}`;
}

// Vypočítá nejbližší volný startovní čas (např. nejbližší celou minutu)
function getNextAllowedStartTime(now, intervalSec) {
    const intervalMs = intervalSec * 1000;
    return Math.ceil(now / intervalMs) * intervalMs;
}

function updateRole(newRole) {
    localStorage.setItem('rally_role', newRole);
}


function saveRaceId() {
    const input = document.getElementById('race-id-input').value.trim();
    
    if (input.length !== 5 || isNaN(input)) {
        alert("ID závodu musí být přesně 5 číslic.");
        return;
    }
    
    currentRaceId = input;
    localStorage.setItem('rally_race_id', input);
    document.getElementById('race-id-status').textContent = "✅ Uloženo: " + input;
    document.getElementById('race-id-status').style.color = "#0f0";
}

function loadRaceId() {
    const saved = localStorage.getItem('rally_race_id');
    if (saved) {
        currentRaceId = saved;
        document.getElementById('race-id-input').value = saved;
        document.getElementById('race-id-status').textContent = "✅ Aktivní: " + saved;
        document.getElementById('race-id-status').style.color = "#0f0";
    }
}


// Při startu aplikace musíme nastavit správnou hodnotu v selectu
document.addEventListener("DOMContentLoaded", () => {
    const savedRole = localStorage.getItem('rally_role');
    if (savedRole) {
        document.getElementById('device-role-select').value = savedRole;
    }
});

/*********************************
 * 3. HODINY A AUTOMATIKY
 *********************************/

function getCentralTime() {
  return Date.now() + timeOffset;
}

function updateClock() {
    const now = Date.now() + timeOffset;
    // Aktualizace velkého času na displeji
    const clockEl = document.getElementById('central-clock');
    if (clockEl) clockEl.textContent = formatTime(now).split('.')[0];
    
    // Každý tik hodin kontrolujeme, jestli nemá někdo odstartovat
    checkAutoStart(now);
}
setInterval(updateClock, 100); // Běží 10x za sekundu

// Korekce času
function adjustOffset(ms) {
    timeOffset += ms;
    localStorage.setItem('rally_time_offset', timeOffset);
    updateOffsetDisplay();
    // Tip: Nemusíš restartovat hodiny, updateClock si nový offset 
    // vezme automaticky při dalším tiknutí (za 100ms)
}

function updateOffsetDisplay() {
    const el = document.getElementById('current-offset-display');
    if (el) {
        const seconds = (timeOffset / 1000).toFixed(1);
        el.textContent = (timeOffset > 0 ? "+" : "") + seconds + "s";
    }
}



/*********************************
 * 4. LOGIKA STARTU (Inteligentní start)
 *********************************/


// Tato funkce aktualizuje to velké zelené číslo na displeji
function updateBigRiderDisplay(val) {
    const el = document.getElementById('active-rider-display');
    if (el) {
        el.textContent = val && val.length > 0 ? val : "--";
    }
}

function onRiderNumberChange() {
    const riderNum = document.getElementById('riderNumber').value;
    const interval = parseInt(document.getElementById('startInterval').value) || 60;

    // AKTUALIZACE: Přidáme zobrazení velkého čísla
    updateBigRiderDisplay(riderNum);

    if (riderNum.length > 0) {
        const now = Date.now() + timeOffset;
        const nextStart = getNextAllowedStartTime(now, interval);

        startPlan = {
            nextTime: nextStart,
            intervalMs: interval * 1000,
            rider: riderNum,
            active: true,
            triggered: false
        };
    } else {
        cancelStart();
    }
}

function checkAutoStart(now) {
    if (!startPlan || !startPlan.active) return;

    const diff = startPlan.nextTime - now;
    const countdownEl = document.getElementById('countdown');
    const displayBox = countdownEl.parentElement; // Kontejner, kde je odpočet

    // 1. Fáze: Odpočet (posledních 10 sekund)
    if (diff <= 10000 && diff > 0) {
        const seconds = Math.ceil(diff / 1000);
        countdownEl.textContent = seconds;
        
        // --- NOVINKA: Barevné varování ---
        if (seconds <= 5) {
            displayBox.style.backgroundColor = "#660000"; // Tmavě červená při 5s a méně
            countdownEl.style.color = "white";
        } else {
            displayBox.style.backgroundColor = "#222"; // Normální pozadí
            countdownEl.style.color = "yellow";
        }
        // ---------------------------------
        
        countdownEl.classList.remove('go');
    } 
    // 2. Fáze: OKAMŽIK STARTU
    else if (diff <= 0 && diff > -1500) {
        if (!startPlan.triggered) {
            recordEvent("START", startPlan.rider, startPlan.nextTime);
            startPlan.triggered = true;
            countdownEl.textContent = "GO!";
            countdownEl.classList.add('go');
            displayBox.style.backgroundColor = "#004400"; // Zelená při startu
        }
    } 
    // 3. Fáze: Úklid
    else if (diff <= -1500) {
        displayBox.style.backgroundColor = "#222"; // Návrat do normálu
        clearNum('riderNumber');
    }
}

// Upravíme i cancelStart, aby velké číslo zmizelo
function cancelStart() {
    startPlan = null;
    updateBigRiderDisplay(""); // Vyčistí velké číslo
    const el = document.getElementById('countdown');
    if (el) {
        el.textContent = "--";
        el.classList.remove('go');
    }
}






/*********************************
 * 5. LOGIKA CÍLE
 *********************************/

//buffer 3 posledních logů v Cíl

let recentFinishes = [];

function pushRecentFinish(log) {
  recentFinishes.unshift(log);
  if (recentFinishes.length > 3) recentFinishes.pop();
  renderRecentFinishes();
}

function setPenaltyFromFinish(index, value) {
  const log = recentFinishes[index];
  if (!log) return;

  log.penalty = value;

  updateLogPenalty(log.id, value);
  renderRecentFinishes();
}

function renderRecentFinishes() {
  const container = document.getElementById("recent-finishes");
  if (!container) return;

  container.innerHTML = "";

  recentFinishes.forEach((log, index) => {
    const div = document.createElement("div");

    div.style.cssText = `
      background:#222;
      padding:10px;
      margin-bottom:8px;
      border:1px solid #444;
      border-radius:6px;
    `;

    div.innerHTML = `
      <div>
        <strong>#${log.rider}</strong>
        <span style="color:#888;">${formatTime(log.time)}</span>
      </div>

      <div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">
        <button onclick="setPenaltyFromFinish(${index}, 'A')">+A</button>
        <button onclick="setPenaltyFromFinish(${index}, 'B')">+B</button>
        <button onclick="setPenaltyFromFinish(${index}, 'C')">+C</button>
        <button onclick="setPenaltyFromFinish(${index}, 'DNF')" style="color:#f55;">DNF</button>
        <button onclick="setPenaltyFromFinish(${index}, '')">OK</button>
      </div>
    `;

    container.appendChild(div);
  });
}

async function updateLogPenalty(logId, penalty) {
  const { error } = await supabaseClient
    .from("rally_logs")
    .update({ penalty })
    .eq("event_id", logId);

  if (error) {
    console.error(error);
    alert("Chyba při aktualizaci penalizace");
  }
}

 

  recentFinishes.forEach((log, index) => {
    const div = document.createElement("div");

    div.style.cssText = `
      background:#222;
      padding:10px;
      margin-bottom:8px;
      border:1px solid #444;
      border-radius:6px;
    `;

    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong>#${log.rider}</strong>
          <span style="color:#888;">${log.time_ms}</span>
        </div>
      </div>

      <div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">
        
        <button onclick="setPenaltyFromFinish(${index}, 'A')">+A</button>
        <button onclick="setPenaltyFromFinish(${index}, 'B')">+B</button>
        <button onclick="setPenaltyFromFinish(${index}, 'C')">+C</button>
        <button onclick="setPenaltyFromFinish(${index}, 'DNF')" style="color:#f55;">DNF</button>
        <button onclick="setPenaltyFromFinish(${index}, '')">OK</button>

      </div>
    `;

    container.appendChild(div);
  });


// Tlačítko CÍL - zaznamená čas okamžitě
document.getElementById('finishBtn').onclick = function() {
    const now = Date.now() + timeOffset;
    const index = recordEvent("FINISH", "?", now);
    pushRecentFinish(events[events.length - 1]);
    pendingFinishIndex = index;
    
    // Otevřít okno pro zadání čísla
    document.getElementById('finishModal').classList.remove('hidden');
    document.getElementById('finishRiderInput').value = "";
};

function confirmFinishRider() {
    const riderNum = document.getElementById('finishRiderInput').value;
    if (riderNum && pendingFinishIndex !== null) {
        events[pendingFinishIndex].rider = riderNum;
        
        
        saveAndRender();
        
        // Reset a zavření
        document.getElementById('finishModal').classList.add('hidden');
        pendingFinishIndex = null;
        
    }
}

/*********************************
 * 6. DATA, UKLÁDÁNÍ A UI
 *********************************/

function recordEvent(type, rider, time) {
    const event = {
        id: crypto.randomUUID(),   // 🆕 unikátní ID
        stage: currentStage,
        type: type,
        rider: rider,
        time: time
    };

    events.push(event);
    saveAndRender();
    return events.length - 1;
}

function saveAndRender() {
    localStorage.setItem('rally_events', JSON.stringify(events));
    localStorage.setItem('rally_stage', currentStage);
    renderLog();
}

function renderLog() {
    const logEl = document.getElementById('log');
    if (!logEl) return;
    
    logEl.innerHTML = "";
    const reversedEvents = [...events].reverse();
    const originalLength = events.length;

    let lastStageSeen = null;

    reversedEvents.forEach((e, index) => {
        const actualIndex = originalLength - 1 - index;

        // Pokud se změní číslo RZ, vložíme do logu dělící čáru
        if (lastStageSeen !== null && e.stage !== lastStageSeen) {
            const separator = document.createElement("div");
            separator.style.cssText = "background: #444; color: #fff; text-align: center; font-size: 0.7rem; margin: 10px 0; padding: 2px;";
            separator.textContent = `--- KONEC RZ ${e.stage + 1} ---`;
            logEl.appendChild(separator);
        }
        lastStageSeen = e.stage;
        
        const div = document.createElement("div");
        div.style.cssText = "border-bottom: 1px solid #333; padding: 10px 0; display: flex; justify-content: space-between; align-items: center;";

        div.innerHTML = `
    <div onclick="editEventRider(${actualIndex})" style="cursor:pointer">
        <span style="color:#888; font-size:0.8rem;">${currentRaceId || "---"}</span> | 
        <span style="color: #0f0; opacity: 0.7;">RZ${e.stage}</span> | 
        <strong>${e.type}</strong> | 
        <span style="color:yellow; font-weight:bold;">#${e.rider}</span> | 
        ${formatTime(e.time)} ${e.penalty ? " | ⚠ " + e.penalty : ""}
    </div>
    <button onclick="deleteEvent(${actualIndex})" style="background:none; border:1px solid #600; color:#f00; padding:2px 8px; font-size:0.8rem; border-radius: 4px;">SMAZAT</button>
`;
        logEl.appendChild(div);
    });
}

// Mazání starých logů
function confirmClearData() {
    const btn = document.getElementById('clear-data-btn');
    if (btn.textContent === "SMAZAT VŠECHNY LOGY") {
        btn.textContent = "OPRAVDU SMAZAT? (KLIKNI ZNOVU)";
        btn.style.background = "#ff0000";
        // Po 3 sekundách se tlačítko vrátí do původního stavu, pokud na něj neklikne
        setTimeout(() => {
            btn.textContent = "SMAZAT VŠECHNY LOGY";
            btn.style.background = "#440000";
        }, 3000);
    } else {
        // Druhé kliknutí - provedeme smazání
        events = [];
        localStorage.removeItem('rally_events');
        saveAndRender();
        btn.textContent = "DATA SMAZÁNA!";
        btn.style.background = "#006600";
        setTimeout(() => {
            btn.textContent = "SMAZAT VŠECHNY LOGY";
            btn.style.background = "#440000";
        }, 2000);
    }
}

// Funkce pro opravu čísla jezdce
function editEventRider(index) {
    const event = events[index];

    // 1️⃣ číslo jezdce
    const newRider = prompt("Číslo jezdce:", event.rider);
    if (newRider === null) return;

    // 2️⃣ penalizace
    const newPenalty = prompt("Penalizace (např. +10, DNF, prázdné = bez):", event.penalty || "");

    // uložit
    event.rider = newRider;
    event.penalty = newPenalty || "";

    saveAndRender();
}

// Funkce pro smazání řádku
function deleteEvent(index) {
    if (confirm("Opravdu smazat tento záznam?")) {
        events.splice(index, 1); // Odstraní 1 prvek na dané pozici
        saveAndRender();
    }
}

// Funkce pro virtuální klávesnici
function pressNum(num, targetId = 'riderNumber') {
    const input = document.getElementById(targetId);
    input.value += num;
    
    // Pokud píšeme do startovního pole, musíme přepočítat odpočet
    if (targetId === 'riderNumber') {
        onRiderNumberChange();
    }
}

function clearNum(targetId = 'riderNumber') {
    document.getElementById(targetId).value = "";
    if (targetId === 'riderNumber') {
        cancelStart();
    }
}

// Navigace mezi obrazovkami
function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById('view-' + id);
    if (target) target.classList.add('active');
}

// Změna čísla RZ
function changeStage(delta) {
    currentStage = Math.max(1, currentStage + delta);
    document.getElementById('current-stage-num').textContent = currentStage;
    document.getElementById('setup-stage-num').textContent = currentStage;
    localStorage.setItem('rally_stage', currentStage);
}


//EXPORT CSV 
function downloadCSV() {
    const role = (localStorage.getItem('rally_role') || 'X').toUpperCase();
    const now = new Date();
    const timeStamp = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
    const fileName = `RZ${currentStage}_${role}_${timeStamp}.csv`;

    let csv = "ID_zavodu;Cislo_RZ;Funkce;Cislo_jezdce;Cas;Timestamp\n";
    events.forEach(e => {
        csv += `${currentRaceId || "00000"};${e.stage};${e.type};${e.rider};${formatTime(e.time)};${e.time}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
    alert(`Soubor uložen jako: ${fileName}`);
}


function clearAllData() {
    if(confirm("Opravdu smazat všechna data?")) {
        events = [];
        localStorage.removeItem('rally_events');
        saveAndRender();
    }
}




let port;
let reader;

async function connectArduino() {
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });

    console.log("Arduino připojeno");

    reader = port.readable.getReader();
    readSerialLoop();

  } catch (err) {
    console.error("Chyba připojení:", err);
  }
}


//WEB serial API

async function readSerialLoop() {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value);

    let lines = buffer.split("\n");
    buffer = lines.pop();

    for (let line of lines) {
      handleSerialMessage(line.trim());
    }
  }
}


// ===== MODAL =====
function openFinishModal() {
  document.getElementById('finishModal').classList.remove('hidden');
  document.getElementById('finishRiderInput').value = "";
}





// ===== FINISH Z ARDUINA =====
function handleFinishFromArduino(rider = "") {
  const now = getCentralTime();

  if (now - lastFinishTime < FINISH_DEBOUNCE_MS) return;
  lastFinishTime = now;

  const event = {
    id: crypto.randomUUID(),
    rider: rider || "",
    stage: currentStage,
    type: "FINISH",
    time: now
  };

  events.push(event);
  pendingFinishIndex = events.length - 1;

  saveAndRender();

  // 👇 TOTO JE KLÍČOVÉ
  pushRecentFinish(event);

  if (!rider) {
    openFinishModal();
  }
}



// ===== START Z ARDUINA (RFID) =====
function handleStartFromArduino(chipId) {
  const event = {
    rider: chipId || "",
    stage: currentStage,
    type: "START",
    time: getCentralTime(),
    valid: true
  };

  events.push(event);

  saveAndRender();

  console.log("START přes RFID:", chipId);

  // vyčištění UI
  clearNum('riderNumber');
  cancelStart();
}

function handleRFID(chipId) {
  console.log("RFID chip:", chipId);

  // 1. máme čekající FINISH → přiřaď
  if (pendingFinishIndex !== null) {
    events[pendingFinishIndex].rider = mapChipToRider(chipId);
    pendingFinishIndex = null;

    saveAndRender();
    document.getElementById('finishModal').classList.add('hidden');

    console.log("RFID přiřazeno k FINISH");
    return;
  }

  // 2. jinak IGNORUJ (zatím)
  console.log("RFID ignorováno (žádný čekající FINISH)");
}



//ZPRACOVANI DAT Z ARDUINA ---------------------------------------------------------
function handleSerialMessage(msg) {
  msg = msg.replace(/[^\x20-\x7E]/g, "");

  console.log("Arduino:", msg);

  if (msg.startsWith("FINISH")) {
    const parts = msg.split(";");
    const rider = parts[1] || "";
    handleFinishFromArduino(rider);
    pushRecentFinish(event);
  }

  if (msg.startsWith("START")) {
  const parts = msg.split(";");
  const chipId = parts[1];

  console.log("MSG RAW:", msg);

  handleStartFromArduino(chipId);
}



  // 🆕 RFID
  if (msg.startsWith("RFID")) {
    const parts = msg.split(";");
    const chipId = parts[1];

    handleRFID(chipId);
  }
}


//číslo Rfid chipu 
function mapChipToRider(chipId) {
  const map = {
    "123456AB": "12",
    "987654CD": "45"
  };

  return map[chipId] || chipId; // fallback = zobraz ID chipu
}

//ZPRACOVANI DAT ARDUINO 


async function uploadLogsToFirebase() {
  const btn = document.getElementById('upload-logs-btn');
  const role = (localStorage.getItem('rally_role') || 'unknown').toUpperCase();

  if (events.length === 0) {
    alert("Žádné logy k odeslání.");
    return;
  }

  btn.textContent = "Odesílám...";
  btn.disabled = true;

  try {
    // Připrav řádky pro Supabase - každý event = jeden řádek
const rows = events.map(e => ({
    event_id: e.id,   // 🆕 důležité
    race_id: currentRaceId || "00000",
    stage: e.stage,
    type: e.type,
    rider: e.rider || "",
    cas: formatTime(e.time),
    time_ms: e.time,
    role: role,
    penalty: e.penalty || "",
    uploaded_at: new Date().toISOString()
}));

const { error } = await supabaseClient
  .from("rally_logs")
  .upsert(rows, { onConflict: "event_id" });

if (error) throw error;

    btn.textContent = "✅ Odesláno (" + rows.length + " logů)";
    btn.style.background = "#004400";
    console.log("Odesláno " + rows.length + " logů do Supabase.");

  } catch (err) {
    console.error("Chyba při odesílání:", err);
    btn.textContent = "❌ Chyba!";
    btn.style.background = "#440000";
    alert("Chyba: " + err.message);
  }

  setTimeout(() => {
    btn.textContent = "📤 Odeslat logy do Supabase";
    btn.style.background = "#003366";
    btn.disabled = false;
  }, 3000);
}

//NAPOJENÍ TLACITKA ARDUINO 
document
  .getElementById("connectArduino")
  .addEventListener("click", connectArduino);


// Nezapomeň zavolat updateOffsetDisplay() při inicializaci stránky!
updateOffsetDisplay();

// Inicializace při spuštění
document.getElementById('current-stage-num').textContent = currentStage;
renderLog();

loadRaceId();