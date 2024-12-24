import { PublicKey } from "@solana/web3.js";
import idl from "./idl.json";
import { BorshCoder, EventParser } from "@coral-xyz/anchor";
import path from "path";
import fs from "fs";
import "./server";
import FlappyTurboIndexer from "./indexer";
async function main() {
  try {
    const args = process.argv.slice(2);

    if (args.length < 2) {
      throw new Error("Usage: node script.js <rpcUrl> <programID>");
    }

    const [rpcUrl, programID] = args;
    if (!rpcUrl || !programID) {
      throw new Error("Both rpcUrl and programID are required.");
    }
    const configFilePath = path.resolve(__dirname, "config.json");

    const indexer = new FlappyTurboIndexer(rpcUrl, programID);
    await indexer.startPeriodicIndexing();
  } catch (error) {
    throw error;
  }
}
main();
