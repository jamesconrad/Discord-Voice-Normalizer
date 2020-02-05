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