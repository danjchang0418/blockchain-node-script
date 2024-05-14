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
		conn.exec(command, (err, stream) => {
			if (err) {
				reject(err);
				return;
			}
			stream
				.on("close", (code, signal) => {
					console.log(`Command '${command}' exited with code ${code}`);
					resolve(); // Resolve the promise after command execution
				})
				.on("data", (data) => {
					console.log(data.toString("utf8"));
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

// storing errors for future
const errors = ["command not found"];

// Example usage:
const connSettings = {
	host: "88.216.198.24",
	port: 22, // Default SSH port
	username: "root151",
	password: "Cherry2024!!",
};
const commands1 = [
	// "sudo -S <<< 'Cherry2024!!' apt update && sudo apt upgrade -y",
];
const commands2 = [
	// "sudo -S <<< 'Cherry2024!!' docker restart anvil-node",
	// "sudo -S <<< 'Cherry2024!!' docker restart hello-world",
	// "sudo -S <<< 'Cherry2024!!' docker restart deploy-node-1",
	// "sudo -S <<< 'Cherry2024!!' docker restart deploy-fluentbit-1",
	// "sudo -S <<< 'Cherry2024!!' docker restart deploy-redis-1",
	// "sudo -S <<< 'Cherry2024!!' mkdir foundry",
	// "cd foundry && sudo -S <<< 'Cherry2024!!' curl -L https://foundry.paradigm.xyz | bash",
	// "cd foundry && source /home/root151/.bashrc && sudo -S <<< 'Cherry2024!!' foundryup",

	// "source /home/root151/.bashrc",
	// "foundryup",
	// sudo ln -s /home/root151/.foundry/bin/forge /usr/local/bin/forge [run this command]
	// "cd ~/infernet-container-starter/projects/hello-world/contracts && sudo -S <<< 'Cherry2024!!' forge install --no-commit foundry-rs/forge-std",
	// "git config --global --add safe.directory /home/root151/infernet-container-starter",
	// "sudo -S <<< 'Cherry2024!!' git config --global --add safe.directory /home/root151/infernet-container-starter/projects/hello-world/contracts/lib/infernet-sdk",
	// "cd ~/infernet-container-starter/projects/hello-world/contracts && sudo -S <<< 'Cherry2024!!' forge install --no-commit ritual-net/infernet-sdk",
	// "cd infernet-container-starter &&  sudo -S <<< 'Cherry2024!!'  project=hello-world make deploy-contracts",
	"cd infernet-container-starter &&  sudo -S <<< 'Cherry2024!!'  project=hello-world make call-contract",
];
// onchain Remaining
const rpcUrl =
	"https://base-mainnet.g.alchemy.com/v2/6JNVPe7cF-Tswtbo33YDYZCrl0ZbyViU";
const privateKey = "";
const filePath = "config.json";
const remoteFilePath =
	"/home/root151/infernet-container-starter/deploy/config.json";
establishSSHConnection(connSettings, commands1)
	.then(() => {
		console.log("All commands executed successfully");
		updateFile(filePath, rpcUrl, privateKey);
		const watcher = fs.watch(filePath, (event, filename) => {
			console.log(event, filename);
			if (event === "change") {
				console.log(`File ${filename} has been modified`);
				watcher.close();
				copyFileToRemote(connSettings, remoteFilePath, filePath)
					.then(() => {
						console.log("File transferred successfully");
						establishSSHConnection(connSettings, commands2).then(() => {
							console.log("Node deployed");
						});
					})
					.catch((err) => {
						console.error("Error occurred during file transfer:", err);
					});
			}
		});
	})
	.catch((err) => {
		console.error("Error occurred during SSH connection:", err);
		// Handle error
	});
