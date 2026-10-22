const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
function declaration(file, name) {
    const source = fs.readFileSync(path.join(root, "src/scripts/app", file + ".js"), "utf8");
    const start = new RegExp(`(?:async )?function ${name}\\(`).exec(source)?.index;
    assert.notEqual(start, undefined, name);
    let candidate = "";
    for (const line of source.slice(start).split("\n")) {
        candidate += line + "\n";
        try { new vm.Script(candidate); return candidate; }
        catch (error) { if (!(error instanceof SyntaxError)) throw error; }
    }

    throw new Error(`Unterminated ${name}`);
}
async function fixture(backgroundAt = []) {
    const expected = Array.from({length:1002}, (_,index) => ({
        id:index+1, title:`Retention smoke ${index+1}`, detail:`retained entry ${index+1}`,
        logType:"system", logLevel:"message", retentionSmoke:true, at:"2026-01-01T00:00:00.000Z"
    }));
    let entries = structuredClone(expected);
    const context = vm.createContext({
        Blob, DEV_TRACE_LIMIT:1000, app:{devTrace:[]},
        devAssert:(condition,label,details)=>assert(condition, label+" "+JSON.stringify(details)),
        devTraceArchiveChunks:async()=>{
            const chunks=[];
            for(let offset=0;offset<entries.length;offset+=20)
                chunks.push({entries:structuredClone(entries.slice(offset,offset+20))});

            return chunks;
        }
    });
    const formatters = ["workerDevTraceTextValue","workerIndentDevTraceText","workerFormatDevTraceValue","workerExactDevTraceCopyBlock","workerFormatDevTraceEntry","buildDevTraceArchiveExport"];
    const uiFormatters=["devTraceTextValue","indentDevTraceText","formatDevTraceValue","exactDevTraceCopyBlock","formatDevTraceEntry"];
    vm.runInContext(formatters.map(name=>declaration("00-bootstrap-storage",name)).join("\n")+
        uiFormatters.map(name=>declaration("04-story-runtime",name)).join("\n")+
        declaration("20-smokes-performance","devAssertRetentionArchiveSnapshots"),context);
    const addBackground = stage => {
        if(backgroundAt.includes(stage))
            entries.push({id:entries.length+1,title:"Browser long-animation-frame burst",detail:{count:1},logType:"performance"});
    };
    addBackground("read");
    const archived = structuredClone(entries);
    addBackground("stats");
    const stats = {entryCount:entries.length,chunkCount:Math.ceil(entries.length/20)};
    addBackground("text");
    const textExport = await context.buildDevTraceArchiveExport("retention-fixture",false);
    addBackground("blob");
    const blobExport = await context.buildDevTraceArchiveExport("retention-fixture",true);
    addBackground("after-export");
    context.app.devTrace=structuredClone(entries.slice(-1000));
    return {context,expected,archived,stats,textExport,blobExport,blobText:await blobExport.blob.text()};
}
function verify(value) {
    value.context.devAssertRetentionArchiveSnapshots(value.expected,value.archived,value.stats,value.textExport,value.blobExport,value.blobText);
}
test("retention checks accept an archive containing only the complete synthetic fixture",async()=>{
    verify(await fixture());
});
test("the reported background performance entry is retained without making smoke 98 fail",async()=>{
    const value=await fixture(["read"]);
    assert.equal(value.archived.length,1003);
    assert.equal(value.stats.entryCount,1003);
    assert.equal(value.context.app.devTrace[0].id,4);
    verify(value);
});
test("independent asynchronous snapshots may each gain background logs while retaining every earlier entry",async()=>{
    verify(await fixture(["read","stats","text","blob","after-export"]));
});
test("genuine missing, reordered, duplicated, or corrupted fixture records still fail",async()=>{
    for(const damage of [
        value=>value.archived.shift(),
        value=>value.archived.splice(500,1),
        value=>value.archived.splice(1001,1),
        value=>value.archived.splice(500,0,value.archived[499]),
        value=>{value.archived[500].detail="Corrupted stored detail";},
        value=>{[value.archived[500],value.archived[501]]=[value.archived[501],value.archived[500]];}
    ]) {
        const value=await fixture(["read","text","blob"]);
        damage(value);
        assert.throws(()=>verify(value),/worker Dev Log archive retains/);
    }
});
test("missing text/blob export entries, corrupted exported content, and inconsistent counts still fail",async()=>{
    for(const damage of [
        value=>{value.textExport.text=value.textExport.text.replace("===== #501 Retention smoke 501 =====","Removed entry");},
        value=>{value.blobText=value.blobText.replace("retained entry 501","Corrupted export detail");},
        value=>{value.textExport.text=value.textExport.text.replace("detail: retained entry 50\n","detail: corrupted\n");},
        value=>{value.blobText=value.blobText.replace("===== #501 Retention smoke 501 =====","Removed entry");},
        value=>{value.stats.entryCount=1001;},
        value=>{value.textExport.entryCount--;},
        value=>{value.blobExport.entryCount--;},
        value=>{value.context.app.devTrace.unshift(value.expected[0]);}
    ]) {
        const value=await fixture(["read","text","blob"]);
        damage(value);
        assert.throws(()=>verify(value),/worker Dev Log archive retains/);
    }
});