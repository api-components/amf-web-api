import Koa from 'koa';
import http from 'http';
import https from 'https';
import { ApiRoutes } from './ApiRoutes.js';

/** @typedef {import('../types').RunningServer} RunningServer */
/** @typedef {import('../types').SupportedServer} SupportedServer */
/** @typedef {import('../types').ServerConfiguration} ServerConfiguration */

/**
 * AMF web API server.
 * A web server that exposes an API to parse API projects with the AMF parser.
 */
export class Server {
  /**
   * @param {ServerConfiguration=} opts Optional server configuration options.
   */
  constructor(opts={}) {
    /** @type RunningServer[] */
    this.servers = [];
    this.app = new Koa();
    this.opts = opts;
  }

  /**
   * Signals all processes to end.
   */
  async cleanup() {
    if (!this.apiHandler) {
      return;
    }
    this.apiHandler.cleanup();
  }

  /**
   * Called when initializing the server class.
   * Sets up the API routes.
   * 
   * @param {string=} prefix The prefix to use with the API routes. E.g. /api/v1
   */
  setupRoutes(prefix) {
    const handler = new ApiRoutes(this.opts);
    const apiRouter = handler.setup(prefix);
    this.app.use(apiRouter.routes());
    this.app.use(apiRouter.allowedMethods());
    this.apiHandler = handler;
  }

  /**
   * Starts the www server on a given port.
   * @param {number} port The port number to use.
   * @returns {Promise<void>}
   */
  startHttp(port) {
    return new Promise((resolve) => {
      const server = http.createServer(this.app.callback());
      this.servers.push({
        server,
        type: 'http',
        port,
      });
      server.listen(port, () => {
        resolve();
      });
    });
  }

  /**
   * Stops a running www server, if any.
   * 
   * @param {number=} port When specified it closes a www server on a specific port. When not it stops all running http servers.
   * @returns {Promise<void[]>}
   */
  stopHttp(port) {
    return this._stop('http', port);
  }

  /**
   * Starts the www over SSL server on a given port.
   * 
   * @param {https.ServerOptions} sslOptions The SSL options to use when creating the server.
   * @param {number} port The port number to use.
   */
  startSsl(sslOptions, port) {
    return new Promise((resolve) => {
      const server = https.createServer(sslOptions, this.app.callback());
      this.servers.push({
        server,
        type: 'https',
        port,
      });
      server.listen(port, () => {
        resolve();
      });
    });
  }

  /**
   * Stops a running www over SSL server, if any.
   * 
   * @param {number=} port When specified it closes an ssl server on a specific port. When not it stops all running https servers.
   * @returns {Promise<void[]>}
   */
  stopSsl(port) {
    return this._stop('https', port);
  }

  /**
   * 
   * @param {SupportedServer} type The server type to stop.
   * @param {number} port The optional port of the server.
   * @returns {Promise<void[]>}
   * @private
   */
  _stop(type, port) {
    const toStop = this.servers.filter((s) => {
      if (s.type === type) {
        if (port) {
          return port === s.port;
        }
        return true;
      }
      return false;
    });
    const promises = toStop.map((item) => this._stopServer(item.server));
    return Promise.all(promises);
  }

  /**
   * @param {https.Server | http.Server} server 
   * @returns {Promise<void>}
   */
  _stopServer(server) {
    return new Promise((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  }
}
