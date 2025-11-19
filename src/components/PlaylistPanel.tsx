import { useEffect, useRef, useState } from 'react';
import type { Track } from '../types/track';
import { KEYBOARD_SHORTCUTS } from '../constants';

interface PlaylistPanelProps {
  currentPlaylistName: string | null;
  currentPlaylistTracks: Track[];
  currentTrackIndex: number;
  onTrackSelect: (index: number) => void;
  isVisible: boolean;
  isExtended?: boolean;
  onToggleExtended?: () => void;
}

export function PlaylistPanel({
  currentPlaylistName,
  currentPlaylistTracks,
  currentTrackIndex,
  onTrackSelect,
  isVisible,
  isExtended = false,
  onToggleExtended,
}: PlaylistPanelProps) {
  const [focusedIndex, setFocusedIndex] = useState(currentTrackIndex);
  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // Calculate height to match 4 rows of buttons (35px each) + gaps (4px * 3)
  // Button grid height: 35 * 4 + 4 * 3 = 152px
  // Extended height: allow more tracks to be visible, but respect viewport
  const basePanelHeight = 35 * 4 + 4 * 3; // 152px for 4 rows
  
  // Calculate max height based on viewport, accounting for footer and margins
  const [maxHeight, setMaxHeight] = useState(() => {
    if (typeof window !== 'undefined') {
      // Footer is ~100px from bottom, plus margins and padding
      const availableHeight = window.innerHeight - 280;
      return Math.max(basePanelHeight, Math.min(availableHeight, basePanelHeight + 400));
    }
    return basePanelHeight + 300;
  });
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const calculateMaxHeight = () => {
        // Get the button array container position to calculate available space
        const buttonContainer = document.querySelector('.button-array-container');
        if (buttonContainer) {
          const rect = buttonContainer.getBoundingClientRect();
          const footerHeight = 100; // Approximate footer height + margin
          const availableHeight = window.innerHeight - rect.top - footerHeight - 20; // 20px margin
          return Math.max(basePanelHeight, Math.min(availableHeight, basePanelHeight + 400));
        }
        // Fallback calculation
        const availableHeight = window.innerHeight - 280;
        return Math.max(basePanelHeight, Math.min(availableHeight, basePanelHeight + 400));
      };
      setMaxHeight(calculateMaxHeight());
      
      window.addEventListener('resize', calculateMaxHeight);
      return () => window.removeEventListener('resize', calculateMaxHeight);
    }
  }, [basePanelHeight]);
  
  const extendedPanelHeight = isExtended ? maxHeight : basePanelHeight;
  const panelHeight = Math.min(extendedPanelHeight, maxHeight);

  // Sync focused index with current track
  useEffect(() => {
    if (isVisible) {
      setFocusedIndex(currentTrackIndex);
    }
  }, [currentTrackIndex, isVisible]);

  // Scroll focused track into view
  useEffect(() => {
    if (isVisible && trackRefs.current[focusedIndex]) {
      trackRefs.current[focusedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [focusedIndex, isVisible]);

  // Keyboard navigation
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case KEYBOARD_SHORTCUTS.ARROW_UP:
          e.preventDefault();
          setFocusedIndex((prev) => {
            const newIndex = Math.max(0, prev - 1);
            return newIndex;
          });
          break;
        case KEYBOARD_SHORTCUTS.ARROW_DOWN:
          e.preventDefault();
          setFocusedIndex((prev) => {
            const newIndex = Math.min(currentPlaylistTracks.length - 1, prev + 1);
            return newIndex;
          });
          break;
        case KEYBOARD_SHORTCUTS.ENTER:
          e.preventDefault();
          onTrackSelect(focusedIndex);
          break;
        case KEYBOARD_SHORTCUTS.ESCAPE:
          // Let parent handle this
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible, focusedIndex, currentPlaylistTracks.length, onTrackSelect]);

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
    transition: 'height 0.3s ease',
    position: 'absolute',
    left: '100%',
    marginLeft: '4px',
    top: 0,
    maxHeight: `${maxHeight}px`, // Use calculated max height
  };

  const headerStyle: React.CSSProperties = {
    padding: '4px 8px',
    borderBottom: '1px solid #BFBFBF',
    backgroundColor: '#f5f5f5',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: '20px',
    cursor: onToggleExtended ? 'pointer' : 'default',
    userSelect: 'none',
  };

  const dragHandleStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'grab',
    padding: '2px 4px',
    borderRadius: '4px',
    transition: 'background-color 0.2s ease',
  };

  const handleIconStyle: React.CSSProperties = {
    width: '12px',
    height: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    justifyContent: 'center',
  };

  const handleDotStyle: React.CSSProperties = {
    width: '3px',
    height: '3px',
    backgroundColor: '#999',
    borderRadius: '50%',
  };

  const titleStyle: React.CSSProperties = {
    fontFamily: 'Roboto, sans-serif',
    fontSize: '11px',
    fontWeight: 400,
    color: '#666666',
    margin: 0,
    textTransform: 'none',
  };

  const countStyle: React.CSSProperties = {
    fontFamily: 'Roboto, sans-serif',
    fontSize: '10px',
    fontWeight: 400,
    color: '#999999',
    margin: 0,
  };

  const trackListStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '6px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minHeight: 0, // Important for flex scrolling
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

  const totalTracks = currentPlaylistTracks.length;
  const currentPosition = currentTrackIndex + 1;

  return (
    <div style={panelStyle}>
        <div 
          style={headerStyle}
          onClick={onToggleExtended}
          onMouseEnter={(e) => {
            if (onToggleExtended) {
              e.currentTarget.style.backgroundColor = '#e8e8e8';
            }
          }}
          onMouseLeave={(e) => {
            if (onToggleExtended) {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
            }
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onToggleExtended && (
              <div 
                style={dragHandleStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e0e0e0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={handleIconStyle}>
                  <div style={handleDotStyle}></div>
                  <div style={handleDotStyle}></div>
                  <div style={handleDotStyle}></div>
                </div>
                <div style={handleIconStyle}>
                  <div style={handleDotStyle}></div>
                  <div style={handleDotStyle}></div>
                  <div style={handleDotStyle}></div>
                </div>
              </div>
            )}
            <h3 style={titleStyle}>
              Playlist: {currentPlaylistName || 'No Playlist'}
            </h3>
          </div>
          {totalTracks > 0 && (
            <span style={countStyle}>
              {currentPosition}/{totalTracks}
            </span>
          )}
        </div>
        
        <div style={trackListStyle}>
          {currentPlaylistTracks.length === 0 ? (
            <div style={{ padding: '10px', color: '#666666', textAlign: 'center', fontSize: '12px' }}>
              No tracks
            </div>
          ) : (
            currentPlaylistTracks.map((track, index) => {
              const isCurrent = index === currentTrackIndex;
              const isFocused = index === focusedIndex;
              return (
                <div
                  key={`${track.fileName}-${index}`}
                  ref={(el) => {
                    trackRefs.current[index] = el;
                  }}
                  style={{
                    ...trackItemStyle(isCurrent),
                    backgroundColor: isFocused && !isCurrent ? '#f0f0f0' : trackItemStyle(isCurrent).backgroundColor,
                    outline: isFocused ? '2px solid #666' : 'none',
                    outlineOffset: '-2px',
                  }}
                  onClick={() => {
                    setFocusedIndex(index);
                    onTrackSelect(index);
                  }}
                  onMouseEnter={(e) => {
                    setFocusedIndex(index);
                    if (!isCurrent) {
                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrent && !isFocused) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Track ${index + 1}: ${track.trackName || track.fileName}`}
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
