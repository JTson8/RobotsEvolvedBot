const fs = require('fs');
const ip = require('ip');
const Discord = require('discord.js');
const logger = require('winston');
const https = require('https');

if (!fs.existsSync("./savedData/savedData.json")) {
    var json = {
        "channels": [],
        "oldStreams": []
    };
    fs.mkdir('./savedData', { recursive: true }, (err) => {if (err) throw err;});
    fs.writeFileSync('./savedData/savedData.json', JSON.stringify(json, null, 2));
}

const savedData = require('./savedData/savedData.json');
const config = require('./savedData/config.json');
const auth = require('./savedData/auth.json');

var accessToken = "";
var monitoringChannels = new Set(savedData.channels);
var oldStreams = new Set(savedData.oldStreams);


// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';
// Initialize Discord Bot
const bot = new Discord.Client();

bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.user.tag);
	getTwitchToken(function(newAccessToken) {
		accessToken = newAccessToken;
	});
    setInterval(function () {
        monitorStreams()
    }, 1000 * 60);
});

bot.login(auth.token);

bot.on('disconnect', function(erMsg, code) {
    console.log('----- Bot disconnected from Discord with code', code, 'for reason:', erMsg, '-----');
    bot.connect();
});

bot.on('message', msg => {
	const user = msg.author;
	const channel = msg.channel;
	const message = msg.content;
	
    // It will listen for messages that will start with `~`
    if (message.substring(0, 1) === '+') {
        var args = message.substring(1).split(' ');
        var cmd = args[0];

        args = args.splice(1);
        switch (cmd) {
            case 'start_monitor':
                startMonitoring(channel);
                break;
            case 'stop_monitor':
                stopMonitoring(channel);
                break;
            case 'ip':
                channel.send(`IP Address where RobotsEvolvedBot is running is ${ip.address()}`);
                break;
            case 'crash_bot':
                channel.send('Crashing Bot ...');
                crashingBotVariable.add(channel);
                break;
			case 'triger_monitor_check':
                monitorStreams();
                break;
        }
    }
});

function startMonitoring(channel) {
	const channelID = channel.id;
    if (!monitoringChannels.has(channelID)) {
        monitoringChannels.add(channelID);
        channel.send('Now monitoring Twitch for Channels streaming Robots Evolved.');
        updateSavedDataFile();
    } else {
        channel.send('Monitoring for Twitch has already been started.');
    }
}

function stopMonitoring(channel) {
	const channelID = channel.id;
    if (monitoringChannels.has(channelID)) {
        monitoringChannels.delete(channelID);
        channel.send('Monitoring for Twitch has stopped.');
        updateSavedDataFile();
    } else {
        channel.send('Monitoring for Twitch is already stopped.');
    }
}

function getStreams(callback) {
	logger.info(accessToken);
	logger.info(config.clientId);
	var options = {
		protocol: 'https:',
        host: 'api.twitch.tv',
        path: `/helix/streams?game_id=${config.gameId}`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
			'Client-ID': config.clientId
        }
    }
	
	var request = https.request(options, (resp) => {
		let data = "";
		resp.on('data', (chunk) => {
			data += chunk;
		});
		resp.on('end', () => {
			return callback(JSON.parse(data));
		});
	}).on("error", (err) => {
		logger.error(err);
		getTwitchToken(function(newAccessToken) {
			accessToken = newAccessToken;
			return callback(getStreams());
		});
	});
	request.end();
}

function getTwitchToken(callback) {
	var options = {
		protocol: 'https:',
        host: 'id.twitch.tv',
        path: `/oauth2/token?client_id=${config.clientId}&client_secret=${config.secretId}&grant_type=client_credentials`,
        method: 'POST'
    }
	
	var request = https.request(options, (resp) => {
		let data = "";
		resp.on('data', (chunk) => {
			data += chunk;
		});
		resp.on('end', () => {
			var jsonResult = JSON.parse(data);
			logger.info(jsonResult);
			return callback(jsonResult.access_token);
		});
	}).on("error", (err) => {
		logger.error(err);
	});
	request.end();
}

function checkStreams(callback) {
    getStreams(function (jsonResult) {
		var streams = new Set();
		logger.info(jsonResult);
		jsonResult.data.forEach(function(stream) {
			streams.add(stream);
		});
        var newStreams = compareAndGetNewElements(oldStreams, streams);
        oldStreams = streams;
        return callback(newStreams);
    });
}

function compareAndGetNewElements(oldSet, newSet) {
    var newElements = new Set();
    newSet.forEach(function (e) {
        newElements.add(e);
        oldSet.forEach(function (oldE) {
            if (oldE.user_id === e.user_id) {
                newElements.delete(e);
            }
        });
    });
    return newElements;
}

function monitorStreams() {
	checkStreams(function (newStreams) {
        newStreams.forEach(function (stream) {
            monitoringChannels.forEach(function (channelID) {
				const channel = bot.channels.cache.find(channel => channel.id === channelID)
                channel.send(embedStream(bot, stream));
            });
        });
    });
}

function updateSavedDataFile() {
    var json = {
        "channels": Array.from(monitoringChannels),
        "oldStreams": Array.from(oldStreams)
    };
    fs.writeFileSync('./savedData/savedData.json', JSON.stringify(json, null, 2));
}

function embedStream(bot, stream) {
	var imageUrl = "";
	if (stream.thumbnail_url !== undefined) {
		imageUrl = stream.thumbnail_url;
	}
	return(
		{
			embed: {
				color: 3447003,
				author: {
				  name: bot.user.username,
				  icon_url: bot.user.avatarURL
				},
				title: `${stream.user_name} is now playing Robots Evolved!`,
				description: `https://www.twitch.tv/${stream.user_name}`,
				thumbnail: {
					url: imageUrl 
				},
				fields: [],
				timestamp: new Date(),
				footer: {
				  icon_url: bot.user.avatarURL
				}
			}
		}
	)
}