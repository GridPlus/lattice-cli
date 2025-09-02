/**
 * EIP-712 typed data validation utilities
 */

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

interface EIP712TypedData {
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  domain: Record<string, any>;
  message: Record<string, any>;
}

/**
 * Validate EIP-712 typed data structure
 */
export function validateEIP712Data(data: any): ValidationResult {
  // Check for required top-level fields
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: 'Data must be an object' };
  }

  if (!data.types) {
    return { isValid: false, error: 'Missing required field: types' };
  }

  if (!data.primaryType) {
    return { isValid: false, error: 'Missing required field: primaryType' };
  }

  if (!data.domain) {
    return { isValid: false, error: 'Missing required field: domain' };
  }

  if (!data.message) {
    return { isValid: false, error: 'Missing required field: message' };
  }

  // Validate types structure
  if (typeof data.types !== 'object' || Array.isArray(data.types)) {
    return { isValid: false, error: 'Types must be an object' };
  }

  // Check that EIP712Domain type exists
  if (!data.types.EIP712Domain) {
    return { isValid: false, error: 'Missing EIP712Domain type definition' };
  }

  // Validate each type definition
  for (const [typeName, typeFields] of Object.entries(data.types)) {
    if (!Array.isArray(typeFields)) {
      return { 
        isValid: false, 
        error: `Type ${typeName} must be an array of field definitions` 
      };
    }

    for (const field of typeFields) {
      if (!field.name || !field.type) {
        return { 
          isValid: false, 
          error: `Invalid field in type ${typeName}: must have name and type` 
        };
      }

      if (typeof field.name !== 'string' || typeof field.type !== 'string') {
        return { 
          isValid: false, 
          error: `Invalid field in type ${typeName}: name and type must be strings` 
        };
      }
    }
  }

  // Validate that primaryType exists in types
  if (!data.types[data.primaryType]) {
    return { 
      isValid: false, 
      error: `Primary type '${data.primaryType}' not found in type definitions` 
    };
  }

  // Validate domain structure
  const domainType = data.types.EIP712Domain;
  for (const field of domainType) {
    const fieldName = field.name;
    if (data.domain[fieldName] !== undefined) {
      // Basic type checking for common domain fields
      if (fieldName === 'chainId' && typeof data.domain[fieldName] !== 'number') {
        return { 
          isValid: false, 
          error: `Domain field 'chainId' must be a number` 
        };
      }
      if (fieldName === 'verifyingContract' && 
          typeof data.domain[fieldName] === 'string' &&
          !isValidAddress(data.domain[fieldName])) {
        return { 
          isValid: false, 
          error: `Domain field 'verifyingContract' must be a valid address` 
        };
      }
    }
  }

  // Validate message structure against primaryType
  const primaryTypeFields = data.types[data.primaryType];
  for (const field of primaryTypeFields) {
    if (data.message[field.name] === undefined) {
      return { 
        isValid: false, 
        error: `Message missing required field: ${field.name}` 
      };
    }
  }

  // Check for circular references
  const circularCheck = checkCircularReferences(data.types);
  if (!circularCheck.isValid) {
    return circularCheck;
  }

  return { isValid: true };
}

/**
 * Check for circular type references
 */
function checkCircularReferences(
  types: Record<string, Array<{ name: string; type: string }>>
): ValidationResult {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function checkType(typeName: string): boolean {
    // Skip primitive types
    if (isPrimitiveType(typeName)) {
      return true;
    }

    // Extract base type from arrays
    const baseType = typeName.replace(/\[\d*\]$/, '');

    if (recursionStack.has(baseType)) {
      return false; // Circular reference detected
    }

    if (visited.has(baseType)) {
      return true; // Already checked, no circular reference
    }

    if (!types[baseType]) {
      return true; // Type not defined, will be caught elsewhere
    }

    visited.add(baseType);
    recursionStack.add(baseType);

    for (const field of types[baseType]) {
      if (!checkType(field.type)) {
        return false;
      }
    }

    recursionStack.delete(baseType);
    return true;
  }

  for (const typeName of Object.keys(types)) {
    if (typeName !== 'EIP712Domain' && !checkType(typeName)) {
      return { 
        isValid: false, 
        error: `Circular reference detected involving type: ${typeName}` 
      };
    }
  }

  return { isValid: true };
}

/**
 * Check if a type is a primitive EIP-712 type
 */
function isPrimitiveType(type: string): boolean {
  const primitives = [
    'bool',
    'string',
    'address',
    'bytes',
    /^bytes\d+$/,
    /^uint\d*$/,
    /^int\d*$/
  ];

  const baseType = type.replace(/\[\d*\]$/, '');
  
  return primitives.some(primitive => {
    if (typeof primitive === 'string') {
      return baseType === primitive;
    }
    return primitive.test(baseType);
  });
}

/**
 * Basic Ethereum address validation
 */
function isValidAddress(address: string): boolean {
  if (typeof address !== 'string') {
    return false;
  }
  
  // Check if it starts with 0x and has 40 hex characters
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}