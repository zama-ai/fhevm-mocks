import { assertHHFhevm } from "../error";

export const ERRORS = {
  InputVerifier: {
    InvalidSigner: {
      title: "FHEVM Input verification error 'InvalidSigner()'",
      shortMessage:
        "The contract address %txContractAddress% or signer account %txUserAddress% used in this transaction differs from the values originally provided to the 'createEncryptedInput()' function. Please ensure they match to avoid encryption errors.",
      longMessage: `You created an encrypted input using createEncryptedInput() with a specific 
contract address and user address.
          
However, you're now attempting to use this encrypted input in a contract transaction 
involving a different contract address %txContractAddress% 
and/or signing account %txUserAddress%.
          
Encrypted inputs are bound to both the contract and the user they were 
created for. To ensure proper decryption and execution, the same contract 
address and user address must be used.
          
This is working:
----------------
  const input = hre.fhevm.createEncryptedInput(fooContract.target, barAccount);
  await fooContract.connect(barAccount).someFunc(<input arguments>);

This is NOT working:
--------------------
  const input = hre.fhevm.createEncryptedInput(otherContract.target, barAccount);
  await fooContract.connect(barAccount).someFunc(<input arguments>);
`,
    },
  },

  ACL: {
    SenderNotAllowed: {
      title: "FHEVM ACL permission error 'SenderNotAllowed()'",
      shortMessage:
        "The contract or account at address %address% attempted to call FHE.allow(<some-handle>, ...) or a related function like FHE.allowXXX(<some-handle>, ...) to grant FHE access permissions on <some-handle>, without having the necessary access permissions themselves.",
      longMessage:
        "The contract or account at address %address% attempted to call FHE.allow(<some-handle>, ...) or a related function like FHE.allowXXX(<some-handle>, ...) to grant FHE access permissions on <some-handle>, without having the necessary access permissions themselves.",
    },
  },

  KMSVerifier: {
    KMSInvalidSigner: {
      title: "FHEVM KMS verification error 'KMSInvalidSigner()'",
      shortMessage:
        "Call to FHE.checkSignatures(uint256 requestID, bytes[] memory signatures) failed with custom error 'KMSInvalidSigner()'",
    },
  },

  FHEVMExecutor: {
    ACLNotAllowed: {
      title: "FHEVM access permission verification error 'ACLNotAllowed()' while calling FHE operator",
      shortMessage:
        "The contract or account at %account% is attempting to call an FHE operator (e.g., add, and, xor, etc.) using the handle %handle%, but does not have the required FHE access permissions. To grant access to a <handle> for a contract at <contract address>, call: FHE.allow(<contract address>, <handle>).",
    },
  },

  CustomError: {
    default: "VM Exception while processing transaction: reverted with custom error '%customError%'",
  },
};

export function applyErrorTemplate(template: string, values?: { [templateVar: string]: any }): string {
  if (!values) {
    if (template.includes("%")) {
      assertHHFhevm(false, `Missing values to fill template`);
    }
    return template;
  }

  for (const variableName of Object.keys(values)) {
    if (variableName.match(/^[a-zA-Z][a-zA-Z0-9]*$/) === null) {
      assertHHFhevm(false, `Invalid template variable name ${variableName}`);
    }

    // const variableTag = `%${variableName}%`;

    // if (!template.includes(variableTag)) {
    //   console.log(variableTag);
    //   console.log(template);
    //   assertHHFhevm(false, `Missing variable name ${variableName} in template`);
    // }
  }

  for (const variableName of Object.keys(values)) {
    let value: string;

    if (values[variableName] === undefined) {
      value = "undefined";
    } else if (values[variableName] === null) {
      value = "null";
    } else {
      value = values[variableName].toString();
    }

    if (value === undefined) {
      value = "undefined";
    }

    const variableTag = `%${variableName}%`;

    if (value.match(/%([a-zA-Z][a-zA-Z0-9]*)?%/) !== null) {
      assertHHFhevm(false, `Template value contains variable name ${variableName}.`);
    }

    template = template.split(variableTag).join(value);
  }
  return template;
}
