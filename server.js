"use strict";
require('module-alias/register');
const logger = require('@lib/logger')('main');
const config = require('@lib/config');
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const Resume = require('@natures/resume');

// set up mongoose
mongoose.connect(config.mongodb.connectionString, {
	useMongoClient: true
});
mongoose.Promise = global.Promise;
let db = mongoose.connection;
db.on('error', logger.error.bind(logger, 'MongoDB connection error:'));
db.on('connected', logger.info.bind(logger, 'MongoDB connected'));

// set up express
const app = express();
// store config into app
app.set('config', config);
// start app
let listener = app.listen(app.get('config').app.port, () => {
	logger.info('Live on %d', listener.address().port);
});
app.use(bodyParser.json());
// register routes
app.use('/api/1.0', require('./lib/routes'));
// all unknown routes
app.all(/\/.*/, (req, res) => {
	res.status(404).end();
});


// register resumeUpdateJobs for enabled resumes
Resume.createEnabled().then().catch(err => logger.error("Unable to fetch enabled resumes from Mongo: %j", {error: err.error || err.message, stack: err.stack}));
