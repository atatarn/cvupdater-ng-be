"use strict";
const mongoose = require('mongoose');
const logger = require('@lib/logger')('mongo-applicant');

const Schema = mongoose.Schema;

const ApplicantSchema = Schema({
	_id: { type: Schema.Types.ObjectId, auto: true },
	sourceId: { type: Number, required: true },
	accessToken: { type: String, required: true },
	refreshToken: { type: String, required: true }
});

ApplicantSchema.statics.createOrUpdateOne = function (sessionId, applicant) {
	logger.info('(%s) Saving Applicant {sourceId: %s} into Mongo', sessionId, applicant.sourceId);
	return this.findOneAndUpdate({ sourceId: applicant.sourceId }, applicant, { upsert: true, new: true });
}

module.exports = mongoose.model('Applicant', ApplicantSchema);