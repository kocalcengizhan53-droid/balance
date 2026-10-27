import { editsGet, type Env } from "../../../server/api"

export const onRequestGet: PagesFunction<Env> = ({ request, env }) =>
  editsGet(request, env)
