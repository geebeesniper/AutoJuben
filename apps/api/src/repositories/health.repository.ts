import { query } from '../db/pool.js';
export async function pingDatabase(){await query('SELECT 1');}
