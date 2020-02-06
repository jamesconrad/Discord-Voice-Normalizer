const database = require('../modules/database');

const commands = new Map();

//all command's callback must accept message, args in that order
function RegisterCommand(command, callback) {
    if (commands.has(command)) {
        return console.log(`ERROR: Attempted to add command ${command} but it already exists`)
    } else {
        commands.set(command, callback);
    }
}
exports.RegisterCommand = RegisterCommand;

//handles dispatching all commands from every message
function ParseMessage(message) {
    //ignore invalid messages
    if (message.author.bot) return;
    if (message.channel.type ==  'dm') {
        helpModule.OnDirectMessage(message);
        return;
    }
    //verify the command begins with the guilds prefix
    let prefix = database.GetGuildConfig(message.guild.id).prefix;
    if (!message.content.startsWith(prefix)) return;
    //check if they used !help, which must always remain due to discord not allowing server specific status messages.
    else if (message.content.startsWith('!') && message.content.toLowerCase() === 'help')
        commands.get('help')(message, args);

    //parse command and arguments, then handle accordingly
    const args = message.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();

    if (commands.has(command))
        commands.get(command)(message, args);
    else
        return message.channel.send(`Invalid command, use ${prefix}help for a comprehensive list of commands.`);
}
exports.ParseMessage = ParseMessage;