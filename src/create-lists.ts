import { LabelerServer } from '@skyware/labeler';
import { AtpAgent, AtUri } from '@atproto/api';
import { labels } from './labels.js';
import 'dotenv/config';

const server = new LabelerServer({
	did: process.env.LABELER_DID!,
	signingKey: process.env.SIGNING_KEY!,
});

interface User {
	uri: string
	val?: string
}

const createLists = async (server: LabelerServer) => {
	server.db.prepare(
		'CREATE TABLE IF NOT EXISTS lists_definitions (name TEXT, uri TEXT);',
	).run();
	server.db.prepare(
		'CREATE TABLE IF NOT EXISTS lists (name TEXT, uri TEXT, userUri TEXT, UNIQUE(name, uri, userUri));',
	).run();

	const agent = new AtpAgent({
		service: 'https://bsky.social',
	});
	
	const loginCredentials = {
		identifier: process.env.LABELER_DID!,
		password: process.env.LABELER_PASSWORD!,
	};
	
	await agent.login(loginCredentials);
	
	// delete lists
	/* const { data: lists } = await agent.app.bsky.graph.getLists({
		actor: process.env.LABELER_DID!,
		limit: 1
	});
	
	for (const list of lists.lists) {
		const {collection, rkey} = new AtUri(list.uri);
		const deleteList = await agent.com.atproto.repo.deleteRecord({
			repo: process.env.LABELER_DID!,
			collection,
			rkey
		});
	
		console.log(deleteList)
	} */
	

	// Create general list
	const listExists = server.db.prepare('SELECT * FROM lists_definitions WHERE name = ?').get('medsky') as { uri: string };
	let listUri = listExists?.uri;

	while (!listUri) {
		console.log (`List doesn't exist, creating it:`, 'medsky');

		const { data: newList } = await agent.com.atproto.repo.createRecord({
			repo: process.env.LABELER_DID!,
			collection: 'app.bsky.graph.list',
			record: {
				$type: "app.bsky.graph.list",
				purpose: "app.bsky.graph.defs#curatelist",
				name: 'Medsky',
				description: `This is a curation list of all Bluesky users with any label from the Medsky Labeler. This list is free to use for feed curation. This list is automatically updated and users will be added or removed based on their use of the labeler.`,
				createdAt: new Date().toISOString(),
			},
		});

		listUri = newList.uri;
	
		if (listUri) {
			server.db.prepare('INSERT INTO lists_definitions (name, uri) VALUES (?, ?);').run('medsky', listUri);
		}
	}
	
	// Add users to list
	const uniqueUsers  = server.db.prepare('SELECT DISTINCT uri from labels;').all() as User[];
	for (const user of uniqueUsers) {
		const userListed = server.db.prepare('SELECT uri FROM lists WHERE name = ? AND userUri = ?').get('medsky', user.uri) as { uri: string };

		if (!userListed?.uri) {
			console.log ('Adding user.');

			const record = await agent.com.atproto.repo.createRecord({
				repo: process.env.LABELER_DID!,
				collection: 'app.bsky.graph.listitem',
				record: {
					$type: "app.bsky.graph.listitem",
					subject: user.uri,
					list: listUri,
					createdAt: new Date().toISOString(),
				},
			});
			server.db.prepare('INSERT INTO lists (name, uri, userUri) VALUES (?, ?, ?);').run('medsky', record.data.uri, user.uri);
			console.log(record);
		}
	}
	
	// Create lists for each label
	for (const [_id, { description, values }] of Object.entries(labels)) {
		if (description === labels?.clearAll?.description) {
			break;
		}
		
		for (const label of values) {
			const { identifier, locales } = label;
			const { name, description } = locales[0];

			const listExists = server.db.prepare('SELECT * FROM lists_definitions WHERE name = ?').get(identifier) as { uri: string };
			let listUri = listExists?.uri;

			while (!listUri) {
				console.log (`List doesn't exist, creating it:`, identifier);
				const { data, success } = await agent.com.atproto.repo.createRecord({
					repo: process.env.LABELER_DID!,
					collection: 'app.bsky.graph.list',
					record: {
						$type: "app.bsky.graph.list",
						purpose: "app.bsky.graph.defs#curatelist",
						name: name,
						description: `This is a curation list of all Bluesky users with the ${name} label from the Medsky Labeler. This list is free to use for feed curation. This list is automatically updated and users will be added or removed based on their use of the aforementioned label.`,
						createdAt: new Date().toISOString(),
					},
				});

				if (success) {
					listUri = data.uri;
					server.db.prepare('INSERT INTO lists_definitions (name, uri) VALUES (?, ?);').run(identifier, listUri);
				}
			}

			// Add users to list
			const users  = server.db.prepare('SELECT uri, val FROM labels WHERE val = ?').all(identifier) as User[];
			for (const user of users) {
				const userListed = server.db.prepare('SELECT uri FROM lists WHERE name = ? AND userUri = ?').get(identifier, user.uri) as { uri: string };

				if (!userListed?.uri) {
					console.log ('Adding user.');

					const { data, success, headers } = await agent.com.atproto.repo.createRecord({
						repo: process.env.LABELER_DID!,
						collection: 'app.bsky.graph.listitem',
						record: {
							$type: "app.bsky.graph.listitem",
							subject: user.uri,
							list: listUri,
							createdAt: new Date().toISOString(),
						},
					});

					if (success) {
						server.db.prepare('INSERT INTO lists (name, uri, userUri) VALUES (?, ?, ?);').run(identifier, data.uri, user.uri);
					}
					
					console.log({ data, headers, success });
				}
			}
		}
	}
};

await createLists(server);