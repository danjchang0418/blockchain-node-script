const { Client } = require('ssh2');

const connSettings = {
    host: '88.216.198.24',
    port: 22,
    username: 'root',
    password: 'Cherry2024!!'
    // privateKey: require('fs').readFileSync('path_to_private_key'),
};

const wakuNodeCommands = [
    'git clone --recurse-submodules https://github.com/waku-org/nwaku',
    'cd nwaku && make',
    './nwaku --listen :30303', // Adjust the port as needed
];

const ssh = new Client();

ssh.on('ready', () => {
    console.log('SSH connection established');

    executeCommands(wakuNodeCommands)
        .then((endpoint) => {
            console.log(`Waku node deployed successfully. Endpoint: ${endpoint}`);
            ssh.end();
        })
        .catch((err) => {
            console.error('Error deploying Waku node:', err);
            ssh.end();
        });
});

ssh.on('error', (err) => {
    console.error('SSH connection error:', err);
    ssh.end();
});

ssh.connect(connSettings);

function executeCommands(commands) {
    return new Promise((resolve, reject) => {
        let endpoint = '';

        ssh.exec(commands.join(' && '), (err, stream) => {
            if (err) {
                reject(err);
                return;
            }

            stream
                .on('data', (data) => {
                    console.log(data.toString());
                    // Extract the endpoint if available
                    if (data.includes('Listening on')) {
                        endpoint = data.toString().match(/:(\d+)/)[0];
                    }
                })
                .on('close', (code) => {
                    if (code === 0) {
                        resolve(endpoint);
                    } else {
                        reject(`Command execution failed with code ${code}`);
                    }
                });
        });
    });
}
