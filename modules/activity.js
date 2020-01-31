let activityChecks = [];

function AddActivityCheck(moduleName, f) {
    activityChecks.push({name: moduleName, func: f});
}
exports.AddActivityCheck = AddActivityCheck;

//returns activity information
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