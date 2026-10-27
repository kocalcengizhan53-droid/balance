import { editDelete, editPut, type Env } from "../../../server/api"

export const onRequestPut: PagesFunction<Env, "unit"> = ({
  request,
  env,
  params,
}) => editPut(request, env, String(params.unit))
export const onRequestDelete: PagesFunction<Env, "unit"> = ({
  request,
  env,
  params,
}) => editDelete(request, env, String(params.unit))
