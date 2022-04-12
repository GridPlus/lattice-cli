import { Client } from "gridplus-sdk";

export const generateClient = ({
  url,
  token,
}: {
  url: string;
  token: Buffer;
}) =>
  new Client({
    name: "gridplus-cli",
    baseUrl: url,
    // @ts-expect-error - Wrong Buffer
    privKey: token,
    skipRetryOnWrongWallet: false,
    timeout: 5000,
  });

export const connect = (client: Client, deviceId: string) =>
  client.connect(deviceId).catch((err) => {
    if (err.includes("Timeout")) {
      throw err;
    } else {
      console.error(err);
    }
  });

export const pair = (client: Client, pairingCode: string) =>
  client.pair(pairingCode);
