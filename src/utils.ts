const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * Encodes bytes using RFC 4648 base64url without padding.
 *
 * Implemented without Node.js Buffer so it remains safe in browser and edge
 * runtimes where generateToken() already works via Web Crypto.
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
  let output = "";

  for (let i = 0; i < bytes.length; i += 3) {
    const byte0 = bytes[i];
    const hasByte1 = i + 1 < bytes.length;
    const hasByte2 = i + 2 < bytes.length;
    const byte1 = hasByte1 ? bytes[i + 1] : 0;
    const byte2 = hasByte2 ? bytes[i + 2] : 0;

    const chunk = (byte0 << 16) | (byte1 << 8) | byte2;

    output += BASE64URL_ALPHABET[(chunk >>> 18) & 0x3f];
    output += BASE64URL_ALPHABET[(chunk >>> 12) & 0x3f];

    if (hasByte1) {
      output += BASE64URL_ALPHABET[(chunk >>> 6) & 0x3f];
    }
    if (hasByte2) {
      output += BASE64URL_ALPHABET[chunk & 0x3f];
    }
  }

  return output;
}
