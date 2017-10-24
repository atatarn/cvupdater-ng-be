"use strict";
const router = require('express').Router();
const logger = require('@lib/logger')('router-resume');
const Resume = require('@natures/resume');


/*
	GET /resume/sync
	Will fetch 20 resumes from HH and sync them with Mongo:
		create new as 'disabled' if not exist
		update fields from HH if exist
		delete from Mongo if blocked or !can_publish_or_update or deleted from HH and exists in Mongo
*/
router.get('/resume/sync', (req, res, next) => {
	Resume.getCollectionFromHH(res.locals.applicant.sessionId, res.locals.applicant.accessToken) // get list from HH
		.then(hhPromises => Promise.all([...hhPromises, Resume.getCollectionFromMongo(res.locals.applicant.id)])) // get all from HH + all from Mongo
		.then(basketDoc => {
			let mongoResumes = {}, hhResumes = {};
			basketDoc.pop().forEach(r => mongoResumes[r.sourceId] = r._id);
			basketDoc.filter(r => r.can_publish_or_update).forEach(r => { // from HH keep only resumes with can_publish_or_update
				hhResumes[r.id] = {
					applicant: res.locals.applicant.id,
					sourceId: r.id,
					publishUrl: r.publish_url,
					updatedAt: r.updated_at,
					nextPublishAt: r.next_publish_at,
					title: r.title,
					visibility: r.access.type
				}
			});

			// everything from HH will be saved to Mongo
			// resumes missed in HH but still present in Mongo should be deleted
			let hhSet = new Set(Object.keys(hhResumes));
			let mongoDeleteIds = Object.keys(mongoResumes).filter(rId => !hhSet.has(rId));

			return Promise.all([ // writing changes to Mongo
				...Resume.batchDelete(res.locals.applicant.sessionId, mongoResumes, mongoDeleteIds),
				...Resume.batchCreate(res.locals.applicant.sessionId, hhResumes)
			]);
		})
		.then(_ => Resume.getCollectionFromMongo(res.locals.applicant.id)) // get all from Mongo after sync
		.then(doc => { // return actual resumes to client
			res.json(doc.map(r => {
						return {
							id: r._id,
							updatedAt: r.updatedAt,
							title: r.title,
							enabled: r.enabled,
							schedule: r.schedule,
							visibility: r.visibility,
							lastState: r.lastState
						};
					})
			);
		})
		.catch(next);
});


/*
	As all routes below require :id of resume to be passed, here is a middleware which will search resume in Mongo and store in res.locals
*/
router.use('/resume/:id', (req, res, next) =>{
	new Resume(req.params.id, res.locals.applicant).fill()
		.then(r => {
			if (r.notFound) throw { code: 404, name: "ResumeNotFound", message: "Resume not found" };
			res.locals.resume = r;
			next();
		}).catch(next);
});


/*
	GET /resume/:id
	Returns resume with :id from Mongo
*/
router.get('/resume/:id', (req, res, next) => res.json(res.locals.resume));

/*
	POST /resume/:id/toggle
	Toggles resume's {enabled} flag
*/
router.post('/resume/:id/toggle', (req, res, next) => {
	res.locals.resume.toggle().then(_ => res.status(204).end()).catch(next);
});

/*
	POST /resume/:id/schedule
	Changes schedule for resume
*/
router.post('/resume/:id/schedule', (req, res, next) => {
	if (!req.body.schedule) throw { code: 401, name: "ScheduleMissed", message: "Schedule object missed" };
	res.locals.resume.updateSchedule(res.locals.applicant.sessionId, req.body.schedule)
		.then(r => res.json(r))
		.catch(next);
});


module.exports = router;