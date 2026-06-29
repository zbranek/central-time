/**
 * Rally Calculator - Stage Results Logic
 * Handles penalty parsing and stage result calculations
 */

/**
 * Parse penalty code and return time + DNF status
 * @param {string} code - Penalty code (e.g., "DNF", "+10S", "1M")
 * @returns {object} {time: number in ms, dnf: boolean}
 */
function parsePenalty(code) {
  if (!code) return { time: 0, dnf: false };

  code = code.trim().toUpperCase();

  // DNF
  if (code === "DNF") {
    return { time: 0, dnf: true };
  }

  // Remove "+"
  if (code.startsWith("+")) {
    code = code.substring(1);
  }

  // Seconds (default)
  if (!isNaN(code)) {
    return { time: parseInt(code) * 1000, dnf: false };
  }

  // "10S" format
  if (code.endsWith("S")) {
    return { time: parseInt(code) * 1000, dnf: false };
  }

  // "1M" format
  if (code.endsWith("M")) {
    return { time: parseInt(code) * 60000, dnf: false };
  }

  return { time: 0, dnf: false };
}

/**
 * Calculate stage results from rally logs
 * Processes START/FINISH events, applies penalties, sorts results
 * @param {array} logs - Array of rally log entries from Supabase
 * @returns {array} finalResults - Sorted array of result objects with position and gap
 */
function calculateStageResults(logs) {
  if (!logs || logs.length === 0) {
    return [];
  }

  // Build map of rider times and penalties from logs
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

  // Convert to results array
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

  // Sort: classified by time, then DNF
  const classified = results
    .filter(r => !r.dnf)
    .sort((a, b) => a.time - b.time);

  const dnf = results.filter(r => r.dnf);

  // Add position and gap
  classified.forEach((r, i) => {
    r.position = i + 1;
    r.gap = i === 0 ? 0 : r.time - classified[0].time;
  });

  // Final sorted results
  const finalResults = [...classified, ...dnf];

  return finalResults;
}

/**
 * Calculate overall results across multiple stages
 * Accumulates times and penalties across all stages up to maxStage
 * Propagates DNF status from any stage to overall classification
 * 
 * Algorithm:
 * 1. Group logs by individual stage (1 to maxStage)
 * 2. Calculate stage results for each stage
 * 3. Accumulate total times across all stages for each rider
 * 4. Accumulate penalties across all stages
 * 5. Propagate DNF status (DNF in any stage = DNF overall)
 * 6. Sort competitors by total accumulated time
 * 7. Calculate positions and gaps to leader
 * 
 * @param {array} logs - Array of rally log entries from Supabase (all stages mixed)
 * @param {number} maxStage - Maximum stage number to include in overall calculation
 * @returns {array} finalResults - Sorted array of overall result objects with position and gap
 */
function calculateOverallResults(logs, maxStage) {
  if (!logs || logs.length === 0) {
    return [];
  }

  // Step 1 & 2: Group logs by stage and calculate results per stage
  const stageResultsMap = {};
  for (let s = 1; s <= maxStage; s++) {
    const stageLogs = logs.filter(log => log.stage === s);
    if (stageLogs.length > 0) {
      stageResultsMap[s] = calculateStageResults(stageLogs);
    }
  }

  // Step 3, 4, 5: Accumulate times and penalties across all stages
  // Propagate DNF status from any stage
  const overallMap = {};

  Object.keys(stageResultsMap).forEach(stageNum => {
    const stageResults = stageResultsMap[stageNum];
    stageResults.forEach(result => {
      const riderId = result.rider;

      if (!overallMap[riderId]) {
        overallMap[riderId] = {
          rider: riderId,
          totalTime: 0,
          totalPenalty: 0,
          dnf: false,
          stageCount: 0
        };
      }

      if (result.dnf) {
        // DNF in any stage = DNF overall
        overallMap[riderId].dnf = true;
      } else {
        // Accumulate time and penalty from this stage
        overallMap[riderId].totalTime += result.time;
        overallMap[riderId].totalPenalty += result.penalty || 0;
        overallMap[riderId].stageCount++;
      }
    });
  });

  // Step 6 & 7: Sort by total time and assign positions/gaps
  const classified = Object.values(overallMap)
    .filter(r => !r.dnf)
    .sort((a, b) => a.totalTime - b.totalTime);

  const dnfRiders = Object.values(overallMap).filter(r => r.dnf);

  // Assign positions and gaps based on total time
  classified.forEach((r, i) => {
    r.position = i + 1;
    r.time = r.totalTime;        // Use accumulated time as main time
    r.penalty = r.totalPenalty;  // Use accumulated penalty
    r.gap = i === 0 ? 0 : r.totalTime - classified[0].totalTime;
  });

  // Format DNF riders to match result object structure
  dnfRiders.forEach(r => {
    r.dnf = true;
    r.time = r.totalTime;
    r.penalty = r.totalPenalty;
  });

  // Combine classified + DNF riders
  const finalResults = [...classified, ...dnfRiders];

  return finalResults;
}
