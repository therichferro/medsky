import { AtpAgent } from '@atproto/api';
import 'dotenv/config';

const agent = new AtpAgent({
  service: 'https://bsky.social',
});

const loginCredentials = {
  identifier: process.env.LABELER_DID!,
  password: process.env.LABELER_PASSWORD!,
};

await agent.login(loginCredentials);

const { data } = await agent.getAuthorFeed({
  actor: process.env.LABELER_DID!,
  limit: 100,
});

const { feed: postsArray, cursor: _nextPage } = data;

if (postsArray.length > 0) {
  postsArray.forEach((post) => agent.deletePost(post.post.uri));
}
