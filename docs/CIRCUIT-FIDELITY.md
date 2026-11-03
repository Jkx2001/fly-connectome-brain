# Olfactory circuit checkpoint

This iteration improves anatomical traceability and model dynamics. **It does not solve odor-guided foraging.** No target-seeking rule, trained readout, or reward policy has been added.

## Sources actually inspected

- Official [FlyWire annotations v2.1.0](https://github.com/flyconnectome/flywire_annotations/tree/ebd66db2596fcc39c6950fb54ea3efa00f7fe8a0), matched to materialization v783. Source TSV hash and selected root IDs, indices, sides, types, aliases, and transmitter evidence are in `public/data/circuits.json`.
- The pinned upstream [graph builder](https://github.com/snedea/flybrain/blob/9191824d17871b7851645782d53d23f213ddb938/scripts/build_connectome.py) preserves canonical `neurons.csv.gz` row order when assigning indices. The annotation builder checks that compressed file's hash before mapping root IDs.
- [Shiu–Spiller research model.py](https://github.com/philshiu/Drosophila_brain_model/blob/91bdd1e7dcf193f3e7ca5a8933497fcef63b7960/model.py). Its MIT notice is retained in `SHIU-MIT-LICENSE.txt`. Equations and constants come from this code, not from fitting successful navigation. This browser adaptation has not reproduced the Brian2 reference's published results.

Annotation citations: Schlegel et al., *Whole-brain annotation and multi-connectome cell typing of Drosophila*, Nature (2024), https://doi.org/10.1038/s41586-024-07686-5; Dorkenwald et al., *Neuronal wiring diagram of an adult brain*, Nature (2024), https://doi.org/10.1038/s41586-024-07558-y.

Publisher full text was unavailable under the current cloud network policy. Anatomical identities and connections below are supported by inspected data/code. A complete behavioral interpretation still needs a primary-literature audit; these annotations do not by themselves establish function or a complete approach circuit.

## Anatomical audit

All 139,255 packaged neurons and 2,698,236 neuron-pair edges remain in the simulation. These named populations are annotations on the full graph, not a replacement synthetic network:

| Population | Annotated cells | Interpretation in this checkpoint |
| --- | ---: | --- |
| ORN_DM1 | 68 (35 left, 33 right) | Odor input targets, selected by exact type/hemibrain label |
| DM1_lPN | 2 | First projection-neuron readout |
| LHAD1b2 | 18 | Candidate lateral-horn readout; multiple subtypes/aliases, not asserted to share one behavior |
| DNa02 | 2 | Named steering readout, plus direct intervention control |
| DNp09 aliases | 4 | Only 2 non-conflicting records used for provisional walking; DNp71 conflicts excluded |
| hDeltaC | 21 | Recorded candidate population, not assigned invented compass angles |
| PFL3 | 24 | Recorded candidate population, not assigned invented heading preferences |

Recorded direct edges include ORN_DM1 → DM1_lPN (135 neuron pairs, 6,199 absolute aggregated synapse counts), DM1_lPN → LHAD1b2 (6 pairs, 84), and PFL3 → DNa02 (24 pairs, 496). These do **not** prove a complete chain between all listed populations. Signed edge statistics in the artifact describe the original packaged weights; the circuit profile applies its separate transmitter-sign policy.

The distinction between nerve-entry side and functional projection side matters: a sensory neuron can project bilaterally. Anatomical side labels are not proof that a left odor stimulus should directly become a left turn.

## Dynamics and deliberate deviations

The circuit profile uses relative voltage `x = v - (-52 mV)`:

```
dx/dt = (-x + g) / 20 ms
dg/dt = -g / 5 ms
spike when x > 7 mV; reset x = g = 0
synaptic arrival: g += signed_count × 0.275 mV
```

Delay is 1.8 ms and refractory duration 2.2 ms. Both ODEs freeze during refractory periods, while synaptic arrivals can accumulate. Poisson-driven targets have no refractory period, matching the reference intervention convention. External events add 68.75 mV to voltage. World odor intensity maps to 0–150 Hz external pulses; that mapping is an assumption, not a measured receptor response.

The browser uses exact passive integration at 0.2 ms substeps, rather than Brian2's usual 0.1 ms clock. Event-sparse state returns to rest below a 1e-8 mV tolerance. Tests check passive timestep consistency and small-graph causal interventions. They do **not** establish full Brian2 equivalence, fine spike-time accuracy, or physiological firing rates. High downstream rates remain a model limitation.

GABA and glutamate are inhibitory under a simplified convention. An unambiguous single `known_nt` literature annotation overrides conflicting predictions (2,034 sign changes compared with the predicted-sign policy). Mixed transmitter labels fall back to prediction. Dopamine, serotonin, and octopamine still have simplified excitatory effects. Receptor-specific effects are absent.

Circuit mode isolates odor: ambient light, touch, and taste do not drive it. Wind, a heading representation, sensory adaptation, hunger, satiety, and learning have not been supplied. This intentional restriction prevents arbitrary broad sensory drive from being mistaken for an olfactory response.

The body decoder is still artificial: DNa02 activity difference supplies turn; two non-conflicting DNp09 annotations supply provisional forward drive. The decoder has no food positions, odor gradient, or target direction. Direct DNa02 pulses reset the trial, remove food, and stimulate one named cell for 500 ms model time. Their turn sign verifies the decoder assignment, not a biological movement experiment or odor attraction.

## Executed experiments

`olfaction-results.json` retains all 24 trials (8 conditions × seeds 17, 42, 91), model parameters, source revisions, and timing measurements. Each trial runs 500 ms of model time from rest. This is a short diagnostic, not a statistical behavioral benchmark.

| Condition | DM1 projection response | DNa02 outcome |
| --- | --- | --- |
| No external input | 0 Hz for all seeds | Silent |
| Left odor (0.6) | 365–367 Hz mean across the two PNs | Left 82–88 Hz; right 0–2 Hz |
| Right odor (0.6) | 358–363 Hz | Left 78–84 Hz; right 0–4 Hz |
| Graph disconnected, left odor retained | 0 Hz | Silent |
| ORN outgoing synapses silenced, left input retained | 0 Hz | Silent |
| Direct left/right DNa02 pulses | No ORN input | Stimulated side responds; opposite decoder signs |

**Positive result:** the stimulated ORNs causally drive downstream activity through the graph. **Negative result:** switching odor side does not reverse the dominant DNa02 response. This model therefore fails the directional criterion needed for a claim of odor-guided approach. Removing the old unconditional maximum-speed regime is not the same as providing motivation or successful foraging.

Next investigations should separate decoder assumptions, anatomical asymmetries, missing sensory/context inputs, and dynamics. Wind/heading integration is a hypothesis to investigate against literature and data; no compass angles, appetitive value, or goal direction should be invented to make the fly reach food. An additional task is comparison against the Brian2 reference at matched connectivity and stimulation, including odor-offset and longer-duration stability checks.

## Reproduce

```
node scripts/probe-olfaction.js --save
node --test --test-isolation=none tests/circuit.test.js tests/simulation.test.js
```

To rebuild the derived annotation and transmitter artifacts, obtain the two exact files identified by the hashes/revisions in `public/data/circuits.json`, then run:

```
python scripts/build-circuit-annotations.py \
  --neurons /path/to/upstream/neurons.csv.gz \
  --annotations /path/to/v2.1.0/Supplemental_file1_neuron_annotations.tsv \
  --output-dir /tmp/rebuilt-circuits
```

The rebuilt artifacts were compared byte-for-byte with the committed data. This command does not download files or fit parameters. Source mismatch aborts generation. The browser separately verifies the circuit metadata and transmitter-sign hashes.
