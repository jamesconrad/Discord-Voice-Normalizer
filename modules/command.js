const database = require('../modules/database');
const help = require('../modules/help');

//map containing all modules and their commands
//map(string , {name: 'string', toggle_bit: int, commands: map(string, function)} )
const moduleCommands = new Map();

function Initialize() {
    //register commands
    let c = [
        { command: 'toggle', callback: ToggleModule },
        { command: 'changeprefix', callback: ChangePrefix },
        { command: 'prefix', callback: DisplayPrefix },
        { command: 'nic', callback: NotifyInvalidCommand },
    ];
    RegisterModule("command", c, false, 0);

    let page = {
        description: `Command Handler`,
        fields: [
            {name: '!changeprefix', value: 'Change the prefix for all commands. Requires user to have administrator permission.'},
            {name: '!prefix', value: 'Display the prefix for this server.'},
            {name: '!toggle', value: 'Disable/Enable a module, module names can be found at the description of it\'s !help page. ex: !toggle trivia'},
            {name: '!nic', value: 'Disable/Enable informing users on invalid and disabled commands.'},
        ]
    };
    help.AddPage('command', page);
}
exports.Initialize = Initialize;

//handles adding all of a modules commands at once
//commandArray should be a [{ command: string, callback: function(message,args)}]
//bit is the nth bit in the primarydb disabled_modules (database.GetGuildConfig(guild_id).disabled_modules)
//1's bit must alwasy be 0, as it represents untoggleable modules, valid id's start at 1
function RegisterModule(moduleName, commandArray, toggleable, bit) {
    if (toggleable && bit <= 0) return console.log("ERROR: Toggleable modules must use a positive ID, excluding 0.")
    else if (bit == 1) return console.log("Bit value 1 is reserved for invalid command notification toggle")
    else if (!toggleable) bit = 0;

    moduleName = moduleName.toLowerCase();

    //check for bit conflicts
    moduleCommands.forEach(element => {
        if (element.toggle_bit == bit && bit != 0) console.log(`WARNING: bit conflict on bit#${bit} between ${moduleName} & ${element.name}`);
    });

    //register the module itself
    if (!moduleCommands.has(moduleName)) {
        moduleCommands.set(moduleName, {
            name: moduleName,
            toggle_bit: bit, 
            commands: new Map()
        });
    }
    //add the commands into the module
    commandArray.forEach(element => {
       RegisterCommand(moduleName, element.command, element.callback);
    });
}
exports.RegisterModule = RegisterModule;

//all command's callback must accept message, args in that order
function RegisterCommand(moduleName, command, callback) {
    let exists = false;
    moduleCommands.forEach(element => {
        if (element.commands.has(command))
            exists = true;
    });

    if (exists) {
        return console.log(`ERROR: Attempted to add command ${command} but it already exists`)
    } else {
        moduleCommands.get(moduleName).commands.set(command, callback);
    }
}

//handles dispatching all commands from every message
function ParseMessage(message) {
    //ignore invalid messages
    if (message.author.bot) return;
    if (message.channel.type ==  'dm') {
        help.OnDirectMessage(message);
        return;
    }

    let cfg = database.GetGuildConfig(message.guild.id);
    let prefix = cfg.prefix;
    
    //check if they used !help, which must always remain due to discord not allowing server specific status messages.
    if (message.content.startsWith('!') && message.content.toLowerCase() === '!help')
        return moduleCommands.get('help').commands.get('help')(message, null);
    else if (message.content.startsWith('!') && message.content.toLowerCase() === '!prefix') {
        return moduleCommands.get('command').commands.get('prefix')(message, null);
    }
    //verify the command begins with the guilds prefix
    else if (!message.content.startsWith(prefix)) return;

    //debug for tracking down a recent missing permission error that has been popping up in the logs
    console.log(`${message.guild.name}->${message.author.username}: ${message.content}`);
    
    //parse command and arguments, then handle accordingly
    const args = message.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();
    
    //currently a valid prefix, ensure it's a valid command
    let valid = false;
    let enabled = false;
    let modCommand;
    moduleCommands.forEach(mC => {
        if (mC.commands.has(command)) {
            valid = true;
            //confirm module is enabled on server
            enabled = !CheckBit(mC.toggle_bit, cfg.disabled_modules);
            modCommand = mC;
        }
    });
    
    if (valid) {
        if (enabled) {
            //call command's callback
            modCommand.commands.get(command)(message, args);
        } else {
            //module is disabled on server, notify if the notify is enabled
            if ((cfg.disabled_modules & 2) == 0)
                return message.channel.send(`This command is disabled.\nTo enable, have an administrator type: ${prefix}toggle ${modCommand.name}`);
            //silently exit if notify is disabled
        }
    } else {
        //command is not valid, notify if notify is enabled
        if ((cfg.disabled_modules & 2) == 0)
            return message.channel.send(`Invalid command, use ${prefix}help for a comprehensive list of commands. This message can be toggled off/on by an admin with ${prefix}nic`);
        //silently exit if notify is disabled
    }
    return;
}
exports.ParseMessage = ParseMessage;


//change prefix command
function ChangePrefix(message, args) {
    //verify permissions, arg count, new prefix length, and filter escape characters
    if (!message.member.hasPermission('ADMINISTRATOR')) return message.channel.send(`You need the administrator permission to use this command.`);
    if (args.length < 1) return message.channel.send('You need to specify the new prefix.');
    else if (args.length > 1) return message.channel.send('You cannot specify more than one new prefix');
    else if (args[0].length > 1) return message.channel.send('Prefix must be a single character.');
    guildConfig = database.GetGuildConfig(message.guild.id);
    guildConfig.prefix = args[0];
    database.UpdateGuildConfig(guildConfig);
    return message.channel.send(`Command prefix has been changed to: ${args[0]}`);
}

function DisplayPrefix(message, args) {
    return message.channel.send(`This server's prefix is: ${database.GetGuildConfig(message.guild.id).prefix}`);
}

//toggles the notification messages on invalid commands
function NotifyInvalidCommand(message, args) {
    if (!message.member.hasPermission('ADMINISTRATOR')) return message.channel.send(`You need the administrator permission to use this command.`);
    let cfg = database.GetGuildConfig(message.guild.id);
    //uses bit 1, which is reserved just for this command
    cfg.disabled_modules = ToggleBit(1, cfg.disabled_modules);
    let result = '';
    if (CheckBit(1, cfg.disabled_modules)) result += "Notifications on invalid commands has been turned off.";
    else result += 'Notifications on invalid commands has been turned on.';
    database.UpdateGuildConfig(cfg);
    return message.channel.send(result);
}

function ToggleModule(message, args) {
    //args are the modules to toggle
    if (!message.member.hasPermission('ADMINISTRATOR')) return message.channel.send(`You need the administrator permission to use this command.`);
    if (args.length < 1) return message.channel.send("You need to specify one or more modules to toggle.")
    let results = {
        invalid: [],
        toggled_on: [],
        toggled_off: [],
        forbidden: []
    };
    let cfg = database.GetGuildConfig(message.guild.id);
    args.forEach(moduleName => {
        moduleName = moduleName.toLowerCase();
        //verify module exists
        if (!moduleCommands.has(moduleName)) {
            results.invalid.push(moduleName);
        } else {
            //fetch the moduleCommand
            let mC = moduleCommands.get(moduleName);
            //ensure it is a toggleable module
            if (mC.toggle_bit == 0) {
                results.forbidden.push(moduleName);
            } else {
                //flip bit and add to results
                cfg.disabled_modules = ToggleBit(mC.toggle_bit, cfg.disabled_modules);
                if (CheckBit(mC.toggle_bit, cfg.disabled_modules)) results.toggled_off.push(moduleName);
                else results.toggled_on.push(moduleName);
            }
        }
    });
    //update guild config
    database.UpdateGuildConfig(cfg);
    //form response
    let response = '';
    if (results.invalid.length > 0) {
        if (results.invalid.length == 1) response += `${results.invalid[0]} is not a valid module`
        else {
            response += 'These are not valid modules: '
            results.invalid.length.forEach(m => response += `${m} `)
        }
        response += '.\n';
    }
    if (results.forbidden.length > 0) {
        if (results.forbidden.length == 1) response += `${results.forbidden[0]} cannot be disabled`
        else {
            response += 'These modules cannot be disabled: '
            results.forbidden.length.forEach(m => response += `${m} `)
        }
        response += '.\n';
    }
    if (results.toggled_off.length > 0) {
        if (results.toggled_off.length == 1) response += `${results.toggled_off[0]} has been disabled`
        else {
            response += 'These modules have been disabled: '
            results.toggled_off.length.forEach(m => response += `${m} `)
        }
        response += '.\n';
    }
    if (results.toggled_on.length > 0) {
        if (results.toggled_on.length == 1) response += `${results.toggled_on[0]} has been enabled`
        else {
            response += 'These modules have been enabled: '
            results.toggled_on.length.forEach(m => response += `${m} `)
        }
        response += '.\n';
    }
    return message.channel.send(response);
}

//checks if the bitNumber is true or false in value
function CheckBit(bitNumber, value) {
    return ((value & (1 << bitNumber)) != 0);
}

//toggles bitNumber in value
function ToggleBit(bitNumber, value) {
    return value ^= (1 << bitNumber);
}

function IsEnabled(moduleName, guild_disabled_modules) {
    let m = moduleName.toLowerCase();
    //default disable if moduleName is invalid
    if (!moduleCommands.has(m))
        return false;
    return (guild_disabled_modules & (1 << moduleCommands.get(m).toggle_bit)) == 0
}
exports.IsEnabled = IsEnabled;