import { AuroraPluginAPI } from '@aurora/plugin-sdk';
import { apiMeta, ParamMeta } from '@aurora/plugin-sdk/mcp';

import { createPluginAPI } from '../plugins/createPluginAPI';

const bridgeApi: AuroraPluginAPI = createPluginAPI('bridge', 'Bridge');

const dispatchPluginApi = async (
  domain: string,
  methodName: string,
  params: Record<string, unknown>,
): Promise<unknown> => {
  const methodMeta = apiMeta[domain].methods[methodName];

  const domainInstance = bridgeApi[domain as keyof AuroraPluginAPI];
  const fn = domainInstance[methodName as keyof typeof domainInstance] as (
    ...args: never[]
  ) => Promise<unknown>;

  const positionalArgs = methodMeta.params.map(
    (param: ParamMeta) => params[param.name],
  );
  return fn.apply(domainInstance, positionalArgs as never[]) ?? null;
};

export const dispatch = async (
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> => {
  const [domain, methodName] = method.split('.', 2);
  return dispatchPluginApi(domain, methodName, params);
};
