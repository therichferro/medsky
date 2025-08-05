// add-label.js
import { LabelerServer } from '@skyware/labeler';
// ...import and initialize as in your main code

const server = new LabelerServer({
  did: process.env.LABELER_DID,
 signingKey: process.env.SIGNING_KEY,
});

(async () => {
  await server.createLabel({
    uri: "did:plc:finexpln2wbdxbhhob3wozvo", // replace with target DID
    val: "public-health", // replace with your label
  });
  console.log('Label added!');
})();