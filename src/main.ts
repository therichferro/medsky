import { AtpAgent, AtUri, ComAtprotoLabelDefs } from '@atproto/api';
import { LabelerServer } from '@skyware/labeler';
import { CommitCreateEvent, Jetstream } from '@skyware/jetstream';
import { LabelType, ListType } from './type.js';
import { labels } from './labels.js';
import chalk from 'chalk';
import fs from 'node:fs';
import WebSocket from 'ws';
import 'dotenv/config';

const allLabels = Object
  .values(labels)
  .map((label) => label.values.reduce((acc, val: any) => acc.concat(val.identifier), []))
  .reduce((acc, val) => acc.concat(val), []);

console.log("All labels: " + allLabels);

const MAXLABELS = 4;
const WANTED_COLLECTION = 'app.bsky.feed.like';
const FIREHOSE_URL = 'wss://jetstream.atproto.tools/subscribe'; //'wss://jetstream.atproto.tools/subscribe'
const CURSOR_UPDATE_INTERVAL = 60000;

let cursor = 0;
let cursorUpdateInterval: NodeJS.Timeout;

function epochUsToDateTime(cursor: number): string {
  return new Date(cursor / 1000).toISOString();
}

try {
  console.log('Trying to read cursor from cursor.txt...');
  cursor = Number(fs.readFileSync('cursor.txt', 'utf8'));
  console.log(`Cursor found: ${cursor} (${epochUsToDateTime(cursor)})`);
} catch (error) {
  if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
    cursor = Math.floor(Date.now() * 1000);
    console.log(`Cursor not found in cursor.txt, setting cursor to: ${cursor} (${epochUsToDateTime(cursor)})`);
    fs.writeFileSync('cursor.txt', cursor.toString(), 'utf8');
  } else {
    console.log(error);
    process.exit(1);
  }
}

const agent = new AtpAgent({
  service: 'https://bsky.social',
});
await agent.login({
  identifier: process.env.LABELER_DID!,
  password: process.env.LABELER_PASSWORD!,
});

const jetstream = new Jetstream({
  ws: WebSocket,
  wantedCollections: [WANTED_COLLECTION],
  endpoint: FIREHOSE_URL,
  cursor: cursor,
});

const server = new LabelerServer({
  did: process.env.LABELER_DID!,
  signingKey: process.env.SIGNING_KEY!,
});

server.start(3000, (error, address) => {
  if (error) {
    console.error('Failed to start server:', error);
  } else {
    console.log(`Labeler server running on ${address}`);
  }
});

const availableLabels = new Map<string, LabelType>();
const availableLists = new Map<string, ListType>();

server.db.prepare('SELECT * FROM labels_definitions').all()
  .forEach((row: any) => availableLabels.set(row.uri as string, row as LabelType));

server.db.prepare('SELECT * FROM lists_definitions').all()
  .forEach((row: any) => availableLists.set(row.name as string, row as ListType));

jetstream.on('open', () => {
  console.log(
    `Connected to Jetstream at ${FIREHOSE_URL} with cursor ${jetstream.cursor} (${epochUsToDateTime(jetstream.cursor!)})`,
  );
  cursorUpdateInterval = setInterval(() => {
    if (jetstream.cursor) {
      //console.log(`Cursor updated to: ${jetstream.cursor} (${epochUsToDateTime(jetstream.cursor)})`);
      fs.writeFile('cursor.txt', jetstream.cursor.toString(), (err) => {
        if (err) console.log(err);
      });
    }
  }, CURSOR_UPDATE_INTERVAL);
});

jetstream.on('close', () => {
  clearInterval(cursorUpdateInterval);
  console.log('Jetstream connection closed.');
});

jetstream.on('error', (error) => {
  console.log(`Jetstream error: ${error.message}`);
});

jetstream.onCreate(WANTED_COLLECTION, (event: CommitCreateEvent<typeof WANTED_COLLECTION>) => {
  const postUri = event.commit?.record?.subject?.uri;

  if (postUri?.includes(process.env.LABELER_DID!)) {
    const query = server.db.prepare<string[]>('SELECT * FROM labels WHERE uri = ? ORDER BY val')
    .all(event.did) as ComAtprotoLabelDefs.Label[];

    const userLabels = query.reduce((set, label) => {
      if (!label.neg) set.add(label.val);
      else set.delete(label.val);
      return set;
    }, new Set<string>());

    if (postUri.split('/').pop() === 'self') {
      console.log(chalk.cyan(`[L] ${event.did} liked the labeler!`));
      return;
    }

    const label = availableLabels.get(postUri);
    if (!label) {
      console.log(chalk.magenta(`[L] ${event.did} liked a random post! (thx)`));
      return;
    }

    if (label.delete_trigger) {
      deleteUserLabels(event.did, userLabels, event.did);
      return;
    }
    
    if (userLabels.size === MAXLABELS) {
      const firstLabel = userLabels.values().next().value;
      removeAndAddLabel(event.did, label, firstLabel, event.did);
      return;
    }

    labelUser(event.did, label, event.did);
  }
});

async function labelUser(userDid: string, label: LabelType, handle: string) {
  server.createLabel({ uri: userDid, val: label.identifier });

  await addToList(label.identifier, userDid);
  await addToList('medsky', userDid);
  
  console.log(chalk.green(`[N] Labeling ${handle} with ${label.name}`));
}

async function deleteUserLabels(userDid: string, userLabels: Set<string>, handle: string) {
  server.createLabels({ uri: userDid }, { negate: Array.from(userLabels) });
  console.log(chalk.red(`[D] Deleting ${handle} labels: ${Array.from(userLabels)}`));
  
  for (const label of userLabels) {
    await removeFromList(label, userDid);
  }
  await removeFromList('medsky', userDid);

  server.db.prepare('DELETE FROM labels WHERE uri = ?').run(userDid);
}

async function removeAndAddLabel(userDid: string, label: LabelType, firstLabel: string, handle: string) {
  server.createLabels({ uri: userDid }, { negate: [firstLabel] });
  console.log(chalk.red(`[D] Deleting ${handle} label: ${firstLabel}`));
  server.db.prepare('DELETE FROM labels WHERE uri = ? AND val = ?').run(userDid, firstLabel);

  await labelUser(userDid, label, handle);
  await removeFromList(firstLabel, userDid);
}

async function addToList (listName: string, userDid: string) {
  const listUri = availableLists.get(listName);

  if(listUri?.uri) {
    const { data, success} = await agent.com.atproto.repo.createRecord({
      repo: process.env.LABELER_DID!,
      collection: 'app.bsky.graph.listitem',
      record: {
        $type: "app.bsky.graph.listitem",
        subject: userDid,
        list: listUri?.uri,
        createdAt: new Date().toISOString(),
      },
    });

    if (success) {
      server.db.prepare('INSERT INTO lists (name, uri, userUri) VALUES (?, ?, ?);')
        .run(listName, data.uri, userDid);
    }
  }
}

async function removeFromList (listName: string, userDid: string) {
  const listUri = server.db.prepare('SELECT uri FROM lists WHERE name = ? AND userUri = ?')
    .get(listName, userDid) as { uri: string };

  if (listUri?.uri) {
    const {collection, rkey} = new AtUri(listUri?.uri);
    const { success } = await agent.com.atproto.repo.deleteRecord({
      repo: process.env.LABELER_DID!,
      collection,
      rkey
    });
    
    if (success) {
      server.db.prepare('DELETE FROM lists WHERE name = ? AND userUri = ?')
        .run(listName, userDid);
    }
  }
}

jetstream.start();

function shutdown() {
  try {
    console.log('Shutting down gracefully...');
    fs.writeFileSync('cursor.txt', jetstream.cursor!.toString(), 'utf8');
    jetstream.close();
    server.stop();
  } catch (error) {
    console.log(`Error shutting down gracefully: ${error}`);
    process.exit(1);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);