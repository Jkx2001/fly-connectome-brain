import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { Brain } from '../src/sim/brain.js';

export function loadBrain(seed = 42) {
  const root = new URL('../public/data/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', root)));
  const packed = readFileSync(new URL('connectome.bin.gz', root));
  if (createHash('sha256').update(packed).digest('hex') !== manifest.source.sha256) throw new Error('Connectome checksum mismatch');
  const raw = gunzipSync(packed);
  return new Brain(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), new Uint8Array(readFileSync(new URL('annotations.bin', root))), manifest, seed);
}
