import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { Brain } from '../src/sim/brain.js';
import { CircuitBrain } from '../src/sim/circuit-brain.js';

export function loadBrain(seed = 42) {
  const root = new URL('../public/data/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', root)));
  const packed = readFileSync(new URL('connectome.bin.gz', root));
  if (createHash('sha256').update(packed).digest('hex') !== manifest.source.sha256) throw new Error('Connectome checksum mismatch');
  const raw = gunzipSync(packed);
  return new Brain(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), new Uint8Array(readFileSync(new URL('annotations.bin', root))), manifest, seed);
}

export function loadCircuitBrain(seed = 42, stepMs = 0.2) {
  const root = new URL('../public/data/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', root)));
  const packed = readFileSync(new URL('connectome.bin.gz', root));
  if (createHash('sha256').update(packed).digest('hex') !== manifest.source.sha256) throw new Error('Connectome checksum mismatch');
  const raw = gunzipSync(packed), circuitsBytes = readFileSync(new URL('circuits.json', root));
  if (createHash('sha256').update(circuitsBytes).digest('hex') !== manifest.circuitsSha256) throw new Error('Circuit annotation checksum mismatch');
  const circuits = JSON.parse(circuitsBytes), signs = readFileSync(new URL('circuit-signs.bin', root));
  if (createHash('sha256').update(signs).digest('hex') !== circuits.transmitterSigns.sha256) throw new Error('Transmitter-sign checksum mismatch');
  return new CircuitBrain(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), new Uint8Array(readFileSync(new URL('annotations.bin', root))), manifest, circuits, new Int8Array(signs), seed, stepMs);
}
