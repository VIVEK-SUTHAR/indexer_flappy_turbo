import {
  Connection,
  PublicKey,
  type SignaturesForAddressOptions,
} from "@solana/web3.js";
import { createClient } from "redis";
import path from "path";
import fs from "fs";
import EventParserHandler from "./event-parser";
import idl from "./idl.json";
import type { Idl } from "@project-serum/anchor";
import client from "./redis";
import { stringify } from "querystring";
import { config } from "process";

const redisClient = createClient();

redisClient.on("error", (err) => console.log("Redis Client Error", err));
await redisClient.connect();

const ProcessedSignatureKey = "processed:signatures";

class SolanaTransactionIndexer {
  private connection: Connection;
  private programAddress: PublicKey;
  private eventParserHandler: EventParserHandler | null = null;

  constructor(rpcUrl: string, programAddress: string) {
    this.connection = new Connection(rpcUrl, "confirmed");
    this.programAddress = new PublicKey(programAddress);
    this.eventParserHandler = new EventParserHandler(
      new PublicKey(programAddress),
      idl as unknown as Idl,
    );
  }

  async indexTransactions(limit = 10) {
    try {
      let hasMore = true;
      let latestSignature: string | null = null;
      let lastProcessedSignature: string | undefined = undefined;
      let processed = 0;
      while (hasMore) {
        const signatures = await this.connection.getSignaturesForAddress(
          this.programAddress,
          {
            limit: limit,
            before: lastProcessedSignature || undefined,
          },
        );

        if (signatures && signatures.length > 0) {
          if (latestSignature == null) {
            latestSignature = signatures[0].signature;
          }

          hasMore = signatures.length === limit;

          for (const sigInfo of signatures) {
            const isProcessed = await client.sIsMember(
              ProcessedSignatureKey,
              sigInfo.signature,
            );
            if (isProcessed) continue;

            if (!isProcessed) {
              const txn = await this.connection.getTransaction(
                sigInfo.signature,
              );
              if (!txn) {
                console.log(
                  "Failed to get Txn for signature",
                  sigInfo.signature,
                );
                continue;
              }
              await this.processTransaction(sigInfo.signature, txn);

              await client.sAdd(ProcessedSignatureKey, sigInfo.signature);
              processed++;
            }
          }

          lastProcessedSignature = signatures[signatures.length - 1].signature;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.log("Backfilling complete. Latest signature:", latestSignature);

      latestSignature = latestSignature;
      if (latestSignature) {
        this.writeLastProcessedSignatureToConfig(latestSignature);
      }
      return processed;
    } catch (err) {
      console.error("Error during transaction indexing:", err);
    }
  }

  async startPolling(
    lastProcessedSignatureFromBackfill: string,
    limitOfTxToIndex: number = 5,
  ) {
    try {
      console.log(
        "Polling Starting with Last Known signature",
        lastProcessedSignatureFromBackfill,
      );

      let hasMore = true;
      let latestSignature: string | undefined = undefined;
      let lastProcessedSignature: string | undefined = undefined;
      let processed = 0;

      while (hasMore) {
        let options: SignaturesForAddressOptions = {
          limit: limitOfTxToIndex,
        };
        if (hasMore) {
          options.before = lastProcessedSignature;
          options.until = lastProcessedSignatureFromBackfill;
        }

        const newSignatures = await this.connection.getSignaturesForAddress(
          this.programAddress,
          options,
        );

        if (newSignatures && newSignatures.length > 0) {
          if (latestSignature == null) {
            latestSignature = newSignatures[0].signature;
          }

          hasMore = newSignatures.length === limitOfTxToIndex;

          for (const signature of newSignatures) {
            const isProcessed = await client.sIsMember(
              ProcessedSignatureKey,
              signature.signature,
            );
            if (isProcessed) continue;

            if (!isProcessed) {
              const txn = await this.connection.getTransaction(
                signature.signature,
              );
              if (!txn) {
                console.log(
                  "Failed to get Txn for signature",
                  signature.signature,
                );
                continue;
              }
              await this.processTransaction(signature.signature, txn);

              await client.sAdd(ProcessedSignatureKey, signature.signature);
              processed++;
            }
          }

          lastProcessedSignature =
            newSignatures[newSignatures.length - 1].signature;
        } else {
          hasMore = false;
          options.before = undefined;
          options.until = latestSignature;
        }
      }
      console.log("latestSignature:", latestSignature);
      if (latestSignature)
        this.writeLastProcessedSignatureToConfig(latestSignature);
      console.log("lastProcessedSignature:", lastProcessedSignature);

      console.log(
        `Processed ${processed} new txns from ${lastProcessedSignature}`,
      );
    } catch (error) {}
  }

  private async writeLastProcessedSignatureToConfig(signature: string) {
    try {
      const configFilePath = path.join(process.cwd(), "config.json");
      const configData = {
        lastProcessedSignature: signature,
      };

      fs.writeFileSync(
        configFilePath,
        JSON.stringify(configData, null, 2),
        "utf-8",
      );
    } catch (error) {
      console.error("Error writing to config file:", error);
    }
  }

  private async processTransaction(signature: string, transaction: any) {
    const logs = transaction.meta?.logMessages || [];
    await this.eventParserHandler?.parseAndHandleEvents({ logs: logs });
  }

  async startPeriodicIndexing(interval: number = 5000) {
    console.log("Starting periodic transaction indexing...");

    const index = async () => {
      try {
        const processedCount = await this.indexTransactions();
        console.log(`Processed ${processedCount} new transactions`);

        // setInterval(() => {
        //   const config = JSON.parse(
        //     fs.readFileSync(path.join(process.cwd(), "config.json"), "utf8"),
        //   );
        //   if (config && config.lastProcessedSignature) {
        //     this.startPolling(config.lastProcessedSignature);
        //   }
        // }, 5000);
      } catch (error) {
        console.error("Periodic indexing error:", error);
      }
    };

    await index();
  }
}

export default SolanaTransactionIndexer;
