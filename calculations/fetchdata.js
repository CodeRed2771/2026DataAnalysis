let allMatches;
let allHPData;
let allPitData;

let autORPS;
let teleOPRS;

let teamData = {};

async function pullAllData(eventkey) {
  const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyM8ljOtcp3JjrknMPxd8OnTcHyyeFyLLQQtehJA7h1J24a9bNTKj4HHUMuQ5uVWvX4/exec";

  try {
    const response = await fetch(WEB_APP_URL);
    const data = await response.json();

    // Pulling them into their own arrays
    allMatches = data.matchData;
    allHPData = data.hpData;
    allPitData = data.pitData;
    console.log(allPitData)
    console.log(allMatches)

    teleOPRS = await teleopOPRS(eventkey, "3rTF5gxmIdJSYKqhKohNTzEKl7D9x04ivAFGYzOumRgHdqIA6acFssENXYNkfCK7");
    autOPRS = await autoOPRS(eventkey, "3rTF5gxmIdJSYKqhKohNTzEKl7D9x04ivAFGYzOumRgHdqIA6acFssENXYNkfCK7")

    
    const analyzer = new TeamAnalyzer(allMatches, autOPRS, teleOPRS);

    // 1. Get an array of all unique team numbers from the match data
    const uniqueTeams = [...new Set(allMatches.map(match => match['Team #']))];

    // 2. Loop through each team and populate the teamData object
    uniqueTeams.forEach(teamNum => {
      teamData[teamNum] = {
        avgTeleopCycles: analyzer.getAverageTeleopCycles(teamNum),
        avgTeleopCycleTime: analyzer.getAverageTeleopCycleTime(teamNum),
        favoriteClimb: analyzer.getFavoriteClimb(teamNum),
        climbSuccessRates: analyzer.getClimbSuccessRates(teamNum),
        fuelPerCycle: analyzer.getAverageFuelPerCycle(teamNum),
        avgClimbTime: analyzer.getAverageClimbTime(teamNum),
        avgShootingTime: analyzer.getAverageTimeSpentShooting(teamNum),
        avgFireRate: analyzer.getAverageFireRate(teamNum),
        defenseFrequency: analyzer.getDefenseRate(teamNum),
        avgDefenseScore: analyzer.getAverageDefenseScore(teamNum),
        teleopOPR: teleOPRS[`frc${teamNum}`],
        autoOPR: autOPRS[`frc${teamNum}`]
      };
    });

    // View the final compiled object
    console.log(teamData);

    renderTable();
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

pullAllData("2026cahal");