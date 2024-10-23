module.exports = {
	apps: [
		{
			name: 'medsky-labeler',
			script: 'src/main.ts',
			interpreter: 'tsx',
			watch: true,
			ignore_watch: ['labels.db', 'labels.db-shm', 'labels.db-wal'],
		},
	],
};
