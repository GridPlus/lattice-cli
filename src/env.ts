import { promptForUrl, promptForDeviceId, promptForPassword } from "./prompts";
import { genPrivateKey } from "./utils";

  export const getUrl = async ()=> process.env.GPP_URL ? process.env.GPP_URL : await promptForUrl();

  export const getDeviceId = async ()=> process.env.GPP_DEVICE_ID
    ? process.env.GPP_DEVICE_ID
    : await promptForDeviceId();

  export const getPassword = async ()=> process.env.GPP_PASSWORD
    ? process.env.GPP_PASSWORD
    : await promptForPassword();

  export const getToken = async ({deviceId, password, appName}: Record<string, string>)=> process.env.GPP_TOKEN
    ? Buffer.from(process.env.GPP_TOKEN, "hex")
    : genPrivateKey(deviceId, password, appName);