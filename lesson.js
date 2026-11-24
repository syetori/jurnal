'use strict';

function confirmedLessonText(note, separator=' '){
  if(typeof note!=='string')return '';
  const intent=/^(?:(?:python|пайтон|scratch|скретч|[cс]\+\+)\s*:\s*)?(?:вопросы?|что такое|зачем|как|можно ли|планы?|планируем|(?:на )?следующ[а-яё]* урок[а-яё]*|дальше|на будущее|будем|домашнее задание|домашка|(?:но\s+)?не)(?=$|[\s:–-])/iu;
  const unfinished=/(?:^|\s)(?:ещё\s+)?не\s+(?:проходил[аи]?|прошл[аи]?|разобрал[аи]?|разбирал[аи]?|успел[аи]?|делал[аи]?|изучал[аи]?|изучил[аи]?|пробовал[аи]?)(?=$|\s|[.!?,])/iu;
  return note.replace(/^\s*На занятии:\s*/iu,'').split(/(?<=[.!?])\s+|[\n;]|,(?!\d)|\s+(?=но\s+не\s)/iu)
    .map(text=>text.trim()).filter(text=>text&&!/\?[!?]*$/u.test(text)&&!intent.test(text)&&!unfinished.test(text))
    .map(text=>text.replace(/[.!]+$/u,'').trim()).filter(Boolean).join(separator);
}

const programmingTools = [
  ['scratch',/scratch|скретч|скрэтч/iu],
  ['python',/python|пайтон|питон/iu],
  ['c++',/c\+\+|с\+\+|с\s*(?:плюс|плас)\s*(?:плюс|плас)|\bcin\b|\bcout\b|цин|циаут/iu]
];

// Each entry starts from an example from the recorded topic and adds at most one step.
const lessonTracks = [
  {
    subject:0, match:/python/i, check:/словар|\bdict\b|ключ[аиуы]?\s+и\s+значен/iu,
    introduced:/добавл[яе]|добавил|нов[ыо][йе]\s+ключ/iu,
    review:'Ключи и значения в Python', next:'Добавление записи в словарь Python',
    material:'Подготовьте словарь с двумя знакомыми ключами. Покажите, где ключ, а где значение.',
    example:'points = {"кот": 2, "пёс": 4}\nprint(points["кот"])  # 2',
    practice:'Предложите вывести значение для ключа «пёс», затем поменять его с 4 на 5 и повторить проверку.',
    checkpoint:'Ученик указывает ключ и сам получает нужное значение.',
    task:'Выведи количество очков для одного выбранного животного.',
    extension:'Добавь запись points["лиса"] = 3. Выведи значение для нового ключа.'
  },
  {
    subject:0, match:/python/i, check:/услови|ветвлен|\bif\b|\belse\b/iu,
    introduced:/\belse\b|иначе/iu,
    review:'Условие if в Python', next:'Два исхода условия в Python',
    material:'Подготовьте числовой пример и карточки «да» и «нет». Сначала проверьте условие устно.',
    example:'points = 3\nif points >= 3:\n    print("Готово")',
    practice:'Поменяйте значение на 2. Пусть ученик предскажет, появится ли надпись, и проверит запуском.',
    checkpoint:'Ученик проверяет оба значения и объясняет, при каком из них выполняется print.',
    task:'Проверь условие при points = 2 и points = 4. Отметь, когда появится надпись.',
    extension:'Добавь else с print("Ещё один шаг") в теле ветки. Проверь оба исхода.'
  },
  {
    subject:0, match:/python/i, check:/списк|массив|\blist\b/iu,
    introduced:/\bappend\b|добавл[яе]|добавил/iu,
    review:'Элементы списка в Python', next:'Добавление элемента в список Python',
    material:'Подготовьте список из трёх цветов. Пронумеруйте его элементы с нуля.',
    example:'colors = ["красный", "синий", "зелёный"]\nprint(colors[0])  # красный',
    practice:'Пусть ученик попробует индекс 1, сначала устно предсказав ответ.',
    checkpoint:'Ученик сам выбирает индекс нужного элемента и проверяет вывод.',
    task:'Выведи последний цвет из списка по его индексу.',
    extension:'Добавь colors.append("жёлтый") и выведи весь список, чтобы проверить результат.'
  },
  {
    subject:0, match:/c\+\+/i, check:/арифмет|сложен|вычитан|умножен|делени|вычисл|(?:^|\s)(?:сумм[ауые]?|разност[ьи])(?=$|\s)/iu,
    introduced:/ввод.*двух|cin.*>>.*>>/iu,
    review:'Арифметика в C++', next:'Ввод двух чисел и вычисление в C++',
    material:'Подготовьте шаблон с #include <iostream> и int main(). Используйте небольшие целые числа.',
    example:'int a = 6, b = 2;\nstd::cout << a + b;  // 8',
    practice:'Пусть ученик заменит плюс на минус, предскажет результат и проверит запуском.',
    checkpoint:'Ученик объясняет, какие числа участвуют в выражении и как выбор знака влияет на вывод.',
    task:'Запусти пример со значениями 5 и 2. Выведи сумму, затем разность.',
    extension:'Добавь std::cin >> a >> b; перед вычислением и проверь, как меняется ответ при другом вводе.'
  },
  {
    subject:0, match:/scratch|скретч|скрэтч/i, check:/движ|шаг|координат|перемест/i,
    introduced:/пробел|клавиш/iu,
    review:'Движение персонажа в Scratch', next:'Управление движением в Scratch',
    material:'Откройте редактор Scratch, выберите один спрайт и найдите блок «идти 10 шагов».',
    example:'Соберите «когда щёлкнут по флагу → идти 10 шагов». Запустите и сравните положение спрайта до и после.',
    practice:'Пусть ученик заменит 10 на 20 и сначала предположит, что изменится.',
    checkpoint:'Ученик сам находит блок движения и может показать, какое число задаёт расстояние.',
    task:'Сделай, чтобы при нажатии флага спрайт прошёл 15 шагов. Проверь на сцене.',
    extension:'Добавь второй запуск движения: «когда клавиша пробел нажата → идти 10 шагов». Протестируй флаг и пробел по очереди.'
  },
  {
    subject:0, match:/python|пайтон|питон/i, check:/перемен|значен|присваив/i,
    review:'Значения переменных в Python', next:'Изменение значения переменной в Python',
    material:'Откройте редактор Python. Используйте одну переменную и вывод через print.',
    example:'points = 3\nprint(points)  # 3',
    practice:'Пусть ученик заменит 3 на 5, предскажет вывод и запустит код.',
    checkpoint:'Ученик сам меняет число и объясняет связь между строкой присваивания и выводом.',
    task:'Создай переменную stars со значением 4 и выведи её. Затем поменяй значение на 6.',
    extension:'Добавь строку stars = stars + 1 перед print(stars). Предскажи и проверь вывод.'
  },
  {
    subject:0, match:/c\+\+|с\+\+|cin|cout/i, check:/cin|cout|ввод|вывод/i,
    review:'Ввод и вывод числа в C++', next:'Ввод и вычисление в C++',
    material:'Подготовьте шаблон с #include <iostream> и int main(). Разберите отдельно, куда попадает введённое число и что появляется в консоли.',
    example:'int number{};\nstd::cin >> number;\nstd::cout << number << "\\n";\n// Если ввести 7, программа напечатает 7.',
    practice:'Пусть ученик запустит пример дважды с разными числами и покажет строки ввода и вывода.',
    checkpoint:'Ученик сам добавляет строки ввода и вывода в шаблон и может проверить их в консоли.',
    task:'Считай целое число, сохрани его в переменной age и выведи. Проверь на значениях 8 и 12.',
    extension:'Замени вывод на std::cout << number + 1; и проверь, что ввод 7 даёт 8.'
  },
  {
    subject:1, match:/маршрут|движен|команд|клетк|поворот/i,
    introduced:/поворот|повернул/iu,
    review:'Робот выполняет команды по порядку', next:'Маршрут с одним поворотом',
    material:'Подготовьте робота или фигурку, лист в клетку и стрелки. Поставьте фигурку в нижний левый угол лицом вверх.',
    example:'Команды «вперёд, вперёд» ведут фигурку на две клетки вверх. Произнесите команды по очереди и отмечайте клетки.',
    practice:'Пусть ученик разложит стрелки для одной или трёх клеток, затем проведёт фигурку.',
    checkpoint:'Ученик последовательно выполняет свои команды и останавливает фигурку в целевой клетке.',
    task:'Нарисуй прямой маршрут на три клетки. Запиши команды и проверь их фигуркой.',
    extension:'После первой клетки поверни направо и пройди ещё одну клетку. Отметь, где остановится фигурка.'
  },
  {
    subject:2, match:/файл|папк|сохранен/i,
    introduced:/перемещ|перенос/iu,
    review:'Сохранение и поиск файла', next:'Перемещение файла в нужную папку',
    material:'Откройте файловый менеджер и подготовьте тестовую папку «Урок» и файл «Кот.png».',
    example:'Откройте папку «Урок», найдите «Кот.png», закройте папку и снова откройте файл через неё.',
    practice:'Пусть ученик повторит поиск и вслух назовёт сначала папку, потом файл.',
    checkpoint:'Ученик сам находит нужный файл по пути из двух названий.',
    task:'Найди файл «Кот.png» в папке «Урок» и открой его. Затем повтори с файлом «Дом.png».',
    extension:'Создай папку «Рисунки» и перемести туда копию «Кот.png». Покажи, где её теперь искать.'
  }
];

const introductoryTopics = [
  {
    review:'Команды по порядку', next:'Команды по порядку',
    material:'Приготовьте три карточки со стрелками и лист в клетку. Одна стрелка означает один шаг.',
    example:'Из нижней левой клетки выполним «вверх, вверх, вправо». Фишка остановится на две клетки выше и на одну правее.',
    practice:'Поменяйте последнюю стрелку на «вверх». Пусть ученик заранее покажет точку остановки.',
    checkpoint:'Ученик правильно выполняет три команды и называет, какая идёт первой.',
    task:'Составь три команды, чтобы фишка дошла до соседней клетки справа и затем поднялась на две клетки.',
    extension:'Придумай другой порядок трёх команд для той же конечной клетки и проверь его.'
  },
  lessonTracks.find(track=>track.subject===1),
  lessonTracks.find(track=>track.subject===2)
];

function trackForLesson(subject,latest,history){
  let tool='';
  if(subject===0){
    const explicit=programmingTools.filter(([,pattern])=>pattern.test(latest));
    const possible=explicit.length?explicit:programmingTools.filter(([,pattern])=>history.some(note=>pattern.test(note)));
    if(possible.length!==1)return undefined;
    tool=possible[0][0];
  }
  return lessonTracks.find(entry=>entry.subject===subject&&entry.match.test(subject===0?tool:latest)&&
    (!entry.check||entry.check.test(latest)));
}

function fallbackPlan(subject, student, notes, readiness){
  const confirmed=notes.map(note=>confirmedLessonText(note)).filter(Boolean);
  const latest=confirmed[0];
  const age=typeof student.age==='number'||typeof student.age==='string'?Number(student.age):NaN;
  const younger=(age>0&&age<=8)||Number(student.grade?.match(/\d+/u)?.[0]??99)<=2;
  const match=latest?trackForLesson(subject,latest,confirmed.slice(1)):undefined;
  const track=latest?match:introductoryTopics[subject];
  const alreadyIntroduced=match?.introduced?.test(latest);
  const advancing=Boolean(match&&readiness==='independent'&&!alreadyIntroduced);
  const support=readiness==='support';
  if(!track){
    return {
      topic:'Закрепление последней темы',
      goal:'Уточнить, какой шаг из прошлого занятия ученик может повторить самостоятельно.',
      warmup:'Напомните тему из журнала и попросите ученика показать на прошлой работе один знакомый шаг.',
      material:'Откройте работу с прошлого занятия. Подготовьте её копию, чтобы ученик мог пробовать в своём темпе.',
      example:'Покажите на оригинале один шаг из записи. Например, верните работу на один шаг назад в копии и повторите действие вместе.',
      practice:support||younger?'Пусть ученик повторит именно этот шаг рядом с вами. Если нужно, дайте одну подсказку.':'Пусть ученик повторит шаг в копии и покажет, как проверить результат.',
      checkpoint:'Ученик повторяет действие без подсказки и может показать результат. Если нужна помощь, повторите пример вместе.',
      tasks:['Повтори выбранное действие в копии работы.','Покажи, что изменилось после действия.'],
      extension:support?'Ещё раз повторите этот шаг с той же подсказкой.':
        'Если получилось самостоятельно, измените один параметр в знакомом примере и сравните результат.'
    };
  }
  return {
    topic:advancing?track.next:track.review,
    goal:advancing?'Начать со знакомого примера и добавить один шаг после короткой проверки.':'Повторить один шаг, проверить результат и закрепить его коротким заданием.',
    warmup:latest?'Попросите ученика показать знакомое действие по последней записи. Дайте время попробовать самостоятельно.':'Покажите материал и спросите, чего ученик ожидает после первого действия.',
    material:track.material,
    example:track.example,
    practice:(support||younger?'Сначала сделайте один шаг вместе. ':'')+track.practice,
    checkpoint:track.checkpoint,
    tasks:[younger||support?'Повтори показанный пример с одной небольшой заменой.':track.task,
      advancing?'После успешной проверки: '+track.extension:
      (younger||support?'Покажи, что получилось.':'Проверь результат ещё раз и коротко объясни, как ты его получил.')],
    extension:advancing?'Если новый шаг уже получается, поменяйте одно число или одну команду в этом же примере и проверьте результат.':
      support||alreadyIntroduced?'Повторите то же действие на втором коротком примере.':track.extension
  };
}

function completeLesson(plan){
  const fields=['topic','goal','warmup','material','example','practice','checkpoint','extension'];
  return plan&&fields.every(key=>typeof plan[key]==='string'&&plan[key].trim())&&
    Array.isArray(plan.tasks)&&plan.tasks.length>0&&plan.tasks.every(task=>typeof task==='string'&&task.trim());
}

function lessonMarkup(plan, latest, viaAI){
  const rows=[
    ['Разминка · 5 мин',plan.warmup],['Материал · 5 мин',plan.material],
    ['Пример · 6 мин',plan.example],['Практика · 10 мин',plan.practice],['Проверка · 4 мин',plan.checkpoint]
  ];
  return '<article class="lesson"><div class="lesson-heading"><small>'+(viaAI?'План по записям ученика':'План на основе журнала')+
    '</small><h2>'+esc(plan.topic)+'</h2><p>'+esc(plan.goal)+'</p>'+
    (latest?'<small>Последняя запись · '+esc(latest)+'</small>':'<small>По предмету пока нет записей</small>')+
    '</div><table class="lesson-table"><tbody>'+rows.map(([label,description])=>
      '<tr><th scope="row">'+label+'</th><td>'+esc(description)+'</td></tr>'
    ).join('')+'</tbody></table><div class="lesson-tasks"><h3>Задания · 10 мин</h3><ol>'+
    plan.tasks.map(task=>'<li>'+esc(task)+'</li>').join('')+
    '</ol><p><strong>Если готов к следующему шагу</strong> '+esc(plan.extension)+'</p></div></article>';
}
