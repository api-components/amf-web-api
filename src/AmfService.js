/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable class-methods-use-this */
import { v4 } from 'uuid';
import { ApiError } from './ApiError.js';
import { AmfParser } from './AmfParser.js';

/** @typedef {import('koa').Request} Request */
/** @typedef {import('../types').AmfProcessItem} AmfProcessItem */
/** @typedef {import('../types').ProcessingStatus} ProcessingStatus */
/** @typedef {import('../types').ParserConfiguration} ParserConfiguration */

const timerSymbol = Symbol('timerSymbol');

/**
 * A demo page AMF parsing service.
 */
export class AmfService {
  /**
   * @param {ParserConfiguration=} opts
   */
  constructor(opts={}) {
    /** 
     * @type {Map<string, AmfProcessItem>}
     */
    this.processes = new Map();
    const { ttl=60000 } = opts;
    this.ttl = ttl;
    this.collectorHandler = this.collectorHandler.bind(this);
    this.collectorTimeout = setInterval(this.collectorHandler, 1000);
  }

  /**
   * Signals all processes to end.
   */
  async cleanup() {
    clearInterval(this.collectorTimeout);
    for (const [key] of this.processes) {
      this.removeProcess(key);
    }
  }

  /**
   * Handles the request when requesting parsing of an API content.
   * @param {Request} request
   * @returns {Promise<string>} The identifier of the process.
   */
  async parseText(request) {
    const { headers } = request;
    const vendor = /** @type string */ (headers['x-api-vendor']);
    if (!vendor) {
      throw new ApiError('x-api-vendor header is missing', 400);
    }
    const body = await this.readBody(request);
    if (!body) {
      throw new ApiError('Request body is not set', 400);
    }
    const key = this.addProcess();
    const info = this.processes.get(key);
    const now = Date.now();
    info.lastAccess = now;
    info.parser.parseText(body, vendor);
    return key;
  }

  /**
   * Handles the request when requesting parsing of an API file.
   * @param {Request} request
   * @returns {Promise<any>} 
   */
  async parseFile(request) {
    const { headers } = request;
    const body = await this.readBody(request);
    if (!body) {
      throw new ApiError('Request body is not set', 400);
    }
    const key = this.addProcess();
    const info = this.processes.get(key);
    const now = Date.now();
    info.lastAccess = now;
    const entryPoint = /** @type string */ (headers['x-entrypoint']);
    info.parser.parseFile(body, entryPoint);
    return key;
  }

  /**
   * Reads the request body.
   * @param {Request} request
   * @returns {Promise<Buffer>} 
   */
  async readBody(request) {
    return new Promise((resolve, reject) => {
      let message;
      request.req.on('data', (chunk) => {
        try {
          if (message) {
            message = Buffer.concat([message, chunk]);
          } else {
            message = chunk;
          }
        } catch (e) {
          reject(e);
          throw e;
        }
      });
      request.req.on('end', () => {
        resolve(message);
      });
    });
  }

  /**
   * Checks for the status of a job.
   * @param {string} key
   * @returns {Promise<ProcessingStatus>} 
   */
  async checkStatus(key) {
    if (!this.processes.has(key)) {
      throw new ApiError(`Unknown resource ${key}`, 404);
    }
    const info = this.processes.get(key);
    const now = Date.now();
    info.lastAccess = now;
    return info.parser.status;
  }

  /**
   * Reads the process' error message.
   * @param {string} key The process key.
   * @returns {Promise<string>} The error message set on the process.
   */
  async getError(key) {
    if (!this.processes.has(key)) {
      throw new ApiError(`Unknown resource ${key}`, 400);
    }
    const info = this.processes.get(key);
    const now = Date.now();
    info.lastAccess = now;
    return info.parser.error;
  }

  /**
   * Reads the process' computation result.
   * @param {string} key The process key.
   * @returns {Promise<any>} The result
   */
  async getResult(key) {
    if (!this.processes.has(key)) {
      throw new ApiError(`Unknown resource ${key}`, 400);
    }
    const info = this.processes.get(key);
    const now = Date.now();
    info.lastAccess = now;
    return info.parser.result;
  }

  /**
   * Reads the list of API entry point candidates.
   * 
   * @param {string} key The process key.
   * @returns {Promise<string[]>} The result
   */
  async getCandidates(key) {
    if (!this.processes.has(key)) {
      throw new ApiError(`Unknown resource ${key}`, 400);
    }
    const info = this.processes.get(key);
    const now = Date.now();
    info.lastAccess = now;
    return info.parser.candidates;
  }

  /**
   * Reads the list of API entry point candidates.
   * 
   * @param {string} key The process key.
   * @param {Request} request
   * @returns {Promise<void>}
   */
  async setEntrypoint(key, request) {
    if (!this.processes.has(key)) {
      throw new ApiError(`Unknown resource ${key}`, 400);
    }
    const body = await this.readBody(request);
    const message = JSON.parse(body.toString('utf-8'));
    const info = this.processes.get(key);
    const now = Date.now();
    info.lastAccess = now;
    return info.parser.setEntrypoint(message.entrypoint);
  }

  /**
   * Creates a new instance of an AMF parser.
   * @returns {string} The id of the parser instance.
   */
  addProcess() {
    const key = v4();
    const parser = new AmfParser();
    const now = Date.now();
    const info = /** @type AmfProcessItem */ ({
      parser,
      created: now,
      lastAccess: now,
    });
    this.processes.set(key, info);
    return key;
  }

  /**
   * @param {string} key
   */
  removeProcess(key) {
    if (!this.processes.has(key)) {
      throw new ApiError(`Unknown resource ${key}`, 400);
    }
    const info = this.processes.get(key);
    info.parser.cancel();
    this.processes.delete(key);
  }

  /**
   * Iterates over current processes and clears the ones that are considered stale.
   */
  collectorHandler() {
    const { ttl, processes } = this;
    if (!ttl || Number.isNaN(ttl) || !processes.size) {
      return;
    }
    const now = Date.now();
    for (const [key, info] of processes) {
      const { lastAccess } = info;
      if (lastAccess + ttl < now) {
        this.removeProcess(key);
      }
    }
  }
}
