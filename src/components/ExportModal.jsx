import React, { useState } from 'react';

export default function ExportModal({
  isOpen,
  onClose,
  gpuStatus,
  onStartExport,
  exportProgress,
  downloadStatus,
  onCancelExport
}) {
  const [resolution, setResolution] = useState('1080p');
  const [fps, setFps] = useState(60);
  const [gpuAccel, setGpuAccel] = useState('auto');

  if (!isOpen) return null;

  const isDownloading = downloadStatus && (downloadStatus.status === 'downloading' || downloadStatus.status === 'extracting' || downloadStatus.status === 'starting');
  const isRendering = exportProgress && exportProgress.status === 'rendering';
  const isFinished = exportProgress && exportProgress.status === 'complete';
  const isError = exportProgress && exportProgress.status === 'error';

  const resolutionsMap = {
    '720p': { width: 1280, height: 720, name: '720p HD (Fast Upload)' },
    '1080p': { width: 1920, height: 1080, name: '1080p FullHD (Standard Gaming)' },
    '4K': { width: 3840, height: 2160, name: '4K UltraHD (High Fidelity)' }
  };

  const handleStartRender = () => {
    const selectedRes = resolutionsMap[resolution];
    // Resolve GPU acceleration
    let accel = 'none';
    if (gpuAccel === 'auto') {
      if (gpuStatus.nvenc) accel = 'nvenc';
      else if (gpuStatus.amf) accel = 'amf';
      else if (gpuStatus.qsv) accel = 'qsv';
    } else if (gpuAccel === 'nvenc' && gpuStatus.nvenc) {
      accel = 'nvenc';
    } else if (gpuAccel === 'amf' && gpuStatus.amf) {
      accel = 'amf';
    }

    onStartExport({
      resolution: selectedRes,
      fps,
      gpuAccel: accel
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {/* State 1: Downloading FFmpeg binary dependencies */}
        {isDownloading && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <h2 className="modal-title">Setting Up ClipStudio Engine</h2>
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '12px' }}>
              {downloadStatus.status === 'starting' && 'Initializing Static Download...'}
              {downloadStatus.status === 'downloading' && `Downloading static FFmpeg files: ${downloadStatus.progress}%`}
              {downloadStatus.status === 'extracting' && 'Unpacking compression archives (almost ready)...'}
            </div>

            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${downloadStatus.progress}%`, background: 'linear-gradient(to right, var(--accent-purple), var(--accent-cyan))' }}
              />
            </div>
            
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'var(--font-code)' }}>
              This download happens once, running completely offline and locally afterwards.
            </div>
          </div>
        )}

        {/* State 2: Standard Export Setup options */}
        {!isDownloading && !isRendering && !isFinished && !isError && (
          <div>
            <h2 className="modal-title">Export Gaming Clip</h2>
            
            <div className="panel-section" style={{ marginTop: '20px' }}>
              <div className="property-group">
                <span className="property-label">Render Resolution:</span>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="neon-dropdown"
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  <option value="720p">720p HD (1280x720) - 16:9 Standard</option>
                  <option value="1080p">1080p Full HD (1920x1080) - Recommended</option>
                  <option value="4K">4K Ultra HD (3840x2160) - Gaming Grade</option>
                </select>
              </div>

              <div className="property-group" style={{ marginTop: '16px' }}>
                <span className="property-label">Frame Rate:</span>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    className={`btn-neon-glow ${fps === 30 ? 'active' : ''}`}
                    style={{
                      flex: 1,
                      fontSize: '11px',
                      padding: '6px',
                      borderColor: fps === 30 ? 'var(--accent-cyan)' : 'var(--border-color)',
                      background: fps === 30 ? 'rgba(0, 229, 255, 0.05)' : 'transparent',
                      color: fps === 30 ? 'var(--accent-cyan)' : 'var(--text-secondary)'
                    }}
                    onClick={() => setFps(30)}
                  >
                    30 FPS (Web Upload)
                  </button>
                  <button
                    className={`btn-neon-glow ${fps === 60 ? 'active' : ''}`}
                    style={{
                      flex: 1,
                      fontSize: '11px',
                      padding: '6px',
                      borderColor: fps === 60 ? 'var(--accent-cyan)' : 'var(--border-color)',
                      background: fps === 60 ? 'rgba(0, 229, 255, 0.05)' : 'transparent',
                      color: fps === 60 ? 'var(--accent-cyan)' : 'var(--text-secondary)'
                    }}
                    onClick={() => setFps(60)}
                  >
                    60 FPS (Fluid Gameplay)
                  </button>
                </div>
              </div>

              <div className="property-group" style={{ marginTop: '16px' }}>
                <span className="property-label">GPU Acceleration Settings:</span>
                <select
                  value={gpuAccel}
                  onChange={(e) => setGpuAccel(e.target.value)}
                  className="neon-dropdown"
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  <option value="auto">Auto-Select (Fastest detected hardware)</option>
                  <option value="nvenc" disabled={!gpuStatus?.nvenc}>NVIDIA NVENC (Hardware Accel)</option>
                  <option value="amf" disabled={!gpuStatus?.amf}>AMD AMF Encoder (Hardware Accel)</option>
                  <option value="none">Disable GPU (CPU Threaded Fallback)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '30px' }}>
              <button
                className="btn-neon-glow"
                onClick={onClose}
                style={{ flex: 1, borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleStartRender}
                style={{ flex: 2 }}
              >
                Start Local Export
              </button>
            </div>
          </div>
        )}

        {/* State 3: Active Rendering Process */}
        {isRendering && (
          <div style={{ padding: '10px 0' }}>
            <h2 className="modal-title">Rendering Clip...</h2>
            
            <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
              {/* Futuristic circular glow loader */}
              <div style={{
                position: 'relative',
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                border: '2px solid rgba(157, 78, 221, 0.1)',
                borderTopColor: 'var(--accent-cyan)',
                animation: 'spin 1.5s linear infinite'
              }} />
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}} />
            </div>

            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${exportProgress.progress}%`, background: 'linear-gradient(to right, var(--accent-purple), var(--accent-cyan))' }}
              />
            </div>

            <div className="progress-label-details">
              <span>Rendering Frame: <strong style={{ color: '#fff' }}>{exportProgress.frame}</strong></span>
              <span className="progress-number">{exportProgress.progress}%</span>
            </div>

            <div
              style={{
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '8px',
                padding: '12px',
                marginTop: '20px',
                fontSize: '11px',
                fontFamily: 'var(--font-code)',
                color: 'var(--text-secondary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>ENCODER SPEED:</span>
                <span style={{ color: 'var(--accent-green)' }}>{exportProgress.speed}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>FPS:</span>
                <span style={{ color: '#fff' }}>{exportProgress.fps ? exportProgress.fps.toFixed(1) : 'N/A'}</span>
              </div>
            </div>

            <button
              className="btn-neon-glow"
              onClick={onCancelExport}
              style={{
                width: '100%',
                marginTop: '24px',
                borderColor: 'var(--accent-pink)',
                color: 'var(--accent-pink)',
                background: 'rgba(255, 0, 127, 0.02)'
              }}
            >
              Abort Rendering
            </button>
          </div>
        )}

        {/* State 4: Export Complete Success */}
        {isFinished && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            {/* Pulsating Glowing checkmark logo */}
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'rgba(57, 255, 20, 0.08)',
              border: '2px solid var(--accent-green)',
              boxShadow: '0 0 16px rgba(57, 255, 20, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <svg style={{ width: '32px', height: '32px', fill: 'var(--accent-green)' }} viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            </div>

            <h2 className="modal-title" style={{ color: 'var(--accent-green)', background: 'none', WebkitTextFillColor: 'initial' }}>Render Complete!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '8px' }}>
              Your high-quality gaming clip was exported locally with zero lag!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '30px' }}>
              <button
                className="btn-primary"
                onClick={onClose}
                style={{ width: '100%' }}
              >
                Back to Studio
              </button>
            </div>
          </div>
        )}

        {/* State 5: Render Errors details */}
        {isError && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'rgba(255, 0, 127, 0.08)',
              border: '2px solid var(--accent-pink)',
              boxShadow: '0 0 16px rgba(255, 0, 127, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <svg style={{ width: '32px', height: '32px', fill: 'var(--accent-pink)' }} viewBox="0 0 24 24">
                <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            </div>

            <h2 className="modal-title" style={{ color: 'var(--accent-pink)', background: 'none', WebkitTextFillColor: 'initial' }}>Export Failed</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '8px', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontFamily: 'var(--font-code)', overflowX: 'auto', textAlign: 'left' }}>
              {exportProgress.error || 'Unknown video rendering compilation fault'}
            </p>

            <button
              className="btn-neon-glow"
              onClick={onClose}
              style={{ width: '100%', marginTop: '24px', borderColor: 'var(--border-color)', color: '#fff' }}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
