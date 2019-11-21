//https://discord.js.org/#/docs/main/stable/general/welcome

const Discord = require('discord.js');
const {
    prefix,
    token,
    botUID,
} = require('./config.json');

const { Readable } = require('stream');

const SILENCE_FRAME = Buffer.from([0xF8, 0xFF, 0xFE]);

class Silence extends Readable {
  _read() {
    this.push(SILENCE_FRAME);
  }
}

// play silence indefinitely, this should allow you to continue receiving audio
//voiceConnection.play(new Silence(), { type: 'opus' });

/*
DATA STRUCTURES:

Map guildNormals(voiceChannel.id, normal)

normal {
    voiceChannel: voiceChannel,
    connection: null,
    users: new Map(),
}

userStats {
    user: user,
    audioStream: null,
    perceivedTotalSampleAvg: 0,
    perceivedSamples: 0,
    perceivedVolume: 0,
}
*/


const guildNormals = new Map();
const client = new Discord.Client();

client.login(token);

client.once('ready', () => {
    console.log('Ready!');
});
client.once('reconnecting', () => {
    console.log('Reconnecting!');
});
client.once('disconnect', () => {
    console.log('Disconnect!');
});

client.on('message', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;
    
    let guildNormal = false;
    if (message.member.voice.channelID !== undefined)
        guildNormal = guildNormals.get(message.member.voice.channel.id);

    const args = message.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();

    if (command == 'help') {
        let s = `All commands can be run using the prefix (${prefix}) followed by the first letter of the command.`
        s+= `\n${prefix}joinvoice: enters users voice channel and begins calculating normals.`;
        s+= `\n${prefix}leavevoice: leaves the current voice channel.`;
        s+= `\n${prefix}normalize [number]: prints normalized volumes for each user in the channel, number is the volume desired for the quietest user.`;
        s+= `\n${prefix}volume: prints perceived volume of each user.`
        message.channel.send(s)
        return;
    }else if (command == 'joinvoice' || command == 'j') {
        joinChannel(message);
        return;
    }else if (command == 'normalize' || command == 'n') {
        if (!guildNormal) return message.send('I need to be in your voice channel.');
        Normalize(guildNormal, message, args);
        return;
    }else if (command == 'leavevoice' || command == 'l') {
        if (!guildNormal) return message.channel.send('I must be in your voice channel to leave it!');
        guildNormals.delete(message.member.voice.channel.id);
        message.member.voice.channel.leave();
        return;
    }else if (command == 'volume' || command == 'v') {
        if (!guildNormal) return message.channel.send('I must be in your voice channel to display user volumes!');
        let s = 'Listing perceived user volumes:\n';
        guildNormals.forEach(guild => {
            guildNormal.userStats.forEach(user => {if (user.user.id != botUID) s += `${user.user.username} -> ${user.perceivedVolume}dB\n`});
        })
        message.channel.send(s);
        return;
    }else {
        message.channel.send('Invalid command, try !help.')
    }
});

client.on('voiceStateUpdate', async (oldVoiceState, newVoiceState) => {
    if (oldVoiceState.channelID === null || oldVoiceState.channelID === undefined) userJoinedVoice(newVoiceState);
    else if (newVoiceState.channelID === null) userLeftVoice(oldVoiceState);
    else userMovedVoice(oldVoiceState, newVoiceState);
});

async function userJoinedVoice(voiceState){ 
    let member = voiceState.member;
    //check if we are tracking their channel
    const guildNormal = guildNormals.get(member.voice.channel.id);
    if (guildNormal){
        //check if we are tracking them, and begin tracking if not
        if (!guildNormal.userStats.get(member.user.id)){
            const newuser = {
                user: member.user,
                //audioStream: guildNormal.voiceReceiver.createStream(member, {}),
                perceivedTotalSampleAvg: 0,
                perceivedSamples: 0,
                perceivedVolume: 0,
            }
            guildNormal.userStats.set(member.user.id, newuser);
        }
    }
}

async function userLeftVoice(voiceState){
    let member = voiceState.member;
    //check if we are tracking their channel
    const guildNormal = guildNormals.get(voiceState.channelID);
    if (guildNormal){
        //stop tracking the user if they are being tracked
        if (guildNormal.userStats.get(member.user.id)){
            guildNormal.userStats.delete(member.user.id);
        }

        //check if we are last, and leave
        if (guildNormal.userStats.size == 1)
            voiceState.channel.leave();
    }
}

async function userMovedVoice(oldMember, newMember){
    userLeftVoice(oldMember);
    userJoinedVoice(newMember);
}

async function joinChannel(message, guildNormal) {
    //attempt join channel
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.channel.send('You need to be in a voice channel for me to join!');
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
        return message.channel.send('I need the permissions to join your voice channel!');
    }
    
    
    if (guildNormal) return message.channel.send("I'm already in here!");

    try {
        const connection = await voiceChannel.join();
        const normals = {
            voiceChannel: voiceChannel,
            connection: connection,
            userStats: new Map(),
        };
    
        voiceChannel.members.forEach(element => {
            const userStats = {
                user: element.user,
                audioStream: null,
                perceivedTotalSampleAvg: 0,
                perceivedSamples: 0,
                perceivedVolume: 0,
            }
            normals.userStats.set(element.user.id, userStats);
        });
        
        guildNormals.set(voiceChannel.id, normals);
        guildNormals.get(voiceChannel.id).connection = connection;
        
        const dispatcher = connection.play(new Silence(), { type: 'opus' });

        connection.on('speaking', (user, speaking) => {
            //speaking started
            if (speaking.bitfield == 1) {
                BeginRecording(guildNormals.get(connection.channel.id), user);
            }
            //speaking stopped
            if (speaking.bitfield == 0) {
                EndRecording(guildNormals.get(connection.channel.id), user);
            }
        })
        normals.connection = connection;
        
    } catch (err) {
        console.log(err);
        guildNormals.delete(voiceChannel.id);
        return message.channel.send(err);
    }
}

async function BeginRecording(guildNormal, user) {
    console.log('Speaker detected: ' + user.username);
    const receiver = guildNormal.connection.receiver;
    const audioStream = receiver.createStream(user, {mode:'pcm', end:'silence'});//32bit signed stero 49khz
    guildNormal.userStats.get(user.id).audioStream = audioStream;
}

async function EndRecording(guildNormal, user) {
    const userStat = guildNormal.userStats.get(user.id);
    const audioStream = userStat.audioStream;
    let chunk;
    while (null !== (chunk = audioStream.read())) {
        //calculate energy using RMS average of squared samples
        let sampleTotal = 0;
        //iterate through stream every 16bits(2bytes)
        for (i = 0; i < chunk.length - 2; i += 2) {
            let sample = chunk.readInt16LE(i);
            sampleTotal += sample * sample;
        }
        let avg = Math.sqrt(sampleTotal / (chunk.length / 2));
        if (20*Math.log10(avg) < 20) continue;
        userStat.perceivedTotalSampleAvg += avg;
        userStat.perceivedSamples++;
    }
    let dB = 20*Math.log10(userStat.perceivedTotalSampleAvg / userStat.perceivedSamples);
    if (dB < 20) return;
    userStat.perceivedVolume = dB;
    
    //console.log(`Overall volume for ${userStat.user.username}: ${userStat.perceivedVolume}dB`);
}

async function Normalize(guildNormal, message, args)
{
    let retString = ``;
    let quietest;
    let min = 1000;
    let avg = 0;
    let notEnoughSamples = [];
    let desiredVol = 100;
    
    if (args.length < 1){
        retString = `No volume specified, defaulting to 100%\n`;
    } else {
        desiredVol = Number(args[0])
        if (desiredVol === NaN || desiredVol < 0 || desiredVol > 200) return message.channel.send(`${args[0]} isn't a valid volume.`);
    }

    //calcualte average volumes
    guildNormal.userStats.forEach(userStat => {
        if (userStat.user.bot) return;//skip bots
        if (userStat.perceivedSamples < 1)
            notEnoughSamples.push(userStat.user);
        else {
            if (userStat.perceivedVolume <= min) {
                min = userStat.perceivedVolume;
                quietest = userStat;
            }
            avg += userStat.perceivedVolume;
        }
    });
    avg = avg / guildNormal.userStats.length;

    //early exit if we are missing volumes
    if (notEnoughSamples.length >= 1){
        retString = `Some people havn't talked yet!\nWait until the following have talked atleast once:`;
        notEnoughSamples.forEach(user => {retString += `\n     ${user.username}`});
        return message.channel.send(retString);
    }

    let dVolOffset = desiredVol - 100; //offset from 100 to desired volume for quietest
    retString += `Set the following people to the following volumes:\n`;
    retString += `${quietest.user.username} -> ${desiredVol}%`;

    guildNormal.userStats.forEach(userStat => {
        if (userStat.user.id != quietest.user.id && !userStat.user.bot){ //skip quietest and ourself
            //calculate decibel difference in percentage:
            let pctDifference =  Math.pow(10, (quietest.perceivedVolume - userStat.perceivedVolume)/quietest.perceivedVolume);
            retString += `\n${userStat.user.username} -> ${desiredVol - (100 - 100 * pctDifference)}%`;
        }
    });
    return message.channel.send(retString);
}