const https = require('https');
const Discord = require('discord.js');
const help = require('../modules/help');
const validator = require('validator');
const activity = require('../modules/activity');
const database = require('../modules/database');
const command = require('../modules/command');
const fs = require('fs');

const config = require('../config.json');

//decode strings, decoder taken from: https://github.com/mdevils/node-html-entities/blob/master/lib/html4-entities.js npm package: html-entities
let HTML_ALPHA = ['apos', 'nbsp', 'iexcl', 'cent', 'pound', 'curren', 'yen', 'brvbar', 'sect', 'uml', 'copy', 'ordf', 'laquo', 'not', 'shy', 'reg', 'macr', 'deg', 'plusmn', 'sup2', 'sup3', 'acute', 'micro', 'para', 'middot', 'cedil', 'sup1', 'ordm', 'raquo', 'frac14', 'frac12', 'frac34', 'iquest', 'Agrave', 'Aacute', 'Acirc', 'Atilde', 'Auml', 'Aring', 'Aelig', 'Ccedil', 'Egrave', 'Eacute', 'Ecirc', 'Euml', 'Igrave', 'Iacute', 'Icirc', 'Iuml', 'ETH', 'Ntilde', 'Ograve', 'Oacute', 'Ocirc', 'Otilde', 'Ouml', 'times', 'Oslash', 'Ugrave', 'Uacute', 'Ucirc', 'Uuml', 'Yacute', 'THORN', 'szlig', 'agrave', 'aacute', 'acirc', 'atilde', 'auml', 'aring', 'aelig', 'ccedil', 'egrave', 'eacute', 'ecirc', 'euml', 'igrave', 'iacute', 'icirc', 'iuml', 'eth', 'ntilde', 'ograve', 'oacute', 'ocirc', 'otilde', 'ouml', 'divide', 'oslash', 'ugrave', 'uacute', 'ucirc', 'uuml', 'yacute', 'thorn', 'yuml', 'quot', 'amp', 'lt', 'gt', 'OElig', 'oelig', 'Scaron', 'scaron', 'Yuml', 'circ', 'tilde', 'ensp', 'emsp', 'thinsp', 'zwnj', 'zwj', 'lrm', 'rlm', 'ndash', 'mdash', 'lsquo', 'rsquo', 'sbquo', 'ldquo', 'rdquo', 'bdquo', 'dagger', 'Dagger', 'permil', 'lsaquo', 'rsaquo', 'euro', 'fnof', 'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho', 'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega', 'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 'rho', 'sigmaf', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega', 'thetasym', 'upsih', 'piv', 'bull', 'hellip', 'prime', 'Prime', 'oline', 'frasl', 'weierp', 'image', 'real', 'trade', 'alefsym', 'larr', 'uarr', 'rarr', 'darr', 'harr', 'crarr', 'lArr', 'uArr', 'rArr', 'dArr', 'hArr', 'forall', 'part', 'exist', 'empty', 'nabla', 'isin', 'notin', 'ni', 'prod', 'sum', 'minus', 'lowast', 'radic', 'prop', 'infin', 'ang', 'and', 'or', 'cap', 'cup', 'int', 'there4', 'sim', 'cong', 'asymp', 'ne', 'equiv', 'le', 'ge', 'sub', 'sup', 'nsub', 'sube', 'supe', 'oplus', 'otimes', 'perp', 'sdot', 'lceil', 'rceil', 'lfloor', 'rfloor', 'lang', 'rang', 'loz', 'spades', 'clubs', 'hearts', 'diams'];
let HTML_CODES = [39, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 255, 34, 38, 60, 62, 338, 339, 352, 353, 376, 710, 732, 8194, 8195, 8201, 8204, 8205, 8206, 8207, 8211, 8212, 8216, 8217, 8218, 8220, 8221, 8222, 8224, 8225, 8240, 8249, 8250, 8364, 402, 913, 914, 915, 916, 917, 918, 919, 920, 921, 922, 923, 924, 925, 926, 927, 928, 929, 931, 932, 933, 934, 935, 936, 937, 945, 946, 947, 948, 949, 950, 951, 952, 953, 954, 955, 956, 957, 958, 959, 960, 961, 962, 963, 964, 965, 966, 967, 968, 969, 977, 978, 982, 8226, 8230, 8242, 8243, 8254, 8260, 8472, 8465, 8476, 8482, 8501, 8592, 8593, 8594, 8595, 8596, 8629, 8656, 8657, 8658, 8659, 8660, 8704, 8706, 8707, 8709, 8711, 8712, 8713, 8715, 8719, 8721, 8722, 8727, 8730, 8733, 8734, 8736, 8743, 8744, 8745, 8746, 8747, 8756, 8764, 8773, 8776, 8800, 8801, 8804, 8805, 8834, 8835, 8836, 8838, 8839, 8853, 8855, 8869, 8901, 8968, 8969, 8970, 8971, 9001, 9002, 9674, 9824, 9827, 9829, 9830];
let alphaIndex = {};

let trivia = {
    apiTokens: new Map(),//session token
    categories: [],
    timeout: 0,
    //db: 0,
    lastUsed: new Date(),
    used: false
};

async function Initialize() {
    //register commands
    let c = [
        { command: 'trivia', callback: Trivia }
    ];
    command.RegisterModule("trivia", c, true, 3);
    
    AddHelpPages();
    activity.AddActivityCheck('trivia', IsActive)
    trivia.timeout = config.triviaTimeout;
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
    //build decode indexer
    let i = 0;
    let length = HTML_ALPHA.length;
    while (i < length) {
        let alpha = HTML_ALPHA[i];
        let code = HTML_CODES[i];
        alphaIndex[alpha] = String.fromCharCode(code);
        i++;
    }
    MonthlyScoreResetLoop()
    console.log('Trivia Initialized.');
}
exports.Initialize = Initialize;

async function Trivia(message, args) {
    //store current time for activity checks
    trivia.lastUsed = new Date();
    used = true;

    let repeatCount = 1;
    let category;
    let difficulty;
    //parse args
    for (i = 0; i < args.length; i++) {
        //list categories
        if (args[i] == '-categories') {
            let retString = 'Possible categories are:';
            trivia.categories.forEach(c => (retString += `\n${c.name}, ID: ${c.id}`));
            return message.channel.send(retString);
        } else if (args[i] == '-c') { //check for specified category
            if (i >= args.length - 1) return message.channel.send('You need to specifiy a category id after the -c argument, list the categories and their ids with -categories.');
            let id = Number(args[i + 1]);
            if (id === NaN) return message.channel.send(`${id} is not a number, and therefore an invalid category.`);
            let validId = false;
            for (j = 0; j < trivia.categories.length; j++) {
                if (trivia.categories[j].id == id) {
                    validId = true;
                    break;
                }
            }
            //if not valid, return an error response, if valid carry on with parsing
            if (!validId) return message.channel.send(`${id} is not a valid category id number, double check categories with -categories.`);
            category = id;
        } else if (args[i] == '-score') { //check for listing scores
            //pull trivia players from guild_members table
            let sql = `SELECT user_id id FROM guild_members WHERE guild_id = ${message.guild.id}`;
            database.all(sql, async (row) => {
                let table = [];
                //no row means user no players in the guild
                if (row.length == 0) return message.channel.send(`Nobody on this server has played trivia.`);
                //wait for each user to be fetched from users
                await Promise.all(row.map(async (r) => {
                    let entry = await database.getPromise(`SELECT user_id id, name n, score s, monthlyScore ms FROM users WHERE user_id = ${r.id}`, async (userEntry) => {
                        if (!userEntry) return;
                        return userEntry;
                    });
                    //add user to table
                    table.push(entry);
                }));
                //we have all users, time to sort then form and send a response
                let embed = new Discord.MessageEmbed()
                    .setTitle(`${message.guild.name} Trivia Scores`)
                    .setColor('#0099ff')
                //alltime score
                let sfield = {name: `All Time Top Player${table.length > 1 ? 's' : ''}:`, value: ``, inline: true};
                table = table.sort((a, b) => (b.s - a.s));
                table.forEach(e => sfield.value += `${unescape(e.n)}: ${e.s}\n`);
                embed.fields.push(sfield);
                //monthly score
                table = table.sort((a, b) => (b.ms - a.ms)).filter(a => a.ms > 0);
                let msfield = {name: `Monthly Top Player${table.length > 1 ? 's' : ''}:`, value: ``, inline: true};
                table.forEach(e => msfield.value += `${unescape(e.n)}: ${e.ms}\n`);
                if (table.length > 0) embed.fields.push(msfield);
                //send scores
                return message.channel.send(embed);
            });
            //exit function, response will come once sql queries are complete
            return;
        } else if (args[i] == '-myscore') { //check for listing scores
            let entry = await database.getPromise(`SELECT user_id id, name n, score s FROM users WHERE user_id = ${message.member.id}`, async (userEntry) => {
                if (!userEntry) return;
                return userEntry;
            });
            if (!entry)
                return message.send(`<@${message.member.id}>'s score is: ${entry.s}`)
            return message.channel.send(`<@${message.member.id}>'s score is: ${entry.s}`);
        } else if (args[i] == '-reset') { //check for token refresh
            await RefreshTriviaToken(message.guild.id);
        } else if (args[i] == '-h' || args[i] == '-help') { //depreciated, users should always use !help for any command help
            return message.channel.send('Use !help for a comprehensive list of commands.');
        } else if (args[i] == '-r' && args.length > i + 1) { //repeat mode
            //store number of repeats remaining
            let n = Number(args[i+1]);
            if (n === NaN)
                return message.channel.send('Repeat count is not a number.');
            else if (n > 50 || n < 1) 
                return message.channel.send(`Repeat count must be between 1 and 50 (inclusive).`);
            repeatCount = Number(args[i+1]);
        } else if (args[i] == '-d' && args.length > i + 1) {
            let d = args[i+1].toLowerCase();
            if (d == 'easy' || d == 'medium' || d == 'hard')
                difficulty = d;
            else
                return message.channel.send(`${d} is not a valid difficulty. Must be easy, medium, or hard.`);
        }
    }
    //fetch a trivia token if this guild dosn't have one
    if (!trivia.apiTokens.has(message.guild.id))
        await GenerateNewTriviaToken(message.guild.id);
    let token = trivia.apiTokens.get(message.guild.id);
    let apicall = `https://opentdb.com/api.php?token=${token}`;
    //add args to the apicall
    if (repeatCount > 1) apicall += `&amount=${repeatCount}`;
    else apicall += `&amount=1`;
    if (category) apicall += `&category=${category}`;
    if (difficulty) apicall += `&difficulty=${difficulty}`;

    //fetch the trivia question
    https.get(apicall, async (resp) => {
        let data = '';
        resp.on('data', (chunk) => {
            data += chunk;
        });
        resp.on('end', async() => {
            let question = JSON.parse(data);
            //handle response codes
            if (question.response_code == 2) message.channel.send(`Trivia API Error: ${apicall} returned invalid parameter`)
            else if (question.response_code == 4) {
                await RefreshTriviaToken(message.guild.id);
                return Trivia(message, args);
            } else if (question.response_code == 3) {
                await GenerateNewTriviaToken(message.guild.id);
                return Trivia(message, args);
            }
            //fetch the first (only) question
            let numQuestions = question.results.length;
            let i = 0;
            while (i < question.results.length) {
                await RunTriviaQuestion(question.results[i], message, numQuestions > 1 ? `Question ${i+1}/${numQuestions}` : ``);
                i++;
                await timeout(config.triviaRepeatDelay);
            }
        });
    }).on("error", (err) => {
        return message.channel.send("Trivia API Error: " + err.message);
    });
}
exports.Trivia = Trivia;

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve,ms))
}

async function RunTriviaQuestion(question, message, footer) {
    return new Promise(resolve => {
        let embed = new Discord.MessageEmbed()
            .setTitle(DecodeAmpersandHTML(question.question))
            .setColor('#0099ff')
            .setDescription(`Category: ${question.category}\nDifficulty: ${question.difficulty}`)
            .setFooter(footer);

        let questionReward = TriviaDifficultyToScore(question.difficulty);
        let correct_answer;
        let answerEmotes;
        if (question.type == 'multiple') {
            //form and randomize awnser array order
            let answers = [];
            answerEmotes = [`🇦`, `🇧`, `🇨`, `🇩`]
            answers = question.incorrect_answers.sort(() => Math.random() - 0.5);
            let answerIdx = Math.floor(Math.random() * answers.length);
            answers.splice(answerIdx, 0, question.correct_answer);
            correct_answer = answerEmotes[answerIdx];

            //decode html entities from answers
            let answerString = `${answerEmotes[0]} - ${DecodeAmpersandHTML(answers[0])}\n`;
            answerString += `${answerEmotes[1]} - ${DecodeAmpersandHTML(answers[1])}\n`;
            answerString += `${answerEmotes[2]} - ${DecodeAmpersandHTML(answers[2])}\n`;
            answerString += `${answerEmotes[3]} - ${DecodeAmpersandHTML(answers[3])}\n`;

            embed.fields.push({ name: `Possible Answers:`, value: answerString});
        } else { //true/false question
            answerEmotes = [`✅`, `❎`];
            correct_answer = question.correct_answer === 'True' ? '✅' : '❎';
            embed.fields.push({ name: `Possible Answers:`, value: `✅ - True\n❎ - False`});
        }

        //send the question
        let embedMessage = message.channel.send(embed)
        embedMessage.then(m => {
            //add the reacts
            answerEmotes.forEach(e => m.react(e));

            //fetch reacts after the timeout has expired
            const filter = (reaction, user) => (/*reaction.emoji.name == correct_answer && !user.bot*/true);
            m.awaitReactions(filter, { time: trivia.timeout }).then(collected => {
                let correct_users = '';
                let disqual_users = '';
                //fetch all correct users
                let finalWinners = collected.get(correct_answer).users.cache;
                //check for disqualified users (submitted more than 1 answer)
                let disqualified = [];
                for (i = 0; i < answerEmotes.length; i++) {
                    //skip checking correct answer
                    if (answerEmotes[i] == correct_answer) continue;
                    //check on each user that were and still are correct
                    finalWinners = finalWinners.filter(u => {
                        //pull the user from this incorrect answer's reacts
                        let vs = collected.get(answerEmotes[i]).users.cache.get(u.id);
                        //confirm this is still a valid user
                        let a = finalWinners.get(u.id);
                        //check if user reacted to incorrect answer && user is valid && user is not a bot
                        if (vs && a && a.bot == false)
                            //add user to disqualified array if they are not already in it
                            if (!disqualified.includes(vs.username))
                                disqualified.push(vs.username);
                        //return filter, remove this user from the finalWinners if they are disqualified
                        return !(vs && a);
                    });
                }
                //build response string
                finalWinners.forEach(user => correct_users += ` ${user.username},`);
                disqualified.forEach(u => disqual_users += ` ${u},`);
                //update scores
                ModTriviaScores(finalWinners, questionReward, message.guild);
                //bonus of +1 for being first to answer, only if more than one got it right
                if (finalWinners.length > 1)
                    ModTriviaScores(finalWinners[0], 1, message.guild);
                //remove trailing commas
                correct_users = correct_users.slice(0, -1);
                disqual_users = disqual_users.slice(0, -1);
                //add to embed for final response
                embed.fields.push({name: 'Answer', value: `${correct_answer} - ${DecodeAmpersandHTML(question.correct_answer)}`});
                embed.fields.push({name: 'Correct Players', value: `${correct_users == '' ? `Nobody` : correct_users}`});
                embed.setColor('#93c47d');
                if (disqualified.length > 0)
                    embed.fields.push({name: 'Disqualified Players', value: disqual_users});

                m.edit(embed);
                resolve();
            });
        });
    });
}

async function ModTriviaScores(users, value, guild) {
    //check for user exists in guild members
    let sql = `SELECT user_id id FROM guild_members WHERE guild_id = ${guild.id}`;
    database.all(sql, (row) => {
        let newUsers = users.filter(u => !row.filter(r => u.id == r.id).length > 0);
        newUsers.forEach(u => database.run(`INSERT INTO guild_members (user_id, guild_id) VALUES (${u.id}, ${guild.id})`));
    });
    //update or insert users state
    users.forEach(u => {
        database.get(`SELECT score s, monthlyScore ms FROM users WHERE user_id = ${u.id}`, (row) => {
            if (row) database.run(`UPDATE users SET name = \'${escape(u.username)}\', score = ${row.s + value}, monthlyScore = ${row.ms + value} WHERE user_id = ${u.id}`);
            else database.run(`INSERT INTO users (user_id, name, score, monthlyScore) VALUES (${u.id}, \'${escape(u.username)}\', ${value}, ${value})`);
        });
    })
    database.run(`UPDATE guilds SET total_score = total_score + ${users.size * value} WHERE guild_id = ${guild.id}`);
}
exports.ModTriviaScores = ModTriviaScores;

function TriviaDifficultyToScore(difficulty) {
    if (difficulty === 'easy') return 1;
    else if (difficulty === 'medium') return 2;
    else if (difficulty === 'hard') return 3;
    else return 0;
}
exports.TriviaDifficultyToScore = TriviaDifficultyToScore;

function RefreshTriviaToken(guildId) {
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

function MonthlyScoreResetLoop() {
    //check if its a new month
    let now = new Date();
    let month = now.getMonth();
    if (month != config.month) {
        console.log(`Updating trivia month to id: ${month}`);
        //save new month to config
        config.month = month;
        fs.writeFileSync('./config.json', JSON.stringify(config, null, 4));
        //set all monthly scores to 0
        database.run('UPDATE users SET monthlyScore = 0;');
    }
    //call this function again after 12hrs
    setTimeout(MonthlyScoreResetLoop, 1000 * 60 * 60 * 12);
}

//returns time since last global trivia call in ms
function IsActive() {
    let now = new Date();
    return trivia.used && ((now - trivia.lastUsed) < 300000);
}

function AddHelpPages() {
    let page = {
        description: `Module: Trivia`,
        fields: [
            {name: '!trivia', value: 'Play a trivia from a random category.', inline: true},
            {name: '!trivia -categories', value: 'List all available categories.', inline: true},
            {name: '!trivia -score', value: 'Display this servers trivia leaderboards.', inline: true},
            {name: '!trivia -myscore', value: 'Display your score.', inline: true},
            {name: '!trivia -c [number]', value: 'Play a trivia from the given category.', inline: true},
            {name: '!trivia -r [number]', value: 'Repeats the category number times.', inline: true},
            {name: '!trivia -d [easy,medium,hard]', value: 'Forces a specific question difficulty.', inline: false},
        ]
    };
    help.AddPage('trivia', page);
}

function DecodeAmpersandHTML(str) {
    if (!str || !str.length) {
        return '';
    }
    return str.replace(/&(#?[\w\d]+);?/g, function(s, entity) {
        var chr;
        if (entity.charAt(0) === "#") {
            var code = entity.charAt(1).toLowerCase() === 'x' ?
                parseInt(entity.substr(2), 16) :
                parseInt(entity.substr(1));

            if (!(isNaN(code) || code < -32768 || code > 65535)) {
                chr = String.fromCharCode(code);
            }
        } else {
            chr = alphaIndex[entity];
        }
        return chr || s;
    });
};