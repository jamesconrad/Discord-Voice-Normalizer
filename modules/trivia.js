const https = require('https');
const sqlite = require('sqlite3');
const help = require('../modules/help');
const activity = require('../modules/activity');

const config = require('../config.json');

let trivia = {
    apiTokens: new Map(),//session token
    categories: [],
    timeout: 0,
    db: 0,
    lastUsed: new Date()
};

async function Initialize() {
    AddHelpPages();
    activity.AddActivityCheck('trivia', IsActive)
    trivia.timeout = config.triviaTimeout;
    trivia.db = new sqlite.Database('./db/trivia.db', sqlite.OPEN_READWRITE, (err) => {
        if (err) console.log(err.message);
        else console.log('Trivia DB Connected');
    });
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
    console.log('Trivia Module Initialized.');
}
exports.Initialize = Initialize;

async function Trivia(message, args) {
    trivia.lastUsed = new Date();
    if (!trivia.apiTokens.has(message.guild.id))
        await GenerateNewTriviaToken(message.guild.id);
    let token = trivia.apiTokens.get(message.guild.id);

    let apicall = `https://opentdb.com/api.php?amount=1&token=${token}`;
    let repeatIdx = 0;
    let repeatCount = 0;
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
            trivia.db.all(sql, (err, row) => {
                if (err) console.log(err.message);
                if (!row) return message.send(`Nobody on this server has played trivia.`);
                row.forEach(r => {
                    trivia.db.get(`SELECT user_id id, name n, score s FROM users WHERE user_id = ${r.id}`, (err, userEntry) => {
                        if (!userEntry) return;
                        table.push(userEntry);
                    });
                });
                setTimeout(() => {
                    table = table.sort((a,b) => (b.s - a.s));
                    table.forEach(e => retString += `\n${e.n}: ${e.s}`);
                    return message.channel.send(retString + '\`\`\`');
                }, 500);
            });
            return;
        } else if (args[i] == '-reset') {
            await RefreshTriviaToken();
        } else if (args[i] == '-h' || args[i] == '-help') {
            return message.channel.send('Use !help for a comprehensive list of commands.');
        } else if (args[i] == '-r' && args.length > i + 1){
            let n = Number(args[i+1]);
            if (n === NaN)
                return message.channel.send('Invalid repeat count.');
            repeatCount = Number(args[i+1]);
            repeatIdx = i+1;
        }
    }

    https.get(apicall, async (resp) => {
        let data = '';
        resp.on('data', (chunk) => {
            data += chunk;
        });
        resp.on('end', async() => {
            let question = JSON.parse(data);
            if (question.response_code == 2) message.channel.send(`Trivia API Error: ${apicall} returned invalid parameter`)
            else if (question.response_code == 4) {
                await RefreshTriviaToken(message.guild.id);
                return Trivia(message, args);
            } else if (question.response_code == 3) {
                await GenerateNewTriviaToken(message.guild.id);
                return Trivia(message, args);
            }
            question = question.results[0];
            question.question = question.question.replace(/&quot;/g, '\"').replace(/&#039;/g, '\'').replace(/&eacute;/g, 'é');
            let questionReward = TriviaDifficultyToScore(question.difficulty);
            
            let correct_answer;
            let formattedResponse = '';
            let answerEmotes;
            if (question.type == 'multiple') {
                let answerIdx = 0;
                let answers = [];
                answerEmotes = [`🇦`, `🇧`, `🇨`, `🇩`]
                answers = question.incorrect_answers.sort(() => Math.random() - 0.5);
                answerIdx = Math.floor(Math.random() * answers.length);
                answers.splice(answerIdx, 0, question.correct_answer);
                if (repeatCount >= 0) formattedResponse += `Questions remaing in repeat: ${repeatCount}`;
                formattedResponse += `\`\`\`Category: ${question.category}\nDifficulty: ${question.difficulty}\`\`\`\n**${question.question}**\n`
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
                m.awaitReactions(filter, { time: trivia.timeout }).then(collected => {
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
                    let retString = `Answer: ${correct_answer}`;
                    if (disqualified.length > 0) retString += `\nDisqualified: ${disqual_users}`;
                    if (repeatCount > 0) {
                        m.channel.send(retString + (correct_users == '' ? `\nYou all suck.` : `\nCongrats:` + correct_users));
                        args[repeatIdx] = repeatCount - 1;
                        return Trivia(message, args);
                    }
                    else
                        return m.channel.send(retString + (correct_users == '' ? `\nYou all suck.` : `\nCongrats:` + correct_users));
                });
            });
        });
    }).on("error", (err) => {
        return message.channel.send("Trivia API Error: " + err.message);
    });
}
exports.Trivia = Trivia;

async function ModTriviaScores(users, value, guild) {
    //check for user exists in guild members
    let sql = `SELECT user_id id FROM guild_members WHERE guild_id = ${guild.id}`;
    trivia.db.all(sql, (err, row) => {
        if (err) console.log(err.message);
        let newUsers = users.filter(u => !row.filter(r => u.id == r.id).length > 0);
        newUsers.forEach(u => trivia.db.run(`INSERT INTO guild_members (user_id, guild_id) VALUES (${u.id}, ${guild.id})`));
    });
    //update or insert users state
    users.forEach(u => {
        trivia.db.get(`SELECT score s FROM users WHERE user_id = ${u.id}`, (err, row) => {
            if (err) console.log(err.message);
            if (row) trivia.db.run(`UPDATE users SET name = \'${u.username}\', score = ${row.s + value} WHERE user_id = ${u.id}`);
            else trivia.db.run(`INSERT INTO users (user_id, name, score) VALUES (${u.id}, \'${u.username}\', ${value})`);
        });
    })
    trivia.db.run(`UPDATE guilds SET total_score = total_score + ${users.size * value} WHERE guild_id = ${guild.id}`);
}
exports.ModTriviaScores = ModTriviaScores;

function TriviaDifficultyToScore(difficulty) {
    if (difficulty === 'easy') return 1;
    else if (difficulty === 'medium') return 3;
    else if (difficulty === 'hard') return 5;
    else return 0;
}
exports.TriviaDifficultyToScore = TriviaDifficultyToScore;

function RefreshTriviaToken(guidId) {
    return new Promise(resolve => {
        https.get(`https://opentdb.com/api_token.php?command=reset&token=${trivia.apiTokens.get(guildId)}`, (resp) => {
            let data = '';
            resp.on('data', (chunk) => {
                data += chunk;
            });
            resp.on('end', () => {
                trivia.apiTokens.set(guildId, JSON.parse(data).token);
                console.log(`Trivia token reset: ${trivia.apiTokens.get(guildId)}`);
                resolve();
            });
        }).on("error", (err) => {
            console.log("Trivia HTTP Error: " + err.message);
            resolve();
        });
    });
}
exports.RefreshTriviaToken = RefreshTriviaToken;

function GenerateNewTriviaToken(guildId) {
    return new Promise(resolve => {
        https.get('https://opentdb.com/api_token.php?command=request', (resp) => {
            let data = '';
            resp.on('data', (chunk) => {
                data += chunk;
            });
            resp.on('end', () => {
                trivia.apiTokens.set(guildId, JSON.parse(data).token);
                console.log(`Trivia token retrieved: ${trivia.apiTokens.get(guildId)}`);
                resolve();
            });
        }).on("error", (err) => {
            console.log("Trivia HTTP Error: " + err.message);
            resolve();
        });
    });
}
exports.GenerateNewTriviaToken = GenerateNewTriviaToken;

function TriviaDBUpdateGuild(guild) {
    let sql = `SELECT name n FROM guilds WHERE guild_id = ${guild.id};`;
    trivia.db.get(sql, (err, row) => {
        if (err) return console.log(err.message);
        if (!row) return TriviaDBCreateGuild(guild);

        sql = `UPDATE guilds SET name = \'${guild.name}\' WHERE guild_id = ${guild.id};`;
        trivia.db.run(sql, (err) => {
            if (err) console.log(err.message);
        });
    });
}
exports.TriviaDBUpdateGuild = TriviaDBUpdateGuild;

function TriviaDBCreateGuild(guild) {
    let sql = `INSERT INTO guilds (guild_id, name, total_score) VALUES (${guild.id}, \'${guild.name}\', 0);`;
    trivia.db.run(sql, (err) => {
        if (err) console.log(err.message);
    });
}
exports.TriviaDBCreateGuild = TriviaDBCreateGuild;

function TriviaDBRemoveGuild(guild) {
    let sql = `DELETE FROM guilds WHERE guild_id = ${guild.id};`;
    trivia.db.run(sql, (err) => {
        if (err) console.log(err.message);
    });
}
exports.TriviaDBRemoveGuild = TriviaDBRemoveGuild;

//returns time since last global trivia call in ms
function IsActive() {
    let now = new Date();
    return (now - trivia.lastUsed) < 300000;
}

function AddHelpPages() {
    let page = {
        description: `Trivia Module.`,
        fields: [
            {name: '!trivia', value: 'Play a trivia from a random category.', inline: true},
            {name: '!trivia -c [number]', value: 'Play a trivia from the given category.', inline: true},
            {name: '!trivia -categories', value: 'List all available categories.', inline: true},
            {name: '!trivia -score', value: 'Display this servers trivia leaderboards.', inline: true},
            {name: '!trivia -r [number]', value: 'Repeats the category number times.', inline: true},
        ]
    };
    help.AddPage('trivia', page);
}