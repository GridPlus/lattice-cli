const COMMANDS = {
  EXIT: 'Exit',
  GET_ADDRESS: 'Get Address',
  GET_PUBLIC_KEY: 'Get Public Key',
  EXPORT_DEPOSIT_DATA: 'Export ETH2 Deposit Data',
};

const DEFAULT_PATHS = {
  GET_ADDRESS: 'm/44\'/60\'/0\'/0/0',
  GET_PUBKEY: {
    SECP256K1: 'm/44\'/60\'/0\'/0/0',
    ED25519: 'm/44\'/501\'/0\'/0\'',
    BLS12_381_G1: 'm/12381/3600/0/0/0',
  },
  GET_ETH2_DEPOSIT_DATA: 'm/12381/3600/0/0/0',
}

const PUBKEY_TYPES = {
  SECP256K1: 'secp256k1',
  ED25519: 'ed25519',
  BLS12_381_G1: 'bls12_381_g1',
}

const DEFAULT_URL = "https://signing.gridpl.us"

const DEPOSITS = {
  DEFAULT_AMOUNT_ETH: 32,
  // Technically the max amount is U64_MAX=1000000000 ETH
  // but that seems insane. I don't think there's any reason
  // to ever deposit more than 32 ETH, so I chose 64 kinda
  // arbitrarily here. If anyone has a need for more, pls
  // open a pull request.
  MAX_AMOUNT_ETH: 64,
  MIN_AMOUNT_ETH: 1,
}

const WELCOME_MSG =
`\
    __          __  __  _              ________    ____
   / /   ____ _/ /_/ /_(_)_______     / ____/ /   /  _/
  / /   / __  / __/ __/ / ___/ _ \\   / /   / /    / /  
 / /___/ /_/ / /_/ /_/ / /__/  __/  / /___/ /____/ /   
/_____/\\__,_/\\__/\\__/_/\\___/\\___/   \\____/_____/___/   

Welcome to the Lattice CLI!\n---------------------------\n\
This program is designed to let you interact with your Lattice device.\n\
Once connected to your device, you can interact with its active wallet to:\n\
- Request formatted (Ethereum or Bitcoin) addresses\n\
- Request public keys\n\
- Generate validator deposit data\n\
`
const WARNING_MSG =
`\
⚠️  WARNING: This CLI is alpha software. Please use carefully and at your own risk.\n\
Please submit any bugs to the project repo: https://github.com/GridPlus/lattice-cli

`
const MESSAGES = {
  WELCOME: WELCOME_MSG,
  WARNING: WARNING_MSG,
}

export {
  COMMANDS,
  DEFAULT_PATHS,
  DEFAULT_URL,
  DEPOSITS,
  MESSAGES,
  PUBKEY_TYPES,
}