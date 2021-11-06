import { assert } from 'chai';
import getPort from 'get-port';
import http from 'http';
import fs from 'fs-extra';
import Server from '../index.js';
import { untilResponse, untilParseResult, untilParseError } from './RequestUtils.js';

describe('Parsing the zip file content', () => {
  /** @type Server */
  let instance;
  /** @type number */
  let port;
  /** @type Buffer */
  let simpleRamlApi;
  before(async () => {
    port = await getPort();
    instance = new Server();
    instance.setupRoutes();
    await instance.startHttp(port);
    simpleRamlApi = await fs.readFile('test/apis/simple-api.zip');
  });

  after(async () => {
    await instance.cleanup();
    await instance.stopHttp();
  });

  describe('creating a job', () => {
    it('returns the status location schema', async () => {
      const request = http.request({
        hostname: 'localhost',
        port,
        path: '/file',
        method: 'POST',
        headers: {
          'Content-Type': 'application/zip',
        },
      });
      request.write(simpleRamlApi);
      const result = await untilResponse(request);
      const { statusCode, headers, message } = result;
      assert.equal(statusCode, 201, 'has the 201 status code');
      assert.typeOf(headers.location, 'string', 'has the location header');
      assert.include(headers.location, '/job/', 'the location header refer to the /job endpoint');
      const body = JSON.parse(message.toString());
      assert.equal(body.status, 201, 'body.status has the 201 code');
      assert.include(body.location, '/job/', 'body.location has the /job endpoint');
      assert.typeOf(body.key, 'string', 'body.key is a string');
    });
  
    it('returns an error when no api-body', async () => {
      const request = http.request({
        hostname: 'localhost',
        port,
        path: '/file',
        method: 'POST',
        headers: {
          'Content-Type': 'application/raml',
        },
      });
      const result = await untilResponse(request);
      const { statusCode, headers, message } = result;
      assert.equal(statusCode, 400, 'has the 400 status code');
      assert.isUndefined(headers.location, 'has no location header');
      const body = JSON.parse(message.toString());
      assert.isTrue(body.error, 'body.error is set');
      assert.equal(body.code, 400, 'body.status is set');
      assert.equal(body.message, 'Request body is not set', 'body.message is set');
      assert.equal(body.detail, 'The server misbehave. That is all we know.', 'body.detail is set');
    });
  });

  describe('reading the status', () => {
    it('returns 204 when still processing', async () => {
      const createRequest = http.request({
        hostname: 'localhost',
        port,
        path: '/file',
        method: 'POST',
        headers: {
          'Content-Type': 'application/zip',
        },
      });
      createRequest.write(simpleRamlApi);
      const createResult = await untilResponse(createRequest);
      const statusRequest = http.request({
        hostname: 'localhost',
        port,
        path: createResult.headers.location,
        method: 'GET',
      });
      const statusResult = await untilResponse(statusRequest);
      const { statusCode, headers, message } = statusResult;
      assert.equal(statusCode, 204, 'has the 204 status code');
      assert.equal(headers.location, createResult.headers.location, 'has the location header');
      assert.isUndefined(message, 'has no body')
    });

    it('returns 200 when has results', async () => {
      const createRequest = http.request({
        hostname: 'localhost',
        port,
        path: '/file',
        method: 'POST',
        headers: {
          'Content-Type': 'application/zip',
        },
      });
      createRequest.write(simpleRamlApi);
      const result = await untilParseResult(createRequest, port);
      const { statusCode, headers, message } = result;
      assert.equal(statusCode, 200, 'has the 200 status code');
      assert.equal(headers['content-type'], 'application/ld+json', 'has the content-type header');
      assert.equal(headers['x-api-vendor'], 'RAML 1.0', 'has the x-api-vendor header');
      const body = JSON.parse(message.toString('utf-8'));
      assert.typeOf(body, 'object', 'has the response body');
      assert.typeOf(body['@graph'], 'array', 'has the graph response');
    });

    it('returns error when invalid body', async () => {
      const createRequest = http.request({
        hostname: 'localhost',
        port,
        path: '/file',
        method: 'POST',
        headers: {
          'Content-Type': 'application/zip',
        },
      });
      createRequest.write(Buffer.from('test'));
      const result = await untilParseError(createRequest, port);
      const { statusCode, headers, message } = result;
      assert.equal(statusCode, 500, 'has the 500 status code');
      assert.include(headers['content-type'], 'application/json', 'has the content-type header');
      const body = JSON.parse(message.toString('utf-8'));
      assert.isTrue(body.error, 'body.error is set');
      assert.equal(body.code, 500, 'body.code is set');
      assert.equal(body.message, 'The API file is not a zip file.', 'body.message is set');
      assert.equal(body.detail, 'The server misbehave. That is all we know.', 'body.detail is set');
    });
  });
});
