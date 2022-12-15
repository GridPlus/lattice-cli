import dotenv from "dotenv";
import { writeFileSync } from "fs";
import { Client } from 'gridplus-sdk';
import { MESSAGES } from './constants'
import { 
  getDeviceId, 
  getPassword, 
  getToken, 
  getUrl, 
  loginIsSaved, 
  buildEnvStr 
} from "./env";
import { 
  promptForBool, 
  promptForCommand, 
  promptForString 
} from "./prompts";
import { 
  clearPrintedLines, 
  closeSpinner,
  printColor,
  startNewSpinner,
} from "./utils";

(async function () {
  dotenv.config();
  printStartupText();
  let loggedIn = false, useEnv = false;
  let client: Client, deviceId: string, password: string, url: string;
  const loginExists = loginIsSaved();

  // Make sure the user wants to use the CLI
  const shouldContinue = await promptForBool("Do you want to continue using alpha software? ");
  if (!shouldContinue) {
    process.exit(0);
  }

  // Determine if user wants to use the existing connection
  if (loginExists) {
    useEnv = await promptForBool(
      "Use existing login to re-connect to the same Lattice? "
    );
  }

  // Log into the device
  while (!loggedIn) {
    // Setup GridPlus SDK Client object
    const appName = "Lattice CLI";
    deviceId = await getDeviceId(useEnv);
    password = await getPassword(useEnv);
    url = await getUrl(useEnv);
    const token = await getToken({ deviceId, password, appName });
    client = new Client({
      name: appName,
      baseUrl: url,
      privKey: token,
      skipRetryOnWrongWallet: false,
      timeout: 5000,
    });

    // Connect to the target Lattice
    let isPaired;
    const connectSpinner = startNewSpinner('Looking for Lattice.');
    try {
      isPaired = await client.connect(deviceId);
      closeSpinner(connectSpinner, "Found Lattice.");
    } catch (err) {
      closeSpinner(
        connectSpinner,
        `Failed to connect to Lattice: ${err instanceof Error ? err.message : ''}`,
        false
      );
      loggedIn = false;
    }

    // Pair with the Lattice if there is no permission
    if (!isPaired) {
      let pairSpinner;
      try {
        const pairingCode = await promptForString("Enter pairing code displayed on your Lattice: ");
        pairSpinner = startNewSpinner('Pairing with Lattice.');
        const hasActiveWallet = await client.pair(pairingCode.toUpperCase());
        if (!hasActiveWallet) {
          closeSpinner(pairSpinner, "Lattice does not have an active wallet.", false);
          loggedIn = false;
        }
        closeSpinner(pairSpinner, "Successfully paired with Lattice.");
        loggedIn = true;
      } catch (err) {
        if (pairSpinner) {
          closeSpinner(
            pairSpinner,
            `Failed to pair with Lattice.\nMake sure you do NOT already have a permission for "${appName}".\n` +
            ` ${err instanceof Error ? err.message : ''}`,
            false
          );
        }
        loggedIn = false;
      }
    } else {
      loggedIn = true;
    }

    if (!loggedIn) {
      const shouldContinue = await promptForBool("Do you want to try again? ");
      if (!shouldContinue) {
        process.exit(1);
      }
      printStartupText();
      continue;
    }
    

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

function printStartupText() {
  clearPrintedLines(100);
  printColor(MESSAGES.WELCOME, "green");
  printColor(MESSAGES.WARNING, "yellow");
}