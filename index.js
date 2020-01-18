//https://discord.js.org/#/docs/main/stable/general/welcome

const Discord = require('discord.js');
const client = new Discord.Client();
const {
    prefix,
    token,
    botUID,
    minSampleVoldB,
    triviaTimeout,
} = require('./config.json');
const helpModule = require('./modules/help');
const triviaModule = require('./modules/trivia');
const voiceModule = require('./modules/voice');
const emoteModule = require('./modules/emoteImporter');

//trivia setup:
console.log('Performing pre-discord module setups...');
helpModule.Initialize();
voiceModule.Initialize(minSampleVoldB);
triviaModule.Initialize(triviaTimeout);
emoteModule.Initialize(client);
console.log('Attempting Discord connection...');

client.login(token);

client.once('ready', () => {
    console.log(`Ready! Connected to ${client.guilds.size} server(s)`);
    client.guilds.forEach(g => triviaModule.TriviaDBUpdateGuild(g));
    client.user.setPresence({activity: {name: `${prefix}help`}, status: 'online'});
});
client.once('reconnecting', () => {
    console.log('Reconnecting!');
});
client.once('disconnect', () => {
    console.log('Disconnect!');
});
client.on('guildCreate', guild => {
    console.log(`Added to Guild: ${guild.name}`);
    triviaModule.TriviaDBCreateGuild(guild)
});
client.on('guildDelete', guild => {
    console.log(`Removed from Guild: ${guild.name}`);
    triviaModule.TriviaDBRemoveGuild(guild);
});

client.on('message', async message => {
    //ignore invalid messages
    if (message.author.bot) return;
    if (message.channel.type ==  'dm') {
        helpModule.OnDirectMessage(message);
        return;
    }
    if (!message.content.startsWith(prefix)) return;

    //check for user to be in GuildNormals
    let guildNormal = false;
    if (message.member.voice.channelID !== undefined) {
        guildNormal = voiceModule.guildNormals.get(message.member.voice.channel.id);
    }

    //parse command and arguments, then handle accordingly
    const args = message.content.slice(prefix.length).split(/ +/);
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

client.on('voiceStateUpdate', async (oldVoiceState, newVoiceState) => {
    //determine whether user joined, left, or moved voice channels
    if (oldVoiceState.channelID === null || oldVoiceState.channelID === undefined) voiceModule.userJoinedVoice(newVoiceState);
    else if (newVoiceState.channelID === null) voiceModule.userLeftVoice(oldVoiceState);
    else voiceModule.userMovedVoice(oldVoiceState, newVoiceState);
});

async function EscapeEmote(message, args) {
    return message.channel.send(`\\${args[0]}`);
}
