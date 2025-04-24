/**
 * Enum representing different types of arguments.
 */
export enum ArgumentType {
  /**
   * Represents an encrypted boolean argument type.
   */
  Ebool,

  /**
   * Represents an encrypted unsigned integer argument type.
   */
  Euint,

  /**
   * Represents a generic unsigned integer argument type.
   */
  Uint,
}

export type FunctionType = {
  /**
   * The type of the function argument.
   */
  type: ArgumentType;

  /**
   * The bit length of the function argument.
   */
  bits: number;
};

export type OverloadSignature = {
  /**
   * The name of the overload signature.
   */
  name: string;

  /**
   * The arguments of the overload signature.
   */
  arguments: FunctionType[];

  /**
   * The return type of the overload signature.
   */
  returnType: FunctionType;

  /**
   * The binary operator associated with the overload signature.
   * Optional.
   */
  binaryOperator?: string;

  /**
   * The unary operator associated with the overload signature.
   * Optional.
   */
  unaryOperator?: string;
};

export type OverloadShard = {
  /**
   * The shard number of the overload.
   */
  shardNumber: number;

  /**
   * The overload signatures in the shard.
   */
  overloads: OverloadSignature[];
};

/**
 * Represents a Fully Homomorphic Encryption (FHE) type definition.
 * This interface defines the structure of an FHE type, including its
 * properties, supported operators, and related metadata.
 */
export interface FheTypeInfo {
  /**
   * The name or identifier of the FHE type.
   */
  type: string;

  /**
   * A list of operators that are supported by this FHE type.
   */
  supportedOperators: string[];

  /**
   * The bit length of the FHE type, representing its size in bits.
   */
  bitLength: number;

  /**
   * The corresponding clear (non-encrypted) type that matches this FHE type.
   */
  clearMatchingType: string;

  /**
   * The value associated with this FHE type.
   */
  value: number;

  /**
   * An optional list of alias types that are associated with this FHE type.
   */
  aliases?: AliasFheType[];
}

/**
 * Represents an alias for a Fully Homomorphic Encryption (FHE) type.
 * This interface provides a way to define alternative names or representations
 * for an FHE type, along with its supported operators and the corresponding
 * clear (unencrypted) matching type.
 */
export interface AliasFheType {
  /**
   * The name or identifier of the FHE type.
   */
  type: string;

  /**
   * A list of operators that are supported by this FHE type.
   */
  supportedOperators: string[];

  /**
   * The corresponding clear (non-encrypted) type that matches this FHE type.
   */
  clearMatchingType: string;
}

/**
 * Represents an adjusted Fully Homomorphic Encryption (FHE) type with metadata
 * about its properties, supported operations, and related type information.
 */
export interface AdjustedFheType {
  /**
   * The name of the FHE type.
   */
  type: string;

  /**
   * A list of operators supported by this FHE type.
   */
  supportedOperators: string[];

  /**
   * The bit length of the FHE type, indicating its size or precision.
   */
  bitLength: number;

  /**
   * The corresponding clear (non-encrypted) type that matches this FHE type.
   */
  clearMatchingType: string;

  /**
   * (Optional) A specific value associated with this FHE type.
   */
  value?: number;

  /**
   * (Optional) Indicates whether this type is an alias for another type.
   */
  isAlias?: boolean;

  /**
   * (Optional) The name of the type this alias refers to, if applicable.
   */
  aliasType?: string;

  /**
   * (Optional) The corresponding clear type for the alias, if applicable.
   */
  clearMatchingTypeAlias?: string;
}

/**
 * Represents an operator with various properties and configurations.
 */
export type Operator = {
  /**
   * The name of the operator.
   */
  name: string;

  /**
   * Express left scalar operation as a different operation with arguments swapped.
   * Optional.
   */
  leftScalarInvertOp?: string;

  /**
   * Indicates if the operator has a scalar operand.
   */
  hasScalar: boolean;

  /**
   * Indicates if the operator has an encrypted operand.
   */
  hasEncrypted: boolean;

  /**
   * The arguments required by the operator.
   */
  arguments: OperatorArguments;

  /**
   * The return type of the operator.
   */
  returnType: ReturnType;

  /**
   * If true, perform trivial encryption for the left scalar operand.
   * This is a workaround until tfhe-rs supports left scalar operands.
   * Optional.
   */
  leftScalarEncrypt?: boolean;

  /**
   * If true, disable the left scalar operator.
   * Optional.
   */
  leftScalarDisable?: boolean;

  /**
   * The name of the FHE library associated with this operator.
   */
  fheLibName: string;

  /**
   * Indicates if the operator is a shift operator.
   * Optional.
   */
  shiftOperator?: boolean;

  /**
   * Indicates if the operator is a rotate operator.
   * Optional.
   */
  rotateOperator?: boolean;
};

/**
 * Enum representing the types of operator arguments.
 *
 * @enum {number}
 * @property {number} Binary - Represents a binary operator argument.
 * @property {number} Unary - Represents a unary operator argument.
 */
export enum OperatorArguments {
  Binary,
  Unary,
}

/**
 * Enum representing the possible return types.
 */
export enum ReturnType {
  Euint,
  Ebool,
}
