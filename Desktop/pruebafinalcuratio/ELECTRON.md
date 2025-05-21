
# Curatio Data Vault Desktop Application

This document provides instructions for running the Curatio Data Vault as a desktop application using Electron.

## Running in Development Mode

To run the application in development mode:

```bash
# Install dependencies
npm install

# Run the application in development mode
node electron-start.js dev
```

This will start both the Vite development server and Electron, allowing you to see changes in real-time.

## Building for Production

To build the application for production:

```bash
# Install dependencies
npm install

# Build the application
node electron-start.js build
```

The built application will be available in the `electron-dist` folder, ready for distribution.

## Available Platforms

The application can be built for the following platforms:
- Windows (NSIS installer and portable version)
- macOS (DMG and ZIP)
- Linux (AppImage and DEB)

## Features

- Desktop application with full offline functionality
- Embedded chatbot with vector search capabilities
- All the features of the web application in a desktop environment
