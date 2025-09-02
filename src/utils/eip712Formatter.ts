/**
 * EIP-712 data formatting utilities
 */

interface FormattedSignature {
  full: string;
  v: string;
  r: string;
  s: string;
}

/**
 * Format EIP-712 typed data for human-readable display
 */
export function formatEIP712ForDisplay(typedData: any): string {
  const lines: string[] = [];

  // Format domain
  lines.push('🌐 Domain:');
  if (typedData.domain) {
    for (const [key, value] of Object.entries(typedData.domain)) {
      lines.push(`  ${key}: ${formatValue(value)}`);
    }
  }
  lines.push('');

  // Format primary type
  lines.push(`📝 Primary Type: ${typedData.primaryType}`);
  lines.push('');

  // Format message
  lines.push('📧 Message:');
  if (typedData.message) {
    lines.push(formatObject(typedData.message, '  '));
  }
  lines.push('');

  // Show type definitions summary
  if (typedData.types) {
    const typeCount = Object.keys(typedData.types).length;
    lines.push(`📋 Type Definitions: ${typeCount} types defined`);
    
    // List custom types (excluding EIP712Domain)
    const customTypes = Object.keys(typedData.types).filter(t => t !== 'EIP712Domain');
    if (customTypes.length > 0) {
      lines.push(`  Custom types: ${customTypes.join(', ')}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format a value for display
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'string') {
    // Check if it looks like an address
    if (value.startsWith('0x') && value.length === 42) {
      return value;
    }
    // Check if it's a hex string
    if (value.startsWith('0x')) {
      return value.length > 66 ? `${value.substring(0, 66)}...` : value;
    }
    return value;
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    if (value.length <= 3) {
      return `[${value.map(v => formatValue(v)).join(', ')}]`;
    }
    return `[${formatValue(value[0])}, ... (${value.length} items)]`;
  }

  if (typeof value === 'object') {
    return '{...}';
  }

  return String(value);
}

/**
 * Format an object for display with indentation
 */
function formatObject(obj: any, indent: string = ''): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      lines.push(`${indent}${key}:`);
      lines.push(formatObject(value, indent + '  '));
    } else {
      lines.push(`${indent}${key}: ${formatValue(value)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format signature from raw bytes to standard format
 */
export function formatSignature(signature: string | Buffer | any): FormattedSignature {
  let sigHex: string;

  // Handle GridPlus SDK signature format
  if (signature && typeof signature === 'object' && !Buffer.isBuffer(signature)) {
    if (signature.v !== undefined && signature.r && signature.s) {
      // Extract v value - it may be a Buffer or number
      let vValue: number;
      if (Buffer.isBuffer(signature.v)) {
        vValue = signature.v[0];
      } else if (typeof signature.v === 'number') {
        vValue = signature.v;
      } else {
        vValue = parseInt(signature.v);
      }

      // Format r and s (they come as hex strings without 0x)
      const r = signature.r.startsWith('0x') ? signature.r.slice(2) : signature.r;
      const s = signature.s.startsWith('0x') ? signature.s.slice(2) : signature.s;
      
      // Ensure proper padding
      const rPadded = r.padStart(64, '0');
      const sPadded = s.padStart(64, '0');
      const vHex = vValue.toString(16).padStart(2, '0');
      
      return {
        full: '0x' + rPadded + sPadded + vHex,
        v: '0x' + vHex,
        r: '0x' + rPadded,
        s: '0x' + sPadded
      };
    }
  }

  // Convert to hex string if Buffer
  if (Buffer.isBuffer(signature)) {
    sigHex = '0x' + signature.toString('hex');
  } else if (typeof signature === 'string') {
    // Ensure it has 0x prefix
    sigHex = signature.startsWith('0x') ? signature : '0x' + signature;
  } else {
    throw new Error('Invalid signature format');
  }

  // Remove 0x prefix for processing
  const sig = sigHex.slice(2);

  // EIP-712 signatures are 65 bytes (130 hex chars)
  // r: 32 bytes, s: 32 bytes, v: 1 byte
  if (sig.length !== 130) {
    throw new Error(`Invalid signature length: expected 130 hex chars, got ${sig.length}`);
  }

  const r = '0x' + sig.slice(0, 64);
  const s = '0x' + sig.slice(64, 128);
  const vHex = sig.slice(128, 130);
  const vNum = parseInt(vHex, 16);

  // Format v according to EIP-155
  // Traditional v values are 27 or 28
  // EIP-155 v values encode the chain ID
  let v: string;
  if (vNum === 0 || vNum === 1) {
    // Modern format (0 or 1)
    v = '0x' + (vNum + 27).toString(16);
  } else {
    // Already in correct format
    v = '0x' + vNum.toString(16);
  }

  return {
    full: sigHex,
    v,
    r,
    s
  };
}

/**
 * Encode EIP-712 data for transmission to Lattice
 * This may need adjustment based on gridplus-sdk requirements
 */
export function encodeForLattice(typedData: any): any {
  // The Lattice/gridplus-sdk may expect a specific format
  // This is a placeholder that returns the data as-is
  // Actual implementation depends on SDK requirements
  return {
    types: typedData.types,
    primaryType: typedData.primaryType,
    domain: typedData.domain,
    message: typedData.message
  };
}