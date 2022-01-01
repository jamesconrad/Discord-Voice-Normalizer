const Discord = require('discord.js');
const database = require('../modules/database');
const command = require('../modules/command');
const help = require('../modules/help');

function Initialize() {
    //register commands
    let c = [
        { command: 'setlogchannel', callback: SetLogChannel },
        { command: 'addfilter', callback: AddFilter },
        { command: 'removefilter', callback: RemoveFilter },
        { command: 'listfilter', callback: ListFilter },
        { command: 'includechannel', callback: BlacklistChannel },
        { command: 'excludechannel', callback: WhitelistChannel },
    ];
    RegisterModule("moderation", c, true, 5);

    let page = {
        description: `Module containing all chat moderation features. By default all channels not marked as NSFW are moderated.`,
        fields: [
            {name: '!setlogchannel', value: 'Sets the moderation log channel. Requires user to have administrator permission.'},
            {name: '!includechannel', value: 'Enables the channel to be moderated by the bot.'},
            {name: '!excludechannel', value: 'Disables the channel to be moderated by the bot.'},
            {name: '!addfilter', value: 'Adds the given passed arguments to the filter. If a message matches the filter it is deleted and logged in the log channel.'},
            {name: '!listfilter', value: 'Lists all active filters on this server. Requires user to have administrator permission, and be done in an excluded channel.'},
            {name: '!removefilter', value: 'Removes a filter. The passed arugment must match an existing filter exactly.'}
        ]
    };
    help.AddPage('command', page);
}
exports.Initialize = Initialize;

function CheckFilter(message) {
    let cfg = database.GetGuildConfig(message.guild.id);
    //early return if moderation is disabled
    if (!command.IsEnabled("moderation", cfg.disabled_modules)) return;

    if (match && logchannelexists) {
        message.guild.channels.cache.get(cfg.mod_log_channel).send('this guy just said a bad word wtf')
    }
}
exports.CheckFilter = CheckFilter;

function SetLogChannel(message, args) {
    const userpermissions = message.channel.permissionsFor(message.author.me);
    if (!userpermissions.has('ADMINISTRATOR')){
        return message.channel.send(`You need administrative permissions for that.`);
    }
    const botpermissions = message.channel.permissionsFor(message.author.me);
    if (!botpermissions.has('MANAGE_MESSAGES')){
        return message.channel.send(`I need permissions for Managaging Messages (deleting them)`);
    }
    let cfg = database.GetGuildConfig(message.guild.id);
    cfg.mod_log_channel = message.channel.id;

    //start blacklists with the log channel
    let blacklistIDs = '';
    let blacklistNames = '';
    //add all nsfw channels to blacklist
    for (element of message.guild.channels.cache) {
        if (!element.deleted &&  element.nsfw && element.type == 'text') {
            blacklistIDs += `${element.id} `;
            blacklistNames += `\n\t${element.name}`;
        }
    };
    cfg.mod_channel_blacklist = blacklistIDs;
    message.channel.send(`Successfully setup the moderation module. Current ignored channels are:${blacklistNames}`);
    database.UpdateGuildConfig(cfg);
}

function BlacklistChannel(message, args) {
    let cfg = database.GetGuildConfig(message.guild.id);
    cfg.mod_channel_blacklist += `${message.channel.id} `;
    database.UpdateGuildConfig(cfg);
}

function WhitelistChannel(message, args) {
    let cfg = database.GetGuildConfig(message.guild.id);
    if (message.channel.id == cfg.mod_log_channel) return message.channel.send(`The log channel cannot be blacklisted as it posts copies of filtered messages.`);
    cfg.mod_channel_blacklist = cfg.mod_channel_blacklist.replace(`${message.channel.id} `, '')
    database.UpdateGuildConfig(cfg);
}

function AddFilter(message, args) {
    const userpermissions = message.channel.permissionsFor(message.author.me);
    if (!userpermissions.has('ADMINISTRATOR')){
        return message.channel.send(`You need administrative permissions for that.`);
    }
    const botpermissions = message.channel.permissionsFor(message.author.me);
    if (!botpermissions.has('MANAGE_MESSAGES')){
        return message.channel.send(`I need permissions for Managaging Messages (deleting them)`);
    }

    let cfg = database.GetGuildConfig(message.guild.id);

}

function RemoveFilter(message, args) {
    const userpermissions = message.channel.permissionsFor(message.author.me);
    if (!userpermissions.has('ADMINISTRATOR')){
        return message.channel.send(`You need administrative permissions for that.`);
    }
    
    let cfg = database.GetGuildConfig(message.guild.id);

}

function ListFilter(message, args) {
    const userpermissions = message.channel.permissionsFor(message.author.me);
    if (!userpermissions.has('ADMINISTRATOR')){
        return message.channel.send(`You need administrative permissions for that.`);
    }
    let cfg = database.GetGuildConfig(message.guild.id);
    //make sure we are not in a moderated channel
    if (!cfg.mod_channel_blacklist.includes(message.channel.id.toString())) return;
    let filters = cfg.mod_filters.split()
    message.channel.send(`The current filters are: `)
}