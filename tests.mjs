import fs from 'node:fs';
import {sourceCatalog,extractMega,discoverTargets,normalizeUrl,queryFor,classifyResponse,buildMultiInsert,requireAdmin} from './_worker.js';
const worker=fs.readFileSync('_worker.js','utf8'),config=fs.readFileSync('wrangler.queue.jsonc','utf8'),app=fs.readFileSync('app.js','utf8');
const catalog=sourceCatalog();
const req=(token='')=>({headers:new Headers(token?{'x-nimbus-token':token}:{})});
const tests=[
['version',worker.includes('35.2.2-npm-install-fixed')],['catalog 300',catalog.length===300],['enabled 80',catalog.filter(x=>x.enabled).length===80],['unique ids',new Set(catalog.map(x=>x.id)).size===300],
['folder extraction',extractMega('https://mega.nz/folder/abcdEF12#abcdefghijklmnop').length===1],['reject file',extractMega('https://mega.nz/file/abcd#abcdefghijklmnop').length===0],['reject missing key',extractMega('https://mega.nz/folder/abcdEF12').length===0],
['normalize',normalizeUrl('https://example.com/a#x')==='https://example.com/a'],['discover',discoverTargets('<a href="https://example.com/page">x</a>','https://search.test').includes('https://example.com/page')],['query',queryFor('ubuntu','search').includes('ubuntu')],
['classify ok',classifyResponse({ok:true,status:200,text:'hello'}).ok],['classify captcha',classifyResponse({ok:true,status:200,text:'verify you are human'}).blocked],['classify 503',classifyResponse({ok:false,status:503,text:''}).retryable],
['multi insert rows',buildMultiInsert('x',['a','b'],[[1,2],[3,4]]).params.length===4],['auth disabled',requireAdmin(req(),{})],['auth enabled reject',!requireAdmin(req(),{ADMIN_TOKEN:'secret'})],['auth enabled accept',requireAdmin(req('secret'),{ADMIN_TOKEN:'secret'})],
['queue handler',worker.includes('queue:queueHandler')],['cron handler',worker.includes('scheduled:scheduledHandler')],['no cpu limits',!config.includes('cpu_ms')&&!config.includes('subrequests')],['batch one',config.includes('"max_batch_size": 1')],['concurrency one',config.includes('"max_concurrency": 1')],
['pause after fetch',worker.includes('paused_after_fetch')],['source pagination',worker.includes("url.pathname==='/api/sources'")&&app.includes('sourcePages')],['metrics blocked',worker.includes('consecutive_failures')&&worker.includes('cooldown_until')],['archive export',worker.includes("url.pathname==='/api/export'")],['extract api',worker.includes("url.pathname==='/api/extract'")]
];
for(const [name,ok] of tests){if(!ok)throw new Error(`FAILED: ${name}`);console.log(`PASS: ${name}`)}
console.log(JSON.stringify({ok:true,tests:tests.length,catalog:catalog.length,enabled:catalog.filter(x=>x.enabled).length,version:'35.2.2-npm-install-fixed'}));
