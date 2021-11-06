import { assert } from 'chai';
import getPort from 'get-port';
import http from 'http';
import fs from 'fs-extra';
import Server from '../index.js';
import { untilMultiChoice, untilResponse, untilParseResult } from './RequestUtils.js';

describe('Multiple entry points', () => {
  /** @type Server */
  let instance;
  /** @type number */
  let port;
  /** @type Buffer */
  let multiRamlApi;
  before(async () => {
    port = await getPort();
    instance = new Server();
    instance.setupRoutes();
    await instance.startHttp(port);
    multiRamlApi = await fs.readFile('test/apis/multiple-entrypoints.zip');
  });

  after(async () => {
    await instance.cleanup();
    await instance.stopHttp();
  });

  describe('reading the status', () => {
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
      createRequest.write(multiRamlApi);
      const result = await untilMultiChoice(createRequest, port);
      const { statusCode, headers, message } = result;
      assert.equal(statusCode, 300, 'has the status code');
      assert.include(headers['content-type'], 'application/json', 'has the content-type header');
      assert.typeOf(headers.location, 'string', 'the 300 has the location header')
      const body = JSON.parse(message.toString('utf-8'));
      assert.typeOf(body, 'object', 'has the response body');
      assert.deepEqual(body.files, ['api1.raml', 'api2.raml'], 'has the files');
    });

    it('allows to update the job with an entry point', async () => {
      const createRequest = http.request({
        hostname: 'localhost',
        port,
        path: '/file',
        method: 'POST',
        headers: {
          'Content-Type': 'application/zip',
        },
      });
      createRequest.write(multiRamlApi);
      const createResult = await untilMultiChoice(createRequest, port);
      const createBody = JSON.parse(createResult.message.toString('utf-8'));
      const updateRequest = http.request({
        hostname: 'localhost',
        port,
        path: createResult.headers.location,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/zip',
        },
      });
      updateRequest.write(JSON.stringify({ entrypoint: createBody.files[0] }));
      const updateResult = await untilResponse(updateRequest);
      const updateBody = JSON.parse(updateResult.message.toString('utf-8'));
      
      assert.equal(updateBody.status, 201, 'the updated response body.status has the 201 code');
      assert.include(updateBody.location, '/job/', 'the updated response body.location has the /job endpoint');
      assert.typeOf(updateBody.key, 'string', 'the updated response body.key is a string');
    });

    it('parses the API after setting the endpoint', async () => {
      const createRequest = http.request({
        hostname: 'localhost',
        port,
        path: '/file',
        method: 'POST',
        headers: {
          'Content-Type': 'application/zip',
        },
      });
      createRequest.write(multiRamlApi);
      const createResult = await untilMultiChoice(createRequest, port);
      const createBody = JSON.parse(createResult.message.toString('utf-8'));
      const updateRequest = http.request({
        hostname: 'localhost',
        port,
        path: createResult.headers.location,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/zip',
        },
      });
      updateRequest.write(JSON.stringify({ entrypoint: createBody.files[0] }));
      const updateResult = await untilResponse(updateRequest);
      const statusRequest = http.request({
        hostname: 'localhost',
        port,
        path: updateResult.headers.location,
        method: 'GET',
      });

      const result = await untilParseResult(statusRequest, port);
      const body = JSON.parse(result.message.toString('utf-8'));
      assert.typeOf(body, 'object', 'has the response body');
      assert.typeOf(body['@graph'], 'array', 'has the graph response');
    });
  });
});
