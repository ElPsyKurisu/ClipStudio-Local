import React, { useRef, useEffect, useState } from 'react';

export default function Timeline({
  currentTime,
  setCurrentTime,
  clips,
  textOverlays,
  activeSelection,
  setActiveSelection,
  onSplitClip,
  onDeleteSelected,
  onUpdateClipProperty,
  onUpdateTextProperty,
  timelineZoom,
  setTimelineZoom
}) {
  const tracksBodyRef = useRef(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [dragInfo, setDragInfo] = useState(null); // Tracks active clip dragging

  // Timeline zoom: maps milliseconds to pixels
  // e.g. zoomLevel = 0.05 means 1000ms = 50px
  const msToPx = (ms) => Math.round(ms * timelineZoom);
  const pxToMs = (px) => Math.round(px / timelineZoom);

  // Convert client coordinates to timeline milliseconds, accounting for scroll and header offset
  const getMsFromEvent = (e) => {
    if (!tracksBodyRef.current) return 0;
    const rect = tracksBodyRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + tracksBodyRef.current.scrollLeft - 80;
    return pxToMs(x);
  };

  // Global total timeline duration estimate
  const getTimelineDuration = () => {
    let maxTime = 10000; // Minimal default 10s ruler
    clips.forEach(c => { if (c.timelineEnd > maxTime) maxTime = c.timelineEnd; });
    textOverlays.forEach(t => { if (t.timelineEnd > maxTime) maxTime = t.timelineEnd; });
    return maxTime + 5000; // Add extra padding
  };

  const totalDuration = getTimelineDuration();

  // 1. Playhead Drag Seeks Handler
  const handlePlayheadMouseDown = (e) => {
    setIsDraggingPlayhead(true);
  };

  const handleTracksClickOrDrag = (e) => {
    const targetMs = Math.max(0, Math.min(getMsFromEvent(e), totalDuration));
    setCurrentTime(targetMs);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (isDraggingPlayhead) {
        const targetMs = Math.max(0, Math.min(getMsFromEvent(e), totalDuration));
        setCurrentTime(targetMs);
      } else if (dragInfo) {
        const currentMs = getMsFromEvent(e);
        const deltaMs = currentMs - dragInfo.startMs;

        if (dragInfo.mode === 'slide') {
          const newStart = Math.max(0, dragInfo.initialStart + deltaMs);
          const duration = dragInfo.clip.timelineEnd - dragInfo.clip.timelineStart;
          const newEnd = newStart + duration;
          
          if (dragInfo.type === 'clip') {
            onUpdateClipProperty('timelineStart', newStart, dragInfo.clip.id);
            onUpdateClipProperty('timelineEnd', newEnd, dragInfo.clip.id);
          } else {
            onUpdateTextProperty('timelineStart', newStart, dragInfo.clip.id);
            onUpdateTextProperty('timelineEnd', newEnd, dragInfo.clip.id);
          }
        } else if (dragInfo.mode === 'trim-left') {
          // Trim start edge: shifts start time and increases trimStart
          const newStart = Math.max(0, Math.min(dragInfo.initialStart + deltaMs, dragInfo.initialEnd - 500));
          const trimDelta = newStart - dragInfo.initialStart;
          const newTrimStart = Math.max(0, dragInfo.initialTrimStart + trimDelta);
          
          onUpdateClipProperty('timelineStart', newStart, dragInfo.clip.id);
          onUpdateClipProperty('trimStart', newTrimStart, dragInfo.clip.id);
        } else if (dragInfo.mode === 'trim-right') {
          // Trim end edge: shifts timelineEnd and changes trimEnd
          const newEnd = Math.max(dragInfo.initialStart + 500, dragInfo.initialEnd + deltaMs);
          const trimDelta = newEnd - dragInfo.initialEnd;
          const newTrimEnd = Math.min(dragInfo.clip.duration, dragInfo.initialTrimEnd + trimDelta);
          
          onUpdateClipProperty('timelineEnd', newEnd, dragInfo.clip.id);
          onUpdateClipProperty('trimEnd', newTrimEnd, dragInfo.clip.id);
        }
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDraggingPlayhead(false);
      setDragInfo(null);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDraggingPlayhead, dragInfo, timelineZoom]);

  // Handle wheel events for horizontal scrolling and Ctrl+Wheel zooming
  useEffect(() => {
    const board = tracksBodyRef.current;
    if (!board) return;

    const handleWheel = (e) => {
      if (e.ctrlKey) {
        // Ctrl + Wheel: Zoom in/out
        e.preventDefault();
        const zoomDelta = e.deltaY < 0 ? 0.01 : -0.01;
        setTimelineZoom(prev => Math.max(0.01, Math.min(0.2, prev + zoomDelta)));
      } else {
        // Regular Wheel: Pan/Scroll Horizontally
        e.preventDefault();
        board.scrollLeft += e.deltaY + e.deltaX;
      }
    };

    board.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      board.removeEventListener('wheel', handleWheel);
    };
  }, [setTimelineZoom]);

  // Split and Delete key hotkeys mapping
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.key === 's' || e.key === 'S') {
        onSplitClip();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        onDeleteSelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSelection, currentTime]);

  return (
    <div className="timeline-container">
      {/* 1. Timeline Toolbar Strip */}
      <div className="timeline-toolbar">
        <div className="toolbar-group">
          {/* Split scissors button */}
          <button
            className="toolbar-btn"
            onClick={onSplitClip}
            title="Split Clip at Playhead (S hotkey)"
            disabled={!activeSelection || activeSelection.type !== 'clip'}
          >
            <svg viewBox="0 0 24 24">
              <path d="M6 2c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z" />
            </svg>
            <span>Split (S)</span>
          </button>
          
          {/* Delete trash button */}
          <button
            className="toolbar-btn"
            onClick={onDeleteSelected}
            title="Delete Selected Item (Delete hotkey)"
            disabled={!activeSelection}
            style={{ color: activeSelection ? 'var(--accent-pink)' : 'var(--text-muted)' }}
          >
            <svg viewBox="0 0 24 24">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
            <span>Delete</span>
          </button>
        </div>

        {/* Dynamic Zoom Slider control */}
        <div className="zoom-slider-container">
          <span>Zoom:</span>
          <input
            type="range"
            min="0.01"
            max="0.2"
            step="0.01"
            value={timelineZoom}
            onChange={(e) => setTimelineZoom(parseFloat(e.target.value))}
            className="slider-input"
            style={{ width: '120px' }}
          />
        </div>
      </div>

      {/* 2. Tracks Sequencer */}
      <div className="timeline-tracks-board" ref={tracksBodyRef} onMouseDown={(e) => {
        if (e.target === e.currentTarget || e.target.classList.contains('timeline-ruler')) {
          handleTracksClickOrDrag(e);
        }
      }}>
        {/* Scrubber timecode scale rules */}
        <div className="timeline-ruler">
          {Array.from({ length: Math.ceil(totalDuration / 1000) }).map((_, idx) => {
            const ms = idx * 1000;
            return (
              <div
                key={idx}
                className="ruler-mark"
                style={{ left: `${msToPx(ms)}px` }}
              >
                {idx % 5 === 0 ? `${idx}s` : ''}
              </div>
            );
          })}
        </div>

        {/* Track 1: Text Overlays Channel */}
        <div className="timeline-track">
          <div className="timeline-track-header">TEXT</div>
          <div className="timeline-track-body">
            {textOverlays.map((item) => {
              const startX = msToPx(item.timelineStart);
              const width = msToPx(item.timelineEnd - item.timelineStart);
              const isSelected = activeSelection?.id === item.id;
              
              return (
                <div
                  key={item.id}
                  className={`track-clip-block ${isSelected ? 'selected' : ''}`}
                  style={{
                    left: `${startX}px`,
                    width: `${width}px`,
                    borderColor: 'var(--accent-cyan)',
                    background: isSelected ? 'linear-gradient(135deg, rgba(0, 229, 255, 0.25), rgba(0, 229, 255, 0.1))' : 'rgba(0, 229, 255, 0.05)'
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setActiveSelection({ id: item.id, type: 'text' });
                    setDragInfo({
                      type: 'text',
                      mode: 'slide',
                      clip: item,
                      startMs: getMsFromEvent(e),
                      initialStart: item.timelineStart,
                      initialEnd: item.timelineEnd
                    });
                  }}
                >
                  <span className="clip-title" style={{ color: 'var(--accent-cyan)' }}>✏️ {item.text}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Track 2: Primary Gameplay Videos Channel */}
        <div className="timeline-track" style={{ height: '70px' }}>
          <div className="timeline-track-header" style={{ height: '70px' }}>VIDEO</div>
          <div className="timeline-track-body">
            {clips.map((item) => {
              const startX = msToPx(item.timelineStart);
              const width = msToPx(item.timelineEnd - item.timelineStart);
              const isSelected = activeSelection?.id === item.id;

              return (
                <div
                  key={item.id}
                  className={`track-clip-block ${isSelected ? 'selected' : ''}`}
                  style={{
                    left: `${startX}px`,
                    width: `${width}px`,
                    height: '54px'
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setActiveSelection({ id: item.id, type: 'clip' });
                    
                    // Prevent initiating slide if edge trimming handles are clicked
                    if (e.target.classList.contains('trim-handle')) return;

                    setDragInfo({
                      type: 'clip',
                      mode: 'slide',
                      clip: item,
                      startMs: getMsFromEvent(e),
                      initialStart: item.timelineStart,
                      initialEnd: item.timelineEnd
                    });
                  }}
                >
                  <span className="clip-title">🎮 {item.name}</span>
                  <span style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'var(--font-code)' }}>
                    Speed: {item.speed}x | Fit: {item.layout}
                  </span>

                  {/* Trim Edge Left handle */}
                  <div
                    className="trim-handle left"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDragInfo({
                        type: 'clip',
                        mode: 'trim-left',
                        clip: item,
                        startMs: getMsFromEvent(e),
                        initialStart: item.timelineStart,
                        initialEnd: item.timelineEnd,
                        initialTrimStart: item.trimStart
                      });
                    }}
                  />
                  
                  {/* Trim Edge Right handle */}
                  <div
                    className="trim-handle right"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDragInfo({
                        type: 'clip',
                        mode: 'trim-right',
                        clip: item,
                        startMs: getMsFromEvent(e),
                        initialStart: item.timelineStart,
                        initialEnd: item.timelineEnd,
                        initialTrimEnd: item.trimEnd
                      });
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Track 3: Gameplay Audio Synchronizer Channel */}
        <div className="timeline-track" style={{ height: '40px' }}>
          <div className="timeline-track-header" style={{ height: '40px' }}>AUDIO</div>
          <div className="timeline-track-body">
            {clips.map((item) => {
              const startX = msToPx(item.timelineStart);
              const width = msToPx(item.timelineEnd - item.timelineStart);

              return (
                <div
                  key={`audio-${item.id}`}
                  style={{
                    position: 'absolute',
                    left: `${startX}px`,
                    width: `${width}px`,
                    top: '4px',
                    bottom: '4px',
                    background: 'rgba(57, 255, 20, 0.04)',
                    border: '1px dashed rgba(57, 255, 20, 0.3)',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                    pointerEvents: 'none'
                  }}
                >
                  {/* Neon Mock waveform blocks visual design */}
                  <div style={{
                    width: '100%',
                    height: '14px',
                    backgroundImage: 'repeating-linear-gradient(90deg, var(--accent-green) 0px, var(--accent-green) 2px, transparent 2px, transparent 6px)',
                    opacity: 0.4
                  }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Playhead vertical red line */}
        <div
          className="playhead-scrubber"
          style={{ left: `${msToPx(currentTime)}px` }}
        >
          <div
            className="playhead-scrubber-handle"
            onMouseDown={handlePlayheadMouseDown}
          />
        </div>
      </div>
    </div>
  );
}
