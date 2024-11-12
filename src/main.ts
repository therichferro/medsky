import { ComAtprotoLabelDefs } from '@atproto/api';
import { LabelerServer } from '@skyware/labeler';
import { Bot, Post } from '@skyware/bot';
import { LabelType } from './type.js';
import { labels } from './labels.js';
import chalk from 'chalk';
import express, { Request, Response } from 'express';
import Database from 'better-sqlite3';
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

const availableLabels = new Map<string, LabelType>();

server.db.prepare('SELECT * FROM labels_definitions').all().forEach((row: any) => availableLabels.set(row.uri as string, row as LabelType));

bot.on('like', async ({ subject, user }) => {
  const query = server.db.prepare<string[]>('SELECT * FROM labels WHERE uri = ? ORDER BY val').all(user.did) as ComAtprotoLabelDefs.Label[];

  const userLabels = query.reduce((set, label) => {
    if (!label.neg) set.add(label.val);
    else set.delete(label.val);
    return set;
  }, new Set<string>());

  const handle = chalk.underline(user.handle);
  if (!(subject instanceof Post)) {
    console.log(chalk.cyan("[L] " + handle + ' liked the labeler!'));
    return;
  }

  const label = availableLabels.get(subject.uri);
  if (!label) {
    console.log(chalk.magenta("[L] " + handle + ' liked a random post! (thx)'));
    return;
  }

  if (label.delete_trigger) {
    server.createLabels({ uri: user.did }, { negate: Array.from(userLabels) });
    server.db.prepare('DELETE FROM labels WHERE uri = ?').run(user.did);
    console.log(chalk.red('[D] Deleting ' + handle + ' labels: ' + Array.from(userLabels).map((label: any) => label)));
    return;
  }

  if (userLabels.size === MAXLABELS) {
    const firstLabel = userLabels.values().next().value;
    server.createLabels({ uri: user.did }, { negate: [firstLabel]});
    console.log(chalk.red('[D] Deleting ' + handle + ' label: ' + firstLabel));
    server.createLabel({ uri: user.did, val: label.identifier });
    console.log(chalk.green('[N] Labeling ' + handle + ' with ' + label.name ));
    return;
  }

  server.createLabel({ uri: user.did, val: label.identifier });
  console.log(chalk.green('[N] Labeling ' + handle + ' with ' + label.name ));
});


// Metrics

const dbPath = '/home/medsky/labels.db';

function getUniqueURICount(dbPath: string): number {
  const db = new Database(dbPath, { readonly: true });
  try {
    const row: { count: number } = db.prepare('SELECT COUNT(DISTINCT uri) AS count FROM labels').get() as { count: number };
    return row.count;
  } finally {
    db.close();
  }
}

const app = express();

app.get('/metrics', (req: Request, res: Response) => {
  try {
    const count = getUniqueURICount(dbPath);
    res.send(`Number of unique users in the Medsky database: ${count}`);
  } catch (err) {
    console.error('Error querying the Medsky database:', err);
    res.status(500).send('Error querying the Medsky database');
  }
});

app.listen(4000, () => {
  console.log('Metrics running on port 4000!');
});
