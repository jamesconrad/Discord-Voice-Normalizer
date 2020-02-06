const https = require('https');
const request = require('request').defaults({ encoding: null });
const activity = require('../modules/activity');
const help = require('../modules/help');
const command = require('../modules/command')
const Discord = require('discord.js');
let client;
let importing = false;
const config = require('../config.json');

async function Initialize(_client) {
    command.RegisterCommand('addemote', ImportEmote);
    client = _client;
    AddHelpPages();
    activity.AddActivityCheck('emoteImporter', IsActive);
}
exports.Initialize = Initialize;

//handles everything about the addemote command
async function ImportEmote(message, args) {
    //verify permissions
    if (!message.member.hasPermission('MANAGE_EMOJIS')) return message.channel.send(`You need permission for managing emoji's to use this command.`);
    if (!message.guild.members.get(config.botUID).hasPermission('MANAGE_EMOJIS')) return message.channel.send(`I need permission for managing emoji's to continue.`);
    //verify args
    if (args.length <= 0) return message.channel.send("You didn't specify any emojis to add.");
    //set the activity flag for the activity monitor
    importing = true;

    //attempt to create the emotes
    let result = await AttemptEmoteImports(message, args);

    //special response when only a single emote was requested
    if (args.length == 1) {
        //clear activity flag
        importing = false;
        //send result
        if (result.existing.length >= 1) return message.channel.send(`There is already an emote using that name: ${result.existing[0]}`);
        else if (result.notfound.length >= 1) return message.channel.send(`I could not find an emote called ${result.notfound[0]} on FrankerFaceZ`);
        else return message.channel.send(`Emote successfully added: ${result.added[0]}`);
    }

    //form and return results
    let retString = '';
    if (result.existing.length >= 1) {
        retString += 'The following failed to be added because there was already an emote using their name:\n'
        result.existing.forEach(e => { retString += ' ' + e.toString() });
    }
    if (result.notfound.length >= 1) {
        retString += '\nThe following were not found on FrankerFaceZ:\n'
        result.notfound.forEach(e => { retString += ' ' + e.toString() });
    }
    if (result.added.length >= 1) {
        retString += '\nThe following were successfully added:\n'
        result.added.forEach(e => { retString += ' ' + e.toString() });
    }
    //clear activity flag
    importing = false;
    return message.channel.send(retString);
}
exports.ImportEmote = ImportEmote;

//function where the emotes are actually added
async function AttemptEmoteImports(message, args) {
    return new Promise(async resolve => {
        let results = {
            existing: [],
            added: [],
            notfound: []
        };
        let completed = 0;
        //create a blocking promise to ensure all emotes are complete before resolving
        let bar = new Promise(async resolveBar => {
            //for each emote to add
            args.forEach(async emote => {
                //check if an emote using its name already exists
                let found = message.guild.emojis.find(emoji => emoji.name === emote);
                //if found add this emote to the results
                if (found) {
                    results.existing.push(found);
                    completed++;
                    //if we have completed all emotes then resolve bar
                    if (completed >= args.length)
                        resolveBar();
                }
                //emote wasnt found, can continue creating it
                else {
                    //determine and set the correct api call based on wether or not we are importing via id or name
                    let apiCall;
                    if (isNaN(+emote)) apiCall = `https://api.frankerfacez.com/v1/emoticons?q=${emote}&sort=count-desc&per_page=200`
                    else apiCall = `https://api.frankerfacez.com/v1/emote/${+emote}`;
                    //do the actual api call
                    await https.get(apiCall, async resp => {
                        let data = '';
                        resp.on('data', (chunk) => {
                            data += chunk;
                        });
                        resp.on('end', async () => {
                            let r = JSON.parse(data);
                            //apicall used the emote name
                            //verify we recieved more than one emote, filter any non exact matches, and verify we have atleast 1 left
                            if (r.emoticons !== undefined && r.emoticons.length >= 1) {
                                let correctEmote = r.emoticons.filter(e => e.name === emote);
                                if (correctEmote.length <= 0) results.notfound.push(emote);
                                else {
                                    //select the most popular emote
                                    correctEmote = correctEmote.sort((a, b) => b.usage_count - a.usage_count)[0];
                                    //create the emote and add it to results
                                    results.added.push(await AddEmote(correctEmote, message.guild));
                                }
                            }
                            //apicall used the emote id
                            else if (r.emote !== undefined) {
                                //check if the fetched emote id has an emote using its name, and add to results
                                let found = message.guild.emojis.find(emoji => emoji.name === r.emote.name);
                                if (found) results.existing.push(found);
                                else results.added.push(await AddEmote(r.emote, message.guild));
                            }
                            //server didn't give a valid response so emote was not found
                            else results.notfound.push(emote);
                            //increment and check if we are complete
                            completed++
                            if (completed >= args.length)
                                resolveBar();
                        });
                    });
                }
            });
        });
        bar.then(() => { resolve(results) });
    });
}

//add an emote to the server using the frankerfacez emoticon json
async function AddEmote(ffzEmote, guild) {
    return new Promise(async resolve => {
        let emote;
        console.log(`Fetching ${ffzEmote.name} from: ${ffzEmote.urls[1]}`);
        //determine largest dpi, given by key
        let highestDPI = Math.max.apply(null, Object.keys(ffzEmote.urls));
        //download the emote image
        request.get('https:' + ffzEmote.urls[highestDPI], async (err, res, body) => {
            if (err != null) return console.log(err);
            //add the emote to the server
            emote = await guild.emojis.create(body, ffzEmote.name);
            //return the new emote
            resolve(emote);
        });
    });
}

//activity check, return wether or not we are currently importing any empotes
function IsActive() {
    return importing;
}

function AddHelpPages() {
    let page = {
        description: `Emote Import Module.`,
        fields: [
            { name: '!addemote [name/id]', value: 'Import an emote by name from FrankerFaceZ.\nMultiple emotes can be imported at once.\nexample: !addemote monkaS OMEGALUL 381875', inline: true }
        ]
    };
    help.AddPage('emoteImporter', page);
}