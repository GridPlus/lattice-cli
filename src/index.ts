import dotenv from "dotenv";
import { connect, generateClient, pair } from "./client";
import { getDeviceId, getPassword, getToken, getUrl } from "./env";
import {
  promptForCommand, promptForPairingCode
} from "./prompts";



(async function () {
  console.log("gridplus-cli started")
  dotenv.config();

  const appName = "gridplus-cli";

  const url = await getUrl()
  const deviceId = await getDeviceId()
  const password = await getPassword()
  const token = await getToken({deviceId, password, appName})
  
  const client = generateClient({url, token})

  const isPaired = await connect(client, deviceId)

  if (isPaired) {
    console.log("Device paired");
  } else {
    const pairingCode = await promptForPairingCode()

    const hasActiveWallet = await pair(client, pairingCode)

    if (hasActiveWallet) {
      console.log("Device has an active wallet");
    }
    console.log("Device DOES NOT have an active wallet");
  }

  promptForCommand(client, "test");
})();

export { };

