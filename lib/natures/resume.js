"use strict";
const hh = require('@lib/hh-client');
const logger = require('@lib/logger')('resume');
const ResumeModel = require('@models/resume');
const taskManager = require('@lib/task-manager.js');
const util = require('util');
const Applicant = require('@natures/applicant');

function Resume (id, applicant) {
	this.id = id;
	this.applicant = applicant.id;
}

Resume.prototype.fill = function(){
	return ResumeModel.findOne({_id: this.id, applicant: this.applicant}).then(doc => {
		if (!doc) {
			this.notFound = true;
		} else {
			this.id = doc._id;
			Object.keys(doc.toObject()).forEach(k => { if (k !== '__v' && k !== '_id') this[k] = doc[k] });
		}
		return this;
	});		
}

/*
	resume.save()
	Modifying Resume instance and writes lastState

	Returns Promise resolving to Resume instance
*/
Resume.prototype.save = function (lastState, ...lastStateMsg) {
	let lsMessage = '[' + new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,-1).replace('T', ' ') + '] ' + util.format(...lastStateMsg);
	this.lastState = {
		state: lastState,
		message: lsMessage
	};
	return ResumeModel.findOneAndUpdate({_id: this.id}, this).then(_ => this);
}


/*
	resume.updateSchedule()
	Updates schedule for resume

	Returns Promise resolving to Resume instance
*/
Resume.prototype.updateSchedule = function (sessionId, newSchedule) {
	this.schedule = newSchedule;
	return this.save('ok', 'Расписание изменено на %s', this.schedule).then(_ => {
		if (this.enabled) {
			if (!taskManager.rescheduleResumeJob(this)) throw { name: "tmFailure", message: 'Unable to reschedule scheduledJob' };
		}
		logger.info('(%s) Updated schedule to (%s) for {%s}', sessionId, this.schedule, this.id);
		return this;
	});
}

/*
	resume.toggle()
	Toggles resume update job

	Returns nothing
*/
Resume.prototype.toggle = function () {
	this.enabled = !this.enabled;
	return this.save('ok', 'Включено обновление')
		.then(_ =>{
			if (this.enabled) {
				taskManager.createResumeJob(this);
			} else {
				taskManager.deleteResumeJob(this);
			}
		});
}


/*
	resume.publish()
	Publishes resume

	Returns nothing
*/
Resume.prototype.publish = function() {
	new Applicant({id: this.applicant}).getInstance()
	.then(applicant => hh.call('publishResume', 'TMJob: '+this.id, applicant.accessToken, this.sourceId, false, true)) // hh places call
	.then(response => {
		// logger.debug('%j', response);
		// logger.debug(typeof response.statusCode);
		switch (response.statusCode){
			case 204:
				this.updatedAt = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString();
				return this.save('ok', 'Резюме обновлено');
			case 429:
				return this.save('warn', 'Обновление неуспешно: слишком рано');
			case 404:
				return this.delete().then(_ => {
					taskManager.deleteResumeJob(this);
					logger.info('(%s) Resume {id: %s} was deleted from HH', this.id, this.sourceId);
				});
			case 400:
				return this.save('error', 'Проблема при обновлении: %j', response.body);
		}
	})
	.then(_ => logger.info('(TaskManager) publish job complete for %s', this.id))
	.catch(err => logger.error('resume.publish failed for %s! Error: %s, stack: %j', this.id, err.name, err.stack));

}


/*
	resume.delete()
	Deletes resume from Mongo

	Returns mongoose promise
*/
Resume.prototype.delete = function() {
	return ResumeModel.findByIdAndRemove(this.id);
}


/*
	Resume.getCollectionFromHH()
	Static method to get resumes from HH

	Returns an array of Promises to get every published resume from HH
*/
Resume.getCollectionFromHH = function(sessionId, access_token){
	return hh.call('getResumes', sessionId, access_token)
		.then(body => {
			return body.items // resumes from HH
				.filter(resume => !resume.blocked && resume.status.id === 'published') // want only published and not blocked ones
				.map(resume => hh.call('getResumeById', sessionId, access_token, resume.id)); // prepare Promise for each one
		});
}

/*
	Resume.getCollectionFromMongo()
	Static method to get resumes from HH

	Returns Resume promise resolving to array of applicant's resumes from Mongo
*/
Resume.getCollectionFromMongo = function(applicantId){
	return ResumeModel.find({applicant: applicantId});
}

/*
	Resume.createEnabled()
	Static method to create update Jobs for enabled resumes from Mongo

	Returns nothing
*/
Resume.createEnabled = function() {
	return ResumeModel.find({enabled: true}, '_id applicant')
		.then(doc =>{
			return Promise.all(doc.map(r => new Resume(r._id, {id: r.applicant}).fill()));
		})
		.then(rl => rl.forEach(r => taskManager.createResumeJob(r)));
}


/*
	Resume.batchCreate()
	Static method which takes a list of resume objs ({resumeId: {fields}}) and generates array of Mongo insert/update promises

	Returnds an array of Mongo Promises
*/
Resume.batchCreate = function (sessionId, resumeCollection) {
	return Object.keys(resumeCollection).map(rId => ResumeModel.createOrUpdateOne(sessionId, resumeCollection[rId]));
}

/*
	Resume.batchDelete()
	Static method which takes a list of resume Ids objs ({sourceId: mongoId}) and list of Ids to delete ([id, id, ...]) and generates array of Mongo delete promises

	Returnds an array of Mongo Promises
*/
Resume.batchDelete = function (sessionId, resumeIds, deletes) {
	return deletes.map(rId => ResumeModel.deleteOne(sessionId, resumeIds[rId]));
}
		
module.exports = Resume;