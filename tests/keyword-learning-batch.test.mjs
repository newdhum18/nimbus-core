import test from "node:test";
import assert from "node:assert/strict";
import { learnSearchTerms } from "../src/search/keyword-intelligence.js";

test("keyword learning is capped and written in one D1 batch", async()=>{
  const statements=[];
  let batchCalls=0;
  const db={
    prepare(sql){
      return {bind(...args){const stmt={sql,args};statements.push(stmt);return stmt;}};
    },
    async batch(rows){batchCalls+=1;assert.equal(rows.length,statements.length);return rows.map(()=>({success:true}));}
  };
  const count=await learnSearchTerms(db,"Photoshop developer tools portable apps software archive complete bundle resources public mirror database repository updated latest english",3);
  assert.equal(batchCalls,1);
  assert.ok(count>0&&count<=12);
  assert.equal(statements.length,count);
});
