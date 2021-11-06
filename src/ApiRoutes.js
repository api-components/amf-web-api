import Router from '@koa/router';
import { AmfService } from './AmfService.js';
import { ApiError } from './ApiError.js';

/** @typedef {import('koa').ParameterizedContext} ParameterizedContext */
/** @typedef {import('koa').Next} Next */
/** @typedef {import('koa').DefaultState} DefaultState */
/** @typedef {import('koa').DefaultContext} DefaultContext */
/** @typedef {import('@koa/router').RouterOptions} RouterOptions */
/** @typedef {import('../types').ProcessingStatus} ProcessingStatus */
/** @typedef {import('../types').ServerConfiguration} ServerConfiguration */

/**
 * The routes controller for the AMF parsing API.
 */
export class ApiRoutes {
  /**
   * @param {ServerConfiguration=} opts Optional server configuration options.
   */
  constructor(opts={}) {
    this.service = new AmfService(opts.parser);
    /** @type string */
    this.prefix = '';
  }

  /**
   * Signals all processes to end.
   */
  async cleanup() {
    this.service.cleanup();
  }

  /**
   * @param {string=} prefix The prefix to use with the API routes. E.g. /api/v1
   * @returns {import('@koa/router')<DefaultState, DefaultContext>}
   */
  setup(prefix) {
    const opts = /** @type RouterOptions */ ({});
    if (prefix) {
      opts.prefix = prefix;
      this.prefix = prefix;
    }
    const router = new Router(opts);
    router.post('/text', this.handleParseText.bind(this));
    router.post('/file', this.handleParseFile.bind(this));
    router.get('/job/:key', this.handleJobQuery.bind(this));
    router.put('/job/:key', this.handleUpdateJob.bind(this));
    router.delete('/job/:key', this.deleteJob.bind(this));
    return router;
  }

  /**
   * @param {Error} cause
   * @param {number=} code
   * @returns {any} 
   */
  wrapError(cause, code=500) {
    return {
      error: true,
      code,
      message: cause.message,
      detail: 'The server misbehave. That is all we know.'
    };
  }

  /**
   * Creates a URL for the job status
   * @param {string} key The job identifier.
   * @returns {string} The relative URL.
   */
  jobUrl(key) {
    return `${this.prefix}/job/${key}`;
  }

  /**
   * Handles the `/text` route
   * 
   * @param {ParameterizedContext} ctx
   * @returns {Promise<void>} 
   */
  async handleParseText(ctx) {
    /** @type string */
    let key;
    try {
      key = await this.service.parseText(ctx.request);
    } catch (cause) {
      const error = new ApiError(cause.message || 'Unknown error', 400);
      ctx.body = this.wrapError(error, error.code);
      ctx.status = cause.code;
      return;
    }
    ctx.status = 201;
    const url = this.jobUrl(key);
    ctx.set('location', url);
    ctx.body = { 
      status: 201, 
      location: url,
      key,
    };
  }

  /**
   * Handles the `/file` route
   * 
   * @param {ParameterizedContext} ctx
   * @returns {Promise<void>} 
   */
  async handleParseFile(ctx) {
    /** @type string */
    let key;
    try {
      key = await this.service.parseFile(ctx.request);
    } catch (cause) {
      const error = new ApiError(cause.message || 'Unknown error', 400);
      ctx.body = this.wrapError(error, error.code);
      ctx.status = cause.code;
      return;
    }
    ctx.status = 201;
    const url = this.jobUrl(key);
    ctx.set('location', url);
    ctx.body = { 
      status: 201, 
      location: url,
      key,
    };
  }

  /**
   * Handles the `/job` route
   * 
   * @param {ParameterizedContext} ctx
   * @returns {Promise<void>} 
   */
  async handleJobQuery(ctx) {
    const { key } = ctx.params;
    /** @type ProcessingStatus */
    let status;
    try {
      status = await this.service.checkStatus(key);
    } catch (cause) {
      const error = new ApiError(cause.message || 'Unknown error', cause.code || 400);
      ctx.body = this.wrapError(error, error.code);
      ctx.status = cause.code;
      return;
    }
    if (status === 'finished') {
      const body = await this.service.getResult(key);
      this.service.removeProcess(key);
      ctx.status = 200;
      ctx.type = 'application/ld+json';
      ctx.body = body;
      return;
    }
    if (status === 'running' || status === 'initialized') {
      ctx.status = 204;
      const url = this.jobUrl(key);
      ctx.set('location', url);
      return;
    }
    if (status === 'failed') {
      const body = await this.service.getError(key);
      this.service.removeProcess(key);
      const e = new ApiError(body || 'Unknown error', 500);
      ctx.status = e.code;
      ctx.body = this.wrapError(e, e.code);
      return;
    }
    if (status === 'waiting') {
      const body = await this.service.getCandidates(key);
      ctx.status = 300;
      const url = this.jobUrl(key);
      ctx.set('location', url);
      ctx.body = { files: body };
      return;
    }
    ctx.status = 500;
    ctx.body = this.wrapError(new Error('Unknown state'), 500);
  }

  /**
   * Handles the `/job` route
   * 
   * @param {ParameterizedContext} ctx
   * @returns {Promise<void>} 
   */
  async deleteJob(ctx) {
    const { key } = ctx.params;
    try {
      await this.service.checkStatus(key);
    } catch (cause) {
      const error = new ApiError(cause.message || 'Unknown error', cause.code || 400);
      ctx.body = this.wrapError(error, error.code);
      ctx.status = cause.code;
      return;
    }
    this.service.removeProcess(key);
    ctx.status = 204;
  }

  /**
   * Handles the `/job` route
   * 
   * @param {ParameterizedContext} ctx
   * @returns {Promise<void>} 
   */
  async handleUpdateJob(ctx) {
    const { key } = ctx.params;
    try {
      const status = await this.service.checkStatus(key);
      if (status !== 'waiting') {
        throw new ApiError(`The job is not waiting for the input`, 400);
      }
      await this.service.setEntrypoint(key, ctx.request);
    } catch (cause) {
      const error = new ApiError(cause.message || 'Unknown error', cause.code || 400);
      ctx.body = this.wrapError(error, error.code);
      ctx.status = cause.code;
      return;
    }
    const url = this.jobUrl(key);
    ctx.set('location', url);
    ctx.body = { 
      status: 201, 
      location: url,
      key,
    };
  }
}
