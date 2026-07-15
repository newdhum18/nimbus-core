import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { MIGRATIONS } from "../src/db/migration-catalog.js";
import { promoteQualifiedCandidates } from "../src/sources/discovery.js";

function d1(db) {
  return {
    prepare(sql) {
      let values=[];
      return {
        bind(...args){ values=args; return this; },
        async first(){ return db.prepare(sql).get(...values) ?? null; },
        async all(){ return { results: db.prepare(sql).all(...values) }; },
        async run(){ const r=db.prepare(sql).run(...values); return { meta:{changes:Number(r.changes||0)}, changes:Number(r.changes||0) }; }
      };
    }
  };
}

async function migratedDb(){
  const db=new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  for(const m of MIGRATIONS){
    db.exec(await readFile(m.file,"utf8"));
    db.prepare(`INSERT OR IGNORE INTO schema_migrations(version,name,checksum,applied_at) VALUES(?,?,?,?)`).run(m.version,m.name,m.checksum,new Date().toISOString());
  }
  return db;
}

test("qualified discovery domain is promoted into an executable source", async()=>{
  const db=await migratedDb();
  const now=new Date().toISOString();
  db.prepare(`INSERT INTO source_candidate_domains(host,root_url,state,family,quality_grade,evidence_count,pages_tested,extracted_links,novel_links,alive_links,dead_links,unknown_links,duplicate_links,successful_fetches,failed_fetches,blocked_fetches,average_latency,confidence,first_seen_at,last_seen_at,last_tested_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run('fresh.example','https://fresh.example/','candidate','web','C',2,3,4,2,1,0,1,0,2,0,0,120,18,now,now,now);
  db.prepare(`INSERT INTO source_candidates(id,normalized_url,host,evidence_count,mega_links_found,successful_fetches,failed_fetches,confidence,state,first_seen_at,last_seen_at,pages_tested,novel_links_found,alive_links_found,duplicate_links_found,average_latency,quality_grade,family) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run('candidate_test','https://fresh.example/post','fresh.example',1,4,1,0,18,'candidate',now,now,3,2,1,0,120,'C','web');
  const result=await promoteQualifiedCandidates(d1(db),{limit:5});
  assert.equal(result.promoted,1);
  assert.equal(result.activated,1);
  const source=db.prepare(`SELECT * FROM sources WHERE name=?`).get('Discovered — fresh.example');
  assert.ok(source);
  assert.equal(source.source_type,'html');
  assert.equal(source.enabled,1);
  assert.match(source.template_url,/site%3Afresh\.example/);
  assert.ok(db.prepare(`SELECT 1 FROM source_metrics WHERE source_id=?`).get(source.id));
  assert.equal(db.prepare(`SELECT state FROM source_candidate_domains WHERE host='fresh.example'`).get().state,'promoted');
  assert.equal(db.prepare(`SELECT state FROM source_candidates WHERE host='fresh.example'`).get().state,'promoted');
  db.close();
});

test("reachable zero-yield domain is retained as disabled sandbox source", async()=>{
  const db=await migratedDb();
  const now=new Date().toISOString();
  db.prepare(`INSERT INTO source_candidate_domains(host,root_url,state,family,quality_grade,evidence_count,pages_tested,extracted_links,novel_links,alive_links,dead_links,unknown_links,duplicate_links,successful_fetches,failed_fetches,blocked_fetches,average_latency,confidence,first_seen_at,last_seen_at,last_tested_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run('sandbox.example','https://sandbox.example/','candidate','web','D',1,1,0,0,0,0,0,0,1,0,0,90,2,now,now,now);
  const result=await promoteQualifiedCandidates(d1(db),{limit:5});
  assert.equal(result.promoted,0);
  assert.equal(result.sandboxed,1);
  const source=db.prepare(`SELECT * FROM sources WHERE name=?`).get('Discovered — sandbox.example');
  assert.ok(source);
  assert.equal(source.enabled,0);
  assert.equal(db.prepare(`SELECT state FROM source_candidate_domains WHERE host='sandbox.example'`).get().state,'sandbox');
  db.close();
});

test("promotion count includes an existing source refreshed from a candidate domain", async()=>{
  const db=await migratedDb();
  const now=new Date().toISOString();
  db.prepare(`INSERT INTO sources(id,name,category,source_type,template_url,enabled,default_enabled,priority,rank_score,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .run('discovered_existing','Discovered — existing.example','web','html','https://lite.duckduckgo.com/lite/?q=site%3Aexisting.example%20{q}%20%22mega.nz%2Ffolder%22',0,0,100,1,now,now);
  db.prepare(`INSERT INTO source_candidate_domains(host,root_url,state,family,quality_grade,evidence_count,pages_tested,extracted_links,novel_links,alive_links,dead_links,unknown_links,duplicate_links,successful_fetches,failed_fetches,blocked_fetches,average_latency,confidence,first_seen_at,last_seen_at,last_tested_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run('existing.example','https://existing.example/','candidate','web','C',2,2,3,1,0,0,0,0,2,0,0,100,12,now,now,now);
  const result=await promoteQualifiedCandidates(d1(db),{limit:5});
  assert.equal(result.promoted,1);
  assert.equal(result.created,0);
  assert.equal(result.updated,1);
  assert.equal(db.prepare(`SELECT state FROM source_candidate_domains WHERE host='existing.example'`).get().state,'promoted');
  db.close();
});

test("arbitrary extracted links do not auto-enable a zero-yield source", async()=>{
  const db=await migratedDb();
  const now=new Date().toISOString();
  db.prepare(`INSERT INTO source_candidate_domains(host,root_url,state,family,quality_grade,evidence_count,pages_tested,extracted_links,novel_links,alive_links,dead_links,unknown_links,duplicate_links,successful_fetches,failed_fetches,blocked_fetches,average_latency,confidence,first_seen_at,last_seen_at,last_tested_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run('noise.example','https://noise.example/','candidate','web','C',1,1,50,0,0,0,0,0,1,0,0,80,10,now,now,now);
  const result=await promoteQualifiedCandidates(d1(db),{limit:5});
  assert.equal(result.promoted,0);
  assert.equal(result.sandboxed,1);
  const source=db.prepare(`SELECT enabled FROM sources WHERE name='Discovered — noise.example'`).get();
  assert.equal(source.enabled,0);
  db.close();
});
