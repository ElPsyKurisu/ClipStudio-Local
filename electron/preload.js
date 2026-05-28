const { contextBridge, ipcRenderer } = require('electron');

// Expose secure and isolated IPC APIs to the frontend React layer
contextBridge.exposeInMainWorld('api', {
  // File management
  selectFiles: () => ipcRenderer.invoke('select-files'),
  getLaunchFile: () => ipcRenderer.invoke('get-launch-file'),
  optimizeVideo: (filePath) => ipcRenderer.invoke('optimize-video', filePath),
  getVideoMetadata: (filePath) => ipcRenderer.invoke('get-video-metadata', filePath),
  saveFileDialog: (defaultName) => ipcRenderer.invoke('save-file-dialog', defaultName),
  onOpenFile: (callback) => {
    // Remove previous listeners to prevent multiple registrations
    ipcRenderer.removeAllListeners('open-file');
    ipcRenderer.on('open-file', (event, filePath) => callback(filePath));
  },

  // FFmpeg utility management
  getGpuStatus: () => ipcRenderer.invoke('get-gpu-status'),
  downloadFfmpeg: () => ipcRenderer.invoke('download-ffmpeg'),
  onDownloadFfmpegStatus: (callback) => {
    ipcRenderer.removeAllListeners('download-ffmpeg-status');
    ipcRenderer.on('download-ffmpeg-status', (event, data) => callback(data));
  },

  // Video Export process
  exportVideo: (timelineJson, settings) => ipcRenderer.invoke('export-video', timelineJson, settings),
  onExportProgress: (callback) => {
    ipcRenderer.removeAllListeners('export-progress');
    ipcRenderer.on('export-progress', (event, data) => callback(data));
  }
});
