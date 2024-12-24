import client from "./redis";

export function getLeaderboardKey(contestId: string): string {
  return `leaderboard:${contestId}`;
}

export async function getLeaderboard(contestId: string) {
  try {
    const leaderboard = await client.zRangeWithScores(
      getLeaderboardKey(contestId),
      0,
      -1,
      {
        REV: true,
      },
    );

    return leaderboard.map((entry) => ({
      player: entry.value,
      score: entry.score,
    }));
  } catch (error) {
    console.error("Error retrieving leaderboard:", error);
    return [];
  }
}
