import { ParameterizedContext } from 'koa';
import Router from '@koa/router';
import { AmfService } from './AmfService.js';
import { ServerConfiguration } from '../types';

/**
 * The routes controller for the AMF parsing API.
 */
export class ApiRoutes {
  prefix: string;
  service: AmfService;
  /**
   * @param opts Optional server configuration options.
   */
  constructor(opts?: ServerConfiguration);

  /**
   * Signals all processes to end.
   */
  cleanup(): Promise<void>;

  /**
   * @param prefix The prefix to use with the API routes. E.g. /api/v1
   */
  setup(prefix?: string): Router;

  wrapError(cause: Error, code?: number): any;

  /**
   * Creates a URL for the job status
   * @param key The job identifier.
   * @returns The relative URL.
   */
  jobUrl(key: string): string;

  /**
   * Handles the `/text` route
   */
  handleParseText(ctx: ParameterizedContext): Promise<void>;

  /**
   * Handles the `/file` route 
   */
  handleParseFile(ctx: ParameterizedContext): Promise<void>;

  /**
   * Handles the `/job` route 
   */
  handleJobQuery(ctx: ParameterizedContext): Promise<void>;

  /**
   * Handles the `/job` route 
   */
  deleteJob(ctx: ParameterizedContext): Promise<void>;

  /**
   * Handles the `/job` route
   */
  handleUpdateJob(ctx: ParameterizedContext): Promise<void>;
}
