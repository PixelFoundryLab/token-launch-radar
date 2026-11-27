// The dashboard's data: the whole dataset as one script the page reads, no fetch and no network.

import type { RadarData } from './protocolRank.ts';

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
