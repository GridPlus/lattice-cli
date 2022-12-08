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
  PUBKEY_TYPES 
} from './constants';
import { 
  promptForBool, 
  promptForString, 
  promptGetPath, 
  promptGetPubkeyType 
} from './prompts';
import {
  cancelProgressBar,
  clearPrintedLines, 
  isValidEth1Addr, 
  pathIntToStr, 
  pathStrToInt, 
  printColor,
  startProgressBar
} from './utils';

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
  try {
    printColor(`Fetching address... (${pathStr}):`, "yellow");
    startProgressBar(2500);
    const addresses = await client.getAddresses({ startPath, n: 1 });
    cancelProgressBar();
    clearPrintedLines(2);
    printColor(`✅ Fetched address (${pathStr}):`, "green");
    printColor(addresses[0].toString('hex'), "yellow");
  } catch (err) {
    printColor("Failed to get address.", "red");
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
  try {
    printColor(`Fetching pubkey... (${pathStr}):`, "yellow");
    startProgressBar(2500);
    const pubkeys = await client.getAddresses({ startPath, n: 1, flag });
    cancelProgressBar();
    clearPrintedLines(2);
    printColor(`✅ Fetched pubkey (${pathStr}):`, "green");
    printColor(pubkeys[0].toString('hex'), "yellow");
  } catch (err) {
    printColor("Failed to get pubkey.", "red");
  }
}

export async function cmdGenDepositData(client: Client) {
  let eth1Key, depositPath, depositPathStr, withdrawalKey;
  const encPrivKeys: string[] = [];
  const depositData: any[] = [];
  const useEth1Address = await promptForBool(
    "Use ETH1 address for withdrawal credentials? "
  );
  if (useEth1Address) {
    eth1Key = await promptForString(
      "Enter ETH1 withdrawal address: "
    );
    if (!isValidEth1Addr(eth1Key)) {
      printColor("Invalid ETH1 address.", "red");
      return;
    }
  }
  try {
    depositPathStr = await promptGetPath(
      DEFAULT_PATHS.GET_ETH2_DEPOSIT_DATA,
      "Derivation Path of first Validator: "
    );
    depositPath = pathStrToInt(depositPathStr);
    if (depositPath.length < 1) {
      printColor("Invalid ETH2 deposit path.", "red");
      return;
    }
  } catch (err) {
    printColor("Failed to process input.", "red");
    return;
  }
  while (true) {
    // 1. Get encrypted private key for depositor
    const encPrivReq = {
      schema: SDKConstants.ENC_DATA.SCHEMAS.BLS_KEYSTORE_EIP2335_PBKDF_V4,
      params: { path: depositPath, }
    };
    printColor(`Exporting encrypted keystore for validator (${pathIntToStr(depositPath)})...`, "yellow");
    startProgressBar(32000);
    const encPriv = await client.fetchEncryptedData(encPrivReq);
    cancelProgressBar();
    clearPrintedLines(2);
    printColor(`✅ Exported encrypted keystore for validator (${pathIntToStr(depositPath)})...`, "green");
    encPrivKeys.push(encPriv.toString());

    // 2. Generate deposit data record
    // First determine the withdrawal credentials
    printColor(`Fetching data for validator (${pathIntToStr(depositPath)})...`, "yellow");
    startProgressBar(3000);
    if (useEth1Address) {
      withdrawalKey = eth1Key;
    } else {
      const pubkeys = await client.getAddresses({
        // BLS withdrawal key path, by standard, is one derivation index
        // shorter than the deposit path, but with the same path otherwise.
        startPath: depositPath.slice(0, -1),
        n: 1,
        flag: SDKConstants.GET_ADDR_FLAGS.BLS12_381_G1_PUB,
      });
      withdrawalKey = pubkeys[0];
    }
    cancelProgressBar();
    clearPrintedLines(2);
    // Now we can generate the deposit data
    const opts = {
      ...ETH2Constants.NETWORKS.MAINNET_GENESIS, // TODO: Make this configurable
      withdrawalKey,
    };
    try {
      printColor(`Waiting for signature from validator (${pathIntToStr(depositPath)})...`, "yellow");
      const data = await DepositData.generate(client, depositPath, opts);
      clearPrintedLines(1);
      printColor(`✅ Generated deposit data for validator (${pathIntToStr(depositPath)})!`, "green");
      depositData.push(JSON.parse(data));
    } catch (err) {
      printColor('❌ Failed to generate deposit data.', 'red');
      const shouldContinue = await promptForBool(
        `Try again? `
      );
      if (!shouldContinue) {
        return;
      } else {
        continue;
      }
    }

    // 3. Ask if user wants to do another one
    depositPath[depositPath.length - 1] += 1;
    const shouldContinue = await promptForBool(
      `Generate deposit data for validator (${pathIntToStr(depositPath)})? `
    );
    if (!shouldContinue) {
      // If we want to exit, generate the files and exit
      const fDir = await promptForString(
        "Where do you wish to save the deposit data files? ",
        "./deposit-data"
      );
      if (!existsSync(fDir)) {
        mkdirSync(fDir);
      }
      for (let i = 0; i < encPrivKeys.length; i++) {
        const fPath = fDir + `/validator-${i}-${depositData[i].pubkey}.json`;
        writeFileSync(fPath, encPrivKeys[i]);
      };
      writeFileSync(fDir + '/deposit-data.json', JSON.stringify(depositData));
      printColor(`✅ Validator deposit data files saved to ${fDir}`, "green");
      return;
    }
  }
}