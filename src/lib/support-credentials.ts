import { getSupportCredentials, type ServerEnvironment } from "./env";

export function verifySupportCredentials(
  id: string,
  password: string,
  environment: ServerEnvironment = process.env,
): boolean {
  const credentials = getSupportCredentials(environment);
  return id === credentials.id && password === credentials.password;
}
