import { DEFAULT_URL } from "./constants";
import { promptForString } from "./prompts";
import { genPrivateKey } from "./utils";

export const getUrl = async () =>
  process.env.GPP_URL ? 
    process.env.GPP_URL : 
    await promptForString("Enter Connection URL: ", DEFAULT_URL);

export const getDeviceId = async () =>
  process.env.GPP_DEVICE_ID ? 
    process.env.GPP_DEVICE_ID : 
    await promptForString("Enter Device ID: ");

export const getPassword = async () =>
  process.env.GPP_PASSWORD ? 
    process.env.GPP_PASSWORD : 
    await promptForString("Enter password: ");

export const loginIsSaved = () => 
  process.env.GPP_URL && process.env.GPP_DEVICE_ID && process.env.GPP_PASSWORD;

export const buildEnvStr = (deviceId: string, password: string, url?: string ) =>
  `GPP_DEVICE_ID=${deviceId}\nGPP_PASSWORD=${password}\nGPP_URL="${url || DEFAULT_URL}"`

export const getToken = async ({
  deviceId,
  password,
  appName,
}: Record<string, string>) =>
  process.env.GPP_TOKEN
    ? Buffer.from(process.env.GPP_TOKEN, "hex")
    : genPrivateKey(deviceId, password, appName);
