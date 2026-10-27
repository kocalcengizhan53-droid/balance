import {
  sessionDelete,
  sessionGet,
  sessionPatch,
  sessionPost,
  type Env,
} from "../../server/api"

export const onRequestGet: PagesFunction<Env> = ({ request, env }) =>
  sessionGet(request, env)
export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  sessionPost(request, env)
export const onRequestPatch: PagesFunction<Env> = ({ request, env }) =>
  sessionPatch(request, env)
export const onRequestDelete: PagesFunction<Env> = ({ request, env }) =>
  sessionDelete(request, env)
