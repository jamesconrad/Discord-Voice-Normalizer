const https = require('https');
const request = require('request').defaults({ encoding: null });
const help = require('../modules/help');
const Discord = require('discord.js');
let client;
const {
    prefix,
    token,
    botUID,
    minSampleVoldB,
    triviaTimeout,
} = require('../config.json');

async function Initialize(_client) {
    client = _client;
    AddHelpPages();
}
exports.Initialize = Initialize;

async function ImportEmote(message, args) {
    if (!message.member.hasPermission('MANAGE_EMOJIS')) return message.channel.send(`You need permission for managing emoji's to use this command.`);
    if (!message.guild.members.get(botUID).hasPermission('MANAGE_EMOJIS')) return message.channel.send(`I need permission for managing emoji's to continue.`);
    if (args.length <= 0) return message.channel.send("You didn't specify any emojis to add.");

    let result = await AttemptEmoteImports(message, args);
    
    //special response when only a single emote was requested
    if (args.length == 1) {
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
        retString += 'The following were not found on FrankerFaceZ:\n'
        result.notfound.forEach(e => { retString += ' ' + e.toString() });
    }
    if (result.added.length >= 1) {
        retString += 'The following were successfully added:\n'
        result.added.forEach(e => { retString += ' ' + e.toString() });
    }
    return message.channel.send(retString);
}
exports.ImportEmote = ImportEmote;

async function AttemptEmoteImports(message, args) {
    return new Promise(async resolve => {
        let results = {
            existing: [],
            added: [],
            notfound: []
        };
        let completed = 0;
        let bar = new Promise(async resolveBar => {
            args.forEach(async emote => {
                let found = message.guild.emojis.find(emoji => emoji.name === emote);
                if (found) {
                    results.existing.push(found);
                    completed++;
                    return
                }
                let apiCall;
                if (isNaN(+emote)) apiCall = `https://api.frankerfacez.com/v1/emoticons?q=${emote}&sort=count-desc&per_page=200`
                else apiCall = `https://api.frankerfacez.com/v1/emote/${+emote}`;
                https.get(apiCall, (resp) => {
                    let data = '';
                    resp.on('data', (chunk) => {
                        data += chunk;
                    });
                    resp.on('end', async () => {
                        let r = JSON.parse(data);
                        //verify we recieved more than one emote, filter any non exact matches, and verify we have atleast 1 left
                        if (r.emoticons !== undefined && r.emoticons.length >= 1) {
                            let correctEmote = r.emoticons.filter(e => e.name === emote);
                            if (correctEmote.length <= 0) results.notfound.push(emote);
                            else {
                                //select the most popular emote
                                correctEmote = correctEmote.sort((a, b) => b.usage_count - a.usage_count)[0];
                                results.added.push(await AddEmote(correctEmote, message.guild));
                            }
                        }
                        else if (r.emote !== undefined) results.added.push(await AddEmote(r.emote, message.guild));
                        else results.notfound.push(emote);
                        completed++
                        if (completed >= args.length)
                            resolveBar();
                    });
                });
            });
        });
        bar.then(() => {resolve(results)});
    });
}

async function AddEmote(ffzEmote, guild) {
    return new Promise(async resolve => {
        let emote;
        console.log(`Fetching ${ffzEmote.name} from: ${ffzEmote.urls[1]}`);
        //determine largest dpi, given by key
        let highestDPI = Math.max.apply(null, Object.keys(ffzEmote.urls));
        request.get('https:' + ffzEmote.urls[highestDPI], async (err, res, body) => {
            if (err != null) return console.log(err);
            emote = await guild.emojis.create(body, ffzEmote.name);
            resolve(emote);
        });
    });
}

function AddHelpPages() {
    let page = {
        description: `Emote Import Module.`,
        fields: [
            { name: '!addemote [name/id]', value: 'Import an emote by name from FrankerFaceZ.\nMultiple emotes can be imported at once.\nexample: !emote monkaS OMEGALUL 381875', inline: true }
        ]
    };
    help.AddPage('emoteImporter', page);
}