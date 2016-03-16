/* eslint-disable max-len */

import sinon from 'sinon';
import {expect} from 'chai';
import {wink} from './sleep';
import {getToken} from './token';
import Transport from '../';

describe('Transport', function () {
  const globals = {
    refresh: () => getToken({time: Date.now()}),
  };

  before(function () {
    globals.clock = sinon.useFakeTimers(0);
  });

  after(function () {
    globals.clock.restore();
  });

  describe('constructor', function () {
    it('should initialize with 2 arguments', async function () {
      const tr = new Transport('endpoint', globals.refresh);
      expect(tr._endpoint).to.equal('endpoint');
      expect(tr._options).to.deep.equal({});
      expect(tr._refreshFn).to.equal(globals.refresh);
      expect(tr._transport).to.equal(null);

      // refresh
      await wink();
      const token = globals.refresh();
      expect(tr._transport._httpOptions.headers.Authorization).to.equal(`Bearer ${token}`);

      tr.close();
    });

    it('should initialize with 3 arguments', async function () {
      const tr = new Transport('endpoint', {foo: 'bar'}, globals.refresh);
      expect(tr._endpoint).to.equal('endpoint');
      expect(tr._options).to.deep.equal({foo: 'bar'});
      expect(tr._refreshFn).to.equal(globals.refresh);
      expect(tr._transport).to.equal(null);

      // refresh
      await wink();
      const token = globals.refresh();
      expect(tr._transport._httpOptions.headers.Authorization).to.equal(`Bearer ${token}`);

      tr.close();
    });

    it('should require the endpoint argument', function () {
      const fn = () => new Transport();
      expect(fn).to.throw('endpoint is required');
    });

    it('should require the refresh function argument', function () {
      const fn = () => new Transport('endpoint');
      expect(fn).to.throw('refresh function is required');
    });

    it('should not allow "Authorization" header', function () {
      const options = {headers: {Authorization: true}};
      const fn = () => new Transport('endpoint', options, globals.refresh);
      expect(fn).to.throw('the "Authorization" header should not exist');
    });

    it('should refresh the token 1 minute before it expires', async function () {
      const tr = new Transport('endpoint', globals.refresh);

      // refresh
      await wink();
      const token1 = globals.refresh();
      expect(tr._transport._httpOptions.headers.Authorization).to.equal(`Bearer ${token1}`);

      // advance the fake clock forward
      globals.clock.tick(1000 * 60 * 9);

      // refresh
      await wink();
      const token2 = globals.refresh();
      expect(tr._transport._httpOptions.headers.Authorization).to.equal(`Bearer ${token2}`);
    });
  });

  describe('send', function () {
    it('should send messages with transport', async function () {
      const tr = new Transport('endpoint', globals.refresh);

      // refresh
      await wink();
      tr._transport = {send: sinon.stub()};
      tr.send('{}', {}, 'op');
      expect(tr._transport.send.calledOnce).to.equal(true);
    });

    it('should not send if the transport is closed', function () {
      const tr = new Transport('endpoint', globals.refresh);
      const fn = () => tr.send('{}', {}, 'op');
      expect(fn).to.not.throw('transport is closed');

      tr.close();
      expect(fn).to.throw('transport is closed');
    });

    it('should add to waitlist if the transport is not ready', function () {
      const tr = new Transport('endpoint', Function());
      tr.send('{}', {}, 'op');
      expect(tr._waitlist.length).to.equal(1);
      tr.close();
    });
  });

  describe('close', function () {
    it('should stop the refresh loop', async function () {
      let calls = 0;
      function refresh() {
        calls++;
        return globals.refresh();
      }

      const tr = new Transport('endpoint', refresh);

      // refresh
      await wink();
      expect(calls).to.equal(1);

      for (let i = 2; i <= 5; ++i) {
        globals.clock.tick(1000 * 60 * 10);
        await wink();
        expect(calls).to.equal(i);
      }

      tr.close();
      globals.clock.tick(1000 * 60 * 10 * 10);
      await wink();
      expect(calls).to.equal(5);
    });
  });
});
