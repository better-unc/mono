import notifications from './notifications';
import pullRequests from './pull-requests';
import repositories from './repositories';
import gitProtocol from './git-protocol';
import discussions from './discussions';
import wellKnown from './well-known';
import settings from './settings';
import projects from './projects';
import search from './search';
import issues from './issues';
import health from './health';
import users from './users';
import oauth from './oauth';
import { Hono } from 'hono';
import file from './file';
import auth from './auth';
import git from './git';

export function mountRoutes(app: Hono) {
  app.route('/', health);
  app.route('/', auth);
  app.route('/', users);
  app.route('/', repositories);
  app.route('/', git);
  app.route('/', gitProtocol);
  app.route('/', file);
  app.route('/', issues);
  app.route('/', pullRequests);
  app.route('/', settings);
  app.route('/', search);
  app.route('/', notifications);
  app.route('/', discussions);
  app.route('/', projects);
  app.route('/', oauth);
  app.route('/', wellKnown);
}
