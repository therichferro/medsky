module.exports = {
	apps: [
		{
			name: 'medsky-labeler',
			script: 'src/main.ts',
			interpreter: 'tsx'
		},
		{
			name: 'medsky-metrics',
			script: 'src/metrics.ts',
			interpreter: 'tsx'
		},
	],
};
