const fs = require("fs");
const path = require("path");

const targetDir = path.join(__dirname, "node_modules", "@chainlink", "contracts-ccip");

function patchSolidityFiles(dir) {
  if (!fs.existsSync(dir)) {
    console.warn(`Directory not found: ${dir}`);
    return;
  }

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      patchSolidityFiles(filePath);
    } else if (filePath.endsWith(".sol")) {
      let content = fs.readFileSync(filePath, "utf8");
      let modified = false;

      // Replace OpenZeppelin versioned paths with standard paths
      if (content.includes("@openzeppelin/contracts@5.0.2/")) {
        content = content.replace(/@openzeppelin\/contracts@5\.0\.2\//g, "@openzeppelin/contracts/");
        modified = true;
      }
      if (content.includes("@openzeppelin/contracts@4.8.3/")) {
        content = content.replace(/@openzeppelin\/contracts@4\.8\.3\//g, "@openzeppelin/contracts/");
        modified = true;
      }
      if (content.includes("@openzeppelin/contracts-5.0.2/")) {
        content = content.replace(/@openzeppelin\/contracts-5\.0\.2\//g, "@openzeppelin/contracts/");
        modified = true;
      }
      if (content.includes("@openzeppelin/contracts-4.8.3/")) {
        content = content.replace(/@openzeppelin\/contracts-4\.8\.3\//g, "@openzeppelin/contracts/");
        modified = true;
      }

      if (modified) {
        fs.writeFileSync(filePath, content, "utf8");
        console.log(`Patched: ${path.relative(targetDir, filePath)}`);
      }
    }
  }
}

console.log("Patching OpenZeppelin imports in @chainlink/contracts-ccip...");
patchSolidityFiles(targetDir);
console.log("Import patching complete!");
