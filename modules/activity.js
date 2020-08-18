const config = require('../config.json');
var fs = require('fs');
var csvWriter = require('csv-write-stream');
var activityLog = false;

let activityChecks = [];

//adds a function to check for activity for a module
function AddActivityCheck(moduleName, f) {
    activityChecks.push({name: moduleName, func: f});
}
exports.AddActivityCheck = AddActivityCheck;

//returns activity information
//result is wether all tests passed, modules contians individual results
//object { result: bool, modules: [{ name, result }] }
function CheckActivity() {
    let ret = {result: false, modules: []}
    activityChecks.forEach(e => {
        let active = e.func();
        ret.modules.push({name: e.name, result: active});
        if (active == true)
            ret.result = true;
    });
    return ret;
}
exports.CheckActivity = CheckActivity; 

function StartActivityLog() {
    if (config.activity_logging != true)
        return console.log(`WARN: Attempted to start activity log but config.json value prevents this.\n\tCurrent value: ${config.activity_logging}, Required value: true`);
    
    //send headers if file doesn't exist
    var sh = !fs.existsSync('activityLog.csv');
    //build and fill our headers, one for each module name
    var h = ['date','activity',];
    activityChecks.forEach(ac => h.push(ac.name));
    activityLog = csvWriter({
        separator: ',',
        newline: '\n',
        headers: h,
        sendHeaders: sh})
    activityLog.pipe(fs.createWriteStream('activityLog.csv', {flags: 'a'}));
    console.log('Acivity log started.')
    ActivityLogController();
}
exports.StartActivityLog = StartActivityLog;

function ActivityLogController() {
    LogActivity();
    //recall this function after 15 minutes
    setTimeout(ActivityLogController, 1000 * 60 * 15);
}

function LogActivity() {
    //do the actual check
    let a = CheckActivity();
    //form and fill the data array
    let date = new Date();
    data = [
        date.toLocaleString(),
        a.result,
    ];
    a.modules.forEach(e => {data.push(e.result)});
    //write to csv
    activityLog.write(data);
}

function EndActivityLogging() {
    if (activityLog != false)
        activityLog.end();
}
exports.EndActivityLogging = EndActivityLogging;