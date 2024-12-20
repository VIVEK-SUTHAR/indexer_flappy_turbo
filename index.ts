import { PublicKey } from "@solana/web3.js";
import SolanaTransactionIndexer from "./indexer";
import idl from "./idl.json";
import { BorshCoder, EventParser } from "@coral-xyz/anchor";
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    throw new Error("Usage: node script.js <rpcUrl> <programID>");
  }

  const [rpcUrl, programID] = args;

  if (!rpcUrl || !programID) {
    throw new Error("Both rpcUrl and programID are required.");
  }
  console.log("RPC URL:", rpcUrl);
  console.log("Program ID:", programID);
  try {
    const indexer = new SolanaTransactionIndexer(rpcUrl, programID);
    await indexer.startPeriodicIndexing();
  } catch (error) {
    console.error(error);
  }
}
main();
