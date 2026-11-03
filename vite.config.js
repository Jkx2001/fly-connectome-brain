import { defineConfig } from 'vite';

// Relative URLs keep the production bundle usable beneath preview prefixes
// and repository subdirectories, rather than assuming the domain root.
export default defineConfig({ base: './' });
