const {spawn}=require("child_process"); const fs=require("fs"); const path=require("path");
const [cmd,...args]=process.argv.slice(2); const file=path.resolve(process.env.FILE); const uri="file://"+file;
const p=spawn(cmd,args,{cwd:process.cwd()}); let buf=Buffer.alloc(0), id=1; const pend={};
const send=(m)=>{const s=JSON.stringify({jsonrpc:"2.0",...m});p.stdin.write(`Content-Length: ${Buffer.byteLength(s)}\r\n\r\n${s}`)};
const req=(method,params)=>new Promise(r=>{const i=id++;pend[i]=r;send({id:i,method,params})});
p.stdout.on("data",d=>{buf=Buffer.concat([buf,d]);for(;;){const h=buf.indexOf("\r\n\r\n");if(h<0)break;const len=+/Content-Length: (\d+)/.exec(buf.slice(0,h))[1];if(buf.length<h+4+len)break;const m=JSON.parse(buf.slice(h+4,h+4+len));buf=buf.slice(h+4+len);
 if(m.id&&pend[m.id]){pend[m.id](m);delete pend[m.id]}else if(m.method==="textDocument/publishDiagnostics"&&m.params.uri===uri){console.log("PUSH:",JSON.stringify(m.params.diagnostics.map(d=>d.message)).slice(0,200))}else if(m.id&&m.method){send({id:m.id,result:null})}}});
(async()=>{const init=await req("initialize",{processId:process.pid,rootUri:"file://"+process.cwd(),workspaceFolders:[{uri:"file://"+process.cwd(),name:"w"}],capabilities:{textDocument:{publishDiagnostics:{},diagnostic:{dynamicRegistration:false}}}});
 const caps=init.result.capabilities; console.log("diagnosticProvider:",JSON.stringify(caps.diagnosticProvider||null));
 send({method:"initialized",params:{}}); send({method:"textDocument/didOpen",params:{textDocument:{uri,languageId:process.env.LANG_ID,version:1,text:fs.readFileSync(file,"utf8")}}});
 for(const t of [20,40,70]){await new Promise(r=>setTimeout(r,t*1000-(t===20?0:t===40?20000:40000)));
  if(caps.diagnosticProvider){const r=await req("textDocument/diagnostic",{textDocument:{uri}});console.log(`PULL@${t}s:`,JSON.stringify((r.result&&r.result.items||[]).map(d=>d.message)).slice(0,200))}}
 p.kill();process.exit(0)})();
setTimeout(()=>{console.log("timeout");process.exit(1)},150000);
