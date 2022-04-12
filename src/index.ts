import dotenv from "dotenv";
import { connect, generateClient, pair } from "./client";
import { getDeviceId, getPassword, getToken, getUrl } from "./env";
import {
  promptForCommand, promptForPairingCode
} from "./prompts";



(async function () {
  dotenv.config();

  const appName = "gridplus-cli";

  const url = await getUrl()
  const deviceId = await getDeviceId()
  const password = await getPassword()
  const token = await getToken({deviceId, password, appName})
  
  const client = generateClient({url, token})
  const isPaired = await connect(client, deviceId)
  console.timeEnd('connect')

  if (isPaired) {
    console.log("PAIRED", isPaired);
  } else {
    const pairingCode = await promptForPairingCode()

    const hasActiveWallet = await pair(client, pairingCode)

    console.log("HASACTIVEWALLET", hasActiveWallet);
  }

  promptForCommand(client, "test");
})();

export { };

