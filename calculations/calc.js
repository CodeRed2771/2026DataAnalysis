class TeamAnalyzer {
  constructor(matchData, autOPRs, teleOPRs) {
    this.matchData = matchData;
    this.autOPRs = autOPRs;
    this.teleOPRs = teleOPRs;
  }

  /**
   * Helper Function: Parses a comma-separated string of times into an array of numbers.
   * If the field has bad data (like the date strings in Auto Starts), it ignores NaN values.
   */
  parseTimes(timeString) {
    if (!timeString) return [];
    return timeString
      .toString()
      .split(',')
      .map(s => parseFloat(s.trim()))
      .filter(n => !isNaN(n));
  }

  /**
   * Helper Function: Get matches for a specific team.
   */
  getTeamMatches(teamNum) {
    return this.matchData.filter(match => match['Team #'] === teamNum);
  }

  /**
   * 1. Average # of cycles made by each team IN TELEOP over all their matches
   */
  getAverageTeleopCycles(teamNum) {
    const matches = this.getTeamMatches(teamNum);
    if (!matches.length) return 0;

    const totalCycles = matches.reduce((acc, match) => {
      return acc + this.parseTimes(match['Tele Starts']).length;
    }, 0);

    return totalCycles / matches.length;
  }

  /**
   * 2. Calculate the average cycle time for each team in TELEOP 
   * (time from start to next start, averaged, beginning from the first start)
   */
  getAverageTeleopCycleTime(teamNum) {
    const matches = this.getTeamMatches(teamNum);
    let totalTime = 0;
    let cycleCount = 0;

    matches.forEach(match => {
      const starts = this.parseTimes(match['Tele Starts']);
      // We need at least 2 starts to measure time from one start to the next
      for (let i = 0; i < starts.length - 1; i++) {
        totalTime += (starts[i + 1] - starts[i]);
        cycleCount++;
      }
    });

    return cycleCount === 0 ? 0 : totalTime / cycleCount;
  }

  /**
   * 3. Each team's favorite climb location USING BOTH AUTO AND TELEOP DATA
   * Returns the most frequent combination of location and level.
   */
  getFavoriteClimb(teamNum) {
    const matches = this.getTeamMatches(teamNum);
    const counts = { autoLoc: {}, teleLoc: {}, teleLevel: {} };

    matches.forEach(match => {
      if (match['Auto Climb Loc']) {
        counts.autoLoc[match['Auto Climb Loc']] = (counts.autoLoc[match['Auto Climb Loc']] || 0) + 1;
      }
      if (match['Tele Climb Loc']) {
        counts.teleLoc[match['Tele Climb Loc']] = (counts.teleLoc[match['Tele Climb Loc']] || 0) + 1;
      }
      if (match['Tele Level']) {
        counts.teleLevel[match['Tele Level']] = (counts.teleLevel[match['Tele Level']] || 0) + 1;
      }
    });

    const getMostFrequent = (obj) => Object.keys(obj).sort((a, b) => obj[b] - obj[a])[0] || "None";

    return {
      autoLocation: getMostFrequent(counts.autoLoc),
      teleLocation: getMostFrequent(counts.teleLoc),
      teleLevel: getMostFrequent(counts.teleLevel)
    };
  }

  /**
   * 4. Success rate of the climb for each team IN BOTH AUTO AND TELEOP
   */
  getClimbSuccessRates(teamNum) {
    const matches = this.getTeamMatches(teamNum);
    let autoSuccess = 0, autoAttempts = 0;
    let teleSuccess = 0, teleAttempts = 0;

    matches.forEach(match => {
      // Auto
      if (match['Auto Climb Start']) {
        autoAttempts++;
        if (match['Auto Climb Success'] === 'Yes') autoSuccess++;
      }
      // Teleop
      if (match['Tele Climb Start']) {
        teleAttempts++;
        if (match['Tele Success'] === 'Yes') teleSuccess++;
      }
    });

    return {
      autoSuccessRate: autoAttempts ? autoSuccess / autoAttempts : 0,
      teleSuccessRate: teleAttempts ? teleSuccess / teleAttempts : 0
    };
  }

  /**
   * 5. How many fuel they score on average per cycle in both auto and tele (from OPR measurement)
   */
  getAverageFuelPerCycle(teamNum) {
    const teamKey = `frc${teamNum}`;
    const autoOPR = this.autOPRs[teamKey] || 0;
    const teleOPR = this.teleOPRs[teamKey] || 0;
    const matches = this.getTeamMatches(teamNum);

    if (!matches.length) return { autoFuelPerCycle: 0, teleFuelPerCycle: 0 };

    let totalAutoCycles = 0;
    let totalTeleCycles = 0;

    matches.forEach(match => {
      totalAutoCycles += this.parseTimes(match['Auto Starts']).length;
      totalTeleCycles += this.parseTimes(match['Tele Starts']).length;
    });

    const avgAutoCyclesPerMatch = totalAutoCycles / matches.length;
    const avgTeleCyclesPerMatch = totalTeleCycles / matches.length;

    return {
      autoFuelPerCycle: avgAutoCyclesPerMatch ? autoOPR / avgAutoCyclesPerMatch : 0,
      teleFuelPerCycle: avgTeleCyclesPerMatch ? teleOPR / avgTeleCyclesPerMatch : 0
    };
  }

  /**
   * 6. How long it takes a team to climb on average (Auto and Teleop combined)
   * Only calculates duration for SUCCESSFUL climbs.
   */
  getAverageClimbTime(teamNum) {
    const matches = this.getTeamMatches(teamNum);
    let totalTime = 0, count = 0;

    matches.forEach(match => {
      if (match['Auto Climb Success'] === 'Yes' && match['Auto Climb Start'] && match['Auto Climb Success Time']) {
        totalTime += (match['Auto Climb Success Time'] - match['Auto Climb Start']);
        count++;
      }
      if (match['Tele Success'] === 'Yes' && match['Tele Climb Start'] && match['Tele Success Time']) {
        totalTime += (match['Tele Success Time'] - match['Tele Climb Start']);
        count++;
      }
    });

    return count ? totalTime / count : 0;
  }

  /**
   * 7. Average time spent shooting (Average duration of a single shoot cycle)
   */
  getAverageTimeSpentShooting(teamNum) {
    const matches = this.getTeamMatches(teamNum);
    let totalShootingTime = 0;
    let cycleCount = 0;

    matches.forEach(match => {
      ['Auto', 'Tele'].forEach(phase => {
        const starts = this.parseTimes(match[`${phase} Starts`]);
        const stops = this.parseTimes(match[`${phase} Stops`]);
        
        // Match up start and stop events
        const iterations = Math.min(starts.length, stops.length);
        for (let i = 0; i < iterations; i++) {
          totalShootingTime += Math.max(0, stops[i] - starts[i]);
          cycleCount++;
        }
      });
    });

    return cycleCount ? totalShootingTime / cycleCount : 0;
  }

  /**
   * 8. Average fire rate using time spent shooting and fuel per cycle (Fuel per second)
   * Calculation: Overall expected fuel per match / overall time spent shooting per match
   */
  getAverageFireRate(teamNum) {
    const teamKey = `frc${teamNum}`;
    const totalOPR = (this.autOPRs[teamKey] || 0) + (this.teleOPRs[teamKey] || 0);
    const matches = this.getTeamMatches(teamNum);

    if (!matches.length) return 0;

    let totalShootingTimeAllMatches = 0;

    matches.forEach(match => {
      ['Auto', 'Tele'].forEach(phase => {
        const starts = this.parseTimes(match[`${phase} Starts`]);
        const stops = this.parseTimes(match[`${phase} Stops`]);
        
        for (let i = 0; i < Math.min(starts.length, stops.length); i++) {
          totalShootingTimeAllMatches += Math.max(0, stops[i] - starts[i]);
        }
      });
    });

    const avgShootingTimePerMatch = totalShootingTimeAllMatches / matches.length;

    // Fire rate = Expected Fuel in Match / Expected time spent shooting in match
    return avgShootingTimePerMatch ? totalOPR / avgShootingTimePerMatch : 0;
  }

  /**
   * 9. Rate of defense playing (decimal, 0 is never, 0.5 is half matches, 1 is all matches)
   */
  getDefenseRate(teamNum) {
    const matches = this.getTeamMatches(teamNum);
    if (!matches.length) return 0;

    const defensiveMatches = matches.filter(match => match['Defense Played'] === 'Yes').length;
    return defensiveMatches / matches.length;
  }

  /**
   * 10. Average defense score
   * Averages the "Defense Rating" specifically across matches where defense WAS played.
   */
  getAverageDefenseScore(teamNum) {
    const matches = this.getTeamMatches(teamNum);
    
    const defensiveMatches = matches.filter(match => 
      match['Defense Played'] === 'Yes' && typeof match['Defense Rating'] === 'number'
    );
    
    if (!defensiveMatches.length) return 0;

    const totalScore = defensiveMatches.reduce((acc, match) => acc + match['Defense Rating'], 0);
    return totalScore / defensiveMatches.length;
  }
}