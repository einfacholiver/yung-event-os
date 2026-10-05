console.error(
  "YUNG production data is not deployed to branch or pull-request previews. Use a separate test database and OAuth configuration for previews.",
);
process.exitCode = 1;
