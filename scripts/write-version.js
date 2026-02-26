const fs = require('node:fs');
const path = require('node:path');

const packageJsonPath = path.join(process.cwd(), 'package.json');
const publicDir = path.join(process.cwd(), 'public');
const versionFile = path.join(publicDir, 'version.json');

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const commitSha =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.COMMIT_SHA ||
  '';
const version = commitSha
  ? `${packageJson.version}-${commitSha.slice(0, 8)}`
  : `${packageJson.version}-${Date.now()}`;

const payload = {
  version,
  builtAt: new Date().toISOString(),
};

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(versionFile, JSON.stringify(payload, null, 2));
console.log(`Wrote ${versionFile} (${payload.version})`);
