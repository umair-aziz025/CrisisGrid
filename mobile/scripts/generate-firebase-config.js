/**
 * Generate google-services.json from GOOGLE_SERVICES_JSON env var.
 * Run this before building the Android app.
 */
const fs = require('fs');
const path = require('path');

const envJson = process.env.GOOGLE_SERVICES_JSON;
if (!envJson) {
  console.error('ERROR: GOOGLE_SERVICES_JSON env var is not set!');
  console.error('Paste your google-services.json content into this env var.');
  process.exit(1);
}

const outputPath = path.join(__dirname, '..', 'android', 'app', 'google-services.json');

try {
  // Validate it's valid JSON
  const parsed = JSON.parse(envJson);
  fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2));
  console.log('✅ google-services.json generated at:', outputPath);
} catch (e) {
  console.error('ERROR: GOOGLE_SERVICES_JSON is not valid JSON:', e.message);
  process.exit(1);
}
