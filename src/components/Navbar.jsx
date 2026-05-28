import React from 'react';

export default function Navbar({
  projectName,
  setProjectName,
  aspectRatio,
  setAspectRatio,
  gpuStatus,
  onExportTrigger,
  onDownloadFfmpeg
}) {
  return (
    <nav className="navbar">
      <div className="brand-section">
        <div className="brand-logo">
          {/* Neon Logo SVG */}
          <svg viewBox="0 0 24 24">
            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4zM14 16H5V8h9v8z" />
          </svg>
        </div>
        <span className="brand-title">CLIPSTUDIO</span>
        
        {/* Project Name Editor */}
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="text-input-field"
          style={{
            marginLeft: '24px',
            height: '32px',
            fontSize: '12px',
            fontWeight: '500',
            width: '180px',
            border: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(0,0,0,0.2)'
          }}
          placeholder="Untitled Gaming Clip"
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* GPU Hardware Accel Quick Status badge */}
        {gpuStatus ? (
          gpuStatus.ffmpegAvailable ? (
            <div
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-code)',
                padding: '4px 10px',
                borderRadius: '20px',
                background: gpuStatus.nvenc || gpuStatus.amf || gpuStatus.qsv 
                  ? 'rgba(57, 255, 20, 0.08)' 
                  : 'rgba(255, 255, 255, 0.05)',
                border: gpuStatus.nvenc || gpuStatus.amf || gpuStatus.qsv
                  ? '1px solid rgba(57, 255, 20, 0.25)'
                  : '1px solid rgba(255, 255, 255, 0.1)',
                color: gpuStatus.nvenc || gpuStatus.amf || gpuStatus.qsv ? 'var(--accent-green)' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: gpuStatus.nvenc || gpuStatus.amf || gpuStatus.qsv ? 'var(--accent-green)' : 'var(--text-muted)'
              }} />
              {gpuStatus.nvenc ? 'GPU ACCEL: NVENC ACTIVE' : gpuStatus.amf ? 'GPU ACCEL: AMF ACTIVE' : gpuStatus.qsv ? 'GPU ACCEL: QSV ACTIVE' : 'CPU MODE (NO GPU ACCEL)'}
            </div>
          ) : (
            <button
              onClick={onDownloadFfmpeg}
              className="btn-neon-glow"
              style={{
                fontSize: '10px',
                padding: '4px 10px',
                height: '24px',
                borderColor: 'var(--accent-pink)',
                color: 'var(--accent-pink)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              ⚠️ FFmpeg Missing (Click to setup)
            </button>
          )
        ) : (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Detecting Hardware...</div>
        )}

        {/* Aspect Ratio Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>Canvas:</span>
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            className="neon-dropdown"
            style={{ height: '32px', padding: '0 8px' }}
          >
            <option value="16:9">16:9 Landscape (YouTube/Gaming)</option>
            <option value="9:16">9:16 Portrait (TikTok/Shorts)</option>
            <option value="1:1">1:1 Square (Instagram/Memes)</option>
            <option value="21:9">21:9 Ultrawide (Gaming Rig)</option>
          </select>
        </div>

        {/* Action button */}
        <button
          className="btn-primary"
          style={{ height: '32px', display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={onExportTrigger}
          disabled={!gpuStatus?.ffmpegAvailable}
        >
          <span>Export Video</span>
          <svg style={{ width: '14px', height: '14px', fill: 'currentColor' }} viewBox="0 0 24 24">
            <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
