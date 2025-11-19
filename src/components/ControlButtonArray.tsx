import React from 'react';
import { 
  Volume2, 
  Volume1,
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  SkipBack,
  SkipForward
} from 'lucide-react';

interface ControlButtonArrayProps {
  isPlaying: boolean;
  isPaused: boolean;
  onPlayPause: () => void;
  onPause: () => void;
  onPreviousTrack: () => void;
  onNextTrack: () => void;
  onVolumeUp: () => void;
  onVolumeDown: () => void;
  onPreviousPlaylist: () => void;
  onNextPlaylist: () => void;
  onTogglePlaylist: () => void;
  isPlaylistVisible: boolean;
  isMobile?: boolean;
}

export function ControlButtonArray({
  isPlaying,
  isPaused,
  onPlayPause,
  onPause,
  onPreviousTrack,
  onNextTrack,
  onVolumeUp,
  onVolumeDown,
  onPreviousPlaylist,
  onNextPlaylist,
  onTogglePlaylist,
  isPlaylistVisible,
  isMobile = false,
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
    transition: 'all 0.2s ease',
    backgroundColor: '#ffffff',
    padding: 0,
    position: 'relative',
  };

  const buttonHoverStyle: React.CSSProperties = {
    opacity: 0.9,
    transform: 'translateY(-1px)',
    boxShadow: '#BFBFBF 3px 3px 0px 0px',
  };

  const buttonActiveStyle: React.CSSProperties = {
    transform: 'translateY(1px)',
    boxShadow: '#BFBFBF 1px 1px 0px 0px',
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
            e.currentTarget.style.removeProperty('transform');
            e.currentTarget.style.removeProperty('box-shadow');
            if (!(isPlaying && !isPaused && customStyle?.backgroundColor === '#e0e0e0')) {
              e.currentTarget.style.backgroundColor = '#ffffff';
            }
          }}
          onMouseDown={(e) => {
            Object.assign(e.currentTarget.style, buttonActiveStyle);
          }}
          onMouseUp={(e) => {
            Object.assign(e.currentTarget.style, buttonHoverStyle);
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

  // Calculate height for tall playlist toggle button to match 4 rows
  // 4 rows * 35px + 3 gaps * 4px = 140px + 12px = 152px
  const playlistToggleButtonHeight = 35 * 4 + 4 * 3; // 152px

  // Mobile: single row of 8 buttons, Desktop: 2x4 grid
  const buttonContainerStyle: React.CSSProperties = isMobile
    ? {
        display: 'flex',
        flexDirection: 'row',
        gap: '4px',
        width: '100%',
        justifyContent: 'center',
        flexWrap: 'wrap',
      }
    : {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, auto)',
        gridTemplateRows: 'repeat(4, auto)',
        gap: '4px',
        padding: 0,
        width: 'fit-content',
      };

  return (
    <div className="control-button-array" style={{ display: 'flex', gap: '4px', alignItems: 'flex-start', width: isMobile ? '100%' : 'auto' }}>
      <div className="button-grid" style={buttonContainerStyle}>
        {/* Button 1: Previous Track */}
        <ButtonWithTooltip
          onClick={onPreviousTrack}
          ariaLabel="Previous Track"
          tooltip="Previous Track"
        >
          <ChevronLeft size={20} color={getIconColor()} />
        </ButtonWithTooltip>
        
        {/* Button 2: Next Track */}
        <ButtonWithTooltip
          onClick={onNextTrack}
          ariaLabel="Next Track"
          tooltip="Next Track"
        >
          <ChevronRight size={20} color={getIconColor()} />
        </ButtonWithTooltip>

        {/* Button 3: Previous Playlist */}
        <ButtonWithTooltip
          onClick={onPreviousPlaylist}
          ariaLabel="Previous Playlist"
          tooltip="Previous Playlist"
        >
          <SkipBack size={16} color={getIconColor()} />
        </ButtonWithTooltip>
        
        {/* Button 4: Next Playlist */}
        <ButtonWithTooltip
          onClick={onNextPlaylist}
          ariaLabel="Next Playlist"
          tooltip="Next Playlist"
        >
          <SkipForward size={16} color={getIconColor()} />
        </ButtonWithTooltip>

        {/* Button 5: Pause */}
        <ButtonWithTooltip
          onClick={onPause}
          ariaLabel="Pause"
          tooltip="Pause"
          customStyle={{
            backgroundColor: isPaused ? '#e0e0e0' : '#ffffff',
          }}
        >
          <Pause size={16} color={getIconColor()} fill={isPaused ? getIconColor() : 'none'} />
        </ButtonWithTooltip>
        
        {/* Button 6: Play/Pause */}
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

        {/* Button 7: Volume Down */}
        <ButtonWithTooltip
          onClick={onVolumeDown}
          ariaLabel="Volume Down"
          tooltip="Volume Down"
        >
          <Volume1 size={16} color={getIconColor()} />
        </ButtonWithTooltip>
        
        {/* Button 8: Volume Up */}
        <ButtonWithTooltip
          onClick={onVolumeUp}
          ariaLabel="Volume Up"
          tooltip="Volume Up"
        >
          <Volume2 size={16} color={getIconColor()} />
        </ButtonWithTooltip>
      </div>
      
      {/* Tall thin playlist toggle button - hidden on mobile */}
      {!isMobile && (
        <ButtonWithTooltip
          onClick={onTogglePlaylist}
          ariaLabel={isPlaylistVisible ? 'Hide Playlist' : 'Show Playlist'}
          tooltip={isPlaylistVisible ? 'Hide Playlist' : 'Show Playlist'}
          customStyle={{
            height: `${playlistToggleButtonHeight}px`,
            width: '24px',
          }}
        >
          {isPlaylistVisible ? (
            <ChevronRight size={14} color={getIconColor()} />
          ) : (
            <ChevronLeft size={14} color={getIconColor()} />
          )}
        </ButtonWithTooltip>
      )}
    </div>
  );
}

