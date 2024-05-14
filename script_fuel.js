const { Client } = require("ssh2");
const fs = require("fs");

async function establishSSHConnection(connSettings, commands) {
	return new Promise((resolve, reject) => {
		const conn = new Client();
		conn
			.on("ready", () => {
				console.log("SSH connection established");
				executeCommands(conn, commands)
					.then(() => {
						conn.end();
						resolve(); // Resolve the promise after executing commands
					})
					.catch(reject);
			})
			.on("error", (err) => {
				console.error("Error occurred:", err);
				conn.end();
				reject(err); // Reject the promise in case of an error
			})
			.connect(connSettings);
	});
}

async function executeCommands(conn, commands) {
	for (const command of commands) {
		console.log(`Executing command: ${command}`);
		await executeCommand(conn, command);
	}
}

async function executeCommand(conn, command) {
	return new Promise((resolve, reject) => {
		let endpoint = '';
		conn.exec(command, (err, stream) => {
			if (err) {
				reject(err);
				return;
			}
			stream
				.on("close", (code, signal) => {
					console.log(`Command '${command}' exited with code ${code}`);
					resolve(endpoint); // Resolve the promise after command execution
				})
				.on("data", (data) => {
					console.log(data.toString("utf8"));
					if (data.includes('Listening on')) {
						endpoint = data.toString().match(/:(\d+)/)[0];
						console.log('Endpoint: ' + endpoint);
					}
				})
				.stderr.on("data", (data) => {
					console.error(data.toString("utf8"));
				});
		});
	});
}

async function copyFileToRemote(connSettings, remoteFilePath, localFilePath) {
	return new Promise((resolve, reject) => {
		const conn = new Client();

		conn.on("ready", () => {
			conn.sftp((err, sftp) => {
				if (err) {
					conn.end();
					return reject(err);
				}

				const writeStream = sftp.createWriteStream(remoteFilePath);
				writeStream.on("error", (err) => {
					console.error("Error transferring file:", err);
					conn.end();
					reject(err);
				});

				const readStream = fs.createReadStream(localFilePath);

				readStream.pipe(writeStream);

				writeStream.on("close", () => {
					conn.end();
					resolve();
				});
			});
		});

		conn.on("error", (err) => {
			console.error("Error occurred:", err);
			conn.end();
			reject(err);
		});

		conn.connect(connSettings);
	});
}

const UpdateEnvFile = (filepath, rpc_url, private_key, password) => {
	const filePath = filepath;

	// Read the file contents
	fs.readFile(filePath, "utf8", (err, data) => {
		if (err) {
		  console.error("Error reading file:", err);
		  return;
		}
		try {
		  const lines = data.trim().split('\n');
		  const keyValuePairs = lines.reduce((acc, line) => {
			const [key, value] = line.split('=');
			acc[key] = value;
			return acc;
		  }, {});
	  
		  // Assign new values
		  keyValuePairs.ETH_CLIENT_ADDRESS = rpc_url;
		  keyValuePairs.ETH_TESTNET_KEY = private_key;
		  keyValuePairs.RLN_RELAY_CRED_PASSWORD = password;
	  
		  // Write the updated contents back to the file
		  const updatedContents = Object.entries(keyValuePairs)
			.map(([key, value]) => `${key}=${value}`)
			.join('\n');
		  fs.writeFile(filePath, updatedContents, "utf8", (writeErr) => {
			if (writeErr) {
			  console.error("Error writing file:", writeErr);
			  return;
			}
			console.log("Data Updated successfully.");
		  });
		} catch (error) {
		  console.error(error)
		}
	  });
}

const updateFile = (filePath, rpcUrl, privateKey) => {
	fs.readFile(filePath, "utf8", (err, data) => {
		if (err) {
			console.error("Error reading file:", err);
			return;
		}
		try {
			const jsonData = JSON.parse(data);
			jsonData.chain.rpc_url = rpcUrl;
			jsonData.chain.wallet.private_key = privateKey;
			const updatedJsonData = JSON.stringify(jsonData, null, 2);
			fs.writeFile(filePath, updatedJsonData, "utf8", (writeErr) => {
				if (writeErr) {
					console.error("Error writing file:", writeErr);
					return;
				}
				console.log("Data updated successfully.");
			});
		} catch (parseError) {
			console.error("Error parsing JSON:", parseError);
		}
	});
};

// Example usage:
const connSettings = {
	host: "88.216.222.11",
	port: 22, // Default SSH port
	username: "ubuntu",
	password: "      ",
};

// We will recive there rpcUrl and service name from clients
const rpcUrl = "https://eth-sepolia.g.alchemy.com/v2/lcuMjfpvkZwAGBhXnef28Lw2dbgHWtbY";
const service_name = "MYFUEL";

const commands = [
	`sudo -S <<< '${connSettings.password}' apt update && sudo -S <<< '${connSettings.password}' apt upgrade -y`,
    `sudo -S <<< '${connSettings.password}' apt install git -y`,
    `sudo -S <<< '${connSettings.password}' apt remove ansible -y`,
    `sudo -S <<< '${connSettings.password}' apt-get install -y software-properties-common`,
    `sudo -S <<< '${connSettings.password}' apt-add-repository --yes --update ppa:ansible/ansible`,
    `sudo -S <<< '${connSettings.password}' apt install ansible`,
    `ansible --version`,
    `git clone https://github.com/nodemasterpro/deploy-node-fuel.git`,
    `cd deploy-node-fuel && sudo -S <<< '${connSettings.password}' ansible-playbook fuel_node.yml -e node_action="install" -e service_name=${service_name} -e eth_rpc_endpoint=${rpcUrl}`,
    `cd deploy-node-fuel && sudo -S <<< '${connSettings.password}' systemctl start fuel-node`,
];


establishSSHConnection(connSettings, commands)
	.then(() => {
		console.log("Node depoyed!");
	})
	.catch((err) => {
		console.error("Error occurred during SSH connection:", err);
	});

