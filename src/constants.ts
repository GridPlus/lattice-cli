const COMMANDS = {
  EXIT: 'Exit',
  GET_ADDRESS: 'Get Address',
  GET_PUBLIC_KEY: 'Get Public Key',
  GENERATE_DEPOSIT_DATA: 'Generate ETH2 Deposit Data',
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

export {
  COMMANDS,
  DEFAULT_PATHS,
  DEFAULT_URL,
  PUBKEY_TYPES,
}