import test from "node:test";
import assert from "node:assert/strict";
import { KEYWORD_CATEGORIES, extractLearnableTerms, inferCategory, safeKeyword } from "../src/search/keyword-intelligence.js";
import { buildAdaptiveQueries } from "../src/search/keyword.js";

test("keyword categories include requested discovery groups",()=>{for(const k of ["games","series","tools","sports","adult"])assert.ok(KEYWORD_CATEGORIES[k]?.length);});
test("minor-related adult terms are blocked",()=>{assert.throws(()=>safeKeyword("underage collection"),/minors/i);});
test("category inference and title learning are deterministic",()=>{assert.equal(inferCategory("complete season collection"),"series");assert.ok(extractLearnableTerms("Python Developer Tools Mega Folder").includes("Python"));});
test("adaptive keyword rounds generate distinct queries",async()=>{const db={prepare(){return{bind(){return{all:async()=>({results:[]})}}}}};const q=await buildAdaptiveQueries(db,{category:"games",rounds:10,seed:"test"});assert.equal(q.length,10);assert.ok(new Set(q).size>=8);});

test("adaptive category search produces exactly 100 valid unique queries",async()=>{
  const db={prepare(){return{bind(){return{all:async()=>({results:[]})}}}}};
  const queries=await buildAdaptiveQueries(db,{category:"games",rounds:100,seed:"category-100"});
  assert.equal(queries.length,100);
  assert.equal(new Set(queries.map(q=>q.toLowerCase())).size,100);
  assert.ok(queries.every(q=>typeof q==="string"&&q.trim()&&!q.includes("undefined")));
});

test("manual keyword expansion produces the requested number without early repetition",async()=>{
  const db={prepare(){return{bind(){return{all:async()=>({results:[]})}}}}};
  for(const rounds of [1,10,25,100]){
    const queries=await buildAdaptiveQueries(db,{keyword:"Photoshop",category:"tools",rounds,seed:`manual-${rounds}`});
    assert.equal(queries.length,rounds);
    assert.equal(new Set(queries.map(q=>q.toLowerCase())).size,rounds);
    assert.ok(queries.every(q=>q.trim()&&!q.includes("undefined")));
  }
});
