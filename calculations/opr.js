async function teleopOPRS(eventKey, apiKey) {
  const res = await fetch(`https://www.thebluealliance.com/api/v3/event/${eventKey}/matches`, {
    headers: {
      "X-TBA-Auth-Key": apiKey
    }
  });

  const data = await res.json();
  const matches = [];

  // 1. Create a lookup map for your HP data to make subtraction efficient
  // Key format: "matchNumber-allianceColor" (e.g., "1-Red")
  let hpLookup = {};
  allHPData.forEach(entry => {
    const key = `${entry["Match Number"]}-${entry.Alliance}`;
    hpLookup[key] = entry.Scores;
  });

  data.forEach(match => {
    if (!match.alliances) return;

    // TBA match numbers are usually found in match.match_number
    const matchNum = match.match_number;
    const reda = match.alliances.red;
    const bluea = match.alliances.blue;
    const redscores = match.score_breakdown.red;
    const bluescores = match.score_breakdown.blue;

    if (reda.score !== -1) {
      // 2. Subtract Red HP score if it exists in your data
      const redHP = hpLookup[`${matchNum}-Red`] || 0;
      matches.push({
        teams: reda.team_keys,
        score: redscores.hubScore.teleopCount - redHP 
      });
    }

    if (bluea.score !== -1) {
      // 3. Subtract Blue HP score if it exists in your data
      const blueHP = hpLookup[`${matchNum}-Blue`] || 0;
      matches.push({
        teams: bluea.team_keys,
        score: bluescores.hubScore.teleopCount - blueHP
      });
    }
  });

  // ... rest of your OPR math logic remains the same ...
  const teams = [...new Set(matches.flatMap(m => m.teams))];
  const teamIndex = Object.fromEntries(teams.map((team, i) => [team, i]));

  const A = matches.map(match => {
    const row = new Array(teams.length).fill(0);
    match.teams.forEach(team => {
      row[teamIndex[team]] = 1;
    });
    return row;
  });

  const b = matches.map(match => match.score);
  const x = math.multiply(math.pinv(A), b);

  const teamScores = {};
  teams.forEach((team, i) => {
    teamScores[team] = x[i];
  });

  console.log("Adjusted OPR (minus HP scores):", teamScores);
  return teamScores;
}

async function autoOPRS(eventKey, apiKey) {
  const res = await fetch(`https://www.thebluealliance.com/api/v3/event/${eventKey}/coprs`, {
    headers: {
      "X-TBA-Auth-Key": apiKey
    }
  });

  const data = await res.json();

  return data.totalAutoPoints;
}
