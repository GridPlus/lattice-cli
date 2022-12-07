import { Client, Constants as CONSTANTS } from "gridplus-sdk";

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
    privKey: token,
    skipRetryOnWrongWallet: false,
    timeout: 5000,
  });

export const connect = (client: Client, deviceId: string) => {
  return client
    .connect(deviceId)
    .catch((err) => {
      if (err.includes("Timeout")) {
        throw err;
      } else {
        console.error(err);
      }
    })
};

export const pair = (client: Client, pairingCode: string) => {
  return client
    .pair(pairingCode.toUpperCase())
    .catch(console.error)
};
