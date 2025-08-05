import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync'; // <-- the correct import for ES modules

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = path.join(__dirname, '../data/medsky-labelsheet.csv');
const jsonPath = path.join(__dirname, '../data/medsky-labels.json');

const csvText = fs.readFileSync(csvPath, 'utf8');
const records = parse(csvText, { skip_empty_lines: true });

function parseBool(val) {
  return String(val).trim().toUpperCase() === "TRUE";
}

const labelValues = [];
const labelValueDefinitions = [];

records.forEach(row => {
  if (!row || row[0].startsWith('#')) return;
  const identifier = row[0];
  labelValues.push(identifier);

  const locales = [
    { lang: "en", name: row[1], description: row[2] },
    { lang: "es", name: row[3], description: row[4] },
    { lang: "pt", name: row[5], description: row[6] }
  ];
  labelValueDefinitions.push({
    blurs: "none",
    locales,
    severity: row[7],
    adultOnly: parseBool(row[8]),
    identifier,
    defaultSetting: row[9]
  });
});

const result = {
  policies: {
    labelValues,
    labelValueDefinitions
  }
};

fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf8');
console.log(`Saved JSON to ${jsonPath}`);