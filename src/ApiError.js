/**
 * Base API Error class.
 */
export class ApiError extends Error {
  /**
   * @param {string} message The error message
   * @param {number} code The response status code.
   */
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}
