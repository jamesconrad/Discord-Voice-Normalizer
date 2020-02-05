const Discord = require('discord.js');
const client = new Discord.Client();

const config = require('./config.json');
const helpModule = require('./modules/help');
const triviaModule = require('./modules/trivia');
const voiceModule = require('./modules/voice');
const emoteModule = require('./modules/emoteImporter');
const updateModule = require('./modules/autoupdate');
const database = require('./modules/database');

//conncet to discord
console.log('Attempting Discord connection...');
client.login(config.token);

//once connected, display some general stats
client.once('ready', async () => {
    let numUsers = 0;
    client.guilds.forEach(g => numUsers += g.memberCount);
    console.log(`Ready! Connected to ${client.guilds.size} server(s), containing ${numUsers} users in total.`);
    //set bots "playing" status to be the help command
    client.user.setPresence({activity: {name: `${config.prefix}help`}, status: 'online'});

    //initialize all modules
    console.log('Performing module setups...');
    await database.Initialize();
    helpModule.Initialize();
    voiceModule.Initialize(client);
    triviaModule.Initialize();
    emoteModule.Initialize(client);
    updateModule.Initialize(client);

    //update db
    client.guilds.forEach(g => database.UpdateGuild(g));
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
    database.RemoveGuild(guild);
});

client.on('message', async message => {
    //ignore invalid messages
    if (message.author.bot) return;
    if (message.channel.type ==  'dm') {
        helpModule.OnDirectMessage(message);
        return;
    }
    if (!message.content.startsWith(config.prefix)) return;

    //check for user to be in GuildNormals
    let guildNormal = false;
    if (message.member.voice.channelID !== undefined) {
        guildNormal = voiceModule.guildNormals.get(message.member.voice.channel.id);
    }

    //parse command and arguments, then handle accordingly
    const args = message.content.slice(config.prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();

    if (command == 'help') {
        helpModule.Help(message);
        return;
    } else if (command == 'joinvoice' || command == 'j') {
        voiceModule.joinChannel(message);
        return;
    } else if (command == 'normalize' || command == 'n') {
        if (!guildNormal) return message.channel.send('I need to be in your voice channel to calculate norrmals!');
        voiceModule.Normalize(guildNormal, message, args);
        return;
    } else if (command == 'leavevoice' || command == 'l') {
        if (!guildNormal) return message.channel.send('I need to be in your voice channel to leave it!');    
        voiceModule.leaveChannel(guildNormal);
        return;
    } else if (command == 'volume' || command == 'v') {
        if (!guildNormal) return message.channel.send('I need to be in your voice channel to display user volumes!');
        let s = 'Listing perceived user volumes:\n';
        guildNormal.userStats.forEach(user => { if (!user.user.bot) s += `${user.user.username} -> ${user.perceivedVolume.toFixed(2)}dB\n` });
        message.channel.send(s);
        return;
    } else if (command == 'trivia') {
        triviaModule.Trivia(message, args)
    } else if (command == 'ee') {
        EscapeEmote(message, args)
    } else if (command == 'addemote') {
        emoteModule.ImportEmote(message, args);
    } else {
        message.channel.send('Invalid command, try !help.')
    }
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

async function EscapeEmote(message, args) {
    return message.channel.send(`\\${args[0]}`);
}
