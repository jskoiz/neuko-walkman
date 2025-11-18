import type { Track } from '../types/track';

interface PlaylistPanelProps {
  currentPlaylistName: string | null;
  currentPlaylistTracks: Track[];
  currentTrackIndex: number;
  onTrackSelect: (index: number) => void;
  isVisible: boolean;
}

export function PlaylistPanel({
  currentPlaylistName,
  currentPlaylistTracks,
  currentTrackIndex,
  onTrackSelect,
  isVisible,
}: PlaylistPanelProps) {
  // Calculate height to match 3 rows of buttons (35px each) + gaps (4px * 2)
  // Button grid height: 35 * 3 + 4 * 2 = 113px
  const panelHeight = 35 * 3 + 4 * 2; // 113px total

  const panelStyle: React.CSSProperties = {
    width: '280px',
    height: `${panelHeight}px`,
    backgroundColor: '#ffffff',
    border: '1px solid #BFBFBF',
    boxShadow: '#BFBFBF 2px 2px 0px 0px',
    borderRadius: '6px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    padding: '4px 8px',
    borderBottom: '1px solid #BFBFBF',
    backgroundColor: '#f5f5f5',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: '20px',
  };

  const titleStyle: React.CSSProperties = {
    fontFamily: 'Roboto, sans-serif',
    fontSize: '11px',
    fontWeight: 400,
    color: '#666666',
    margin: 0,
    textTransform: 'none',
  };

  const trackListStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '6px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };

  const trackItemStyle = (isCurrent: boolean): React.CSSProperties => ({
    padding: '6px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: isCurrent ? '#e0e0e0' : 'transparent',
    border: isCurrent ? '1px solid #BFBFBF' : '1px solid transparent',
    transition: 'background-color 0.2s ease',
  });

  const trackNameStyle = (isCurrent: boolean): React.CSSProperties => ({
    fontFamily: 'Roboto, sans-serif',
    fontSize: '12px',
    fontWeight: isCurrent ? 700 : 400,
    color: '#000000',
    marginBottom: '2px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  });

  const trackFileNameStyle: React.CSSProperties = {
    fontFamily: 'Roboto Mono, monospace',
    fontSize: '10px',
    color: '#666666',
    fontStyle: 'italic',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div style={panelStyle}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>
            Playlist: {currentPlaylistName || 'No Playlist'}
          </h3>
        </div>
        
        <div style={trackListStyle}>
          {currentPlaylistTracks.length === 0 ? (
            <div style={{ padding: '10px', color: '#666666', textAlign: 'center', fontSize: '12px' }}>
              No tracks
            </div>
          ) : (
            currentPlaylistTracks.map((track, index) => {
              const isCurrent = index === currentTrackIndex;
              return (
                <div
                  key={`${track.fileName}-${index}`}
                  style={trackItemStyle(isCurrent)}
                  onClick={() => onTrackSelect(index)}
                  onMouseEnter={(e) => {
                    if (!isCurrent) {
                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrent) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div style={trackNameStyle(isCurrent)}>
                    {track.trackName || track.fileName}
                  </div>
                  <div style={trackFileNameStyle}>
                    {track.fileName.split('/').pop() || track.fileName}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
  );
}
