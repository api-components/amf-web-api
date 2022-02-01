import Koa from 'koa';
import http from 'http';
import https from 'https';
import { ApiRoutes } from './ApiRoutes.js';
import { RunningServer, ServerConfiguration, SupportedServer } from '../types';

/**
 * AMF web API server.
 * A web server that exposes an API to parse API projects with the AMF parser.
 */
export class Server {
  servers: RunningServer[];
  app: Koa;
  opts: ServerConfiguration;
  apiHandler: ApiRoutes;

  /**
   * This function can be used to create a temporary directory where a socket will be put.
   * @returns A path to a temporary folder where the socket path can be created.
   */
  static createSocketPath(): Promise<string>;

  /**
   * Use this with combination with the `Server.createSocketPath()`.
   * 
   * ```javascript
   * const socketName = 'my-socket.sock';
   * const socketPath = await Server.createSocketPath();
   * const socketLocation = Server.createPlatformSocket(socketPath, socketName);
   * ```
   * 
   * @param socketPath The path to the socket.
   * @param socketName The socket name.
   * @returns The platform specific socket path.,
   */
  static createPlatformSocket(socketPath: string, socketName: string): string;

  /**
   * @param opts Optional server configuration options.
   */
  constructor(opts?: ServerConfiguration);

  /**
   * Signals all processes to end.
   */
  cleanup(): Promise<void>;

  /**
   * Called when initializing the server class.
   * Sets up the API routes.
   * 
   * @param prefix The prefix to use with the API routes. E.g. /api/v1
   */
  setupRoutes(prefix?: string): void;

  /**
   * Starts the www server on a given port.
   * @param portOrSocket The port number to use or a socket path
   */
  startHttp(portOrSocket: number|string): Promise<void>;

  /**
   * Stops a running www server, if any.
   * 
   * @param portOrSocket When specified it closes a www server on a specific port/socket. When not it stops all running http servers.
   */
  stopHttp(portOrSocket?: number|string): Promise<void[]>;

  /**
   * Starts the www over SSL server on a given port.
   * 
   * @param sslOptions The SSL options to use when creating the server.
   * @param port The port number to use or a socket path
   */
  startSsl(sslOptions: https.ServerOptions, port: number): Promise<void>;

  /**
   * Stops a running www over SSL server, if any.
   * 
   * @param portOrSocket When specified it closes an ssl server on a specific port/socket. When not it stops all running https servers.
   */
  stopSsl(portOrSocket?: number|string): Promise<void[]>;

  /**
   * 
   * @param type The server type to stop.
   * @param portOrSocket The optional port of the server.
   */
  _stop(type: SupportedServer, portOrSocket: number|string): Promise<void[]>;

  _stopServer(server: https.Server | http.Server): Promise<void>;
}
