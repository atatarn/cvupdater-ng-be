"use strict";
const router = require('express').Router();
const logger = require('@lib/logger')('router-main');


/*
	Initial request validation.
	All incoming requests must have sessionId (md5 hex string (32 digits)) in sessionHeaderName.
*/
router.use((req, res, next) => {
	// test sessionHeaderName header to be md5
	if (!/[a-f0-9]{32}/i.test(req.headers[req.app.get('config').app.sessionHeaderName])) throw { code: 403, name: "UnknownSession", message: "SessionId missed" };
	// save sessionId
	res.locals.sessionId = req.headers[req.app.get('config').app.sessionHeaderName];
	// log request
	logger.info('[%s] (%s) %s %s %j', req.ip, res.locals.sessionId, req.method, req.url, req.body || {});
	
	next();
});

// applicant-related routes
router.use('/', require('./applicant'));

// // resume-related routes
router.use('/', require('./resume'));

/*
	Global exception handler for all routes
*/
router.use((err, req, res, next) => {
	// let error = err;
	let error = {
		name: err.name,
		message: err.error || err.message,
		// message: (err.error) ? JSON.parse(err.error) : err.message,
		stack: err.stack
	};
	logger.error('(%s) %s processing failed: %j', res.locals.sessionId, req.path, error);
	res.status(err.code || 500).send({'error': error });
});


module.exports = router;