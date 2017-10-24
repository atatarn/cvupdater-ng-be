"use strict;"
const logger = require('@lib/logger')('TaskManager');
// const Resume = require('./natures/resume');

function TaskManager (ResumeClass) {
	this.schedule = require('node-schedule');
	logger.info('TaskManager created');
}

/*
	taskManager.createResumeJob()
	Creates update job for resume
*/
TaskManager.prototype.createResumeJob = function (resume) {
	let resumeJob = this.schedule.scheduleJob(resume.id.toString(), resume.schedule, function() {
		resume.publish();
	}.bind(null, logger));
	logger.info('resumeJob {%s} created', this.schedule.scheduledJobs[resumeJob.name].name);
}

/*
	taskManager.rescheduleResumeJob()
	Updates schedule for existing job
*/
TaskManager.prototype.rescheduleResumeJob = function(resume) {
	let resumeJob = this.schedule.scheduledJobs[resume.id.toString()];
	let result = resumeJob.reschedule(resume.schedule);
	if (!result) throw { message: 'Unable to reschedule scheduledJob' };
	return result;
}

/*
	taskManager.deleteResumeJob()
	Deletes update job for resume
*/
TaskManager.prototype.deleteResumeJob = function (resume) {
	this.schedule.scheduledJobs[resume.id.toString()].cancel();
	logger.info('resumeJob {%s} deleted', resume.id);
}


module.exports = new TaskManager();