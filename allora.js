#!/usr/bin/env node

const util = require('util');
const fs = require('fs');
const { promisify } = require('util');
const { spawn } = require('child_process');
const exec = util.promisify(require('child_process').exec);

const access = promisify(fs.access);
const latestReleaseTag = 'v0.0.8';

const alloradCommand = 'which allorad';

async function checkGoVersion() {
  try {
    const { stdout } = await exec('go version');
    const goVersion = stdout.split(' ')[2]; 

    console.log(`Go version installed: ${goVersion}`);
    return true; 
  } catch (error) {
    console.error('Error checking Go version:', error.message);
    return false;
  }
}

async function installGo() {
  const installUrl = 'https://golang.org/dl/';
  const goLatestReleaseTag = '1.22.2';

  const os = process.platform;
  const arch = process.arch;

  // Construct download URL based on OS and architecture
  const downloadUrl = `${installUrl}go${goLatestReleaseTag}.${os}-${arch}.tar.gz`;
  console.log(`Downloading Go from: ${downloadUrl}`);

  try {
    const { stdout, stderr } = await exec(`curl -OL ${downloadUrl}`);
    if (stderr) {
      throw new Error(`Error downloading Go: ${stderr}`);
    } else {
      console.log(stdout);
    }
  } catch (error) {
    console.error(error.message);
    throw error; 
  }

  console.log("Verifying checksums ");
  try {
    const { stdout, stderr } = await exec(`sha256sum go${goLatestReleaseTag}.${os}-${arch}.tar.gz`);
    if (stderr) {
      throw new Error(`Error verifying checksums: ${stderr}`);
    } else {
      console.log(stdout);
    }
  } catch (error) {
    console.error(error.message);
    throw error; 
  }

  console.log("Extracting Go tarball");
  const extractCmd = os === 'win32' ? `tar -xf go${goLatestReleaseTag}.${os}-${arch}.tar.gz -C /usr/local` : `tar -C /usr/local -xvf go${goLatestReleaseTag}.${os}-${arch}.tar.gz`;
  try {
    const { stdout, stderr } = await exec(extractCmd);
    if (stderr) {
      throw new Error(`Error extracting Go: ${stderr}`);
    } else {
      console.log(stdout);
    }
  } catch (error) {
    console.error(error.message);
    throw error; 
  }
  setGoEnvVars(os);

  console.log('Go installation complete!');
  return true;
}

function setGoEnvVars(os) {
  const goInstallDir = '/usr/local/go'; 

  function setEnvVar(name, value) {
    if (os === 'win32') {
      process.env[name] = value.replace(/\//g, '\\'); 
    } else {
      process.env[name] = value;
    }
  }
  setEnvVar('GOROOT', goInstallDir);
  console.log('Go environment variables set.');
}

async function cloneOrSkip() {
    try {
        // Check if the directory already exists
        await access('allora-chain', fs.constants.F_OK);
        console.log('Repository already exists, skipping cloning.');
    } catch (error) {
        // Clone the repository with the latest release tag if it doesn't exist
        const cloneCommand = `git clone -b ${latestReleaseTag} https://github.com/allora-network/allora-chain.git`;
        console.log(`Cloning repository with command: ${cloneCommand}`);

        try {
            const { stdout, stderr } = await exec(cloneCommand);
            if (stderr) {
                console.error('Error during cloning:', stderr);
            } else {
                console.log(stdout);
            }
        } catch (error) {
            // Handle specific errors (e.g., network issues, permission errors)
            console.error('An error occurred during cloning:', error.message);
            // Optionally, you can retry cloning (implement retry logic here)
        }
    }
}

async function findAllorad() {
    try {
      const { stdout } = await exec(alloradCommand);
      return stdout.trim();
    } catch (error) {
      console.warn('allorad not found using "which". Trying to find in PATH directly.');
      return '';
    }
  }

async function runCommands() {
    try {

        const isGoInstalled = await checkGoVersion();
        if(!isGoInstalled){
          await installGo();
        }
        await cloneOrSkip();

        // Change directory to allora-chain and install dependencies
        const installCommand = 'cd allora-chain && make install';
        console.log(`Running command: ${installCommand}`);
        await exec(installCommand);
 
        // Start the application
        const alloradPath = await findAllorad();
        if (!alloradPath) {
            console.error('allorad not found. Please install it or adjust the script to provide the path.');
            return;
        }

        const startCommand = `$(${alloradCommand}) start`;
        console.log(`Running command: ${startCommand}`);
        const startProcess = spawn(alloradPath, ['start'], { cwd: 'allora-chain' });

        // Capture stdout and stderr only if not --quiet
        if (!process.argv.includes('--quiet')) {
          startProcess.stdout.on('data', (data) => {
            console.log('Start command output:', data.toString());
          });
          startProcess.stderr.on('data', (data) => {
            console.error('Start command error:', data.toString());
          });
        }
    
        // Determine additional actions based on flags
        if (process.argv.includes('--status')) {
          // Wait for start process to exit (already handled in spawn)
          const statusCommand = await exec('curl -so- http://localhost:26657/status | jq .');
          console.log('Allora Chain Status:', statusCommand.stdout);
        } else {
          console.log('All commands executed (waiting for start process to exit).');
        }
    } catch (error) {
        console.error('Error occurred:',error);
    }
}

// Check for flags and execute commands
if (process.argv.includes('--quiet')) {
  runCommands();
} else {
  runCommands().then(() => {
    console.log('All commands executed successfully.');
  })
  .catch((error) => {
    console.error('Error occurred:', error);
    process.exit(1); // Exit with a non-zero status on error
  });
}
