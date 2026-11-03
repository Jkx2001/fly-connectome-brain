"""Rebuild pinned named-cell and transmitter artifacts; no network or fitting."""
import argparse
import collections
import csv
import gzip
import hashlib
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'public/data'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--neurons', type=Path, required=True, help='Pinned upstream neurons.csv.gz')
parser.add_argument('--annotations', type=Path, required=True, help='Official v2.1.0 neuron annotation TSV')
parser.add_argument('--output-dir', type=Path, required=True)
args = parser.parse_args()
metadata = json.loads((DATA / 'circuits.json').read_text())
assert digest(args.neurons) == metadata['source']['canonicalOrderSha256'], 'Canonical neuron order hash mismatch'
assert digest(args.annotations) == metadata['source']['sha256'], 'Official annotation hash mismatch'
with gzip.open(args.neurons, 'rt') as file:
    neurons = list(csv.DictReader(file))
with args.annotations.open() as file:
    annotations = list(csv.DictReader(file, delimiter='\t'))
index = {n['root_id']: i for i, n in enumerate(neurons)}
assert len(index) == len(neurons) == 139255
by_id = {r['root_id']: r for r in annotations}
fields = {'rootId': 'root_id', 'side': 'side', 'cellType': 'cell_type', 'hemibrainType': 'hemibrain_type', 'topNt': 'top_nt', 'knownNt': 'known_nt', 'knownNtSource': 'known_nt_source'}
groups, disagreements, membership = {}, [], {}
for name in metadata['groups']:
    records = []
    for row in annotations:
        if name not in (row['cell_type'], row['hemibrain_type']) or row['root_id'] not in index:
            continue
        record = {'index': index[row['root_id']], **{key: row[value] for key, value in fields.items()}}
        records.append(record)
        membership.setdefault(record['index'], []).append(name)
        if row['cell_type'] and row['hemibrain_type'] and row['cell_type'] != row['hemibrain_type']:
            disagreements.append({key: record[key] for key in ('rootId', 'cellType', 'hemibrainType')})
    groups[name] = records
metadata['groups'] = groups
metadata['labelDisagreements'] = disagreements

graph = DATA / 'connectome.bin.gz'
manifest = json.loads((DATA / 'manifest.json').read_text())
assert digest(graph) == manifest['source']['sha256']
raw = gzip.decompress(graph.read_bytes())
n, edge_count = struct.unpack_from('<II', raw)
assert n == len(neurons)
direct, totals = [], collections.defaultdict(lambda: [0, 0, 0])
for pre, post, weight in struct.iter_unpack('<IIf', raw[8:8 + edge_count * 12]):
    if pre not in membership or post not in membership:
        continue
    direct.append({'pre': pre, 'post': post, 'weight': weight})
    for a in membership[pre]:
        for b in membership[post]:
            stats = totals[a + ' → ' + b]
            stats[0] += 1
            stats[1] += abs(weight)
            stats[2] += weight
metadata['directEdges'] = direct
metadata['connectivity'] = {key: {'neuronPairs': v[0], 'absoluteSynapseCount': int(v[1]), 'signedSynapseCount': int(v[2])} for key, v in totals.items()}

known_signs = {'acetylcholine': 1, 'gaba': -1, 'glutamate': -1, 'dopamine': 1, 'serotonin': 1, 'octopamine': 1}
signs, overrides = bytearray(), []
for i, row in enumerate(neurons):
    predicted = -1 if row['nt_type'] in ('GABA', 'GLUT') else 1
    annotation = by_id.get(row['root_id'], {})
    known = annotation.get('known_nt', '').strip().lower()
    sign = known_signs.get(known, predicted)
    signs.append(sign % 256)
    if sign != predicted:
        overrides.append({'index': i, 'rootId': row['root_id'], 'predicted': row['nt_type'], 'known': known, 'source': annotation['known_nt_source']})
metadata['transmitterSigns']['sha256'] = hashlib.sha256(signs).hexdigest()
metadata['transmitterSigns']['knownOverrides'] = overrides
metadata['transmitterSigns']['counts'] = dict(collections.Counter(row['nt_type'] for row in neurons))
args.output_dir.mkdir(parents=True, exist_ok=True)
(args.output_dir / 'circuit-signs.bin').write_bytes(signs)
(args.output_dir / 'circuits.json').write_text(json.dumps(metadata, indent=2) + '\n')
print('Rebuilt', {key: len(value) for key, value in groups.items()}, 'with', len(overrides), 'known-sign overrides')
print('Circuit metadata SHA-256:', digest(args.output_dir / 'circuits.json'))
