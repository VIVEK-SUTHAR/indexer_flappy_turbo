import express from "express";
import { getLeaderboard } from "./leaderboard";
import { readableStreamToArrayBuffer } from "bun";

const app = express();

app.use(express.json());
const port = 3000;

app.get("/ping", (req, res) => {
  res.status(200).json({ ping: "pong" });
});

app.get("/leaderboard/:contestId", async (req, res) => {
  try {
    const { contestId } = req.params;

    if (!contestId) {
      res.status(400).json({
        success: false,
        message: "contestId is required",
        data: null,
      });
      return;
    }

    const leaderboard = await getLeaderboard(contestId);

    if (leaderboard.length === 0) {
      res.status(404).json({
        success: false,
        data: null,
        message: "Leaderboard not found for the contest.",
      });
      return;
    }

    res.status(200).json({ success: true, data: leaderboard, messsage: null });
  } catch (error) {
    console.error("Error retrieving leaderboard:", error);
    res
      .status(500)
      .json({ success: false, data: error, message: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
