"use strict";
const hh = require('@lib/hh-client');
const logger = require('@lib/logger')('applicant');
const ApplicantModel = require('@models/applicant');

function Applicant (opts) {
	this.sessionId = opts.sessionId || '';
	this.authCode = opts.code || '';
	this.accessToken = opts.accessToken || '';
	this.refreshToken = opts.refreshToken || '';
	this.sourceId = opts.sourceId || '';
	this.id = opts.id || '';
	this.info = {};

}

/*
	applicant.getInfoFromHH()
	Takes user object from HH and tries to refresh token if expired

	Returns Promise resolving to current applicant instance
*/
Applicant.prototype.getInfoFromHH = function(){
	return hh.call('getUserInfo', this.sessionId, this.accessToken)
		.then(body => {
			if (!body) throw { code: 404, name: "ApplicantNotFound", message: "Applicant doesn't exist" };
			if (!body.is_applicant) throw { code: 406, name: "NotAnApplicant", message: "Сервис предназначен только для соискателей" };
			this.sourceId = body.id;
			this.info.firstName = body.first_name;
			this.info.lastName = body.last_name;
			return this;
		}).catch(err => {
			let response = err.response;
			if (response.statusCode === 403 && response.body.oauth_error === 'token-expired') { // ok, token expired
				logger.info('(%s) Token expired for applicant {id: %s}, trying to refresh', this.sessionId, this.id);
				return hh.refreshToken(this.sessionId, this.refreshToken)
					.then(body => {
						let authData = JSON.parse(body);
						this.accessToken = authData['access_token'];
						this.refreshToken = authData['refresh_token'];
						logger.info('(%s) Got new token for applicant {id: %s}: %s', this.sessionId, this.id, this.accessToken);
						return ApplicantModel.findByIdAndUpdate(this.id, { $set: { accessToken: this.accessToken, refreshToken: this.refreshToken }});
					})
					.then(_ => this.getInfoFromHH());
			}
			else throw { code: response.statusCode, name: "hhUnhandledException", message: response.body };
		});
}


/*
	applicant.exchangeCode()
	1. Tries to exchange authorization_code for applicant's tokens and id
	2. Stores applicant in Mongo

	Returns Promise resolving to current applicant instance
*/
Applicant.prototype.exchangeCode = function(){
	return hh.exchangeCode(this.sessionId, this.authCode)
		.then(body => {
			let authData = JSON.parse(body);
			this.accessToken = authData['access_token'];
			this.refreshToken = authData['refresh_token'];
			return this.getInfoFromHH();
		})
		.then(applicantData => ApplicantModel.createOrUpdateOne(applicantData.sessionId, {accessToken: applicantData.accessToken, refreshToken: applicantData.refreshToken, sourceId: applicantData.sourceId}))
		.then(doc => {
			this.id = doc._id;
			return this;
		});
}

/*
	applicant.getInstance()
	1. Loads Applicant records from DB
	2. Takes user object from HH

	Returns Promise resolving to applicant instance
*/
Applicant.prototype.getInstance = function(){
	return ApplicantModel.findById(this.id).then(doc =>{
		if (!doc) throw { code: 404, name: "ApplicantNotFound", message: "Applicant doesn't exist" };
		this.accessToken = doc.accessToken;
		this.refreshToken = doc.refreshToken;
		this.sourceId = doc.sourceId
		return this.getInfoFromHH();
	})
	.then(body => {
		if (body.sourceId !== this.sourceId) throw { code: 500, name: "ApplicantMismatch", message: "HH returned different id than Mongo has" };
		return this;
	})
}

module.exports = Applicant;