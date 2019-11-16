const Discord = require('discord.js');
const {
    prefix,
    token,
} = require('./config.json');

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
    percievedAverageVolume: 0,
    percievedSamples: 0,
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

    if (message.content.startsWith(`${prefix}help`)) {
        message.channel.send('!joinvoice : enters users voice channel and begins calculating normals.\n!normalize [number]: prints normalized volumes for each user in the channel, number is the volume desired for the quietest user.\n!leavevoice to have the bot exit the voice channel.')
        return;
    }else if (message.content.startsWith(`${prefix}joinvoice`)) {
        joinChannel(message);
        return;
    }else if (message.content.startsWith(`${prefix}normalize`)) {
        return;
    }else if (message.content.startsWith(`${prefix}leavevoice`)) {
        guildNormals.delete(message.member.voiceChannel.id);
        return;
    }else if (message.content.startsWith(`${prefix}status`)) {
        guildNormals.forEach(guild => {
            guild.userStats.forEach(user => console.log(user.user.username));
        })
        return;
    } else {
        message.channel.send('Invalid command, try !help.')
    }
});


client.on('voiceStateUpdate', async (oldMember, newMember) =>{
    if (oldMember.voiceChannel === undefined) userJoinedVoice(newMember);
    else if (newMember.voiceChannel === undefined) userLeftVoice(oldMember);
    else userMovedVoice(oldMember, newMember);
});

async function userJoinedVoice(member){ 
    //console.log(member.user.username + ' joined ' + member.voiceChannel.name)
    var guildNormal = guildNormals.get(member.voiceChannel.id);
    if (guildNormal){
        if (!guildNormal.userStats.get(member.user.id)){
            const newuser = {
                user: member.user,
                percievedAverageVolume: 0,
                percievedSamples: 0,
            }
            guildNormal.userStats.set(member.user.id, newuser);
        }
    }
}

async function userLeftVoice(member){
    //console.log(member.user.username + ' left ' + member.voiceChannel.name)
    var guildNormal = guildNormals.get(member.voiceChannel.id);
    if (guildNormal){
        if (guildNormal.userStats.get(member.user.id)){
            guildNormal.userStats.delete(member.user.id);
        }

        //check if we are last
        if (guildNormal.userStats.size == 1)
            member.voiceChannel.leave();
    }
}

async function userMovedVoice(oldMember, newMember){
    userLeftVoice(oldMember);
    userJoinedVoice(newMember);
}

async function joinChannel(message, guildNormal) {
    const voiceChannel = message.member.voiceChannel;
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
                percievedAverageVolume: 0,
                percievedSamples: 0,
            }
            normals.userStats.set(element.user.id, userStats);
        });
        //console.log(normals.users);
        guildNormals.set(voiceChannel.id, normals);
        
        try {
            var connection = await voiceChannel.join();
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