const https = require('https');
const activity = require('../modules/activity');
const fs = require('fs');
const config = require('../config.json');
let client;



function Initialize(_client) {
    client = _client;
    UpdateController();
}
exports.Initialize = Initialize;

async function CheckForUpdate() {
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
            console.log('Update successful, Waiting for chance to restart.');
            await WaitForInactiveState();
            console.log('Restart window detected, begining countdown.');
            //5mins, 2.5mins, 1min, 30s, 15s
            await RestartCountdown([300000, 150000, 60000, 30000, 15000, 0]);
            console.log('Countdown finished, exiting process.');
            //process.exit(1);
        });
    });
};

async function UpdateController() {
    //check for update
    CheckForUpdate();
    //recall this function after 12 hours
    setTimeout(UpdateController, 1000 * 60 * 60 * 12);
}

async function WaitForInactiveState() {
    let activityCheck = new Promise(resolve => {
        //check every minute
        setTimeout(() => {
            if (activity.CheckActivity().result == false)
                resolve();
        }, 1000 * 60);
    });
    let timeout = new Promise(resolve => {
        setTimeout(resolve(), 1000 * 60 * 30);
    });
    return Promise.race([activityCheck, timeout]);
}

//begin a countdown until restart
async function RestartCountdown(notifyArray) {
    return new Promise(resolve => {
        let countdownReadable = { value: 0, unit: '' };
        let timeToNextNotify = 0

        //if length = 1, our countdown is complete since final value must be 0
        if (notifyArray.length != 1) {
            //calculate the time to wait until the next countdown update
            timeToNextNotify = notifyArray[0] - notifyArray[1];
            //convert time to a readable format
            if (timeToNextNotify >= 60000) {
                countdownReadable.value = timeToNextNotify / 60000;
                countdownReadable.value > 1 ? countdownReadable.unit = 'minutes' : countdownReadable.unit = 'minute';
            }
            else {
                countdownReadable.value = timeToNextNotify / 1000;
                countdownReadable.unit = 'seconds';
            }
        }

        //notify users via bot status
        if (countdownReadable.value != 0) {
            client.user.setPresence({ activity: { name: `Restarting in: ${countdownReadable.value} ${countdownReadable.unit}` }, status: 'online' });
        }
        else {
            client.user.setPresence({ activity: { name: `Restarting, Please wait.` }, status: 'online' });
            resolve();
        }

        //remove first element and shift array left
        setTimeout(timeToNextNotify, RestartCountdown(notifyArray.shift()));
    });
}