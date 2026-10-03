const fs = require("fs");
const path = require("path");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const frontendDir = __dirname;
const rootDir = path.dirname(frontendDir);
const publicDir = path.join(frontendDir, "public");

copyDir(
  path.join(rootDir, "resources"),
  path.join(publicDir, "assets", "resources"),
);
copyDir(
  path.join(rootDir, "resources", "icons", "ui"),
  path.join(publicDir, "assets", "icons"),
);
copyDir(
  path.join(rootDir, "resources", "icons", "material"),
  path.join(publicDir, "assets", "icons", "material"),
);
copyDir(
  path.join(rootDir, "codecontext_core", "pkg"),
  path.join(publicDir, "assets", "wasm"),
);
