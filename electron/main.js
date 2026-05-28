const { app, BrowserWindow, protocol, ipcMain, dialog, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const https = require('https');
const { pathToFileURL } = require('url');

// Register secure custom protocol for local media streaming
// Crucial for bypass CORS & CSP, enabling full seeking support in HTML5 video preview
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'clip-media',
    privileges: {
      bypassCSP: true,
      stream: true,
      supportFetchAPI: true,
      corsEnabled: true,
      secure: true
    }
  }
]);

let mainWindow = null;
let launchFilePath = null; // Stores file path passed in "Open With" at startup
let cachedGpuStatus = null;

// Parse process.argv to find any valid media file paths passed as CLI arguments
function parseArgvForFile(argv) {
  const mediaExtensions = ['.mp4', '.mkv', '.mov', '.avi', '.mp3', '.wav', '.png', '.jpg', '.jpeg'];
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (path.isAbsolute(arg)) {
      const ext = path.extname(arg).toLowerCase();
      if (mediaExtensions.includes(ext) && fs.existsSync(arg)) {
        return arg;
      }
    }
  }
  return null;
}

// Single Instance Lock: Prevent multiple windows running
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    // If a user tries to run a second instance, focus the main window and load the new file
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      const newFilePath = parseArgvForFile(commandLine);
      if (newFilePath) {
        mainWindow.webContents.send('open-file', newFilePath);
      }
    }
  });

  // Extract file path from CLI on first boot
  launchFilePath = parseArgvForFile(process.argv);
}

// Locate FFmpeg statically or dynamically
function getFFmpegPath() {
  // 1. Check local bin folder
  const localBinPath = path.join(app.getAppPath(), 'bin', 'ffmpeg.exe');
  if (fs.existsSync(localBinPath)) {
    return localBinPath;
  }

  // 2. Check development path (running in dev mode)
  const devBinPath = path.join(__dirname, '..', 'bin', 'ffmpeg.exe');
  if (fs.existsSync(devBinPath)) {
    return devBinPath;
  }

  // 3. Fallback to system PATH
  return 'ffmpeg'; // Expects system environment PATH
}

// Parse precise video duration/properties natively using FFmpeg
// Bulletproof solution for variable frame rate (VFR) files where browser HTML5 duration parsing fails or caps at 3s
function getVideoMetadata(filePath) {
  return new Promise((resolve) => {
    const ffmpegPath = getFFmpegPath();
    exec(`"${ffmpegPath}" -i "${filePath}"`, (error, stdout, stderr) => {
      const metadata = { duration: 10000 }; // 10s default fallback
      const output = stderr || stdout;
      
      if (output) {
        const match = output.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
        if (match) {
          const hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const seconds = parseFloat(match[3]);
          const totalMs = ((hours * 3600) + (minutes * 60) + seconds) * 1000;
          metadata.duration = totalMs;
        }
      }
      resolve(metadata);
    });
  });
}

// Check actual physical graphics card installed on Windows system via PowerShell CimInstance queries
// Prevents misdetecting NVIDIA NVENC support just because the FFmpeg binary supports it on compile
// Essential for Windows 11 where legacy wmic command is deprecated and disabled by default
function queryPhysicalGpu() {
  return new Promise((resolve) => {
    // Standard powershell command running natively on all modern Windows setups
    exec('powershell -Command "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name"', (error, stdout) => {
      const gpu = { nvidia: false, amd: false, intel: false };
      if (!error && stdout) {
        const lower = stdout.toLowerCase();
        if (lower.includes('nvidia') || lower.includes('geforce')) gpu.nvidia = true;
        if (lower.includes('amd') || lower.includes('radeon')) gpu.amd = true;
        if (lower.includes('intel')) gpu.intel = true;
        console.log('\x1b[36m[GPU Hardware Auto-Detection]\x1b[0m Detected Controller Name:', stdout.trim());
      }
      resolve(gpu);
    });
  });
}

// Check GPU Hardware Encoders available in local FFmpeg AND physically present on system
function detectGpuHardware() {
  return new Promise((resolve) => {
    if (cachedGpuStatus) {
      return resolve(cachedGpuStatus);
    }

    const ffmpegPath = getFFmpegPath();
    exec(`"${ffmpegPath}" -encoders`, async (error, stdout, stderr) => {
      const status = {
        nvenc: false, // NVIDIA
        amf: false,   // AMD
        qsv: false,   // Intel
        ffmpegAvailable: !error
      };

      if (!error && stdout) {
        try {
          const physical = await queryPhysicalGpu();
          // Set active only if FFmpeg binary supports it AND the hardware is physically present in the system!
          if (stdout.includes('h264_nvenc') && physical.nvidia) status.nvenc = true;
          if (stdout.includes('h264_amf') && physical.amd) status.amf = true;
          if (stdout.includes('h264_qsv') && physical.intel) status.qsv = true;
        } catch (e) {
          console.error("Failed to fetch physical GPU name, fallback to compile flags:", e);
          if (stdout.includes('h264_nvenc')) status.nvenc = true;
          if (stdout.includes('h264_amf')) status.amf = true;
          if (stdout.includes('h264_qsv')) status.qsv = true;
        }
      }

      cachedGpuStatus = status;
      resolve(status);
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    titleBarStyle: 'default',
    backgroundColor: '#0d0d11', // Dark obsidian theme background matching UI
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // In development, load from Vite's local dev server. In production, load the built index.html.
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in dev mode
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register Protocol and Handlers when app is ready
app.whenReady().then(() => {
  protocol.handle('clip-media', (request) => {
    const urlPath = decodeURIComponent(request.url.slice('clip-media:///'.length));
    const filePath = path.normalize(urlPath);
    // Returns local stream via net.fetch which supports byte range seeking natively
    // Uses pathToFileURL to format valid file:/// URI cross-platform, solving ERR_INVALID_URL on Windows
    return net.fetch(pathToFileURL(filePath).href);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Separate directory memory variables for explorer persistence
let lastImportDir = null;
let lastExportDir = null;

// IPC Handler Registrations
ipcMain.handle('select-files', async () => {
  if (!mainWindow) return [];
  const defaultDir = lastImportDir || app.getPath('videos');
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Gaming Footage',
    defaultPath: defaultDir,
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Gameplay Recordings', extensions: ['mp4', 'mkv', 'mov', 'avi'] },
      { name: 'Audio Tracks', extensions: ['mp3', 'wav', 'm4a'] },
      { name: 'Images & Overlays', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }
    ]
  });
  
  if (result.filePaths && result.filePaths.length > 0) {
    lastImportDir = path.dirname(result.filePaths[0]);
  }
  return result.filePaths;
});

ipcMain.handle('get-gpu-status', async () => {
  return await detectGpuHardware();
});

ipcMain.handle('get-video-metadata', async (event, filePath) => {
  return await getVideoMetadata(filePath);
});

ipcMain.handle('save-file-dialog', async (event, defaultName) => {
  if (!mainWindow) return null;
  const defaultDir = lastExportDir || app.getPath('videos');
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Rendered Gaming Clip',
    defaultPath: path.join(defaultDir, defaultName || 'My Gaming Clip.mp4'),
    filters: [
      { name: 'MP4 Video', extensions: ['mp4'] }
    ]
  });
  
  if (result.filePath) {
    lastExportDir = path.dirname(result.filePath);
  }
  return result.filePath;
});

// Fronted requests startup argument ("Open With" trigger)
ipcMain.handle('get-launch-file', () => {
  const filePath = launchFilePath;
  launchFilePath = null; // Clear after read once
  return filePath;
});

// Download Static FFmpeg locally if missing
ipcMain.handle('download-ffmpeg', async (event) => {
  return new Promise((resolve) => {
    const binDir = path.join(app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath(), 'bin');
    const destPath = path.join(binDir, 'ffmpeg.exe');

    if (fs.existsSync(destPath)) {
      return resolve({ success: true, path: destPath });
    }

    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    // Direct compact static ffmpeg download link for windows
    // For safety, we use the stable and direct build of ffbinaries/github
    const downloadUrl = 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1/ffmpeg-4.4.1-win-64.zip';
    
    event.sender.send('download-ffmpeg-status', { status: 'starting', progress: 0 });

    const zipPath = path.join(binDir, 'ffmpeg.zip');
    const file = fs.createWriteStream(zipPath);

    https.get(downloadUrl, (response) => {
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloaded = 0;

      response.pipe(file);

      response.on('data', (chunk) => {
        downloaded += chunk.length;
        const progress = Math.round((downloaded / totalSize) * 100);
        event.sender.send('download-ffmpeg-status', { status: 'downloading', progress });
      });

      file.on('finish', () => {
        file.close();
        event.sender.send('download-ffmpeg-status', { status: 'extracting', progress: 100 });

        // Unzip static binary dynamically
        try {
          // Standard Windows utility to unzip file natively without third party npm zip packages
          exec(`powershell Expand-Archive -Path "${zipPath}" -DestinationPath "${binDir}" -Force`, (err) => {
            // Delete zip temporary file
            fs.unlinkSync(zipPath);
            
            if (err) {
              event.sender.send('download-ffmpeg-status', { status: 'error', error: err.message });
              return resolve({ success: false, error: err.message });
            }

            event.sender.send('download-ffmpeg-status', { status: 'complete', progress: 100 });
            cachedGpuStatus = null; // Clear cache to redetect
            resolve({ success: true, path: destPath });
          });
        } catch (unzipErr) {
          event.sender.send('download-ffmpeg-status', { status: 'error', error: unzipErr.message });
          resolve({ success: false, error: unzipErr.message });
        }
      });
    }).on('error', (err) => {
      fs.unlinkSync(zipPath);
      event.sender.send('download-ffmpeg-status', { status: 'error', error: err.message });
      resolve({ success: false, error: err.message });
    });
  });
});

// Optimize Variable Frame Rate (VFR) gameplay clips to 60 FPS Constant Frame Rate (CFR)
// Crucial for AMD Adrenalin, OBS, and standard gaming recorders to avoid sync drifts and preview lag
ipcMain.handle('optimize-video', async (event, filePath) => {
  return new Promise((resolve) => {
    const ffmpegPath = getFFmpegPath();
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    const outputPath = path.join(dir, `${base}_optimized_60fps.mp4`);

    detectGpuHardware().then((gpu) => {
      const args = ['-y'];
      
      // Enable native Direct3D 11 hardware decoding on Windows to offload slow AV1 software decodes from CPU
      if (gpu.amf) {
        args.push('-hwaccel', 'd3d11va');
      } else if (gpu.nvenc) {
        args.push('-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda');
      }
      
      args.push('-i', `"${filePath}"`);
      
      // Force Constant Frame Rate (CFR) at fluid 60 FPS matching standard gaming recorders
      args.push('-vsync', 'cfr', '-r', '60');
      
      // High-performance hardware acceleration fallback matching their GPU
      if (gpu.amf) {
        // AMD cards (superb for their Adrenalin recordings!)
        args.push('-c:v', 'h264_amf', '-quality', 'speed');
      } else if (gpu.nvenc) {
        // NVIDIA cards
        args.push('-c:v', 'h264_nvenc', '-preset', 'fast');
      } else {
        // CPU fallback (superfast mode)
        args.push('-c:v', 'libx264', '-preset', 'superfast', '-crf', '23');
      }
      
      // Copy audio without re-encoding to retain exact game audio fidelity without lag
      args.push('-c:a', 'copy', `"${outputPath}"`);

      console.log('\x1b[32m[FFmpeg Optimizer]\x1b[0m Spawning command:', ffmpegPath, args.join(' '));
      const process = spawn(ffmpegPath, args, { shell: true });

      // Forward stderr logs to developer console to see VFR transcoding outputs in real-time
      process.stderr.on('data', (data) => {
        console.log('\x1b[32m[FFmpeg Optimizer Log]\x1b[0m', data.toString().trim());
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, outputPath });
        } else {
          resolve({ success: false, error: `Optimizer failed with exit code ${code}` });
        }
      });

      process.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });
  });
});

// Render Timeline to Final Video via FFmpeg
ipcMain.handle('export-video', async (event, timelineJson, settings) => {
  return new Promise((resolve) => {
    const ffmpegPath = getFFmpegPath();
    const { outputPath, resolution, fps, gpuAccel, aspect } = settings;
    const { width, height } = resolution;

    // Phase 1: Compile JSON timeline to FFmpeg commands
    // We will build a highly advanced rendering filter graph
    // For clips on the timeline: cuts, merges, scale coordinates, pad, CSS overlay overlays
    
    // Quick demonstration: extract the first clip
    // In final implementation, we merge multiple inputs using -filter_complex
    const clips = timelineJson.clips || [];
    if (clips.length === 0) {
      return resolve({ success: false, error: 'Timeline has no visual clips' });
    }

    const args = [];
    
    // Set global options
    args.push('-y'); // Overwrite files
    
    // Add hardware acceleration flags
    if (gpuAccel === 'nvenc') {
      args.push('-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda');
    } else if (gpuAccel === 'amf') {
      // Direct3D 11 GPU-accelerated decoding for AMD GPUs
      // Extremely crucial to offload slow AV1/HEVC decodes from CPU to Radeon hardware decoder
      args.push('-hwaccel', 'd3d11va');
    }

    // Add inputs
    const inputPaths = [];
    clips.forEach(clip => {
      if (!inputPaths.includes(clip.filePath)) {
        inputPaths.push(clip.filePath);
        args.push('-i', `"${clip.filePath}"`);
      }
    });

    // Translate timeline cuts, trims, and crops into a clean FFmpeg filter graph
    // We concatenate trims of video clips, apply dimensions scaling, canvas cropping, and overlay text
    let filterGraph = '';
    let videoIndex = 0;
    const inputIndices = {};
    inputPaths.forEach((path, idx) => {
      inputIndices[path] = idx;
    });

    // 1. Compile filters for each clip: select segment, crop, scale to aspect
    clips.forEach((clip, idx) => {
      const inpIdx = inputIndices[clip.filePath];
      const startSec = clip.trimStart / 1000;
      const durationSec = (clip.trimEnd - clip.trimStart) / 1000;

      // Extract clip, crop if selection active, and scale to target canvas aspect ratio
      const cropFilter = clip.crop 
        ? `,crop=${clip.crop.w}:${clip.crop.h}:${clip.crop.x}:${clip.crop.y}` 
        : '';
        
      const layoutFilter = clip.layout === 'fill'
        ? `scale=w=${width}:h=${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`
        : `scale=w=${width}:h=${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`;

      // Single clip filter template
      filterGraph += `[${inpIdx}:v]trim=start=${startSec}:duration=${durationSec},setpts=PTS-STARTPTS${cropFilter},${layoutFilter}[v${idx}];`;
      
      // Handle Audio trimming as well
      filterGraph += `[${inpIdx}:a]atrim=start=${startSec}:duration=${durationSec},asetpts=PTS-STARTPTS[a${idx}];`;
    });

    // 2. Concatenate all compiled tracks
    let concatInput = '';
    clips.forEach((_, idx) => {
      concatInput += `[v${idx}][a${idx}]`;
    });
    filterGraph += `${concatInput}concat=n=${clips.length}:v=1:a=1[v_out][a_out]`;

    args.push('-filter_complex', filterGraph);
    args.push('-map', '[v_out]', '-map', '[a_out]');

    // Video Codec and Quality options
    if (gpuAccel === 'nvenc') {
      args.push('-c:v', 'h264_nvenc', '-preset', 'fast', '-cq', '20');
    } else if (gpuAccel === 'amf') {
      args.push('-c:v', 'h264_amf', '-quality', 'speed');
    } else {
      args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '22', '-threads', '0');
    }

    // Audio Codec
    args.push('-c:a', 'aac', '-b:a', '192k');
    args.push('-r', fps.toString());
    args.push(`"${outputPath}"`);

    // Spawn FFmpeg Process
    console.log('\x1b[35m[FFmpeg Render]\x1b[0m Spawning command:', ffmpegPath, args.join(' '));
    const process = spawn(ffmpegPath, args, { shell: true });
    let totalFrames = 0;
    
    // Pre-calculate total render frames to display linear progress
    clips.forEach(clip => {
      const clipDurationSec = (clip.trimEnd - clip.trimStart) / 1000;
      totalFrames += clipDurationSec * fps;
    });

    process.stderr.on('data', (data) => {
      const line = data.toString();
      if (!line.includes('frame=')) {
        console.log('\x1b[31m[FFmpeg Render Log]\x1b[0m', line.trim());
      }
      // FFmpeg logs standard stats to stderr
      // e.g. "frame=  128 fps= 64 q=12.0 Lsize=    1234kB"
      if (line.includes('frame=')) {
        const frameMatch = line.match(/frame=\s*(\d+)/);
        const fpsMatch = line.match(/fps=\s*([\d.]+)/);
        const timeMatch = line.match(/time=\s*([\d:.]+)/);

        if (frameMatch) {
          const currentFrame = parseInt(frameMatch[1], 10);
          const percent = Math.min(Math.round((currentFrame / totalFrames) * 100), 99);
          const currentFps = fpsMatch ? parseFloat(fpsMatch[1]) : 0;
          const currentSpeed = line.match(/speed=\s*([\d.x]+)/)?.[1] || '1x';

          event.sender.send('export-progress', {
            progress: percent,
            frame: currentFrame,
            fps: currentFps,
            speed: currentSpeed,
            status: 'rendering'
          });
        }
      }
    });

    process.on('close', (code) => {
      if (code === 0) {
        event.sender.send('export-progress', { progress: 100, status: 'complete' });
        resolve({ success: true, path: outputPath });
      } else {
        event.sender.send('export-progress', { progress: 0, status: 'error', error: `FFmpeg failed with exit code ${code}` });
        resolve({ success: false, error: `Render process failed (exit code ${code})` });
      }
    });

    process.on('error', (err) => {
      event.sender.send('export-progress', { progress: 0, status: 'error', error: err.message });
      resolve({ success: false, error: err.message });
    });
  });
});
