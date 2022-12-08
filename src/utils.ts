import crypto from "crypto";

const cliProgress = require('cli-progress');
let progressBar: any = null;

/**
 * Generate a deterministic SDK private key based on input data.
 * This will be used to maintain a persistent, encrypted connection 
 * with the target Lattice and can be recovered in the future if needed.
 * Note that `password` functions as a salt so if the device is super
 * secure, you should use a strong one.
 */
export function genPrivateKey(
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
 * Start a global progress bar
 * @param totalTime: Total time in milliseconds for the progress bar to complete
 * @param total: Total number of ticks in the progress bar
 * @param start: Starting tick
 */
export function startProgressBar(
  totalTime: number = 60000,
  total: number = 100, 
  start: number = 0, 
) {
  if (progressBar) {
    progressBar.stop();
  }
  progressBar = new cliProgress.SingleBar(
    { format: '{bar} | ETA: {eta}s' }, 
    cliProgress.Presets.shades_classic
  );
  progressBar.start(total, start);
  const barInterval = setInterval(() => {
    if (progressBar.value <= total - 1) {
      progressBar.increment();
    } else {
      clearInterval(barInterval);
    }
  }, totalTime / total);
}

/**
 * Cancel the global progress bar if it exists
 */
export function cancelProgressBar() {
  if (progressBar) {
    progressBar.stop();
  }
}