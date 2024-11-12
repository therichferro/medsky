import { AtpAgent, ComAtprotoLabelDefs } from '@atproto/api';
import { LabelerServer } from '@skyware/labeler';
import { labels } from './labels.js';
import { setLabelerLabelDefinitions } from '@skyware/labeler/scripts';
import 'dotenv/config';

const server = new LabelerServer({
  did: process.env.LABELER_DID!,
  signingKey: process.env.SIGNING_KEY!,
});

const prepareDatabase = async (server: LabelerServer) => {// 
  server.db.prepare('DROP TABLE IF EXISTS labels_definitions;').run();
  server.db.prepare(
    'CREATE TABLE IF NOT EXISTS labels_definitions (name TEXT, identifier TEXT PRIMARY KEY, description TEXT, uri TEXT, delete_trigger BOOLEAN);',
  ).run();

  const agent = new AtpAgent({
    service: 'https://bsky.social',
  });

  const loginCredentials = {
    identifier: process.env.LABELER_DID!,
    password: process.env.LABELER_PASSWORD!,
  };

  await agent.login(loginCredentials);
  
  const labelDefinitions: ComAtprotoLabelDefs.LabelValueDefinition[] = [];

  for (const [_id, { description, values }] of Object.entries(labels)) {
    console.log("category: " + description);

    let categoryPost = await agent.post({
      text: description,
      createdAt: new Date().toISOString(),
    });
    
    if (description == labels.clearAll.description) {
      server.db.prepare('INSERT INTO labels_definitions (name, identifier, description, uri, delete_trigger) VALUES (?, ?, ?, ?, ?);').run(description, 'clear', description, categoryPost.uri, 1);
      break
    }
    
    let parent = {
      uri: categoryPost.uri,
      cid: categoryPost.cid,
    };

    for (const label of values) {
      const { identifier, locales } = label;
      const { name, description } = locales[0];
      console.log(" -> label: " + name);

      let post = await agent.post({
        text: name + ' -> ' + description,
        createdAt: new Date().toISOString(),
        reply: {
          root: {
            uri: categoryPost.uri,
            cid: categoryPost.cid,
          },
          parent: parent,
        },
      });
      console.log(" -> label: " + name);
      
      server.db.prepare('INSERT INTO labels_definitions (name, identifier, description, uri, delete_trigger) VALUES (?, ?, ?, ?, ?);').run(name, identifier, description, post.uri, 0);
      
      const labelValueDefinition: ComAtprotoLabelDefs.LabelValueDefinition = {
        identifier: identifier,
        severity: 'inform',
        blurs: 'none',
        defaultSetting: 'warn',
        adultOnly: false,
        locales: locales
      };
      
      labelDefinitions.push(labelValueDefinition);
      
      parent = {
        uri: post.uri,
        cid: post.cid,
      };
    }
  }

  await setLabelerLabelDefinitions(loginCredentials, labelDefinitions);
};

await prepareDatabase(server);
