
const { spawn } = require('child_process');
const { platform } = require('os');
const { resolve } = require('path');
const electron = require('electron');

// Start Electron with the development URL
const proc = spawn(electron, [resolve(__dirname, 'electron/main.js')], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_START_URL: 'http://localhost:8080', NODE_ENV: 'development' }
});

proc.on('close', (code) => {
  console.log(`Electron process exited with code ${code}`);
  process.exit(code);
});
