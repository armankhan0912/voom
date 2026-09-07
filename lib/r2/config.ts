function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
}

export function getR2Config() {
  const accountId = requiredEnv("R2_ACCOUNT_ID");

  return {
    accountId,
    bucket: requiredEnv("R2_BUCKET"),
    accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  };
}
