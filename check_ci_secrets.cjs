
const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            if (f !== 'node_modules' && f !== 'dist' && f !== '.git') {
                walkDir(dirPath, callback);
            }
        } else {
            callback(path.join(dir, f));
        }
    });
}

const privateKeyRegex = /privateKey.*=.*['"]/;
const secretKeyRegex = /secretKey.*=.*['"]/;
let foundError = false;

walkDir('.', (filePath) => {
    if (['.ts', '.js', '.mjs'].includes(path.extname(filePath))) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            if (privateKeyRegex.test(line)) {
                console.log(`\n❌ MATCH in ${filePath}:${index + 1}`);
                console.log(`   Line: ${line.trim()}`);
                console.log(`   Regex: /privateKey.*=.*['"]/`);
                foundError = true;
            }
            if (secretKeyRegex.test(line)) {
                console.log(`\n❌ MATCH in ${filePath}:${index + 1}`);
                console.log(`   Line: ${line.trim()}`);
                console.log(`   Regex: /secretKey.*=.*['"]/`);
                foundError = true;
            }
        });
    }
});

if (foundError) {
    console.log("\n❌ CI Secret Check: FAILED");
    process.exit(1);
} else {
    console.log("\n✅ CI Secret Check: PASSED");
    process.exit(0);
}
