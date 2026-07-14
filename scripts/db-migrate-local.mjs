import { DatabaseSync } from 'node:sqlite';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { MIGRATIONS } from '../src/db/migration-catalog.js';
const args=new Set(process.argv.slice(2));
const dbArg=process.argv.find(x=>x.startsWith('--database='));
const dbPath=dbArg?.slice('--database='.length)||'.wrangler/state/v3/d1/miniflare-D1DatabaseObject/local.sqlite';
const dry=args.has('--dry-run');
await mkdir(dirname(dbPath),{recursive:true});
const db=new DatabaseSync(dbPath); db.exec('PRAGMA foreign_keys=ON');
db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE,checksum TEXT NOT NULL,applied_at TEXT NOT NULL)`);
const applied=new Map(db.prepare('SELECT version,name,checksum FROM schema_migrations').all().map(r=>[Number(r.version),r]));
const pending=[];
for(const m of MIGRATIONS){
 const bytes=await readFile(m.file); const actual=createHash('sha256').update(bytes).digest('hex');
 if(actual!==m.checksum) throw new Error(`Checksum mismatch for ${m.file}`);
 const row=applied.get(m.version);
 if(row){if(row.name!==m.name||row.checksum!==m.checksum) throw new Error(`Applied migration integrity mismatch at ${m.version}`); continue;}
 pending.push(m);
}
console.log(JSON.stringify({database:dbPath,dry_run:dry,pending:pending.map(m=>m.file)},null,2));
if(!dry){
 for(const m of pending){
  const sql=await readFile(m.file,'utf8');
  db.exec('BEGIN IMMEDIATE');
  try{db.exec(sql); db.prepare('INSERT INTO schema_migrations(version,name,checksum,applied_at) VALUES(?,?,?,?)').run(m.version,m.name,m.checksum,new Date().toISOString()); db.exec('COMMIT');}
  catch(e){db.exec('ROLLBACK'); throw e;}
 }
}
db.close();
