/**
 * Generate playlists from local filesystem
 * Uses unified playlist generator with local filesystem strategy
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generatePlaylists } from '../src/utils/playlist-generator';
import { LocalFileSystemStrategy } from '../src/utils/strategies/local-fs-strategy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const musicDir = path.join(rootDir, 'public', 'music');

// Generate and write playlists.json
try {
  console.log('Scanning music directory for playlists...');
  
  // Create local filesystem strategy
  const strategy = new LocalFileSystemStrategy();
  
  // Generate playlists using unified generator
  const playlistsData = await generatePlaylists(strategy, musicDir);
  
  const outputPath = path.join(rootDir, 'src', 'config', 'playlists.json');
  
  fs.writeFileSync(outputPath, JSON.stringify(playlistsData, null, 2));
  console.log(`✓ Generated playlists.json with ${playlistsData.playlists.length} playlist(s)`);
  playlistsData.playlists.forEach(playlist => {
    console.log(`  - ${playlist.name}: ${playlist.tracks.length} track(s)`);
  });
} catch (error: any) {
  console.error('Error generating playlists:', error);
  process.exit(1);
}


