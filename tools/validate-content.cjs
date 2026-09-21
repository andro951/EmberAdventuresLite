const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(fs.readFileSync(path.join(root,'bottom.runtime-tests.html')));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${server.address().port}/`;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();
  await page.addInitScript({path:require.resolve('dexie/dist/dexie.min.js')});
  await page.route('**/*',r=>r.request().url().startsWith(url)||r.request().url().startsWith('blob:')?r.continue():r.abort());
  await page.goto(url);await page.waitForFunction(()=>globalThis.EmberAdventures?.isReady?.(),null,{timeout:45000});
  const results=[];
  for(const file of [...files(path.join(root,'characters')),...(process.argv.includes('--include-stories') ? files(path.join(root,'stories')) : []),...files(path.join(root,'docs/examples'))].filter(f=>f.endsWith('.json'))){
   const payload=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
   const kind=payload.storyTemplate?'validateStoryExport':'validateCharacterExport';
   const result=await page.evaluate(({payload,kind})=>EmberAdventuresDevPlaytest[kind](payload),{payload,kind});
   results.push({file:path.relative(root,file),...result});
  }
  fs.mkdirSync(path.join(root,'test-output'),{recursive:true});
  fs.writeFileSync(path.join(root,process.argv.includes('--include-stories') ? 'test-output/legacy-story-validation.json' : 'test-output/content-validation.json'),JSON.stringify(results,null,2));
  const failed=results.filter(r=>!r.ok);
  console.log(`Current content: ${results.length-failed.length}/${results.length} valid`);
  if(failed.length){console.log(JSON.stringify(failed.map(r=>({file:r.file,errors:r.errors.slice(0,3)})),null,2));process.exitCode=1;}
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
