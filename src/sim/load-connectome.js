async function sha256(buffer) {
  if (!globalThis.crypto?.subtle) throw new Error('Secure browser context required. Open this app through HTTPS or localhost.');
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

// fetch() automatically decodes Content-Encoding: gzip. Static hosts differ:
// some serve the .gz bytes as an opaque file; Vite serves decoded bytes.
// Verify the independently pinned hash for the bytes actually received.
export async function decodeConnectome(bytes, source) {
  const head = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
  if (head[0] === 0x1f && head[1] === 0x8b) {
    if (await sha256(bytes) !== source.sha256) throw new Error('Compressed connectome SHA-256 integrity check failed');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const binary = await new Response(stream).arrayBuffer();
    if (await sha256(binary) !== source.binarySha256) throw new Error('Decoded connectome SHA-256 integrity check failed');
    return binary;
  }
  if (await sha256(bytes) !== source.binarySha256) throw new Error('Connectome SHA-256 integrity check failed');
  return bytes;
}
