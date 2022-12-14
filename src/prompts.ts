//@ts-expect-error - Bad types from enquirer lib
import { AutoComplete, NumberPrompt, Toggle, prompt } from "enquirer";
import { Client } from "gridplus-sdk";
import { COMMANDS, PUBKEY_TYPES } from './constants';
import { cmdGenDepositData, cmdGetAddresses, cmdGetPubkeys } from "./commands";
import { clearPrintedLines } from "./utils";

export const promptForBool = async (message: string, defaultTrue=true) => {
  const cmd = new Toggle({
    name: "bool",
    message,
    enabled: "Yes",
    disabled: "No",
    initial: defaultTrue ? "Yes" : "No",
  });
  return cmd.run().then((ans: boolean) => {
    return ans;
  });
};

export const promptForString = async (message: string, initial?: string, isPw?: boolean) =>
prompt<{ value: string }>({
  type: isPw ? "password" : "input",
  name: "value",
  initial,
  message,
}).then((r) => r.value);

export const promptForNumber = async (message: string, initial?: number) => {
  const cmd = new NumberPrompt({
    name: "value",
    message,
    initial,
  });
  return cmd.run().then((ans: number) => {
    return ans;
  });
};

export const promptForSelect = async (message: string, choices: string[]) => {
  const cmd = new AutoComplete({
    name: "value",
    message,
    choices,
  });
  return cmd.run().then((ans: string) => {
    return ans;
  });
}

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