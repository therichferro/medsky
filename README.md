HEAD
## Configuration

Run `npx @skyware/labeler setup` to convert an existing account into a labeler.

Create a `.env` file:

```Dotenv
LABELER_DID=did:plc:xxx
LABELER_PASSWORD=xxx
SIGNING_KEY=xxx
```

The server has to be reachable outside your local network using the URL you provided during the account setup (typically, using a reverse proxy such as [Caddy](https://caddyserver.com/)):

```Caddyfile
labeler.example.com {
	reverse_proxy 127.0.0.1:4001
}
```

