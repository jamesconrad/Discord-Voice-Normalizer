const https = require('https');
const help = require('../modules/help');
const validator = require('validator');
const activity = require('../modules/activity');
const database = require('../modules/database');
const command = require('../modules/command');

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
    lastUsed: new Date()
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
    console.log('Trivia Initialized.');
}
exports.Initialize = Initialize;

async function Trivia(message, args) {
    //store current time for activity checks
    trivia.lastUsed = new Date();
    //fetch a trivia token if this guild dosn't have one
    if (!trivia.apiTokens.has(message.guild.id))
        await GenerateNewTriviaToken(message.guild.id);
    let token = trivia.apiTokens.get(message.guild.id);

    let apicall = `https://opentdb.com/api.php?amount=1&token=${token}`;
    let repeatIdx = 0;
    let repeatCount = 0;
    //parse args
    for (i = 0; i < args.length; i++) {
        //list categories
        if (args[i] == '-categories') {
            let retString = 'Possible categories are:';
            trivia.categories.forEach(c => (retString += `\n${c.name}, ID: ${c.id}`));
            return message.channel.send(retString);
        } else if (args[i] == '-c') { //check for specified category
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
            //if not valid, return an error response, if valid carry on with parsing
            if (!validId) return message.channel.send(`${id} is not a valid category id number, double check categories with -categories`);
            apicall += `&category=${id}`;
        } else if (args[i] == '-score') { //check for listing scores
            let retString = `\`\`\`${message.guild.name} Trivia Scores:`;
            //pull trivia players from guild_members table
            let sql = `SELECT user_id id FROM guild_members WHERE guild_id = ${message.guild.id}`;
            database.all(sql, async (row) => {
                let table = [];
                //no row means user no players in the guild
                if (!row) return message.channel.send(`Nobody on this server has played trivia.`);
                //wait for each user to be fetched from users
                await Promise.all(row.map(async (r) => {
                    let entry = await database.getPromise(`SELECT user_id id, name n, score s FROM users WHERE user_id = ${r.id}`, async (userEntry) => {
                        if (!userEntry) return;
                        return userEntry;
                    });
                    //add user to table
                    table.push(entry);
                }));
                //we have all users, time to sort then form and send a response
                table = table.sort((a,b) => (b.s - a.s));
                table.forEach(e => retString += `\n${unescape(e.n)}: ${e.s}`);
                return message.channel.send(retString + '\`\`\`');
            });
            //exit function, response will come once sql queries are complete
            return;
        } else if (args[i] == '-reset') { //check for token refresh
            await RefreshTriviaToken(message.guild.id);
        } else if (args[i] == '-h' || args[i] == '-help') { //depreciated, users should always use !help for any command help
            return message.channel.send('Use !help for a comprehensive list of commands.');
        } else if (args[i] == '-r' && args.length > i + 1) { //repeat mode
            //store number of repeats remaining
            let n = Number(args[i+1]);
            if (n === NaN)
                return message.channel.send('Invalid repeat count.');
            repeatCount = Number(args[i+1]);
            repeatIdx = i+1;
        }
    }
    //fetch the trivia question
    https.get(apicall, async (resp) => {
        let data = '';
        resp.on('data', (chunk) => {
            data += chunk;
        });
        resp.on('end', async() => {
            //decode the html entities out
            let question = JSON.parse(DecodeAmpersandHTML(data));
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
            question = question.results[0];
            let questionReward = TriviaDifficultyToScore(question.difficulty);
            
            let correct_answer;
            let formattedResponse = '';
            let answerEmotes;
            if (question.type == 'multiple') {
                //form and randomize awnser array order
                let answerIdx = 0;
                let answers = [];
                answerEmotes = [`🇦`, `🇧`, `🇨`, `🇩`]
                answers = question.incorrect_answers.sort(() => Math.random() - 0.5);
                answerIdx = Math.floor(Math.random() * answers.length);
                answers.splice(answerIdx, 0, question.correct_answer);
                //if on repeating mode, give feedback
                if (repeatCount > 0) formattedResponse += `Questions remaing in repeat: ${repeatCount}`;
                //build the response
                formattedResponse += `\`\`\`Category: ${question.category}\nDifficulty: ${question.difficulty}\`\`\`\n**${question.question}**\n`
                for (i = 0; i < answers.length; i++)
                    formattedResponse += `\n${answerEmotes[i]} - ${answers[i]}`
                correct_answer = answerEmotes[answerIdx];
            } else {
                //form the response
                formattedResponse = `\`\`\`Category: ${question.category}\nDifficulty: ${question.difficulty}\`\`\`\n**${question.question}**\n`
                correct_answer = question.correct_answer === 'True' ? '✅' : '❎';
                answerEmotes = [`✅`, `❎`];
            }
            //send the response
            message.channel.send(formattedResponse).then(m => {
                //add the reacts
                answerEmotes.forEach(e => m.react(e));

                const filter = (reaction, user) => (/*reaction.emoji.name == correct_answer && !user.bot*/true);
                //fetch reacts after the timeout has expired
                m.awaitReactions(filter, { time: trivia.timeout }).then(collected => {
                    let correct_users = '';
                    let disqual_users = '';
                    //fetch all correct users
                    let finalWinners = collected.get(correct_answer).users;
                    //check for disqualified users (submitted more than 1 answer)
                    let disqualified = [];
                    for (i = 0; i < answerEmotes.length; i++) {
                        //skip checking correct answer
                        if (answerEmotes[i] == correct_answer) continue;
                        //check on each user that were and still are correct
                        finalWinners = finalWinners.filter(u => {
                            //pull the user from this incorrect answer's reacts
                            let vs = collected.get(answerEmotes[i]).users.get(u.id);
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
                    ModTriviaScores(finalWinners, questionReward, message.guild);
                    
                    //remove trailing commas
                    correct_users = correct_users.slice(0, -1);
                    disqual_users = disqual_users.slice(0, -1);
                    //build final response
                    let retString = `Answer: ${correct_answer}`;
                    if (disqualified.length > 0) retString += `\nDisqualified: ${disqual_users}`;
                    //send final response, if in repeat mode, also re-call this function
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
    database.all(sql, (row) => {
        let newUsers = users.filter(u => !row.filter(r => u.id == r.id).length > 0);
        newUsers.forEach(u => database.run(`INSERT INTO guild_members (user_id, guild_id) VALUES (${u.id}, ${guild.id})`));
    });
    //update or insert users state
    users.forEach(u => {
        database.get(`SELECT score s FROM users WHERE user_id = ${u.id}`, (row) => {
            if (row) database.run(`UPDATE users SET name = \'${escape(u.username)}\', score = ${row.s + value} WHERE user_id = ${u.id}`);
            else database.run(`INSERT INTO users (user_id, name, score) VALUES (${u.id}, \'${escape(u.username)}\', ${value})`);
        });
    })
    database.run(`UPDATE guilds SET total_score = total_score + ${users.size * value} WHERE guild_id = ${guild.id}`);
}
exports.ModTriviaScores = ModTriviaScores;

function TriviaDifficultyToScore(difficulty) {
    if (difficulty === 'easy') return 1;
    else if (difficulty === 'medium') return 3;
    else if (difficulty === 'hard') return 5;
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

//returns time since last global trivia call in ms
function IsActive() {
    let now = new Date();
    return (now - trivia.lastUsed) < 300000;
}

function AddHelpPages() {
    let page = {
        description: `Module: Trivia`,
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