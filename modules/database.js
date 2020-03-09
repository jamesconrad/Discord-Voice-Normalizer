const sqlite = require('sqlite3');
const config = require('../config.json');
const validator = require('validator');

let primarydb;
let guildCache = new Map();

async function Initialize() {
    return new Promise(async resolve => {
        primarydb = await new sqlite.Database('./' + config.dbfile, sqlite.OPEN_READWRITE, async (err) => {
            if (err) console.log(err.message);
            else {
                await BuildGuildCache();
                console.log('Database Initialized.')
                resolve();                
            }
        });
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
    let sql = `INSERT INTO guilds (guild_id, name, total_score, prefix, disabled_modules) VALUES (${guild.id}, \'${guild.name}\', 0, \'!\', 0);`;
    let cfg = {
        name: guild.name,
        guild_id: guild.id,
        total_score: 0,
        prefix: '!',
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
                let sql = `SELECT guild_id, name, total_score, prefix, disabled_modules FROM guilds WHERE guild_id = ${guild.guild_id};`;
                let e = await getPromise(sql, async (entry) => { return entry });
                e.name = unescape(e.name);
                e.prefix = unescape(e.prefix);
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
    run(`UPDATE guilds SET name = \'${escape(config.name)}\', total_score = ${config.total_score}, prefix = \'${escape(config.prefix)}\', disabled_modules = ${config.disabled_modules} WHERE guild_id = ${config.guild_id}`)
}
exports.UpdateGuildConfig = UpdateGuildConfig;