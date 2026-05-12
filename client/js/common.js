
const raceId = getRaceId();

function getRaceId() {
  return localStorage.getItem("rally_race_id") || "";
}

function saveRaceId(id) {
  localStorage.setItem("rally_race_id", id);
}