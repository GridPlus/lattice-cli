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
    // @ts-expect-error - Wrong Buffer
    privKey: token,
    skipRetryOnWrongWallet: false,
    timeout: 5000,
  });

export const connect = (client: Client, deviceId: string) => {
  console.time("connect");
  return client
    .connect(deviceId)
    .catch((err) => {
      if (err.includes("Timeout")) {
        throw err;
      } else {
        console.error(err);
      }
    })
    .finally(() => {
      console.timeEnd("connect");
    });
};

export const pair = (client: Client, pairingCode: string) => {
  console.time("pair");
  return client
    .pair(pairingCode.toUpperCase())
    .catch(console.error)
    .finally(() => {
      console.timeEnd("pair");
    });
};

export const sign = (client: Client, message: string) => {
  const path = [0x80000000 + 44, 0x80000000 + 60, 0x80000000, 0, 0];

  const payload = {
    data: {
      signerPath: path,
      curveType: CONSTANTS.SIGNING.CURVES.SECP256K1,
      hashType: CONSTANTS.SIGNING.HASHES.SHA256,
      payload: message,
    },
  };

  console.time("sign");
  return (
    client
      //@ts-expect-error - Types out of date
      .sign(payload)
      .catch(console.error)
      .finally(() => {
        console.timeEnd("sign");
      })
  );
};
