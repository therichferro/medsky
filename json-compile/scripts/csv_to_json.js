import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Update the path if needed
const csvPath = path.join(__dirname, '../data/medsky-labelsheet.csv');
const jsonPath = path.join(__dirname, '../data/medsky-labels.json');

const csvText = fs.readFileSync(csvPath, 'utf8');
const records = parse(csvText, { skip_empty_lines: true });

// Each row: [id, en_lang, en_name, en_desc, es_lang, es_name, es_desc, pt_lang, pt_name, pt_desc, inform, FALSE, warn]
const resultArray = [];

for (const row of records) {
  // Skip empty or comment lines
  if (!row[0] || row[0].startsWith('#')) continue;

  resultArray.push({
    identifier: row[0],
    locales: [
      {
        lang: "en",
        name: row[2],
        description: row[3]
      },
      {
        lang: "es",
        name: row[5],
        description: row[6]
      },
      {
        lang: "pt",
        name: row[8],
        description: row[9]
      }
    ]
  });
}

fs.writeFileSync(jsonPath, JSON.stringify(resultArray, null, 2), 'utf8');
console.log(`Saved JSON to ${jsonPath}`);