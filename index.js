const Discord = require('discord.js');
const client = new Discord.Client();

const config = require('./config.json');
const helpModule = require('./modules/help');
const triviaModule = require('./modules/trivia');
const voiceModule = require('./modules/voice');
const emoteModule = require('./modules/emoteImporter');
const updateModule = require('./modules/autoupdate');
const activityModule = require('./modules/activity');
const database = require('./modules/database');
const command = require('./modules/command');
const presenceModule = require('./modules/presence');
//conncet to discord
console.log('Attempting Discord connection...');
client.login(config.token);

//once connected, display some general stats
client.once('ready', async () => {
    let numUsers = 0;
    client.guilds.cache.forEach(g => numUsers += g.memberCount);
    console.log(`Ready! Connected to ${client.guilds.cache.size} server(s), containing ${numUsers} users in total.`);

    //initialize all modules
    console.log('Performing module setups...');
    await database.Initialize();
    helpModule.Initialize();
    command.Initialize(client);
    triviaModule.Initialize();
    voiceModule.Initialize(client);
    emoteModule.Initialize(client);
    updateModule.Initialize(client);
    presenceModule.Initialize(client);
    presenceModule.SetDefault('LISTENING', `${config.prefix}help`, 'online');
    //prompt for trivia usage for 1 minute every 60 minutes
    presenceModule.AddRepeatingPresence('PLAYING', `${config.prefix}trivia anyone?`, 'online', 60000, null, 0, 60000*60, -1, true);
    presenceModule.AddRepeatingPresence('WATCHING', `an error? DM me.`, 'online', 60000, null, 0, 60000*30, -1, true);

    //start activity log after 1 minute, ensures other modules have registered with activity module
    setTimeout(() => {console.log('Attempting to start activity log...'); activityModule.StartActivityLog()}, 1000*60);
    //update db
    client.guilds.cache.forEach(g => database.UpdateGuild(g));
});
//inform disconnect, and reconnects
client.once('reconnecting', () => {
    console.log('Reconnecting!');
});
client.once('disconnect', () => {
    console.log('Disconnect!');
});
//log and create a table for any guilds the bot is added to
client.on('guildCreate', guild => {
    console.log(`Added to Guild: ${guild.name}`);
    database.CreateGuild(guild)
});
//log and delete the table for any guilds the bot is removed from
client.on('guildDelete', guild => {
    console.log(`Removed from Guild: ${guild.name}`);
    voiceModule.RemoveGuild(guild);
    database.RemoveGuild(guild);
});

client.on('message', async message => {
    command.ParseMessage(message);
});

//called any time a user joins/leaves/moves voice channels, or mutes/deafens
client.on('voiceStateUpdate', async (oldVoiceState, newVoiceState) => {
    //determine whether user joined, left, moved, or simply updated voice state (muted)
    if (oldVoiceState.channelID === null || oldVoiceState.channelID === undefined) {
        //joined
        return voiceModule.userJoinedVoice(newVoiceState);
    }
    else if (newVoiceState.channelID === null || newVoiceState.channelID === undefined) {
        //left
        return voiceModule.userLeftVoice(oldVoiceState);
    }
    else if (oldVoiceState.channelID != newVoiceState.channelID && oldVoiceState.channel !== undefined && newVoiceState.channel !== undefined) {
        //moved
        return voiceModule.userMovedVoice(oldVoiceState, newVoiceState);
    }
    else if (oldVoiceState.channelID == newVoiceState.channelID){
        //state updated, (muted)
        return;
    }
});

client.on('error', async (error) => {
    console.log("ERROR: " + error);
    //exit to parent bash
    console.log('Exiting process.');
    activity.EndActivityLogging();
    process.exit(0);
});

async function EscapeEmote(message, args) {
    return message.channel.send(`\\${args[0]}`);
}