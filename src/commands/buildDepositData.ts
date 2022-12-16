import { AbiCoder } from '@ethersproject/abi';
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
import Spinnies from 'spinnies';
import { 
  DEFAULT_PATHS,
  DEPOSITS, 
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
  getDecimalPlaces,
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
  let depositPath: number[], depositPathStr: string, eth1Addr: string = '', startingIdx: number;
  const keystores: string[] = [];
  const depositData: any[] = [];
  const exportOpts = [
    "JSON file for Ethereum Launchpad (default)",
    "Raw transaction calldata",
  ];
  const withdrawalOpts = [
    "ETH1 (default)",
    "BLS",
  ];

  // 1. Get withdrawal credentials info
  const withdrawalType = await promptForSelect(
    "Choose withdrawal credential type: ",
    JSON.parse(JSON.stringify(withdrawalOpts)),
  );
  if (withdrawalType === withdrawalOpts[0]) {
    // Use ETH1 address
    eth1Addr = await promptForString(
      "Enter ETH1 withdrawal address: "
    );
    // Convert to lowercase as is convention for withdrawal credentials
    eth1Addr = eth1Addr.toLowerCase();
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

  // 2. Determine deposit amount. Note that this will be for ALL validators!
  const depositAmountGwei = await getDepositAmountGwei();

  // 3. Determine what type of deposit data to export
  const exportType = await promptForSelect(
    "What type of deposit data do you want to export? ",
    JSON.parse(JSON.stringify(exportOpts)),
  );
  const exportCalldata = exportType === exportOpts[1]; 

  // 4. Get the starting validator index
  try {
    startingIdx = await promptForNumber(
      'Please specify the starting validator index:',
      0
    );
    if (isNaN(startingIdx) || startingIdx < 0) {
      printColor("Invalid validator index.", "red");
      return;
    };
    depositPathStr = DEFAULT_PATHS.GET_ETH2_DEPOSIT_DATA;
    depositPath = pathStrToInt(depositPathStr);
    depositPath[2] = startingIdx;
  } catch (err) {
    printColor("Failed to process input.", "red");
    return;
  }
  
  // 5. Build deposit data in interactive loop
  while (true) {
    let withdrawalKey: string;

    // 5.1. Get encrypted private key for depositor
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
      let msg = `Failed to export encrypted keystore for validator #${depositPath[2]}.`;
      if (err instanceof Error) {
        if (err.message.includes("Disabled (Lattice)")) {
          // The user needs to setup an encryption password on the Lattice before
          // exporting any keystores.
          msg = "You must set an encryption password on your Lattice before you can export any keystores.";
        }
      }
      closeSpinner(keystoreSpinner, msg, false);
      const shouldContinue = await promptForBool(`Try again? `);
      if (!shouldContinue) {
        break;
      } else {
        continue;
      }
    }

    // 5.2. Build deposit data record
    // First determine the withdrawal credentials
    if (eth1Addr !== '') {
      withdrawalKey = eth1Addr;
    } else {
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
        const shouldContinue = await promptForBool(`Try again? `);
        if (!shouldContinue) {
          break;
        } else {
          continue;
        }
      }
    }

    // Now we can generate the deposit data
    const depositDataSpinner = startNewSpinner(
      `Waiting for signature from validator #${depositPath[2]}.`,
      "yellow"
    );
    try {
      const opts = {
        ...ETH2Constants.NETWORKS.MAINNET_GENESIS, // TODO: Make this configurable
        withdrawalKey,
        amountGwei: depositAmountGwei,
      };
      if (exportCalldata) {
        // If the user wants to export calldata, generate that, then pull out
        // the pubkey, and add both as an object to the running `depositData`.
        const calldata = await DepositData.generate(client, depositPath, opts);
        depositData.push({ pubkey: getPubkeyFromCalldata(calldata), calldata });
      } else {
        // Otherwise, fetch deposit data object that can be used with the
        // Ethereum Launchpad for adding validator(s).
        const depositObj = await DepositData.generateObject(client, depositPath, opts);
        depositData.push(depositObj)
      }
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
      const shouldContinue = await promptForBool(`Try again? `);
      if (!shouldContinue) {
        break;
      } else {
        continue;
      }
    }

    // 5.3. Ask if user wants to do another one
    const shouldContinue = await promptForBool(
      `Build deposit data for next validator? (${depositPath[2] + 1})? `
    );
    if (!shouldContinue) {
      break;
    };
    // Otherwise we continue to the next one
    depositPath[2] += 1;
  }

  // 6. Build export files
  if (depositData.length === 0) {
    // If no validator data was generated, exit here
    return;
  } else if (depositData.length === 1) {
    printColor(
      `\nDone building data for validator ${startingIdx}.`, 
      "green"
    );
  } else {
    printColor(
      `\nDone building data for validators ${startingIdx}-` +
      `${startingIdx + depositData.length - 1}.`, 
      "green"
    );
  }
  const datetime = new Date().getTime();
  // If we want to exit, generate the files and exit
  const fDir = await promptForString(
    "Where do you wish to save the deposit data files? ",
    "./deposit-data"
  );
  if (!existsSync(fDir)) {
    mkdirSync(fDir);
  }
  for (let i = 0; i < depositData.length; i++) {
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
 * @internal
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
 * @internal
 * Extract the pubkey from a deposit calldata string.
 * @return {string} The pubkey as a hex string (no 0x prefix).
 */
function getPubkeyFromCalldata(calldata: string): string {
  const coder = new AbiCoder();
  const decoded = coder.decode(ETH2Constants.ABIS.DEPOSIT, calldata);
  if (decoded[0].length / 2 !== 48) {
    throw new Error("Invalid pubkey length encoded into message. Aborting.");
  }
  return decoded[0];
}

/**
 * Prompt the user to enter a deposit amount, which will be used to build
 * deposit data for ALL validators being constructed.
 * @returns {number} The deposit amount in Gwei.
 */
async function getDepositAmountGwei(): Promise<number> {
  const GWEI_POWER = 9;
  let gotAmount = false;
  let depositAmountETH = await promptForNumber(
    'Set deposit amount for all validators you will generate (ETH):',
    DEPOSITS.DEFAULT_AMOUNT_ETH 
  );
  while (!gotAmount) {
    // If the amount equals the default deposit amount, continue
    if (depositAmountETH === DEPOSITS.DEFAULT_AMOUNT_ETH) {
      gotAmount = true;
      break;
    }
    // If this is an invalid amount, collect a new one
    else if (
      depositAmountETH < DEPOSITS.MIN_AMOUNT_ETH || 
      depositAmountETH > DEPOSITS.MAX_AMOUNT_ETH
    ) {
      depositAmountETH = await promptForNumber(
        `Deposit amount must be between ${DEPOSITS.MIN_AMOUNT_ETH} and ` +
        `${DEPOSITS.MAX_AMOUNT_ETH} ETH.\nSet deposit amount (ETH):`,
        DEPOSITS.DEFAULT_AMOUNT_ETH
      );
    }
    // Make sure deposit amount is convertable to Gwei (10**9 Gwei = 1 ETH)
    else if (getDecimalPlaces(depositAmountETH) > GWEI_POWER) {
      depositAmountETH = await promptForNumber(
        `Too many decimal places.\nSet deposit amount (ETH):`,
        DEPOSITS.DEFAULT_AMOUNT_ETH
      )
    }
    // If this is a nonstandard amount, ask for confirmation
    else if (depositAmountETH !== DEPOSITS.DEFAULT_AMOUNT_ETH) {
      const shouldContinue = await promptForBool(
        `WARNING: Deposits are for ${DEPOSITS.DEFAULT_AMOUNT_ETH} ETH by default.\n` +
        `Are you sure you want to use ${depositAmountETH} ETH? `,
      );
      if (shouldContinue) {
        gotAmount = true;
        break;
      }
    }
  }

  // Convert to Gwei and return. Fortunately we are within a u64 so we can
  // use JS math.
  return depositAmountETH * (10 ** 9);
}