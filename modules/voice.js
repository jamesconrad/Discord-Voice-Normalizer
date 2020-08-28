//setup endless silence audio stream
const { Readable } = require('stream');
const help = require('../modules/help');
const activity = require('../modules/activity');
const command = require('../modules/command');
const config = require('../config.json');

const SILENCE_FRAME = Buffer.from([0xF8, 0xFF, 0xFE]);
class Silence extends Readable {
    _read() {
        this.push(SILENCE_FRAME);
    }
}
const guildNormals = new Map();
exports.guildNormals = guildNormals;
let minSampleVoldB = config.minSampleVoldB;
let client;

async function Initialize(botClient) {
    //register commands
    let c = [
        { command: 'joinvoice', callback: joinChannel },
        { command: 'leavevoice', callback: leaveChannel },
        { command: 'normalize', callback: Normalize },
        { command: 'volume', callback: DisplayVolume },
    ];
    command.RegisterModule("voice", c, true, 2);
    
    client = botClient;
    AddHelpPages();
    activity.AddActivityCheck('voice', IsActive);
}
exports.Initialize = Initialize;

/**
 * Create and add a userState object to the servers GuildNormal object
 * @param {VoiceState} voiceState - The new VoiceState generated by the event 'voiceStateUpdate'.
 */

async function userJoinedVoice(voiceState) {
    let member = voiceState.member;
    if (member == null) {
        console.log(`ERROR: member of voiceState was null on user joining voice`);
        console.log(voiceState);
    }
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
exports.userJoinedVoice = userJoinedVoice;

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

        //count current bots in voice channel
        let botCount = 0;
        guildNormal.userStats.forEach(userStat => {
            if (userStat.user.bot) botCount++;
        });
        //if we are alone or in a channel of bots, leave channel
        if (guildNormal.userStats.size == 1 || botCount == guildNormal.userStats.size)
            autoleaveChannel(guildNormal);
    }
}
exports.userLeftVoice = userLeftVoice;

/**
 * Helper function to call both leave and join when a user moves.
 * @param {VoiceState} oldMember - The new VoiceState generated by the event 'voiceStateUpdate'.
 * @param {VoiceState} newMember - The old VoiceState generated by the event 'voiceStateUpdate'.
 */
async function userMovedVoice(oldVoiceState, newVoiceState) {
    userLeftVoice(oldVoiceState);
    userJoinedVoice(newVoiceState);
}
exports.userMovedVoice = userMovedVoice;

/**
 * Attempt to join a voice channel, then create and populate a GuildNormal object.
 * @param {Message} message - The message that invoked the call in the first place.
 * @param {GuildNormal} guildNormal - The guildNormal the sender is a part of.
 */
async function joinChannel(message, args) {
    //confirm if channel is joinable
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.channel.send('You need to be in a voice channel for me to join!');
    const permissions = voiceChannel.permissionsFor(message.guild.me);
    if (!permissions.has('VIEW_CHANNEL')) {
        return message.channel.send('I need permissions to view your voice channel!');
    } else if (!permissions.has('CONNECT')){
        return message.channel.send('I need the permissions to join your voice channel!');
    } else if (!permissions.has('SPEAK')) {
        return message.channel.send('Due to a restriction imposed by discord API, I need permissions to speak in that channel. Please note I will only be transmitting silence, and if you wish you may Server Mute me.');
    } else if (voiceChannel.full) {
        return message.channel.send('Your voice channel is full. Expand the limit or try again later.');
    }
    if (voiceChannel.members.filter(user => user.id === client.user.id).size >= 1) return message.channel.send("I'm already in here!");

    //attempt joining
    try {
        const connection = await voiceChannel.join();
        const normals = {
            voiceChannel: voiceChannel,
            guildId: message.guild.id,
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
            if(!user) console.log(`ERROR: user is undefined, ${user} -> ${speaking.bitfield}`);
            //speaking started
            if (speaking.bitfield == 1) {
                BeginRecording(guildNormals.get(connection.channel.id), user);
            }
            //speaking stopped
            if (speaking.bitfield == 0) {
                EndRecording(guildNormals.get(connection.channel.id), user);
            }
        })
        console.log(`Joined voice channel: ${connection.channel.guild.name} -> ${connection.channel.name}`);
    } catch (err) {
        //cleanup and send error in channel
        console.log(err);
        guildNormals.delete(voiceChannel.id);
        return message.channel.send(err);
    }
}
exports.joinChannel = joinChannel;

async function autoleaveChannel(guildNormal) {
    guildNormals.delete(guildNormal.connection.channel.id);
    console.log(`Leaving voice channel: ${guildNormal.connection.channel.guild.name} -> ${guildNormal.connection.channel.name}\n\tCurrently in ${guildNormals.size} channels.`);
    guildNormal.connection.channel.leave();
}

async function leaveChannel(message, args) {
    let guildNormal;
    if (guildNormals.has(message.member.voice.channelID)) {
        guildNormal = guildNormals.get(message.member.voice.channel.id);
    } else {
        return message.channel.send('I need to be in your voice channel to leave it!');
    }

    guildNormals.delete(guildNormal.connection.channel.id);
    console.log(`Leaving voice channel: ${guildNormal.connection.channel.guild.name} -> ${guildNormal.connection.channel.name}\n\tCurrently in ${guildNormals.size} channels.`);
    guildNormal.connection.channel.leave();
}
exports.leaveChannel = leaveChannel;
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
            if (ToDecibels(avg) < minSampleVoldB) continue;
            userStat.perceivedTotalSampleAvg += avg;
            userStat.perceivedSamples++;
        }
    });
    guildNormal.userStats.get(user.id).audioStream = audioStream;
}
exports.BeginRecording = BeginRecording;

/**
 * Calculates and stores average volume of all voice chunks, automatically called when the user stops talking
 * @param {GuildNormal} guildNormal - The guildNormal the speaker is a part of.
 * @param {User} user - The user who started speaking.
 */
async function EndRecording(guildNormal, user) {
    const userStat = guildNormal.userStats.get(user.id);
    if (userStat === undefined) return; //the user left the voice channel before stopping their transmission
    if (userStat.perceivedTotalSampleAvg === undefined) {
        console.log('End Recording error printout:')
        console.log(userStat);
    }
    let dB = ToDecibels(userStat.perceivedTotalSampleAvg / userStat.perceivedSamples);
    userStat.perceivedVolume = dB;
    //console.log(`Overall volume for ${userStat.user.username}: ${userStat.perceivedVolume}dB`);
}
exports.EndRecording = EndRecording;

/**
 * Calculates and sends the volumes required to normalize speaker volumes based on arguments
 * @param {GuildNormal} guildNormal - The guildNormal the person who invoked the command is a part of.
 * @param {Message} message - The message that invoked the command.
 * @param {string[]} args - Arguments from the execution command. Only first argument is used currently.
 */
async function Normalize(message, args) {
    let guildNormal;
    if (guildNormals.has(message.member.voice.channelID)) {
        guildNormal = guildNormals.get(message.member.voice.channel.id);
    } else {
        return message.channel.send('I need to be in your voice channel to calculate normals!');
    }

    let retString = ``;
    let quietest;
    let min = 9007199254740992;//max size of int
    let avg = 0;
    let totalSampleVol = 0;
    let notEnoughSamples = [];
    let desiredVol = -1;
    let argFlags = { ignoreSender: false, useAverageVol: false };
    let ignoredUsers = [];

    //parse args
    if (args.length > 0 && (args[0] == '-h' || args[0] == '-help')) {
        retString = "Valid arguments are:";
        retString += "\n[number] : any number within 0 - 200 (inclusive)";
        retString += "\n-a or -average : center each user around voice chat average volume";
        retString += "\n-i or -ignore : remove yourself from calculations";
        retString += `\nExample: !n 50 -a : determines user volumes in relation to half room average`;
        return message.channel.send(retString)
    }
    args.forEach(a => {
        let n = Number(a);
        if (n !== NaN && (n > 0 && n <= 200)) desiredVol = n;

        if (a == '-i' || a == '-ignore') {
            argFlags.ignoreSender = true;
            ignoredUsers.push(message.member.id)
        }
        else if (a == '-a' || a == '-average') {
            argFlags.useAverageVol = true;
        }
    });
    if (desiredVol < 0 || desiredVol > 200) {
        retString += `No valid volume passed, defaulting to 100%\n`;
        desiredVol = 100;
    }

    //filter out all users that are bots, or removed via args
    let filteredUserStats = []
    guildNormal.userStats.forEach(userStat => {
        if (ignoredUsers.includes(userStat.user.id)) return;
        else if (userStat.user.bot) return;
        filteredUserStats.push(userStat)
    });
    if (!(filteredUserStats.length > 0)) return message.channel.send("Error: All users in chat are being filtered out. Try removing some filters you have set.")

    //calcualte average volumes
    filteredUserStats.forEach(userStat => {
        //ensure everyone has spoken, prep return array to inform those who havn't
        if (userStat.perceivedSamples < 1)
            notEnoughSamples.push(userStat.user);
        else {
            let userAvg = userStat.perceivedTotalSampleAvg / userStat.perceivedSamples;
            if (userAvg <= min) {
                min = userAvg;
                quietest = userStat;
            }
            totalSampleVol += userAvg;
        }
    });
    avg = totalSampleVol / filteredUserStats.length;

    //early exit if we are missing volumes
    if (notEnoughSamples.length >= 1) {
        retString = `Some people havn't talked yet!\nWait until the following have talked at least once:`;
        notEnoughSamples.forEach(user => { retString += `\n     ${user.username}` });
        return message.channel.send(retString);
    }

    //setup outputs
    retString += `Set the following people to the following volumes:`;

    //calculate and scale quietest to desired volume
    let qAvg = argFlags.useAverageVol ? avg : quietest.perceivedTotalSampleAvg / quietest.perceivedSamples;
    let targetdB = ToDecibels(qAvg);

    //convert desired volume scalar into a db value, and offset our target by it
    targetdB += 33.21928095 * (Math.log((desiredVol / 100))) / Math.log(10);

    filteredUserStats.forEach(userStat => {
        //calculate target db levels
        let userdB = ToDecibels(userStat.perceivedTotalSampleAvg / userStat.perceivedSamples);
        let deltadB = targetdB - userdB;
        //calculate ratio of difference in percieved db change
        let loudnessRatio = Math.pow(10, 0.301029995664 * (deltadB) / 10);
        //add user's new volume to output
        retString += `\n${userStat.user.username} -> ${(loudnessRatio * 100).toFixed(2)}% (△${deltadB.toFixed(2)}dB)`;
    });
    return message.channel.send(retString);
}
exports.Normalize = Normalize;

//displays user volumes of requested channel
function DisplayVolume(message, args) {
    let guildNormal;
    if (guildNormals.has(message.member.voice.channelID)) {
        guildNormal = guildNormals.get(message.member.voice.channel.id);
    } else {
        return message.channel.send('I need to be in your voice channel to display user volumes!');
    }
    let s = 'Listing perceived user volumes:\n';
    guildNormal.userStats.forEach(user => { if (!user.user.bot) s += `${user.user.username} -> ${user.perceivedVolume.toFixed(2)}dB\n` });
    return message.channel.send(s);
}

/**
 * Converts from average linear volumes to dB (logarithmic)
 * @param {Int} num - Sum of volume samples squared.
 */
function ToDecibels(num) {
    return 20 * Math.log10(num)
}
exports.ToDecibels = ToDecibels;

function IsActive() {
    return guildNormals.size != 0;
}

function RemoveGuild(guild) {
    guildNormals.forEach((n, k) => {
        if (n.guildId == guild.id) {
            guildNormals.delete(k);
            console.log(`\tKicked from guild ${guild.name} while in voice channel -> ${n.voiceChannel.name}.\n\tCurrently in ${guildNormals.size} channels.`)
        }
    });
}
exports.RemoveGuild = RemoveGuild;

function AddHelpPages() {
    let page = {
        description: `Module: Voice`,
        fields: [
            { name: '!joinvoice', value: 'Join your voice channel.', inline: true },
            { name: '!leavevoice', value: 'Leave your voice channel.', inline: true },
            { name: '!volume', value: 'Display each speakers percieved volume.', inline: true },
            { name: '!normalize [desired volume]', value: 'Display normalized user volumes.\n(Relative to quietest user)', inline: true },
            { name: '!normalize -a [desired volume]', value: 'Display normalized user volumes.\n(Relative to average volume)', inline: true },
        ]
    };
    help.AddPage('voice', page);
}