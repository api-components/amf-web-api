import Koa from 'koa';
import http from 'http';
import https from 'https';
import cors from '@koa/cors';
import { dir } from 'tmp-promise';
import { platform } from 'os';
import path from 'path';
import { ApiRoutes } from './ApiRoutes.js';

/** @typedef {import('@koa/cors').Options} CorsOptions */
/** @typedef {import('../types').RunningServer} RunningServer */
/** @typedef {import('../types').SupportedServer} SupportedServer */
/** @typedef {import('../types').ServerConfiguration} ServerConfiguration */

/**
 * AMF web API server.
 * A web server that exposes an API to parse API projects with the AMF parser.
 */
export class Server {
  /**
   * This function can be used to create a temporary directory where a socket will be put.
   * @returns {Promise<string>} A path to a temporary folder where the socket path can be created.
   */
  static async createSocketPath() {
    const tmpObj = await dir({ unsafeCleanup: true });
    return tmpObj.path;
  }

  /**
   * Use this with combination with the `Server.createSocketPath()`.
   * 
   * ```javascript
   * const socketName = 'my-socket.sock';
   * const socketPath = await Server.createSocketPath();
   * const socketLocation = Server.createPlatformSocket(socketPath, socketName);
   * ```
   * 
   * @param {string} socketPath The path to the socket.
   * @param {string} socketName The socket name.
   * @returns {string} The platform specific socket path.,
   */
  static createPlatformSocket(socketPath, socketName) {
    if (platform() === 'win32') {
      return path.join('\\\\?\\pipe', socketPath, socketName);
    }
    return path.join(socketPath, socketName)
  }

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
    const { opts } = this;
    if (opts.cors && opts.cors.enabled) {
      const config = opts.cors.cors || this.defaultCorsConfig();
      this.app.use(cors(config));
    }
    const handler = new ApiRoutes(opts);
    const apiRouter = handler.setup(prefix);
    this.app.use(apiRouter.routes());
    this.app.use(apiRouter.allowedMethods());
    this.apiHandler = handler;
  }

  /**
   * Starts the www server on a given port.
   * @param {number|string} portOrSocket The port number to use or a socket path
   * @returns {Promise<void>}
   */
  startHttp(portOrSocket) {
    return new Promise((resolve) => {
      const server = http.createServer(this.app.callback());
      this.servers.push({
        server,
        type: 'http',
        portOrSocket,
      });
      server.listen(portOrSocket, () => {
        resolve();
      });
    });
  }

  /**
   * Stops a running www server, if any.
   * 
   * @param {number|string=} portOrSocket When specified it closes a www server on a specific port/socket. When not it stops all running http servers.
   * @returns {Promise<void[]>}
   */
  stopHttp(portOrSocket) {
    return this._stop('http', portOrSocket);
  }

  /**
   * Starts the www over SSL server on a given port.
   * 
   * @param {https.ServerOptions} sslOptions The SSL options to use when creating the server.
   * @param {number|string} portOrSocket The port number to use or a socket path
   */
  startSsl(sslOptions, portOrSocket) {
    return new Promise((resolve) => {
      const server = https.createServer(sslOptions, this.app.callback());
      this.servers.push({
        server,
        type: 'https',
        portOrSocket,
      });
      server.listen(portOrSocket, () => {
        resolve();
      });
    });
  }

  /**
   * Stops a running www over SSL server, if any.
   * 
   * @param {number|string=} portOrSocket When specified it closes an ssl server on a specific port/socket. When not it stops all running https servers.
   * @returns {Promise<void[]>}
   */
  stopSsl(portOrSocket) {
    return this._stop('https', portOrSocket);
  }

  /**
   * 
   * @param {SupportedServer} type The server type to stop.
   * @param {number|string=} portOrSocket The optional port of the server.
   * @returns {Promise<void[]>}
   * @private
   */
  _stop(type, portOrSocket) {
    const toStop = this.servers.filter((s) => {
      if (s.type === type) {
        if (portOrSocket) {
          return portOrSocket === s.portOrSocket;
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

  /**
   * @returns {CorsOptions}
   */
  defaultCorsConfig() {
    return {
      allowMethods: 'GET,PUT,POST,DELETE',
    };
  }
}
