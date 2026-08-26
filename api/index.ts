import serverlessHttp from 'serverless-http';
import { createApp } from '../src/app';

const app = createApp();
export default serverlessHttp(app);
