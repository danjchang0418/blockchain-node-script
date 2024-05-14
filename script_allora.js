const { Client } = require("ssh2");
const fs = require("fs");

let address = '';

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
					} else if (data.includes('addressForFund:')) {
						address = data.toString().trim().split(":")[1];
						console.log("Address is ", address);
					}
				})
				.stderr.on("data", (data) => {
					console.error(data.toString("utf8"));
				});
		});
	});
}

const facuetAllora = (alloraAddress) => {
	fetch(`https://faucet.testnet.allora.network/send/testnet/${alloraAddress}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		}
	})
		// .then(response => response.json())
		.then(data => {
			if (data.status == 200) {
				console.log("Successfully facueted 1000000000 uallo")
			} else {
				console.log('Response:', data.status);
				console.log('Something went wrong');
			}
		})
		.catch(error => {
			console.error('Error:', error);
		});
}
// Example usage:
const connSettings = {
	host: "88.216.222.11",
	port: 22, // Default SSH port
	username: "ubuntu",
	password: "      ",
};

const rcPath = "/home/ubuntu/.bashrc";

const commands1 = [
	`curl -sSL https://raw.githubusercontent.com/allora-network/allora-chain/main/install.sh | bash -s -- v0.0.7`,
	`git clone https://github.com/allora-network/allora-chain.git`,
	`source ${rcPath}`,
	`echo 'export PATH="$PATH:/home/ubuntu/.local/bin"' >> ${rcPath}`,
	`cd allora-chain && sudo -S <<< "${connSettings.password}" docker compose pull`,
	`cd allora-chain && sudo -S <<< "${connSettings.password}" docker compose up -d`,
	`cd allora-chain && sudo -S <<< "${connSettings.password}" echo -e "addressForFund:$(sed -n '/address:/s/.*: //p' data/validator0.account_info)"`,
];

const commands2 =
	`cd allora-chain && curl -s http://localhost:26657/status | jq .result.sync_info.catching_up`;

const commands3 = [
	`cd allora-chain && sudo -S <<< "${connSettings.password}" echo -e "pubkeyForFund:$(sed -n '/pubkey:/s/.*: //p' data/validator0.account_info)"`,
	`cd allora-chain && sudo -S <<< "${connSettings.password}" docker compose exec validator0 bash -c 'cat > stake-validator.json << EOF
	{
		"pubkey":  $(allorad --home=$APP_HOME comet show-validator),
		"amount": "1000000uallo",
		"moniker": "$(echo $MONIKER)",
		"commission-rate": "0.1",
		"commission-max-rate": "0.2",
		"commission-max-change-rate": "0.01",
		"min-self-delegation": "1"
	}'`,
	`cd allora-chain && sudo -S <<< "${connSettings.password}" docker compose exec validator0 bash -c 'allorad tx staking create-validator ./stake-validator.json \
		--chain-id=testnet \
		--home="$APP_HOME" \
		--keyring-backend=test \
		--from="$MONIKER"'`
];


establishSSHConnection(connSettings, commands1)
	.then(() => {
		console.log("Node is Running");
		facuetAllora(address);
		const conn = new Client();

		conn.on('ready', () => {
			console.log('SSH connection established');

			const checkSyncStatus = () => {
				conn.exec(commands2, (err, stream) => {
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
							console.log("Node fully synced");
							establishSSHConnection(connSettings, commands3)
								.then(() => {
									console.log("Node is running as a validator");
								})
								.catch((err) => {
									console.error("ERRor");
								})
							conn.end();
						} else {
							console.log("Should wait until node is fully synced");
							setTimeout(checkSyncStatus, 5000); // Check again in 5 seconds
						}
					}).stderr.on('data', (data) => {
						console.error(`${data}`);
					});
				});
			};

			checkSyncStatus();
		}).on('error', (err) => {
			console.error('SSH connection error:', err);
		}).connect(connSettings);
	})
	.catch((err) => {
		console.error("Error occurred during SSH connection:", err);
		// Handle error
	});

