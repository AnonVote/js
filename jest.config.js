/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.ts"],
  collectCoverageFrom: ["src/**/*.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          types: ["node", "jest"],
        },
      },
    ],
  },
};
