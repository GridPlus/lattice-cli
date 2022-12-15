import { 
  Client, 
  Constants as SDKConstants 
} from "gridplus-sdk";
import { DEFAULT_PATHS, PUBKEY_TYPES } from '../constants';
import { promptGetPath, promptForSelect } from '../prompts';
import { 
  clearPrintedLines,
  closeSpinner, 
  pathStrToInt,
  printColor, 
  startNewSpinner 
} from '../utils';

/**
 * Get a public key for the current active wallet.
 * Prints a hex string representation of the public key.
 * User first selects public key type, which affects
 * the default derivation path. However, any BIP39
 * derivation path can be used for any pubkey type, with
 * the exception of ED25519 pubkeys which cannot use
 * unhardened indices.
 */
export async function cmdGetPubkeys(client: Client) {
  const keyType = await promptForSelect(
    "Pubkey Type: ",
    [
      PUBKEY_TYPES.SECP256K1,
      PUBKEY_TYPES.ED25519,
      PUBKEY_TYPES.BLS12_381_G1,
    ]
  )
  let flag, defaultPath, startPath, pathStr;
  switch (keyType) {
    case PUBKEY_TYPES.SECP256K1:
      flag = SDKConstants.GET_ADDR_FLAGS.SECP256K1_PUB;
      defaultPath = DEFAULT_PATHS.GET_PUBKEY.SECP256K1;
      break;
    case PUBKEY_TYPES.ED25519:
      flag = SDKConstants.GET_ADDR_FLAGS.ED25519_PUB;
      defaultPath = DEFAULT_PATHS.GET_PUBKEY.ED25519;
      break;
    case PUBKEY_TYPES.BLS12_381_G1:
      flag = SDKConstants.GET_ADDR_FLAGS.BLS12_381_G1_PUB;
      defaultPath = DEFAULT_PATHS.GET_PUBKEY.BLS12_381_G1;
      break;
    default:
      printColor('Error: Unhandled public key type requested.', 'red');
      return;
  }
  try {
    pathStr = await promptGetPath(defaultPath);
    startPath = pathStrToInt(pathStr);
  } catch (err) {
    printColor("Failed to process input.", "red");
    return;
  }
  const spinner = startNewSpinner(`Fetching pubkey at path ${pathStr}`);
  try {
    const pubkeys = await client.getAddresses({ startPath, n: 1, flag });
    closeSpinner(
      spinner,
      `${pubkeys[0].toString('hex')}`
    );
  } catch (err) {
    closeSpinner(
      spinner,
      `Failed to fetch pubkey at path ${pathStr}.`,
      false
    );
  }
}