import pkg from 'amf-client-js';

/** @typedef {import('amf-client-js').Content} Content */

const { JsServerFileResourceLoader } = pkg;

/**
 * Makes sure the sources only read files inside the project directory
 */
export class ServerResourceLoader {
  /**
   * @param {string=} base The API project base path. When missing noting is accepted.
   */
  constructor(base) {
    this.base = base;
  }

  /**
   * @param {string} resource
   * @returns {boolean}
   */
  accepts(resource) {
    return this.isAllowed(resource);
  }

  /**
   * @param {string} resource
   * @returns {Promise<Content>} 
   */
  async fetch(resource) {
    if (!this.isAllowed(resource)) {
      throw new Error('Unable to comply');
    }
    return new JsServerFileResourceLoader().fetch(resource);
  }

  /**
   * @param {string} resource
   * @returns {boolean}
   */
  isAllowed(resource) {
    const file = resource.replace('http://a.ml/amf/default_document', '').replace('file://', '').replace('http://a.ml', '');
    if (!file) {
      return true;
    }
    const { base='' } = this;
    if (!base) {
      return false;
    }
    if (file.startsWith(base)) {
      return true;
    }
    return false;
  }
}
