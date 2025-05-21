import { spawn } from 'child_process';
import { platform } from 'os';
import { resolve } from 'path';

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'dev';

const npmCmd = platform() === 'win32' ? 'npm.cmd' : 'npm';

if (command === 'dev') {
  // For development: Start Vite dev server and Electron
  const vite = spawn(npmCmd, ['run', 'dev'], { stdio: 'inherit' });
  console.log('Starting Vite dev server...');
  
  // Wait for Vite to start before launching Electron
  setTimeout(() => {
    console.log('Starting Electron...');
    const electron = spawn(npmCmd, ['run', 'electron:dev'], { 
      stdio: 'inherit',
      env: { ...process.env, ELECTRON_START_URL: 'http://localhost:8080' }
    });
    
    electron.on('close', (code) => {
      console.log(`Electron process exited with code ${code}`);
      vite.kill();
      process.exit(code);
    });
    
    vite.on('close', (code) => {
      console.log(`Vite process exited with code ${code}`);
      electron.kill();
      process.exit(code);
    });
  }, 5000); // Wait 5 seconds for Vite to start
} else if (command === 'build') {
  // For production: Build the Vite app and then the Electron app
  const viteBuild = spawn(npmCmd, ['run', 'build'], { stdio: 'inherit' });
  
  viteBuild.on('close', (code) => {
    if (code !== 0) {
      console.error(`Vite build failed with code ${code}`);
      process.exit(code);
    }
    
    console.log('Building Electron application...');
    const electronBuild = spawn(npmCmd, ['run', 'electron:build'], { stdio: 'inherit' });
    
    electronBuild.on('close', (code) => {
      console.log(`Electron build completed with code ${code}`);
      process.exit(code);
    });
  });
}
