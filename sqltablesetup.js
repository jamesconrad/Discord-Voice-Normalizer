
const sqlite = require('sqlite3');
let triviadb = new sqlite.Database('./db/trivia.db', sqlite.OPEN_CREATE | sqlite.OPEN_READWRITE, (err) => {
    if (err) console.log(err.message);
});


let sqlcreatecommand = `CREATE TABLE guilds (
    guild_id TEXT PRIMARY KEY,
    name TEXT,
    total_score INT
);`;

triviadb.run(sqlcreatecommand, (err) => {
    if (err) console.log(err.message);
});

sqlcreatecommand = `CREATE TABLE guild_members (
    guild_id TEXT,
    user_id TEXT,
    FOREIGN KEY (guild_id) REFERENCES guilds(guild_id)
);`;

triviadb.run(sqlcreatecommand, (err) => {
    if (err) console.log(err.message);
});

sqlcreatecommand = `CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    name TEXT,
    score INT,
    FOREIGN KEY (user_id) REFERENCES guild_members(user_id)
);`;

triviadb.run(sqlcreatecommand, (err) => {
    if (err) console.log(err.message);
});