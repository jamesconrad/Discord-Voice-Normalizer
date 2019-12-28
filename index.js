//https://discord.js.org/#/docs/main/stable/general/welcome

const Discord = require('discord.js');
const {
    prefix,
    token,
    botUID,
    minSampleVoldB,
    triviaTimeout,
} = require('./config.json');
const https = require('https');
const sqlite = require('sqlite3');

//trivia setup:
console.log('Performing pre-discord module setups...');
let trivia = {
    apiToken: 0,//session token
    categories: [],
};
https.get('https://opentdb.com/api_category.php', (resp) => {
    let data = '';
    resp.on('data', (chunk) => {
        data += chunk;
    });
    resp.on('end', () => {
        trivia.categories = trivia.categories.concat(JSON.parse(data).trivia_categories);
    });
}).on("error", (err) => {
    console.log("Trivia HTTP Error: " + err.message);
});
let triviadb = new sqlite.Database('./db/trivia.db', sqlite.OPEN_READWRITE, (err) => {
    if (err) console.log(err.message);
    else console.log('Trivia DB Connected');
})
let triviaToken = '';
GenerateNewTriviaToken();
console.log('Trivia module setup complete.');
//

console.log('Attempting Discord connection...');
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
//client.on('debug', s => console.log(s));
client.once('ready', () => {
    console.log(`Ready! Connected to ${client.guilds.size} server(s)`);
    client.guilds.forEach(g => TriviaDBUpdateGuild(g));
});
client.once('reconnecting', () => {
    console.log('Reconnecting!');
});
client.once('disconnect', () => {
    console.log('Disconnect!');
});
client.on('guildCreate', guild => {
    console.log(`Added to Guild: ${guild.name}`);
    TriviaDBCreateGuild(guild)
});
client.on('guildDelete', guild => {
    console.log(`Removed from Guild: ${guild.name}`);
    TriviaDBRemoveGuild(guild);
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
        s += `\n${prefix}normalize: normalizes user voice volumes in a voice channel. Use -help as an argument for more information.`;
        s += `\n${prefix}volume: prints perceived volume of each user.`
        s += `\n${prefix}trivia.`
        message.channel.send(s)
        return;
    } else if (command == 'joinvoice' || command == 'j') {
        joinChannel(message);
        return;
    } else if (command == 'normalize' || command == 'n') {
        if (!guildNormal) return message.channel.send('I need to be in your voice channel to calculate norrmals!');
        Normalize(guildNormal, message, args);
        return;
    } else if (command == 'leavevoice' || command == 'l') {
        if (!guildNormal) return message.channel.send('I need to be in your voice channel to leave it!');
        guildNormals.delete(message.member.voice.channel.id);
        message.member.voice.channel.leave();
        return;
    } else if (command == 'volume' || command == 'v') {
        if (!guildNormal) return message.channel.send('I need to be in your voice channel to display user volumes!');
        let s = 'Listing perceived user volumes:\n';
        guildNormals.forEach(guild => {
            guildNormal.userStats.forEach(user => { if (user.user.id != botUID) s += `${user.user.username} -> ${user.perceivedVolume.ToFixed(2)}dB\n` });
        })
        message.channel.send(s);
        return;
    } else if (command == 'trivia') {
        Trivia(message, args)
    } else if (command == 'ee') {
        EscapeEmote(message, args)
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
            if (ToDecibels(avg) < minSampleVoldB) continue;
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
    let dB = ToDecibels(userStat.perceivedTotalSampleAvg / userStat.perceivedSamples);
    userStat.perceivedVolume = dB;
    //console.log(`Overall volume for ${userStat.user.username}: ${userStat.perceivedVolume}dB`);
}

/**
 * Calculates and sends the volumes required to normalize speaker volumes based on arguments
 * @param {GuildNormal} guildNormal - The guildNormal the person who invoked the command is a part of.
 * @param {Message} message - The message that invoked the command.
 * @param {string[]} args - Arguments from the execution command. Only first argument is used currently.
 */
async function Normalize(guildNormal, message, args) {
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
        retString += `\nExample: ${prefix}n 50 -a : determines user volumes in relation to half room average`;
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

/**
 * Converts from average linear volumes to dB (logarithmic)
 * @param {Int} num - Sum of volume samples squared.
 */
function ToDecibels(num) {
    return 20 * Math.log10(num)
}

async function EscapeEmote(message, args) {
    return message.channel.send(`\\${args[0]}`);
}

const triviaScores = new Map();

async function Trivia(message, args) {
    let apicall = `https://opentdb.com/api.php?amount=1&token=${triviaToken}`;

    for (i = 0; i < args.length; i++) {
        if (args[i] == '-categories') {
            let retString = 'Possible categories are:';
            trivia.categories.forEach(c => (retString += `\n${c.name}, ID: ${c.id}`));
            return message.channel.send(retString);
        } else if (args[i] == '-c') {
            if (i >= args.length - 1) return message.channel.send('You need to specifiy a category id after the -c argument, list the categories and their ids with -categories');
            let id = Number(args[i + 1]);
            if (id === NaN) return message.channel.send(`${id} is not a number, and therefore an invalid category`);
            let validId = false;
            for (j = 0; j < trivia.categories.length; j++) {
                if (trivia.categories[j].id == id) {
                    validId = true;
                    break;
                }
            }
            if (!validId) return message.channel.send(`${id} is not a valid category id number, double check categories with -categories`);
            apicall += `&category=${id}`;
        } else if (args[i] == '-score') {
            let retString = `\`\`\`${message.guild.name} Trivia Scores:`;
            let sql = `SELECT user_id id FROM guild_members WHERE guild_id = ${message.guild.id}`;
            let table = [];
            triviadb.all(sql, (err, row) => {
                if (err) console.log(err.message);
                if (!row) return message.send(`Nobody on this server has played trivia.`);
                row.forEach(r => {
                    triviadb.get(`SELECT user_id id, name n, score s FROM users WHERE user_id = ${r.id}`, (err, userEntry) => {
                        if (!userEntry) return;
                        table.push(userEntry);
                    });
                });
                setTimeout(() => {
                    table = table.sort((a,b) => (a.s < b.s));
                    table.forEach(e => retString += `\n${e.n}: ${e.s}`);
                    return message.channel.send(retString + '\`\`\`');
                }, 500);
            });
            return;
        } else if (args[i] == '-reset') {
            RefreshTriviaToken();
        } else if (args[i] == '-h' || args[i] == '-help') {
            return message.channel.send('I was lazy, heres the quick form:\n-categories : lists categories\n-c [id] : runs a question from the category id\n-score : lists scores\n-reset : resets repeat question prevention');
        }
    }

    https.get(apicall, (resp) => {
        let data = '';
        resp.on('data', (chunk) => {
            data += chunk;
        });
        resp.on('end', () => {
            let question = JSON.parse(data);
            if (question.response_code == 2) message.channel.send(`Trivia API Error: ${apicall} returned invalid parameter`)
            else if (question.response_code == 4) {
                RefreshTriviaToken();
                return Trivia(message, args);
            } else if (question.response_code == 3) {
                GenerateNewTriviaToken();
                return Trivia(message, args);
            }
            question = question.results[0];
            question.question = question.question.replace(/&quot;/g, '\"').replace(/&#039;/g, '\'').replace(/&eacute;/g, 'é');
            let questionReward = TriviaDifficultyToScore(question.difficulty);
            
            let correct_answer;
            let formattedResponse;
            let answerEmotes;
            if (question.type == 'multiple') {
                let answerIdx = 0;
                let answers = [];
                answerEmotes = [`🇦`, `🇧`, `🇨`, `🇩`]
                answers = question.incorrect_answers.sort(() => Math.random() - 0.5);
                answerIdx = Math.floor(Math.random() * answers.length);
                answers.splice(answerIdx, 0, question.correct_answer);
                formattedResponse = `\`\`\`Category: ${question.category}\nDifficulty: ${question.difficulty}\`\`\`\n**${question.question}**\n`
                for (i = 0; i < answers.length; i++)
                    formattedResponse += `\n${answerEmotes[i]} - ${answers[i]}`
                correct_answer = answerEmotes[answerIdx];
            } else {
                formattedResponse = `\`\`\`Category: ${question.category}\nDifficulty: ${question.difficulty}\`\`\`\n**${question.question}**\n`
                correct_answer = question.correct_answer === 'True' ? '✅' : '❎';
                answerEmotes = [`✅`, `❎`];
            }
            message.channel.send(formattedResponse).then(m => {
                answerEmotes.forEach(e => m.react(e));

                const filter = (reaction, user) => (/*reaction.emoji.name == correct_answer && !user.bot*/true);
                m.awaitReactions(filter, { time: triviaTimeout }).then(collected => {
                    let correct_users = '';
                    let disqual_users = '';
                    let finalWinners = collected.get(correct_answer).users;
                    let disqualified = [];
                    for(i = 0; i < answerEmotes.length; i++) {
                        if (answerEmotes[i] == correct_answer) continue;
                        finalWinners = finalWinners.filter(u => {
                            let vs = collected.get(answerEmotes[i]).users.get(u.id);
                            let a = finalWinners.get(u.id);
                            if (vs && a && a.bot == false && vs.id == a.id)
                                if (!disqualified.includes(vs.username))
                                disqualified.push(vs.username);
                            return !(vs && a && vs.id == a.id);
                        });
                    }
                    finalWinners.forEach(user => correct_users += ` ${user.username},`);
                    disqualified.forEach(u => disqual_users += ` ${u},`);
                    ModTriviaScores(finalWinners, questionReward, message.guild);
                    
                    correct_users = correct_users.slice(0, -1);
                    disqual_users = disqual_users.slice(0, -1);
                    let retString = `Awnser: ${correct_answer}`;
                    if (disqualified.length > 0) retString += `\nDisqualified: ${disqual_users}`;
                    return m.channel.send(retString + (correct_users == '' ? `\nYou all suck.` : `\nCongrats:` + correct_users));
                });
            });
        });
    }).on("error", (err) => {
        return message.channel.send("Trivia API Error: " + err.message);
    });
}

async function ModTriviaScores(users, value, guild) {
    //check for user exists in guild members
    let sql = `SELECT user_id id FROM guild_members WHERE guild_id = ${guild.id}`;
    triviadb.all(sql, (err, row) => {
        if (err) console.log(err.message);
        let newUsers = users.filter(u => !row.filter(r => u.id == r.id).length > 0);
        newUsers.forEach(u => triviadb.run(`INSERT INTO guild_members (user_id, guild_id) VALUES (${u.id}, ${guild.id})`));
    });
    //update or insert users state
    users.forEach(u => {
        triviadb.get(`SELECT score s FROM users WHERE user_id = ${u.id}`, (err, row) => {
            if (err) console.log(err.message);
            if (row) triviadb.run(`UPDATE users SET name = \'${u.username}\', score = ${row.s + value} WHERE user_id = ${u.id}`);
            else triviadb.run(`INSERT INTO users (user_id, name, score) VALUES (${u.id}, \'${u.username}\', ${value})`);
        });
    })
    triviadb.run(`UPDATE guilds SET total_score = total_score + ${users.size * value} WHERE guild_id = ${guild.id}`);
}

function TriviaDifficultyToScore(difficulty) {
    if (difficulty === 'easy') return 1;
    else if (difficulty === 'medium') return 3;
    else if (difficulty === 'hard') return 5;
    else return 0;
}

function RefreshTriviaToken() {
    https.get(`https://opentdb.com/api_token.php?command=reset&token=${triviaToken}`, (resp) => {
        let data = '';
        resp.on('data', (chunk) => {
            data += chunk;
        });
        resp.on('end', () => {
            triviaToken = JSON.parse(data).token;
            console.log(`Trivia token reset: ${triviaToken}`);
        });
    }).on("error", (err) => {
        console.log("Trivia HTTP Error: " + err.message);
    });
}

function GenerateNewTriviaToken() {
    https.get('https://opentdb.com/api_token.php?command=request', (resp) => {
        let data = '';
        resp.on('data', (chunk) => {
            data += chunk;
        });
        resp.on('end', () => {
            triviaToken = JSON.parse(data).token;
            console.log(`Trivia token retrieved: ${triviaToken}`);
        });
    }).on("error", (err) => {
        console.log("Trivia HTTP Error: " + err.message);
    });
}

function TriviaDBUpdateGuild(guild) {
    let sql = `SELECT name n FROM guilds WHERE guild_id = ${guild.id};`;
    triviadb.get(sql, (err, row) => {
        if (err) return console.log(err.message);
        if (!row) return TriviaDBCreateGuild(guild);

        sql = `UPDATE guilds SET name = \'${guild.name}\' WHERE guild_id = ${guild.id};`;
        triviadb.run(sql, (err) => {
            if (err) console.log(err.message);
        });
    });
}

function TriviaDBCreateGuild(guild) {
    let sql = `INSERT INTO guilds (guild_id, name, total_score) VALUES (${guild.id}, \'${guild.name}\', 0);`;
    triviadb.run(sql, (err) => {
        if (err) console.log(err.message);
    });
}

function TriviaDBRemoveGuild(guild) {
    let sql = `DELETE FROM guilds WHERE guild_id = ${guild.id};`;
    triviadb.run(sql, (err) => {
        if (err) console.log(err.message);
    });
}