import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const musicDir = path.join(rootDir, 'public', 'music');

/**
 * Recursively scan a directory for audio files
 */
function scanDirectory(dirPath, relativePath = '') {
  const files = [];
  const items = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    const relativeFilePath = path.join(relativePath, item.name).replace(/\\/g, '/');

    if (item.isDirectory()) {
      // Recursively scan subdirectories
      const subFiles = scanDirectory(fullPath, relativeFilePath);
      files.push(...subFiles);
    } else if (item.isFile()) {
      // Check if it's an audio file
      const ext = path.extname(item.name).toLowerCase();
      if (['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'].includes(ext)) {
        files.push(relativeFilePath);
      }
    }
  }

  return files;
}

/**
 * Generate playlists from folder structure
 */
function generatePlaylists() {
  if (!fs.existsSync(musicDir)) {
    console.log('Music directory does not exist, creating it...');
    fs.mkdirSync(musicDir, { recursive: true });
    return { playlists: [] };
  }

  const playlists = [];
  const items = fs.readdirSync(musicDir, { withFileTypes: true });
  
  // Check if there are subdirectories (playlists) or just files (single playlist)
  const directories = items.filter(item => item.isDirectory());
  const files = items.filter(item => item.isFile() && /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(item.name));

  if (directories.length > 0) {
    // Multiple playlists (folders)
    directories.forEach((dir, index) => {
      const playlistPath = path.join(musicDir, dir.name);
      const audioFiles = scanDirectory(playlistPath, dir.name);
      
      if (audioFiles.length > 0) {
        const tracks = audioFiles.map((file, trackIndex) => {
          const fileName = path.basename(file);
          const trackName = fileName.replace(/\.[^/.]+$/, '');
          
          return {
            trackNumber: trackIndex + 1,
            trackName: trackName,
            fileName: `/music/${file}`,
            duration: '0:00',
            playlistName: dir.name,
            playlistIndex: index + 1,
            playlistTotal: directories.length,
            playlistPath: `/music/${dir.name}`
          };
        });

        playlists.push({
          name: dir.name,
          path: `/music/${dir.name}`,
          index: index + 1,
          total: directories.length,
          tracks: tracks
        });
      }
    });
  } else if (files.length > 0) {
    // Single playlist (files in root music folder)
    const tracks = files.map((file, index) => {
      const fileName = file.name;
      const trackName = fileName.replace(/\.[^/.]+$/, '');
      
      return {
        trackNumber: index + 1,
        trackName: trackName,
        fileName: `/music/${fileName}`,
        duration: '0:00',
        playlistName: 'Default',
        playlistIndex: 1,
        playlistTotal: 1,
        playlistPath: '/music'
      };
    });

    playlists.push({
      name: 'Default',
      path: '/music',
      index: 1,
      total: 1,
      tracks: tracks
    });
  }

  return { playlists };
}

// Generate and write playlists.json
try {
  console.log('Scanning music directory for playlists...');
  const playlistsData = generatePlaylists();
  const outputPath = path.join(rootDir, 'src', 'config', 'playlists.json');
  
  fs.writeFileSync(outputPath, JSON.stringify(playlistsData, null, 2));
  console.log(`✓ Generated playlists.json with ${playlistsData.playlists.length} playlist(s)`);
  playlistsData.playlists.forEach(playlist => {
    console.log(`  - ${playlist.name}: ${playlist.tracks.length} track(s)`);
  });
} catch (error) {
  console.error('Error generating playlists:', error);
  process.exit(1);
}

