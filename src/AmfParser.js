/* eslint-disable class-methods-use-this */
import { fork } from 'child_process';
import { dir } from 'tmp-promise';
import { Duplex } from 'stream';
import unzipper from 'unzipper';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { ApiSearch } from './ApiSearch.js';

/** @typedef {import('child_process').ChildProcess} ChildProcess */
/** @typedef {import('tmp-promise').DirectoryResult} DirectoryResult */
/** @typedef {import('../types').ProcessingStatus} ProcessingStatus */
/** @typedef {import('../types').ParserProcessResult} ParserProcessResult */
/** @typedef {import('../types').ParserProcessMessage} ParserProcessMessage */
/** @typedef {import('../types').ApiProjectParseCommand} ApiProjectParseCommand */
/** @typedef {import('../types').ContentParseCommand} ContentParseCommand */

/**
 * A class that parses API content.
 */
export class AmfParser {
  /**
   * ...
   */
  constructor() {
    /** @type ProcessingStatus */
    this.status = 'initialized';
    /** 
     * The result of the parser computations.
     * Is is set when the status is `finished`
     * @type any
     */
    this.result = undefined;
    /** 
     * Any error message that made the process failed.
     * Is is set when the status is `failed`
     * @type string
     */
    this.error = undefined;
    /** @type ChildProcess */
    this.process = undefined;
    /** @type DirectoryResult */
    this.tmp = undefined;

    this.processExitHandler = this.processDisconnectHandler.bind(this);
    this.processMessage = this.processMessage.bind(this);
    this.processError = this.processError.bind(this);
  }

  /**
   * Cancels the current job.
   */
  cancel() {
    if (this.process && this.process.connected) {
      this.clearProcessListeners(this.process);
      this.process.disconnect();
    }
    if (this.process) {
      this.process.kill();
      this.process = undefined;
    }
    this.status = 'failed';
    this.error = 'The process was cancelled.';
    if (this.tmp) {
      this.tmp.cleanup();
    }
  }

  /**
   * Parses an API from the body
   * @param {Buffer} body The request body
   * @param {string} vendor API vendor.
   * @returns {Promise<void>}
   */
  async parseText(body, vendor) {
    this.status = 'running';
    const proc = await this.createProcess();
    this.process = proc;
    this.addProcessListeners(proc);
    const command = /** @type ContentParseCommand */ ({
      vendor,
      content: body.toString('utf8'),
    });
    const message = /** @type ParserProcessMessage */ ({
      action: 'parse-content',
      command,
    });
    proc.send(message);
  }

  /**
   * Parses an API file read from the body
   * 
   * @param {Buffer} body The request body
   * @param {string=} entryPoint When known, the name of the API entry point.
   * @returns {Promise<void>}
   */
  async parseFile(body, entryPoint) {
    this.status = 'running';
    if (!this.bufferIsZip(body)) {
      const error = new Error('The API file is not a zip file.');
      this.processError(error);
      return;
    }

    try {
      await this.unzip(body);
      const files = await this.resolve(entryPoint);
      if (Array.isArray(files) && files.length === 1) {
        this.parseApiProject(files[0]);
      } else if (typeof files === 'string') {
        this.parseApiProject(files);
      } else if (Array.isArray(files) && files.length > 1) {
        this.processCandidates(files);
      } else {
        throw new Error('Unable to determine API main file.');
      }
    } catch (e) {
      this.processError(e);
      if (this.tmp) {
        await this.tmp.cleanup();
      }
    }
  }

  /**
   * Creates a parser process.
   * @returns {Promise<ChildProcess>} 
   */
  createProcess() {
    return new Promise((resolve, reject) => {
      const env = { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' };
      const options = {
        execArgv: [],
        env
      };
      const processDir = fileURLToPath(import.meta.url).replace('AmfParser.js', '');
      const proc = fork(path.join(processDir, 'ParserProcess.js'), options);
      // the very first message from the child process is that the process started
      // and is ready to receive data.
      proc.once('message', () => {
        resolve(proc);
      });
      proc.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * @param {ChildProcess} proc
   */
  addProcessListeners(proc) {
    proc.on('disconnect', this.processDisconnectHandler);
    proc.on('message', this.processMessage);
    proc.on('error', this.processError);
  }

  /**
   * Logic executed when the process finish.
   */
  processDisconnectHandler() {
    if (!this.process) {
      return;
    }
    this.clearProcessListeners(this.process);
    this.process = undefined;
    if (this.status !== 'failed') {
      this.status = 'finished';
    }
  }

  /**
   * @param {ParserProcessResult} result
   */
  processMessage(result) {
    this.status = result.status;
    if (result.status === 'failed') {
      this.error = /** @type string */ (result.result);
    } else {
      this.result = /** @type any */ (result.result);
    }
    if (this.process && this.process.connected) {
      this.process.disconnect();
    }
  }

  /**
   * @param {Error} err
   */
  processError(err) {
    // console.error(err);
    this.status = 'failed';
    this.error = err.message;
    if (this.process && this.process.connected) {
      this.process.disconnect();
    }
  }

  /**
   * @param {ChildProcess} proc
   */
  clearProcessListeners(proc) {
    proc.removeAllListeners();
  }

  /**
   * Tests if the buffer has ZIP file header.
   * @param {Buffer} buffer File buffer
   * @return {boolean} true if the buffer is compressed zip.
   */
  bufferIsZip(buffer) {
    return buffer[0] === 0x50 && buffer[1] === 0x4b;
  }

  /**
   * Unzips the sources to a temporary folder.
   * 
   * @param {Buffer} buffer
   * @return {Promise<void>}
   */
  async unzip(buffer) {
    this.tmp = await this._unzip(buffer);
    await this.removeZipMainFolder(this.tmp.path);
  }

  /**
   * Unzips API folder and returns path to the folder in tmp location.
   *
   * @param {Buffer} buffer Zip file data
   * @return {Promise<DirectoryResult>} The result of creating a temporary folder.
   */
  async _unzip(buffer) {
    const tmpObj = await dir({ unsafeCleanup: true });
    return new Promise((resolve, reject) => {
      const stream = new Duplex();
      stream.push(buffer);
      stream.push(null);
      const extractor = unzipper.Extract({
        path: tmpObj.path,
      });
      extractor.on('close', () => {
        resolve(tmpObj);
      });
      extractor.on('error', (err) => {
        reject(err);
      });
      stream.pipe(extractor);
    });
  }

  /**
   * The zip may have source files enclosed in a folder.
   * This will look for a folder in the root path and will copy sources from it.
   *
   * @param {string} destination A place where the zip sources has been extracted.
   * @return {Promise<void>}
   */
  async removeZipMainFolder(destination) {
    let files = await fs.readdir(destination);
    files = files.filter((item) => item !== '__MACOSX');
    if (files.length > 1) {
      return;
    }
    const dirPath = path.join(destination, files[0]);
    const stats = await fs.stat(dirPath);
    if (stats.isDirectory()) {
      await fs.copy(dirPath, destination);
    }
  }

  /**
   * Resolves the API structure and tries to find main API file.
   *
   * @param {string=} entryPoint API main file if known.
   * @return {Promise<string[]|string>} If promise resolves to an array it means that API type could not be determined automatically.
   */
  async resolve(entryPoint) {
    if (entryPoint) {
      const file = path.join(this.tmp.path, entryPoint);
      const exists = await fs.pathExists(file);
      if (exists) {
        return entryPoint;
      }
      throw new Error('API main file does not exist.');
    }
    const search = new ApiSearch(this.tmp.path);
    const result = await search.findApiFile();
    if (!result) {
      throw new Error('Unable to find API files in the source location');
    }
    return result;
  }

  /**
   * Parses the API project from the zip file.
   *
   * @param {string} entrypoint The API main file.
   * @return {Promise<void>}
   */
  async parseApiProject(entrypoint) {
    const { path: projectLocation } = this.tmp;

    const search = new ApiSearch(projectLocation);
    const apiLocation = path.join(projectLocation, entrypoint);

    try {
      const type = await search.readApiType(apiLocation);
      const proc = await this.createProcess();
      this.process = proc;
      this.addProcessListeners(proc);
      const command = /** @type ApiProjectParseCommand */ ({
        dir: this.tmp.path,
        entrypoint,
        vendor: type.type,
      });
      const message = /** @type ParserProcessMessage */ ({
        action: 'parse-project',
        command,
      });
      proc.send(message);
    } catch (e) {
      this.processError(e);
      if (this.tmp) {
        await this.tmp.cleanup();
      }
    }
  }

  /**
   * Sets the API entry point candidates and the status.
   *
   * @param {string[]} files The list of API entry point candidates.
   * @return {Promise<void>}
   */
  async processCandidates(files) {
    this.status = 'waiting';
    this.candidates = files;
  }

  /**
   * Uses the passed entry point the the main file and continue parsing it.
   * @param {string} entrypoint 
   * @return {Promise<void>}
   */
  async setEntrypoint(entrypoint) {
    this.status = 'running';
    await this.parseApiProject(entrypoint);
  }
}
