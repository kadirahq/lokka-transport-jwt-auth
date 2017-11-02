import jwtDecode from 'jwt-decode';
import HttpTransport from 'lokka-transport-http';

// if the token expires within the next N ms
// it will be refreshed immediately.
const MIN_REFRESH_TIMEOUT = 1000 * 60;

// if the token is not available, the job will
// wait for this number of milliseconds
const MAX_JOB_WAIT_TIME = 1000 * 10;
const ERR_JOB_TIMEOUT = new Error('job timeout');


export default class Transport {
  constructor(endpoint, arg2, arg3) {
    if (endpoint) {
      this._endpoint = endpoint;
    } else {
      throw new Error('endpoint is required');
    }

    // the options argument is optional
    if (typeof arg3 === 'function') {
      this._options = arg2;
      this._refreshFn = arg3;
    } else {
      this._options = {};
      this._refreshFn = arg2;
    }

    if (!this._refreshFn) {
      throw new Error('refresh function is required');
    }

    // the "Authorization" header will be used to store the JWT token
    // make sure the user is not using it for anything else.
    if (this._options.headers && this._options.headers.Authorization) {
      throw new Error('the "Authorization" header should not exist');
    }

    // The HTTP transport will be (re-)created with every token refresh.
    // This is done because we need to change headers with each refresh.
    this._transport = null;

    // queue requests here when this.token is null.
    // after refreshing the token, process the queue.
    this._waitlist = [];

    // true if the transport is manually closed
    // no further communication will be possible
    this._closed = false;

    // refresh immediately
    this._scheduleRefresh(0);
  }

  send(query, variables, opname) {
    if (this._closed) {
      throw new Error('transport is closed');
    }

    if (this._transport) {
      return this._transport.send(query, variables, opname);
    }

    return new Promise((resolve, reject) => {
      const job = {query, variables, opname, resolve, reject, done: false};
      this._waitlist.push(job);

      setTimeout(() => {
        if (!job.done) {
          job.done = true;
          reject(ERR_JOB_TIMEOUT);
        }
      }, MAX_JOB_WAIT_TIME);
    });
  }

  close() {
    this._transport = null;
    this._closed = true;
  }

  _processWaitlist() {
    const jobs = this._waitlist;
    this._waitlist = [];

    jobs.forEach(job => {
      const {query, variables, opname, resolve, reject, done} = job;
      if (!done) {
        job.done = true;
        this.send(query, variables, opname).then(resolve, reject);
      }
    });
  }

  async _refreshToken() {
    if (this._closed) {
      return;
    }

    try {
      const token = await this._refreshFn();
      if (!token) {
        throw new Error('invalid token');
      }

      const options = Object.assign({headers: {}}, this._options);
      options.headers.Authorization = `Bearer ${token}`;

      this._transport = new HttpTransport(this._endpoint, options);
      this._processWaitlist();

      // assuming the token has an expiration time
      // TODO handle tokens without expiration times
      const payload = jwtDecode(token);
      if (!payload || !payload.exp) {
        throw new Error('invalid token');
      }

      // schedule next token refresh
      const expires = payload.exp * 1000;
      this._scheduleRefresh(expires);
    } catch (e) {
      // console.log the error??
      this._transport = null;
      this._scheduleRefresh(0);
    }
  }

  _scheduleRefresh(expires) {
    const now = Date.now();
    const timeLeft = expires - now;

    if (timeLeft <= MIN_REFRESH_TIMEOUT) {
      this._refreshToken();
      return;
    }

    // add some slack time to avoid queuing
    const timeout = timeLeft - MIN_REFRESH_TIMEOUT;
    setTimeout(() => this._refreshToken(), timeout);
  }
}
