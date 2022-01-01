const { Readable } = require('stream');
const https = require('https');
const help = require('./help');
const activity = require('./activity');
const command = require('./command');
const config = require('../config.json');

const guildPlaylists = new Map();

//voice handles silence if music is disabled
//need to verify inputs on all functions, im lazy
/*
YTMP3?
    !search "string" -> give top 10 result links, provide easy way to play from there
    !play [link,string,videoID] -> play closest matching song
    !playlist -> shows current playlist
        -import -> creates a playlist off youtube playlists
        -clear -> clears playlist
        -repeat -> playlist repeat
        -skip
    !stop
    !loop [link,string,videoID] -> loop song endlessly
    !volume #
*/

async function Initialize() {
    //register commands
    let c = [
        { command: 'search', callback: Search }
    ];
    command.RegisterModule("music", c, true, 5);
    
    let page = {
        description: `Module: Music`,
        fields: [
            { name: '!play [name/id/link]', value: 'Play a single song now.', inline: true }
        ]
    };
    help.AddPage('music', page);

    console.log('Music Initialized.');
}
exports.Initialize = Initialize;

async function PlayCommand(message, args) {
    let title = '';
    args.forEach((a) => {title += a + ' '});
    if (title.endsWith(' '))
        title = title.substring(0, title.length - 1);
    if (validURL(title)) {
        //play url
    }
    else {
        //search
        //https://www.youtube.com/results?search_query=${title}
        //document.querySelector("#video-title")
    }
    
}
exports.PlayCommand = PlayCommand;

async function Search(message, args) {
    let title = '';
    args.forEach((a) => {title += a + ' '});
    if (title.endsWith(' '))
        title = title.substring(0, title.length - 1);

    https.get(`https://www.youtube.com/results?search_query=${title}`, (resp) => {
        let data = '';
        resp.on('data', (chunk) => {
            data += chunk;
        });
        resp.on('end', () => {
            console.log(data);
        });
    }).on("error", (err) => {
        console.log("Music HTTP Error: " + err.message);
    });

}
exports.Search = Search;

async function PlaySong() {

}

function validURL(str) {
    var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
      '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
      '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
      '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
    return !!pattern.test(str);
}