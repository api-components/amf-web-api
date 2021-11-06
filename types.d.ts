import http from 'http';
import https from 'https';
import { AmfParser } from './src/AmfParser';

export interface AmfProcessItem {
  parser: AmfParser;
  /**
   * The timestamp when the process was created
   */
  created: number;
  /**
   * The timestamp when the process was last interacted with. This increases the lifetime of a process.
   */
  lastAccess: number;
}

export type RAMLVendors = 'RAML 0.8' | 'RAML 1.0';
export type OASVendors = 'OAS 2.0' | 'OAS 3.0';
export type AmfVendors = 'AMF Graph' | 'JSON Schema';
export type AsyncVendors = 'ASYNC 2.0';
export type ParserVendors = RAMLVendors | OASVendors | AmfVendors | AsyncVendors;
export type ProcessingStatus = 'initialized' | 'running' | 'finished' | 'failed' | 'waiting';
export type RAMLMediaTypes = 'application/raml08+yaml' | 'application/raml10+yaml' | 'application/raml';
export type OASMediaTypes = 'application/json' | 'application/yaml' | 'application/oas20' | 'application/oas20+yaml' | 'application/oas20+json' | 'application/openapi30' | 'application/openapi30+yaml' | 'application/openapi30+json';
export type AsyncMediaTypes = 'application/asyncapi20' | 'application/asyncapi20+yaml' | 'application/asyncapi20+json';
export type AmfMediaTypes = 'application/amf-payload' | 'application/amf-payload+yaml' | 'application/amf-payload+json';
export type GraphMediaTypes = 'application/graph' | 'application/schema+json';
export type ParserMediaTypes = RAMLMediaTypes | OASMediaTypes | AsyncMediaTypes | AmfMediaTypes | GraphMediaTypes;

export interface ApiSearchTypeResult {
  type: ParserVendors;
  contentType: ParserMediaTypes;
}

export interface ParserProcessMessage {
  action: string;
  command: ContentParseCommand | ApiProjectParseCommand | unknown;
}

export interface ContentParseCommand {
  vendor: ParserVendors;
  content: string;
}

export interface ApiProjectParseCommand {
  /**
   * The location where the API project is located.
   */
  dir: string;
  /**
   * The API main file to parse.
   */
  entrypoint: string;
  /**
   * The API vendor to use with the AMF parser.
   */
  vendor: ParserVendors;
}

export interface ParserProcessResult {
  status: 'finished' | 'failed';
  result: unknown;
}

export type SupportedServer = 'https' | 'http';

export interface RunningServer {
  server: https.Server | http.Server;
  type: SupportedServer;
  port: number;
}

export interface ServerConfiguration {
  parser?: ParserConfiguration;
}

export interface ParserConfiguration {
  /**
   * The number of milliseconds after which the parser process or parsing result is considered stale and 
   * is removed from the memory. Set to 0 to disable, however this may have a serious memory management consequences.
   * 
   * The default value is the equivalent of 10 minutes.
   * 
   * @default 60000
   */
  ttl?: number;
}
