# Fly Table

A browser POC with an interactive 3D tabletop and the full packaged FlyWire FAFB v783 graph: 139,255 neural units and 2,698,236 directed neuron-pair edges. Simulation runs locally in a Web Worker. No LLM, trained controller, or scripted food-seeking is used.

## Run

Requires Node.js 22.12+ (tested with Node 24).

```sh
npm ci
npm run dev
```

Open the address printed by Vite. Use HTTPS or localhost; integrity checking requires a secure browser context. The repository `index.html` also supports a plain HTTP static preview, using locally bundled Three.js files in `public/vendor/`; it needs no Vite server, CDN, or access to `node_modules`. Direct `file://` opening is unsupported because browsers restrict module workers. The first load reads approximately 12 MB of bundled graph data. A WebGL-capable browser is required for the tabletop.

For a production server, run `npm run build` then `npm run preview`. Deploy the complete `dist` directory, including `data/` and the worker asset. The loader verifies both opaque gzip bytes and responses transparently decompressed by an HTTP server. It never disables integrity verification to recover from a corrupt download.

## Interact

- Food: click the tabletop to place food.
- Walls: click to place a wall; drag an existing wall to move it.
- Touch: click near the fly for a mechanosensory pulse.
- Right-drag to orbit; scroll to zoom. Two-finger gestures orbit/zoom on touchscreens.
- Pause, advance one fixed 20 ms step, or reset. Space toggles pause; `.` steps; `R` resets.
- Wiring controls reset the brain and world to the same seed. Off disables synaptic propagation while keeping sensory drive.
- Export a run as JSON. Replay it with `node scripts/replay.js path/to/export.json` to compare the complete final world state.

## What is measured and what is modeled

The graph is copied from [snedea/flybrain](https://github.com/snedea/flybrain/tree/9191824d17871b7851645782d53d23f213ddb938), pinned at commit `9191824d17871b7851645782d53d23f213ddb938`. The manifest records the source and compressed/decompressed SHA-256 hashes. Neuron pool membership comes from the corresponding `classification.csv.gz` and canonical ordering in `neurons.csv.gz`. All packaged nodes and edges are retained. This is not an independent audit of the FlyWire reconstruction or upstream packaging.

Underlying research: Dorkenwald et al., *Neuronal wiring diagram of an adult brain*, Nature 634, 124–138 (2024), [doi:10.1038/s41586-024-07558-y](https://doi.org/10.1038/s41586-024-07558-y).

Important modeling assumptions:

- All units use identical LIF parameters. Incoming signed synapse-count weights are normalized by total incoming absolute weight, with gain 18. Transmitter signs inherit upstream simplifications, including excitatory glutamate.
- Odor is an analytic distance-decaying field; walls do not occlude it. Left/right samples drive broad annotated olfactory pools with seeded random pulses. No glomerulus-specific receptor model is supplied.
- Ambient light stimulates visual inputs; proximity and manual touch stimulate mechanosensory pools; food contact stimulates sugar/water gustatory neurons.
- Smoothed activity of annotated left/right descending neurons drives a fixed artificial speed/turn decoder. It never sees food coordinates. Brain-only data does not supply the ventral nerve cord, legs, flight, or muscles. Body animation and collision constraints are authored.
- No learning is implemented. Movement is **not** evidence of successful foraging or biological fidelity. Measured-versus-shuffled effects alone do not establish biological accuracy.

The shuffled control applies a deterministic permutation of destination identities, leaving sensory and readout labels fixed. Edge count, edge weights, source degrees, and destination degree distribution remain; destination assignments change. It is one control, not a complete statistical null model.

## Validate

```sh
npm test
npm run build
npm run benchmark
```

For browser regressions, start the dev server, then run `npx playwright test`. The configuration uses `/usr/bin/chromium`; set `CHROMIUM_PATH` for another installation. Set `TEST_URL` to test a production server. The tests cover actual startup, gzip transport variants, corruption rejection, controls, export, and the visible entry-module failure fallback. Model tests check full-graph propagation controls, repeatability, and collision constraints.

Performance figures from `benchmark` are local measurements, not a cross-device guarantee. Model time advances at 20 ms per step regardless of rendering rate. Slow machines can run below real time. Hidden tabs pause automatically. Exports retain up to 18,000 trajectory samples plus the action history; replay reconstructs the final state from the seed and actions.

To test the plain static preview with no Vite or node_modules access, run `STATIC_PREVIEW=1 npx playwright test`. This starts an isolated localhost server exposing only `index.html`, `src/`, and `public/`, beneath a URL prefix. Three.js 0.180.0 browser files and its MIT license are retained in `public/vendor/three/`.
