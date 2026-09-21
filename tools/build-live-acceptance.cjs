const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const acceptance=`<script>
(async()=>{
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 while(!globalThis.EmberAdventures?.isReady?.()) await wait(100);
 await wait(5000);
 const output=document.createElement('pre');
 output.id='lite-live-acceptance';
 output.style='position:fixed;inset:30px 10px auto;z-index:2147483647;background:#112;color:white;padding:16px;white-space:pre-wrap;max-height:80vh;overflow:auto';
 document.body.append(output);
 const tests=[[48,'exact-objective-ai-timing-smoke'],[49,'real-perchance-streaming-regenerate-smoke'],[110,'real-perchance-image-generation-smoke']];
 for(const [number,id] of tests){
  output.textContent+='Smoke '+number+': running\\n';
  await EmberAdventures.runDevSmokeScenarioById(id);
  while(EmberAdventures.getDevSmokeSuiteState().running) await wait(500);
  const result=EmberAdventures.getDevSmokeSuiteState().results[0];
  output.textContent+='Smoke '+number+': '+result.status+' '+(result.error||'')+'\\n';
 }
 output.textContent+='Live acceptance finished.';
})().catch(e=>{const p=document.createElement('pre');p.textContent='Acceptance error: '+e.stack;document.body.append(p);});
</script>`;
let html=fs.readFileSync(path.join(root,'bottom_compressed.private-tests.html'),'utf8');
html=html.replace('document.write(html);','document.write(html + '+JSON.stringify(acceptance).replace(/<\/script>/g,'<\\/script>')+');');
fs.writeFileSync(path.join(root,'test-output/perchance-acceptance.html'),html);
