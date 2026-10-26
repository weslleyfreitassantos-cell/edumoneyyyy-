const choice = (skillCode, difficulty, instruction, prompt, options, answer, explanation, dialogueSpeaker = null, dialogueContext = []) => ({
  type: 'MULTIPLE_CHOICE', skillCode, difficulty, instruction, prompt, options, accepted: [answer], explanation,
  ...(dialogueSpeaker ? { dialogueSpeaker, dialogueContext } : {}),
});

const order = (skillCode, difficulty, prompt, answer, explanation) => ({
  type: 'WORD_ORDER', skillCode, difficulty, instruction: 'Monte a frase na ordem correta.', prompt,
  wordBank: answer.replace(/[.,!?]/g, '').split(' ').reverse().map((word, index) => index === 0 ? `${word}.` : word),
  accepted: [answer], explanation,
});

const translation = (skillCode, difficulty, prompt, accepted, explanation) => ({
  type: 'TRANSLATION', skillCode, difficulty, instruction: 'Escreva uma tradução natural em inglês.', prompt,
  accepted, explanation,
});

const listening = (skillCode, difficulty, prompt, audioText, accepted, explanation) => ({
  type: 'LISTENING', skillCode, difficulty, instruction: 'Ouça a fala e responda sem ver a transcrição.', prompt,
  audioText, accepted, explanation,
});

const matching = (skillCode, difficulty, pairs, explanation) => ({
  type: 'MATCHING', skillCode, difficulty, instruction: 'Associe cada expressão ao significado.',
  prompt: 'Encontre os pares correspondentes.', leftItems: Object.keys(pairs), rightItems: Object.values(pairs), answerKey: { pairs }, explanation,
});

const fill = (skillCode, difficulty, prompt, options, answer, explanation) => ({
  type: 'FILL_BLANK', skillCode, difficulty, instruction: 'Escolha a palavra que completa a frase.', prompt,
  options, accepted: [answer], explanation,
});

const speaking = (skillCode, difficulty, prompt, audioText, accepted, explanation) => ({
  type: 'SPEAKING', skillCode, difficulty, instruction: 'Ouça o exemplo e repita. A transcrição é apenas um apoio, não uma nota de pronúncia.',
  prompt, audioText, accepted, explanation,
});

const dialogue = (skillCode, difficulty, speaker, prompt, options, answer, explanation, dialogueContext = []) =>
  choice(skillCode, difficulty, 'Conversa guiada · escolha uma resposta que mantenha o diálogo.', prompt, options, answer, explanation, speaker, dialogueContext);

export const course = {
  course: {
    code: 'TEC_ENGLISH_FOUNDATIONS_V2',
    version: 2,
    title: 'Inglês em conversas do cotidiano',
    description: 'Pratique rotinas, escola, família e lugares em diálogos curtos e situações do dia a dia.',
    author: 'Equipe de conteúdo Tec Escola',
    publicationStatus: 'STAGING',
    reviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    xpReward: 30,
  },
  units: [
    {
      id: 'english-v2-unit-4', order: 4, title: 'Minha rotina',
      description: 'Fale sobre horários, atividades diárias e planos da semana.',
      lessons: [
        {
          id: 'english-v2-u4-l1', order: 1, title: 'Meu dia começa',
          description: 'Pergunte e responda sobre os primeiros momentos do dia.',
          objective: 'Usar verbos simples e horários para descrever uma rotina da manhã.',
          introduction: 'A rotina ganha sentido quando juntamos uma ação e um horário. Observe como a conversa avança da hora de acordar para a próxima atividade.',
          exercises: [
            dialogue('routine_time', 1, 'Mia', 'What time do you wake up?', ['I wake up at seven.', 'It is Tuesday.', 'The library is near the school.'], 'I wake up at seven.', 'A pergunta “What time…” pede um horário; “at seven” informa a hora.'),
            dialogue('routine_time', 2, 'Mia', 'What do you do after breakfast?', ['I go to school.', 'My sister is eleven.', 'Turn left at the park.'], 'I go to school.', 'A resposta continua o assunto da rotina com uma atividade depois do café.', [{ speaker: 'Mia', text: 'What time do you wake up?' }, { speaker: 'Você', text: 'I wake up at seven.' }]),
            order('word_order', 1, 'Monte: “Eu tomo café da manhã às sete.”', 'I have breakfast at seven.', 'A ordem básica é pessoa, ação e complemento; “at seven” indica o horário.'),
            translation('routine_time', 2, 'Eu vou para a escola de manhã.', ['I go to school in the morning.'], '“In the morning” é uma forma natural de dizer “de manhã”.'),
            listening('listening_comprehension', 2, 'Que horário aparece na frase?', 'I wake up at six thirty.', ['six thirty', '6:30', 'half past six'], '“Six thirty” corresponde a seis e meia.'),
            matching('routine_vocabulary', 1, { 'wake up': 'acordar', 'have breakfast': 'tomar café da manhã', 'go to school': 'ir para a escola' }, 'As expressões descrevem ações comuns do começo do dia.'),
            fill('simple_present', 2, 'I ___ breakfast before school.', ['have', 'has', 'am'], 'have', 'Com “I”, usamos “have”: “I have breakfast”.'),
          ],
        },
        {
          id: 'english-v2-u4-l2', order: 2, title: 'Horários e atividades',
          description: 'Converse sobre atividades e a hora em que elas acontecem.',
          objective: 'Perguntar “what time” e responder com “at” mais um horário.',
          introduction: '“What time” pergunta a hora. Para responder, use uma atividade e “at” antes do horário.',
          exercises: [
            dialogue('routine_time', 2, 'Noah', 'What time does your class start?', ['It starts at eight.', 'My cousin is kind.', 'The pencil is blue.'], 'It starts at eight.', '“What time” pede um horário; “at eight” responde diretamente.'),
            dialogue('routine_time', 2, 'Noah', 'And what do you do after class?', ['I do my homework.', 'It is next to the bank.', 'She is my aunt.'], 'I do my homework.', 'A resposta acompanha a conversa sobre a rotina escolar.', [{ speaker: 'Noah', text: 'What time does your class start?' }, { speaker: 'Você', text: 'It starts at eight.' }]),
            order('word_order', 2, 'Monte: “Minha aula termina ao meio-dia.”', 'My class ends at noon.', '“My class” é o sujeito, “ends” a ação e “at noon” o horário.'),
            translation('routine_time', 2, 'Nós estudamos inglês à tarde.', ['We study English in the afternoon.'], '“In the afternoon” expressa “à tarde”.'),
            listening('time_listening', 2, 'A que horas começa a atividade?', 'The club starts at half past three.', ['half past three', 'three thirty', '3:30'], '“Half past three” e “three thirty” significam três e meia.'),
            matching('time_expressions', 2, { 'at noon': 'ao meio-dia', 'at night': 'à noite', 'in the afternoon': 'à tarde' }, 'Use “at” para horários pontuais e “in” em partes do dia.'),
            speaking('routine_speaking', 2, 'Repita: “My class starts at eight.”', 'My class starts at eight.', ['My class starts at eight.'], 'Ouça, fale se quiser e confira o texto reconhecido. O navegador não mede precisão fonética.'),
          ],
        },
        {
          id: 'english-v2-u4-l3', order: 3, title: 'Dias da semana',
          description: 'Fale sobre os dias e combine atividades simples.',
          objective: 'Reconhecer os dias da semana e falar de planos com “on”.',
          introduction: 'Use “on” antes de um dia da semana. Em uma conversa, uma pergunta sobre sábado pode levar a um plano simples.',
          exercises: [
            dialogue('days_and_plans', 2, 'Lia', 'What do you do on Saturday?', ['I play soccer with my friends.', 'My classroom is upstairs.', 'The bus is at seven.'], 'I play soccer with my friends.', 'A resposta apresenta uma atividade para o sábado.'),
            dialogue('days_and_plans', 2, 'Lia', 'Do you study on Sunday?', ['No, I rest with my family.', 'Turn right at the corner.', 'She has a red notebook.'], 'No, I rest with my family.', 'A resposta usa “No” e acrescenta um plano coerente para domingo.', [{ speaker: 'Lia', text: 'What do you do on Saturday?' }, { speaker: 'Você', text: 'I play soccer with my friends.' }]),
            order('word_order', 2, 'Monte: “Na segunda-feira, eu estudo matemática.”', 'On Monday, I study math.', 'O dia vem com “on”; depois, sujeito e verbo.'),
            translation('days_and_plans', 2, 'Ela visita a avó no domingo.', ['She visits her grandmother on Sunday.', 'She visits her grandma on Sunday.'], '“Grandmother” e “grandma” podem significar “avó”; use “on” com Sunday.'),
            listening('days_listening', 2, 'Em que dia a pessoa visita a avó?', 'I visit my grandmother on Friday.', ['Friday', 'on Friday'], 'A palavra ouvida é “Friday”, sexta-feira.'),
            fill('simple_present', 2, 'We play volleyball ___ Saturday.', ['on', 'at', 'in'], 'on', 'Use “on” antes de dias da semana.'),
            speaking('days_speaking', 2, 'Repita: “I read a book on Sunday.”', 'I read a book on Sunday.', ['I read a book on Sunday.'], 'A fala serve para praticar e conferir a transcrição, sem avaliação fonética automatizada.'),
          ],
        },
        {
          id: 'english-v2-u4-l4', order: 4, title: 'Hábitos e frequência',
          description: 'Descreva hábitos simples com verbos no presente.',
          objective: 'Usar o Simple Present introdutório com “I”, “we”, “he” e “she”.',
          introduction: 'No Simple Present, “he” e “she” normalmente recebem “-s” no verbo. Compare “I read” e “she reads”.',
          exercises: [
            dialogue('simple_present', 3, 'Ben', 'Does your brother walk to school?', ['Yes, he walks with a friend.', 'It is Wednesday.', 'The museum is across the street.'], 'Yes, he walks with a friend.', 'Com “he”, o verbo afirmativo “walk” recebe “-s”: “walks”.'),
            dialogue('simple_present', 3, 'Ben', 'What does he do after school?', ['He reads and then plays music.', 'They are in the classroom.', 'It is next to the park.'], 'He reads and then plays music.', '“Reads” e “plays” concordam com “he”.', [{ speaker: 'Ben', text: 'Does your brother walk to school?' }, { speaker: 'Você', text: 'Yes, he walks with a friend.' }]),
            order('simple_present', 3, 'Monte: “Ela ajuda a família em casa.”', 'She helps her family at home.', 'Com “she”, usamos “helps”.'),
            translation('simple_present', 3, 'Nós lemos antes de dormir.', ['We read before bed.', 'We read before going to sleep.'], 'As duas frases expressam uma rotina de leitura antes de dormir.'),
            matching('daily_habits', 2, { 'read a book': 'ler um livro', 'help at home': 'ajudar em casa', 'walk to school': 'ir a pé para a escola' }, 'Cada expressão apresenta um hábito cotidiano.'),
            fill('simple_present', 3, 'My sister ___ her homework after lunch.', ['does', 'do', 'is'], 'does', 'Com “my sister” (she), usamos “does”.'),
            speaking('simple_present_speaking', 3, 'Repita: “She studies English every day.”', 'She studies English every day.', ['She studies English every day.'], 'O retorno mostra palavras reconhecidas; não atribui uma nota de pronúncia.'),
          ],
        },
      ],
    },
    {
      id: 'english-v2-unit-5', order: 5, title: 'Conversas do cotidiano',
      description: 'Converse sobre escola, família, objetos e lugares.',
      lessons: [
        {
          id: 'english-v2-u5-l1', order: 1, title: 'Na escola',
          description: 'Pergunte sobre materiais, salas e atividades escolares.',
          objective: 'Usar perguntas curtas para pedir e oferecer informação na escola.',
          introduction: 'Diálogos escolares podem começar com uma pergunta sobre um objeto ou uma sala e continuar com uma resposta útil.',
          exercises: [
            dialogue('school_vocabulary', 2, 'Alex', 'Where is the science room?', ['It is next to the library.', 'I wake up at six.', 'My aunt is a teacher.'], 'It is next to the library.', 'A pergunta “Where is…” pede um lugar.'),
            dialogue('school_vocabulary', 2, 'Alex', 'Can I borrow your pencil?', ['Sure, here you are.', 'It starts on Monday.', 'She reads at home.'], 'Sure, here you are.', '“Sure, here you are” é uma resposta natural ao emprestar um objeto.', [{ speaker: 'Alex', text: 'Where is the science room?' }, { speaker: 'Você', text: 'It is next to the library.' }]),
            order('school_vocabulary', 2, 'Monte: “A biblioteca fica perto da sala de música.”', 'The library is near the music room.', '“Near” indica que um lugar fica perto de outro.'),
            listening('school_listening', 2, 'Qual material a pessoa precisa?', 'I need my notebook for class.', ['notebook', 'my notebook'], 'A palavra ouvida é “notebook”, caderno.'),
            matching('school_objects', 1, { 'notebook': 'caderno', 'pencil': 'lápis', 'classroom': 'sala de aula' }, 'São palavras frequentes no ambiente escolar.'),
            fill('school_vocabulary', 2, 'The art room is ___ the library.', ['near', 'seven', 'brother'], 'near', '“Near” conecta dois lugares próximos.'),
            speaking('school_speaking', 2, 'Repita: “Can I borrow your notebook?”', 'Can I borrow your notebook?', ['Can I borrow your notebook?'], 'A transcrição é uma ajuda opcional; você também pode digitar.'),
          ],
        },
        {
          id: 'english-v2-u5-l2', order: 2, title: 'Minha família',
          description: 'Apresente pessoas da família e fale sobre elas.',
          objective: 'Usar vocabulário familiar e perguntas simples sobre idade e parentesco.',
          introduction: 'Para perguntar idade, use “How old…?”. Responda com “I am…” ou “He/She is…”.',
          exercises: [
            dialogue('family_vocabulary', 2, 'Ravi', 'How old is your sister?', ['She is twelve years old.', 'The station is on the left.', 'My class starts at eight.'], 'She is twelve years old.', '“How old” pergunta idade; “she is twelve” responde.'),
            dialogue('family_vocabulary', 2, 'Ravi', 'What does she like to do?', ['She likes drawing with me.', 'It is next to the bank.', 'We study on Thursday.'], 'She likes drawing with me.', 'A resposta mantém o assunto sobre a irmã.', [{ speaker: 'Ravi', text: 'How old is your sister?' }, { speaker: 'Você', text: 'She is twelve years old.' }]),
            translation('family_vocabulary', 2, 'Meu primo mora com a família.', ['My cousin lives with his family.', 'My cousin lives with her family.'], 'O gênero de “cousin” não é indicado pela palavra em inglês; as duas formas são possíveis.'),
            listening('family_listening', 2, 'Quem mora com a pessoa?', 'My grandmother lives with us.', ['grandmother', 'my grandmother'], '“Grandmother” significa avó.'),
            matching('family_words', 2, { 'cousin': 'primo ou prima', 'grandmother': 'avó', 'brother': 'irmão' }, '“Cousin” serve para primo ou prima; o contexto informa a pessoa.'),
            fill('family_vocabulary', 2, 'My mother’s son is my ___.', ['brother', 'classroom', 'Tuesday'], 'brother', 'O filho da sua mãe pode ser seu irmão.'),
            speaking('family_speaking', 2, 'Repita: “My family has dinner together.”', 'My family has dinner together.', ['My family has dinner together.'], 'O reconhecimento de voz apenas transcreve o que percebe; não mede fonética.'),
          ],
        },
        {
          id: 'english-v2-u5-l3', order: 3, title: 'Lugares da cidade',
          description: 'Peça e compreenda orientações para lugares próximos.',
          objective: 'Perguntar onde fica um lugar e entender instruções curtas de direção.',
          introduction: '“Where is…?” pergunta onde fica algo. “Turn left” e “turn right” indicam virar à esquerda ou à direita.',
          exercises: [
            dialogue('directions_places', 2, 'Sofia', 'Excuse me, where is the bus station?', ['It is across from the park.', 'I read before bed.', 'My father is forty.'], 'It is across from the park.', 'A resposta informa a localização da estação.'),
            dialogue('directions_places', 3, 'Sofia', 'How can I get there?', ['Go straight and turn left.', 'She has a blue notebook.', 'We have lunch at noon.'], 'Go straight and turn left.', 'A resposta dá duas instruções de direção.', [{ speaker: 'Sofia', text: 'Excuse me, where is the bus station?' }, { speaker: 'Você', text: 'It is across from the park.' }]),
            order('directions_places', 3, 'Monte: “Vire à direita na esquina.”', 'Turn right at the corner.', '“Turn right” significa virar à direita.'),
            translation('directions_places', 2, 'O mercado fica atrás da escola.', ['The market is behind the school.'], '“Behind” significa atrás de.'),
            listening('directions_listening', 2, 'Para qual lado a pessoa deve virar?', 'Turn left at the next street.', ['left', 'turn left'], '“Left” significa esquerda.'),
            fill('directions_places', 2, 'The bank is ___ the library and the café.', ['between', 'Monday', 'sister'], 'between', '“Between” indica que algo fica entre dois lugares.'),
            speaking('directions_speaking', 3, 'Repita: “Go straight and turn left.”', 'Go straight and turn left.', ['Go straight and turn left.'], 'Repita se quiser e use a transcrição como referência, sem nota de pronúncia.'),
          ],
        },
        {
          id: 'english-v2-u5-l4', order: 4, title: 'Objetos e perguntas',
          description: 'Pergunte sobre objetos e combine respostas naturais.',
          objective: 'Usar “this”, “that”, “where” e perguntas curtas sobre objetos e lugares.',
          introduction: 'Perguntas simples ajudam a descobrir o que é um objeto ou onde está. Preste atenção na resposta e mantenha o diálogo.',
          exercises: [
            dialogue('object_questions', 2, 'Maya', 'What is this?', ['It is a map of the city.', 'I wake up at seven.', 'He visits on Sunday.'], 'It is a map of the city.', '“What is this?” pergunta o que é o objeto apresentado.'),
            dialogue('object_questions', 3, 'Maya', 'Where can I find the history book?', ['It is on the shelf by the window.', 'My brother is thirteen.', 'We play soccer on Saturday.'], 'It is on the shelf by the window.', 'A resposta indica o lugar do livro.', [{ speaker: 'Maya', text: 'What is this?' }, { speaker: 'Você', text: 'It is a map of the city.' }]),
            order('object_questions', 3, 'Monte: “Onde fica a entrada do museu?”', 'Where is the museum entrance?', 'Em perguntas com “where”, o lugar vem depois do verbo “is”.'),
            translation('object_questions', 2, 'A chave está sobre a mesa.', ['The key is on the table.'], '“On the table” significa sobre a mesa.'),
            listening('object_listening', 3, 'Onde está a mochila?', 'The backpack is under the chair.', ['under the chair'], '“Under the chair” significa embaixo da cadeira.'),
            matching('object_positions', 2, { 'on the table': 'sobre a mesa', 'under the chair': 'embaixo da cadeira', 'by the window': 'perto da janela' }, 'As expressões indicam posição ou proximidade.'),
            speaking('object_speaking', 3, 'Repita: “Where is the museum entrance?”', 'Where is the museum entrance?', ['Where is the museum entrance?'], 'O microfone é opcional; o texto pode ser digitado.'),
          ],
        },
      ],
    },
  ],
};

export default course;
