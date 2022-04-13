import crypto from "crypto";

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
