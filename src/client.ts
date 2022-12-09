import { Client, Constants as CONSTANTS } from "gridplus-sdk";

export const generateClient = ({
  url,
  token,
}: {
  url: string;
  token: Buffer;
}) =>
  new Client({
    name: "GridPlus CLI",
    baseUrl: url,
    privKey: token,
    skipRetryOnWrongWallet: false,
    timeout: 5000,
  });

export const connect = (client: Client, deviceId: string) => {
  return client
    .connect(deviceId)
};

export const pair = (client: Client, pairingCode: string) => {
  return client
    .pair(pairingCode.toUpperCase())
    .catch(console.error)
};
