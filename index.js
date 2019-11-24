//https://discord.js.org/#/docs/main/stable/general/welcome

const Discord = require('discord.js');
const {
    prefix,
    token,
    botUID,
    minSampleVoldB,
} = require('./config.json');

//setup endless silence audio stream
const { Readable } = require('stream');
const SILENCE_FRAME = Buffer.from([0xF8, 0xFF, 0xFE]);
class Silence extends Readable {
    _read() {
        this.push(SILENCE_FRAME);
    }
}

/**
 * DATA STRUCTURES / OBJECTS:
 * 
 * Map guildNormals( {VoiceChannel}.id, {Normal} )
 * 
 * Normal {
 *     voiceChannel: {VoiceChannel},
 *     connection: {Connection},
 *     users: {Map( {User}.id, {UserStats} )},
 * }
 * 
 * userStats {
 *     user: {User},
 *     perceivedTotalSampleAvg: {Float}},
 *     perceivedSamples: {Int},
 *     perceivedVolume: {Float},
 * }
*/

const guildNormals = new Map();
const client = new Discord.Client();

client.login(token);

client.once('ready', () => {
    console.log(`Ready! Connected to ${client.guilds.size} server(s)`);
});
client.once('reconnecting', () => {
    console.log('Reconnecting!');
});
client.once('disconnect', () => {
    console.log('Disconnect!');
});

client.on('message', async message => {
    //ignore invalid messages
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    //check for user to be in GuildNormals
    let guildNormal = false;
    if (message.member.voice.channelID !== undefined) {
        guildNormal = guildNormals.get(message.member.voice.channel.id);
    }

    //parse command and arguments, then handle accordingly
    const args = message.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();

    if (command == 'help') {
        let s = `All commands can be run using the prefix (${prefix}) followed by the first letter of the command.`
        s += `\n${prefix}joinvoice: enters users voice channel and begins calculating normals.`;
        s += `\n${prefix}leavevoice: leaves the current voice channel.`;
        s += `\n${prefix}normalize [number] [-ignore]: prints normalized volumes for each user in the channel, number is the volume desired for the quietest user. If -ignore is present will exclude caller from normal calculations.`;
        s += `\n${prefix}volume: prints perceived volume of each user.`
        message.channel.send(s)
        return;
    } else if (command == 'joinvoice' || command == 'j') {
        joinChannel(message);
        return;
    } else if (command == 'normalize' || command == 'n') {
        if (!guildNormal) return message.send('I need to be in your voice channel.');
        Normalize(guildNormal, message, args);
        return;
    } else if (command == 'leavevoice' || command == 'l') {
        if (!guildNormal) return message.channel.send('I must be in your voice channel to leave it!');
        guildNormals.delete(message.member.voice.channel.id);
        message.member.voice.channel.leave();
        return;
    } else if (command == 'volume' || command == 'v') {
        if (!guildNormal) return message.channel.send('I must be in your voice channel to display user volumes!');
        let s = 'Listing perceived user volumes:\n';
        guildNormals.forEach(guild => {
            guildNormal.userStats.forEach(user => { if (user.user.id != botUID) s += `${user.user.username} -> ${user.perceivedVolume}dB\n` });
        })
        message.channel.send(s);
        return;
    } else {
        message.channel.send('Invalid command, try !help.')
    }
});

client.on('voiceStateUpdate', async (oldVoiceState, newVoiceState) => {
    //determine whether user joined, left, or moved voice channels
    if (oldVoiceState.channelID === null || oldVoiceState.channelID === undefined) userJoinedVoice(newVoiceState);
    else if (newVoiceState.channelID === null) userLeftVoice(oldVoiceState);
    else userMovedVoice(oldVoiceState, newVoiceState);
});

/**
 * Create and add a userState object to the servers GuildNormal object
 * @param {VoiceState} voiceState - The new VoiceState generated by the event 'voiceStateUpdate'.
 */

async function userJoinedVoice(voiceState) {
    let member = voiceState.member;
    //check if we are tracking their channel
    const guildNormal = guildNormals.get(member.voice.channel.id);
    if (guildNormal) {
        //check if we are tracking them, and begin tracking if not
        if (!guildNormal.userStats.get(member.user.id)) {
            const newuser = {
                user: member.user,
                perceivedTotalSampleAvg: 0,
                perceivedSamples: 0,
                perceivedVolume: 0,
            }
            guildNormal.userStats.set(member.user.id, newuser);
        }
    }
}

/**
 * Remove the user referenced by the voiceState from the GuildNormal, then cleanup and leave if channel is now empty
 * @param {VoiceState} voiceState - The old VoiceState generated by the event 'voiceStateUpdate'.
 */
async function userLeftVoice(voiceState) {
    let member = voiceState.member;
    //check if we are tracking their channel
    const guildNormal = guildNormals.get(voiceState.channelID);
    if (guildNormal) {
        //stop tracking the user if they are being tracked
        if (guildNormal.userStats.get(member.user.id)) {
            guildNormal.userStats.delete(member.user.id);
        }

        //check if we are last, and leave
        if (guildNormal.userStats.size == 1)
            voiceState.channel.leave();
    }
}

/**
 * Helper function to call both leave and join when a user moves.
 * @param {VoiceState} oldMember - The new VoiceState generated by the event 'voiceStateUpdate'.
 * @param {VoiceState} newMember - The old VoiceState generated by the event 'voiceStateUpdate'.
 */
async function userMovedVoice(oldMember, newMember) {
    userLeftVoice(oldMember);
    userJoinedVoice(newMember);
}

/**
 * Attempt to join a voice channel, then create and populate a GuildNormal object.
 * @param {Message} message - The message that invoked the call in the first place.
 * @param {GuildNormal} guildNormal - The guildNormal the sender is a part of.
 */
async function joinChannel(message, guildNormal) {
    //confirm if channel is joinable
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.channel.send('You need to be in a voice channel for me to join!');
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
        return message.channel.send('I need the permissions to join your voice channel!');
    }
    if (guildNormal) return message.channel.send("I'm already in here!");

    //attempt joining
    try {
        const connection = await voiceChannel.join();
        const normals = {
            voiceChannel: voiceChannel,
            connection: connection,
            userStats: new Map(),
        };

        //populate userStats for each person in the channel
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

        //store newly created GuildNormal
        guildNormals.set(voiceChannel.id, normals);

        //begin playing silence forever, solves issue of:
        //- discord not sending voice unless bot has sent voice
        //- discord stopping transmission of voice after 5 minutes of bot not sending voice
        const dispatcher = connection.play(new Silence(), { type: 'opus' });

        //add listener events for user speech
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

    } catch (err) {
        //cleanup and send error in channel
        console.log(err);
        guildNormals.delete(voiceChannel.id);
        return message.channel.send(err);
    }
}

/**
 * Begins receiving voice, and calculates average volumes of each voice chunk
 * @param {GuildNormal} guildNormal - The guildNormal the speaker is a part of.
 * @param {User} user - The user who started speaking.
 */
async function BeginRecording(guildNormal, user) {
    const userStat = guildNormal.userStats.get(user.id);
    const receiver = guildNormal.connection.receiver;
    //create the stream to receive the voice data, automatically destroyed when they stop talking
    const audioStream = receiver.createStream(user, { mode: 'pcm', end: 'silence' });//32bit signed stero 48khz
    //calculate average volumes as data comes in
    audioStream.on('readable', () => {
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
            if (20 * Math.log10(avg) < minSampleVoldB) continue;
            userStat.perceivedTotalSampleAvg += avg;
            userStat.perceivedSamples++;
        }
    });
    guildNormal.userStats.get(user.id).audioStream = audioStream;
}

/**
 * Calculates and stores average volume of all voice chunks, automatically called when the user stops talking
 * @param {GuildNormal} guildNormal - The guildNormal the speaker is a part of.
 * @param {User} user - The user who started speaking.
 */
async function EndRecording(guildNormal, user) {
    const userStat = guildNormal.userStats.get(user.id);
    let dB = 20 * Math.log10(userStat.perceivedTotalSampleAvg / userStat.perceivedSamples);
    userStat.perceivedVolume = dB;
    //console.log(`Overall volume for ${userStat.user.username}: ${userStat.perceivedVolume}dB`);
}

/**
 * Calculates and sends the volumes required to set the quietest speaker to the desired volume
 * @param {GuildNormal} guildNormal - The guildNormal the person who invoked the command is a part of.
 * @param {Message} message - The message that invoked the command.
 * @param {string[]} args - Arguments from the execution command. Only first argument is used currently.
 */
async function Normalize(guildNormal, message, args) {
    let retString = ``;
    let quietest;
    let min = 1000;
    let avg = 0;
    let notEnoughSamples = [];
    let desiredVol = 100;
    let skipSender = false;

    //sanitize input
    if (args.length < 1) {
        retString = `No volume specified, defaulting to 100%\n`;
    } else {
        desiredVol = Number(args[0])
        if (desiredVol === NaN || desiredVol < 0 || desiredVol > 200) return message.channel.send(`${args[0]} isn't a valid volume.`);
        if (args.length >= 2 && (args[1] == '-i' || args[1] == '-ignore')) skipSender = true;
    }

    //calcualte average volumes
    guildNormal.userStats.forEach(userStat => {
        if (userStat.user.bot) return;//skip bots
        if (skipSender && userStat.user.id == message.member.id) return; //skip sender if flag exists
        //ensure everyone has spoken, prep return array to inform those who havn't
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
    if (notEnoughSamples.length >= 1) {
        retString = `Some people havn't talked yet!\nWait until the following have talked atleast once:`;
        notEnoughSamples.forEach(user => { retString += `\n     ${user.username}` });
        return message.channel.send(retString);
    }

    //setup outputs
    retString += `Set the following people to the following volumes:\n`;
    retString += `${quietest.user.username} -> ${desiredVol}%`;

    //calculate and scale quietest to desired volume
    let qAvg = quietest.perceivedTotalSampleAvg / quietest.perceivedSamples;

    guildNormal.userStats.forEach(userStat => {
        if (userStat.user.id == quietest.user.id || userStat.user.bot) return; //skip quietest and ourself
        if (skipSender && userStat.user.id == message.member.id) return; //skip sender if flag exists
        //calculate average and difference to quietest
        let userAvg = userStat.perceivedTotalSampleAvg / userStat.perceivedSamples;
        let diffAvg = userAvg - qAvg;
        //calculate percentage of current volume after removing difference to queitest
        let volumeScalar = (userAvg - diffAvg) / userAvg * desiredVol;
        //add user's new volume to output
        retString += `\n${userStat.user.username} -> ${volumeScalar.toFixed(2)}%`;
    });
    return message.channel.send(retString);
}