const { Client } = require("ssh2");
const fs = require("fs");

let address = "";

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
					const dataString = data.toString().trim();
					if (data.includes('Listening on')) {
						endpoint = data.toString().match(/:(\d+)/)[0];
						console.log('Endpoint: ' + endpoint);
					} else if ((dataString.includes("warden")) && (dataString.length === 45)) {
						console.log(`Excuting command is ${command}`);
						console.log(dataString.includes("warden"));
						console.log(dataString.length === 45);
						address = dataString;
						console.log("Address is ", address);
					}
				})
				.stderr.on("data", (data) => {
					console.error(data.toString("utf8"));
				});
		});
	});
}

// Example usage:
const connSettings = {
	host: "88.216.222.11",
	port: 22, // Default SSH port
	username: "ubuntu",
	password: "      ",
};

const passphrase = "Pass!234";

const commands1 = [
	`curl -O https://raw.githubusercontent.com/muzammilvmx/Warden_protocol/main/warden.sh`,
	`chmod +x warden.sh`,
	`echo -e "Y" | ./warden.sh`,
	`./warden_auto`,
	`sudo -S <<< '${connSettings.password}' mv wardend ~/.local/bin`,
	`wardend version`,
	`./wardend version`,
	`cat > cwalletcommand.sh << EOF
#!/usr/bin/expect
set timeout 2
spawn ./wardend keys add wallet
expect "Enter keyring passphrase (attempt 1/3):"
send -- "${passphrase}\r"
expect "override the existing name wallet \\[y\\/N\\]:"
send -- "y\r"
expect eof
	`,
	`chmod +x ./cwalletcommand.sh`,
	`echo -e $(./cwalletcommand.sh) >> cwalletcommand.txt`,
	`cat cwalletcommand.txt | grep -oP "address: \\K\\w+" >> walletaddress.txt`,
	`sudo -S <<< "${connSettings.password}" rm -rf cwalletcommand.txt`,
	`curl -XPOST -d '{"address": "'"$(cat walletaddress.txt | tr -d '\n')"'"}' https://faucet.buenavista.wardenprotocol.org`

];

const commands2 = `./wardend status 2>&1 | jq .sync_info.catching_up`;

const commands3 = [
	`cat > validator.json << EOF
	{
		"pubkey":  $(./wardend comet show-validator),
		"amount": "1000000uward",
		"commission-rate": "0.1",
		"commission-max-rate": "0.2",
		"commission-max-change-rate": "0.01",
		"min-self-delegation": "1"
	}`,
	`./wardend tx staking create-validator $HOME/validator.json \
	--from=$(cat walletaddress.txt | tr -d '\n') \
	--chain-id=buenavista-1 \
	--fees=500uward`,
	`sudo -S <<< "${connSettings.password}" rm -rf walletaddress.txt`,
]

establishSSHConnection(connSettings, commands1)
	.then(() => {
		console.log("Node is Running");
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
						console.log(`${data.toString()}`);
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



