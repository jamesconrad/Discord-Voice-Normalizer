const https = require('https');
const fs = require('fs');
const config = require('../config.json');
let client;



function Initialize(_client) {
    client = _client;
    UpdateController();
}
exports.Initialize = Initialize;

function CheckForUpdate() {
    //format and call the api GET command for this project's master branch
    let options = {
        hostname: 'api.github.com',
        path: '/repos/jamesconrad/Discord-Voice-Normalizer/branches/master',
        method: 'GET',
        headers: { 'Accept': 'application/json', 'User-Agent': 'jamesconrad/Discord-Voice-Normalizer' },
    }
    https.get('https://api.github.com/repos/jamesconrad/Discord-Voice-Normalizer/branches/master', options, resp => {
        let data = '';
        resp.on('data', (chunk) => {
            data += chunk;
        });
        resp.on('end', async () => {
            //confirm the request was sucessful
            if (resp.statusCode != '200') {
                console.log(`Update Check ERROR: ${resp.statusCode}\n${data}`);
                return;
            }
            let response = JSON.parse(data);
            //compare current node_id to the one we just fetched, if the same then just exit the function
            if (response.commit.node_id == config.node_id) return;
            console.log(`Update detected, ${response.commit.node_id}`);
            config.node_id = response.commit.node_id;

            fs.writeFileSync('./config.json', JSON.stringify(config, null, 4));
            //config.json has been updated, time to trigger the restart for the bash script.
            console.log('Update successful, Restart required: NYI');
            //process.exit(1)
        });
    });
};

async function UpdateController() {
    //check for update
    CheckForUpdate();
    //recall this function after 12 hours
    setTimeout(UpdateController, 1000 * 60 * 60 * 12);
}