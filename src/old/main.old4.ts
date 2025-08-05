import { AtpAgent, AtUri, ComAtprotoLabelDefs } from '@atproto/api';
import { LabelerServer } from '@skyware/labeler';
import { Bot, Post } from '@skyware/bot';
import { LabelType } from './type.js';
import { labels } from './labels.js';
import chalk from 'chalk';
import 'dotenv/config';

const allLabels = Object
  .values(labels)
  .map((label) => label.values.reduce((acc, val: any) => acc.concat(val.identifier), []))
  .reduce((acc, val) => acc.concat(val), []);

console.log("All labels: " + allLabels);

const MAXLABELS = 4;

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

const bot = new Bot();
await bot.login({
  identifier: process.env.LABELER_DID!,
  password: process.env.LABELER_PASSWORD!,
});

const agent = new AtpAgent({
  service: 'https://bsky.social',
});
await agent.login({
  identifier: process.env.LABELER_DID!,
  password: process.env.LABELER_PASSWORD!,
});

const availableLabels = new Map<string, LabelType>();

server.db.prepare('SELECT * FROM labels_definitions').all()
  .forEach((row: any) => availableLabels.set(row.uri as string, row as LabelType));

bot.on('like', async ({ subject, user }) => {
  const query = server.db.prepare<string[]>('SELECT * FROM labels WHERE uri = ? ORDER BY val')
    .all(user.did) as ComAtprotoLabelDefs.Label[];

  const userLabels = query.reduce((set, label) => {
    if (!label.neg) set.add(label.val);
    else set.delete(label.val);
    return set;
  }, new Set<string>());

  const handle = chalk.underline(user.handle);

  if (!(subject instanceof Post)) {
    console.log(chalk.cyan(`[L] ${handle} liked the labeler!`));
    return;
  }

  const label = availableLabels.get(subject.uri);
  if (!label) {
    console.log(chalk.magenta(`[L] ${handle} liked a random post! (thx)`));
    return;
  }

  if (label.delete_trigger) {
    await deleteUserLabels(user.did, userLabels, handle);
    return;
  }

  if (userLabels.size === MAXLABELS) {
    const firstLabel = userLabels.values().next().value;
    await removeAndAddLabel(user.did, label, firstLabel, handle);
    return;
  }

  await labelUser(user.did, label, handle);
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
  const listUri = server.db.prepare('SELECT uri FROM lists_definitions WHERE name = ?')
    .get(listName) as { uri: string };

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

function shutdown() {
  try {
    console.log('Shutting down gracefully...');
    server.stop();
  } catch (error) {
    console.log(`Error shutting down gracefully: ${error}`);
    process.exit(1);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);