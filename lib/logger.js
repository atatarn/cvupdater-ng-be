"use strict";
const winston = require('winston');

const logFormat = winston.format.printf(info => {
	return `${info.timestamp} [${info.label}] [${info.level}] ${info.message}`;
});

module.exports = function (mName) {
	let logger = winston.createLogger({	
		format: winston.format.combine(
    		winston.format.timestamp({format: () =>  `[${new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,-1).replace('T', ' ')}]` }),
    		winston.format.splat(),
    		winston.format.label({label: mName}),
	    	logFormat
		),
		transports: [new winston.transports.File({filename: 'log/cvupdater-be.log', level: 'info'})]
	});

	if (process.env.NODE_ENV !== 'production') {
		logger.add(new winston.transports.Console({level: 'debug'}));
	}	

	return logger;
}