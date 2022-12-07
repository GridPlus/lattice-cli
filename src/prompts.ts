//@ts-expect-error - Bad types from enquirer lib
import { AutoComplete, prompt } from "enquirer";
import { Client } from "gridplus-sdk";
import { COMMANDS, PUBKEY_TYPES } from './constants';
import { cmdGenDepositData, cmdGetAddresses, cmdGetPubkeys } from "./commands";
import { clearPrintedLines } from "./utils";

export const promptForBool = async (message: string) =>
  prompt<{ value: boolean }>({
    type: "confirm",
    name: "value",
    message,
  }).then((r) => r.value);

export const promptForString = async (message: string, initial?: string) =>
prompt<{ value: string }>({
  type: "input",
  name: "value",
  initial,
  message,
}).then((r) => r.value);

export const promptForCommand = async (client: Client) => {
  const cmd = new AutoComplete({
    name: "command",
    message: "Choose command:",
    limit: 10,
    initial: 0,
    choices: [
      COMMANDS.GENERATE_DEPOSIT_DATA,
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
      case COMMANDS.GENERATE_DEPOSIT_DATA:
        await cmdGenDepositData(client);
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
export const promptGetPath = async (
  defaultPath: string, 
  message: string = "Derivation Path: "
) =>
  prompt<{ path: string }>({
    type: "input",
    name: "path",
    message,
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