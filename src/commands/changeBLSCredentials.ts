import { writeFileSync } from 'fs';
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
  closeSpinner,
  isValidEth1Addr,
  pathStrToInt,
  printColor,
  startNewSpinner,
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
    "This method will change the withdrawal credentials for your validator(s).\n" +
    "This can only be done once per validator, so please use this tool carefully!\n" +
    "Do you currently have BLS (type 0) withdrawal credentials for the validator(s) " +
    "you wish to change? ",
    true);
  if (!shouldContinue) {
    printColor("Only BLS (type 0) withdrawal credentials can be changed. Exiting.", "yellow");
    return;
  }
  console.log('');
  const useDefaultPaths = await promptForBool(
    "Are these validators derived from the default path (EIP2334) and are they sequential?",
    true
  );
  let startIdx = 0;
  if (useDefaultPaths) {
    startIdx = await promptForNumber(
      "What is the derivation index of the first validator(s) you wish to change? ",
      0,
    );
  }
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
  let signedMsgs: string[] = [];
  let validatorIndices: number[] = [];

  // Loop through each validator and generate a signed message
  while (true) {
    printColor(
      `\nGenerating signed message for validator #${startIdx + signedMsgs.length}...`, 
      "yellow"
    );

    // First determine the derivation paths. If the default options were used, we can
    // generate the paths using the derivation index alone.
    let withdrawalPathStr = getDefaultBLSWithdrawalPathStr(startIdx + signedMsgs.length);
    let validatorPathStr = getDefaultBLSValidatorPathStr(startIdx + signedMsgs.length);
    if (!useDefaultPaths) {
      withdrawalPathStr = await promptForString(
        `What derivation path was used for validator ` +
        `#${startIdx + signedMsgs.length}'s withdrawal credentials? `,
        withdrawalPathStr
      );
      validatorPathStr = await promptForString(
        `What derivation path was used to generate validator ` +
        `#${startIdx + signedMsgs.length}'s deposit data? `,
        validatorPathStr
      );
    }
    
    // Ask the device for validator and withdrawal keys
    const keyExportSpinner = startNewSpinner('Fetching keys from your device...', 'yellow');
    let validatorPub: string, withdrawalPub: string;
    try {
      validatorPub = await getBLSPubkey(client, pathStrToInt(validatorPathStr));
      withdrawalPub = await getBLSPubkey(client, pathStrToInt(withdrawalPathStr));  
      closeSpinner(keyExportSpinner, 'Fetched keys');
    } catch (err) {
      closeSpinner(keyExportSpinner, 'Error fetching keys from your debvice', false);
      break;
    }
    
    // Get the *network* index of the validator. It's helpful to use beaconcha.in if
    // the user doesn't have this on hand.
    console.log(
      "\nEach validator has a network index. " +
      "You can find this number in the label 'Validator ######' on the following page:"
    );
    console.log(`https://beaconcha.in/validator/${validatorPub}`);
    const validatorIdx = await promptForNumber(
      "What is the network index of your validator? ",
      0
    );
    
    // Print the data that is being changed prior to final authorization
    const blsCreds = getBLSWithdrawalCredentials(withdrawalPub);
    console.log(
      `\nConfirm credential change for validator #${startIdx + signedMsgs.length}:\n` +
      `- Network index: ${validatorIdx}\n` +
      `- Validator pubkey: ${validatorPub}\n` +
      `- Old BLS withdrawal address: ${withdrawalPub}\n` +
      `- Old withdrawal credentials: 0x${blsCreds}\n` +
      `- New ETH1 withdrawal address: ${eth1Addr}`
    );
    const confirmChange = await promptForBool(`Do you wish to make this change?`, true);
    if (!confirmChange) {
      // If the user does not want to make this change, let's just exit here to
      // avoid any unneeded complexity.
      break;
    }

    // Get the signature from the device
    const sigSpinner = startNewSpinner('Waiting for signature from your device...', 'yellow');
    try {
      const signedMsg = await BLSToExecutionChange.generateObject(
        client,
        pathStrToInt(withdrawalPathStr),
        { eth1Addr, validatorIdx }
      );
      // Update state variables
      signedMsgs.push(signedMsg);
      validatorIndices.push(validatorIdx);
      closeSpinner(sigSpinner, 'Got signature');
    } catch (err) {
      closeSpinner(sigSpinner, 'Error getting signature from your device', false);
      // As before, exit early to avoid complexity. The user can always restart this process.
      break;
    };

    // Ask if the user wants to continue changing credentials
    const nextOne = await promptForBool(
      `Do you want to change credentials for the next validator ` +
      `(#${startIdx + signedMsgs.length})? `,
      true
    );
    if (!nextOne) {
      break;
    }
  }

  if (signedMsgs.length > 0) {
    // Write the file
    const fName = `bls_to_execution_change-${Date.now()}.json`;
    writeFileSync(fName, JSON.stringify(signedMsgs));
    // Tell the user how to use it
    printColor(
      `\n\n` +
      `=======================\n` +
      `Generated credential change data for ${signedMsgs.length} validators ` +
      `(${validatorIndices.join(', ')})\n` +
      `Wrote to file: ${fName}\n` +
      `=======================\n` +
      `Please move this file to the machine running your consensus client ` +
      `and run the following command:\n` +
      `\n-----------------------\n` +
      `curl -d @${fName} -H "Content-Type: application/json" -X POST 127.0.0.1:4000/eth/v1/beacon/pool/bls_to_execution_changes` +
      `\n-----------------------\n\n` +
      `For more details, please see this guide: https://notes.ethereum.org/@launchpad/withdrawals-guide`,
      'green'
    );
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
    startPath: path,
    n: 1,
    flag: SDKConstants.GET_ADDR_FLAGS.BLS12_381_G1_PUB,
  });
  return pubkeys[0].toString('hex');
}

/**
 * Return the original 0x00 type BLS withdrawal credentials given a path.
 * @return {string} The withdrawal credentials as a hex string (no 0x prefix).
 */
function getBLSWithdrawalCredentials(blsWithdrawalPub: string): string{
  const creds = Buffer.alloc(32);
  creds[0] = 0;
  Buffer.from(
    sha256(Buffer.from(blsWithdrawalPub, 'hex'))
  ).slice(1).copy(creds, 1);
  return creds.toString('hex');
}