/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */
import getPort from 'get-port';
import chalk from 'chalk';
import Server from '../index.js';

(async () => {
  // const port = await getPort();
  const port = 46739;
  const srv = new Server();
  srv.setupRoutes('/api/v1');
  await srv.startHttp(port);
  console.log(`The dev server started on port ${chalk.underline(port)}`);
})();
