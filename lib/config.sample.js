module.exports = {
	app: {
		port: 8765,
		sessionHeaderName: 'someName',
		applicantIdHeaderName: 'anotherName'
	},
	mongodb: {
		connectionString: 'mongodb://USER:PWD@HOST/NAME'
	},
	hh: {
		clientId:'',
		clientSecret:'',
		redirectUri:'',
		userAgent:''
	}
};