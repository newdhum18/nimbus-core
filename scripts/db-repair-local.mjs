import { DatabaseSync } from 'node:sqlite';
const dbArg=process.argv.find(x=>x.startsWith('--database=')); if(!dbArg) throw new Error('--database=<path> required');
const db=new DatabaseSync(dbArg.slice(11)); const now=new Date().toISOString();
db.exec('PRAGMA foreign_keys=ON');
const result=db.prepare("UPDATE run_tasks SET status='pending',lease_until=NULL,updated_at=? WHERE status='running' AND lease_until IS NOT NULL AND lease_until < ?").run(now,now);
db.prepare("INSERT INTO settings(key,value,updated_at) VALUES('last_repair_at',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").run(now,now);
console.log(JSON.stringify({ok:true,tasks_recovered:Number(result.changes),completed_at:now},null,2)); db.close();
