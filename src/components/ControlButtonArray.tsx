import React from 'react';
import { 
  Volume2, 
  VolumeX, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  Square,
  SkipBack,
  SkipForward
} from 'lucide-react';

interface ControlButtonArrayProps {
  isPlaying: boolean;
  isPaused: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onPreviousTrack: () => void;
  onNextTrack: () => void;
  onVolumeUp: () => void;
  onVolumeDown: () => void;
  onPreviousPlaylist: () => void;
  onNextPlaylist: () => void;
  onTogglePlaylist: () => void;
  isPlaylistVisible: boolean;
}

export function ControlButtonArray({
  isPlaying,
  isPaused,
  onPlayPause,
  onStop,
  onPreviousTrack,
  onNextTrack,
  onVolumeUp,
  onVolumeDown,
  onPreviousPlaylist,
  onNextPlaylist,
  onTogglePlaylist,
  isPlaylistVisible,
}: ControlButtonArrayProps) {
  const buttonStyle: React.CSSProperties = {
    height: '35px',
    width: '35px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    border: '1px solid #BFBFBF',
    boxShadow: '#BFBFBF 2px 2px 0px 0px',
    transition: 'opacity 0.2s ease',
    backgroundColor: '#ffffff',
    padding: 0,
    position: 'relative',
  };

  const buttonHoverStyle: React.CSSProperties = {
    opacity: 0.8,
  };

  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 'calc(100% + 8px)',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '4px 8px',
    backgroundColor: '#ffffff',
    border: '1px solid #BFBFBF',
    boxShadow: '#BFBFBF 2px 2px 0px 0px',
    borderRadius: '6px',
    fontSize: '11px',
    fontFamily: 'Roboto, sans-serif',
    color: '#000000',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    opacity: 0,
    transition: 'opacity 0s',
    zIndex: 1000,
  };

  const buttonWrapperStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
  };

  const getIconColor = () => '#000000';

  const ButtonWithTooltip = ({ 
    onClick, 
    ariaLabel, 
    tooltip, 
    children, 
    customStyle 
  }: { 
    onClick: () => void; 
    ariaLabel: string; 
    tooltip: string; 
    children: React.ReactNode;
    customStyle?: React.CSSProperties;
  }) => {
    const [showTooltip, setShowTooltip] = React.useState(false);

    return (
      <div 
        style={buttonWrapperStyle}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <button
          style={{ ...buttonStyle, ...customStyle }}
          onMouseEnter={(e) => {
            Object.assign(e.currentTarget.style, buttonHoverStyle);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.removeProperty('opacity');
            if (!(isPlaying && !isPaused && customStyle?.backgroundColor === '#e0e0e0')) {
              e.currentTarget.style.backgroundColor = '#ffffff';
            }
          }}
          onClick={onClick}
          aria-label={ariaLabel}
          type="button"
        >
          {children}
        </button>
        <div
          style={{
            ...tooltipStyle,
            opacity: showTooltip ? 1 : 0,
          }}
        >
          {tooltip}
        </div>
      </div>
    );
  };

  return (
    <div className="control-button-array">
      <div className="button-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: '4px', padding: 0, width: 'fit-content' }}>
        {/* Row 1: Playlist controls */}
        <ButtonWithTooltip
          onClick={onPreviousPlaylist}
          ariaLabel="Previous Playlist"
          tooltip="Previous Playlist"
        >
          <SkipBack size={16} color={getIconColor()} />
        </ButtonWithTooltip>
        
        <ButtonWithTooltip
          onClick={onStop}
          ariaLabel="Stop"
          tooltip="Stop"
        >
          <Square size={16} color={getIconColor()} />
        </ButtonWithTooltip>
        
        <ButtonWithTooltip
          onClick={onNextPlaylist}
          ariaLabel="Next Playlist"
          tooltip="Next Playlist"
        >
          <SkipForward size={16} color={getIconColor()} />
        </ButtonWithTooltip>

        {/* Row 2: Track controls */}
        <ButtonWithTooltip
          onClick={onPreviousTrack}
          ariaLabel="Previous Track"
          tooltip="Previous Track"
        >
          <ChevronLeft size={20} color={getIconColor()} />
        </ButtonWithTooltip>
        
        <ButtonWithTooltip
          onClick={onPlayPause}
          ariaLabel={isPlaying && !isPaused ? 'Pause' : 'Play'}
          tooltip={isPlaying && !isPaused ? 'Pause' : 'Play'}
          customStyle={{
            backgroundColor: isPlaying && !isPaused ? '#e0e0e0' : '#ffffff',
          }}
        >
          {isPlaying && !isPaused ? (
            <Pause size={16} color={getIconColor()} fill={getIconColor()} />
          ) : (
            <Play size={16} color={getIconColor()} fill={getIconColor()} />
          )}
        </ButtonWithTooltip>
        
        <ButtonWithTooltip
          onClick={onNextTrack}
          ariaLabel="Next Track"
          tooltip="Next Track"
        >
          <ChevronRight size={20} color={getIconColor()} />
        </ButtonWithTooltip>

        {/* Row 3: Volume controls */}
        <ButtonWithTooltip
          onClick={onVolumeDown}
          ariaLabel="Volume Down"
          tooltip="Volume Down"
        >
          <VolumeX size={16} color={getIconColor()} />
        </ButtonWithTooltip>
        
        <ButtonWithTooltip
          onClick={onTogglePlaylist}
          ariaLabel={isPlaylistVisible ? 'Hide Playlist' : 'Show Playlist'}
          tooltip={isPlaylistVisible ? 'Hide Playlist' : 'Show Playlist'}
        >
          {isPlaylistVisible ? (
            <ChevronRight size={16} color={getIconColor()} />
          ) : (
            <ChevronLeft size={16} color={getIconColor()} />
          )}
        </ButtonWithTooltip>
        
        <ButtonWithTooltip
          onClick={onVolumeUp}
          ariaLabel="Volume Up"
          tooltip="Volume Up"
        >
          <Volume2 size={16} color={getIconColor()} />
        </ButtonWithTooltip>
      </div>
    </div>
  );
}

