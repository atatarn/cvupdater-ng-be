"use strict";
const mongoose = require('mongoose');
const logger = require('@lib/logger')('mongo-resume');

const Schema = mongoose.Schema;

const ResumeSchema = Schema({
	_id: { type: Schema.Types.ObjectId, auto: true },
	applicant: { type: Schema.Types.ObjectId, ref: 'Applicant' },
	sourceId: { type: String, required: true },
	publishUrl: { type: String, required: true },
	updatedAt: { type: Date, required: true },
	nextPublishAt: { type: Date, required: true },
	title: { type: String, required: true },
	visibility: { type: Schema.Types.Mixed, required: true },
	enabled: { type: Boolean, default: false },
	schedule: { type: String, default: '* * */6 * * *'},
	lastState: { type: Schema.Types.Mixed, default: {state: 'ok', message: 'Действий еще не совершалось'}}
});

ResumeSchema.statics.createOrUpdateOne = function (sessionId, resume) {
	logger.info('(%s) Saving Resume {sourceId: %s} into Mongo', sessionId, resume.sourceId);
	return this.findOneAndUpdate({ sourceId: resume.sourceId }, resume, { upsert: true, new: true, setDefaultsOnInsert: true });
}

ResumeSchema.statics.deleteOne = function (sessionId, id) {
	logger.info('(%s) Deleting Resume {sourceId : %s} from Mongo', sessionId, id);
	return this.remove({_id: id});
}

module.exports = mongoose.model('Resume', ResumeSchema);