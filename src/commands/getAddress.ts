import { Client } from "gridplus-sdk";
import { DEFAULT_PATHS } from '../constants';
import { promptGetPath, promptForSelect } from '../prompts';
import { 
  clearPrintedLines,
  finishSpinner, 
  pathStrToInt, 
  printColor, 
  startNewSpinner,
} from '../utils';

/**
 * Get an address for the current active wallet.
 * Will prompt for a derivation path.
 * This will return the formatted address based on
 * the derivation path.
 */
export async function cmdGetAddresses(client: Client) {
  let startPath, pathStr;
  try {
    pathStr = await promptGetPath(DEFAULT_PATHS.GET_ADDRESS);
    startPath = pathStrToInt(pathStr);
  } catch (err) {
    printColor("Failed to process input.", "red");
    return;
  }
  const spinner = startNewSpinner(`Fetching address at path ${pathStr}`);
  try {
    const addresses = await client.getAddresses({ startPath, n: 1 });
    finishSpinner(
      spinner,
      `${addresses[0]}`
    );
  } catch (err) {
    finishSpinner(
      spinner,
      `Failed to fetch address at path ${pathStr}.`,
      false
    );
  }
}