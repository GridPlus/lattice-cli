/**
 * The Lattice CLI is designed to extend functionality from the GridPlus SDK
 * and associated tools so that a user can easily interact with their Lattice.
 * 
 * This file is the entry point for the CLI. It handles the initial setup.
 */
import dotenv from "dotenv";
import { writeFileSync } from "fs";
import { Client } from 'gridplus-sdk';
import { APP_NAME, DEFAULT_URL, MESSAGES } from './constants'
import { 
  promptForBool, 
  promptForCommand, 
  promptForString 
} from "./prompts";
import { SDKLoginCredentials } from './types';
import { 
  clearPrintedLines, 
  closeSpinner,
  genSDKClientPrivKey,
  printColor,
  startNewSpinner,
} from "./utils";

(async function () {
  dotenv.config();
  printStartupText();
  let loggedIn = false, useEnv = false;
  let client: Client, creds: SDKLoginCredentials;
  const loginExists = loginIsSaved();

  // Make sure the user wants to use the CLI
  const shouldContinue = await promptForBool(
    "Do you want to continue using alpha software? "
  );
  if (!shouldContinue) {
    process.exit(0);
  }

  // Determine if user wants to use the existing connection
  if (loginExists) {
    useEnv = await promptForBool(
      "Use existing Lattice connection? "
    );
  }

  // Log into the device
  while (!loggedIn) {
    // Get the login credentials
    creds = await getSDKCreds(useEnv);
    // Sanity check the credentials
    if (creds.deviceId.length < 6) {
      printColor("Device ID must be at least 6 characters.", "red");
      continue;
    } else if (creds.password.length < 6) {
      printColor("Password must be at least 6 characters.", "red");
    } else if (creds.url.indexOf("https://") < 0) {
      printColor("URL must start with 'https://'.", "red");
    }

    // Instantiate the SDK client
    client = await instantiateSDKClient(creds);

    // Connect to the target Lattice
    let isPaired;
    const connectSpinner = startNewSpinner('Looking for Lattice.');
    try {
      isPaired = await client.connect(creds.deviceId);
      closeSpinner(connectSpinner, "Found Lattice.");
    } catch (err) {
      let msg = ''
      if (err instanceof Error) {
        if (err.message === 'Error code 401: Unauthorized') {
          // Bespoke re-dressing of unhelpful error from Lattice Connect V2.
          // It would be nice to get this fixed at some point..
          // https://github.com/GridPlus/lattice-connect-v2/
          //  blob/df8ab3e92e92fe610cf8675a0f86ddcea2e45b2c/connect/src/services/useSigning.ts#L80
          msg = ': Cannot find Lattice with that ID on specified connect URL.'
        } else if (err.message) {
          msg = `: ${err.message}`
        }
      }
      closeSpinner(
        connectSpinner,
        `Failed to connect to Lattice ${msg}`,
        false
      );
      continue;
    }

    // Pair with the Lattice if there is no permission
    if (!isPaired) {
      let pairSpinner;
      try {
        const pairingCode = await promptForString(
          "Enter pairing code displayed on your Lattice: "
        );
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
            `Failed to pair with Lattice.\nMake sure you do NOT already ` +
            `have a permission for "${APP_NAME}".\n` +
            ` ${err instanceof Error ? err.message : ''}`,
            false
          );
        }
        continue;
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
        "Do you want to replace your existing connection with this one? " :
        "Do you want to save this connection? "
      );
      if (shouldSaveLogin) {
        saveLogin(creds);
      }
    }
  // Start CLI
  await promptForCommand(client);
}
})();

export {};

// Print the startup text wall
function printStartupText() {
  clearPrintedLines(100);
  printColor(MESSAGES.WELCOME, "green");
  printColor(MESSAGES.WARNING, "yellow");
}

// Get a set of login credentials from the user
async function getSDKCreds(useEnv: boolean): Promise<SDKLoginCredentials> {
  const deviceId = await getDeviceId(useEnv);
  const password = await getPassword(useEnv);
  const url = await getUrl(useEnv);
  return { deviceId, password, url };
}

async function getDeviceId(useEnv: boolean): Promise<string> {
  let deviceId;
  if (!!process.env.LATTICE_DEVICE_ID && useEnv) {
    deviceId = process.env.LATTICE_DEVICE_ID;
  } else {
    deviceId = await promptForString("Enter Lattice Device ID: ");
  }
  if (deviceId.length < 6) {
    printColor("Device ID must be at least 6 characters.", "red");
    return await getDeviceId(useEnv);
  }
  return deviceId;
}

async function getPassword(useEnv: boolean): Promise<string> {
  let password;
  if (!!process.env.LATTICE_PASSWORD && useEnv) {
    password = process.env.LATTICE_PASSWORD;
  } else {
    password = await promptForString("Enter Connection Password: ", "", true);
  }
  if (password.length < 6) {
    printColor("Password must be at least 6 characters.", "red");
    return await getPassword(useEnv);
  }
  return password;
}

async function getUrl(useEnv: boolean): Promise<string> {
  let url;
  if (!!process.env.LATTICE_CONNECT_URL && useEnv) {
    url = process.env.LATTICE_CONNECT_URL;
  } else {
    url = await promptForString("Enter Connection URL: ", DEFAULT_URL);
  }
  if (url.indexOf("https://") !== 0) {
    printColor("URL must start with 'https://'", "red");
    return await getUrl(useEnv);
  }
  return url;
}

// Instantiate an SDK instance given a set of login credentials
function instantiateSDKClient(creds: SDKLoginCredentials): Client {
  const { deviceId, password, url } = creds;
  const privKey = genSDKClientPrivKey(deviceId, password, APP_NAME);
  return new Client({
    name: APP_NAME,
    baseUrl: url,
    privKey,
    skipRetryOnWrongWallet: false,
    timeout: 5000,
  });
}

// Determine if a full set of login credentials are saved to `.env`
function loginIsSaved() {
  return  process.env.LATTICE_DEVICE_ID && 
          process.env.LATTICE_PASSWORD && 
          process.env.LATTICE_CONNECT_URL;
}

// Save a full set of login credentials to `.env`
function saveLogin(creds: SDKLoginCredentials) {
  writeFileSync(
    ".env",
    `LATTICE_DEVICE_ID="${creds.deviceId}"\n` +
    `LATTICE_PASSWORD="${creds.password}"\n` + 
    `LATTICE_CONNECT_URL="${creds.url}"`
  );
}