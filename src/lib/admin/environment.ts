export function getAppEnvironment(): string {
  return (process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? "production").toLowerCase();
}

export function isDevelopmentEnvironment(): boolean {
  return getAppEnvironment() === "development";
}
