const Discord = require('discord.js');
let client = null;
let validTypes = ['LISTENING', 'PLAYING', 'STREAMING', 'WATCHING'];
let validStatus = ['online', 'idle', 'offline', 'dnd'];
let defaultPresence = null;
let currentlyProcessingQueue = false;
let repeatingEvents = [];

class Queue {
    constructor() { this.items = []; }
    enqueue(item) { this.items.push(item) }
    dequeue() { return this.length() == 0 ? null : this.items.shift(); }
    peek() { return this.items[0]; }
    length() { return this.items.length; }
}
let presenceQueue = new Queue();

function Initialize(_client) {
    client = _client;
}
exports.Initialize = Initialize;

function SetDefault(_type, _name, _status) {
    if (!validTypes.includes(_type)) return console.log(`ERROR: Invalid presence type: ${_type}.`);
    else if (!validStatus.includes(_status)) return console.log(`ERROR: Invalid presence status: ${_status}.`);
    defaultPresence = { activity: { name: _name, type: _type }, status: _status }
    Tick();
}
exports.SetDefault = SetDefault;

//_callbackMode determines if callback is called before or after setting the presence.
// 0 -> callback just after presence is set
// 1 -> callback when presence timer is over
// 2 -> callback both times
function QueuePresence(_type, _name, _status, _time = 0, _callback = null, _callbackMode = 1) {
    if (!validTypes.includes(_type)) return console.log(`ERROR: Invalid presence type: ${_type}.`);
    else if (!validStatus.includes(_status)) return console.log(`ERROR: Invalid presence status: ${_status}.`);
    else if (_time < 0) return console.log(`ERROR: Invalid presence queue time: ${_time} must not be negative.`);
    else if (_callbackMode < 0 || _callbackMode > 2) return console.log(`ERROR: Invalid callback mode: ${_time} is not within range of 0 - 2 (inclusive).`);
    console.log(`Queuing new presence: ${_type} ${_name}, ${_status}. For ${_time}${_callback != null ? ` with a callback on mode ${_callbackMode}.` : `.`}`);
    presenceQueue.enqueue([{ activity: { name: _name, type: _type }, status: _status }, _time, _callback, _callbackMode]);
    Tick();
}
exports.QueuePresence = QueuePresence;

function CurrentPresence() {
    return client.user.presence;
}
exports.CurrentPresence = CurrentPresence;

async function Tick() {
    if (presenceQueue.length() == 0) {
        return client.user.setPresence(defaultPresence)
            .then(() => {
                //console.log(`Presence is now: ${defaultPresence.activity.type} ${defaultPresence.activity.name}, ${defaultPresence.status}.`);
            });
    }
    else if (currentlyProcessingQueue) return;
    currentlyProcessingQueue = true;
    ProcessQueueElement();
}

//queue contains arrays of values:
// [ presenceObject, time, callback, callbackMode ]
async function ProcessQueueElement() {
    let element = presenceQueue.dequeue();
    client.user.setPresence(element[0])
        .then(() => {
            //console.log(`Presence is now: ${element[0].activity.type} ${element[0].activity.name}, ${element[0].status}. For ${element[1]}${element[2] != null ? ` with a callback on mode ${element[3]}.` : `.`}`);
            if (element[2] != null && (element[3] == 0 || element[3] == 2))
                element[2]();
        });
    setTimeout(() => {
        //check callback mode for 1 or 2, (after timer, or both)
        if (element[2] != null && (element[3] == 1 || element[3] == 2))
            element[2]();
        if (presenceQueue.length() == 0)
            client.user.setPresence(defaultPresence)
                .then(() => {
                    //console.log(`Presence is now: ${defaultPresence.activity.type} ${defaultPresence.activity.name}, ${defaultPresence.status}.`);
                    currentlyProcessingQueue = false;
                });
        else
            ProcessQueueElement();
    }, element[1]);
}

//same as queue but interval is delay between re-queueing event, and repeatCount = number of times to repeat (-1 for forever)
async function AddRepeatingPresence(_type, _name, _status, _time = 0, _callback = null, _callbackMode = 1, _interval, _repeatCount = -1, _startNow = true) {
    if (!validTypes.includes(_type)) return console.log(`ERROR: Invalid presence type: ${_type}.`);
    else if (!validStatus.includes(_status)) return console.log(`ERROR: Invalid presence status: ${_status}.`);
    else if (_time < 0) return console.log(`ERROR: Invalid presence queue time: ${_time} must not be negative.`);
    else if (_callbackMode < 0 || _callbackMode > 2) return console.log(`ERROR: Invalid callback mode: ${_time} is not within range of 0 - 2 (inclusive).`);
    let event = { enqueue: [{ activity: { name: _name, type: _type }, status: _status }, _time, _callback, _callbackMode], interval: _interval, repeatCount: _repeatCount };
    //repeatingEvents.push(event);
    if (_startNow) ProcessRepeatingPresence(event);
    else setTimeout(() => ProcessRepeatingPresence(event), event.interval);
}
exports.AddRepeatingPresence = AddRepeatingPresence;

function RepeatPresence(event) {
        if (event.repeatCount == 0)
            return false;
        event.repeatCount--;
        presenceQueue.enqueue(event.enqueue);
        Tick();
        return true;
}

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve,ms));
}

async function ProcessRepeatingPresence(event) {
    return new Promise(async resolve => {
        while(RepeatPresence(event)) {
            await timeout(event.interval);
        }
        resolve();
    })
}