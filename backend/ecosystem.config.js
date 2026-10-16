module.exports = {
  apps: [
    {
      name: "mini-learning-api",
      script: "./dist/server.js", // Points to the compiled TypeScript
      instances: "max", // Uses all available CPU cores
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
