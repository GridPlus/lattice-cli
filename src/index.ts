import dotenv from "dotenv";
import { writeFileSync } from "fs";
import { connect, generateClient, pair } from "./client";
import { getDeviceId, getPassword, getToken, getUrl, loginIsSaved, buildEnvStr } from "./env";
import {promptForCommand, promptForPairingCode, promptForSaveLogin } from "./prompts";
import { clearPrintedLines, printColor } from "./utils";

(async function () {
  clearPrintedLines(100);
  printColor("Welcome to the Lattice CLI!\n---------------------------\n", "green");
  dotenv.config();

  const appName = "lattice-cli";

  const deviceId = await getDeviceId();
  const password = await getPassword();
  const url = await getUrl();

  const token = await getToken({ deviceId, password, appName });

  const client = generateClient({ url, token });

  const isPaired = await connect(client, deviceId);

  if (!isPaired) {
    const pairingCode = await promptForPairingCode();
    const hasActiveWallet = await pair(client, pairingCode);
    if (!hasActiveWallet) {
      printColor("Device does not have an active wallet. Exiting.", "red");
      process.exit(1);
    }
  }

  clearPrintedLines();
  printColor("✅ Connected to Lattice device.\n", "green")

  if (!loginIsSaved()) {
    const shouldSaveLogin = await promptForSaveLogin();
    if (shouldSaveLogin) {
      writeFileSync(".env", buildEnvStr(deviceId, password, url));
    }
  }

  promptForCommand(client);
})();

export {};
