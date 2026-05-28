import React, { useState } from 'react';

export default function Sidebar({
  mediaLibrary,
  onImportMedia,
  onAddMediaToTimeline,
  onAddTextToTimeline,
  selectedClip,
  onApplyFilterToClip,
  onOptimizeMedia
}) {
  const [activeTab, setActiveTab] = useState('media');

  // Text template presets
  const textPresets = [
    { id: 'neon', name: 'Neon Title', style: { color: '#00e5ff', shadow: '0 0 10px #00e5ff', size: 36, text: 'NEON RUN' } },
    { id: 'meme', name: 'Meme Caption', style: { color: '#ffffff', border: '2px solid #000', size: 28, text: 'GAMING MOMENT' } },
    { id: 'subtitle', name: 'Gaming Subtitle', style: { color: '#39ff14', size: 20, text: 'HEADSHOT!' } },
    { id: 'glitch', name: 'Glitch Text', style: { color: '#ff007f', size: 32, text: 'SYSTEM FAILURE' } }
  ];

  // Visual filters presets
  const filtersPresets = [
    { id: 'none', name: 'Original', style: 'none' },
    { id: 'cyber', name: 'Cyberpunk Purple', style: 'hue-rotate(60deg) saturate(180%) contrast(120%)' },
    { id: 'crt', name: 'Retro CRT', style: 'contrast(130%) brightness(95%) sepia(10%) saturate(150%)' },
    { id: 'grayscale', name: 'Noir Grayscale', style: 'grayscale(100%) contrast(110%)' },
    { id: 'vintage', name: 'Vintage Sepia', style: 'sepia(80%) saturate(80%)' },
    { id: 'neon-glow', name: 'Nuclear Saturation', style: 'saturate(300%) contrast(130%)' }
  ];

  return (
    <div className="sidebar">
      {/* Sidebar Tabs Navigator */}
      <div className="sidebar-tabs">
        <div
          className={`sidebar-tab ${activeTab === 'media' ? 'active' : ''}`}
          onClick={() => setActiveTab('media')}
        >
          Media
        </div>
        <div
          className={`sidebar-tab ${activeTab === 'text' ? 'active' : ''}`}
          onClick={() => setActiveTab('text')}
        >
          Text
        </div>
        <div
          className={`sidebar-tab ${activeTab === 'filters' ? 'active' : ''}`}
          onClick={() => setActiveTab('filters')}
        >
          Filters
        </div>
      </div>

      <div className="sidebar-content">
        {/* Tab 1: Media Library */}
        {activeTab === 'media' && (
          <div>
            <button
              className="btn-primary"
              style={{ width: '100%', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              onClick={onImportMedia}
            >
              <svg style={{ width: '16px', height: '16px', fill: 'currentColor' }} viewBox="0 0 24 24">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
              <span>Import Gaming Clip</span>
            </button>

            {mediaLibrary.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', marginTop: '40px', padding: '0 20px' }}>
                <svg style={{ width: '40px', height: '40px', fill: 'var(--text-muted)', marginBottom: '12px' }} viewBox="0 0 24 24">
                  <path d="M18 4H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-3 2v2H9V6h6zm-6 8H7v-2h2v2zm0-4H7V8h2v2zm6 8H9v-2h6v2zm0-4h-4v-2h4v2zm0-4h-4V8h4v2z" />
                </svg>
                <p>Drag files here or right-click gameplay clips in Explorer and choose "Open With" this app.</p>
              </div>
            ) : (
              <div className="media-grid">
                {mediaLibrary.map((item) => (
                  <div key={item.id} className="media-card" onClick={() => onAddMediaToTimeline(item)}>
                    <div className="media-card-thumbnail">
                      {/* Video/Image dynamic representation */}
                      {item.type === 'video' ? (
                        <video src={`clip-media:///${item.filePath}`} muted style={{ pointerEvents: 'none' }} />
                      ) : (
                        <img src={`clip-media:///${item.filePath}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                      
                      <div className="media-card-add-btn">
                        <svg style={{ width: '12px', height: '12px', fill: '#fff' }} viewBox="0 0 24 24">
                          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                        </svg>
                      </div>
                    </div>
                    <div className="media-card-info">
                      <div className="media-card-title">{item.name}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                        <div className="media-card-duration">
                          {item.type === 'video' ? formatTimecode(item.duration) : 'IMAGE'}
                        </div>
                        {item.type === 'video' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOptimizeMedia(item);
                            }}
                            disabled={item.isOptimizing}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: item.isOptimized ? 'var(--accent-green)' : 'var(--accent-cyan)',
                              fontSize: '9px',
                              cursor: 'pointer',
                              fontWeight: '600',
                              fontFamily: 'var(--font-code)'
                            }}
                          >
                            {item.isOptimizing ? '⚡ Optimizing...' : item.isOptimized ? '✓ Optimized' : '⚡ Optimize'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Text Templates */}
        {activeTab === 'text' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {textPresets.map((preset) => (
              <div
                key={preset.id}
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '16px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all var(--transition-speed)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
                onClick={() => onAddTextToTimeline(preset)}
                className="media-card"
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>{preset.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>Timeline Overlay Track</div>
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    fontFamily: preset.id === 'neon' ? 'var(--font-code)' : 'var(--font-ui)',
                    color: preset.style.color,
                    textShadow: preset.style.shadow ? `0 0 5px ${preset.style.color}` : 'none',
                    fontWeight: 'bold',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(0,0,0,0.3)',
                    border: preset.style.border ? '1px solid #fff' : 'none'
                  }}
                >
                  ABC
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Visual Filters */}
        {activeTab === 'filters' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {!selectedClip ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', marginTop: '40px' }}>
                Select a video clip on the timeline to apply color grade filters.
              </div>
            ) : (
              filtersPresets.map((filter) => (
                <div
                  key={filter.id}
                  onClick={() => onApplyFilterToClip(filter.style)}
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: selectedClip.filterPreset === filter.style ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                    boxShadow: selectedClip.filterPreset === filter.style ? '0 0 8px var(--accent-cyan-glow)' : 'none',
                    borderRadius: '8px',
                    padding: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'all var(--transition-speed)'
                  }}
                  className="media-card"
                >
                  <div
                    style={{
                      width: '40px',
                      height: '30px',
                      borderRadius: '4px',
                      background: 'linear-gradient(135deg, #00e5ff, #9d4edd)',
                      filter: filter.style === 'none' ? 'none' : filter.style
                    }}
                  />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: '#fff' }}>{filter.name}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Timecode Formatting Helper: ms -> MM:SS
function formatTimecode(durationMs) {
  if (isNaN(durationMs)) return '00:00';
  const totalSec = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
