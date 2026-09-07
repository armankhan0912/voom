function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
}

export function getS3Config() {
  return {
    region: requiredEnv("AWS_REGION"),
    bucket: requiredEnv("AWS_S3_BUCKET"),
    accessKeyId: requiredEnv("AWS_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("AWS_SECRET_ACCESS_KEY"),
  };
}
