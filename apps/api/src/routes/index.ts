import { Hono } from "hono";
import health from "./health";
import auth from "./auth";
import users from "./users";
import repositories from "./repositories";
import git from "./git";
import gitProtocol from "./git-protocol";
import file from "./file";
import issues from "./issues";
import settings from "./settings";

export function mountRoutes(app: Hono) {
  app.route("/", health);
  app.route("/", auth);
  app.route("/", users);
  app.route("/", repositories);
  app.route("/", git);
  app.route("/", gitProtocol);
  app.route("/", file);
  app.route("/", issues);
  app.route("/", settings);
}
