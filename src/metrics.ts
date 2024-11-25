import express, { Request, Response } from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface UserGrowthHourly {
  registration_hour: string;
  user_count: number;
}

interface UserGrowthDaily {
  registration_day: string;
  user_count: number;
}

const dbPath = '/home/medsky/labels.db';

function getCombinedUserGrowthData(dbPath: string): {
  hourly: { datetime: string; userCount: number }[];
  daily: { date: string; userCount: number }[];
} {
  const db = new Database(dbPath, { readonly: true });
  try {
    const hourlyQuery = `
      SELECT
          STRFTIME('%Y-%m-%d %H:00:00', first_date) AS registration_hour,
          COUNT(uri) AS user_count
      FROM (
          SELECT
              uri,
              MIN(DATETIME(cts)) AS first_date
          FROM
              labels
          GROUP BY
              uri
      ) AS first_occurrences
      GROUP BY
          registration_hour
      ORDER BY
          registration_hour;
    `;

    const dailyQuery = `
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

    const hourlyData = db.prepare(hourlyQuery).all() as UserGrowthHourly[];
    const hourlyMap = hourlyData.map(row => ({
      datetime: row.registration_hour,
      userCount: row.user_count,
    }));

    const dailyData = db.prepare(dailyQuery).all() as UserGrowthDaily[];
    const dailyMap = dailyData.map(row => ({
      date: row.registration_day,
      userCount: row.user_count,
    }));

    return { hourly: hourlyMap, daily: dailyMap };
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

app.get('/unique', (req: Request, res: Response) => {
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
    const userGrowthData = getCombinedUserGrowthData(dbPath);
    res.json(userGrowthData);
  } catch (err) {
    console.error('Error querying user growth data:', err);
    res.status(500).send('Error querying user growth data');
  }
});

app.use('/metrics', express.static(path.join(__dirname, '../public')));

app.listen(4000, () => {
  console.log('Metrics running on port 4000!');
});
