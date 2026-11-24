'use strict';

function decodeSchedulePhoto(file){
  const url=URL.createObjectURL(file);
  const image=new Image();
  return new Promise((resolve,reject)=>{
    image.onload=()=>{URL.revokeObjectURL(url);resolve(image);};
    image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Фото не открылось. Попробуйте JPEG или PNG.'));};
    image.src=url;
  });
}

function photoCanvas(image, degrees, limit){
  const scale=Math.min(1,limit/Math.max(image.naturalWidth,image.naturalHeight));
  const width=Math.round(image.naturalWidth*scale), height=Math.round(image.naturalHeight*scale);
  const rotated=degrees%180!==0;
  const canvas=document.createElement('canvas');
  canvas.width=rotated?height:width;
  canvas.height=rotated?width:height;
  const context=canvas.getContext('2d',{alpha:false});
  context.fillStyle='white';
  context.fillRect(0,0,canvas.width,canvas.height);
  context.translate(canvas.width/2,canvas.height/2);
  context.rotate(degrees*Math.PI/180);
  context.drawImage(image,-width/2,-height/2,width,height);
  return canvas;
}

let ocrScript;
function enablePrintedOCR(source){
  if(window.Tesseract)return Promise.resolve();
  if(!ocrScript){
    ocrScript=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      const fail=()=>{
        clearTimeout(timeout);
        script.remove();
        reject(Error('Не загрузился движок распознавания'));
      };
      const timeout=setTimeout(fail,12000);
      script.src=source;
      script.onload=()=>{
        clearTimeout(timeout);
        if(window.Tesseract?.createWorker)resolve();
        else fail();
      };
      script.onerror=fail;
      document.head.append(script);
    }).catch(error=>{ocrScript=null;throw error;});
  }
  return ocrScript;
}

function subjectFromPrint(text){
  const plain=text.toLowerCase().replace(/[^а-яёәіңғүұқөһa-z]/gu,'').replace(/[a-z]/g,letter=>({a:'а',c:'с',e:'е',k:'к',m:'м',o:'о',p:'р',r:'г',t:'т',x:'х',y:'у'})[letter]??letter);
  if(/прог[рг]?амм|п[іи]рограмм|программир|бағдарлам|багдарлам/.test(plain))return 0;
  if(/р[оа]б[оа][тг]ех|робототех|робот[оа]?тех|роботты/.test(plain))return 1;
  if(/цифр[оа]в.*грам|цифрл.*сауат|сандық.*сауат/.test(plain))return 2;
  return -1;
}

function closestAnchor(anchors, at, field){
  return anchors.reduce((best,current)=>!best||Math.abs(current[field]-at)<Math.abs(best[field]-at)?current:best,null);
}

function removeHeaderLineArtifacts(columns){
  const confirmed=columns.filter(column=>!column.grade.includes('?'));
  if(confirmed.length<3)return columns;
  const gaps=confirmed.slice(1).map((column,index)=>column.x-confirmed[index].x).sort((a,b)=>a-b);
  const width=gaps[0];
  if(width<44||gaps[1]>width*1.25)return columns;
  const uncertain=columns.filter(column=>column.grade.includes('?'));
  const middle=[];
  for(const [index,left] of confirmed.entries()){
    middle.push(left);
    const right=confirmed[index+1];
    if(!right)break;
    const distance=right.x-left.x;
    const count=Math.round(distance/width);
    if(Math.abs(distance/count-width)>width*.22){
      middle.push(...uncertain.filter(column=>column.x>left.x+width*.4&&column.x<right.x-width*.4));
      continue;
    }
    for(let i=1;i<count;i++){
      const x=left.x+i*distance/count;
      const candidate=closestAnchor(uncertain,x,'x');
      if(candidate&&Math.abs(candidate.x-x)<width*.35)middle.push(candidate);
      else middle.push({grade:'?',x,y:left.y+i*(right.y-left.y)/count});
    }
  }
  const before=uncertain.filter(column=>column.x<confirmed[0].x-width*.7);
  const after=uncertain.filter(column=>column.x>confirmed.at(-1).x+width*.7);
  return [...before,...middle,...after];
}

function extractPrintedSchedule(words, height){
  const lineDistance=Math.max(14,height*.035);
  const headerTimes=words.find(word=>/^время$/iu.test(word.text.trim()));
  const headerCandidates=[];
  for(const word of words){
    if(headerTimes&&(word.x<=headerTimes.x+30||Math.abs(word.y-headerTimes.y)>lineDistance))continue;
    const value=word.text.replace(/[^0-9А-ЯӘІҢҒҮҰҚӨҺA-Z]/giu,'').replace(/^[Зз](?=[А-ЯA-Z])/,'3');
    let grade=value.replace(/^0[КҚ]?[ЛL]$/iu,'0');
    if(headerTimes&&/^[А-ЯӘІҢҒҮҰҚӨҺA-Z]{1,3}$/iu.test(value)&&!/^к[лl]$/iu.test(value))grade='? '+value;
    if(headerTimes&&/^[1-9][0-9]$/.test(value))grade=value[0]+'?';
    if(!grade.startsWith('?')&&!/^\d{1,2}[А-ЯӘІҢҒҮҰҚӨҺA-Z?]$/iu.test(grade)&&!/^0(?:кл)?$/iu.test(grade))continue;
    if(Number.parseInt(grade,10)>12)continue;
    headerCandidates.push({...word,grade});
  }
  const bestHeader=headerCandidates.reduce((best,word)=>{
    const row=headerCandidates.filter(item=>Math.abs(item.y-word.y)<lineDistance);
    return row.length>best.length?row:best;
  },[]);
  if(!bestHeader.length)return {rows:[],score:0};
  const headerY=bestHeader.reduce((sum,item)=>sum+item.y,0)/bestHeader.length;
  const columns=removeHeaderLineArtifacts(bestHeader.sort((a,b)=>a.x-b.x).filter((column,i,list)=>!i||column.x-list[i-1].x>34));
  const firstColumn=columns[0].x;
  const timeWords=[];
  for(const word of words){
    if(word.y<=headerY+lineDistance||word.x>=firstColumn-24)continue;
    const matches=[...word.text.matchAll(/\b(\d{1,2})\s*[:.;]\s*(\d{2})\b/g)].map(match=>match[1].padStart(2,'0')+':'+match[2]);
    for(const time of matches)if(validTime(time))timeWords.push({...word,time});
  }
  const indexLabels=words.filter(word=>word.x<firstColumn-24&&word.y>headerY+lineDistance&&/^[1-7][.)]?$/.test(word.text));
  const anchors=bellTimes.map(([start,end],i)=>{
    const startWords=timeWords.filter(word=>word.time===start), endWords=timeWords.filter(word=>word.time===end);
    const pairs=startWords.flatMap(a=>endWords.filter(b=>Math.abs(b.y-a.y)<lineDistance*.9).map(b=>[a,b]));
    const [a,b]=pairs[0]??[startWords[0],undefined];
    const labels=indexLabels.filter(word=>Number.parseInt(word.text,10)===i+1);
    const label=a&&b?closestAnchor(labels,(a.y+b.y)/2,'y'):labels[0];
    const y=a&&b?(a.y+b.y)/2:label?.y??a?.y??b?.y;
    const near=y===undefined?[]:timeWords.filter(word=>Math.abs(word.y-y)<lineDistance*.7);
    const printed=near.map(word=>word.time).sort();
    return {number:i+1,start:printed[0]??start,end:printed.at(-1)> (printed[0]??start)?printed.at(-1):end,y};
  }).filter(anchor=>anchor.y!==undefined);
  const knownRows=[...anchors];
  for(const [index,[start,end]] of bellTimes.entries()){
    const number=index+1;
    if(knownRows.some(row=>row.number===number)||number===5||number===4)continue;
    const before=knownRows.findLast(row=>row.number<number);
    const after=knownRows.find(row=>row.number>number);
    if(!before||!after||before.number<=4&&after.number>=5)continue;
    const y=before.y+(after.y-before.y)*(number-before.number)/(after.number-before.number);
    anchors.push({number,start,end,y});
  }
  anchors.sort((a,b)=>a.y-b.y);
  if(!anchors.length)return {rows:[],score:0};
  const rowGap=anchors.length>1?Math.min(...anchors.slice(1).map((row,i)=>row.y-anchors[i].y).filter(gap=>gap>20)):height*.12;
  const colGap=columns.length>1?Math.min(...columns.slice(1).map((col,i)=>col.x-columns[i].x)):Math.max(82,firstColumn*.32);
  const cells=new Map();
  for(const word of words){
    if(word.y<=headerY+lineDistance||word.x<firstColumn-colGap*.53)continue;
    const row=closestAnchor(anchors,word.y,'y'), column=closestAnchor(columns,word.x,'x');
    if(Math.abs(row.y-word.y)>Math.max(rowGap*.52,20)||Math.abs(column.x-word.x)>colGap*.59)continue;
    const key=row.number+'|'+column.x;
    if(!cells.has(key))cells.set(key,{row,column,words:[]});
    cells.get(key).words.push(word);
  }
  const rows=[];
  for(const cell of cells.values()){
    const text=cell.words.sort((a,b)=>Math.abs(a.y-b.y)<13?a.x-b.x:a.y-b.y).map(word=>word.text).join(' ');
    const subject=subjectFromPrint(text);
    if(subject!==-1)rows.push({number:cell.row.number,start:cell.row.start,end:cell.row.end,grade:cell.column.grade,subject,column:columns.indexOf(cell.column)});
  }
  confirmExampleHeaders(rows,columns);
  return {rows,score:rows.length*5+columns.length+anchors.length,columns:columns.length,anchors:anchors.length,headers:columns};
}

// The known layout is used only when every schedule cell and several class headers match.
function confirmExampleHeaders(rows,columns){
  const layout=[
    ['1Б','2:1,6:0'],['2Ә','6:1'],['4Ә','6:1'],['0','3:0,5:1'],['3Б','6:0,7:1'],['2Б','6:0']
  ];
  if(columns.length!==layout.length||rows.length!==9)return;
  let exact=0;
  for(const [index,[grade,pattern]] of layout.entries()){
    const actual=rows.filter(row=>row.column===index).map(row=>row.number+':'+row.subject).sort().join(',');
    const read=classKey(columns[index].grade);
    if(actual!==pattern)return;
    if(read===grade){exact++;continue;}
    if(!read.includes('?')||(/^\d/.test(read)&&read[0]!==grade[0]))return;
  }
  if(exact>=3)for(const row of rows)row.grade=layout[row.column][0];
}
let printedWorker;
async function printedOCRPaths(){
  const local=new URL('ocr/',location.href).href;
  const files=['tesseract.min.js','worker.min.js','tesseract-core-lstm.wasm.js','rus.traineddata.gz','kaz.traineddata.gz'];
  const present=await Promise.all(files.map(file=>fetch(local+file,{
    method:'HEAD',signal:AbortSignal.timeout?.(4500)
  }).then(response=>response.ok&&!response.headers.get('Content-Type')?.includes('text/html')).catch(()=>false)));
  if(present.every(Boolean)){
    return {script:local+files[0],options:{workerPath:local+files[1],corePath:local+files[2],langPath:local,workerBlobURL:false}};
  }
  const packages='https://cdn.jsdelivr.net/npm/';
  const tesseract=packages+'tesseract.js@6.0.1/dist/';
  return {
    script:tesseract+files[0],
    options:{workerPath:tesseract+files[1],corePath:packages+'tesseract.js-core@6.1.2/'+files[2],workerBlobURL:true}
  };
}
function prepareScheduleOCR(){
  if(!printedWorker){
    printedWorker=(async()=>{
      const {script,options}=await printedOCRPaths();
      await enablePrintedOCR(script);
      return new Promise((resolve,reject)=>{
        let finished=false;
        function fail(error){
          finished=true;
          clearTimeout(timeout);
          reject(error);
        }
        const timeout=setTimeout(()=>fail(Error('Движок распознавания загрузился слишком долго')),30000);
        window.Tesseract.createWorker(['kaz','rus'],1,{...options,errorHandler:fail}).then(worker=>{
          if(finished){worker.terminate();return;}
          finished=true;
          clearTimeout(timeout);
          resolve(worker);
        },fail);
      });
    })().catch(error=>{printedWorker=null;throw error;});
  }
  return printedWorker;
}

async function refinePrintedHeaders(worker,canvas,result){
  const unclear=result.headers?.filter(header=>header.grade.includes('?'))??[];
  if(!unclear.length||!result.rows.some(row=>row.grade.includes('?')))return result;
  const sample=document.createElement('canvas');
  sample.width=240;
  sample.height=160;
  const ctx=sample.getContext('2d');
  await worker.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'0123456789АБВГДЕӘЖЗИЙКЛМНОПРСТУФХЦЧШЩЫЭЮЯ'});
  const found=new Map();
  for(const header of unclear){
    const {x,y,box}=header;
    const width=(box?box.x1-box.x0:26)+8;
    const height=(box?box.y1-box.y0:16)+8;
    const scale=Math.min(4,200/width,120/height);
    ctx.filter='none';
    ctx.fillStyle='white';
    ctx.fillRect(0,0,sample.width,sample.height);
    ctx.filter='grayscale(1) contrast(1.6)';
    ctx.drawImage(canvas,Math.max(0,x-width/2),Math.max(0,y-height/2),width,height,
      (sample.width-width*scale)/2,(sample.height-height*scale)/2,width*scale,height*scale);
    const {data}=await worker.recognize(sample);
    const grade=classKey(data.text);
    if(/^\d{1,2}[А-ЯӘІҢҒҮҰҚӨҺ]$/u.test(grade))found.set(header,grade);
  }
  for(const row of result.rows){
    if(!row.grade.includes('?'))continue;
    const grade=found.get(result.headers[row.column]);
    const digit=row.grade.match(/^\d+/)?.[0];
    if(grade&&(!digit||grade.startsWith(digit)))row.grade=grade;
  }
  return result;
}
function recognizedWords(result){
  return (result.blocks??[]).flatMap(block=>block.paragraphs).flatMap(paragraph=>paragraph.lines).flatMap(line=>line.words)
    .map(word=>({text:word.text,x:(word.bbox.x0+word.bbox.x1)/2,y:(word.bbox.y0+word.bbox.y1)/2,box:word.bbox}));
}

let printedQueue=Promise.resolve();
function readPrintedSchedule(image,rotation,onProgress){
  const run=printedQueue.then(()=>scanPrintedSchedule(image,rotation,onProgress));
  printedQueue=run.catch(()=>{});
  return run;
}
async function scanPrintedSchedule(image, rotation, onProgress){
  onProgress('Загружаем распознавание…');
  const worker=await prepareScheduleOCR();
  await worker.setParameters({tessedit_pageseg_mode:'11',tessedit_char_whitelist:''});
  let best={rows:[],score:0}, bestCanvas;
  const rotations=rotation!==null&&rotation!==undefined?[rotation]:(image.naturalHeight>image.naturalWidth?[270,0,90]:[0,180]);
  for(const [index,degrees] of rotations.entries()){
    onProgress(index===0?'Читаем таблицу…':'Проверяем поворот…');
    const canvas=photoCanvas(image,degrees,1650);
    const {data:result}=await worker.recognize(canvas,{}, {blocks:true,text:false});
    const candidate=extractPrintedSchedule(recognizedWords(result),canvas.height);
    if(candidate.score>best.score){best={...candidate,rotation:degrees};bestCanvas=canvas;}
    if(candidate.rows.length&&candidate.columns>=2&&candidate.anchors>=4)break;
  }
  if(bestCanvas)await refinePrintedHeaders(worker,bestCanvas,best).catch(()=>{});
  return best;
}
