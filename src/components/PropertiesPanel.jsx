import React from 'react';

export default function PropertiesPanel({
  activeSelection,
  selectedClip,
  selectedText,
  onUpdateClipProperty,
  onUpdateTextProperty
}) {
  if (!activeSelection) {
    return (
      <div className="properties-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '20px' }}>
          <svg style={{ width: '32px', height: '32px', fill: 'var(--text-muted)', marginBottom: '12px' }} viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </svg>
          <p>Select a clip, caption, or overlay on the timeline to edit properties.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="properties-panel">
      {/* Selection 1: Video/Audio Clip selected */}
      {activeSelection.type === 'clip' && selectedClip && (
        <div>
          <div className="panel-section">
            <div className="panel-section-title">Visual Layout</div>
            
            {/* Fit vs Fill layout toggle */}
            <div className="property-group">
              <span className="property-label">Aspect Fit Mode:</span>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  className={`btn-neon-glow ${selectedClip.layout === 'fit' ? 'active' : ''}`}
                  style={{
                    flex: 1,
                    fontSize: '11px',
                    padding: '6px',
                    borderColor: selectedClip.layout === 'fit' ? 'var(--accent-cyan)' : 'var(--border-color)',
                    background: selectedClip.layout === 'fit' ? 'rgba(0, 229, 255, 0.05)' : 'transparent',
                    color: selectedClip.layout === 'fit' ? 'var(--accent-cyan)' : 'var(--text-secondary)'
                  }}
                  onClick={() => onUpdateClipProperty('layout', 'fit')}
                >
                  Fit (Bars)
                </button>
                <button
                  className={`btn-neon-glow ${selectedClip.layout === 'fill' ? 'active' : ''}`}
                  style={{
                    flex: 1,
                    fontSize: '11px',
                    padding: '6px',
                    borderColor: selectedClip.layout === 'fill' ? 'var(--accent-cyan)' : 'var(--border-color)',
                    background: selectedClip.layout === 'fill' ? 'rgba(0, 229, 255, 0.05)' : 'transparent',
                    color: selectedClip.layout === 'fill' ? 'var(--accent-cyan)' : 'var(--text-secondary)'
                  }}
                  onClick={() => onUpdateClipProperty('layout', 'fill')}
                >
                  Fill (Zoom)
                </button>
              </div>
            </div>

            {/* Visual Crop selection */}
            <div className="property-group" style={{ marginTop: '12px' }}>
              <button
                className="btn-neon-glow"
                style={{ width: '100%', fontSize: '11px', padding: '6px 12px' }}
                onClick={() => {
                  // Toggle custom cropping handle
                  const isCropping = !!selectedClip.cropActive;
                  onUpdateClipProperty('cropActive', !isCropping);
                  if (isCropping) {
                    onUpdateClipProperty('crop', null); // Reset crop
                  }
                }}
              >
                {selectedClip.cropActive ? '✕ Reset Cropping' : '✂️ Toggle Custom Crop'}
              </button>
            </div>

            {/* Transform Sliders */}
            <div className="property-group" style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="property-label">Scale:</span>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--accent-cyan)' }}>
                  {Math.round((selectedClip.scale || 1) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={selectedClip.scale || 1}
                onChange={(e) => onUpdateClipProperty('scale', parseFloat(e.target.value))}
                className="slider-input"
              />
            </div>

            <div className="property-group">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="property-label">Opacity:</span>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--accent-cyan)' }}>
                  {Math.round((selectedClip.opacity !== undefined ? selectedClip.opacity : 1) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={selectedClip.opacity !== undefined ? selectedClip.opacity : 1}
                onChange={(e) => onUpdateClipProperty('opacity', parseFloat(e.target.value))}
                className="slider-input"
              />
            </div>
          </div>

          <div className="panel-section">
            <div className="panel-section-title">Audio & Volume</div>
            <div className="property-group">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="property-label">Volume:</span>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--accent-cyan)' }}>
                  {Math.round((selectedClip.volume !== undefined ? selectedClip.volume : 1) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="2.0"
                step="0.05"
                value={selectedClip.volume !== undefined ? selectedClip.volume : 1}
                onChange={(e) => onUpdateClipProperty('volume', parseFloat(e.target.value))}
                className="slider-input"
              />
            </div>
          </div>

          <div className="panel-section">
            <div className="panel-section-title">Speed Adjuster</div>
            <div className="property-group">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="property-label">Playback Speed:</span>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--accent-cyan)' }}>
                  {(selectedClip.speed || 1).toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min="0.25"
                max="4.0"
                step="0.25"
                value={selectedClip.speed || 1}
                onChange={(e) => onUpdateClipProperty('speed', parseFloat(e.target.value))}
                className="slider-input"
              />
            </div>
          </div>
        </div>
      )}

      {/* Selection 2: Text Overlay selected */}
      {activeSelection.type === 'text' && selectedText && (
        <div>
          <div className="panel-section">
            <div className="panel-section-title">Overlay Content</div>
            <div className="property-group">
              <span className="property-label">Text Content:</span>
              <textarea
                value={selectedText.text || ''}
                onChange={(e) => onUpdateTextProperty('text', e.target.value)}
                className="text-input-field"
                rows="3"
                style={{ resize: 'none', width: '100%', fontFamily: 'inherit' }}
              />
            </div>
          </div>

          <div className="panel-section">
            <div className="panel-section-title">Text Layout & Colors</div>
            
            <div className="property-group">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="property-label">Text Size:</span>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--accent-cyan)' }}>
                  {selectedText.size || 24}px
                </span>
              </div>
              <input
                type="range"
                min="12"
                max="72"
                step="1"
                value={selectedText.size || 24}
                onChange={(e) => onUpdateTextProperty('size', parseInt(e.target.value, 10))}
                className="slider-input"
              />
            </div>

            <div className="property-group" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
              <span className="property-label">Font Color:</span>
              <input
                type="color"
                value={selectedText.color || '#ffffff'}
                onChange={(e) => onUpdateTextProperty('color', e.target.value)}
                style={{ background: 'transparent', border: 'none', width: '32px', height: '24px', cursor: 'pointer' }}
              />
            </div>

            <div className="property-group" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="property-label">Backdrop Box:</span>
              <input
                type="color"
                value={selectedText.bgColor || '#000000'}
                onChange={(e) => onUpdateTextProperty('bgColor', e.target.value)}
                style={{ background: 'transparent', border: 'none', width: '32px', height: '24px', cursor: 'pointer' }}
              />
            </div>

            <div className="property-group">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="property-label">Backdrop Opacity:</span>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--accent-cyan)' }}>
                  {Math.round((selectedText.bgOpacity !== undefined ? selectedText.bgOpacity : 0.6) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={selectedText.bgOpacity !== undefined ? selectedText.bgOpacity : 0.6}
                onChange={(e) => onUpdateTextProperty('bgOpacity', parseFloat(e.target.value))}
                className="slider-input"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
