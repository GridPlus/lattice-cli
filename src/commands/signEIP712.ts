import { Client } from "gridplus-sdk";
import { 
  clearPrintedLines,
  closeSpinner,
  printColor,
  startNewSpinner,
  pathStrToInt,
} from '../utils';
import { 
  promptForSelect,
  promptForString,
  promptForBool,
  promptGetPath
} from '../prompts';
import { validateEIP712Data } from '../utils/eip712Validator';
import { formatEIP712ForDisplay, formatSignature } from '../utils/eip712Formatter';
import { readFileSync, writeFileSync } from 'fs';

/**
 * Sign EIP-712 typed data using the Lattice hardware wallet.
 * Supports multiple input methods and output formats.
 */
export async function cmdSignEIP712(client: Client) {
  try {
    // Get input method
    const inputMethod = await promptForSelect(
      "How would you like to provide the EIP-712 data?",
      ["From file (JSON)", "Direct input (JSON string)", "Cancel"]
    );

    if (inputMethod === "Cancel") {
      return;
    }

    let typedDataStr: string;
    
    // Get the typed data based on input method
    if (inputMethod === "From file (JSON)") {
      const filePath = await promptForString("Enter path to JSON file: ");
      try {
        typedDataStr = readFileSync(filePath, 'utf-8');
      } catch (err) {
        printColor(`Failed to read file: ${err}`, "red");
        return;
      }
    } else {
      typedDataStr = await promptForString(
        "Enter EIP-712 JSON (or paste and press Enter): "
      );
    }

    // Parse and validate the typed data
    let typedData: any;
    try {
      typedData = JSON.parse(typedDataStr);
    } catch (err) {
      printColor("Invalid JSON format", "red");
      return;
    }

    // Validate EIP-712 structure
    const validationResult = validateEIP712Data(typedData);
    if (!validationResult.isValid) {
      printColor(`Invalid EIP-712 structure: ${validationResult.error}`, "red");
      return;
    }

    // Display formatted preview
    console.log("\n📋 EIP-712 Data Preview:");
    console.log("========================");
    const preview = formatEIP712ForDisplay(typedData);
    console.log(preview);
    console.log("========================\n");

    // Confirm before signing
    const shouldSign = await promptForBool(
      "Do you want to sign this data? "
    );
    
    if (!shouldSign) {
      printColor("Signing cancelled", "yellow");
      return;
    }

    // Ask for derivation path (optional, use default ETH path)
    const useDefaultPath = await promptForBool(
      "Use default Ethereum signing path (m/44'/60'/0'/0/0)? "
    );
    
    let signerPath: number[];
    if (useDefaultPath) {
      signerPath = pathStrToInt("m/44'/60'/0'/0/0");
    } else {
      const pathStr = await promptGetPath("m/44'/60'/0'/0/0");
      signerPath = pathStrToInt(pathStr);
    }

    // Prepare the signing request
    const spinner = startNewSpinner("Requesting signature from Lattice...");
    let spinnerClosed = false;
    
    try {
      // Sign the typed data using GridPlus SDK format
      // According to the SDK docs, EIP-712 uses protocol: 'eip712' with ETH_MSG currency
      const signatureResult = await client.sign({
        currency: 'ETH_MSG',
        data: {
          protocol: 'eip712',
          payload: typedData,
          signerPath: signerPath
        }
      } as any);

      closeSpinner(spinner, "Signature received from Lattice");
      spinnerClosed = true;

      // Format the signature - GridPlus SDK returns {sig: {v, r, s}, signer: Buffer}
      const formattedSig = formatSignature(signatureResult.sig);
      
      // Display signature
      console.log("\n✅ Signature Generated:");
      console.log("========================");
      console.log(`Full signature: ${formattedSig.full}`);
      console.log(`\nComponents:`);
      console.log(`  v: ${formattedSig.v}`);
      console.log(`  r: ${formattedSig.r}`);
      console.log(`  s: ${formattedSig.s}`);
      
      // Show signer address if available
      if (signatureResult.signer) {
        const signerAddress = '0x' + signatureResult.signer.toString('hex');
        console.log(`\nSigner address: ${signerAddress}`);
      }
      console.log("========================\n");

      // Ask if user wants to save
      const shouldSave = await promptForBool(
        "Save signature to file? "
      );

      if (shouldSave) {
        const outputPath = await promptForString(
          "Enter output file path: ",
          "signature.json"
        );
        
        const output = {
          signature: formattedSig.full,
          components: {
            v: formattedSig.v,
            r: formattedSig.r,
            s: formattedSig.s
          },
          signer: signatureResult.signer ? '0x' + signatureResult.signer.toString('hex') : undefined,
          typedData: typedData,
          timestamp: new Date().toISOString()
        };

        try {
          writeFileSync(outputPath, JSON.stringify(output, null, 2));
          printColor(`Signature saved to ${outputPath}`, "green");
        } catch (err) {
          printColor(`Failed to save signature: ${err}`, "red");
        }
      }

    } catch (err) {
      if (!spinnerClosed) {
        closeSpinner(
          spinner,
          `Failed to sign data: ${err instanceof Error ? err.message : 'Unknown error'}`,
          false
        );
      } else {
        printColor(`Error after signing: ${err instanceof Error ? err.message : 'Unknown error'}`, "red");
      }
    }

  } catch (err) {
    printColor(
      `Error in EIP-712 signing: ${err instanceof Error ? err.message : 'Unknown error'}`,
      "red"
    );
  }
}