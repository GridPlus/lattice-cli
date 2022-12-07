import crypto from "crypto";

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
      printColor("Invalid path provided. Please try again.", "red");
      return [];
    }
    indices.push(index);
  }
  return indices;
}