import express, { Request, Response } from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface UserGrowthRow {
  registration_day: string;
  user_count: number;
}

const dbPath = '/home/medsky/labels.db';

function getUniqueUserGrowth(dbPath: string): { date: string; userCount: number }[] {
  const db = new Database(dbPath, { readonly: true });
  try {
    const query = `
      SELECT
          DATE(first_date) AS registration_day,
          COUNT(uri) AS user_count
      FROM (
          SELECT
              uri,
              MIN(DATE(cts)) AS first_date
          FROM
              labels
          GROUP BY
              uri
      ) AS first_occurrences
      GROUP BY
          registration_day
      ORDER BY
          registration_day;
    `;

    const rows = db.prepare(query).all() as UserGrowthRow[];;
    return rows.map(row => ({ date: row.registration_day, userCount: row.user_count }));
  } finally {
    db.close();
  }
}

function getUniqueURICount(dbPath: string): number {
  const db = new Database(dbPath, { readonly: true });
  try {
    const row: { count: number } = db.prepare('SELECT COUNT(DISTINCT uri) AS count FROM labels').get() as { count: number };
    return row.count;
  } finally {
    db.close();
  }
}

const app = express();

app.get('/metrics', (req: Request, res: Response) => {
  try {
    const count = getUniqueURICount(dbPath);
    res.send(`Number of unique users in the Medsky database: ${count}`);
  } catch (err) {
    console.error('Error querying the Medsky database:', err);
    res.status(500).send('Error querying the Medsky database');
  }
});

app.get('/user-growth', (req: Request, res: Response) => {
  try {
    const userGrowthData = getUniqueUserGrowth(dbPath);
    res.json(userGrowthData);
  } catch (err) {
    console.error('Error querying user growth data:', err);
    res.status(500).send('Error querying user growth data');
  }
});

app.use('/growth', express.static(path.join(__dirname, '../public')));

app.listen(4000, () => {
  console.log('Metrics running on port 4000!');
});
