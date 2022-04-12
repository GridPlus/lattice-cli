//@ts-expect-error
import { prompt,AutoComplete } from "enquirer";


export const promptForUrl = async () => 
  prompt<{ url: string }>({
    type: "input",
    name: "url",
    message: "url:",
  }).then((r) => r.url);

export const promptForDeviceId = async () =>
  prompt<{ deviceId: string }>({
    type: "input",
    name: "deviceId",
    message: "deviceId:",
  }).then((r) => r.deviceId);

export const promptForPassword = async () =>
  prompt<{ password: string }>({
    type: "input",
    name: "password",
    message: "password:",
  }).then((r) => r.password);

export const promptForPairingCode = async () =>
  prompt<{ pairingCode: string }>({
    type: "input",
    name: "pairingCode",
    message: "pairingCode:",
  }).then((r) => r.pairingCode);

 

export const promptForCommand = async () =>{
  const cmd = new AutoComplete({
    name: 'command', 
    message: "command",
    limit: 10,
    initial: 0,
    choices: [
      "connect",
      "pair",
      "getAddresses",
      "sign",
      "addDecoders",
      "getDecoders",
      "removeDecoders",
      "addPermissionV0",
      "getKvRecords",
      "addKvRecords",
      "removeKvRecords",
      "fetchActiveWallet",
      "getActiveWallet",
      "getStateData",
      "getFwVersion",
    ]
  })
  return cmd.run()
}


