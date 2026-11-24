'use strict';
const subjects = ['Программирование', 'Робототехника', 'Цифровая грамотность'];
const teachers = ['Асель', 'Ерасыл'];
const pages = {history:'История',journal:'Журнал за день',schedule:'Расписание',plan:'Следующий урок',shifts:'Смены'};
const mobilePages = {journal:'Журнал',plan:'План урока'};
const paths = {schedule:'M3 5h18v16H3zM7 2v6m10-6v6M3 10h18M7 14h3m4 0h3m-10 3h3',journal:'M3 4h18v16H3zM3 9h18M9 9v11',history:'M12 7v5l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',plan:'M8 18h8m-7 4h6M8 15c0-3-3-3-3-7a7 7 0 1 1 14 0c0 4-3 4-3 7Z',shifts:'M3 5h18v16H3zM7 2v6m10-6v6M3 10h18',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-4',search:'M16 16l5 5m-3-10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',edit:'M4 16v4h4L20 8l-4-4Z',note:'M4 4h16v13H9l-5 4Zm4 5h8m-8 4h6'};
const icon = name => '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="'+paths[name]+'"/></svg>';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const dateParts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Qyzylorda',year:'numeric',month:'2-digit',day:'2-digit'});
const today = () => dateParts.format(new Date());
const format = (key, options) => new Intl.DateTimeFormat('ru',{timeZone:'UTC',...options}).format(new Date(key+'T12:00:00Z'));
const viewDate = key => format(key,{day:'numeric',month:'long'});
const planned = key => [null,0,1,0,0,1,1][new Date(key+'T12:00:00Z').getUTCDay()];
const dateKey = (year, month, day) => new Date(Date.UTC(year,month-1,day)).toISOString().slice(0,10);
const dateRange = key => {
  const [year, month] = key.split('-').map(Number);
  return Array.from({length:new Date(Date.UTC(year,month,0)).getUTCDate()},(_,i)=>dateKey(year,month,i+1));
};
const journalHash = page => '#'+page;
const empty = () => ({students:{},records:{},shifts:{},schedules:{}});
const openingDate = today();
let data = empty(), remoteState = 'loading';
let journalSession;
let activeLesson=null, mobileHistoryView='notes';
let date=openingDate, month=date.slice(0,7), historyMonth=month, subject=0, query='', grade='', toastTimer, pending=false;
const selected=new Set();
const teacherOn = day => data.shifts[day] ?? planned(day);
const byDate = () => teacherOn(date);
function recordKey(day,sub,id,period){return [day,sub,id,...(period?[period]:[])].join('_');}
function stored(id, day=date, sub=subject, period){return data.records[recordKey(day,sub,id,period)];}
const classes = () => [...new Set(Object.values(data.students).map(s=>s.grade))].sort((a,b)=>a.localeCompare(b,'ru',{numeric:true}));
const currentPage = () => {
  const route=location.hash.slice(1);
  return Object.hasOwn(pages,route)?route:'history';
};
function message(value){
  $('toast').textContent=value; $('toast').style.display='block';
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').style.display='none',3500);
}
function normalized(value){
  const journal=empty();
  for(const key of Object.keys(journal)){
    if(value?.[key]&&typeof value[key]==='object')journal[key]=value[key];
  }
  return journal;
}

async function connectJournal(){
  const deadline=setTimeout(()=>{
    if(remoteState==='loading'){
      remoteState='error';
      render();
    }
  },12000);
  try{
    const {openSharedJournal}=await import('./firebase-shared.js');
    journalSession=openSharedJournal(
      window.JOURNAL_CONFIG.firebaseDatabaseURL, 'public',
      snapshot=>{
        clearTimeout(deadline);
        data=normalized(snapshot);
        remoteState='ready';
        render();
      },
      online=>{
        if(remoteState!=='ready'&&remoteState!=='offline')return;
        const state=online?'ready':'offline';
        if(remoteState!==state){remoteState=state;render();}
      },
      () => {
        clearTimeout(deadline);
        data=empty();
        remoteState='denied';
        if($('dialog').open)$('dialog').close();
        render();
      }
    );
  }catch{
    clearTimeout(deadline);
    remoteState='error';
    render();
  }
}

async function save(changes){
  if(pending)throw Error('Подождите, идёт сохранение');
  if(remoteState!=='ready')throw Error('Нет связи с журналом. Повторите после подключения.');
  pending=true;
  try{
    await journalSession.patch(changes);
  }catch{
    throw Error('Запись не сохранилась в Firebase. Обновите журнал и повторите.');
  }finally{
    pending=false;
  }
  render();
}
function notify(error){message(error.message||'Действие не выполнено');}
function title(heading,subtitle,action=''){return '<div class="heading"><div><h1>'+heading+'</h1><p>'+subtitle+'</p></div>'+action+'</div>';}
function counts(monthKey){
  const baseTotal=[0,0],total=[0,0],covered=[0,0],missed=[0,0],replacementDays=[[],[]];
  for(const key of dateRange(monthKey+'-01')){
    const base=planned(key), actual=teacherOn(key);
    if(base!==null)baseTotal[base]++;
    if(actual!==null)total[actual]++;
    if(actual===base)continue;
    if(actual!==null){covered[actual]++;replacementDays[actual].push(key);}
    if(base!==null)missed[base]++;
  }
  const delta=covered.map((count,i)=>count-missed[i]);
  const paired=Math.min(...covered);
  const settled=new Set(replacementDays.flatMap(days=>days.slice(0,paired)));
  return {baseTotal,total,covered,missed,delta,settled};
}
function shiftSummary(monthKey){
  const {baseTotal,total,covered,missed,delta}=counts(monthKey);
  return '<div class="shift-summary">'+teachers.map((name,i)=>
    '<div><strong>'+name+'</strong><span>По графику <b>'+baseTotal[i]+'</b></span>'+
    '<span class="'+(covered[i]?(delta[i]>0?'replacement-text':'replacement-settled'):'')+'">Доп. смены <b>'+covered[i]+'</b></span>'+
    '<span class="'+(missed[i]?(delta[i]<0?'replacement-text':'replacement-settled'):'')+'">Подменили <b>'+missed[i]+'</b></span>'+
    '<span>Итого <b>'+total[i]+'</b></span>'+
    (delta[i]<0?'<span class="replacement-text">Ответить заменой <b>'+Math.abs(delta[i])+'</b></span>':'')+'</div>'
  ).join('')+'</div>';
}
function visible(){
  return Object.entries(data.students).filter(([,s])=>(!grade||s.grade===grade)&&s.name.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))).sort((a,b)=>a[1].name.localeCompare(b[1].name,'ru'));
}
const absenceReasons={illness:'Болезнь',family:'Семейные обстоятельства',excused:'Заранее предупредили',unknown:'Причина неизвестна',other:'Другая причина'};
function absenceDescription(row){
  if(row?.status!=='no'||!row.reason)return '';
  return row.reason==='other'?row.reasonDetail:(absenceReasons[row.reason]??'');
}
function attendanceLabel(row,id,showReason=true){
  const css='status '+esc(row?.status||'');
  const detail=showReason?absenceDescription(row):'';
  const label=statuses(row?.status);
  return (id?'<button class="'+css+'" data-attendance="'+esc(id)+'">'+label+'</button>':'<span class="'+css+'">'+label+'</span>')+
    (detail?'<small class="absence-detail">'+esc(detail)+'</small>':'');
}
function statuses(value){return ({yes:'Был',no:'Не был'})[value]||'Не отмечен';}
function noteKey(note){return note.trim().toLocaleLowerCase('ru').replace(/\s+/g,' ');}
const colors=['#e7f3ee','#f0edf9','#eaf1fa','#fbf2df','#f8ebef','#edf4dc'];
function shade(key){return colors[[...key].reduce((sum,c)=>(sum*31+c.codePointAt(0))>>>0,0)%colors.length];}
function studentSelect(id,name){
  const label='Выбрать '+esc(name);
  return '<td class="pick-student"><label><input type="checkbox" data-select="'+esc(id)+'" aria-label="'+label+'" '+(selected.has(id)?'checked':'')+'></label></td>';
}
function mobileField(text){return '<span class="mobile-only field-label" aria-hidden="true">'+text+'</span>';}
function mobileSelectAll(){return '<label class="mobile-only select-all"><input id="allMobile" type="checkbox">Выбрать всех</label>';}
function tableBody(){
  const edit=canWriteJournal(date), all=visible();
  const frequencies=Object.create(null), previous=previousLessonNotes({subject,start:'00:00'},date);
  for(const id of Object.keys(data.students)){const note=stored(id)?.note;if(note){const k=noteKey(note);frequencies[k]=(frequencies[k]||0)+1;}}
  return all.map(([id,student])=>{
    const row=stored(id), note=row?.note||'', k=noteKey(note), prior=previous.get(id);
    return '<tr class="'+(edit&&selected.has(id)?'selected':'')+'">'+
      (edit?studentSelect(id,student.name):'')+
      '<td class="student">'+esc(student.name)+'<small class="mobile-only student-grade">'+esc(student.grade)+'</small></td><td class="desktop-grade nowrap">'+esc(student.grade)+'</td><td class="attendance-cell">'+attendanceLabel(row,edit?id:null)+'</td>'+
      '<td class="lesson-note previous-note'+(!prior?' record-empty':'')+'">'+(prior?mobileField('Прошлая тема')+'<small>'+viewDate(prior.date)+'</small><div>'+esc(prior.note)+'</div>':'—')+'</td>'+
      '<td class="current-note'+(!note?' record-empty':'')+'">'+(note?mobileField('Тема урока')+'<span class="topic" '+(frequencies[k]>1?'style="background:'+shade(k)+'"':'')+'>'+esc(note)+'</span>':'—')+'</td>'+
      (edit?'<td class="student-actions"><div class="row-actions"><button data-note="'+esc(id)+'" title="Запись занятия" aria-label="Запись занятия">'+icon('note')+'<span class="mobile-only">Тема</span></button><button data-student="'+esc(id)+'" title="Править ученика" aria-label="Править ученика">'+icon('edit')+'</button></div></td>':'')+'</tr>';
  }).join('')||'<tr><td colspan="'+(edit?7:5)+'" class="blank">Ученики не найдены</td></tr>';
}
function tableCounts(){
  const all=visible();
  const count=type=>all.filter(([id])=>stored(id)?.status===type).length;
  return 'В списке: '+all.length+' · Было: '+count('yes')+' · Отсутствовали: '+count('no');
}
function updateTable(){
  const lesson=currentLesson();
  if(lesson){updateLessonTable(lesson);return;}
  $('rows').innerHTML=tableBody();
  $('counts').textContent=tableCounts();
  if(canWriteJournal(date))updateSelection(visible());
}
function updateSelection(all){
  const checked=all.length>0&&all.every(([id])=>selected.has(id));
  const indeterminate=!checked&&all.some(([id])=>selected.has(id));
  for(const id of ['all','allMobile']){
    $(id).checked=checked;
    $(id).indeterminate=indeterminate;
  }
  $('bulk').textContent=selected.size?'Записать занятие · '+selected.size:'Записать занятие';
  $('bulk').disabled=!selected.size;
}
function journal(){
  const lesson=currentLesson(), edit=canWriteJournal(date);
  const heading=title('Журнал за день','Посещаемость и темы уроков','<div class="actions"><input id="journalDate" type="date" aria-label="Дата журнала" value="'+date+'">'+(edit?'<button data-student="">+ Ученик</button>':'')+'</div>');
  return heading+lessonPicker()+(lesson?lessonPanel(lesson):
  '<section class="panel"><div class="toolbar"><h2>Ученики</h2>'+(edit?'<div class="actions bulk-selection"><button id="bulk" class="primary" data-bulk>Записать занятие</button></div>':'')+'</div>'+
  '<div class="filters"><div class="segments">'+subjects.map((s,i)=>'<button class="'+(i===subject?'active':'')+'" data-sub="'+i+'">'+s+'</button>').join('')+'</div><div class="search">'+icon('search')+'<input id="query" aria-label="Поиск ученика" placeholder="Поиск ученика" value="'+esc(query)+'"></div><select id="grade" aria-label="Класс"><option value="">Все классы</option>'+classes().map(g=>'<option '+(g===grade?'selected':'')+'>'+esc(g)+'</option>').join('')+'</select></div>'+
  (edit?mobileSelectAll():'')+'<div class="table-wrap"><table class="mobile-records roster-table" role="table"><thead><tr>'+(edit?'<th><input id="all" type="checkbox" aria-label="Выбрать всех в списке"></th>':'')+
  '<th>Ученик</th><th>Класс</th><th>Посещение</th><th>Прошлая тема</th><th>Тема урока</th>'+(edit?'<th>Действия</th>':'')+
  '</tr></thead><tbody id="rows"></tbody></table></div><div class="footer"><span id="counts"></span></div></section>');
}
function historyDates(){
  return dateRange(historyMonth+'-01').filter(day=>planned(day)!==null);
}
function historyRows(days, students){
  const summary=new Map();
  for(const row of Object.values(data.records)){
    if(!row.date.startsWith(historyMonth+'-')||row.subject!==subject)continue;
    const key=recordKey(row.date,row.subject,row.student);
    const existing=summary.get(key);
    if(!existing){
      summary.set(key,{status:row.status,notes:row.note?[row.note]:[]});
    }else{
      if(row.status==='yes')existing.status='yes';
      if(row.note&&!existing.notes.includes(row.note))existing.notes.push(row.note);
    }
  }
  const now=today(), labels=new Map(days.map(day=>[day,viewDate(day)]));
  const groups=new Map();
  const themeCounts=new Map();
  for(const [id,student] of students){
    if(!groups.has(student.grade))groups.set(student.grade,[]);
    groups.get(student.grade).push([id,student]);
    for(const day of days){
      const note=summary.get(recordKey(day,subject,id))?.notes.join(' · ');
      if(!note)continue;
      const key=day+' '+noteKey(note);
      themeCounts.set(key,(themeCounts.get(key)||0)+1);
    }
  }
  return [...groups.entries()].sort(([a],[b])=>a.localeCompare(b,'ru',{numeric:true})).map(([level,group])=>
    '<tbody><tr class="class-row"><th scope="rowgroup"><strong>'+esc(level)+'</strong> <small>'+group.length+'</small></th><td colspan="'+days.length+'"></td></tr>'+
    group.map(([id,student])=>'<tr><th scope="row" class="history-student" title="'+esc(student.name)+'">'+esc(student.name)+'</th>'+
      days.map(day=>{
        const record=summary.get(recordKey(day,subject,id)), note=record?.notes.join(' · ');
        const key=note?day+' '+noteKey(note):'';
        const tint=note&&themeCounts.get(key)>1?' style="--theme-color:'+shade(noteKey(note))+'"':'';
        const label=student.name+' · '+labels.get(day)+' · '+statuses(record?.status)+(note?' · '+note:'');
        const mark=record?.status==='yes'?'✓':record?.status==='no'?'−':'';
        return '<td class="'+(day===now?'today-col':'')+'"><button data-cell="'+esc(id)+'" data-day="'+day+'" class="cell '+esc(record?.status||'')+'"'+tint+' aria-label="'+esc(label)+'" title="'+esc(label)+'">'+mark+(note?'<i aria-hidden="true"></i>':'')+'</button></td>';
      }).join('')+'</tr>').join('')+'</tbody>'
  ).join('')||'<tbody><tr><td colspan="'+(days.length+1)+'" class="blank">Ученики не найдены</td></tr></tbody>';
}
function historyNotes(students){
  const ids=new Set(students.map(([id])=>id));
  const records=Object.values(data.records).filter(r=>r.note&&r.date.startsWith(historyMonth+'-')&&r.subject===subject&&ids.has(r.student));
  const groups=new Map();
  for(const record of records.sort((a,b)=>b.date.localeCompare(a.date))){
    const key=JSON.stringify([record.date,record.teacher,noteKey(record.note)]);
    if(!groups.has(key))groups.set(key,{...record,names:[]});
    groups.get(key).names.push(data.students[record.student].name);
  }
  return [...groups.values()].map(record=>'<tr><td class="record-date nowrap">'+format(record.date,{day:'2-digit',month:'2-digit'})+'</td><td class="record-teacher">'+esc(teachers[record.teacher])+'</td><td class="record-names">'+esc(record.names.join(', '))+'</td><td class="lesson-note">'+esc(record.note)+'</td></tr>').join('')||
    '<tr><td colspan="4" class="blank">За этот месяц записей по выбранным фильтрам нет</td></tr>';
}
function updateHistory(){
  const students=visible(), days=historyDates();
  const table=$('matrixScroll').querySelector('table');
  for(const body of [...table.tBodies])body.remove();
  table.insertAdjacentHTML('beforeend',historyRows(days,students));
  $('historyRecords').innerHTML=historyNotes(students);
  $('historyCount').textContent='Учеников: '+students.length;
}
function historyPage(){
  const days=historyDates(), now=workingDate();
  return title('История занятий','Посещаемость и темы за месяц','<button data-day-journal="'+now+'">Журнал за день</button>')+
    '<div class="history-layout" data-view="'+mobileHistoryView+'"><div class="mobile-only history-switch" role="group" aria-label="Вид истории">'+
    [['notes','Темы'],['attendance','Посещаемость']].map(([view,label])=>'<button data-history-view="'+view+'" aria-pressed="'+(view===mobileHistoryView)+'">'+label+'</button>').join('')+'</div>'+
    '<section class="panel monthly-panel"><div class="toolbar"><h2><span class="desktop-only">Посещаемость</span><span class="mobile-only">Месяц</span></h2><div class="actions"><input id="historyMonth" type="month" aria-label="Месяц журнала" value="'+historyMonth+'"></div></div>'+
    '<div class="filters"><div class="segments">'+subjects.map((name,i)=>'<button class="'+(i===subject?'active':'')+'" data-sub="'+i+'">'+name+'</button>').join('')+'</div>'+
    '<div class="search">'+icon('search')+'<input id="historyQuery" aria-label="Поиск ученика" placeholder="Поиск ученика" value="'+esc(query)+'"></div>'+
    '<select id="grade" aria-label="Класс"><option value="">Все классы</option>'+classes().map(g=>'<option '+(g===grade?'selected':'')+'>'+esc(g)+'</option>').join('')+'</select></div>'+
    '<div id="matrixScroll" class="matrix-wrap" tabindex="0" role="region" aria-label="Посещаемость за месяц, прокручивается по горизонтали"><table class="matrix"><thead><tr><th scope="col">Ученик</th>'+
    days.map(day=>'<th scope="col" class="'+(day===now?'today-col':'')+'"><button data-day-journal="'+day+'" title="'+viewDate(day)+'" aria-label="Журнал за '+viewDate(day)+'">'+day.slice(-2)+'</button></th>').join('')+
    '</tr></thead></table></div>'+
    '<div class="footer"><span id="historyCount"></span><div class="grid-legend"><span><b class="mark-yes">✓</b> Был</span><span><b class="mark-no">−</b> Не был</span><span><b class="mark-note">•</b> Есть тема</span></div>'+
    '</div></section>'+
    '<section class="panel history-notes"><div class="toolbar"><h2>Записи занятий</h2></div><div class="table-wrap"><table class="mobile-records history-note-table" role="table"><thead><tr><th>Дата</th><th>Преподаватель</th><th>Ученики</th><th>Что прошли</th></tr></thead><tbody id="historyRecords"></tbody></table></div></section></div>';
}
function positionHistoryGrid(grid,previousScroll){
  const active=grid.querySelector('thead .today-col');
  grid.scrollLeft=previousScroll??(active?Math.max(0,active.offsetLeft-grid.clientWidth*.72):0);
}
function showMobileHistory(view){
  mobileHistoryView=view;
  const layout=document.querySelector('.history-layout');
  const grid=$('matrixScroll');
  layout.dataset.view=view;
  for(const button of layout.querySelectorAll('[data-history-view]')){
    button.setAttribute('aria-pressed',String(button.dataset.historyView===view));
  }
  if(view==='attendance'&&grid.dataset.positioned!=='true'){
    positionHistoryGrid(grid,grid.savedScroll);
    grid.dataset.positioned='true';
  }
}
function shifts(){
  const dates=dateRange(month+'-01'), {settled}=counts(month);
  const offset=(new Date(dates[0]+'T12:00:00Z').getUTCDay()+6)%7;
  return title('Смены','Расписание и замены по месяцам','<input type="month" id="month" aria-label="Месяц смен" value="'+month+'">')+
    shiftSummary(month)+'<section class="panel"><div class="calendar">'+['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day=>'<small>'+day+'</small>').join('')+'<span></span>'.repeat(offset)+dates.map(key=>{
      const teacher=teacherOn(key), changed=Object.hasOwn(data.shifts,key);
      const name=teachers[teacher]??'Выходной';
      return '<button data-shift="'+key+'" aria-label="'+viewDate(key)+' · '+name+(changed?' · Замена':'')+'" class="'+(key===today()?'today ':'')+(changed?(settled.has(key)?'replacement-balanced':'replacement'):'')+'" '+(teacher===null?'disabled':'')+'>'+Number(key.slice(-2))+'<small>'+name+(changed?'<span class="shift-replacement"> · Замена</span>':'')+'</small></button>';
    }).join('')+'</div></section>';
}
function plan(){
  return title('Следующий урок','Подготовка по записям ученика')+
    '<section class="panel plan-panel"><form id="planForm">'+
    '<label>Ученик<select name="student" required><option value="">Выберите ученика</option>'+Object.entries(data.students).sort((a,b)=>a[1].name.localeCompare(b[1].name,'ru')).map(([id,s])=>
    '<option value="'+esc(id)+'">'+esc(s.name)+' · '+esc(s.grade)+'</option>').join('')+'</select></label>'+
    '<label>Предмет<select name="sub">'+subjects.map((s,i)=>'<option value="'+i+'" '+(i===subject?'selected':'')+'>'+s+'</option>').join('')+'</select></label>'+
    '<label>Темп<select name="readiness"><option value="check">Проверим в начале</option><option value="support">Нужно закрепить</option><option value="independent">Получается самостоятельно</option></select></label>'+
    '<div class="actions"><button class="primary" '+(!Object.keys(data.students).length?'disabled':'')+'>Подготовить урок</button></div></form><div id="planResult" aria-live="polite"></div></section>';
}
function renderConnectionState(){
  const status=$('syncStatus');
  status.hidden=remoteState==='ready';
  status.textContent={
    loading:'Загружаем записи…',
    offline:'Связь потеряна',
    denied:'Firebase не открыл раздел shared_public.',
    error:'Не удалось подключиться к Firebase.'
  }[remoteState]??'';
  if(remoteState==='error'||remoteState==='denied'){
    status.insertAdjacentHTML('beforeend',' <button type="button" data-retry>Повторить</button>');
  }
}

let journalScope;
function render(){
  renderConnectionState();
  const page=currentPage(), shift=byDate();
  const matrix=$('matrixScroll');
  const previousScroll=matrix?.dataset.month===historyMonth?(matrix.clientWidth?matrix.scrollLeft:matrix.savedScroll):null;
  document.body.dataset.page=page;
  $('nav').innerHTML=Object.entries(pages).map(([key,label])=>'<button data-page="'+key+'" '+(page===key?'class="active" aria-current="page"':'')+'>'+icon(key)+(mobilePages[key]?'<span class="desktop-only">'+label+'</span><span class="mobile-only">'+mobilePages[key]+'</span>':'<span>'+label+'</span>')+'</button>').join('');
  document.querySelector('.brand').href=journalHash('history');
  $('crumb').textContent='Смена / '+pages[page];
  $('daily').textContent=(teachers[shift]??'Выходной')+(Object.hasOwn(data.shifts,date)?' · замена':'')+' · '+viewDate(date);
  $('daily').hidden=page!=='shifts';
  const replacement=Object.hasOwn(data.shifts,date);
  const settled=page==='shifts'&&replacement&&counts(date.slice(0,7)).settled.has(date);
  $('daily').classList.toggle('replacement-text',replacement&&!settled);
  $('daily').classList.toggle('replacement-settled',settled);
  renderMiniSchedule();
  $('daily').disabled=shift===null;
  $('daily').dataset.shift=date;
  const content=$('content');
  const form=$('planForm');
  if(form&&page==='plan'&&(form.contains(document.activeElement)||$('planResult')?.textContent))return;
  content.innerHTML=({journal,history:historyPage,schedule:schedulePage,plan,shifts})[page]();
  if(page==='journal'){
    const scope=date+'|'+(currentLesson()?.id??'');
    if(scope!==journalScope){journalScope=scope;selected.clear();}
    updateTable();
  }
  if(page==='history'){
    updateHistory();
    const grid=$('matrixScroll');
    grid.dataset.month=historyMonth;
    grid.savedScroll=previousScroll;
    if(grid.clientWidth){
      positionHistoryGrid(grid,previousScroll);
      grid.dataset.positioned='true';
    }
  }
}
function openDialog(heading,body){
  const dialog=$('dialog');
  dialog.classList.remove('schedule-dialog');
  dialog.innerHTML='<div class="dialog-title"><h2>'+heading+'</h2><button type="button" aria-label="Закрыть" data-close>×</button></div>'+body;
  if(!dialog.open)dialog.showModal();
}
function studentDialog(id){
  const student=data.students[id]||{};
  openDialog(id?'Редактировать ученика':'Добавить ученика',
    '<form id="studentForm"><label>Имя и фамилия<input name="name" value="'+esc(student.name)+'" required maxlength="100"></label><label>Класс<input name="grade" value="'+esc(student.grade)+'" placeholder="Например, 4 класс" required maxlength="24"></label><label>Возраст <small>По желанию</small><input name="age" type="number" min="4" max="25" value="'+esc(student.age)+'"></label><div class="actions"><button class="primary">Сохранить</button></div></form>');
  $('studentForm').dataset.id=id;
}
function noteDialog(ids, day=date, lesson=currentPage()==='journal'?currentLesson():null){
  if(!canWriteJournal(day)||!ids.length)return;
  if(teacherOn(day)===null){message('На воскресенье смена не запланирована');return;}
  const sub=lesson?.subject??subject;
  const previous=ids.length===1?(lesson?lessonRecord(ids[0],day,lesson):stored(ids[0],day,sub)):null;
  openDialog('Запись занятия','<form id="noteForm"><small>'+esc(ids.map(id=>data.students[id].name).join(', '))+' · '+viewDate(day)+' · '+subjects[sub]+'</small><label>Тема пройденного материала<textarea name="raw" maxlength="2000" placeholder="Например: с плас плас, цин, циаут, базовая арифметика" required>'+esc(previous?.raw??previous?.note)+'</textarea></label><div class="actions"><button type="button" data-draft>Сформулировать тезис</button></div><label id="draftLabel" hidden>Тезис для коллеги<textarea name="note" maxlength="2000" placeholder="Можно поправить перед сохранением">'+esc(previous?.note)+'</textarea></label><small id="draftHint" aria-live="polite"></small><div class="actions">'+(previous?.note?'<button type="button" data-remove-note>Снять отметку и тему</button>':'')+'<button class="primary">Сохранить и отметить «Был»</button></div></form>');
  const form=$('noteForm');
  form.ids=ids;
  form.context={date:day,subject:sub,teacher:previous?.teacher??teacherOn(day)};
  form.lesson=lesson;
  if(previous?.note)$('draftLabel').hidden=false;
  form.elements.raw.focus();
}
function shiftDialog(key){
  const base=planned(key), actual=data.shifts[key]??base;
  if(base===null)return;
  openDialog('Смена · '+viewDate(key),'<form id="shiftForm"><small>По расписанию: '+teachers[base]+'</small><label>Кто ведёт занятия<select name="teacher">'+teachers.map((name,i)=>'<option value="'+i+'" '+(i===actual?'selected':'')+'>'+name+(i===base?' · по расписанию':' · замена')+'</option>').join('')+'</select></label><div class="actions"><button class="primary">Сохранить смену</button></div></form>');
  $('shiftForm').dataset.day=key;
}
function attendanceDialog(id,day=date,lesson=currentPage()==='journal'?currentLesson():null){
  if(!canWriteJournal(day))return;
  if(teacherOn(day)===null){message('На воскресенье смена не запланирована');return;}
  const sub=lesson?.subject??subject;
  const record=lesson?lessonRecord(id,day,lesson):stored(id,day,sub);
  openDialog('Посещение · '+viewDate(day),'<form id="attendanceForm"><small>'+esc(data.students[id].name)+' · '+subjects[sub]+(lesson?' · '+esc(lesson.start):'')+'</small>'+
    (record?.note?'<p class="dialog-note">'+esc(record.note)+'</p>':'')+
    '<div class="actions">'+['','no','yes'].map(value=>
      '<button name="status" value="'+value+'" '+(value===(record?.status||'')?'class="current"':'')+' '+(record?.note&&value===''?'disabled':'')+'>'+statuses(value)+'</button>'
    ).join('')+'</div><div class="actions"><button type="button" class="primary" data-note="'+esc(id)+'" data-day="'+day+'">'+(record?.note?'Редактировать тему':'Записать тему')+'</button></div></form>');
  $('attendanceForm').dataset.id=id;
  $('attendanceForm').dataset.day=day;
  $('attendanceForm').lesson=lesson;
  $('attendanceForm').sub=sub;
}
function absenceDialog({id,day,lesson,sub},row){
  openDialog('Причина отсутствия','<form id="absenceForm"><small>'+esc(data.students[id].name)+' · '+viewDate(day)+' · '+subjects[sub]+'</small>'+
    '<label>Причина<select name="reason" required><option value="">Выберите причину</option>'+
    Object.entries(absenceReasons).map(([key,label])=>'<option value="'+key+'" '+(key===row?.reason?'selected':'')+'>'+label+'</option>').join('')+
    '</select></label><label id="absenceDetail" '+(row?.reason==='other'?'':'hidden')+'>Другая причина<input name="detail" maxlength="160" value="'+esc(row?.reasonDetail)+'" '+(row?.reason==='other'?'required':'disabled')+'></label>'+
    '<p id="absenceError" class="form-error" role="alert"></p><div class="actions"><button type="button" data-attendance-back>Назад</button><button class="primary">Сохранить «Не был»</button></div></form>');
  const form=$('absenceForm');
  form.context={id,day,lesson,sub,period:row?row.period:lesson?.id,teacher:row?.teacher??teacherOn(day)};
  $('dialog').querySelector('[data-close]').hidden=true;
  form.elements.reason.focus();
}
function viewHistoryCell(id,day){
  const rows=Object.values(data.records).filter(row=>row.student===id&&row.date===day&&row.subject===subject);
  const body=rows.map(row=>{
    const lesson=scheduleFor(day).find(item=>item.id===row.period);
    return '<div class="history-cell-entry"><strong>'+statuses(row.status)+(lesson?' · '+esc(lesson.start):'')+'</strong>'+(row.note?'<p>'+esc(row.note)+'</p>':'')+'</div>';
  }).join('');
  openDialog(esc(data.students[id].name)+' · '+viewDate(day),body||'<p class="muted">Нет отметки или темы за этот день</p>');
}
function localDraft(raw){
  const cleaned=raw.trim().replace(/с\s*(?:плюс|плас)\s*(?:плюс|плас)/giu,'C++').replace(/(цин|син)(?![\p{L}])/gu,'cin').replace(/(циаут|ци аут|си аут|синаут|циоут|сикаут)(?![\p{L}])/gu,'cout').replace(/\s+/g,' ').replace(/[.!,;]+$/,'');
  return /\?$/.test(cleaned)?cleaned:'На занятии: '+cleaned+'.';
}
function draft(){
  const form=$('noteForm'), raw=form.elements.raw.value.trim();
  if(!raw){form.elements.raw.reportValidity();return;}
  form.elements.note.value=localDraft(raw);
  form.dataset.drafted='true';
  $('draftLabel').hidden=false;
}
function goToJournal(day,lesson=null){
  date=day;month=day.slice(0,7);activeLesson=lesson;selected.clear();
  if(currentPage()==='journal'){
    render();
    if(lesson)$('scheduledRoster')?.scrollIntoView?.({block:'nearest'});
  }else location.hash=journalHash('journal');
}
function submitError(error,button){
  if($('scheduleError'))showScheduleError(error.message);
  else if($('absenceError'))$('absenceError').textContent=error.message;
  else notify(error);
  if(button)button.disabled=false;
}
document.addEventListener('click',async event=>{
  if(miniOpen&&!event.target.closest('.schedule-widget')){
    miniOpen=false;
    renderMiniSchedule();
  }
  const button=event.target.closest('button');
  if(!button)return;
  const b=button.dataset;
  try{
    if(b.retry!==undefined){location.reload();return;}
    if(b.page){if(b.page==='journal')goToJournal(workingDate());else location.hash=journalHash(b.page);return;}
    if(b.historyView){showMobileHistory(b.historyView);return;}
    if(b.sub!==undefined){subject=Number(b.sub);selected.clear();render();return;}
    if(b.student!==undefined){studentDialog(b.student);return;}
    if(b.note!==undefined){noteDialog([b.note],b.day);return;}
    if(b.cell){viewHistoryCell(b.cell,b.day);return;}
    if(b.openLesson){goToJournal(date,b.openLesson);return;}
    if(b.liveLesson!==undefined){goToJournal(workingDate());return;}
    if(b.scheduleView){
      scheduleSelection=b.scheduleView;
      render();
      $('scheduleRoster')?.scrollIntoView?.({block:'nearest'});
      return;
    }
    if(b.miniToggle!==undefined){miniOpen=!miniOpen;renderMiniSchedule();return;}
    if(b.miniFull!==undefined){
      miniOpen=false;scheduleDate=workingDate();scheduleSelection='';renderMiniSchedule();
      if(currentPage()==='schedule')render();else location.hash=journalHash('schedule');
      return;
    }
    if(b.attendanceBack!==undefined){
      const {id,day,lesson}=$('absenceForm').context;
      attendanceDialog(id,day,lesson);
      return;
    }
    if(b.scheduleImport!==undefined){editSchedule('photo');return;}
    if(b.scheduleEditor!==undefined){editSchedule('manual');return;}
    if(b.scheduleExample!==undefined){editSchedule('example');return;}
    if(b.scheduleAdd!==undefined){scheduleDraft.rows.push(emptyLesson());renderScheduleDraft();return;}
    if(b.scheduleRemove!==undefined){scheduleDraft.rows.splice(Number(b.scheduleRemove),1);renderScheduleDraft();return;}
    if(b.photoRead!==undefined){await readSchedulePhoto();return;}
    if(b.photoRotate!==undefined){
      scheduleDraft.rotation=((scheduleDraft.rotation??0)+90)%360;
      showSchedulePhoto();
      return;
    }
    if(b.dayJournal){goToJournal(b.dayJournal,b.targetLesson??null);return;}
    if(b.bulk!==undefined){noteDialog([...selected]);return;}
    if(b.shift){shiftDialog(b.shift);return;}
    if(b.attendance){attendanceDialog(b.attendance);return;}
    if(b.close!==undefined){if(!pending&&!$('absenceForm'))$('dialog').close();return;}
    if(b.draft!==undefined){draft();return;}
    if(b.removeNote!==undefined){
      const {ids,context,lesson}=button.form;
      const id=ids[0], old=lesson?lessonRecord(id,context.date,lesson):stored(id,context.date,context.subject);
      const k=recordKey(context.date,context.subject,id,old?.period);
      if(!canWriteJournal(context.date))return;
      await save({['records/'+k]:null});
      $('dialog').close();message('Отметка и тема сняты');return;
    }
  }catch(error){notify(error);}
});
document.addEventListener('change',event=>{
  const target=event.target;
  if(target.id==='scheduleDate'&&target.value){scheduleDate=target.value;scheduleSelection='';render();return;}
  if(target.id==='journalLesson'){goToJournal(date,target.value);return;}
  if(target.form?.id==='absenceForm'&&target.name==='reason'){
    const other=target.value==='other', detail=target.form.elements.detail;
    $('absenceDetail').hidden=!other;detail.disabled=!other;detail.required=other;
    if(other)detail.focus();
    return;
  }
  if(target.id==='schedulePhoto'||target.id==='scheduleCamera'){
    setSchedulePhoto(target.files[0]).catch(error=>showScheduleError(error.message));
    return;
  }
  if(target.form?.id==='scheduleForm'){updateScheduleDraft(target);return;}
  if(target.form?.id==='planForm'){
    if(target.form.dataset.busy!=='true')$('planResult').replaceChildren();
    return;
  }
  if(target.dataset.select){
    if(target.checked)selected.add(target.dataset.select);else selected.delete(target.dataset.select);
    updateTable();[...$('rows').querySelectorAll('input')].find(input=>input.dataset.select===target.dataset.select)?.focus();return;
  }
  if(target.id==='all'||target.id==='allMobile'){
    const checked=target.checked;
    for(const [id] of (currentLesson()?rosterFor(currentLesson()):visible())){if(checked)selected.add(id);else selected.delete(id);}
    updateTable();return;
  }
  if(target.id==='grade'){grade=target.value;selected.clear();render();}
  if(target.id==='journalDate'&&target.value)goToJournal(target.value);
  if(target.id==='month'&&target.value){month=target.value;render();}
  if(target.id==='historyMonth'&&target.value){historyMonth=target.value;render();}
});
$('dialog').addEventListener('cancel',event=>{
  if(pending||$('absenceForm'))event.preventDefault();
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&miniOpen&&!$('dialog').open){miniOpen=false;renderMiniSchedule();$('miniScheduleToggle').focus();}
});
document.addEventListener('paste',event=>{
  if(!$('scheduleForm')||!$('dialog').open)return;
  const image=Array.from(event.clipboardData?.items??[]).find(item=>item.kind==='file'&&item.type.startsWith('image/'))?.getAsFile()??
    Array.from(event.clipboardData?.files??[]).find(file=>file.type.startsWith('image/'));
  if(!image)return;
  event.preventDefault();
  setSchedulePhoto(image).catch(error=>showScheduleError(error.message));
});
document.addEventListener('input',event=>{
  if(event.target.form?.id==='scheduleForm'&&event.target.matches('[data-grade],[data-time]'))updateScheduleDraft(event.target);
  if(event.target.id==='query'){query=event.target.value;selected.clear();updateTable();}
  if(event.target.id==='historyQuery'){query=event.target.value;selected.clear();updateHistory();}
  if(event.target.name==='raw'&&event.target.form?.id==='noteForm'){
    delete event.target.form.dataset.drafted;event.target.form.elements.note.value='';$('draftLabel').hidden=true;$('draftHint').textContent='';
  }
});
document.addEventListener('submit',async event=>{
  const form=event.target;
  if(!form.id)return;
  event.preventDefault();
  const button=event.submitter;
  if(button)button.disabled=true;
  const values=new FormData(form);
  const value=name=>String(values.get(name)||'').trim();
  try{
    if(form.id==='scheduleForm'){
      if(!await saveScheduleDraft()){if(button)button.disabled=false;return;}
      $('dialog').close();
      return;
    }else if(form.id==='studentForm'){
      const name=value('name'), grade=value('grade'), age=value('age');
      if(!name||!grade)throw Error('Укажите имя и класс');
      await save({['students/'+(form.dataset.id||crypto.randomUUID())]:{name,grade,...(age?{age:Number(age)}:{})}});
      message('Ученик сохранён');
    }else if(form.id==='noteForm'){
      const raw=value('raw'), note=value('note')||(form.dataset.drafted?'':localDraft(raw)), context=form.context;
      if(!canWriteJournal(context.date))throw Error('Отметки доступны за сегодня');
      if(!raw)throw Error('Введите ключевые слова');
      if(!note||(!value('note')&&/\?$/.test(raw)))throw Error('Добавьте подтверждённую тему занятия');
      const changes=Object.fromEntries(form.ids.map(id=>{
        const previous=form.lesson?lessonRecord(id,context.date,form.lesson):null;
        const period=previous?previous.period:form.lesson?.id;
        return ['records/'+recordKey(context.date,context.subject,id,period),{...context,student:id,status:'yes',raw,note,...(period?{period}:{})}];
      }));
      await save(changes);selected.clear();render();message('Тема и посещение сохранены');
    }else if(form.id==='shiftForm'){
      const key=form.dataset.day, teacher=Number(value('teacher'));
      await save({['shifts/'+key]:teacher===planned(key)?null:teacher});message('Смена сохранена');
    }else if(form.id==='attendanceForm'){
      const id=form.dataset.id, day=form.dataset.day, status=button?.value, sub=form.sub, lesson=form.lesson;
      if(!canWriteJournal(day))throw Error('Отметки доступны за сегодня');
      const row=lesson?lessonRecord(id,day,lesson):stored(id,day,sub);
      if(status==='yes'){noteDialog([id],day,lesson);return;}
      if(status==='no'){absenceDialog({id,day,lesson,sub},row);return;}
      if(status!=='')return;
      if(row?.note)throw Error('Сначала снимите тему занятия');
      await save({['records/'+recordKey(day,sub,id,row?row.period:lesson?.id)]:null});
      message('Отметка снята');
    }else if(form.id==='absenceForm'){
      const {id,day,sub,teacher,period}=form.context;
      if(!canWriteJournal(day))throw Error('Отметки доступны за сегодня');
      const reason=value('reason'), detail=value('detail');
      if(!Object.hasOwn(absenceReasons,reason)||reason==='other'&&!detail)throw Error('Укажите причину отсутствия');
      await save({['records/'+recordKey(day,sub,id,period)]:{date:day,subject:sub,student:id,status:'no',teacher,reason,
        ...(reason==='other'?{reasonDetail:detail}:{}),...(period?{period}:{})}});
      message('Причина отсутствия сохранена');
    }else if(form.id==='planForm'){
      const student=data.students[value('student')], sub=Number(value('sub'));
      if(!student)throw Error('Выберите ученика');
      const history=Object.values(data.records).filter(r=>r.student===value('student')&&r.subject===sub&&r.status==='yes'&&r.note)
        .sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).map(({date,note})=>({date,note}));
      const notes=history.map(record=>record.note);
      const readiness=value('readiness');
      const output=$('planResult');
      output.innerHTML=lessonMarkup(fallbackPlan(sub,student,notes,readiness),notes[0],false);
      if(button)button.disabled=false;
      return;
    }
    $('dialog').close();
  }catch(error){submitError(error,button);}
});
window.addEventListener('hashchange',()=>{
  const previousPage=document.body.dataset.page;
  render();
  if(previousPage!==currentPage()&&matchMedia('(max-width: 700px), (max-width: 950px) and (pointer: coarse)').matches)window.scrollTo(0,0);
});
render();
connectJournal();
let renderedTime=clockTime(), renderedDay=workingDate();
setInterval(()=>{
  const time=clockTime(), day=workingDate();
  if($('dialog').open||time===renderedTime&&day===renderedDay)return;
  if(day!==renderedDay&&date===renderedDay)date=day;
  renderedTime=time;renderedDay=day;
  if(currentPage()==='journal'||currentPage()==='schedule')render();
  else if(miniOpen)renderMiniSchedule();
},15000);
