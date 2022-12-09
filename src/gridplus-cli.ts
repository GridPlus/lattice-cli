import dotenv from "dotenv";
import { writeFileSync } from "fs";
import { Client } from 'gridplus-sdk';
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

  let loggedIn = false, useEnv = false;
  let client: Client, deviceId: string, password: string, url: string;
  const loginExists = loginIsSaved();

  // Log into the device
  while (!loggedIn) {
    if (loginExists) {
      useEnv = await promptForBool(
        "Use existing login to re-connect to the same Lattice? "
      );
    }
    
    // Connect to the device, if needed, and initialie the client
    const appName = "lattice-cli";
    deviceId = await getDeviceId(useEnv);
    password = await getPassword(useEnv);
    url = await getUrl(useEnv);
    const token = await getToken({ deviceId, password, appName });
    client = generateClient({ url, token });
    try {
      const isPaired = await connect(client, deviceId);
      if (!isPaired) {
        const pairingCode = await promptForString("Enter pairing code displayed on your Lattice: ");
        const hasActiveWallet = await pair(client, pairingCode);
        if (!hasActiveWallet) {
          printColor("Device does not have an active wallet.\n\n", "red");
          continue;
        } else {
          loggedIn = true;
        }
      } else {
        loggedIn = true;
      }
    } catch (e) {
      printColor("❌ Failed to connect to Lattice device.\n\n", "red");
      loggedIn = false;
      continue;
    }
    clearPrintedLines();
    printColor("✅ Connected to Lattice device.\n", "green")

    // Ask if the user wants to save the login (if it's not already saved)
    if (!loginExists || !useEnv) {
      const shouldSaveLogin = await promptForBool(
        loginExists ? 
        "Do you want to replace your existing login with this one? " :
        "Do you want to save this login? "
      );
      if (shouldSaveLogin) {
        writeFileSync(".env", buildEnvStr(deviceId, password, url));
      }
    }
  // Start CLI
  await promptForCommand(client);
  }
})();

export {};
