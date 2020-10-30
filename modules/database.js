const sqlite = require('sqlite3');
const config = require('../config.json');
const validator = require('validator');

let primarydb;
const guildCache = new Map();
const default_cfg = {
    name: `default`,
    guild_id: `default`,
    total_score: 0,
    prefix: config.prefix,
    disabled_modules: 0
};
exports.default_cfg = default_cfg;

async function Initialize() {
    return new Promise(async resolve => {
        primarydb = await new sqlite.Database('./' + config.dbfile, sqlite.OPEN_READWRITE, async (err) => {
            if (err) {
                if (err.errno == 14) {
                    //db was not found, generate a new one instead.
                    console.log(`PrimaryDB not found, attempting creation of new one.`)
                    await GeneratePrimaryDatabase();
                    resolve();
                }
                //error is fatal
                else {
                    console.log(err.message);
                    process.exit(1);
                }
            }
        });
        //db loaded or created, continue with setup
        await BuildGuildCache();
        console.log('Database Initialized.')
        resolve();  
    });
}
exports.Initialize = Initialize;

//runs db.all command with given callback
function all(command, callback) {
    let ret;
    primarydb.all(command, (err, res) => {
        if (err) console.log(err);
        else ret = callback(res);
    });
    return ret;
}
exports.all = all;
async function allPromise(command, callback) {
    return new Promise(async resolve => {
        //resolve using callbacks return value
        let ret;
        await primarydb.all(command, async (err, res) => {
            if (err) console.log(err);
            else{
                ret = await callback(res);
                resolve(ret);
            }
        });
    });
}
exports.allPromise = allPromise;

//runs db.run command with given callback
function run(command) {
    primarydb.run(command);
}
exports.run = run;
async function runPromise(command) {
    return new Promise(async resolve => {
        await primarydb.run(command)
        resolve();
    });
}
exports.runPromise = runPromise

//runs db.get command with given callback;
function get(command, callback) {
    let ret;
    primarydb.get(command, (err, res) => {
        if (err) console.log(err);
        else ret = callback(res);
    });
    return ret;
}
exports.get = get;
async function getPromise(command, callback) {
    return new Promise(async resolve => {
        //resolve using callbacks return value
        let ret;
        await primarydb.get(command, async (err, res) => {
            if (err) console.log(err);
            else{
                ret = await callback(res);
                resolve(ret);
            }
        });
    });
}
exports.getPromise = getPromise

function CreateGuild(guild) {
    let sql = `INSERT INTO guilds (guild_id, name, total_score, prefix, disabled_modules) VALUES (${guild.id}, \'${escape(guild.name)}\', 0, \'${escape(config.prefix)}\', 0);`;
    let cfg = {
        name: guild.name,
        guild_id: guild.id,
        total_score: 0,
        prefix: config.prefix,
        disabled_modules: 0
    };
    guildCache.set(cfg.guild_id, cfg);
    run(sql);
}
exports.CreateGuild = CreateGuild;

function RemoveGuild(guild) {
    let sql = `DELETE FROM guilds WHERE guild_id = ${guild.id};`;
    run(sql);
}
exports.RemoveGuild = RemoveGuild;

function UpdateGuild(guild) {
    let sql = `SELECT name n FROM guilds WHERE guild_id = ${guild.id};`;
    get(sql, (row) => {
        if (!row) return CreateGuild(guild);
        
        let cfg = GetGuildConfig(guild.id);
        cfg.name = guild.name;
        UpdateGuildConfig(cfg);
    });
}
exports.UpdateGuild = UpdateGuild;

async function BuildGuildCache() {
    return new Promise(resolve => {
        all('SELECT guild_id FROM guilds', async (guilds) => {
            await Promise.all(guilds.map(async (guild) => {
                let sql = `SELECT * FROM guilds WHERE guild_id = ${guild.guild_id};`;
                let e = await getPromise(sql, async (entry) => { return entry });
                let keys = Object.keys(e);
                for (i = 0; i < keys.length; i++){
                    e[keys[i]] = unescape(e[keys[i]]);
                }
                guildCache.set(e.guild_id, e);
            }));
            resolve();
        });
    });
}
exports.BuildGuildCache = BuildGuildCache;

function GetGuildConfig(guild_id) {
    return guildCache.get(guild_id);
}
exports.GetGuildConfig = GetGuildConfig;

function UpdateGuildConfig(config) {
    guildCache.set(config.guild_id, config);
    let pairs = '';
    let keys = Object.keys(config);
    for (i = 0; i < keys.length; i++){
        pairs += keys[i] + " = '" + escape(config[keys[i]]) + (i == keys.length - 1 ? "' " : "', ");
    }
    run (`UPDATE guilds SET ${pairs} WHERE guild_id = ${config.guild_id}`);
}
exports.UpdateGuildConfig = UpdateGuildConfig;

async function GeneratePrimaryDatabase() {
    return new Promise(async resolve => {
        primarydb = await new sqlite.Database('./' + config.dbfile, sqlite.OPEN_CREATE | sqlite.OPEN_READWRITE, (err) => {
            if (err) return console.log(err.message);
        });

        let sqlcreatecommand = `CREATE TABLE guilds (
        guild_id TEXT PRIMARY KEY,
        name TEXT,
        total_score INT,
        prefix TEXT,
        disabled_modules INT
        );`;

        console.log(`Generating guilds table...`);
        await runPromise(sqlcreatecommand);

        sqlcreatecommand = `CREATE TABLE guild_members (
        guild_id TEXT,
        user_id TEXT,
        FOREIGN KEY (guild_id) REFERENCES guilds(guild_id)
        );`;

        console.log(`Generating guild_members table...`);
        await runPromise(sqlcreatecommand);

        sqlcreatecommand = `CREATE TABLE users (
        user_id TEXT PRIMARY KEY,
        name TEXT,
        score INT,
        monthlyScore INT,
        FOREIGN KEY (user_id) REFERENCES guild_members(user_id)
        );`;

        console.log(`Generating users table...`);
        await runPromise(sqlcreatecommand);

        //10s timeout to ensure db setup is complete
        console.log(`Waiting 10s to proceed...`)
        setTimeout(() => {
            console.log(`PrimaryDB generation complete.`)
            resolve()
        }, 10000);
    });
}