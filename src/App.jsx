import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Player from './components/Player';
import Timeline from './components/Timeline';
import PropertiesPanel from './components/PropertiesPanel';
import ExportModal from './components/ExportModal';

export default function App() {
  // Core States
  const [projectName, setProjectName] = useState('My Gaming Clip');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [mediaLibrary, setMediaLibrary] = useState([]);
  const [clips, setClips] = useState([]);
  const [textOverlays, setTextOverlays] = useState([]);
  const [activeSelection, setActiveSelection] = useState(null);
  
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(0.04); // 40px per second

  // System States
  const [gpuStatus, setGpuStatus] = useState(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const [downloadStatus, setDownloadStatus] = useState(null);
  const [playerKey, setPlayerKey] = useState(0);

  // Undo / Redo History stack
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Save historical snapshot
  const saveStateToHistory = (newClips, newTexts) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    const snap = {
      clips: JSON.parse(JSON.stringify(newClips)),
      textOverlays: JSON.parse(JSON.stringify(newTexts))
    };
    setHistory([...nextHistory, snap]);
    setHistoryIndex(nextHistory.length);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      const snap = history[prevIdx];
      setClips(JSON.parse(JSON.stringify(snap.clips)));
      setTextOverlays(JSON.parse(JSON.stringify(snap.textOverlays)));
      setHistoryIndex(prevIdx);
      setActiveSelection(null);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      const snap = history[nextIdx];
      setClips(JSON.parse(JSON.stringify(snap.clips)));
      setTextOverlays(JSON.parse(JSON.stringify(snap.textOverlays)));
      setHistoryIndex(nextIdx);
      setActiveSelection(null);
    }
  };

  // Initial Hardware checks and CLI loader bindings
  useEffect(() => {
    // 1. Fetch GPU hardware encoders supported
    if (window.api) {
      window.api.getGpuStatus().then(status => {
        setGpuStatus(status);
      });

      // 2. Fetch if launched via Windows right-click "Open With" file path
      window.api.getLaunchFile().then(filePath => {
        if (filePath) {
          handleImportFileByPath(filePath, true); // Import & auto-insert
        }
      });

      // 3. Register file protocol listeners for "Open With" events on running app
      window.api.onOpenFile((filePath) => {
        handleImportFileByPath(filePath, true);
      });
    }
  }, []);

  // Sync isPlaying animation clock seekings
  useEffect(() => {
    let lastTime = performance.now();
    let frameId;

    const tick = (now) => {
      if (isPlaying) {
        const delta = now - lastTime;
        // Move playback head
        setCurrentTime(prev => {
          // Check timeline boundaries
          let maxTime = 10000;
          clips.forEach(c => { if (c.timelineEnd > maxTime) maxTime = c.timelineEnd; });
          if (prev >= maxTime) {
            setIsPlaying(false);
            return maxTime;
          }
          return prev + delta;
        });
      }
      lastTime = now;
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, clips]);

  const handleImportFileByPath = async (filePath, autoInsert = false) => {
    const safePath = filePath.replace(/\\/g, '/');
    const name = safePath.split(/[\\/]/).pop();
    const type = safePath.toLowerCase().match(/\.(mp3|wav|m4a)$/) ? 'audio' : 'video';
    const id = `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    let duration = 10000; // 10s default fallback
    if (window.api && type === 'video') {
      try {
        const meta = await window.api.getVideoMetadata(safePath);
        if (meta && meta.duration) {
          duration = meta.duration;
        }
      } catch (e) {
        console.error("Failed to query metadata via FFmpeg", e);
      }
    }

    const newMedia = {
      id,
      name,
      filePath: safePath,
      type,
      duration
    };

    setMediaLibrary(prev => {
      const updated = [...prev, newMedia];
      if (autoInsert) {
        handleAddMediaToTimeline(newMedia);
      }
      return updated;
    });
  };

  const handleImportMedia = async () => {
    if (!window.api) return;
    const paths = await window.api.selectFiles();
    paths.forEach(p => handleImportFileByPath(p));
  };

  // Optimize Variable Frame Rate (VFR) recording clips dynamically in background
  const handleOptimizeMedia = async (mediaItem) => {
    if (!window.api) return;

    // Set loading indicator state
    setMediaLibrary(prev => prev.map(item => {
      if (item.id === mediaItem.id) {
        return { ...item, isOptimizing: true };
      }
      return item;
    }));

    // Trigger local background transcode
    const result = await window.api.optimizeVideo(mediaItem.filePath);
    
    if (result.success) {
      const safeOutputPath = result.outputPath.replace(/\\/g, '/');
      setMediaLibrary(prev => prev.map(item => {
        if (item.id === mediaItem.id) {
          return {
            ...item,
            isOptimizing: false,
            isOptimized: true,
            filePath: safeOutputPath // Direct binding to CFR path
          };
        }
        return item;
      }));

      // Dynamically update existing clips path placed on timeline
      setClips(prevClips => {
        const nextClips = prevClips.map(clip => {
          if (clip.mediaId === mediaItem.id) {
            return { ...clip, filePath: safeOutputPath };
          }
          return clip;
        });
        saveStateToHistory(nextClips, textOverlays);
        return nextClips;
      });
    } else {
      // Alert failures
      setMediaLibrary(prev => prev.map(item => {
        if (item.id === mediaItem.id) {
          return { ...item, isOptimizing: false };
        }
        return item;
      }));
      alert(`Optimization failed: ${result.error}`);
    }
  };

  // Add media directly to active playhead scrubber
  const handleAddMediaToTimeline = (media) => {
    // Prevent stacking: append to the end of the existing timeline if clips are present
    let timelineStart = currentTime;
    if (clips.length > 0) {
      const maxEnd = Math.max(...clips.map(c => c.timelineEnd));
      timelineStart = maxEnd;
    }

    const duration = media.duration;
    const timelineEnd = timelineStart + duration;

    const newClip = {
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      mediaId: media.id,
      name: media.name,
      filePath: media.filePath,
      type: media.type,
      duration,
      trimStart: 0,
      trimEnd: duration,
      timelineStart,
      timelineEnd,
      scale: 1.0,
      opacity: 1.0,
      volume: 1.0,
      speed: 1.0,
      layout: 'fit', // Default letterboxing fit, user can toggle Cover/Fill
      filterPreset: 'none'
    };

    const nextClips = [...clips, newClip];
    setClips(nextClips);
    saveStateToHistory(nextClips, textOverlays);
    setActiveSelection({ id: newClip.id, type: 'clip' });
  };

  // Add text overlay track template
  const handleAddTextToTimeline = (preset) => {
    const newText = {
      id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: preset.style.text,
      timelineStart: currentTime,
      timelineEnd: currentTime + 4000, // 4-second overlay duration
      size: preset.style.size || 24,
      color: preset.style.color || '#fff',
      bgColor: preset.style.bgColor || '#000000',
      bgOpacity: 0.6,
      x: 0,
      y: 0
    };

    const nextTexts = [...textOverlays, newText];
    setTextOverlays(nextTexts);
    saveStateToHistory(clips, nextTexts);
    setActiveSelection({ id: newText.id, type: 'text' });
  };

  // Split selected clip at scrubber cursor
  const handleSplitClip = () => {
    if (!activeSelection || activeSelection.type !== 'clip') return;
    const clipIdx = clips.findIndex(c => c.id === activeSelection.id);
    if (clipIdx === -1) return;

    const clip = clips[clipIdx];
    // Verify playhead play time resides within the clip boundaries
    if (currentTime > clip.timelineStart && currentTime < clip.timelineEnd) {
      const offsetMs = currentTime - clip.timelineStart;
      const actualCutTime = clip.trimStart + offsetMs;

      // Slice clip into A and B segments
      const clipA = {
        ...clip,
        id: `clip-${Date.now()}-A`,
        timelineEnd: currentTime,
        trimEnd: actualCutTime
      };

      const clipB = {
        ...clip,
        id: `clip-${Date.now()}-B`,
        timelineStart: currentTime,
        trimStart: actualCutTime
      };

      const nextClips = [...clips.slice(0, clipIdx), clipA, clipB, ...clips.slice(clipIdx + 1)];
      setClips(nextClips);
      saveStateToHistory(nextClips, textOverlays);
      setActiveSelection({ id: clipB.id, type: 'clip' });
    }
  };

  // Delete focused timeline asset
  const handleDeleteSelected = () => {
    if (!activeSelection) return;

    if (activeSelection.type === 'clip') {
      const nextClips = clips.filter(c => c.id !== activeSelection.id);
      setClips(nextClips);
      saveStateToHistory(nextClips, textOverlays);
    } else {
      const nextTexts = textOverlays.filter(t => t.id !== activeSelection.id);
      setTextOverlays(nextTexts);
      saveStateToHistory(clips, nextTexts);
    }

    setActiveSelection(null);
  };

  // Update properties on clips
  const handleUpdateClipProperty = (key, value, clipId = null) => {
    const targetId = clipId || activeSelection?.id;
    if (!targetId) return;

    // Handle viewport frames controls triggers passed by Player component
    if (key === 'resetTimeline') {
      setCurrentTime(0);
      return;
    }
    if (key === 'forwardFrame') {
      // Forward by 1/60th sec frame
      setCurrentTime(prev => prev + Math.round(1000 / 60));
      return;
    }

    const nextClips = clips.map(clip => {
      if (clip.id === targetId) {
        const updated = { ...clip, [key]: value };
        
        // Auto-recalculate timelineEnd if speed adjustments occurs
        if (key === 'speed') {
          const originalDuration = clip.trimEnd - clip.trimStart;
          const adjustedDuration = originalDuration / value;
          updated.timelineEnd = clip.timelineStart + adjustedDuration;
        }

        return updated;
      }
      return clip;
    });

    setClips(nextClips);
    saveStateToHistory(nextClips, textOverlays);
  };

  // Update properties on texts
  const handleUpdateTextProperty = (key, value, textId = null) => {
    const targetId = textId || activeSelection?.id;
    if (!targetId) return;

    const nextTexts = textOverlays.map(txt => {
      if (txt.id === targetId) {
        return { ...txt, [key]: value };
      }
      return txt;
    });

    setTextOverlays(nextTexts);
    saveStateToHistory(clips, nextTexts);
  };

  // Apply visual preset filter to selected clip
  const handleApplyFilterToClip = (filterStyle) => {
    if (!activeSelection || activeSelection.type !== 'clip') return;
    handleUpdateClipProperty('filterPreset', filterStyle);
  };

  // Fetch static local FFmpeg if missing on system
  const handleDownloadFfmpeg = async () => {
    if (!window.api) return;
    setExportModalOpen(true);
    setDownloadStatus({ status: 'starting', progress: 0 });

    window.api.onDownloadFfmpegStatus((data) => {
      setDownloadStatus(data);
    });

    const result = await window.api.downloadFfmpeg();
    if (result.success) {
      // Re-query GPU Status
      const status = await window.api.getGpuStatus();
      setGpuStatus(status);
      setDownloadStatus(null);
    }
  };

  const handleStartExport = async (settings) => {
    if (!window.api) return;

    // Trigger Native save file dialog picker
    const selectedOutputPath = await window.api.saveFileDialog(`${projectName}.mp4`);
    if (!selectedOutputPath) {
      // User cancelled save dialog
      return;
    }

    setExportProgress({ status: 'rendering', progress: 0, frame: 0, fps: 0, speed: '1x' });

    window.api.onExportProgress((data) => {
      setExportProgress(data);
    });

    const timelineJson = {
      clips: clips.map(c => ({
        filePath: c.filePath,
        trimStart: c.trimStart,
        trimEnd: c.trimEnd,
        scale: c.scale,
        opacity: c.opacity,
        volume: c.volume,
        speed: c.speed,
        layout: c.layout,
        crop: c.crop,
        filterPreset: c.filterPreset
      })),
      textOverlays
    };

    const exportArgs = {
      outputPath: selectedOutputPath,
      resolution: settings.resolution,
      fps: settings.fps,
      gpuAccel: settings.gpuAccel,
      aspect: aspectRatio
    };

    const renderResult = await window.api.exportVideo(timelineJson, exportArgs);
    if (!renderResult.success) {
      setExportProgress({ status: 'error', error: renderResult.error });
    }
  };

  // Bind selections variables
  const selectedClip = activeSelection && activeSelection.type === 'clip' 
    ? clips.find(c => c.id === activeSelection.id) 
    : null;

  const selectedText = activeSelection && activeSelection.type === 'text' 
    ? textOverlays.find(t => t.id === activeSelection.id) 
    : null;

  return (
    <div className="app-container" onMouseDown={() => setActiveSelection(null)}>
      {/* 1. Navbar */}
      <Navbar
        projectName={projectName}
        setProjectName={setProjectName}
        aspectRatio={aspectRatio}
        setAspectRatio={setAspectRatio}
        gpuStatus={gpuStatus}
        onExportTrigger={() => setExportModalOpen(true)}
        onDownloadFfmpeg={handleDownloadFfmpeg}
      />

      {/* 2. Main Studio Panel */}
      <div className="workspace" onMouseDown={(e) => e.stopPropagation()}>
        {/* Left Sidebar */}
        <Sidebar
          mediaLibrary={mediaLibrary}
          onImportMedia={handleImportMedia}
          onAddMediaToTimeline={handleAddMediaToTimeline}
          onAddTextToTimeline={handleAddTextToTimeline}
          selectedClip={selectedClip}
          onApplyFilterToClip={handleApplyFilterToClip}
          onOptimizeMedia={handleOptimizeMedia}
        />

        {/* Center Preview screen */}
        <Player
          currentTime={currentTime}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          aspectRatio={aspectRatio}
          clips={clips}
          textOverlays={textOverlays}
          activeSelection={activeSelection}
          onUpdateTextProperty={handleUpdateTextProperty}
          onUpdateClipProperty={handleUpdateClipProperty}
          playerKey={playerKey}
        />

        {/* Right properties adjustments panel */}
        <PropertiesPanel
          activeSelection={activeSelection}
          selectedClip={selectedClip}
          selectedText={selectedText}
          onUpdateClipProperty={handleUpdateClipProperty}
          onUpdateTextProperty={handleUpdateTextProperty}
        />
      </div>

      {/* 3. Bottom Timeline */}
      <div onMouseDown={(e) => e.stopPropagation()}>
        <Timeline
          currentTime={currentTime}
          setCurrentTime={setCurrentTime}
          clips={clips}
          textOverlays={textOverlays}
          activeSelection={activeSelection}
          setActiveSelection={setActiveSelection}
          onSplitClip={handleSplitClip}
          onDeleteSelected={handleDeleteSelected}
          onUpdateClipProperty={handleUpdateClipProperty}
          onUpdateTextProperty={handleUpdateTextProperty}
          timelineZoom={timelineZoom}
          setTimelineZoom={setTimelineZoom}
        />
      </div>

      {/* 4. Dialog modal overlay */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => {
          setExportModalOpen(false);
          setExportProgress(null);
          setDownloadStatus(null);
          setPlayerKey(prev => prev + 1);
        }}
        gpuStatus={gpuStatus}
        onStartExport={handleStartExport}
        exportProgress={exportProgress}
        downloadStatus={downloadStatus}
        onCancelExport={() => {
          setExportProgress(null);
          setExportModalOpen(false);
          setPlayerKey(prev => prev + 1);
        }}
      />
    </div>
  );
}
