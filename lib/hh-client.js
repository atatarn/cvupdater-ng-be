"use strict";
const logger = require('@lib/logger')('hh-client');
const rp = require('request-promise-native');
const config = require('@lib/config');

/*if (process.env.NODE_ENV !== 'production') {
	require('request-debug')(rp);
}
*/

const hh = config.hh;
hh.settings = function(name, val) {
	let known = {
		getUserInfo: { name: 'getUserInfo', uri: 'me', method: 'GET' },
		getResumes: { name: 'getResumes', uri: 'resumes/mine?page=1&per_page=20', method: 'GET' },
		getResumeById: { name: 'getResumeById', uri: `resumes/${val}`, method: 'GET' },
		publishResume: { name: 'publishResume', uri: `resumes/${val}/publish`, method: 'POST' }
	};
	return known[name];
}

hh.call = function (action, sessionId, access_token, val, failOnNot2xxResponse = true, resolveWithFullResponse = false) {
	let s = this.settings(action, val);
	let options = {
		method: s.method,
		uri: `https://api.hh.ru/${s.uri}`,
		headers: {
			'User-Agent': this.userAgent,
			'Authorization': 'Bearer '+access_token
		},
		json: true
	};
	if (!failOnNot2xxResponse) options.simple = false; // this will prevent rp()'s promise from rejecting if server returned 3xx/4xx codes
	if (resolveWithFullResponse) options.resolveWithFullResponse = true;
	return rp(options);
}

hh.exchangeCode = function(sessionId, code){
	let options = {
		method: 'POST',
		uri: 'https://hh.ru/oauth/token',
		form: {
				grant_type: 'authorization_code',
				client_id: this.clientId,
				client_secret: this.clientSecret,
				redirect_uri: this.redirectUri,
				code: code
		},
		headers: {
			'User-Agent': this.userAgent
		}
	};
	logger.info('(%s) Run exchangeCode for {%s}', sessionId, code);
	return rp(options);
}

hh.refreshToken = function(sessionId, refreshToken) {
	let options = {
		method: 'POST',
		uri: 'https://hh.ru/oauth/token',
		form: {
				grant_type: 'refresh_token',
				refresh_token: refreshToken
		},
		headers: {
			'User-Agent': this.userAgent
		}
	};
	logger.info('(%s) Run refreshToken for {%s}', sessionId, refreshToken);
	return rp(options);
}

module.exports = hh;