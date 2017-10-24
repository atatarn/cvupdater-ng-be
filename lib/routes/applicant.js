"use strict";
const router = require('express').Router();
const Applicant = require('@natures/applicant');
const logger = require('@lib/logger')('router-applicant');

/*
	**************************************************************
	Public requests. Don't require client to have applicantId yet.
	**************************************************************
*/

/*
	Redirect Method
	Used to provide API client with HH authorization URLs and not pass app's clientId to API client.
	Client should proof he's legitimate to use this by setting &state equal to sessionHeaderName value
*/
router.get('/authRedirect', (req, res, next) => {
	if (req.query.state !== res.locals.sessionId) throw { code: 403, name: "UntrustedState", message: "Given state could not be trusted" };

	let targetUrl = `https://hh.ru/oauth/authorize?response_type=code&client_id=${req.app.get('config').hh.clientId}&state=${req.query.state}&redirect_uri=${req.app.get('config').hh.redirectUri}`;
	if (req.query.force) targetUrl += '&force_login=true';
	res.json({targetUrl: targetUrl});

});

/*
	POST /applicant
	Will take {code} and try to exchange it for access/refresh tokens on HH.
	Then will try to get userInfo (/me) from HH and store applicant's {id} and tokens in DB
*/
router.post('/applicant', (req, res, next) => {
	if (!req.body.code) throw { code: 400, name: "NoCodeProvided", message: "code value is required to create Applicant" };
	
	new Applicant({sessionId: res.locals.sessionId, code: req.body.code})
		.exchangeCode()
		.then(applicant => {
			logger.info('(%s) Registered Applicant: {id: (%s), sourceId: (%s)}', res.locals.sessionId, applicant.id, applicant.sourceId);
			res.status(201).json({applicantId: applicant.id})
		})
		.catch(next);
});

/*
	*******************************************************************
	Private requests. Require client to have applicantIdHeaderName set.
	*******************************************************************
*/
router.use((req, res, next) => {
	if (!req.headers[req.app.get('config').app.applicantIdHeaderName]) throw { code: 401, name: "Unauthorized", message: "Applicant Id missed" };

	new Applicant({id: req.headers[req.app.get('config').app.applicantIdHeaderName], sessionId: res.locals.sessionId})
		.getInstance()
		.then(applicant => {
			res.locals.applicant = applicant;
			next();
		})
		.catch(next);
});

/*
	GET /applicant
	Will request HH for first/last names, then return names to client
*/
router.get('/applicant', (req, res, next) => res.json({ applicant: res.locals.applicant.info }));

module.exports = router;