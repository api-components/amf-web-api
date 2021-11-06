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
   * @param port The port number to use.
   */
  startHttp(port: number): Promise<void>;

  /**
   * Stops a running www server, if any.
   * 
   * @param port When specified it closes a www server on a specific port. When not it stops all running http servers.
   */
  stopHttp(port?: number): Promise<void[]>;

  /**
   * Starts the www over SSL server on a given port.
   * 
   * @param sslOptions The SSL options to use when creating the server.
   * @param port The port number to use.
   */
  startSsl(sslOptions: https.ServerOptions, port: number): Promise<void>;

  /**
   * Stops a running www over SSL server, if any.
   * 
   * @param port When specified it closes an ssl server on a specific port. When not it stops all running https servers.
   */
  stopSsl(port?: number): Promise<void[]>;

  /**
   * 
   * @param type The server type to stop.
   * @param port The optional port of the server.
   */
  _stop(type: SupportedServer, port: number): Promise<void[]>;

  _stopServer(server: https.Server | http.Server): Promise<void>;
}
