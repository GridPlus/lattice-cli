import crypto from "crypto";
import { 
  chmodSync,
  existsSync, 
  mkdirSync, 
  writeFileSync, 
} from 'fs';
import Spinnies from "spinnies";
let spinner: Spinnies;

/**
 * Generate a deterministic SDK private key based on input data.
 * This will be used to maintain a persistent, encrypted connection 
 * with the target Lattice and can be recovered in the future if needed.
 * Note that `password` functions as a salt so if the device is super
 * secure, you should use a strong one.
 */
export function genSDKClientPrivKey(
  deviceId: string,
  password: string,
  appName: string
): Buffer {
  const tokenPreImage = Buffer.concat([
    Buffer.from(deviceId),
    Buffer.from(password),
    Buffer.from(appName),
  ]);
  return crypto.createHash("sha256").update(tokenPreImage).digest();
}

/**
 * Print colored text to the console. Only `green`, `red`, and `yellow`
 * are currently supported.
 */
export function printColor(text: string, color: string) {
  let s = '';
  switch (color) {
    case 'red':
      s = '\x1b[31m';
      break;
    case 'green':
      s = '\x1b[32m';
      break;
    case 'yellow':
      s = '\x1b[33m';
      break;
    default:
      break;
  };
  console.log(s + text + '\x1b[0m');
}

/**
 * Start a new ASCII text spinner
 */
export function startNewSpinner(text: string, color?: string): Spinnies {
  const spinner = new Spinnies();
  spinner.add('spinner-1', { text, color: 'yellow' });
  return spinner;
}

/**
 * Close an existing ASCII spinner
 */
export function closeSpinner(spinner: Spinnies, text: string, success: boolean = true) {
  if (success) {
    spinner.succeed('spinner-1', { text, color: 'green' });
  } else {
    spinner.fail('spinner-1', { text, color: 'red' });
  }
}

/**
 * Erase the last `lines` lines printed to the console.
 * By default this will erase the last 100 lines, or the
 * entire console.
 */
export function clearPrintedLines(lines: number = 100) {
  for (let i = 0; i < lines; i++) {
    process.stdout.moveCursor(0, -1)
    process.stdout.clearLine(1)
  }
}

/**
 * Convert a BIP39 path string to an array of integers
 * Accounts for hardened representations
 */
export function pathStrToInt(pathStr: string): number[] {
  const indices = [];
  const values = pathStr.slice(pathStr.indexOf("m/") + 2).split('/');
  for (let i = 0; i < values.length; i++) {
    const index = values[i].indexOf("'") > -1 ? 
                  parseInt(values[i].replace("'", "")) + 0x80000000 : 
                  parseInt(values[i]);
    if (isNaN(index)) {
      throw new Error("Invalid path provided. Please try again.");
    }
    indices.push(index);
  }
  return indices;
}

/**
 * Convert a set of BIP39 indices back to a path string
 * Accounts for hardened indices
 */
export function pathIntToStr(pathInt: number[]): string {
  const pathStr = pathInt.map((index) => {
    return index >= 0x80000000 ? `${index - 0x80000000}'` : index;
  }).join('/');
  return `m/${pathStr}`;
}

/**
 * Determine if an address is a valid ETH1 address.
 * Checks to ensure we have a 0x-prefixed, hex string representation
 * of a 20 byte address.
 */
export function isValidEth1Addr(addr: string): boolean {
  return  addr.startsWith("0x") && 
          addr.length === 42 && 
          Buffer.from(addr.slice(2), 'hex').toString('hex') === addr.slice(2);
}

/**
 * Determine the number of decimal places for a number.
 */
export function getDecimalPlaces(num: number): number {
  const str = num.toString();
  const decimalIndex = str.indexOf('.');
  return decimalIndex === -1 ? 0 : str.length - decimalIndex - 1;
}

/**
 * Save a file to a directory with optional permissions.
 * Create the directory if it doesn't exist.
 */
export function saveFile(fDir: string, fName: string, data: string, perm?: string) {
  if (!existsSync(fDir)) {
    mkdirSync(fDir);
  }
  const path = fDir + '/' + fName;
  writeFileSync(path, data);
  if (perm) {
    chmodSync(path, perm);
  }
}