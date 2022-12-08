import dotenv from "dotenv";
import { writeFileSync } from "fs";
import { MESSAGES } from './constants'
import { connect, generateClient, pair } from "./client";
import { getDeviceId, getPassword, getToken, getUrl, loginIsSaved, buildEnvStr } from "./env";
import { promptForBool, promptForCommand, promptForString } from "./prompts";
import { clearPrintedLines, printColor } from "./utils";

(async function () {
  dotenv.config();

  // Make sure the user wants to proceed
  clearPrintedLines(100);
  printColor(MESSAGES.WELCOME, "green");
  printColor(MESSAGES.WARNING, "yellow");
  const shouldContinue = await promptForBool("Do you want to continue? ");
  if (!shouldContinue) {
    process.exit(0);
  }
  
  // Connect to the device, if needed, and initialie the client
  const appName = "lattice-cli";
  const deviceId = await getDeviceId();
  const password = await getPassword();
  const url = await getUrl();
  const token = await getToken({ deviceId, password, appName });
  const client = generateClient({ url, token });
  const isPaired = await connect(client, deviceId);
  if (!isPaired) {
    const pairingCode = await promptForString("Enter pairing code displayed on your Lattice: ");
    const hasActiveWallet = await pair(client, pairingCode);
    if (!hasActiveWallet) {
      printColor("Device does not have an active wallet. Exiting.", "red");
      process.exit(1);
    }
  }
  clearPrintedLines();
  printColor("✅ Connected to Lattice device.\n", "green")

  // Ask if the user wants to save the login (if it's not already saved)
  if (!loginIsSaved()) {
    const shouldSaveLogin = await promptForBool("Do you want to save this login? ");
    if (shouldSaveLogin) {
      writeFileSync(".env", buildEnvStr(deviceId, password, url));
    }
  }

  // Start CLI
  promptForCommand(client);
})();

export {};
