const { spawn } = require('child_process');
const path = require('path');

console.log('\x1b[35m[ClipStudio Developer Setup]\x1b[0m Booting Vite dev server...');

// 1. Spawn Vite dev server
// Uses shell: true to support Windows executing npx commands flawlessly
const vite = spawn('npx', ['vite'], {
  shell: true,
  stdio: ['inherit', 'pipe', 'inherit']
});

let electronStarted = false;

vite.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output); // Forward Vite logs directly

  // Detect when Vite has finished compiling and is listening on the port
  if ((output.includes('5173') || output.includes('localhost')) && !electronStarted) {
    electronStarted = true;
    console.log('\n\x1b[36m[ClipStudio Developer Setup]\x1b[0m Vite server ready. Launching Electron app...');

    // 2. Launch Electron
    const electron = spawn('npx', ['electron', '.'], {
      shell: true,
      stdio: 'inherit'
    });

    // Clean exit process bounds
    electron.on('close', (code) => {
      console.log('\x1b[35m[ClipStudio Developer Setup]\x1b[0m Electron window closed. Terminating Vite dev server...');
      vite.kill();
      process.exit(code);
    });
  }
});

vite.on('close', (code) => {
  process.exit(code);
});
