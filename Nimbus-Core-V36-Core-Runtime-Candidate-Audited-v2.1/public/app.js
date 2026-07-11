const API="https://nimbus-core-v36-worker.newdhum18.workers.dev";
const status=document.querySelector("#status");
try{const response=await fetch(`${API}/health`);const data=await response.json();status.textContent=data.ok?`${data.service} — ${data.status}`:"Worker returned an invalid response";status.className=data.ok?"ok":"bad";}catch(error){status.textContent=`Worker unavailable: ${error.message}`;status.className="bad";}
