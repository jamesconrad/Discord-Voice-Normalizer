# Discord-Voice-Normalizer
Discord bot to normalize peoples voice in a channel.

## Adding the bot to your server:
https://discordapp.com/oauth2/authorize?client_id=644968401969741838&scope=bot&permissions=3148800

## Features:
Voice normalizer<br/>
Server based prefix and enabled features<br/>
Trivia<br/>
Simple Emoji creation via FrankerFaceZ<br/>
And more features as requested/inspired<br/>

## Commands:
To view all commands use !help, and navigate the pages by clicking the added reactions.<br/>
!help: displays all commands.<br/>

## Using voice normalization:
Have the bot join the voice channel you are in using !joinvoice, once inside it will begin listening and calculating each persons average sound levels. Once each person has talked at least once, !normalize will have the bot respond with the volume settings for each user to make them normalized. Please note due to user volume being client sided, the bot cannot change these for you.

## Notes:
Due to issues with the discord api, a bot cannot receive voice packets until it has sent voice packets. On top of this any bot that has not sent voice within 5 minutes will stop receiving voice. This is why the bot appears to constantly talk, it is simply sending silence. If you are concerned about this, the bot can be server muted by any user with sufficent permissions and will continue to run properly.

The bot only stores audio as a user is speaking, after the average volume of any given chunk has been calculated it deletes the data.

The bot will leave a channel only when asked using !leavevoice, or when it is the last user in the voice channel.

## Hosting your own version:
Make sure to rename sample_config.json to config.json and edit token to be your bot's token.
To enable auto-updates to the script, change auto_update in config.json to true, and run the script via bot.sh
