import React, { useRef, useEffect, useState } from 'react';

export default function Player({
  currentTime,
  isPlaying,
  setIsPlaying,
  aspectRatio,
  clips,
  textOverlays,
  activeSelection,
  onUpdateTextProperty,
  onUpdateClipProperty,
  playerKey
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  
  const [activeClip, setActiveClip] = useState(null);
  const [activeTexts, setActiveTexts] = useState([]);
  
  // Find which clip is active at the current playhead time
  useEffect(() => {
    const current = currentTime;
    const active = clips.find(clip => current >= clip.timelineStart && current < clip.timelineEnd);
    setActiveClip(active || null);

    // Find all active text overlays
    const texts = textOverlays.filter(text => current >= text.timelineStart && current < text.timelineEnd);
    setActiveTexts(texts);
  }, [currentTime, clips, textOverlays]);

  // Synchronize HTML5 video element with playback states
  useEffect(() => {
    if (!videoRef.current || !activeClip) return;
    
    const video = videoRef.current;
    
    // Calculate relative time inside the current clip
    const elapsedTimelineMs = currentTime - activeClip.timelineStart;
    const targetVideoTimeSec = (activeClip.trimStart + elapsedTimelineMs) / 1000;
    
    // Volume amplifier
    video.volume = activeClip.volume !== undefined ? activeClip.volume : 1.0;
    
    // Playback Speed modifier
    video.playbackRate = activeClip.speed || 1.0;

    // Prevent aggressive infinite seeking loops, only seek if drifts exceed 150ms
    const drift = Math.abs(video.currentTime - targetVideoTimeSec);
    if (drift > 0.15) {
      video.currentTime = targetVideoTimeSec;
    }

    // Play or Pause sync
    if (isPlaying) {
      if (video.paused) {
        video.play().catch(() => {});
      }
    } else {
      if (!video.paused) {
        video.pause();
      }
    }
  }, [currentTime, isPlaying, activeClip]);

  // Synchronize play/pause click directly
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  // Video playback scrubber utility: formats ms -> hh:mm:ss.ms
  const formatScrubTime = (ms) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  // Visual Aspect classes
  const aspectClass = 
    aspectRatio === '16:9' ? 'aspect-16-9' :
    aspectRatio === '9:16' ? 'aspect-9-16' :
    aspectRatio === '1:1' ? 'aspect-1-1' : 'aspect-21-9';

  // Crop guide overlay mousedown handler
  const [cropStart, setCropStart] = useState(null);
  const [currentCrop, setCurrentCrop] = useState(null);

  const handleCropMouseDown = (e) => {
    if (!activeClip || !activeClip.cropActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    setCropStart({ x: startX, y: startY });
    setCurrentCrop({ x: startX, y: startY, w: 0, h: 0 });
  };

  const handleCropMouseMove = (e) => {
    if (!cropStart || !currentCrop) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const x = Math.min(cropStart.x, currentX);
    const y = Math.min(cropStart.y, currentY);
    const w = Math.abs(cropStart.x - currentX);
    const h = Math.abs(cropStart.y - currentY);

    setCurrentCrop({ x, y, w, h });
  };

  const handleCropMouseUp = (e) => {
    if (!cropStart || !currentCrop) return;
    const rect = e.currentTarget.getBoundingClientRect();
    
    // Scale crop selection values to source percentages or relative pixel guides
    // For FFmpeg rendering, we scale pixels relative to resolution width/height
    const cropParams = {
      x: Math.round(currentCrop.x),
      y: Math.round(currentCrop.y),
      w: Math.round(currentCrop.w),
      h: Math.round(currentCrop.h)
    };

    if (cropParams.w > 20 && cropParams.h > 20) {
      onUpdateClipProperty('crop', cropParams);
    }
    
    setCropStart(null);
    setCurrentCrop(null);
  };

  return (
    <div className="player-container">
      {/* Video Outer aspect viewport */}
      <div ref={containerRef} className={`player-aspect-wrapper ${aspectClass}`}>
        {activeClip ? (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <video
              ref={videoRef}
              key={`${playerKey}-${activeClip.id}`}
              src={`clip-media:///${activeClip.filePath}`}
              className={`player-video-renderer ${activeClip.layout === 'fit' ? 'fit' : ''}`}
              style={{
                transform: `scale(${activeClip.scale || 1})`,
                opacity: activeClip.opacity !== undefined ? activeClip.opacity : 1.0,
                filter: activeClip.filterPreset || 'none',
                transition: 'transform 0.1s ease'
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            
            {/* Interactive Custom Crop Drawing overlay */}
            {activeClip.cropActive && (
              <div
                className="crop-overlay-layer"
                onMouseDown={handleCropMouseDown}
                onMouseMove={handleCropMouseMove}
                onMouseUp={handleCropMouseUp}
              >
                {currentCrop && (
                  <div style={{
                    position: 'absolute',
                    border: '2px dashed var(--accent-cyan)',
                    background: 'rgba(0, 229, 255, 0.1)',
                    boxShadow: '0 0 12px var(--accent-cyan-glow)',
                    left: `${currentCrop.x}px`,
                    top: `${currentCrop.y}px`,
                    width: `${currentCrop.w}px`,
                    height: `${currentCrop.h}px`,
                    pointerEvents: 'none'
                  }} />
                )}
                
                {activeClip.crop && !currentCrop && (
                  <div style={{
                    position: 'absolute',
                    border: '2px solid var(--accent-cyan)',
                    background: 'rgba(0, 229, 255, 0.05)',
                    boxShadow: '0 0 12px var(--accent-cyan-glow)',
                    left: `${activeClip.crop.x}px`,
                    top: `${activeClip.crop.y}px`,
                    width: `${activeClip.crop.w}px`,
                    height: `${activeClip.crop.h}px`,
                    pointerEvents: 'none'
                  }}>
                    <span style={{ position: 'absolute', top: '-18px', left: '0', fontSize: '9px', background: 'var(--accent-cyan)', color: '#000', padding: '1px 4px', fontWeight: 'bold' }}>
                      CROP SELECTED: {activeClip.crop.w}x{activeClip.crop.h}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Empty Black Screen view */
          <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
            Empty Timeline Scrubber
          </div>
        )}

        {/* Real-time Text Overlays Layer */}
        <div className="text-overlay-renderer">
          {activeTexts.map((text) => (
            <div
              key={text.id}
              className={`text-layer-block ${activeSelection?.id === text.id ? 'selected' : ''}`}
              style={{
                fontSize: `${text.size || 24}px`,
                color: text.color || '#ffffff',
                backgroundColor: text.bgColor ? `${text.bgColor}${Math.round((text.bgOpacity !== undefined ? text.bgOpacity : 0.6) * 255).toString(16).padStart(2, '0')}` : 'transparent',
                borderRadius: '4px',
                border: activeSelection?.id === text.id ? '1px dashed var(--accent-cyan)' : 'none',
                // Text preset outline memes style fallback
                WebkitTextStroke: text.id.includes('meme') ? '1px #000' : 'none'
              }}
            >
              {text.text}
            </div>
          ))}
        </div>
      </div>

      {/* Control Navigation Strip */}
      <div className="player-controls">
        <button
          className="control-btn"
          onClick={() => onUpdateClipProperty && onUpdateClipProperty('resetTimeline', true)}
          title="Go to Start"
        >
          <svg viewBox="0 0 24 24">
            <path d="M6 6h2v12H6zm3.5 6L18 6v12z" />
          </svg>
        </button>
        <button
          className="control-btn play-pause-btn"
          onClick={handlePlayPause}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>
        <button
          className="control-btn"
          onClick={() => onUpdateClipProperty && onUpdateClipProperty('forwardFrame', true)}
          title="Forward 1 Frame"
        >
          <svg viewBox="0 0 24 24">
            <path d="M5 13h11.86l-5.43 5.43 1.42 1.42L21.14 12l-8.29-8.29-1.42 1.42L16.86 11H5v2z" />
          </svg>
        </button>

        {/* Timecodes Scrub Displays */}
        <div className="player-timecode">
          {formatScrubTime(currentTime)}
        </div>
      </div>
    </div>
  );
}
