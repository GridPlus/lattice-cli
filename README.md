# 🖥 GridPlus CLI

> ⚠️ WARNING: This CLI is alpha software and should be used with caution. If you discover any bugs, please report them in this repo. Pull requests are also welcome!

👋 Welcome to the GridPlus CLI. This software is intended to facilitate easy access to your [Lattice](https://gridplus.io/lattice) hardware wallet device for important functionality that may be best served for the command line.

## Installation

The easiest way to use this CLI is to [download a release](https://github.com/GridPlus/lattice-cli/releases) for your computer and run it.

You may also clone this repo and build from source (please ensure you are using node 18+):

```
npm i && npm run release
```

This will generate a set of binaries in `./releases`. Run the one you wish to use.

## Contents

* [Connecting to a Lattice](#connecting-to-a-lattice)
* [Commands](#commands)
  * [Export ETH2 Deposit Data](#export-eth2-deposit-data)
  * [Change Withdrawal Credentials](#change-withdrawal-credentials)
  * [Get Address](#get-address)
  * [Get Public Key](#get-public-key)

# 🔗 Connecting to a Lattice

Before you can use the CLI, you will need to connect to an online [Lattice](https://gridplus.io/lattice). 

### 1️⃣ Discovering your Lattice

If you don't have a saved connection between your Lattice and this CLI, you will need to answer some prompts in order to connect for the first time:

* **Enter Device ID:** Needed to discover your Lattice. To find yours, go to `Device ID` on your Lattice's home screen.

* **Enter Connection Password:** The main purpose of this "password" (really more of a hashing salt) is to generate a repeatable connection. As long as you use the same password every time when you connect a given Lattice (as is done if you save your login), you should have no issues.

* **Enter Connection URL:** The routing domain in which to search for your target Lattice. By default, your Lattice is discoverable on the GridPlus routing domain. If you haven't changed that, you should use the default. You can always change your routing domain using [Lattice Connect](https://github.com/GridPlus/lattice-connect-v2).

### 2️⃣ Pairing with your Lattice

> If you have already paired the CLI with your Lattice, this step will get skipped automatically.

If the CLI is able to discover your Lattice, but has never established a saved connection with it before, you will need to **pair** the CLI with your Lattice.

Your Lattice should render a six-digit pairing code, which is valid for 60 seconds. Enter that code into the CLI and a pairing record will be created on your Lattice. As long as that record is not removed from the device, you will not need to re-pair with the same device.

### 3️⃣ Saving The Connection

> **NOTE:** Only one connection can be saved at a time; if you have a saved connection to some Lattice and wish to connect with a *different* Lattice, you can simply choose *not* use the saved connection when starting up the CLI.

After you connect (and possibly pair) with your target Lattice, you will be asked if you wish to save this connection for future use. If you do, you won't have to enter any of the discovery info again. 

Connection data is saved to a local `.env` file, so be aware that if you delete that file or move your CLI binary to a different directory, you will need to re-connect (but not re-pair).

# 🕹 Commands

> NOTE: This is a subset of Lattice functionality. More commands may be added to the CLI at a later date. Pull requests are also welcome!

There are a series of commands you can use to interact with your Lattice. 

## <a id="export-eth2-deposit-data">↪️ Export ETH2 Deposit Data</a>

If your Lattice is on firmware v0.17.0 or greater, you have access to your BLS keys and signatures. You can use your Lattice to generate data necessary to start one or more validators. For more background information on the data being generated, see [this GridPlus resource](https://gridplus.github.io/gridplus-sdk/tutorials/ethDeposits).

> **WARNING:** The Lattice can be used to export validator data, but **cannot** be used as a validator itself. For that, you will need to setup your own staking node, assuming you are doing solo staking. If you are solo staking and do not already have a staking machine, please stop here and get that setup. [Here](https://www.blocknative.com/blog/ethereum-validator-staking-guide) is a good place to start.

In order to create a new validator, two things must happen:

1. Import the validator's [EIP2335](https://eips.ethereum.org/EIPS/eip-2335)-encrypted BLS private key (a.k.a. "keystore") into a [consensus layer client](https://ethereum.org/en/developers/docs/nodes-and-clients/#consensus-clients) that should be running on your staking machine. It is recommended you *always* import the keystore(s) first, i.e. prior to making the deposit transaction.
2. Sign and broadcast a `deposit` transaction to the [deposit contract](https://etherscan.io/address/0x00000000219ab540356cbb839cbe05303d7705fa#code). This transaction should contain deposit data such as your validator's public key, withdrawal credentials, and some signature data.

Both pieces of data are generated when you execute the `Export ETH2 Deposit Data` command. We will now walk through the steps of generating deposit data for one or more validators.

### 1️⃣ Selecting a Withdrawal Key

> NOTE: It is **highly** recommended that you use the ETH1 option, unless you have a good reason to select a BLS withdrawal type. In order to withdraw ether, you need to set your withdrawal credentials to an ETH1 address (BLS addresses cannot currently receive ether on the ETH execution layer). 

After you select the `Export ETH2 Deposit Data` option, you will first be asked to choose a "withdrawal key type". Here are the options:

1. **ETH1 Address (default)** - if you choose this option, you will be asked for the ETH1 address and it will be the only key capable of withdrawaing funds from your validator(s). Unlike for the default BLS option, the same ETH1 address will be used for *all* validators you generate.
2. **BLS Key** - if you choose this option, a BLS withdrawal public key will be fetched and included in the deposit data for this validator. The withdrawal key is derived relative to the deposit/validator key according to [EIP2334](https://eips.ethereum.org/EIPS/eip-2334). Specifically, for every deposit/validator key at `m/12381/3600/i/0/0`, a withdrawal key will be derived at `m/12381/3600/i/0`.

### 2️⃣ Set Deposit Amount

> **NOTE:** Unless you have a good reason to use a different deposit amount, you should probably stick with the 32 ETH default.

You will now be asked to set a deposit amount (in ETH) for your new validator(s). Note that this amount will be used to generate deposit data for **all** validators you iteratively create data for in this command. If for some reason you want to setup different validators with different deposit amounts, you will need to run this command multiple times (i.e. generate multiple `.json` files).

Per the deposit contract, there are a few constraints on the deposit amount:

* Deposit must be >= 1 ETH
* Deposit must be <= 18446744073 ETH 
  * This seems insane, so we've (somewhat arbitrarily) set the max to 64 ETH in this CLI. I'm not sure why you would ever want to set more than 32 ETH but if you can think of a good reason, feel free to open a pull request!
* Deposit must be a multiple of 1 Gwei (i.e. multiple of 0.000000001 ETH)

### 3️⃣ Setting a Starting Index

> NOTE: You should probably start with the default `0` index if you are adding validators from a new wallet. Choosing a starting index lets you resume the process of adding more validators from the same wallet at some later point.

After selecting your withdrawal key type, you will be asked for a **starting** validator index. Per [EIP2334](https://eips.ethereum.org/EIPS/eip-2334), the BIP39 path in question is `m/12381/3600/i/0/0` for the validator/depositor key.

### 4️⃣ Selecting Export Type

In order to make a deposit and start an ETH validator, you need to make an on-chain transaction on the *execution layer*. You will be calling the `deposit` function on the [deposit contract](https://etherscan.io/address/0x00000000219ab540356cbb839cbe05303d7705fa#code). The Ethereum Foundation built a web tool called the [Ethereum Launchpad](https://launchpad.ethereum.org) to improve the UX around signing deposit transactions. The data format expected by the Launchpad comes from the official [Staking Deposit CLI](https://github.com/ethereum/staking-deposit-cli). This data can also be generated using the Lattice CLI.

You will be presented with two options for data export type:

1. **JSON file for Ethereum Launchpad (default)** - if you choose this option, the CLI will create a `deposit-data-{timestamp}.json` file containing an array of objects mapping to the set of validators you want to create. You can take this `.json` file and drop it directly into the [Launchpad](https://launchpade.ethereum.org).
2. **Raw transaction calldata** - if you choose this option, the CLI will create a `deposit-calldata-{timestamp}.json` file which contains an array of objects, each of which has a pubkey (for reference) and the raw transaction calldata which should be included in a transaction to the deposit contract. This is a more advanced option, so care should be taken if you choose it. For example, your deposit transaction's `msg.value` *must* match the amount specified when creating the data.

### 5️⃣ Build Deposit Data

Now that you have declared your options, the CLI will start generating data. For *each* validator index (starting with the first one):

1. Export the encrypted deposit private key. This will need to be imported into your consensus layer client prior to validator activation. *Note that only `pbkdf2` encryption is supported at this time (not `scrypt`).*
2. Request a BLS signature from your Lattice to build deposit data. You are signing the root of the [`DepositData`](https://github.com/ethereum/consensus-specs/blob/dev/specs/phase0/beacon-chain.md#depositdata) message object.
3. Ask if you'd like to repeat the process (steps 1 & 2) for the next sequential validator.

### 6️⃣ Exporting Deposit Data

Once you decline to generate data for the next validator, the process will ask where you want to save the exported files. Once you choose the location, the CLI will output several files into the specified directory:

* `{outDir}/deposit-X-{timestamp}.json` (either `-data-` or `-calldata`, depending on selected export type)
* For each validator index `i`: `{outDir}/keystore-m_12381_3600_{i}_0_0-{timestamp}.json`

## <a id="change-withdrawal-credentials">↪️ Change Withdrawal Credentials</a>

In order to withdraw from an ETH2 validator, the withdrawal credentials must map to an ETH1 address (i.e. `keccak(pubkey)[:20]`). Originally, only BLS addresses (technically these are G1 public keys on the bls12-381 curve) were supported for withdrawal credentials -- this is a "type `0x00`" credential. At some point this changed to allow ETH1 addresses in the credentials (type `0x01`). If you have a legacy `0x00` type credential, for one or more validators, you will need to switch over to the `0x01` type before you can start withdrawing funds (even if you are not exiting). This can be done with the change credential command: `Change Validator Withdrawal Credentials`

### 1️⃣ Setup

You will be asked a series of questions about your validators. Some of them are sanity checks. Note that you cannot change a validator's credentials if they are already `0x01`.

First, you will be asked if you currently have type 0 credentials you would like to change. You should answer yes.

Next, you will be asked if the validators for whom you are changing credentials are both derived from the default [EIP2334](https://eips.ethereum.org/EIPS/eip-2334) path and if they are sequentially derived (e.g. `m/12381/3600/0/0`, `m/12381/3600/1/0`, `m/12381/3600/2/0`, etc).

If you answered yes above, you will be asked what the starting derivation index is. Otherwise, each iteration of the ensuing loop will ask for the full derivation path of the validator whose credentials you wish to change.

Finally, you will be asked for an ETH1 address to use in the new type `0x01` credentials. Note that this will be used for *all* credential changes you create in the ensuing loop. If you wish to use different ETH1 addresses, you need to run this tool multiple times.

### 2️⃣ Change credentials

The CLI will now start generating change credentials data. For each credential you wish to change, the following questions will be asked:

1. What is the network index of the validator? This can be found when you search for your validator's public key in e.g. https://beaconcha.in.
2. After looking at the change data, confirm that you want to update these credentials.
3. After signing the change data on your Lattice: do you want to change credentials for the next validator? NOTE: if using the default path, this will be the next EIP2334 derivation index -- otherwise, it is just "another" validator with a derivation path of your choosing).

### 3️⃣ Exporting data

Once you tell the CLI you are done updating validator credentials, it will generate a JSON file locally with all the data you need. You will need to take this file and move it (e.g. via [scp](https://www.computerhope.com/unix/scp.htm)) to your validator box. As per [this guide](https://notes.ethereum.org/@launchpad/withdrawals-guide), you can flag your consensus client software (e.g. Lighthouse) with this file to execute the change(s):

```shell
curl -d @<PATH_TO_JSON_FILE> -H "Content-Type: application/json" -X POST 127.0.0.1:4000/eth/v1/beacon/pool/bls_to_execution_changes
```

## <a id="get-public-key">↪️ Get Public Key</a>

If you would like to get a public key for a supported curve (see below table) you can request its hex-string representation using a BIP39 derivation path. As with other methods, the returned pubkey will be derived from the target Lattice's current active wallet.

| Curve | Key Length (bytes) | Key Format |
|:---|:---|:---|
| `secp256k1` | 65 | `04{X}{Y}` |
| `ed25519` | 32 | N/A |
| `bls12_381_g1` | 48 | `{X}` |

## <a id="get-address">↪️ Get Address</a>

The Lattice is able to export a few types of *formatted* addresses, which depend on the BIP39 derivation path specified (specifically on the first two path indices, `purpose`, and `coin_type`, respectively):

| `purpose` | `coin_type` | Address Type | Address Format |
|:---|:---|:---|:---|
| `44'` | `60'`| Ethereum | `0x...` |
| `84'` | `0'` | Bitcoin bech32 | `bc1...` |
| `49'` | `0'` | Bitcoin wrapped segwit | `3...` |
| `44'` | `0'` | Bitcoin legacy | `1...` |
