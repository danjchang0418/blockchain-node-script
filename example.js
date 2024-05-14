// const Client = require('ssh2').Client;

// const connSettings = {
// 	host: "88.216.222.11",
// 	port: 22, // Default SSH port
// 	username: "ubuntu",
// 	password: "      ",
// };

// const commands1 = [
// //   `sudo -S <<< '${connSettings.password}' apt-get install build-essential git libpq5 jq`,
//   "git clone https://github.com/allora-network/allora-chain.git",
//   `cd allora-chain && sudo -S <<< "${connSettings.password}" docker compose pull`,
//   `cd allora-chain && sudo -S <<< "${connSettings.password}" docker compose up -d`
// ];

// const commands2 = [
//   // Add your second set of commands here
//   `echo "Finishied"`
// ];

// const conn = new Client();

// conn.on('ready', () => {
//   console.log('SSH connection established');

//   conn.exec(commands1.join(' && '), (err, stream) => {
//     if (err) throw err;

//     stream.on('close', (code, signal) => {
//       console.log(`Command execution finished with code ${code}`);
//       waitForSyncInfo(conn);
//     }).on('data', (data) => {
//       console.log(`${data}`);
//     }).stderr.on('data', (data) => {
//       console.error(`${data}`);
//     });
//   });
// }).connect(connSettings);

// function waitForSyncInfo(conn) {
//   conn.exec(`curl -so- http://localhost:26657/status | jq .result.sync_info.catching_up`, (err, stream) => {
//     if (err) throw err;

//     stream.on('close', (code, signal) => {
//       console.log(`Curl command finished with code ${code}`);
//       if (code === 0) {
//         stream.on('data', (data) => {
//           if (data.toString().trim() === 'true') {
//             console.log('Catching up is true');
//             conn.exec(commands2.join(' && '), (err, stream) => {
//               if (err) throw err;

//               stream.on('close', (code, signal) => {
//                 console.log(`Second set of commands finished with code ${code}`);
//                 conn.end();
//               }).on('data', (data) => {
//                 console.log(`${data}`);
//               }).stderr.on('data', (data) => {
//                 console.error(`${data}`);
//               });
//             });
//           } else {
//             console.log('Waiting for catching up to be true...');
//             setTimeout(() => waitForSyncInfo(conn), 5000);
//           }
//         });
//       } else {
//         console.error('Error executing curl command');
//         conn.end();
//       }
//     }).on('data', (data) => {
//       console.log(`STDOUT: ${data}`);
//     }).stderr.on('data', (data) => {
//       console.error(`STDERR: ${data}`);
//     });
//   });
// }

const { Client } = require('ssh2');

const sshConfig = {
  host: '88.216.222.11',
  username: 'ubuntu',
  password: '      '
};

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH connection established');

  const checkSyncStatus = () => {
    conn.exec('cd allora-chain && curl -s http://localhost:26657/status | jq .result.sync_info.catching_up', (err, stream) => {
      if (err) throw err;
      stream.on('close', (code, signal) => {
        if (code !== 0) {
          console.error(`Command exited with code ${code}`);
          conn.end();
          return;
        }
      }).on('data', (data) => {
        console.log(`${data}`);
        const isCatchingUp = data.toString().trim();
          if (isCatchingUp === "false") {
            console.log('Validator is synced!');
            conn.end();
          } else {
            console.log("stil");
            setTimeout(checkSyncStatus, 1); // Check again in 5 seconds
          }
      }).stderr.on('data', (data) => {
        console.error(`${data}`);
      });
    });
  };

  checkSyncStatus();
}).on('error', (err) => {
  console.error('SSH connection error:', err);
}).connect(sshConfig);

