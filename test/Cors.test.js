import { assert } from 'chai';
import getPort from 'get-port';
import http from 'http';
import fs from 'fs-extra';
import Server from '../index.js';
import { untilResponse, untilParseResult } from './RequestUtils.js';

describe('CORS settings', () => {
  /** @type Server */
  let instance;
  /** @type number */
  let port;
  let simpleRamlApi;
  before(async () => {
    port = await getPort();
    simpleRamlApi = await fs.readFile('test/apis/simple.raml', 'utf8');
  });

  describe('CORS enabled with defaults', () => {
    before(async () => {
      port = await getPort();
      instance = new Server({
        cors: {
          enabled: true,
        }
      });
      instance.setupRoutes();
      await instance.startHttp(port);
      simpleRamlApi = await fs.readFile('test/apis/simple.raml', 'utf8');
    });
  
    after(async () => {
      await instance.cleanup();
      await instance.stopHttp();
    });

    it('has the CORS headers for OPTIONS request', async () => {
      const request = http.request({
        hostname: 'localhost',
        port,
        path: '/text',
        method: 'OPTIONS',
        headers: {
          'Content-Type': 'application/raml',
          'Authorization': 'Basic test',
          'x-api-vendor': 'RAML 1.0',
          'origin': 'https://www.api.com',
          'Accept-Encoding': 'gzip,deflate',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:71.0) Gecko/20100101 Firefox/71.0',
          'Accept': 'application/json,application/ld+json',
          'Connection': 'close',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'x-api-vendor, Content-Type',
        },
      });
      const result = await untilResponse(request);
      const { statusCode, headers } = result;
      assert.equal(statusCode, 204, 'has the 204 status code');
      
      assert.equal(headers['access-control-allow-origin'], 'https://www.api.com', 'has access-control-allow-origin');
      assert.equal(headers['access-control-allow-methods'], 'GET,PUT,POST,DELETE', 'has access-control-allow-methods');
      assert.equal(headers['access-control-allow-headers'], 'x-api-vendor, Content-Type', 'has access-control-allow-headers');
    });

    it('has the CORS headers for POST request', async () => {
      const request = http.request({
        hostname: 'localhost',
        port,
        path: '/text',
        method: 'POST',
        headers: {
          'Content-Type': 'application/raml',
          'Authorization': 'Basic test',
          'x-api-vendor': 'RAML 1.0',
          'origin': 'https://www.api.com',
          'Accept-Encoding': 'gzip,deflate',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:71.0) Gecko/20100101 Firefox/71.0',
          'Accept': 'application/json,application/ld+json',
          'Connection': 'close',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'x-api-vendor, Content-Type',
        },
      });
      request.write(simpleRamlApi);
      const result = await untilResponse(request);
      const { headers } = result;
      
      assert.equal(headers['access-control-allow-origin'], 'https://www.api.com', 'has access-control-allow-origin');
    });
  });

  describe('CORS enabled with passed configuration', () => {
    before(async () => {
      port = await getPort();
      instance = new Server({
        cors: {
          enabled: true,
          cors: {
            origin: 'https://my.domain.org'
          },
        }
      });
      instance.setupRoutes();
      await instance.startHttp(port);
      simpleRamlApi = await fs.readFile('test/apis/simple.raml', 'utf8');
    });
  
    after(async () => {
      await instance.cleanup();
      await instance.stopHttp();
    });

    it('has the CORS headers for OPTIONS request', async () => {
      const request = http.request({
        hostname: 'localhost',
        port,
        path: '/text',
        method: 'OPTIONS',
        headers: {
          'Content-Type': 'application/raml',
          'Authorization': 'Basic test',
          'x-api-vendor': 'RAML 1.0',
          'origin': 'https://www.api.com',
          'Accept-Encoding': 'gzip,deflate',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:71.0) Gecko/20100101 Firefox/71.0',
          'Accept': 'application/json,application/ld+json',
          'Connection': 'close',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'x-api-vendor, Content-Type',
        },
      });
      const result = await untilResponse(request);
      const { statusCode, headers } = result;
      assert.equal(statusCode, 204, 'has the 204 status code');
      
      assert.equal(headers['access-control-allow-origin'], 'https://my.domain.org', 'has access-control-allow-origin');
      assert.equal(headers['access-control-allow-methods'], 'GET,HEAD,PUT,POST,DELETE,PATCH', 'has access-control-allow-methods');
      assert.equal(headers['access-control-allow-headers'], 'x-api-vendor, Content-Type', 'has access-control-allow-headers');
    });
  });
});
