//https://discord.js.org/#/docs/main/stable/general/welcome

const Discord = require('discord.js');
const {
    prefix,
    token,
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

    const guildNomral = guildNormals.get(message.guild.id);

    const args = message.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();

    if (command == 'help') {
        message.channel.send(`${prefix}joinvoice : enters users voice channel and begins calculating normals.\n${prefix}normalize [number]: prints normalized volumes for each user in the channel, number is the volume desired for the quietest user.\n${prefix}leavevoice to have the bot exit the voice channel.`)
        return;
    }else if (command == 'joinvoice') {
        joinChannel(message);
        return;
    }else if (command == 'normalize') {
        return;
    }else if (command == 'leavevoice') {
        guildNormals.delete(message.member.voice.channel.id);
        message.member.voice.channel.leave();
        return;
    }else if (command == 'status') {
        guildNormals.forEach(guild => {
            guild.userStats.forEach(user => console.log(user.user.username));
        })
        return;
    }else if (command == 'boop') {
        guildNormals.get(message.member.user.id).connection.playFile('./blop.wav');
        return;
    }else if (command === 'avatar') {
            if (!message.mentions.users.size) {
                return message.channel.send(`Your avatar: <${message.author.displayAvatarURL}>`);
            }
        
            const avatarList = message.mentions.users.map(user => {
                return `${user.username}'s avatar: <${user.displayAvatarURL}>`;
            });
        
            // send the entire array of strings as a message
            // by default, discord.js will `.join()` the array with `\n`
            message.channel.send(avatarList);
    } else {
        message.channel.send('Invalid command, try !help.')
    }
});


client.on('voiceStateUpdate', async (oldMember, newMember) => {
    if (oldMember.channelID === null || oldMember.channelID === undefined) userJoinedVoice(newMember);
    else if (newMember.channelID === null) userLeftVoice(oldMember);
    else userMovedVoice(oldMember, newMember);
});

async function userJoinedVoice(voiceState){ 
    let member = voiceState.member;
    const guildNormal = guildNormals.get(member.voice.channel.id);
    if (guildNormal){
        if (!guildNormal.userStats.get(member.user.id)){
            const newuser = {
                user: member.user,
                //audioStream: guildNormal.voiceReceiver.createStream(member, {}),
                perceivedAverageVolume: 0,
                perceivedSamples: 0,
            }
            guildNormal.userStats.set(member.user.id, newuser);
        }
    }
}

async function userLeftVoice(voiceState){
    let member = voiceState.member;
    const guildNormal = guildNormals.get(voiceState.channelID);
    if (guildNormal){
        if (guildNormal.userStats.get(member.user.id)){
            guildNormal.userStats.delete(member.user.id);
        }

        //check if we are last
        if (guildNormal.userStats.size == 1)
            voiceState.channel.leave();
    }
}

async function userMovedVoice(oldMember, newMember){
    userLeftVoice(oldMember);
    userJoinedVoice(newMember);
}

async function joinChannel(message, guildNormal) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.channel.send('You need to be in a voice channel for me to join!');
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
        return message.channel.send('I need the permissions to join your voice channel!');
    }
    
    
    if (!guildNormal){
        const normals = {
            voiceChannel: voiceChannel,
            connection: null,
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
        //console.log(normals.users);
        guildNormals.set(voiceChannel.id, normals);

        try {
            const connection = await voiceChannel.join();
            guildNormals.get(voiceChannel.id).connection = connection;
            //const dispatcher = conn.playFile(new Silence(), { type: 'opus' });
            const dispatcher = connection.play('./blop.mp3');
            
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
            //console.log(guildNormals.get(message.guild.id));
        } catch (err) {
            console.log(err);
            guildNormals.delete(voiceChannel.id);
            return message.channel.send(err);
        }
    }
    else{
        return message.channel.send("I'm already in here!");
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
        //iterate through stream every 32bits(4bytes)
        //i believe chunk is null terminated
        for (i = 0; i < chunk.length - 2; i += 2) {
            let sample = chunk.readInt16LE(i);
            sampleTotal += sample * sample;
        }
        let avg = Math.sqrt(sampleTotal / (chunk.length / 2));
        userStat.perceivedTotalSampleAvg += avg;
        userStat.perceivedSamples++;
    }
    userStat.perceivedVolume = 20*Math.log10(userStat.perceivedTotalSampleAvg / userStat.perceivedSamples)
    console.log(`Overall volume for ${userStat.user.username}: ${userStat.perceivedVolume} DB`);
}