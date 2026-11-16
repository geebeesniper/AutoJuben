import { pingDatabase } from '../repositories/health.repository.js';
export async function checkDatabase(){await pingDatabase();}
