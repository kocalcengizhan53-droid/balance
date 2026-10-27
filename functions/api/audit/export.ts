import { auditExport, type Env } from "../../../server/api"

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  auditExport(request, env)
