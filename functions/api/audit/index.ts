import { auditGet, type Env } from "../../../server/api"

export const onRequestGet: PagesFunction<Env> = ({ request, env }) =>
  auditGet(request, env)
