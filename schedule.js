'use strict';

const bellTimes = [
  ['10:00','10:40'],['10:45','11:25'],['11:30','12:10'],['12:20','13:00'],
  ['14:00','14:40'],['14:45','15:25'],['15:30','16:10']
];
const scheduleSubjects = ['Программирование','Робототехника','Цифровая грамотность'];
const validTime = time => typeof time==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(time);
const scheduleOrder = (a,b) => (a.start||'99:99').localeCompare(b.start||'99:99')||
  (a.number||99)-(b.number||99)||a.grade.localeCompare(b.grade,'ru',{numeric:true});
const emptyLesson = () => ({id:crypto.randomUUID(),number:0,start:'',end:'',grade:'',subject:-1});

function classKey(label){
  const clean=String(label??'').normalize('NFKC').toUpperCase()
    .replace(/КЛАСС|СЫНЫП|КЛ\.?/gu,'').replace(/[\s.()–—-]/gu,'');
  const match=clean.match(/^(\d{1,2})([A-ZА-ЯӘІҢҒҮҰҚӨҺ]?)$/u);
  if(!match)return clean;
  const lookalikes={A:'А',B:'В',C:'С',E:'Е',H:'Н',K:'К',M:'М',O:'О',P:'Р',T:'Т',X:'Х',Y:'У'};
  return Number(match[1])+(lookalikes[match[2]]??match[2]);
}

function scheduleFor(day){return data.schedules[day]?.lessons??[];}
function rosterFor(lesson){
  const key=classKey(lesson.grade);
  return Object.entries(data.students).filter(([,student])=>classKey(student.grade)===key)
    .sort((a,b)=>a[1].name.localeCompare(b[1].name,'ru'));
}
const clockFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Qyzylorda',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const clockTime=()=>clockFormat.format(new Date());
const isCurrent=(lesson, time=clockTime())=>lesson.start<=time&&time<lesson.end;
const workingDate=()=>today();
const canWriteJournal=day=>currentPage()==='journal'&&day===workingDate();
let scheduleDate, scheduleSelection='', miniOpen=false;
function defaultLesson(day,time=clockTime()){
  const lessons=scheduleFor(day);
  if(day!==workingDate())return lessons[0];
  return lessons.find(lesson=>isCurrent(lesson,time))??lessons.find(lesson=>lesson.start>time)??lessons.at(-1);
}
function currentLesson(){
  if(activeLesson===null)return defaultLesson(date);
  return scheduleFor(date).find(lesson=>lesson.id===activeLesson);
}
function lessonTimeLabel(lesson){
  if(date!==workingDate())return '';
  const time=clockTime();
  if(isCurrent(lesson,time))return 'Идёт сейчас';
  if(lesson.start>time)return 'Предстоит';
  return 'Завершён';
}
function lessonPicker(){
  const lessons=scheduleFor(date);
  if(!lessons.length)return '<div class="journal-context"><button data-page="schedule">Открыть расписание</button></div>';
  const selectedId=currentLesson()?.id??'';
  const ongoing=lessons.filter(lesson=>date===workingDate()&&isCurrent(lesson));
  return '<div class="journal-context"><label>Урок<select id="journalLesson">'+
    '<option value="" '+(!selectedId?'selected':'')+'>Все ученики</option>'+
    lessons.map(item=>'<option value="'+esc(item.id)+'" '+(item.id===selectedId?'selected':'')+'>'+esc(item.start)+' · '+esc(item.grade)+' · '+scheduleSubjects[item.subject]+'</option>').join('')+
    '</select></label>'+(ongoing.length?'<div class="current-lessons"><small>Сейчас</small>'+
      ongoing.map(item=>'<button data-open-lesson="'+esc(item.id)+'" class="'+(item.id===selectedId?'current':'')+'">'+esc(item.grade)+' · '+scheduleSubjects[item.subject]+'</button>').join('')+'</div>':'')+
    (activeLesson!==null?'<button data-live-lesson>По текущему времени</button>':'')+'</div>';
}
function lessonRecord(id, day, lesson){
  const saved=stored(id,day,lesson.subject,lesson.id);
  if(saved)return saved;
  const sameSeries=scheduleFor(day).filter(item=>classKey(item.grade)===classKey(lesson.grade)&&item.subject===lesson.subject);
  return sameSeries.length===1?stored(id,day,lesson.subject):undefined;
}
function previousLessonNotes(lesson,day=date){
  const lastNotes=new Map();
  for(const row of Object.values(data.records)){
    if(!row.note||row.subject!==lesson.subject||row.date>day||row.date===day&&!row.period)continue;
    const previousPeriod=row.period?scheduleFor(row.date).find(item=>item.id===row.period):null;
    if(row.date===day&&(!previousPeriod||previousPeriod.start>=lesson.start))continue;
    const stamp=row.date+' '+(previousPeriod?.start||'');
    if(!lastNotes.has(row.student)||lastNotes.get(row.student).stamp<stamp)lastNotes.set(row.student,{...row,stamp});
  }
  return lastNotes;
}

function schedulePage(){
  const day=scheduleDate??workingDate();
  const lessons=scheduleFor(day);
  const selectedLesson=lessons.find(item=>item.id===scheduleSelection);
  const rows=lessons.map(item=>{
    const roster=rosterFor(item);
    const recorded=roster.filter(([id])=>lessonRecord(id,day,item)?.status).length;
    const current=day===workingDate()&&isCurrent(item);
    return '<tr class="'+(current?'schedule-now ':'')+(selectedLesson?.id===item.id?'selected':'')+'"><td class="slot-time nowrap">'+esc(item.start)+'–'+esc(item.end)+(current?' <span class="live-label">Сейчас</span>':'')+'</td><td class="slot-number">'+
      (item.number||'—')+'</td><td class="slot-grade">'+esc(item.grade)+'</td><td class="slot-subject">'+scheduleSubjects[item.subject]+'</td><td class="slot-progress">'+
      (roster.length?recorded+' из '+roster.length:'<span class="muted">Класс не найден</span>')+
      '</td><td class="slot-action"><button data-schedule-view="'+esc(item.id)+'" aria-pressed="'+(selectedLesson?.id===item.id)+'"><span class="desktop-only">Посмотреть</span><span class="mobile-only">Ученики</span></button></td></tr>';
  }).join('');
  return title('Расписание','Уроки по времени и классам','<input id="scheduleDate" type="date" aria-label="Дата расписания" value="'+day+'">')+
    '<section class="panel schedule-panel"><div class="toolbar"><h2>'+viewDate(day)+'</h2><div class="actions">'+
    '<button data-schedule-editor>'+(lessons.length?'Править расписание':'Ввести вручную')+'</button>'+
    '<button class="primary" data-schedule-import>Загрузить фото</button></div></div>'+
    (rows?'<div class="table-wrap"><table class="mobile-records slots-table" role="table"><thead><tr><th>Время</th><th>Урок</th><th>Класс</th><th>Предмет</th><th>Отмечено</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>':
      '<div class="footer"><span>Загрузите фото таблицы с классами и уроками.</span><button data-schedule-example>Пример с фото</button></div>')+
    '</section>'+(selectedLesson?readOnlyRoster(selectedLesson,day):'');
}

function readOnlyRoster(lesson,day){
  const rows=lessonRosterRows(lesson,day,false,false);
  return '<section id="scheduleRoster" class="panel"><div class="toolbar"><h2>'+esc(lesson.start)+' · '+esc(lesson.grade)+' · '+scheduleSubjects[lesson.subject]+'</h2>'+
    '<button data-day-journal="'+day+'" data-target-lesson="'+esc(lesson.id)+'">'+(day===workingDate()?'Отметить в журнале':'Открыть журнал за день')+'</button></div>'+
    '<div class="table-wrap"><table class="mobile-records roster-table" role="table"><thead><tr><th>Ученик</th><th>Посещение</th><th>Последняя тема</th></tr></thead><tbody>'+rows+'</tbody></table></div></section>';
}

function renderMiniSchedule(){
  const panel=$('miniSchedule');
  panel.hidden=!miniOpen;
  $('miniScheduleToggle').setAttribute('aria-expanded',String(miniOpen));
  if(!miniOpen)return;
  const day=workingDate();
  const time=clockTime();
  const rows=scheduleFor(day).map(lesson=>'<tr class="'+(isCurrent(lesson,time)?'schedule-now':'')+'"><td class="nowrap">'+esc(lesson.start)+'–'+esc(lesson.end)+'</td><td>'+scheduleSubjects[lesson.subject]+'</td><td>'+esc(lesson.grade)+'</td></tr>').join('');
  panel.innerHTML='<div class="mini-schedule-title"><button data-mini-full>Перейти</button><strong>Расписание</strong></div>'+
    (rows?'<div class="mini-schedule-scroll"><table><thead><tr><th>Время</th><th>Предмет</th><th>Класс</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p class="blank">На сегодня уроков нет</p>');
}
function lessonPanel(lesson){
  const edit=canWriteJournal(date);
  const timeLabel=lessonTimeLabel(lesson);
  return '<section id="scheduledRoster" class="panel"><div class="toolbar"><div><h2>'+esc(lesson.start)+'–'+esc(lesson.end)+' · '+esc(lesson.grade)+' · '+scheduleSubjects[lesson.subject]+'</h2>'+
    (timeLabel?'<small class="'+(timeLabel==='Идёт сейчас'?'live-label':'')+'">'+timeLabel+'</small>':'')+'</div>'+
    (edit?'<div class="actions bulk-selection"><button id="bulk" class="primary" data-bulk>Записать занятие</button></div>':'')+'</div>'+
    (edit?mobileSelectAll():'')+'<div class="table-wrap"><table class="mobile-records roster-table" role="table"><thead><tr>'+(edit?'<th><input id="all" type="checkbox" aria-label="Выбрать всех в списке"></th>':'')+
    '<th>Ученик</th><th>Посещение</th><th>Прошлая тема</th><th>Тема урока</th>'+(edit?'<th>Действия</th>':'')+
    '</tr></thead><tbody id="rows"></tbody></table></div><div class="footer"><span id="counts"></span></div></section>';
}

function lessonRosterRows(lesson,day=date,edit=canWriteJournal(day),includeCurrent=edit||currentPage()==='journal'){
  const roster=rosterFor(lesson), previous=previousLessonNotes(lesson,day);
  return roster.map(([id,student])=>{
    const row=lessonRecord(id,day,lesson), prior=previous.get(id), latest=includeCurrent?prior:(row?.note?{date:day,note:row.note}:prior);
    return '<tr class="'+(edit&&selected.has(id)?'selected':'')+'">'+(edit?studentSelect(id,student.name):'')+
      '<td class="student">'+esc(student.name)+'</td><td class="attendance-cell">'+attendanceLabel(row,edit?id:null,includeCurrent)+'</td>'+
      '<td class="lesson-note previous-note'+(!latest?' record-empty':'')+'">'+(latest?mobileField(includeCurrent?'Прошлая тема':'Последняя тема')+'<small>'+viewDate(latest.date)+'</small><div>'+esc(latest.note)+'</div>':'<span class="muted">—</span>')+'</td>'+
      (includeCurrent?'<td class="lesson-note current-note'+(!row?.note?' record-empty':'')+'">'+(row?.note?mobileField('Тема урока')+esc(row.note):'<span class="muted">—</span>')+'</td>':'')+
      (edit?'<td class="student-actions"><div class="row-actions"><button data-note="'+esc(id)+'" aria-label="Записать тему" title="Записать тему">'+icon('note')+'<span class="mobile-only">Тема</span></button></div></td>':'')+'</tr>';
  }).join('')||'<tr><td class="blank" colspan="'+(edit?6:includeCurrent?4:3)+'">В журнале нет учеников класса «'+esc(lesson.grade)+'».</td></tr>';
}
function updateLessonTable(lesson){
  const roster=rosterFor(lesson), records=roster.map(([id])=>lessonRecord(id,date,lesson));
  $('rows').innerHTML=lessonRosterRows(lesson);
  $('counts').textContent='В списке: '+roster.length+' · Были: '+records.filter(record=>record?.status==='yes').length+' · Отсутствовали: '+records.filter(record=>record?.status==='no').length;
  if(canWriteJournal(date))updateSelection(roster);
}

function photoExample(){
  return [[2,'1Б',1],[3,'0 кл',0],[5,'0 кл',1],[6,'1Б',0],[6,'2Ә',1],[6,'4Ә',1],[6,'3Б',0],[6,'2Б',0],[7,'3Б',1]]
    .map(([number,grade,subject])=>({...emptyLesson(),number,grade,subject,start:bellTimes[number-1][0],end:bellTimes[number-1][1]}));
}

let scheduleDraft=null;

function editSchedule(mode){
  const day=scheduleDate??workingDate();
  scheduleDraft={day,rows:mode==='example'?photoExample():scheduleFor(day).map(lesson=>({...lesson})),rotation:null};
  if(mode==='manual'&&!scheduleDraft.rows.length)scheduleDraft.rows.push(emptyLesson());
  openDialog('Расписание · '+viewDate(day),'<form id="scheduleForm" novalidate><div class="schedule-file">'+
    '<label>Фото расписания<input id="schedulePhoto" type="file" accept="image/*"></label>'+
    '<label class="mobile-only camera-picker">Снять фото<input id="scheduleCamera" type="file" accept="image/*" capture="environment" aria-label="Снять фото расписания"></label>'+
    '<div class="paste-photo" id="pastePhoto" tabindex="0">Вставить фото · Ctrl+V / ⌘V</div>'+
    '<div class="actions"><button type="button" data-photo-rotate hidden>Повернуть фото</button><button type="button" data-photo-read disabled>Распознать</button></div></div>'+
    '<img id="schedulePreview" class="schedule-preview" alt="Фото расписания" hidden>'+
    '<p id="scheduleError" class="form-error" role="alert"></p><p id="scheduleHint" class="schedule-hint" role="status"></p><div class="table-wrap"><table class="schedule-editor mobile-records" role="table"><thead><tr><th>Урок</th><th>Начало</th><th>Конец</th><th>Класс</th><th>Предмет</th><th></th></tr></thead><tbody id="scheduleEditorRows"></tbody></table></div>'+
    '<datalist id="scheduleClassList">'+classes().map(name=>'<option value="'+esc(name)+'"></option>').join('')+'</datalist>'+
    '<div class="actions schedule-save"><button type="button" data-schedule-add>+ Строка</button><button class="primary">Сохранить расписание</button></div></form>');
  $('dialog').classList.add('schedule-dialog');
  renderScheduleDraft();
  if(mode==='photo'){
    if($('pastePhoto').getClientRects().length)$('pastePhoto').focus();
    prepareScheduleOCR().catch(()=>{});
  }
}

function renderScheduleDraft(){
  $('scheduleEditorRows').innerHTML=scheduleDraft.rows.map((row,i)=>'<tr data-line="'+i+'"><td class="editor-slot">'+mobileField('Урок')+'<select data-slot aria-label="Номер урока"><option value="0">—</option>'+
    bellTimes.map((_,index)=>'<option value="'+(index+1)+'" '+(row.number===index+1?'selected':'')+'>'+(index+1)+'</option>').join('')+'</select></td>'+
    '<td class="editor-start">'+mobileField('Начало')+'<input type="time" data-time="start" value="'+esc(row.start)+'" aria-label="Начало" required></td>'+
    '<td class="editor-end">'+mobileField('Конец')+'<input type="time" data-time="end" value="'+esc(row.end)+'" aria-label="Конец" required></td>'+
    '<td class="editor-grade">'+mobileField('Класс')+'<input data-grade list="scheduleClassList" value="'+esc(row.grade)+'" aria-label="Класс" required maxlength="24" placeholder="Выберите класс"></td>'+
    '<td class="editor-subject">'+mobileField('Предмет')+'<select data-subject aria-label="Предмет" required><option value="">Выберите</option>'+
    scheduleSubjects.map((name,index)=>'<option value="'+index+'" '+(row.subject===index?'selected':'')+'>'+name+'</option>').join('')+'</select></td>'+
    '<td class="editor-remove"><button type="button" data-schedule-remove="'+i+'" aria-label="Удалить строку">×</button></td></tr>').join('')||
    '<tr><td class="blank" colspan="6">Добавьте строку или загрузите фото.</td></tr>';
}

function updateScheduleDraft(target){
  const line=target.closest('[data-line]');
  if(!line)return;
  const row=scheduleDraft.rows[Number(line.dataset.line)];
  target.removeAttribute('aria-invalid');
  $('scheduleError').textContent='';
  if(target.matches('[data-slot]')){
    row.number=Number(target.value);
    if(row.number){
      [row.start,row.end]=bellTimes[row.number-1];
      line.querySelector('[data-time=start]').value=row.start;
      line.querySelector('[data-time=end]').value=row.end;
    }
  }
  if(target.matches('[data-grade]')){row.grade=target.value;row.pendingClass=false;}
  if(target.matches('[data-time]'))row[target.dataset.time]=target.value;
  if(target.matches('[data-subject]'))row.subject=target.value===''?-1:Number(target.value);
}

function importSignature(row){return [row.number||row.start,classKey(row.grade),row.subject].join('|');}
function mergeImported(rows){
  const original=scheduleDraft.rows.filter(item=>!item.pendingClass&&(item.grade||item.subject>=0));
  const existing=new Map(original.map(item=>[importSignature(item),item]));
  const incomplete=[];
  for(const item of rows){
    if(!item.grade){incomplete.push({...item,id:crypto.randomUUID(),pendingClass:true});continue;}
    const key=importSignature(item);
    const old=existing.get(key);
    existing.set(key,{...item,id:old?.id??crypto.randomUUID()});
  }
  scheduleDraft.rows=[...existing.values(),...incomplete].sort(scheduleOrder);
  renderScheduleDraft();
}

async function setSchedulePhoto(file){
  const draft=scheduleDraft;
  if(!file||draft?.reading||draft?.decoding)return;
  draft.decoding=true;
  let image;
  try{image=await decodeSchedulePhoto(file);}finally{draft.decoding=false;}
  if(draft!==scheduleDraft||!$('scheduleForm')||!$('dialog').open)return;
  draft.image=image;
  draft.rotation=null;
  showSchedulePhoto();
  await readSchedulePhoto();
}
function showSchedulePhoto(){
  const form=$('scheduleForm'), photo=$('schedulePreview');
  photo.src=photoCanvas(scheduleDraft.image,scheduleDraft.rotation??0,460).toDataURL('image/jpeg',0.8);
  photo.hidden=false;
  form.querySelector('[data-photo-rotate]').hidden=false;
  form.querySelector('[data-photo-read]').disabled=false;
}
async function readSchedulePhoto(){
  const form=$('scheduleForm'), draft=scheduleDraft;
  if(!draft.image||draft.reading)return;
  draft.reading=true;
  const hint=$('scheduleHint');
  const buttons=form.querySelectorAll('[data-photo-rotate],[data-photo-read],#schedulePhoto,#scheduleCamera');
  buttons.forEach(button=>button.disabled=true);
  hint.textContent='Читаем фото…';
  try{
    const result=await readPrintedSchedule(draft.image,draft.rotation,text=>{if(form.isConnected)hint.textContent=text;}).catch(()=>null);
    if(draft!==scheduleDraft||!form.isConnected||!$('dialog').open)return;
    const rows=normalizePhotoRows(result?.rows);
    if(draft!==scheduleDraft||!form.isConnected||!$('dialog').open)return;
    if(result?.rotation!==undefined&&draft.rotation===null){draft.rotation=result.rotation;showSchedulePhoto();}
    if(rows.length)mergeImported(rows);
    const incomplete=rows.filter(row=>!row.grade).length;
    hint.textContent=rows.length?'Найдено уроков: '+rows.length+(incomplete?' · выберите класс в пустых строках: '+incomplete:'')+'.':
      'Таблица не прочиталась. Поверните фото или выберите более чёткий снимок.';
  }catch(error){
    if(form.isConnected)hint.textContent='Не удалось прочитать фото. Попробуйте повернуть снимок или добавьте строки вручную.';
  }finally{
    draft.reading=false;
    buttons.forEach(button=>button.disabled=false);
  }
}
function normalizePhotoRows(raw){
  if(!Array.isArray(raw))return [];
  const seen=new Set();
  const items=[];
  for(const row of raw.slice(0,80)){
    if(!row||!Number.isInteger(row.subject)||!scheduleSubjects[row.subject])continue;
    const rawGrade=String(row.grade??'').trim().slice(0,24);
    const grade=/^\d{1,2}[А-ЯӘІҢҒҮҰҚӨҺ]?$/.test(classKey(rawGrade))?rawGrade:'';
    if(!grade&&!rawGrade)continue;
    const number=Number.isInteger(row.number)&&bellTimes[row.number-1]?row.number:0;
    const bell=bellTimes[number-1]??[];
    const start=validTime(row.start)?row.start:bell[0]??'';
    const end=validTime(row.end)?row.end:bell[1]??'';
    const item={number,grade,start,end,subject:row.subject};
    const signature=grade?importSignature(item):rawGrade+'|'+(row.column??'')+'|'+number+'|'+row.subject;
    if(seen.has(signature))continue;
    seen.add(signature);
    items.push(item);
  }
  return items;
}
function showScheduleError(error,selector){
  if(!$('scheduleError'))return;
  $('scheduleError').textContent=error;
  if(selector){
    const field=$('scheduleForm').querySelector(selector);
    field?.focus();
    field?.setAttribute('aria-invalid','true');
  }else $('scheduleError').scrollIntoView?.({block:'nearest'});
}
async function saveScheduleDraft(){
  if(scheduleDraft.reading)throw Error('Подождите, фото ещё распознаётся');
  const rows=scheduleDraft.rows.map(({id,number,start,end,grade,subject})=>({id,number,start,end,grade:grade.trim(),subject}));
  if(!rows.length&&!scheduleFor(scheduleDraft.day).length)throw Error('Добавьте хотя бы один урок');
  if(rows.length>80)throw Error('В расписании слишком много строк');
  const unique=new Set();
  for(const [index,row] of rows.entries()){
    const invalid=!row.grade||row.grade.includes('?')?['[data-grade]','выберите класс']:
      !scheduleSubjects[row.subject]?['[data-subject]','выберите предмет']:
      !validTime(row.start)?['[data-time=start]','укажите время начала']:
      !validTime(row.end)||row.start>=row.end?['[data-time=end]','проверьте время конца']:null;
    if(invalid){showScheduleError('Строка '+(index+1)+' — '+invalid[1]+'.','[data-line="'+index+'"] '+invalid[0]);return false;}
    const key=[row.start,classKey(row.grade),row.subject].join('|');
    if(unique.has(key)){showScheduleError('Строка '+(index+1)+' уже есть в расписании.','[data-line="'+index+'"] [data-grade]');return false;}
    unique.add(key);
  }
  await save({['schedules/'+scheduleDraft.day]:rows.length?{lessons:rows.sort(scheduleOrder)}:null});
  if(date===scheduleDraft.day)activeLesson=null;
  message('Расписание сохранено');
  return true;
}
