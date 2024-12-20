import { PublicKey } from "@solana/web3.js";
import { BorshCoder, EventParser } from "@coral-xyz/anchor";
import client from "./redis";
import { getLeaderboardKey } from "./leaderboard";
import { BN, type Idl } from "@project-serum/anchor";
export type EventParseOptions = {
  logs: string[];
};

type EventLevelCrossed = {
  contest_id: BN;
  player: PublicKey;
  score: BN;
};

type EventPlayerRefilled = {
  contest_id: BN;
  player: PublicKey;
  new_lifelines: number;
};

export default class EventParserHandler {
  private eventParser: EventParser;

  constructor(programId: PublicKey, idl: Idl) {
    this.eventParser = new EventParser(programId, new BorshCoder(idl));
  }

  async parseAndHandleEvents({ logs }: EventParseOptions) {
    const events = this.eventParser.parseLogs(logs);
    for (const event of events) {
      switch (event.name) {
        case "LevelCrossedEvent":
          await this.handleLevelCrossed(event.data as EventLevelCrossed);
          break;
        case "PlayerRefilled":
          await this.handlePlayerRefilled(event.data as EventPlayerRefilled);
          break;
        default:
          console.warn(`Unhandled event: ${event.name}`);
      }
    }
  }

  private async handleLevelCrossed(data: EventLevelCrossed) {
    try {
      const contestId = data.contest_id.toString();
      const player = data.player.toString();
      const score = data.score.toString();

      console.log(
        `Level Crossed - Contest ID: ${contestId}, Player: ${player}, Score: ${score}`,
      );

      await client.zIncrBy(
        getLeaderboardKey(contestId),
        parseFloat(score),
        player,
      );

      await client.hSet(
        `events:level_crossed:${contestId}`,
        Date.now().toString(),
        JSON.stringify({ player, score, timestamp: Date.now() }),
      );
    } catch (error) {
      console.error("Error handling LevelCrossedEvent:", error);
    }
  }

  private async handlePlayerRefilled(data: EventPlayerRefilled) {
    try {
      const player = data.player.toString();
      const newLifelines = data.new_lifelines;
      const contestId = data.contest_id.toString();

      console.log(
        `Player Refilled - Player: ${player}, New Lifelines: ${newLifelines}`,
      );
      const leaderboardKey = getLeaderboardKey(contestId);
      const score = await client.zScore(leaderboardKey, player);
      if (score !== null) {
        await client.zAdd(leaderboardKey, { score: 0, value: player });
        console.log(
          `Reset score for player ${player} in contest ${contestId} to 0`,
        );
      } else {
        await client.zAdd(leaderboardKey, { score: 0, value: player });
        console.log(
          `Added player ${player} with score 0 in contest ${contestId}`,
        );
      }

      await client.hSet(
        `events:player_refilled:${player}`,
        "new_lifelines",
        newLifelines.toString(),
      );

      await client.rPush(
        `history:player_refilled`,
        JSON.stringify({
          player,
          new_lifelines: newLifelines,
          timestamp: Date.now(),
        }),
      );
    } catch (error) {
      console.error("Error handling PlayerRefilled event:", error);
    }
  }
}
