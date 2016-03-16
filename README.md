# lokka-transport-jwt-auth

A transport module for [Lokka](https://github.com/kadirahq/lokka) with JWT authentication. This is an extended version of [lokka-transport-http](https://github.com/kadirahq/lokka-transport-http) which uses JWT tokens. It also refreshes the token if it gets expired.

## Setup

```shell
npm i -S lokka lokka-transport-jwt-auth
```

## Usage

```js
import JWTAuthTransport from 'lokka-transport-jwt-auth';

// Write a function to create a new (JWT) token.
// It should return a token or a promise to a token.
// This function will be called again when the token
// is about to expire.
function refresh() {
  const token = 'get-jwt';
  return Promise.resolve(token);
}

// Create a new transport with an http endpoint and the refresh function
// If you need to pass additional options to the underlying HTTPTransport
// use this form: new JWTAuthTransport(endpoint, options, refresh);
const tr = new JWTAuthTransport('http://localhost:8090/path', refresh);

// You can start using the transport, requests will be processed
// as soon as the token is ready (using the refresh function).
tr.send(`{ latestPosts { title } }`).then(console.log);
```
