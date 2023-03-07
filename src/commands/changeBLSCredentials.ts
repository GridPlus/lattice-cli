import { sha256 } from '@noble/hashes/sha256';
import {
  Client,
  Constants as SDKConstants,
} from 'gridplus-sdk';
import { 
  BLSToExecutionChange, 
  Constants as ETH2Constants 
} from 'lattice-eth2-utils';
import {
  promptForBool,
  promptForNumber,
  promptForString,
} from '../prompts';
import {
  isValidEth1Addr,
  pathStrToInt,
  printColor,
} from '../utils';

/**
 * Construct a series of signed messages which will update ETH validators' credentials
 * from the original BLS variety (0x00) to the new ETH1 variety (0x01).
 * This can only happen *once* per validator.
 * The original 0x00 credentials use BLS keys for withdrawal credentials, but the ETH
 * execution layer can only send funds to ETH1 addresses (secp256k1-derived) and not
 * ETH2 addresses (bls12_381-derived). Thus, legacy withdrawal credentials must be changed.
 */
export async function cmdChangeBLSCredentials(client: Client) {
  const shouldContinue = await promptForBool(
    "This method will change the withdrawal credentials for your validator(s). This can " +
    "only be done once per validator, so please use this tool carefully!\n\n" +
    "Do you currently have BLS (type 0) withdrawal credentials for the validator(s) you wish to change? ",
    true);
  if (!shouldContinue) {
    printColor("Only BLS (type 0) withdrawal credentials can be changed. Exiting.", "yellow");
    return;
  }
  const startingIdx = await promptForNumber(
    "What is the starting derivation index of the validator(s) you wish to change? ",
    0,
  );
  const useDefaultPaths = await promptForBool(
    "Did you use the default BLS withdrawal path to generate your withdrawal credentials? ",
    true
  );
  let eth1Addr = await promptForString(
    "Please enter the ETH1 address you wish to use for your new withdrawal credentials: ",
    "0x"
  );
  eth1Addr = eth1Addr.toLowerCase();
  if (!isValidEth1Addr(eth1Addr)) {
    printColor("Invalid ETH1 address.", "red");
    return;
  }
  
  // Track state variables
  let count = 0;
  let signedMsgs = [];

  // Loop through each validator and generate a signed message
  while (true) {
    let withdrawalPathStr = getDefaultBLSWithdrawalPathStr(startIdx + count);
    let validatorPathStr = getDefaultBLSValidatorPathStr(startIdx + count);
    if (!useDefaultPaths) {
      withdrawalPathStr = await promptForString(
        `What derivation path was used for validator #${startIdx + count}'s withdrawal credentials? `,
        withdrawalPathStr
      );
      validatorPathStr = await promptForString(
        `What derivation path was used to generate validator #${startIdx + count}'s deposit data? `,
        validatorPathStr
      );
    }
    const validatorPub = await getBLSPubkey(client, pathStrToInt(validatorPathStr));
    const validatorIdx = await promptForNumber(
      "Please visit the following link, confirm the validator belongs to you, and enter the " +
      "numerical validator index.\n" +
      `https://beaconcha.in/validator/${validatorPub}\n`,
      0
    );
    
    const withdrawalPub = await getBLSPubkey(client, pathStrToInt(withdrawalPathStr));
    const blsCreds = getBLSWithdrawalCredentials(withdrawalPub);
    const confirmChange = await promptForBool(
      `Changing credentials for validator #${validatorIdx} (${validatorPub}):\n` +
      `Old withdrawal address: ${withdrawalPub}\n` +
      `Old withdrawal credentials: 0x${blsCreds}\n` +
      `New withdrawal address: ${eth1Addr}\n\n` +
      `Do you wish to make this change?`
      true
    );
    if (!confirmChange) {
      break;
    }

    const signedMsg = await BLSToExecutionChange.generateObject(
      globals.client,
      pathStrToInt(withdrawalPathStr),
      { eth1Addr, validatorIdx }
    );
    signedMsgs.push(signedMsg);
    count++;

    const nextOne = await promptForBool(
      `Do you want to change credentials for the next validator (derivation index #${startIdx + count})? `,
      true
    );
    if (!nextOne) {
      printColor(
        `\n\n` +
        `=======================\n` +
        `Please send the following message to your consensus client or credential change service:\n` +
        `${JSON.stringify(signedMsgs)}\n` +
        `=======================\n` +
      );
      return;
    }
  }
}

/**
 * @internal
 * Get the default BLS withdrawal key's path, as per EIP2334:
 * https://eips.ethereum.org/EIPS/eip-2334
 * @return {string} The BIP39 derivation path
*/
function getDefaultBLSWithdrawalPathStr(idx: number): string {
  return `m/12381/3600/${idx}/0`;
}

/**
 * @internal
 * Get the default BLS validator key's path, as per EIP2334:
 * https://eips.ethereum.org/EIPS/eip-2334
 * @return {string} The BIP39 derivation path
*/
function getDefaultBLSValidatorPathStr(idx: number): string {
  return getDefaultBLSWithdrawalPathStr(idx) + "/0";
}

/**
 * @internal
 * Get the BLS public key associated with a deposit BIP39 path.
 * @return {string} The BLS public key as a hex string (no 0x prefix).
 */
async function getBLSPubkey(client: Client, path: number[]): Promise<string> {
  const pubkeys = await client.getAddresses({
    // BLS withdrawal key path, by standard, is one derivation index
    // shorter than the deposit path, but with the same path otherwise.
    startPath: path
    n: 1,
    flag: SDKConstants.GET_ADDR_FLAGS.BLS12_381_G1_PUB,
  });
  return pubkeys[0].toString('hex');
}

/**
 * Return the original 0x00 type BLS withdrawal credentials given a path.
 * @return {string} The withdrawal credentials as a hex string (no 0x prefix).
 */
function getBLSWithdrawalCredentials(blsWithdrawalPub: string): Promise<string>{
  const creds = Buffer.alloc(32);
  creds[0] = 0;
  Buffer.from(
    sha256(Buffer.from(blsWithdrawalPub, 'hex'))
  ).slice(1).copy(creds, 1);
  return creds.toString('hex');
}