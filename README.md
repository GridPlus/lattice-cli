# GridPlus CLI

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
  * [Get Address](#get-address)
  * [Get Public Key](#get-public-key)

# 🔗 Connecting to a Lattice

Before you can use the CLI, you will need to connect to an online [Lattice](https://gridplus.io/lattice). 

### Discovering your Lattice

If you don't have a saved connection between your Lattice and this CLI, you will need to answer some prompts in order to connect for the first time:

* **Enter Device ID:** Needed to discover your Lattice. To find yours, go to `Device ID` on your Lattice's home screen.

* **Enter Connection Password:** The main purpose of this "password" (really more of a hashing salt) is to generate a repeatable connection. As long as you use the same password every time when you connect a given Lattice (as is done if you save your login), you should have no issues.

* **Enter Connection URL:** The routing domain in which to search for your target Lattice. By default, your Lattice is discoverable on the GridPlus routing domain. If you haven't changed that, you should use the default. You can always change your routing domain using [Lattice Connect](https://github.com/GridPlus/lattice-connect-v2).

### Pairing with your Lattice

If the CLI is able to discover your Lattice and does not find an existing connection, your Lattice will render a screen with a six digit pairing code, which is valid for 60 seconds. You will now be prompted to enter this pairing secret into the CLI. If you enter the correct secret, a pairing record will be created on the Lattice. As long as this record remains on the Lattice (the user can remove it at any time), you will be able to re-establish the same connection without having to re-pair.

### Saving Connection

At this point, you will be asked if you wish to save this connection for future use. If you do, you won't have to enter any of the discovery info again. If you wish to connect to a different Lattice at some later time, you may also choose to start up the CLI and *not* use the saved login data. Note that only one connection can be saved at a time.

# 🖥️ Commands

> NOTE: This is a subset of Lattice functionality. More commands may be added to the CLI at a later date. Pull requests are also welcome!

There are a series of commands you can use to interact with your Lattice. 

## Export ETH2 Deposit Data

If your Lattice is on firmware v0.17.0 or greater, you have access to your BLS keys and signatures. You can use your Lattice to generate data necessary to start one or more validators. For more background information on the data being generated, see [this GridPlus resource](https://gridplus.github.io/gridplus-sdk/tutorials/ethDeposits).

> **WARNING:** The Lattice can be used to export validator data, but **cannot** be used as a validator itself. For that, you will need to setup your own staking node, assuming you are doing solo staking. If you are solo staking and do not already have a staking machine, please stop here and get that setup. [Here](https://www.blocknative.com/blog/ethereum-validator-staking-guide) is a good place to start.

In order to create a new validator, two things must happen:

1. Import the validator's [EIP2335](https://eips.ethereum.org/EIPS/eip-2335)-encrypted BLS private key (a.k.a. "keystore") into a [consensus layer client](https://ethereum.org/en/developers/docs/nodes-and-clients/#consensus-clients) that should be running on your staking machine. It is recommended you *always* import the keystore(s) first, i.e. prior to making the deposit transaction.
2. Sign and broadcast a `deposit` transaction to the [deposit contract](https://etherscan.io/address/0x00000000219ab540356cbb839cbe05303d7705fa#code). This transaction should contain deposit data such as your validator's public key, withdrawal credentials, and some signature data.

Both pieces of data are generated when you execute the `Export ETH2 Deposit Data` command. We will now walk through the steps of generating deposit data for one or more validators.

### Step 1: Selecting a Withdrawal Key

> NOTE: It is **highly** recommended that you use the ETH1 option, unless you have a good reason to select a BLS withdrawal type. In order to withdraw ether, you need to set your withdrawal credentials to an ETH1 address (BLS addresses cannot currently receive ether on the ETH execution layer). 

After you select the `Export ETH2 Deposit Data` option, you will first be asked to choose a "withdrawal key type". Here are the options:

1. **ETH1 Address (default)** - if you choose this option, you will be asked for the ETH1 address and it will be the only key capable of withdrawaing funds from your validator(s). Unlike for the default BLS option, the same ETH1 address will be used for *all* validators you generate.
2. **BLS Key** - if you choose this option, a BLS withdrawal public key will be fetched and included in the deposit data for this validator. The withdrawal key is derived relative to the deposit/validator key according to [EIP2334](https://eips.ethereum.org/EIPS/eip-2334). Specifically, for every deposit/validator key at `m/12381/3600/i/0/0`, a withdrawal key will be derived at `m/12381/3600/i/0`.

### Step 2: Set Deposit Amount

> **NOTE:** Unless you have a good reason to use a different deposit amount, you should probably stick with the 32 ETH default.

You will now be asked to set a deposit amount (in ETH) for your new validator(s). Note that this amount will be used to generate deposit data for **all** validators you iteratively create data for in this command. If for some reason you want to setup different validators with different deposit amounts, you will need to run this command multiple times (i.e. generate multiple `.json` files).

Per the deposit contract, there are a few constraints on the deposit amount:

* Deposit must be >= 1 ETH
* Deposit must be <= 18446744073 ETH 
  * This seems insane, so we've (somewhat arbitrarily) set the max to 64 ETH in this CLI. I'm not sure why you would ever want to set more than 32 ETH but if you can think of a good reason, feel free to open a pull request!
* Deposit must be a multiple of 1 Gwei (i.e. multiple of 0.000000001 ETH)

### Step 3: Setting a Starting Index

> NOTE: You should probably start with the default `0` index if you are adding validators from a new wallet. Choosing a starting index lets you resume the process of adding more validators from the same wallet at some later point.

After selecting your withdrawal key type, you will be asked for a **starting** validator index. Per [EIP2334](https://eips.ethereum.org/EIPS/eip-2334), the BIP39 path in question is `m/12381/3600/i/0/0` for the validator/depositor key.

### Step 4: Selecting Export Type

In order to make a deposit and start an ETH validator, you need to make an on-chain transaction on the *execution layer*. You will be calling the `deposit` function on the [deposit contract](https://etherscan.io/address/0x00000000219ab540356cbb839cbe05303d7705fa#code). The Ethereum Foundation built a web tool called the [Ethereum Launchpad](https://launchpad.ethereum.org) to improve the UX around signing deposit transactions. The data format expected by the Launchpad comes from the official [Staking Deposit CLI](https://github.com/ethereum/staking-deposit-cli). This data can also be generated using the Lattice CLI.

You will be presented with two options for data export type:

1. **JSON file for Ethereum Launchpad (default)** - if you choose this option, the CLI will create a `deposit-data-{timestamp}.json` file containing an array of objects mapping to the set of validators you want to create. You can take this `.json` file and drop it directly into the [Launchpad](https://launchpade.ethereum.org).
2. **Raw transaction calldata** - if you choose this option, the CLI will create a `deposit-calldata-{timestamp}.json` file which contains an array of objects, each of which has a pubkey (for reference) and the raw transaction calldata which should be included in a transaction to the deposit contract. This is a more advanced option, so care should be taken if you choose it. For example, your deposit transaction's `msg.value` *must* match the amount specified when creating the data.

### Step 5: Build Deposit Data

Now that you have declared your options, the CLI will start generating data. For *each* validator index (starting with the first one):

1. Export the encrypted deposit private key. This will need to be imported into your consensus layer client prior to validator activation. *Note that only `pbkdf2` encryption is supported at this time (not `scrypt`).*
2. Request a BLS signature from your Lattice to build deposit data. You are signing the root of the [`DepositData`](https://github.com/ethereum/consensus-specs/blob/dev/specs/phase0/beacon-chain.md#depositdata) message object.
3. Ask if you'd like to repeat the process (steps 1 & 2) for the next sequential validator.

### Step 6: Exporting Deposit Data

Once you decline to generate data for the next validator, the process will ask where you want to save the exported files. Once you choose the location, the CLI will output several files into the specified directory:

* `{outDir}/deposit-X-{timestamp}.json` (either `-data-` or `-calldata`, depending on selected export type)
* For each validator index `i`: `{outDir}/keystore-m_12381_3600_{i}_0_0-{timestamp}.json`

## Get Public Key

If you would like to get a public key for a supported curve (see below table) you can request its hex-string representation using a BIP39 derivation path. As with other methods, the returned pubkey will be derived from the target Lattice's current active wallet.

| Curve | Key Length (bytes) | Key Format |
|:---|:---|:---|
| `secp256k1` | 65 | `04{X}{Y}` |
| `ed25519` | 32 | N/A |
| `bls12_381_g1` | 48 | `{X}` |

## Get Address

The Lattice is able to export a few types of *formatted* addresses, which depend on the BIP39 derivation path specified (specifically on the first two path indices, `purpose`, and `coin_type`, respectively):

| `purpose` | `coin_type` | Address Type | Address Format |
|:---|:---|:---|:---|
| `44'` | `60'`| Ethereum | `0x...` |
| `84'` | `0'` | Bitcoin bech32 | `bc1...` |
| `49'` | `0'` | Bitcoin wrapped segwit | `3...` |
| `44'` | `0'` | Bitcoin legacy | `1...` |
