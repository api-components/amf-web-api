import pkg from 'amf-client-js';
import path from 'path';
import { ServerResourceLoader } from './ServerResourceLoader.js';

const {
  RAMLConfiguration,
  OASConfiguration,
  AsyncAPIConfiguration,
  RenderOptions,
  PipelineId,
  WebAPIConfiguration,
  ResourceLoaderFactory,
} = pkg;

/** @typedef {import('amf-client-js').AMFBaseUnitClient} AMFBaseUnitClient */
/** @typedef {import('amf-client-js').AMFConfiguration} AMFConfiguration */
/** @typedef {import('amf-client-js').AMFDocumentResult} AMFDocumentResult */
/** @typedef {import('amf-client-js').AMFResult} AMFResult */
/** @typedef {import('amf-client-js').Document} Document */
/** @typedef {import('amf-client-js').RenderOptions} RenderOptions */
/** @typedef {import('../types').ParserProcessMessage} ParserProcessMessage */
/** @typedef {import('../types').ContentParseCommand} ContentParseCommand */
/** @typedef {import('../types').ApiProjectParseCommand} ApiProjectParseCommand */
/** @typedef {import('../types').ParserProcessResult} ParserProcessResult */
/** @typedef {import('../types').ParserVendors} ParserVendors */
/** @typedef {import('../types').ApiParsingResult} ApiParsingResult */

/**
 * The child process that performs the parsing job.
 */
class AmfParserProcess {
  /**
   * Handles the message from the main process.
   * @param {ParserProcessMessage} data
   */
  handleMessage(data) {
    const { action, command } = data;
    if (action === 'parse-content') {
      this.parseContent(/** @type ContentParseCommand */ (command));
      return;
    }
    if (action === 'parse-project') {
      this.parseProject(/** @type ApiProjectParseCommand */ (command));
      return;
    }
    process.send(/** @type  ParserProcessResult */ ({
      status: 'failed',
      result: `Unknown action: ${action}`,
    }));
  }

  /**
   * @param {ContentParseCommand} command
   */
  async parseContent(command) {
    const { content, vendor } = command;
    const customResourceLoader = ResourceLoaderFactory.create(new ServerResourceLoader());
    try {
      const ro = new RenderOptions().withSourceMaps().withCompactUris();
      const apiConfiguration = this.getConfiguration(vendor).withRenderOptions(ro).withResourceLoader(customResourceLoader);
      const client = apiConfiguration.baseUnitClient();
      const result = await client.parseContent(content);

      const wac = WebAPIConfiguration.fromSpec(result.sourceSpec);
      const waRo = new RenderOptions().withSourceMaps().withCompactUris();
      const renderConfig = wac.withRenderOptions(waRo);
      const transformed = renderConfig.baseUnitClient().transform(result.baseUnit, PipelineId.Editing);
      const rendered = client.render(transformed.baseUnit, 'application/ld+json');
      process.send(/** @type ParserProcessResult */ ({
        status: 'finished',
        result: /** @type ApiParsingResult */ ({
          rendered,
          vendor,
        }),
      }));
    } catch (e) {
      process.send(/** @type  ParserProcessResult */ ({
        status: 'failed',
        result: e.message || e.toString(),
      }));
    }
  }

  /**
   * @param {ApiProjectParseCommand} command 
   */
  async parseProject(command) {
    const { dir, entrypoint, vendor } = command;
    const customResourceLoader = ResourceLoaderFactory.create(new ServerResourceLoader(dir));
    try {
      const ro = new RenderOptions().withSourceMaps().withCompactUris();
      const apiConfiguration = this.getConfiguration(vendor).withRenderOptions(ro).withResourceLoader(customResourceLoader);
      const client = apiConfiguration.baseUnitClient();
      const location = path.join(dir, entrypoint);
      const result = await client.parse(`file://${location}`);

      const wac = WebAPIConfiguration.fromSpec(result.sourceSpec).withResourceLoader(customResourceLoader);
      const waRo = new RenderOptions().withSourceMaps().withCompactUris();
      const renderConfig = wac.withRenderOptions(waRo);
      const transformed = renderConfig.baseUnitClient().transform(result.baseUnit, PipelineId.Editing);
      const rendered = client.render(transformed.baseUnit, 'application/ld+json');
      process.send(/** @type ParserProcessResult */ ({
        status: 'finished',
        result: /** @type ApiParsingResult */ ({
          rendered,
          vendor,
        }),
      }));
    } catch (e) {
      process.send(/** @type  ParserProcessResult */ ({
        status: 'failed',
        result: e.message || e.toString(),
      }));
    }
  }

  /**
   * @param {ParserVendors} vendor 
   * @returns {AMFConfiguration}
   */
  getConfiguration(vendor) {
    switch (vendor) {
      case 'RAML 0.8': return RAMLConfiguration.RAML08();
      case 'RAML 1.0': return RAMLConfiguration.RAML10();
      case 'OAS 2.0': return OASConfiguration.OAS20();
      case 'OAS 3.0': return OASConfiguration.OAS30();
      case 'ASYNC 2.0': return AsyncAPIConfiguration.Async20();
    }
  }
}

const parser = new AmfParserProcess();

process.on('message', (data) => parser.handleMessage(/** @type ParserProcessMessage */ (data)));
if (process.connected) {
  try {
    process.send('hello', () => {
      // ...
    });
  } catch (e) {
    // ...
  }
} else {
  process.exit();
}
