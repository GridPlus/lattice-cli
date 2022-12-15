import Spinnies from 'spinnies';
import { 
  existsSync, 
  mkdirSync, 
  writeFileSync, 
} from 'fs';
import { 
  Client, 
  Constants as SDKConstants 
} from "gridplus-sdk";
import { 
  DepositData, 
  Constants as ETH2Constants 
} from 'lattice-eth2-utils';
import { 
  DEFAULT_PATHS, 
} from '../constants';
import { 
  promptForBool, 
  promptForNumber,
  promptForSelect,
  promptForString, 
} from '../prompts';
import {
  clearPrintedLines, 
  closeSpinner,
  isValidEth1Addr, 
  pathIntToStr, 
  pathStrToInt, 
  printColor,
  startNewSpinner
} from '../utils';

/**
 * Build deposit data for one or more validators. This will
 * ask some initial questions and then will generate deposit
 * data on an interactive loop, once for each desired validator.
 * 
 * This exports two things:
 * 1. Encrypted validator keystores
 * 2. Deposit data for each validator
 * 
 * There are two methods for deposit data export:
 * A. Export each validator's deposit calldata, which can be
 *    used to generate a deposit transaction for each validator.
 *    Note that the calldata will be printed after each validator
 *    is generated, but all calldata values will also be serialized
 *    into a `calldata.json` file at the end.
 * B. Export all validators' deposit data into a `deposit-data.json` 
 *    file, which can be used with the Ethereum Launchpad for 
 *    creating validators.
 */
export async function cmdGenDepositData(client: Client) {
  let depositPath, depositPathStr, eth1Addr;
  const keystores: string[] = [];
  const depositData: any[] = [];
  const exportOpts = [
    "JSON file for Ethereum Launchpad (default)",
    "Raw transaction calldata",
  ];
  const withdrawalOpts = [
    "ETH1 Address (default)",
    "BLS Key",
  ];

  // 1. Get withdrawal credentials info
  const withdrawalType = await promptForSelect(
    "Choose withdrawal key type: ",
    JSON.parse(JSON.stringify(withdrawalOpts)),
  );
  if (withdrawalType === withdrawalOpts[0]) {
    // Use ETH1 address
    eth1Addr = await promptForString(
      "Enter ETH1 withdrawal address: "
    );
    if (!isValidEth1Addr(eth1Addr)) {
      printColor("Invalid ETH1 address.", "red");
      return;
    }
  } else {
    // BLS withdrawal keys appear to be unofficially deprecated, as you
    // now must convert a BLS withdrawal credential to an ETH1 version
    // in order to withdraw. This makes sense... because the execution
    // layer needs to send withdrawn ether to an ETH1 address!
    const shouldContinue = await promptForBool(
      "WARNING: BLS withdrawal credentials must be upgraded to ETH1 credentials " +
      "before the validator can withdraw ether.\nAre you sure you want to use BLS credentials? ",
    );
    if (!shouldContinue) {
      return;
    }
  }

  // 2. Determine what type of deposit data to export
  const exportType = await promptForSelect(
    "What type of deposit data do you want to export? ",
    JSON.parse(JSON.stringify(exportOpts)),
  );
  const exportCalldata = exportType === exportOpts[1]; 

  // 3. Get the starting validator index
  try {
    const validatorIndex = await promptForNumber(
      'Please specify the starting validator index:',
      0
    );
    if (isNaN(validatorIndex) || validatorIndex < 0) {
      printColor("Invalid validator index.", "red");
      return;
    };
    depositPathStr = DEFAULT_PATHS.GET_ETH2_DEPOSIT_DATA;
    depositPath = pathStrToInt(depositPathStr);
    depositPath[2] = validatorIndex;
  } catch (err) {
    printColor("Failed to process input.", "red");
    return;
  }
  
  // 4. Build deposit data in interactive loop
  while (true) {
    let withdrawalKey = eth1Addr;

    // 4.1. Get encrypted private key for depositor
    const keystoreSpinner = startNewSpinner(
      `Exporting encrypted keystore for validator #${depositPath[2]}. This will take about 30 seconds.`, 
      "yellow"
    );
    try {
      const keystore = await getKeystore(client, depositPath);
      keystores.push(keystore);
      closeSpinner(
        keystoreSpinner,
        `Exported encrypted keystore for validator #${depositPath[2]}.`
      );
    } catch (err) {
      closeSpinner(
        keystoreSpinner,
        `Failed to export encrypted keystore for validator #${depositPath[2]}.`,
        false
      );
    }

    // 4.2. Build deposit data record
    // First determine the withdrawal credentials
    if (!withdrawalKey) {
      const withdrawalKeySpinner = startNewSpinner(
        `Fetching BLS withdrawal key for validator #${depositPath[2]}.`, 
        "yellow"
      );
      try {
        // If no withdrawalKey was set, we will be using the defaulBLS withBIP39 draw.
        // Derived according to EIP2334.al key associated with a deposit path
        withdrawalKey = await getBlsWithdrawalKey(client, depositPath);
        closeSpinner(
          withdrawalKeySpinner,
          `Fetched BLS withdrawal key for validator #${depositPath[2]}.`
        );
      } catch (err) {
        closeSpinner(
          withdrawalKeySpinner,
          `Failed to fetch BLS withdrawal key for validator #${depositPath[2]}.`,
          false
        );  
      }
    }

    // Now we can generate the deposit data
    const depositDataSpinner = startNewSpinner(
      `Waiting for signature from validator #${depositPath[2]}.`,
      "yellow"
    );
    try {
      const record = await getDepositData(
        client, 
        depositPath, 
        exportCalldata, 
        withdrawalKey
      );
      depositData.push(JSON.parse(record));
      closeSpinner(
        depositDataSpinner,
        `Successfully built deposit data for validator #${depositPath[2]}.`
      );
    } catch (err) {
      closeSpinner(
        depositDataSpinner,
        `Failed to build deposit data for validator #${depositPath[2]}.`,
        false
      );
      const shouldContinue = await promptForBool(
        `Try again? `
      );
      if (!shouldContinue) {
        return;
      } else {
        continue;
      }
    }

    // 4.3. Ask if user wants to do another one
    const shouldContinue = await promptForBool(
      `Build deposit data for next validator? (${depositPath[2] + 1})? `
    );
    if (!shouldContinue) {
      break;
    };
    // Otherwise we continue to the next one
    depositPath[2] += 1;
  }

  // 4. Build export files
  const datetime = new Date().getTime();
  // If we want to exit, generate the files and exit
  const fDir = await promptForString(
    "Where do you wish to save the deposit data files? ",
    "./deposit-data"
  );
  if (!existsSync(fDir)) {
    mkdirSync(fDir);
  }
  for (let i = 0; i < keystores.length; i++) {
    const fPath = fDir + `/validator-${i}-${depositData[i].pubkey}-${datetime}.json`;
    writeFileSync(fPath, keystores[i]);
  };
  const fName = exportCalldata ?
                `deposit-calldata-${datetime}.json` :
                `deposit-data-${datetime}.json`;
  writeFileSync(fDir + '/' + fName, JSON.stringify(depositData));
  printColor(`Validator deposit data files saved to ${fDir}`, "green");
}

/**
 * Get the BLS withdrawal key associated with a deposit BIP39 path.
 * Derived according to EIP2334.
 * @return {string} The BLS withdrawal key as a hex string (no 0x prefix).
 */
async function getBlsWithdrawalKey(client: Client, depositPath: number[]): Promise<string> {
  const pubkeys = await client.getAddresses({
    // BLS withdrawal key path, by standard, is one derivation index
    // shorter than the deposit path, but with the same path otherwise.
    startPath: depositPath.slice(0, -1),
    n: 1,
    flag: SDKConstants.GET_ADDR_FLAGS.BLS12_381_G1_PUB,
  });
  return pubkeys[0].toString('hex');
}

/**
 * Get encrypted keystore. Build using EIP2335.
 * @return {string} The encrypted EIP2335 keystore.
 */
async function getKeystore(client: Client, depositPath: number[]): Promise<string> {
  return await DepositData.exportKeystore(client, depositPath);
}

/**
 * Get deposit data depending on the export type.
 * @return {string} JSON string representing deposit record
 */
async function getDepositData(
  client: Client, 
  depositPath: number[], 
  exportCalldata: boolean,
  withdrawalKey?: string
): Promise<string> {
  const opts = {
    ...ETH2Constants.NETWORKS.MAINNET_GENESIS, // TODO: Make this configurable
    withdrawalKey,
  };
  if (exportCalldata) {
    const data = await DepositData.generate(client, depositPath, opts);
    return JSON.stringify({ pubkey: "", calldata: data });
  } else {
    const data = await DepositData.generateObject(client, depositPath, opts);
    return JSON.stringify(data);
  }
}