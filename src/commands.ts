import { Client, Constants as SDKConstants } from "gridplus-sdk";
import { DEFAULT_PATHS, PUBKEY_TYPES } from './constants';
import { promptGetAddressesGetPath, promptGetPubkeyType } from './prompts';
import { pathStrToInt, printColor } from './utils';

/**
 * Get an address for the current active wallet.
 * Will prompt for a derivation path.
 * This will return the formatted address based on
 * the derivation path.
 */
export async function cmdGetAddresses(client: Client) {
  const pathStr = await promptGetAddressesGetPath(DEFAULT_PATHS.GET_ADDRESS);
  const startPath = pathStrToInt(pathStr);
  try {
    const addresses = await client.getAddresses({ startPath, n: 1 });
    printColor(`✅ Fetched address (${pathStr}):`, "green");
    printColor(addresses[0].toString('hex'), "yellow");
  } catch (err) {
    printColor("Failed to get address.", "red");
    console.error(err)
  }
}

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
  const keyType = await promptGetPubkeyType();
  let flag, defaultPath;
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
  const pathStr = await promptGetAddressesGetPath(defaultPath);
  const startPath = pathStrToInt(pathStr);
  try {
    const pubkeys = await client.getAddresses({ startPath, n: 1, flag });
    printColor(`✅ Fetched pubkey (${pathStr}):`, "green");
    printColor(pubkeys[0].toString('hex'), "yellow");
  } catch (err) {
    printColor("Failed to get pubkey.", "red");
  }
}