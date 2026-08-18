#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const { downloadBrowserStackVideos } = require('./download-browserstack-videos');

function runCommand() {
  let command;
  let args;

  if (process.platform === 'win32') {
    command = 'cmd.exe';
    args = ['/d', '/s', '/c', 'npx browserstack-node-sdk playwright test'];
  } else {
    command = 'bash';
    args = ['-lc', 'npx browserstack-node-sdk playwright test'];
  }

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('close', async (code) => {
      const combinedOutput = `${stdout}\n${stderr}`;
      console.log('\nBrowserStack execution finished. Collecting session metadata and downloading videos...');

      try {
        const result = await downloadBrowserStackVideos(null, combinedOutput);
        if (result.downloaded === 0) {
          console.warn('BrowserStack test run finished successfully, but no session videos were downloaded.');
        }
      } catch (error) {
        console.error('Video download step failed after the BrowserStack test run.');
        console.error(error.message);
      }

      resolve(code ?? 0);
    });
  });
}

runCommand()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error('Unexpected BrowserStack runner error:');
    console.error(error.message);
    process.exit(1);
  });
