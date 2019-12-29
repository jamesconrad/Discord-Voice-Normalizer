
const Discord = require('discord.js');
const activeHelps = new Map();
let pages = [];

const reactArray = ['◀️','▶️','⏪','⏩','❌'];

function Initialize() {
    let page = {
        description: `Help Module\n\nTo navigate the menu click a react emote at the bottom.`,
        fields: [{name: '!help', value: 'Display this menu'}]
    };
    AddPage('help', page);
}
exports.Initialize = Initialize;

function Help(message) {
    message.channel.send(GetPage(0)).then(m => {
        activeHelps.set(m.id, {currentPage: 0, message: m});
        reactArray.forEach(e => m.react(e));

        let timeout = 600000;
        const collector = new Discord.ReactionCollector(m, (reaction, user) => !user.bot, {time: timeout, dispose: true});
        collector.on('collect', (reaction, user) => { OnReact(reaction,user) });
        collector.on('remove', (reaction, user) => { OnReact(reaction,user) });
        setTimeout(() => {
            activeHelps.delete(m.id);
            m.delete();
        },timeout)
    });

}
exports.Help = Help;

function AddPage(owner, page) {
    pages.push(page);
}
exports.AddPage = AddPage;

function GetPage(pagenum){
    if (pagenum > pages.length - 1 || pagenum < 0)
        return 'ERROR Page out of bounds';
    let page = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle('Conrad 2.0 Help Menu')
        .setFooter(`Page ${pagenum + 1} / ${pages.length}`);
    page.description = pages[pagenum].description;
    page.fields = pages[pagenum].fields;
    return page;
}

function OnReact(reaction, user) {
    if (user.bot) return;
    let activeHelp = activeHelps.get(reaction.message.id);
    let curPage = activeHelp.currentPage;
    let newPage = 0;
    switch (reaction.emoji.name) {
        case reactArray[0]: //prev page
            newPage = curPage <= 0 ? pages.length - 1 : curPage - 1;
            reaction.message.edit(GetPage(newPage));
            break;
        case reactArray[1]: //next page
            newPage = curPage >= pages.length - 1 ? 0 : curPage + 1;
            reaction.message.edit(GetPage(newPage));
            break;
        case reactArray[2]: //prev module
            //newPage = curPage >= pages.length - 1 ? 0 : curPage + 1;
            reaction.message.edit(GetPage(newPage));
            break;
        case reactArray[3]: //next module
            //newPage = curPage >= pages.length - 1 ? 0 : curPage + 1;
            reaction.message.edit(GetPage(newPage));
            break;
        case reactArray[4]: //delete
            reaction.message.delete();
            break;
    }
    //reaction.remove(user);
    activeHelp.currentPage = newPage;
}