//@ts-expect-error - Bad types from enquirer lib
import { AutoComplete, prompt } from "enquirer";
import { Client } from "gridplus-sdk";
import { COMMANDS, PUBKEY_TYPES } from './constants';
import { cmdGetAddresses, cmdGetPubkeys } from "./commands";
import { clearPrintedLines } from "./utils";

export const promptForUrl = async (defaultUrl: string) =>
  prompt<{ url: string }>({
    type: "input",
    name: "url",
    initial: defaultUrl,
    message: "Enter Connection URL:",
  }).then((r) => r.url || defaultUrl);

export const promptForDeviceId = async () =>
  prompt<{ deviceId: string }>({
    type: "input",
    name: "deviceId",
    message: "Enter Device ID:",
  }).then((r) => r.deviceId);

export const promptForPassword = async () =>
  prompt<{ password: string }>({
    type: "password",
    name: "password",
    message: "Enter password:",
  }).then((r) => r.password);

export const promptForPairingCode = async () =>
  prompt<{ pairingCode: string }>({
    type: "input",
    name: "pairingCode",
    message: "Enter pairing code displayed on your Lattice:",
  }).then((r) => r.pairingCode);

export const promptForMessage = async () =>
  prompt<{ message: string }>({
    type: "input",
    initial: "test",
    name: "message",
    message: "message:",
  }).then((r) => r.message);

export const promptForSaveLogin = async () =>
  prompt<{ saveLogin: boolean }>({
    type: "confirm",
    name: "saveLogin",
    message: "Do you want to save this login? (y/n)",
  }).then((r) => r.saveLogin);

export const promptForCommand = async (client: Client) => {
  const cmd = new AutoComplete({
    name: "command",
    message: "Choose command:",
    limit: 10,
    initial: 0,
    choices: [
      COMMANDS.GET_ADDRESS,
      COMMANDS.GET_PUBLIC_KEY,
      COMMANDS.EXIT,
    ],
  });
  return cmd.run().then(async (ans: string) => {
    clearPrintedLines(100);
    switch (ans) {
      case COMMANDS.GET_ADDRESS:
        await cmdGetAddresses(client);
        break;
      case COMMANDS.GET_PUBLIC_KEY:
        await cmdGetPubkeys(client);
        break;
      case COMMANDS.EXIT:
        process.exit(0);
        break;
    }
    // Print a new line and then print the prompt again
    console.log("")
    promptForCommand(client);
  });
};

//----------------------
// COMMAND PROMPTS
//----------------------

// Get Addresses/Pubkeys
export const promptGetAddressesGetPath = async (defaultPath: string) =>
  prompt<{ path: string }>({
    type: "input",
    name: "path",
    message: "Derivation path:",
    initial: defaultPath,
  }).then((r) => r.path);

  export const promptGetPubkeyType = async () =>
  prompt<{ pubkeyType: string }>({
    type: "select",
    name: "pubkeyType",
    message: "Pubkey Type:",
    initial: 0,
    choices: [
      PUBKEY_TYPES.SECP256K1,
      PUBKEY_TYPES.ED25519,
      PUBKEY_TYPES.BLS12_381_G1,
    ],
  }).then((r) => r.pubkeyType);