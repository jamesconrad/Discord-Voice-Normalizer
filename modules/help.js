
const Discord = require('discord.js');
const command = require('../modules/command');
const database = require('../modules/database');
const activeHelps = new Map();
let pages = [];

var fs = require('fs');
var csvWriter = require('csv-write-stream');

var dmLog = csvWriter({sendHeaders: false});

const reactArray = ['◀️','▶️','⏪','⏩','❌'];

function Initialize() {
    //register commands
    let c = [
        { command: 'help', callback: Help },
        { command: 'cid', callback: ChannelID }
    ];
    command.RegisterModule("help", c, false, 0);

    //open dmg logging file
    dmLog.pipe(fs.createWriteStream('dmlog.csv', {flags: 'a'}));
    let page = {
        description: `Module: Help\nTo navigate the menu click a react emote at the bottom.`,
        fields: [
            {name: '!help', value: 'Display this menu'},
            {name: '!cid', value: 'Display current channel id'},
            {name: 'Reporting an error/issue', value: 'Simply send a dm to this bot, note the dm will be recorded.\nPlease include any additional information you can, and only send a single message per error.'},
            {name: 'Source', value: 'github.com/jamesconrad/Discord-Voice-Normalizer'}
        ]
    };
    AddPage('help', page);
}
exports.Initialize = Initialize;

//display the interactive help menu
function Help(message, args) {
    //react permissions check
    if (message.channel.type != 'dm') {
        const permissions = message.channel.permissionsFor(message.guild.me);
        if (!permissions.has('ADD_REACTIONS'))
            return message.channel.send(`I need permission to react inorder to function.`);
        else if (!permissions.has('EMBED_LINKS'))
            return message.channel.send(`I need permission to embed links, specifically this bot's github repo.`);
    }
    //fetch cfg
    let cfg;
    if (message.channel.type == 'dm')
        cfg = database.default_cfg;
    else
        cfg = database.GetGuildConfig(message.guild.id);
    
    //send the first page,
    message.channel.send(GetPage(0, cfg)).then(m => {
        //add this help menu to the tracker
        activeHelps.set(m.id, {currentPage: 0, message: m});
        reactArray.forEach(e => m.react(e).catch(() => { return }));
        //create the reaction collector
        let timeout = 600000;
        const collector = new Discord.ReactionCollector(m, (reaction, user) => !user.bot, {time: timeout, dispose: true});
        //treat both reacting and removing a reaction as an action (allows for page navigation to always be 1 page 1 click)
        collector.on('collect', (reaction, user) => { OnReact(reaction,user) });
        collector.on('remove', (reaction, user) => { OnReact(reaction,user) });
        //cleanup after timeout has expired
        setTimeout(() => {
            //if help page was deleted or removed, skip this step
            if (m.id && !activeHelps.has(m.id)) return;
            m.channel.messages.fetch(m.id)
              .then(() => {
                activeHelps.delete(m.id);
                m.delete();
              })
              .catch(() => { return });
        },timeout)
    });

}
exports.Help = Help;

//adds an embedded message page to the help menu
function AddPage(owner, page) {
    page.moduleName = owner;
    pages.push(page);
}
exports.AddPage = AddPage;

//returns the requested page by id
function GetPage(pagenum, cfg){
    //verify
    if (pagenum > pages.length - 1 || pagenum < 0)
        return 'ERROR Page out of bounds';
    //create the embed
    let page = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle('Conrad 2.0 Help Menu')
        .setFooter(`Page ${pagenum + 1} / ${pages.length}`);
    //swap to the correct prefix
    let description = pages[pagenum].description;
    description.replace(/!/g, cfg.prefix);
    if (!command.IsEnabled(pages[pagenum].moduleName, cfg.disabled_modules))
        description += `\n:: DISABLED :: ask an admin to ${cfg.prefix}toggle ${pages[pagenum].moduleName}`;
    //deep copy fields
    let fields = [];
    pages[pagenum].fields.forEach(f => fields.push(JSON.parse(JSON.stringify(f))));
    fields.forEach(field => {
        field.name = field.name.replace(/!/g, cfg.prefix);
        field.value = field.value.replace(/!/g, cfg.prefix);
    });
    //add the proper prefix pages in
    page.description = description;
    page.fields = fields;
    //return the embed page
    return page;
}

//called any time a user reacts to the help menu
function OnReact(reaction, user) {
    //skip bots just incase
    if (user.bot) return;
    //determine which help page was reacted to
    let activeHelp = activeHelps.get(reaction.message.id);
    let curPage = activeHelp.currentPage;
    let newPage = 0;
    //fetch cfg
    let cfg;
    if (reaction.message.channel.type == 'dm')  
        cfg = database.default_cfg;
    else 
        cfg = database.GetGuildConfig(reaction.message.guild.id);
    //verify reaction was a valid emoji
    switch (reaction.emoji.name) {
        case reactArray[0]: //prev page
            newPage = curPage <= 0 ? pages.length - 1 : curPage - 1;
            reaction.message.edit(GetPage(newPage, cfg));
            break;
        case reactArray[1]: //next page
            newPage = curPage >= pages.length - 1 ? 0 : curPage + 1;
            reaction.message.edit(GetPage(newPage, cfg));
            break;
        case reactArray[2]: //prev module
            //newPage = curPage >= pages.length - 1 ? 0 : curPage + 1;
            reaction.message.edit(GetPage(newPage, cfg));
            break;
        case reactArray[3]: //next module
            //newPage = curPage >= pages.length - 1 ? 0 : curPage + 1;
            reaction.message.edit(GetPage(newPage, cfg));
            break;
        case reactArray[4]: //delete
            activeHelps.delete(reaction.message.id);
            reaction.message.delete();
            break;
    }
    //update the current page number
    activeHelp.currentPage = newPage;
}

//log a message into the log file, currently only for direct messages
function OnDirectMessage(message) {
    //discard bots
    if (message.author.bot)
        return;
    else if (message.content.startsWith('!')) {
        let cmd = message.content.toLowerCase();
        if (cmd === '!help') {
            Help(message, null);
            message.channel.send(`Please note all commands must be done inside a server with me in it. It is recommended to use !help there instead.`);
        }
        else
            message.channel.send(`Commands must be done inside a server with me in it. Also note your server may have changed my prefix, use !prefix there to display my prefix`);
    }
    //form log content
    let date = new Date(message.createdTimestamp);
    console.log(`${message.author.username}: ${message.content}, ${date.toLocaleString()}`);
    dmLog.write({
        timeStamp: `${date.toLocaleString()}`,
        userName: message.author.username,
        userID: message.author.id,
        //remove any commas and new lines from the message, prevents breaking csv structure
        content: message.content.replace(/,/g, '').replace(/\n/g, '')
    });
}
exports.OnDirectMessage = OnDirectMessage;

function RemoveGuild(guild) {
    //activeHelps.has(m.id)
    let droppedIds = [];
    activeHelps.forEach((value, key) => {
        if (value.message.guild.id == guild.id) droppedIds.push(key);
    });
    if (droppedIds.length >= 1) console.warn(`Removed from guild ${guild.name} with ${droppedIds.length} active help commands.`);
    droppedIds.forEach((value) => activeHelps.delete(value));
}
exports.RemoveGuild = RemoveGuild;

function ChannelID(message, args) {
    message.channel.send(`${message.channel.name} id: ${message.channel.id}`);
}