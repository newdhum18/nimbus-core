import test from "node:test";
import assert from "node:assert/strict";
import { sourceSelectionsForRun } from "../src/runs/start.js";

test("manual mode uses only enabled sources for every round",()=>{
 const rows=[{id:"on",enabled:1},{id:"off",enabled:0,intelligence_state:"explore"}];
 const selections=sourceSelectionsForRun(rows,{mode:"autoscan",rounds:3,controlMode:"manual"});
 assert.equal(selections.length,3);
 for(const round of selections) assert.deepEqual(round.map(x=>x.id),["on"]);
});

test("automatic mode may explore disabled sources after first autoscan round",()=>{
 const rows=[{id:"on",enabled:1},{id:"off",enabled:0,intelligence_state:"explore"}];
 const selections=sourceSelectionsForRun(rows,{mode:"autoscan",rounds:2,controlMode:"automatic"});
 assert.deepEqual(selections[0].map(x=>x.id),["on"]);
 assert.ok(selections[1].some(x=>x.id==="off"));
});
