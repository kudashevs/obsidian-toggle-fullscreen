import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const here = fileURLToPath(new URL('.', import.meta.url));

// comma-separated Obsidian app versions, e.g. "1.0.0,latest" (CI passes one per matrix job)
const versions = (process.env.OBSIDIAN_VERSIONS ?? '1.0.0,1.1.1,latest')
  .split(',')
  .map((version) => version.trim())
  .filter(Boolean);

export const config: WebdriverIO.Config = {
  runner: 'local',
  framework: 'mocha',
  specs: [`${here}/**/*.e2e.ts`],
  maxInstances: 1,

  capabilities: versions.map((version) => ({
    browserName: 'obsidian',
    browserVersion: version,
    'wdio:obsidianOptions': {
      // oldest Electron that can run this app version, the worst case for users
      installerVersion: 'earliest',
      plugins: [root],
      vault: `${here}/vault`,
    },
  })),

  services: ['obsidian'],
  cacheDir: `${root}/.obsidian-cache`,

  mochaOpts: {
    ui: 'bdd',
    timeout: 60_000,
  },
  logLevel: 'warn',
};
