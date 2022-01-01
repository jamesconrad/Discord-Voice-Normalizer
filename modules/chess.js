const Discord = require('discord.js');
const help = require('./help');
const validator = require('validator');
const activity = require('./activity');
const database = require('./database');
const command = require('./command');

let activeGames = new Map();
//♔♕♖♗♘♙
//♚♛♜♝♞♟
class ChessGame {
    constructor(player1, player2) {
        this.players = [player1, player2];
        //build the piece table
        this.pieces = [];
        //for each file fill in those pieces
        for (var i = 1; i <= 8; i++) {
            this.pieces.push({t: 'pawn', pos: [i,2], unicode: "♙"});
            this.pieces.push({t: 'pawn', pos: [i,7], unicode: "♟"});
            if (i == 1 || i == 8) {
                this.pieces.push({t: 'rook', pos: [i,1], unicode: "♖"});
                this.pieces.push({t: 'rook', pos: [i,8], unicode: "♜"});
            }
            else if (i == 2 || i == 7) {
                this.pieces.push({t: 'knight', pos: [i,1], unicode: "♘"});
                this.pieces.push({t: 'knight', pos: [i,8], unicode: "♞"});
            }
            else if (i == 3 || i == 6) {
                this.pieces.push({t: 'bishop', pos: [i,1], unicode: "♗"});
                this.pieces.push({t: 'bishop', pos: [i,8], unicode: "♝"});
            }
            else if (i == 4) {
                this.pieces.push({t: 'queen', pos: [i,1], unicode: "♕"});
                this.pieces.push({t: 'king', pos: [i,8], unicode: "♛"});
            }
            else if (i == 5) {
                this.pieces.push({t: 'king', pos: [i,1], unicode: "♔"});
                this.pieces.push({t: 'queen', pos: [i,8], unicode: "♚"});
            }
        }
    }


    get formattedBoard() {
        let formattedStrings = [];
        for (var file = 8; file >= 1; file--) {
            let rankString = "";
            for (var rank = 1; rank <= 8; rank++) {
                let piece = this.getLocation(rank, file);
                if (piece === undefined) {
                    if (rank % 2 == 1) {
                        //rankString += file % 2 == 1 ? ":black_large_square:" : ":white_large_square:";
                        rankString += file % 2 == 1 ? "■" : "□";
                    }
                    else {
                        //rankString += file % 2 == 0 ? ":black_large_square:" : ":white_large_square:";
                        rankString += file % 2 == 0 ? "■" : "□";
                    }
                }
                else {
                    rankString += piece.unicode;
                }
            }
            formattedStrings.push(rankString);
        }
        return formattedStrings;
    }
    validatePlayer() {}
    validateMove() {}
    makeMove() {}
    getLocation(rank, file) {return this.pieces.find((p) => {return (p.pos[0] == rank && p.pos[1] == file)})}


}

async function Initialize() {
    //register commands
    let c = [
        { command: 'chess', callback: StartChess },
        { command: 'move', callback: MoveCommand },
        { command: 'test', callback: Test }
    ];
    command.RegisterModule("chess", c, true, 5);
    
    //AddHelpPages();
    activity.AddActivityCheck('chess', IsActive)
    
    console.log('Chess Initialized.');
}
exports.Initialize = Initialize;

function IsActive() {
    return activeGames >= 1
}
exports.IsActive = IsActive;

function StartChess(message, args) {
    let newGame = new ChessGame("me", "also me");
    activeGames.set(["me", "also me"], newGame);

    let board = newGame.formattedBoard;
    let returnString = "Board:\n\`\`\`";
    for (i = 0; i < 8; i++)
        returnString += board[i] + "\n";
    message.channel.send(returnString + "\`\`\`");
}
exports.StartChess = StartChess;

function MoveCommand(message, args) {
    
}
exports.MoveCommand = MoveCommand;

function Test(message, args) {

}
exports.Test = Test;