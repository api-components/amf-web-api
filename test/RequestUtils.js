import http from 'http';

/** @typedef {import('http').ClientRequest} ClientRequest */
/** @typedef {import('http').IncomingHttpHeaders} IncomingHttpHeaders */

/** 
 * @typedef RequestResult
 * @property {number} statusCode
 * @property {IncomingHttpHeaders} headers
 * @property {Buffer=} message
 */

/**
 * Do not call `end()` on the request. This function calls it when all is ready.
 * @param {ClientRequest} request
 * @returns {Promise<RequestResult>}
 */
export async function untilResponse(request) {
  return new Promise((resolve, reject) => {
    request.on('response', (res) => {
      const { statusCode, headers } = res;
      /** @type Buffer */
      let message;
      res.on('data', (chunk) => {
        if (message) {
          message = Buffer.concat([message, chunk]);
        } else {
          message = chunk;
        }
      });

      res.on('end', () => {
        resolve(/** @type RequestResult */ ({
          statusCode,
          headers,
          message,
        }));
      });
    });
    request.on('error', (e) => {
      reject(e);
    });
    request.end();
  });
}

/**
 * @param {number=} timeout
 * @returns {Promise<void>} 
 */
export async function aTimeout(timeout=0) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), timeout);
  });
}

/**
 * Do not call `end()` on the request. This function calls it when all is ready.
 * @param {ClientRequest} request
 * @param {number} port
 * @returns {Promise<RequestResult>}
 */
export async function untilParseResult(request, port) {
  const current = await untilResponse(request);
  if (current.statusCode === 200) {
    return current;
  }
  if (![204, 201].includes(current.statusCode)) {
    throw new Error(`The process ended in an error: ${current.statusCode}.`);
  }
  const statusRequest = http.request({
    hostname: 'localhost',
    port,
    path: current.headers.location,
    method: 'GET',
  });
  await aTimeout(25);
  return untilParseResult(statusRequest, port);
}

/**
 * Do not call `end()` on the request. This function calls it when all is ready.
 * @param {ClientRequest} request
 * @param {number} port
 * @returns {Promise<RequestResult>}
 */
export async function untilParseError(request, port) {
  const current = await untilResponse(request);
  if (current.statusCode >= 400) {
    return current;
  }
  if ([204, 201].includes(current.statusCode)) {
    const statusRequest = http.request({
      hostname: 'localhost',
      port,
      path: current.headers.location,
      method: 'GET',
    });
    await aTimeout(25);
    return untilParseError(statusRequest, port);
  }
  throw new Error(`The process ended in not an error: ${current.statusCode}.`);
}

/**
 * Do not call `end()` on the request. This function calls it when all is ready.
 * @param {ClientRequest} request
 * @param {number} port
 * @returns {Promise<RequestResult>}
 */
export async function untilMultiChoice(request, port) {
  const current = await untilResponse(request);
  if (current.statusCode === 300) {
    return current;
  }
  if ([204, 201].includes(current.statusCode)) {
    const statusRequest = http.request({
      hostname: 'localhost',
      port,
      path: current.headers.location,
      method: 'GET',
    });
    await aTimeout(25);
    return untilMultiChoice(statusRequest, port);
  }
  throw new Error(`The process ended in an error: ${current.statusCode}.`);
}
