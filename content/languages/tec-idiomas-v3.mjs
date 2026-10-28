const lesson = (id, title, description, objective, introduction, orderPt, orderAnswer, translationPt, translationAnswers, dialogueSpeaker, dialogueQuestion, dialogueOptions, dialogueAnswer, listeningText, listeningQuestion, listeningAnswers, pairs, fillPrompt, fillOptions, fillAnswer, fillExplanation) => ({
  id, title, description, objective, introduction, orderPt, orderAnswer, translationPt, translationAnswers,
  dialogueSpeaker, dialogueQuestion, dialogueOptions, dialogueAnswer, listeningText, listeningQuestion,
  listeningAnswers, pairs, fillPrompt, fillOptions, fillAnswer, fillExplanation,
});

const english = {
  course: {
    code: 'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', languageCode: 'en-US', version: 1,
    title: 'Inglês em situações do dia a dia — continuação',
    description: 'Uma continuação independente com viagens, alimentação, saúde e planos, ligada ao mesmo percurso de aprendizagem.',
    author: 'Equipe de conteúdo Tec Escola', publicationStatus: 'STAGING', reviewStatus: 'PEDAGOGICAL_REVIEW_PENDING', xpReward: 30,
  },
  units: [
    { id: 'en-v2x-unit-1', order: 1, title: 'Viagens e deslocamentos', description: 'Peça informações e resolva situações comuns durante uma viagem.', lessons: [
      lesson('en-v2x-u1-l1', 'Na estação', 'Compre uma passagem e confirme o horário de partida.', 'Pedir uma passagem e entender informações básicas de embarque.', 'Na estação, escute a pergunta sobre o destino e diga se precisa de uma passagem só de ida. “Platform” é a plataforma de embarque.', 'Eu preciso de uma passagem só de ida para Oxford, por favor.', 'I need a one-way ticket to Oxford, please.', 'A que horas o trem para Oxford parte?', ['What time does the train to Oxford leave?'], 'Ticket clerk', 'Would you like a single or return ticket?', ['A single ticket to Oxford, please.', 'A return ticket to Oxford, please.', 'A single ticket to Cambridge, please.'], 'A single ticket to Oxford, please.', 'The train to Oxford leaves at nine fifteen.', 'A que horas o trem parte?', ['At nine fifteen.', 'At 9:15.'], { 'platform': 'plataforma', 'ticket': 'passagem', 'departure': 'partida' }, 'I need a ___ ticket to Oxford; I will only travel one way.', ['single', 'return', 'round-trip'], 'single', '“Single ticket” é uma passagem só de ida; “return ticket” inclui a volta.'),
      lesson('en-v2x-u1-l2', 'No ônibus', 'Descubra onde embarcar e qual linha usar.', 'Perguntar onde pegar um ônibus e entender o número da linha.', 'Use “Which bus…” para perguntar qual ônibus leva a um lugar. “Stop” é o ponto de ônibus.', 'Qual ônibus vai para o centro da cidade?', 'Which bus goes to the city centre?', 'Onde fica o ponto de ônibus?', ['Where is the bus stop?'], 'Passenger', 'Does this bus go to the museum?', ['Yes, get off at the next stop.', 'No, take bus number twelve from the station.', 'Yes, the museum is two stops away.'], 'Yes, get off at the next stop.', 'Take bus number twelve and get off at the library.', 'Qual ônibus a pessoa deve pegar?', ['Bus number twelve.', 'Number twelve.', 'O ônibus número doze.'], { 'bus stop': 'ponto de ônibus', 'get off': 'descer', 'city centre': 'centro da cidade' }, 'Please tell me where to ___ the bus.', ['catch', 'board', 'miss'], ['catch', 'board'], '“Catch” e “board a bus” são formas naturais de dizer pegar ou embarcar em um ônibus.'),
      lesson('en-v2x-u1-l3', 'No hotel', 'Faça o check-in e pergunte sobre os serviços da hospedagem.', 'Informar uma reserva e pedir detalhes simples sobre o quarto.', 'No check-in, diga o nome da reserva. “Reservation” significa reserva e “key card” é o cartão-chave.', 'Tenho uma reserva em nome de Ana Costa.', 'I have a reservation under Ana Costa.', 'O café da manhã começa às sete.', ['Breakfast starts at seven.'], 'Guest', 'Could I have the key card, please?', ['Of course. Your room is on the third floor.', 'Certainly. Your room is on the second floor.', 'I am sorry, your room is not ready yet.'], 'Of course. Your room is on the third floor.', 'Breakfast is served from seven to ten in the dining room.', 'Em que horário o café da manhã é servido?', ['From seven to ten.', 'Seven to ten.', 'Das sete às dez.'], { 'reservation': 'reserva', 'key card': 'cartão-chave', 'third floor': 'terceiro andar' }, 'I have a ___ under Ana Costa.', ['reservation', 'forecast', 'appointment'], 'reservation', '“Reservation” é a reserva feita para o quarto ou serviço.'),
      lesson('en-v2x-u1-l4', 'Comprando uma passagem', 'Escolha um horário e confirme se há lugar disponível.', 'Perguntar sobre disponibilidade e escolher um horário para viajar.', '“Available” significa disponível. Para confirmar uma escolha, diga “That time works for me.”', 'Esse horário funciona para mim.', 'That time works for me.', 'Ainda há dois lugares disponíveis.', ['There are still two seats available.'], 'Travel agent', 'The ten o’clock train is full. Is eleven thirty okay?', ['Yes, eleven thirty works for me.', 'Could I take the twelve o’clock train instead?', 'No, I would prefer the ten o’clock train.'], 'Yes, eleven thirty works for me.', 'There are two seats available on the eleven thirty train.', 'Quantos lugares ainda estão disponíveis?', ['Two seats.', 'Two.', 'Dois lugares.'], { 'available': 'disponível', 'seat': 'assento ou lugar', 'full': 'lotado' }, '“Available” informa que os lugares ainda podem ser comprados.'),
    ] },
    { id: 'en-v2x-unit-2', order: 2, title: 'Comida e atendimento', description: 'Peça refeições, informe preferências e compre alimentos.', lessons: [
      lesson('en-v2x-u2-l1', 'No café', 'Faça um pedido simples e escolha uma bebida.', 'Pedir comida e bebida com cortesia usando “would like”.', '“I’d like…” é uma forma educada de pedir. “Still water” é água sem gás.', 'Eu gostaria de um sanduíche e uma água sem gás, por favor.', 'I would like a sandwich and still water, please.', 'Posso ver o cardápio, por favor?', ['Could I see the menu, please?'], 'Server', 'Would you like tea or coffee?', ['Tea, please, and a glass of water.', 'A return ticket to Oxford, please.', 'My appointment is on Thursday.'], 'Tea, please, and a glass of water.', 'The customer orders a cheese sandwich and a cup of tea.', 'O que a pessoa pediu para comer?', ['A cheese sandwich.', 'A sandwich.', 'Um sanduíche de queijo.'], { 'menu': 'cardápio', 'still water': 'água sem gás', 'cup': 'xícara' }, 'I would like a ___ of tea.', ['cup', 'platform', 'bandage'], 'cup', '“A cup of tea” significa uma xícara de chá.'),
      lesson('en-v2x-u2-l2', 'No restaurante', 'Peça a refeição e pergunte sobre ingredientes.', 'Fazer um pedido e confirmar um ingrediente de um prato.', 'Pergunte “Does this dish have…?” para conferir ingredientes. “Without” significa sem.', 'Eu gostaria da salada sem queijo.', 'I would like the salad without cheese.', 'Este prato tem amendoim?', ['Does this dish have peanuts?'], 'Customer', 'Would you like rice or potatoes with the fish?', ['Potatoes, please, and no cheese in the salad.', 'A platform near the city centre.', 'A warm jacket for the rain.'], 'Potatoes, please, and no cheese in the salad.', 'The vegetable soup is served with bread.', 'O que acompanha a sopa de legumes?', ['Bread.', 'Some bread.', 'Pão.'], { 'dish': 'prato', 'without': 'sem', 'peanuts': 'amendoins' }, 'I would like the salad ___ cheese.', ['without', 'between', 'cloudy'], 'without', '“Without cheese” significa sem queijo.'),
      lesson('en-v2x-u2-l3', 'Preferências alimentares', 'Explique o que você gosta e o que prefere evitar.', 'Expressar uma preferência alimentar e pedir uma alternativa.', '“I prefer…” expressa preferência. Para recusar algo com gentileza, explique o que prefere.', 'Eu prefiro legumes e arroz.', 'I prefer vegetables and rice.', 'Eu não como carne.', ['I do not eat meat.', "I don't eat meat."], 'Server', 'Would you like chicken or the vegetable option?', ['The vegetable option, please. I do not eat meat.', 'A single ticket, please.', 'The pharmacy is across the street.'], 'The vegetable option, please. I do not eat meat.', 'The customer prefers the vegetable option and does not eat meat.', 'Qual opção a pessoa escolheu?', ['The vegetable option.', 'Vegetables.', 'A opção de legumes.'], { 'prefer': 'preferir', 'vegetable option': 'opção de legumes', 'meat': 'carne' }, 'I ___ the vegetable option, please.', ['prefer', 'leaves', 'hurts'], 'prefer', '“Prefer” é o verbo usado para dizer que uma opção é a preferida.'),
      lesson('en-v2x-u2-l4', 'Na feira', 'Pergunte o preço, a quantidade e a origem dos alimentos.', 'Perguntar o preço e comprar uma quantidade de frutas.', 'Use “How much…” para perguntar o preço. “A kilo of” indica um quilo de algo.', 'Quanto custam estas maçãs?', 'How much are these apples?', 'Eu gostaria de meio quilo de tomates.', ['I would like half a kilo of tomatoes.'], 'Shopkeeper', 'Can I help you?', ['Yes, I would like a kilo of apples, please.', 'Yes, I need a bandage for my arm.', 'The bus leaves at ten.'], 'Yes, I would like a kilo of apples, please.', 'The apples cost three pounds a kilo.', 'Quanto custa um quilo de maçãs?', ['Three pounds.', 'Three pounds a kilo.', 'Três libras por quilo.'], { 'a kilo': 'um quilo', 'tomatoes': 'tomates', 'cost': 'custar' }, 'How much ___ these apples?', ['are', 'is', 'does'], 'are', '“Apples” está no plural, então a pergunta usa “are”.'),
    ] },
    { id: 'en-v2x-unit-3', order: 3, title: 'Clima, saúde e cuidado', description: 'Entenda a previsão e peça ajuda em situações comuns de saúde.', lessons: [
      lesson('en-v2x-u3-l1', 'A previsão do tempo', 'Converse sobre chuva, sol, temperatura e planos.', 'Entender uma previsão simples e perguntar sobre o clima.', '“Forecast” é previsão do tempo. As expressões “It is sunny” e “It is cloudy” descrevem o clima.', 'Vai chover esta tarde?', 'Is it going to rain this afternoon?', 'A previsão diz que amanhã fará sol.', ['The forecast says it will be sunny tomorrow.'], 'Visitor', 'What will the weather be like tomorrow?', ['It will be sunny and warm.', 'The pharmacy closes at six.', 'The train leaves from platform two.'], 'It will be sunny and warm.', 'The forecast says it will rain after four o’clock.', 'Depois de que horário a previsão indica chuva?', ['After four o’clock.', 'After four.', 'Depois das quatro.'], { 'forecast': 'previsão', 'sunny': 'ensolarado', 'cloudy': 'nublado' }, 'The sky is dark. It may ___ soon.', ['rain', 'board', 'order'], 'rain', '“It may rain” significa que pode chover.'),
      lesson('en-v2x-u3-l2', 'Roupas para o clima', 'Escolha peças adequadas para frio, calor e chuva.', 'Relacionar roupas e clima usando recomendações simples.', '“You should…” é usado para dar uma recomendação. “Raincoat” significa capa de chuva.', 'Você deve levar uma capa de chuva.', 'You should take a raincoat.', 'Está frio; vou vestir um casaco.', ['It is cold, so I will wear a coat.'], 'Friend', 'It is windy outside. What should I wear?', ['You should wear a warm jacket.', 'You should order the fish.', 'You should take the train at nine.'], 'You should wear a warm jacket.', 'She takes an umbrella because it is raining.', 'Por que ela leva um guarda-chuva?', ['Because it is raining.', 'It is raining.', 'Porque está chovendo.'], { 'raincoat': 'capa de chuva', 'umbrella': 'guarda-chuva', 'warm jacket': 'casaco quente' }, 'You should take an ___ because it is raining.', ['umbrella', 'appointment', 'platform'], 'umbrella', '“Umbrella” é guarda-chuva; a frase recomenda levá-lo quando chove.'),
      lesson('en-v2x-u3-l3', 'Na farmácia', 'Descreva um sintoma e peça um produto simples.', 'Explicar um sintoma e pedir orientação básica na farmácia.', '“I have a…” introduz alguns sintomas. “Sore throat” significa dor de garganta.', 'Estou com dor de garganta desde ontem.', 'I have had a sore throat since yesterday.', 'Onde fica a farmácia mais próxima?', ['Where is the nearest pharmacy?'], 'Pharmacist', 'What seems to be the problem?', ['I have a headache and a sore throat.', 'I would like a return ticket.', 'The soup comes with bread.'], 'I have a headache and a sore throat.', 'The customer has a headache and asks for pain relief.', 'Que sintoma a pessoa menciona?', ['A headache.', 'Headache.', 'Dor de cabeça.'], { 'headache': 'dor de cabeça', 'sore throat': 'dor de garganta', 'pain relief': 'alívio da dor' }, 'I have a ___ throat.', ['sore', 'single', 'sunny'], 'sore', '“Sore throat” é a expressão usada para dor de garganta.'),
      lesson('en-v2x-u3-l4', 'Pedindo ajuda', 'Peça auxílio com clareza e informe onde está o problema.', 'Pedir ajuda e informar um sintoma ou uma necessidade imediata.', '“Could you help me?” é um pedido educado. “I feel dizzy” significa estou me sentindo tonto ou tonta.', 'Você poderia me ajudar, por favor?', 'Could you help me, please?', 'Eu me sinto tonta e preciso me sentar.', ['I feel dizzy and I need to sit down.'], 'Visitor', 'Are you all right? Do you need help?', ['I feel dizzy. Could you help me find a seat?', 'I need a return ticket to Oxford.', 'I prefer tea without milk.'], 'I feel dizzy. Could you help me find a seat?', 'The person feels dizzy and asks for a place to sit.', 'O que a pessoa precisa encontrar?', ['A seat.', 'A place to sit.', 'Um lugar para sentar.'], { 'dizzy': 'tonto ou tonta', 'seat': 'assento', 'help': 'ajuda' }, 'I feel ___ and need to sit down.', ['dizzy', 'available', 'delicious'], 'dizzy', '“Dizzy” descreve a sensação de tontura.'),
    ] },
    { id: 'en-v2x-unit-4', order: 4, title: 'Encontros e comunicação', description: 'Convide pessoas, combine horários e compartilhe opiniões.', lessons: [
      lesson('en-v2x-u4-l1', 'Fazendo um convite', 'Convide alguém para uma atividade e responda com gentileza.', 'Fazer um convite usando “Would you like to…?”.', '“Would you like to…” é uma forma cordial de convidar alguém. “Sounds good” aceita uma ideia.', 'Você gostaria de visitar o museu comigo?', 'Would you like to visit the museum with me?', 'Que tal irmos ao parque no sábado?', ['How about going to the park on Saturday?'], 'Friend', 'Would you like to see the new exhibition?', ['Yes, that sounds great. What time shall we meet?', 'I have a sore throat since yesterday.', 'I need half a kilo of tomatoes.'], 'Yes, that sounds great. What time shall we meet?', 'They agree to meet at the museum entrance at two.', 'Onde eles combinaram de se encontrar?', ['At the museum entrance.', 'At the entrance.', 'Na entrada do museu.'], { 'invitation': 'convite', 'exhibition': 'exposição', 'entrance': 'entrada' }, 'Would you like to ___ the museum?', ['visit', 'wear', 'cost'], 'visit', 'Depois de “would like to”, usamos a forma base do verbo.'),
      lesson('en-v2x-u4-l2', 'Combinando horários', 'Sugira um horário e confirme um compromisso.', 'Sugerir e confirmar um horário para uma atividade.', '“Are you free…?” pergunta se alguém está disponível. “At half past three” indica três e meia.', 'Você está livre às três e meia?', 'Are you free at half past three?', 'Podemos nos encontrar depois da aula.', ['We can meet after class.'], 'Classmate', 'Can we meet before the library closes?', ['Yes, let us meet at half past three.', 'Yes, I would like a cup of tea.', 'Yes, the bus stop is across the road.'], 'Yes, let us meet at half past three.', 'The library closes at five, so they choose half past three.', 'A que horas eles vão se encontrar?', ['At half past three.', 'At 3:30.', 'Às três e meia.'], { 'free': 'disponível ou livre', 'half past': 'e meia', 'before': 'antes' }, 'Let us meet ___ half past three.', ['at', 'in', 'on'], 'at', 'Usamos “at” antes de um horário específico.'),
      lesson('en-v2x-u4-l3', 'Compartilhando opiniões', 'Diga o que achou de um livro, filme ou atividade.', 'Expressar uma opinião e perguntar a opinião de outra pessoa.', '“I think…” introduz uma opinião. “Interesting” significa interessante.', 'Na minha opinião, o filme foi muito interessante.', 'I think the film was very interesting.', 'O que você achou do livro?', ['What did you think of the book?'], 'Friend', 'How was the science exhibition?', ['I thought it was fascinating, especially the space room.', 'I need a warmer coat for the rain.', 'The train departs from platform nine.'], 'I thought it was fascinating, especially the space room.', 'The visitor liked the space room best.', 'De qual sala a pessoa mais gostou?', ['The space room.', 'The room about space.', 'Da sala espacial.'], { 'opinion': 'opinião', 'interesting': 'interessante', 'fascinating': 'fascinante' }, 'I ___ the film was interesting.', ['think', 'take', 'leave'], 'think', '“I think” apresenta uma opinião ou avaliação.'),
      lesson('en-v2x-u4-l4', 'Resolvendo um imprevisto', 'Explique um problema e combine uma solução.', 'Relatar um pequeno imprevisto e propor uma alternativa.', '“There is a problem with…” apresenta um problema. “Could we…?” propõe uma solução com cortesia.', 'Há um problema com a minha reserva.', 'There is a problem with my reservation.', 'Poderíamos mudar para o horário seguinte?', ['Could we change to the next time?', 'Could we change to the next available time?'], 'Receptionist', 'Your room is not ready yet. Would you like to leave your bags here?', ['Yes, please. Could you tell me when the room is ready?', 'Yes, I prefer the vegetable option.', 'Yes, the weather will be sunny.'], 'Yes, please. Could you tell me when the room is ready?', 'The receptionist says the room is not ready yet.', 'O que ainda não está pronto?', ['The room.', 'The guest room.', 'O quarto.'], { 'problem': 'problema', 'change': 'mudar', 'ready': 'pronto ou pronta' }, 'There is a problem ___ my reservation.', ['with', 'at', 'between'], 'with', 'A expressão “a problem with” é seguida da coisa que apresenta o problema.'),
    ] },
  ],
};

const spanish = {
  course: {
    code: 'TEC_SPANISH_FOUNDATIONS_V1', languageCode: 'es-ES', version: 1,
    title: 'Espanhol para situações do cotidiano',
    description: 'Cumprimentos, alimentação, deslocamentos e pedidos de ajuda em espanhol.',
    author: 'Equipe de conteúdo Tec Escola', publicationStatus: 'STAGING', reviewStatus: 'PEDAGOGICAL_REVIEW_PENDING', xpReward: 30,
  },
  units: [
    { id: 'es-v1-unit-1', order: 1, title: 'Primeiras conversas', description: 'Cumprimente, apresente-se e converse em situações cotidianas.', lessons: [
      lesson('es-v1-u1-l1', 'Cumprimentos', 'Use saudações adequadas para diferentes momentos do dia.', 'Cumprimentar, perguntar como alguém está e despedir-se.', '“Hola” funciona em qualquer momento. “Buenos días” é usado pela manhã e “Buenas tardes” à tarde.', 'Bom dia. Como você está?', 'Buenos días. ¿Cómo estás?', 'Até amanhã, tenha uma boa tarde.', ['Hasta mañana. Que tengas una buena tarde.'], 'Compañera', 'Hola, ¿cómo estás hoy?', ['Estoy bien, gracias. ¿Y tú?', 'Quiero una mesa para dos.', 'La estación está a la izquierda.'], 'Estoy bien, gracias. ¿Y tú?', 'Hola, buenos días. ¿Cómo estás?', 'Qual saudação aparece no começo do áudio?', ['Hola.', 'Buenos días.', 'Olá.'], { 'hola': 'olá', 'buenos días': 'bom dia', 'hasta mañana': 'até amanhã' }, '___ tardes. ¿Cómo estás?', ['Buenas', 'Buenos', 'Hasta'], 'Buenas', '“Buenas tardes” é a saudação usada à tarde; “tardes” é feminino plural.'),
      lesson('es-v1-u1-l2', 'Apresentações', 'Diga seu nome e pergunte o nome de outra pessoa.', 'Apresentar-se e perguntar o nome com formas naturais em espanhol.', '“Me llamo…” significa “me chamo…”. Para perguntar o nome, use “¿Cómo te llamas?”.', 'Meu nome é Camila. Muito prazer.', 'Me llamo Camila. Mucho gusto.', 'Como você se chama?', ['¿Cómo te llamas?'], 'Compañero', '¿Cómo te llamas?', ['Me llamo Diego. Mucho gusto.', 'La sopa está caliente.', 'El tren sale a las nueve.'], 'Me llamo Diego. Mucho gusto.', 'Me llamo Elena y soy estudiante.', 'Como a pessoa se apresenta?', ['Se llama Elena.', 'Elena.', 'Ela se chama Elena.'], { 'me llamo': 'me chamo', 'mucho gusto': 'muito prazer', 'estudiante': 'estudante' }, 'Me ___ Laura.', ['llamo', 'gusta', 'duele'], 'llamo', '“Me llamo” é a expressão usada para dizer o próprio nome.'),
      lesson('es-v1-u1-l3', 'De onde você é?', 'Pergunte a origem e diga onde vive.', 'Perguntar de onde alguém é e responder com país ou cidade.', '“¿De dónde eres?” pergunta a origem. “Soy de…” indica de onde você é.', 'Sou do Brasil, mas moro em Salvador.', 'Soy de Brasil, pero vivo en Salvador.', 'De onde você é?', ['¿De dónde eres?'], 'Compañera', '¿De dónde eres?', ['Soy de Brasil y vivo en Recife.', 'Quisiera una tortilla, por favor.', 'El autobús para en la plaza.'], 'Soy de Brasil y vivo en Recife.', 'La estudiante es de Brasil y vive en Recife.', 'Em que cidade ela mora?', ['En Recife.', 'Recife.', 'Em Recife.'], { 'de dónde': 'de onde', 'soy de': 'sou de', 'vivo en': 'moro em' }, 'Soy ___ Brasil.', ['de', 'a', 'con'], 'de', 'Usamos “ser de” para falar da origem.'),
      lesson('es-v1-u1-l4', 'Frases de cortesia', 'Peça algo e agradeça com educação.', 'Usar “por favor”, “gracias” e “de nada” em pedidos simples.', '“Por favor” acompanha um pedido; “gracias” agradece e “de nada” responde ao agradecimento.', 'Uma água, por favor. Muito obrigado.', 'Un agua, por favor. Muchas gracias.', 'Com licença, pode me ajudar?', ['Disculpe, ¿puede ayudarme?'], 'Dependienta', '¿Necesitas algo más?', ['No, gracias. Eso es todo.', 'Me llamo Diego y soy estudiante.', 'El cielo está nublado.'], 'No, gracias. Eso es todo.', 'La persona pide una botella de agua, por favor.', 'O que a pessoa pediu?', ['Una botella de agua.', 'Agua.', 'Uma garrafa de água.'], { 'por favor': 'por favor', 'gracias': 'obrigado ou obrigada', 'de nada': 'de nada' }, 'Una botella de agua, ___ favor.', ['por', 'de', 'en'], 'por', 'A expressão fixa de cortesia é “por favor”.'),
    ] },
    { id: 'es-v1-unit-2', order: 2, title: 'Comida, cidade e cuidado', description: 'Peça refeições, compre, use transporte e peça ajuda.', lessons: [
      lesson('es-v1-u2-l1', 'No café', 'Peça uma bebida e algo para comer.', 'Fazer um pedido simples em um café espanhol.', '“Quisiera…” é um pedido educado. Em muitos lugares da Espanha, “zumo” significa suco.', 'Eu gostaria de um café com leite e uma torrada.', 'Quisiera un café con leche y una tostada.', 'Pode trazer a conta, por favor?', ['¿Me trae la cuenta, por favor?'], 'Camarero', '¿Qué quieres tomar?', ['Un zumo de naranja y una tostada, por favor.', 'Un billete para Madrid, por favor.', 'Necesito una farmacia cerca.'], 'Un zumo de naranja y una tostada, por favor.', 'El café con leche cuesta dos euros con cincuenta.', 'Quanto custa o café com leite?', ['Dos euros con cincuenta.', 'Dos cincuenta.', 'Dois euros e cinquenta.'], { 'café con leche': 'café com leite', 'zumo': 'suco', 'tostada': 'torrada' }, 'Quisiera un ___ de naranja.', ['zumo', 'andén', 'dolor'], 'zumo', '“Zumo de naranja” é suco de laranja na Espanha.'),
      lesson('es-v1-u2-l2', 'Comida e preferências', 'Diga do que gosta e faça um pedido adequado.', 'Expressar gostos e escolher uma refeição.', '“Me gusta…” significa “eu gosto”. Para plural, “me gustan” concorda com aquilo de que se gosta.', 'Gosto de verduras, mas não gosto de azeitonas.', 'Me gustan las verduras, pero no me gustan las aceitunas.', 'Prefiro uma salada sem cebola.', ['Prefiero una ensalada sin cebolla.'], 'Camarera', '¿Te gusta la tortilla española?', ['Sí, me gusta. ¿Tiene cebolla?', 'Sí, el autobús sale a las seis.', 'Sí, me duele la garganta.'], 'Sí, me gusta. ¿Tiene cebolla?', 'A la persona le gustan las manzanas, pero no las aceitunas.', 'Do que a pessoa não gosta?', ['De las aceitunas.', 'Las aceitunas.', 'De azeitonas.'], { 'me gusta': 'eu gosto', 'aceitunas': 'azeitonas', 'sin cebolla': 'sem cebola' }, 'Me ___ las verduras.', ['gustan', 'gusta', 'gusto'], 'gustan', '“Verduras” está no plural; por isso usamos “me gustan”.'),
      lesson('es-v1-u2-l3', 'Transporte e direções', 'Pergunte onde fica a estação e entenda instruções curtas.', 'Perguntar por um lugar e compreender direções simples.', '“¿Dónde está…?” pergunta onde está um lugar. “Gira a la derecha” significa vire à direita.', 'A estação fica perto da praça.', 'La estación está cerca de la plaza.', 'Como chego ao mercado?', ['¿Cómo llego al mercado?'], 'Turista', '¿Dónde está la estación de metro?', ['Sigue recto y gira a la izquierda.', 'Quisiera una mesa junto a la ventana.', 'Me llamo Ana y vivo en Madrid.'], 'Sigue recto y gira a la izquierda.', 'El autobús número seis para frente al museo.', 'Qual ônibus para em frente ao museu?', ['El número seis.', 'El autobús número seis.', 'O número seis.'], { 'estación': 'estação', 'sigue recto': 'siga em frente', 'a la izquierda': 'à esquerda' }, 'La farmacia está ___ de la estación.', ['cerca', 'dulce', 'tarde'], 'cerca', '“Cerca de” indica que a farmácia fica próxima da estação.'),
      lesson('es-v1-u2-l4', 'Compras e ajuda', 'Pergunte o preço e peça ajuda se precisar.', 'Perguntar preço e fazer um pedido de ajuda compreensível.', '“¿Cuánto cuesta?” pergunta quanto custa. “Necesito ayuda” significa preciso de ajuda.', 'Quanto custa esta camisa?', '¿Cuánto cuesta esta camisa?', 'Preciso de ajuda para encontrar uma farmácia.', ['Necesito ayuda para encontrar una farmacia.'], 'Dependiente', '¿Qué talla buscas?', ['Busco la talla mediana, por favor.', 'Busco el andén número dos.', 'Busco un vaso de agua sin gas.'], 'Busco la talla mediana, por favor.', 'La camisa azul cuesta veinte euros.', 'Quanto custa a camisa azul?', ['Veinte euros.', '20 euros.', 'Vinte euros.'], { 'cuánto cuesta': 'quanto custa', 'talla mediana': 'tamanho médio', 'necesito ayuda': 'preciso de ajuda' }, '¿Cuánto ___ esta camisa?', ['cuesta', 'cuestan', 'cuesto'], 'cuesta', '“Esta camisa” está no singular, então a forma é “cuesta”.'),
    ] },
  ],
};

const korean = {
  course: {
    code: 'TEC_KOREAN_FOUNDATIONS_V1', languageCode: 'ko-KR', version: 1,
    title: 'Coreano para começar',
    description: 'Hangul, apresentações, refeições, deslocamentos e pedidos de ajuda em frases do cotidiano.',
    author: 'Equipe de conteúdo Tec Escola', publicationStatus: 'STAGING', reviewStatus: 'PEDAGOGICAL_REVIEW_PENDING', xpReward: 30,
  },
  units: [
    { id: 'ko-v1-unit-1', order: 1, title: 'Hangul e primeiras conversas', description: 'Leia sílabas simples e use saudações e apresentações educadas.', lessons: [
      lesson('ko-v1-u1-l1', 'Olá e despedidas', 'Pratique uma saudação educada e uma despedida comum.', 'Reconhecer 안녕하세요 e 안녕히 가세요 em uma conversa curta.', '안녕하세요 (annyeonghaseyo) = olá; 감사합니다 (gamsahamnida) = obrigado(a); 안녕히 가세요 (annyeonghi gaseyo) = vá em paz. Em coreano, o Hangul representa sílabas formadas por blocos.', 'Olá. Muito prazer em conhecer você.', '안녕하세요. 만나서 반가워요.', 'Obrigado por hoje. Até a próxima.', ['오늘 감사합니다. 다음에 만나요.'], '직원', '안녕하세요. 처음 뵙겠습니다.', ['안녕하세요. 만나서 반가워요.', '물 한 잔 주세요.', '지하철역은 왼쪽에 있어요.'], '안녕하세요. 만나서 반가워요.', '안녕하세요. 만나서 반가워요. 안녕히 가세요.', 'Qual expressão foi usada para se despedir?', ['안녕히 가세요.', 'annyeonghi gaseyo.', 'Vá em paz.'], { '안녕하세요 (annyeonghaseyo)': 'olá', '감사합니다 (gamsahamnida)': 'obrigado ou obrigada', '안녕히 가세요 (annyeonghi gaseyo)': 'vá em paz' }, '___, 만나서 반가워요.', ['안녕하세요', '감사합니다', '안녕히 가세요'], '안녕하세요', '안녕하세요 (annyeonghaseyo) é uma saudação educada.'),
      lesson('ko-v1-u1-l2', 'Sílabas e palavras curtas', 'Observe como consoantes e vogais formam blocos silábicos.', 'Ler palavras frequentes em Hangul e reconhecer sua pronúncia complementar.', 'Leia o bloco inteiro: 가 (ga), 나 (na), 다 (da). As vogais ㅏ (a), ㅓ (eo) e ㅗ (o) têm sons diferentes; a romanização ajuda no início, mas o Hangul é a escrita principal.', 'Esta é uma palavra em coreano.', '이것은 한국어 단어예요.', 'Leia a sílaba 가 e depois a sílaba 나.', ['가를 읽고 나를 읽어요.'], '선생님', '이 글자는 어떻게 읽어요?', ['가라고 읽어요.', '학교에 가요.', '사과 주스 주세요.'], '가라고 읽어요.', '가, 나, 다. 세 음절을 차례로 읽어 보세요.', 'Qual sílaba aparece primeiro no áudio?', ['가.', 'ga.', 'A sílaba ga.'], { '가 (ga)': 'sílaba ga', '나 (na)': 'sílaba na', '다 (da)': 'sílaba da' }, '가, ___, 다.', ['나', '물', '책'], '나', 'A sequência apresentada é 가 (ga), 나 (na), 다 (da).'),
      lesson('ko-v1-u1-l3', 'Meu nome e meu país', 'Diga seu nome e de onde veio.', 'Apresentar-se e informar a origem usando frases educadas.', '저는 (jeoneun) = eu; 브라질 (beurajil) = Brasil; 저는 브라질에서 왔어요 (jeoneun beurajileseo wasseoyo) = vim do Brasil. A partícula 에서 marca o lugar de origem da ação.', 'Eu sou a Ana. Vim do Brasil.', '저는 아나예요. 브라질에서 왔어요.', 'Meu nome é Pedro.', ['제 이름은 페드로예요.'], '민지', '어디에서 왔어요?', ['브라질에서 왔어요.', '물 두 잔 주세요.', '오른쪽으로 가세요.'], '브라질에서 왔어요.', '저는 브라질에서 왔어요. 제 이름은 마리아예요.', 'De que país a pessoa veio?', ['브라질.', 'beurajil.', 'Brasil.'], { '저는 (jeoneun)': 'eu', '브라질 (beurajil)': 'Brasil', '이름 (ireum)': 'nome' }, '저는 브라질에서 ___ .', ['왔어요', '마셔요', '읽어요'], '왔어요', '왔어요 (wasseoyo) é a forma educada de “vim”.'),
      lesson('ko-v1-u1-l4', 'Obrigado e por favor', 'Use expressões educadas para agradecer e fazer um pedido.', 'Agradecer e pedir algo usando formas comuns de cortesia.', '감사합니다 (gamsahamnida) = obrigado(a); 주세요 (juseyo) = por favor, dê-me; 괜찮아요 (gwaenchanayo) = tudo bem. O verbo costuma aparecer no final da frase.', 'Por favor, espere um momento.', '잠시 기다려 주세요.', 'Tudo bem. Obrigado.', ['괜찮아요. 감사합니다.'], '직원', '도와드릴까요?', ['네, 감사합니다.', '지하철은 세 시예요.', '김밥은 왼쪽에 있어요.'], '네, 감사합니다.', '감사합니다. 정말 감사합니다.', 'Qual expressão de agradecimento foi repetida?', ['감사합니다.', 'gamsahamnida.', 'Obrigado(a).'], { '감사합니다 (gamsahamnida)': 'obrigado ou obrigada', '주세요 (juseyo)': 'por favor, dê-me', '괜찮아요 (gwaenchanayo)': 'tudo bem' }, '물 좀 ___ .', ['주세요', '가세요', '아파요'], '주세요', '주세요 (juseyo) transforma o item anterior em um pedido educado.'),
    ] },
    { id: 'ko-v1-unit-2', order: 2, title: 'Comida, lugares e rotina', description: 'Peça comida, encontre lugares e fale de ações simples.', lessons: [
      lesson('ko-v1-u2-l1', 'No café', 'Peça água ou uma bebida com uma frase curta.', 'Pedir uma bebida e reconhecer os contadores de copos.', '물 (mul) = água; 커피 (keopi) = café; 한 잔 (han jan) = um copo ou uma xícara. Para pedir com educação, use 주세요 (juseyo).', 'Por favor, um copo de água.', '물 한 잔 주세요.', 'Eu gostaria de um café, por favor.', ['커피 주세요.'], '직원', '무엇을 드릴까요?', ['물 한 잔 주세요.', '학교에 가요.', '왼쪽으로 가세요.'], '물 한 잔 주세요.', '손님이 커피 한 잔과 물 한 잔을 주문해요.', 'O que o cliente pede?', ['커피와 물.', 'keopi wa mul.', 'Café e água.'], { '물 (mul)': 'água', '커피 (keopi)': 'café', '한 잔 (han jan)': 'um copo ou xícara' }, '물 한 잔 ___ .', ['주세요', '읽어요', '아파요'], '주세요', '주세요 (juseyo) é uma forma educada de pedir algo.'),
      lesson('ko-v1-u2-l2', 'Comidas e preferências', 'Fale de alimentos de que gosta e faça um pedido.', 'Reconhecer alimentos e usar 좋아해요 para expressar gosto.', '김밥 (gimbap) = rolinho de arroz; 사과 (sagwa) = maçã; 좋아해요 (joahaeyo) = gosto. O verbo aparece no fim da frase.', 'Eu gosto de maçãs.', '저는 사과를 좋아해요.', 'Eu gostaria de 김밥, por favor.', ['김밥 주세요.'], '친구', '무슨 음식을 좋아해요?', ['김밥을 좋아해요.', '도서관은 오른쪽이에요.', '아홉 시에 만나요.'], '김밥을 좋아해요.', '저는 사과와 김밥을 좋아해요.', 'De quais dois alimentos a pessoa gosta?', ['사과와 김밥.', 'sagwa wa gimbap.', 'Maçã e gimbap.'], { '사과 (sagwa)': 'maçã', '김밥 (gimbap)': 'rolinho de arroz', '좋아해요 (joahaeyo)': 'gosto' }, '저는 사과를 ___ .', ['좋아해요', '주세요', '가세요'], '좋아해요', '좋아해요 (joahaeyo) expressa que a pessoa gosta de algo.'),
      lesson('ko-v1-u2-l3', 'Na estação', 'Pergunte onde fica o metrô e siga uma orientação simples.', 'Perguntar a localização de uma estação e entender esquerda/direita.', '지하철역 (jihacheol-yeok) = estação de metrô; 어디예요? (eodiyeyo?) = onde fica?; 왼쪽 (oenjjok) = esquerda; 오른쪽 (oreunjjok) = direita.', 'Onde fica a estação de metrô?', '지하철역이 어디예요?', 'Vire à direita, por favor.', ['오른쪽으로 가세요.'], '여행객', '지하철역이 어디예요?', ['왼쪽으로 쭉 가세요.', '김밥 한 줄 주세요.', '저는 브라질에서 왔어요.'], '왼쪽으로 쭉 가세요.', '은행은 지하철역 오른쪽에 있어요.', 'Onde fica o banco em relação à estação?', ['오른쪽.', 'oreunjjok.', 'À direita.'], { '지하철역 (jihacheol-yeok)': 'estação de metrô', '왼쪽 (oenjjok)': 'esquerda', '오른쪽 (oreunjjok)': 'direita' }, '지하철역이 ___예요?', ['어디', '누구', '무엇'], '어디', '어디예요? pergunta onde algo fica.'),
      lesson('ko-v1-u2-l4', 'Minha rotina', 'Conte uma ação simples que acontece pela manhã.', 'Descrever uma rotina com tempo e ação em frases curtas.', '아침 (achim) = manhã; 학교 (hakgyo) = escola; 가요 (gayo) = vou. Em coreano, a ordem comum é tópico, informação e verbo no final.', 'Eu vou para a escola de manhã.', '저는 아침에 학교에 가요.', 'Eu estudo em casa à noite.', ['저는 밤에 집에서 공부해요.'], '친구', '몇 시에 학교에 가요?', ['아침에 학교에 가요.', '물 한 잔 주세요.', '약국은 왼쪽이에요.'], '아침에 학교에 가요.', '저는 아침에 일어나고 학교에 가요.', 'Quando a pessoa vai para a escola?', ['아침에.', 'achim-e.', 'De manhã.'], { '아침 (achim)': 'manhã', '학교 (hakgyo)': 'escola', '가요 (gayo)': 'vou' }, '저는 아침에 학교에 ___ .', ['가요', '먹어요', '마셔요'], '가요', '가요 (gayo) significa vou; o verbo aparece no final da frase.'),
    ] },
  ],
};

const lessonCorrections = {
  'en-v2x-u1-l1': { dialoguePrompt: 'Você só precisa ir a Oxford e não voltará de trem. Como responde?', dialogueOptions: ['A single ticket to Oxford, please.', 'A return ticket to Oxford, please.', 'A single ticket to Cambridge, please.'] },
  'en-v2x-u1-l2': { dialoguePrompt: 'Você está no ônibus que vai ao museu e quer saber onde descer.', dialogueOptions: ['Yes, get off at the next stop.', 'No, take bus number twelve from the station.', 'Yes, the museum is two stops away.'], fillPrompt: 'Please tell me where to ___ the bus.', fillOptions: ['catch', 'board', 'miss'], fillAnswer: ['catch', 'board'], fillExplanation: '“Catch” e “board a bus” são formas naturais de dizer pegar ou embarcar em um ônibus.' },
  'en-v2x-u1-l3': { dialoguePrompt: 'O hóspede pediu o cartão-chave e o quarto dele fica no terceiro andar.', dialogueOptions: ['Of course. Your room is on the third floor.', 'Certainly. Your room is on the second floor.', 'I am sorry, your room is not ready yet.'] },
  'en-v2x-u1-l4': { dialoguePrompt: 'Você prefere o trem das onze e meia porque o das dez está lotado.', dialogueOptions: ['Yes, eleven thirty works for me.', 'Could I take the twelve o’clock train instead?', 'No, I would prefer the ten o’clock train.'], fillPrompt: 'There are two seats ___ on this train.', fillOptions: ['available', 'thirsty', 'windy'], fillAnswer: 'available', fillExplanation: '“Available” informa que os lugares ainda podem ser comprados.' },
  'en-v2x-u2-l1': { dialoguePrompt: 'Você prefere chá e também quer um copo de água.', dialogueOptions: ['Tea, please, and a glass of water.', 'Coffee, please, and a glass of water.', 'Tea, please, but no water.'] },
  'en-v2x-u2-l2': { dialoguePrompt: 'Você prefere batatas e precisa que a salada venha sem queijo.', dialogueOptions: ['Potatoes, please, and no cheese in the salad.', 'Rice, please, and no cheese in the salad.', 'Potatoes, please, and extra cheese in the salad.'] },
  'en-v2x-u2-l3': { dialoguePrompt: 'Você não come carne e quer escolher a opção de legumes.', dialogueOptions: ['The vegetable option, please. I do not eat meat.', 'The chicken, please. I do not eat meat.', 'The vegetable option, please, with extra chicken.'] },
  'en-v2x-u2-l4': { dialoguePrompt: 'Você quer comprar exatamente um quilo de maçãs.', dialogueOptions: ['Yes, I would like a kilo of apples, please.', 'Yes, I would like two kilos of apples, please.', 'No, I am just looking, thank you.'] },
  'en-v2x-u3-l1': { dialoguePrompt: 'A previsão informa sol e calor para amanhã.', dialogueOptions: ['It will be sunny and warm.', 'It will be cloudy and cold.', 'It may rain in the afternoon.'] },
  'en-v2x-u3-l2': { dialoguePrompt: 'Está ventando e você quer se manter aquecido.', dialogueOptions: ['You should wear a warm jacket.', 'You should wear a light T-shirt.', 'You should wear sunglasses and sandals.'] },
  'en-v2x-u3-l3': { dialoguePrompt: 'Você está com dor de cabeça e dor de garganta.', dialogueOptions: ['I have a headache and a sore throat.', 'I have a headache and a stomach ache.', 'I have a sore throat, but no headache.'] },
  'en-v2x-u3-l4': { dialoguePrompt: 'Você está tonto(a) e precisa encontrar um lugar para sentar.', dialogueOptions: ['I feel dizzy. Could you help me find a seat?', 'I feel cold. Could you help me find a coat?', 'I feel dizzy, but I do not need to sit down.'] },
  'en-v2x-u4-l1': { dialoguePrompt: 'Você aceita o convite e quer perguntar o horário do encontro.', dialogueOptions: ['Yes, that sounds great. What time shall we meet?', 'I am not free, but thank you for asking.', 'Yes, that sounds great. Where is the pharmacy?'] },
  'en-v2x-u4-l2': { dialoguePrompt: 'Você pode encontrar a pessoa às três e meia, antes de a biblioteca fechar.', dialogueOptions: ['Yes, let us meet at half past three.', 'Yes, let us meet at half past five.', 'No, let us meet after the library closes.'] },
  'en-v2x-u4-l3': { dialoguePrompt: 'Você achou a exposição fascinante e gostou especialmente da sala espacial.', dialogueOptions: ['I thought it was fascinating, especially the space room.', 'I thought it was interesting, especially the entrance hall.', 'I did not enjoy it; the space room was closed.'] },
  'en-v2x-u4-l4': { dialoguePrompt: 'Você aceita deixar as malas e quer saber quando o quarto ficará pronto.', dialogueOptions: ['Yes, please. Could you tell me when the room is ready?', 'No, thank you. I will keep my bags with me.', 'Yes, please. Could you tell me where the restaurant is?'], translationAnswers: ['Could we change to the next available time?', 'Could we switch to the next available time?'] },
  'es-v1-u1-l1': { dialoguePrompt: 'Você está bem e quer perguntar como a colega está.', dialogueOptions: ['Estoy bien, gracias. ¿Y tú?', 'Estoy cansada. ¿Y tú?', 'No estoy bien. ¿Y tú?'], listeningText: 'Buenos días. ¿Cómo estás hoy?', listeningQuestion: 'Qual saudação de horário aparece no áudio?', listeningAnswers: ['Buenos días.'], listeningAnswer: 'Buenos días.' },
  'es-v1-u1-l2': { dialoguePrompt: 'Você se chama Diego e quer se apresentar.', dialogueOptions: ['Me llamo Diego. Mucho gusto.', 'Me llamo Daniel. Mucho gusto.', '¿Cómo te llamas? Mucho gusto.'], fillPrompt: 'Para dizer “meu nome é Laura”, complete: Me ___ Laura.' },
  'es-v1-u1-l3': { dialoguePrompt: 'Você é do Brasil e mora em Recife.', dialogueOptions: ['Soy de Brasil y vivo en Recife.', 'Soy de Brasil y vivo en Madrid.', 'Soy de Chile y vivo en Recife.'] },
  'es-v1-u1-l4': { dialoguePrompt: 'Você não precisa de mais nada.', dialogueOptions: ['No, gracias. Eso es todo.', 'Sí, por favor. Necesito otra botella.', 'No, gracias. Quisiera pagar con tarjeta.'], orderPt: 'Um copo de água, por favor. Muito obrigado.', orderAnswer: 'Un vaso de agua, por favor. Muchas gracias.' },
  'es-v1-u2-l1': { dialoguePrompt: 'Peça um suco de laranja e uma torrada.', dialogueOptions: ['Un zumo de naranja y una tostada, por favor.', 'Un café con leche y una tostada, por favor.', 'Un zumo de naranja y una ensalada, por favor.'] },
  'es-v1-u2-l2': { dialoguePrompt: 'Você gosta da tortilla e quer perguntar se ela tem cebola.', dialogueOptions: ['Sí, me gusta. ¿Tiene cebolla?', 'No, no me gusta. ¿Tiene cebolla?', 'Sí, me gustan. ¿Tiene aceitunas?'] },
  'es-v1-u2-l3': { dialoguePrompt: 'A estação fica seguindo em frente e virando à esquerda; explique o caminho.', dialogueOptions: ['Sigue recto y gira a la izquierda.', 'Sigue recto y gira a la derecha.', 'Gira a la izquierda y vuelve a la plaza.'] },
  'es-v1-u2-l4': { dialoguePrompt: 'Você procura uma camisa no tamanho mediano.', dialogueOptions: ['Busco la talla mediana, por favor.', 'Busco la talla grande, por favor.', 'Busco un pantalón mediano, por favor.'] },
  'ko-v1-u1-l1': { dialoguePrompt: 'Você está conhecendo a pessoa pela primeira vez e quer cumprimentá-la com educação.', dialogueOptions: ['안녕하세요. 반갑습니다.', '안녕히 가세요. 반갑습니다.', '감사합니다. 반갑습니다.'], dialogueAnswer: '안녕하세요. 반갑습니다.', listeningText: '안녕하세요. 만나서 반가워요. 안녕히 가세요.', listeningAnswers: ['Tchau (dito a quem está indo embora).'], pairs: { '안녕하세요 (annyeonghaseyo)': 'olá', '감사합니다 (gamsahamnida)': 'obrigado ou obrigada', '안녕히 가세요 (annyeonghi gaseyo)': 'tchau (dito a quem está indo embora)' }, introduction: '안녕하세요 (annyeonghaseyo) = olá; 감사합니다 (gamsahamnida) = obrigado(a); 안녕히 가세요 (annyeonghi gaseyo) = tchau, dito a quem está indo embora. Em coreano, o Hangul representa sílabas formadas por blocos.' },
  'ko-v1-u1-l2': { dialoguePrompt: 'A sílaba mostrada é 가. Como você diz sua leitura?', dialogueOptions: ['가라고 읽어요.', '나라고 읽어요.', '다라고 읽어요.'] },
  'ko-v1-u1-l3': { dialoguePrompt: 'Você veio do Brasil.', dialogueOptions: ['브라질에서 왔어요.', '브라질에 가요.', '한국에서 왔어요.'] },
  'ko-v1-u1-l4': { dialoguePrompt: 'Alguém oferece ajuda e você aceita agradecendo.', dialogueOptions: ['네, 감사합니다.', '아니요, 괜찮아요.', '네, 죄송합니다.'] },
  'ko-v1-u2-l1': { dialoguePrompt: 'Peça um copo de água, por favor.', dialogueOptions: ['물 한 잔 주세요.', '커피 한 잔 주세요.', '물 두 잔 주세요.'] },
  'ko-v1-u2-l2': { dialoguePrompt: 'Você gosta de gimbap.', dialogueOptions: ['김밥을 좋아해요.', '김밥을 싫어해요.', '김밥을 주세요.'], translationPt: 'Eu gostaria de um gimbap, por favor.' },
  'ko-v1-u2-l3': { dialoguePrompt: 'Para chegar à estação, siga em frente e depois vire à esquerda.', dialogueAnswer: '쭉 가다가 왼쪽으로 도세요.', dialogueOptions: ['쭉 가다가 왼쪽으로 도세요.', '쭉 가다가 오른쪽으로 도세요.', '왼쪽으로 가다가 돌아오세요.'] },
  'ko-v1-u2-l4': { dialoguePrompt: 'Você vai para a escola pela manhã.', dialogueOptions: ['아침에 학교에 가요.', '저녁에 학교에 가요.', '아침에 집에서 공부해요.'] },
};

// Exercícios V3.3 — overrides por ID para correções editoriais sem alterar a lesson reutilizada.
export const exerciseCorrections = {
  "en-v2x-u1-l1-e1": {
    "options": [
      "A single ticket to Oxford, please.",
      "A single ticket to Cambridge, please.",
      "A return ticket to Oxford, please."
    ],
    "explanation": "O enunciado exige uma resposta coerente com: “Você só precisa ir a Oxford e não voltará de trem. Como responde?”. A opção “A single ticket to Oxford, please.” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "en-v2x-u1-l1-e2": {
    "word_bank": [
      "ticket",
      "to",
      "one-way",
      "Oxford,",
      "I",
      "need",
      "please.",
      "a"
    ],
    "explanation": "Uma forma correta é “I need a one-way ticket to Oxford, please.” Pedir uma passagem e entender informações básicas de embarque."
  },
  "en-v2x-u1-l1-e3": {
    "accepted_answers": [
      "What time does the train to Oxford leave?",
      "When does the train to Oxford leave?",
      "What time does the Oxford train depart?"
    ],
    "answer_key": {
      "accepted": [
        "What time does the train to Oxford leave?",
        "When does the train to Oxford leave?",
        "What time does the Oxford train depart?"
      ]
    },
    "explanation": "Resposta esperada: “What time does the train to Oxford leave?” Pedir uma passagem e entender informações básicas de embarque."
  },
  "en-v2x-u1-l1-e4": {
    "accepted_answers": [
      "Às nove e quinze.",
      "9h15.",
      "Nove e quinze."
    ],
    "answer_key": {
      "accepted": [
        "Às nove e quinze.",
        "9h15.",
        "Nove e quinze."
      ]
    },
    "explanation": "O áudio diz: “The train to Oxford leaves at nine fifteen.”"
  },
  "en-v2x-u1-l1-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “I need a one-way ticket to Oxford, please.”"
  },
  "en-v2x-u1-l2-e1": {
    "prompt": "Um passageiro pergunta se este ônibus vai ao museu. Você sabe que é preciso descer na próxima parada. O que responde?",
    "options": [
      "No, take bus number twelve from the station.",
      "Yes, get off at the next stop.",
      "Yes, the museum is two stops away."
    ],
    "explanation": "A pergunta é sobre o ônibus que vai ao museu. “Yes, get off at the next stop” confirma a linha e informa a parada em que o passageiro deve descer."
  },
  "en-v2x-u1-l2-e2": {
    "word_bank": [
      "centre?",
      "to",
      "the",
      "city",
      "Which",
      "bus",
      "goes"
    ],
    "explanation": "Uma forma correta é “Which bus goes to the city centre?” Perguntar onde pegar um ônibus e entender o número da linha."
  },
  "en-v2x-u1-l2-e3": {
    "accepted_answers": [
      "Where is the bus stop?",
      "Where's the bus stop?",
      "Where can I find the bus stop?"
    ],
    "answer_key": {
      "accepted": [
        "Where is the bus stop?",
        "Where's the bus stop?",
        "Where can I find the bus stop?"
      ]
    },
    "explanation": "Resposta esperada: “Where is the bus stop?” Perguntar onde pegar um ônibus e entender o número da linha."
  },
  "en-v2x-u1-l2-e4": {
    "accepted_answers": [
      "O ônibus número doze.",
      "Ônibus número doze.",
      "Número doze.",
      "O ônibus 12."
    ],
    "answer_key": {
      "accepted": [
        "O ônibus número doze.",
        "Ônibus número doze.",
        "Número doze.",
        "O ônibus 12."
      ]
    },
    "explanation": "O áudio diz: “Take bus number twelve and get off at the library.”"
  },
  "en-v2x-u1-l2-e6": {
    "explanation": "“Catch the bus” significa pegar o ônibus; “board the bus” significa embarcar. As duas formas completam a frase. “Miss the bus” significa perder o ônibus."
  },
  "en-v2x-u1-l2-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “Which bus goes to the city centre?”"
  },
  "en-v2x-u1-l3-e1": {
    "prompt": "Você trabalha na recepção do hotel. O hóspede pede o cartão-chave e o quarto dele fica no terceiro andar. Como responde?",
    "options": [
      "Certainly. Your room is on the second floor.",
      "I am sorry, your room is not ready yet.",
      "Of course. Your room is on the third floor."
    ],
    "explanation": "A pessoa da recepção confirma o pedido e informa “third floor” (terceiro andar). A alternativa com “second floor” muda o andar; a outra informa que o quarto não está pronto."
  },
  "en-v2x-u1-l3-e2": {
    "word_bank": [
      "I",
      "under",
      "a",
      "Ana",
      "Costa.",
      "have",
      "reservation"
    ],
    "explanation": "Uma forma correta é “I have a reservation under Ana Costa.” Informar uma reserva e pedir detalhes simples sobre o quarto."
  },
  "en-v2x-u1-l3-e3": {
    "accepted_answers": [
      "Breakfast starts at seven.",
      "Breakfast begins at seven.",
      "Breakfast starts at 7."
    ],
    "answer_key": {
      "accepted": [
        "Breakfast starts at seven.",
        "Breakfast begins at seven.",
        "Breakfast starts at 7."
      ]
    },
    "explanation": "Resposta esperada: “Breakfast starts at seven.” Informar uma reserva e pedir detalhes simples sobre o quarto."
  },
  "en-v2x-u1-l3-e4": {
    "accepted_answers": [
      "Das sete às dez.",
      "Das 7 às 10."
    ],
    "answer_key": {
      "accepted": [
        "Das sete às dez.",
        "Das 7 às 10."
      ]
    },
    "explanation": "O áudio diz: “Breakfast is served from seven to ten in the dining room.”"
  },
  "en-v2x-u1-l3-e6": {
    "options": [
      "forecast",
      "appointment",
      "reservation"
    ]
  },
  "en-v2x-u1-l3-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “I have a reservation under Ana Costa.”"
  },
  "en-v2x-u1-l4-e1": {
    "options": [
      "Yes, eleven thirty works for me.",
      "No, I would prefer the ten o’clock train.",
      "Could I take the twelve o’clock train instead?"
    ],
    "explanation": "O enunciado exige uma resposta coerente com: “Você prefere o trem das onze e meia porque o das dez está lotado.”. A opção “Yes, eleven thirty works for me.” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "en-v2x-u1-l4-e2": {
    "word_bank": [
      "That",
      "for",
      "time",
      "me.",
      "works"
    ],
    "explanation": "Uma forma correta é “That time works for me.” Perguntar sobre disponibilidade e escolher um horário para viajar."
  },
  "en-v2x-u1-l4-e3": {
    "accepted_answers": [
      "There are still two seats available.",
      "Two seats are still available.",
      "There are two seats still available."
    ],
    "answer_key": {
      "accepted": [
        "There are still two seats available.",
        "Two seats are still available.",
        "There are two seats still available."
      ]
    },
    "explanation": "Resposta esperada: “There are still two seats available.” Perguntar sobre disponibilidade e escolher um horário para viajar."
  },
  "en-v2x-u1-l4-e4": {
    "accepted_answers": [
      "Dois lugares.",
      "Dois assentos."
    ],
    "answer_key": {
      "accepted": [
        "Dois lugares.",
        "Dois assentos."
      ]
    },
    "explanation": "O áudio diz: “There are two seats available on the eleven thirty train.”"
  },
  "en-v2x-u1-l4-e6": {
    "options": [
      "available",
      "windy",
      "thirsty"
    ]
  },
  "en-v2x-u1-l4-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “That time works for me.”"
  },
  "en-v2x-u2-l1-e1": {
    "options": [
      "Coffee, please, and a glass of water.",
      "Tea, please, and a glass of water.",
      "Tea, please, but no water."
    ],
    "explanation": "O enunciado exige uma resposta coerente com: “Você prefere chá e também quer um copo de água.”. A opção “Tea, please, and a glass of water.” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "en-v2x-u2-l1-e2": {
    "word_bank": [
      "I",
      "sandwich",
      "still",
      "a",
      "please.",
      "like",
      "would",
      "water,",
      "and"
    ],
    "explanation": "Uma forma correta é “I would like a sandwich and still water, please.” Pedir comida e bebida com cortesia usando “would like”."
  },
  "en-v2x-u2-l1-e3": {
    "accepted_answers": [
      "Could I see the menu, please?",
      "Can I see the menu, please?",
      "May I see the menu, please?"
    ],
    "answer_key": {
      "accepted": [
        "Could I see the menu, please?",
        "Can I see the menu, please?",
        "May I see the menu, please?"
      ]
    },
    "explanation": "Resposta esperada: “Could I see the menu, please?” Pedir comida e bebida com cortesia usando “would like”."
  },
  "en-v2x-u2-l1-e4": {
    "explanation": "O áudio diz: “The customer orders a cheese sandwich and a cup of tea.”",
    "accepted_answers": [
      "Um sanduíche de queijo."
    ],
    "answer_key": {
      "accepted": [
        "Um sanduíche de queijo."
      ]
    }
  },
  "en-v2x-u2-l1-e6": {
    "options": [
      "bandage",
      "cup",
      "platform"
    ]
  },
  "en-v2x-u2-l1-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “I would like a sandwich and still water, please.”"
  },
  "en-v2x-u2-l2-e1": {
    "options": [
      "Rice, please, and no cheese in the salad.",
      "Potatoes, please, and extra cheese in the salad.",
      "Potatoes, please, and no cheese in the salad."
    ],
    "explanation": "O enunciado exige uma resposta coerente com: “Você prefere batatas e precisa que a salada venha sem queijo.”. A opção “Potatoes, please, and no cheese in the salad.” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "en-v2x-u2-l2-e2": {
    "word_bank": [
      "the",
      "cheese.",
      "without",
      "I",
      "salad",
      "like",
      "would"
    ],
    "explanation": "Uma forma correta é “I would like the salad without cheese.” Fazer um pedido e confirmar um ingrediente de um prato."
  },
  "en-v2x-u2-l2-e3": {
    "accepted_answers": [
      "Does this dish have peanuts?",
      "Does this dish contain peanuts?",
      "Are there peanuts in this dish?"
    ],
    "answer_key": {
      "accepted": [
        "Does this dish have peanuts?",
        "Does this dish contain peanuts?",
        "Are there peanuts in this dish?"
      ]
    },
    "explanation": "Resposta esperada: “Does this dish have peanuts?” Fazer um pedido e confirmar um ingrediente de um prato."
  },
  "en-v2x-u2-l2-e4": {
    "explanation": "O áudio diz: “The vegetable soup is served with bread.”",
    "accepted_answers": [
      "Pão."
    ],
    "answer_key": {
      "accepted": [
        "Pão."
      ]
    }
  },
  "en-v2x-u2-l2-e6": {
    "options": [
      "between",
      "cloudy",
      "without"
    ]
  },
  "en-v2x-u2-l2-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “I would like the salad without cheese.”"
  },
  "en-v2x-u2-l3-e1": {
    "options": [
      "The vegetable option, please. I do not eat meat.",
      "The vegetable option, please, with extra chicken.",
      "The chicken, please. I do not eat meat."
    ],
    "explanation": "O enunciado exige uma resposta coerente com: “Você não come carne e quer escolher a opção de legumes.”. A opção “The vegetable option, please. I do not eat meat.” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "en-v2x-u2-l3-e2": {
    "word_bank": [
      "I",
      "vegetables",
      "prefer",
      "and",
      "rice."
    ],
    "explanation": "Uma forma correta é “I prefer vegetables and rice.” Expressar uma preferência alimentar e pedir uma alternativa."
  },
  "en-v2x-u2-l3-e3": {
    "explanation": "Resposta esperada: “I do not eat meat.” Expressar uma preferência alimentar e pedir uma alternativa."
  },
  "en-v2x-u2-l3-e4": {
    "explanation": "O áudio diz: “The customer prefers the vegetable option and does not eat meat.”",
    "accepted_answers": [
      "A opção de legumes."
    ],
    "answer_key": {
      "accepted": [
        "A opção de legumes."
      ]
    }
  },
  "en-v2x-u2-l3-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “I prefer vegetables and rice.”"
  },
  "en-v2x-u2-l4-e1": {
    "options": [
      "Yes, I would like two kilos of apples, please.",
      "Yes, I would like a kilo of apples, please.",
      "No, I am just looking, thank you."
    ],
    "explanation": "O enunciado exige uma resposta coerente com: “Você quer comprar exatamente um quilo de maçãs.”. A opção “Yes, I would like a kilo of apples, please.” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "en-v2x-u2-l4-e2": {
    "word_bank": [
      "much",
      "apples?",
      "are",
      "these",
      "How"
    ],
    "explanation": "Uma forma correta é “How much are these apples?” Perguntar o preço e comprar uma quantidade de frutas."
  },
  "en-v2x-u2-l4-e3": {
    "accepted_answers": [
      "I would like half a kilo of tomatoes.",
      "I'd like half a kilo of tomatoes.",
      "Can I have half a kilo of tomatoes, please?"
    ],
    "answer_key": {
      "accepted": [
        "I would like half a kilo of tomatoes.",
        "I'd like half a kilo of tomatoes.",
        "Can I have half a kilo of tomatoes, please?"
      ]
    },
    "explanation": "Resposta esperada: “I would like half a kilo of tomatoes.” Perguntar o preço e comprar uma quantidade de frutas."
  },
  "en-v2x-u2-l4-e4": {
    "accepted_answers": [
      "Três libras por quilo.",
      "Três libras."
    ],
    "answer_key": {
      "accepted": [
        "Três libras por quilo.",
        "Três libras."
      ]
    },
    "explanation": "O áudio diz: “The apples cost three pounds a kilo.”"
  },
  "en-v2x-u2-l4-e6": {
    "options": [
      "is",
      "are",
      "does"
    ]
  },
  "en-v2x-u2-l4-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “How much are these apples?”"
  },
  "en-v2x-u3-l1-e1": {
    "options": [
      "It will be cloudy and cold.",
      "It may rain in the afternoon.",
      "It will be sunny and warm."
    ],
    "explanation": "O enunciado exige uma resposta coerente com: “A previsão informa sol e calor para amanhã.”. A opção “It will be sunny and warm.” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "en-v2x-u3-l1-e2": {
    "word_bank": [
      "this",
      "afternoon?",
      "it",
      "Is",
      "to",
      "going",
      "rain"
    ],
    "explanation": "Uma forma correta é “Is it going to rain this afternoon?” Entender uma previsão simples e perguntar sobre o clima."
  },
  "en-v2x-u3-l1-e3": {
    "accepted_answers": [
      "The forecast says it will be sunny tomorrow.",
      "According to the forecast, it'll be sunny tomorrow."
    ],
    "answer_key": {
      "accepted": [
        "The forecast says it will be sunny tomorrow.",
        "According to the forecast, it'll be sunny tomorrow."
      ]
    },
    "explanation": "Resposta esperada: “The forecast says it will be sunny tomorrow.” Entender uma previsão simples e perguntar sobre o clima."
  },
  "en-v2x-u3-l1-e4": {
    "accepted_answers": [
      "Depois das quatro."
    ],
    "answer_key": {
      "accepted": [
        "Depois das quatro."
      ]
    },
    "explanation": "O áudio diz: “The forecast says it will rain after four o’clock.”"
  },
  "en-v2x-u3-l1-e6": {
    "options": [
      "board",
      "order",
      "rain"
    ]
  },
  "en-v2x-u3-l1-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “Is it going to rain this afternoon?”"
  },
  "en-v2x-u3-l2-e1": {
    "explanation": "O enunciado exige uma resposta coerente com: “Está ventando e você quer se manter aquecido.”. A opção “You should wear a warm jacket.” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "en-v2x-u3-l2-e2": {
    "word_bank": [
      "raincoat.",
      "You",
      "a",
      "take",
      "should"
    ],
    "explanation": "Uma forma correta é “You should take a raincoat.” Relacionar roupas e clima usando recomendações simples."
  },
  "en-v2x-u3-l2-e3": {
    "accepted_answers": [
      "It is cold, so I will wear a coat.",
      "It's cold, so I'll put on a coat."
    ],
    "answer_key": {
      "accepted": [
        "It is cold, so I will wear a coat.",
        "It's cold, so I'll put on a coat."
      ]
    },
    "explanation": "Resposta esperada: “It is cold, so I will wear a coat.” Relacionar roupas e clima usando recomendações simples."
  },
  "en-v2x-u3-l2-e4": {
    "explanation": "O áudio diz: “She takes an umbrella because it is raining.”",
    "accepted_answers": [
      "Porque está chovendo."
    ],
    "answer_key": {
      "accepted": [
        "Porque está chovendo."
      ]
    }
  },
  "en-v2x-u3-l2-e6": {
    "options": [
      "umbrella",
      "platform",
      "appointment"
    ]
  },
  "en-v2x-u3-l2-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “You should take a raincoat.”"
  },
  "en-v2x-u3-l3-e1": {
    "options": [
      "I have a sore throat, but no headache.",
      "I have a headache and a sore throat.",
      "I have a headache and a stomach ache."
    ],
    "explanation": "O enunciado exige uma resposta coerente com: “Você está com dor de cabeça e dor de garganta.”. A opção “I have a headache and a sore throat.” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "en-v2x-u3-l3-e2": {
    "word_bank": [
      "throat",
      "I",
      "have",
      "sore",
      "had",
      "yesterday.",
      "since",
      "a"
    ],
    "explanation": "Uma forma correta é “I have had a sore throat since yesterday.” Explicar um sintoma e pedir orientação básica na farmácia."
  },
  "en-v2x-u3-l3-e3": {
    "accepted_answers": [
      "Where is the nearest pharmacy?",
      "Where's the nearest pharmacy?",
      "Where is the closest pharmacy?"
    ],
    "answer_key": {
      "accepted": [
        "Where is the nearest pharmacy?",
        "Where's the nearest pharmacy?",
        "Where is the closest pharmacy?"
      ]
    },
    "explanation": "Resposta esperada: “Where is the nearest pharmacy?” Explicar um sintoma e pedir orientação básica na farmácia."
  },
  "en-v2x-u3-l3-e4": {
    "accepted_answers": [
      "Dor de cabeça.",
      "Uma dor de cabeça."
    ],
    "answer_key": {
      "accepted": [
        "Dor de cabeça.",
        "Uma dor de cabeça."
      ]
    },
    "explanation": "O áudio diz: “The customer has a headache and asks for pain relief.”"
  },
  "en-v2x-u3-l3-e6": {
    "options": [
      "single",
      "sore",
      "sunny"
    ]
  },
  "en-v2x-u3-l3-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “I have had a sore throat since yesterday.”"
  },
  "en-v2x-u3-l4-e1": {
    "options": [
      "I feel cold. Could you help me find a coat?",
      "I feel dizzy, but I do not need to sit down.",
      "I feel dizzy. Could you help me find a seat?"
    ],
    "explanation": "O enunciado exige uma resposta coerente com: “Você está tonto(a) e precisa encontrar um lugar para sentar.”. A opção “I feel dizzy. Could you help me find a seat?” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "en-v2x-u3-l4-e2": {
    "word_bank": [
      "Could",
      "me,",
      "please?",
      "help",
      "you"
    ],
    "explanation": "Uma forma correta é “Could you help me, please?” Pedir ajuda e informar um sintoma ou uma necessidade imediata."
  },
  "en-v2x-u3-l4-e3": {
    "accepted_answers": [
      "I feel dizzy and I need to sit down.",
      "I'm feeling dizzy and need to sit down."
    ],
    "answer_key": {
      "accepted": [
        "I feel dizzy and I need to sit down.",
        "I'm feeling dizzy and need to sit down."
      ]
    },
    "explanation": "Resposta esperada: “I feel dizzy and I need to sit down.” Pedir ajuda e informar um sintoma ou uma necessidade imediata."
  },
  "en-v2x-u3-l4-e4": {
    "accepted_answers": [
      "Um lugar para sentar.",
      "Um assento."
    ],
    "answer_key": {
      "accepted": [
        "Um lugar para sentar.",
        "Um assento."
      ]
    },
    "explanation": "O áudio diz: “The person feels dizzy and asks for a place to sit.”"
  },
  "en-v2x-u3-l4-e6": {
    "options": [
      "available",
      "delicious",
      "dizzy"
    ]
  },
  "en-v2x-u3-l4-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “Could you help me, please?”"
  },
  "en-v2x-u4-l1-e1": {
    "options": [
      "Yes, that sounds great. What time shall we meet?",
      "Yes, that sounds great. Where is the pharmacy?",
      "I am not free, but thank you for asking."
    ],
    "explanation": "O enunciado exige uma resposta coerente com: “Você aceita o convite e quer perguntar o horário do encontro.”. A opção “Yes, that sounds great. What time shall we meet?” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "en-v2x-u4-l1-e2": {
    "word_bank": [
      "visit",
      "with",
      "me?",
      "Would",
      "you",
      "museum",
      "like",
      "to",
      "the"
    ],
    "explanation": "Uma forma correta é “Would you like to visit the museum with me?” Fazer um convite usando “Would you like to…?”"
  },
  "en-v2x-u4-l1-e3": {
    "accepted_answers": [
      "How about going to the park on Saturday?",
      "What about going to the park on Saturday?",
      "Shall we go to the park on Saturday?"
    ],
    "answer_key": {
      "accepted": [
        "How about going to the park on Saturday?",
        "What about going to the park on Saturday?",
        "Shall we go to the park on Saturday?"
      ]
    },
    "explanation": "Resposta esperada: “How about going to the park on Saturday?” Fazer um convite usando “Would you like to…?”"
  },
  "en-v2x-u4-l1-e4": {
    "explanation": "O áudio diz: “They agree to meet at the museum entrance at two.”",
    "accepted_answers": [
      "Na entrada do museu."
    ],
    "answer_key": {
      "accepted": [
        "Na entrada do museu."
      ]
    }
  },
  "en-v2x-u4-l1-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “Would you like to visit the museum with me?”"
  },
  "en-v2x-u4-l2-e1": {
    "options": [
      "No, let us meet after the library closes.",
      "Yes, let us meet at half past three.",
      "Yes, let us meet at half past five."
    ],
    "explanation": "O enunciado exige uma resposta coerente com: “Você pode encontrar a pessoa às três e meia, antes de a biblioteca fechar.”. A opção “Yes, let us meet at half past three.” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "en-v2x-u4-l2-e2": {
    "word_bank": [
      "Are",
      "at",
      "past",
      "you",
      "three?",
      "half",
      "free"
    ],
    "explanation": "Uma forma correta é “Are you free at half past three?” Sugerir e confirmar um horário para uma atividade."
  },
  "en-v2x-u4-l2-e3": {
    "accepted_answers": [
      "We can meet after class.",
      "We can get together after class."
    ],
    "answer_key": {
      "accepted": [
        "We can meet after class.",
        "We can get together after class."
      ]
    },
    "explanation": "Resposta esperada: “We can meet after class.” Sugerir e confirmar um horário para uma atividade."
  },
  "en-v2x-u4-l2-e4": {
    "accepted_answers": [
      "Às três e meia.",
      "Às 15h30.",
      "Três e meia."
    ],
    "answer_key": {
      "accepted": [
        "Às três e meia.",
        "Às 15h30.",
        "Três e meia."
      ]
    },
    "explanation": "O áudio diz: “The library closes at five, so they choose half past three.”"
  },
  "en-v2x-u4-l2-e6": {
    "options": [
      "in",
      "at",
      "on"
    ]
  },
  "en-v2x-u4-l2-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “Are you free at half past three?”"
  },
  "en-v2x-u4-l3-e1": {
    "prompt": "Você achou a exposição fascinante e gostou especialmente da área dedicada ao espaço.",
    "options": [
      "I thought it was interesting, especially the entrance hall.",
      "I did not enjoy it; the space exhibit was closed.",
      "I thought it was fascinating, especially the space exhibit."
    ],
    "accepted_answers": [
      "I thought it was fascinating, especially the space exhibit."
    ],
    "answer_key": {
      "accepted": [
        "I thought it was fascinating, especially the space exhibit."
      ]
    },
    "explanation": "“Space exhibit” identifica a parte da exposição dedicada ao espaço. A resposta destaca que ela foi fascinante, sem trocar a área visitada nem negar a experiência."
  },
  "en-v2x-u4-l3-e2": {
    "word_bank": [
      "I",
      "interesting.",
      "very",
      "film",
      "was",
      "think",
      "the"
    ],
    "explanation": "Uma forma correta é “I think the film was very interesting.” Expressar uma opinião e perguntar a opinião de outra pessoa."
  },
  "en-v2x-u4-l3-e3": {
    "accepted_answers": [
      "What did you think of the book?",
      "How did you like the book?",
      "What was your opinion of the book?"
    ],
    "answer_key": {
      "accepted": [
        "What did you think of the book?",
        "How did you like the book?",
        "What was your opinion of the book?"
      ]
    },
    "explanation": "Resposta esperada: “What did you think of the book?” Expressar uma opinião e perguntar a opinião de outra pessoa."
  },
  "en-v2x-u4-l3-e4": {
    "prompt": "De qual parte da exposição a pessoa mais gostou?",
    "accepted_answers": [
      "Da exposição sobre o espaço.",
      "Da área dedicada ao espaço."
    ],
    "answer_key": {
      "accepted": [
        "Da exposição sobre o espaço.",
        "Da área dedicada ao espaço."
      ]
    },
    "explanation": "O áudio informa que a parte preferida foi “the space exhibit”, a área da exposição dedicada ao espaço.",
    "audio_text": "The visitor liked the space exhibit best."
  },
  "en-v2x-u4-l3-e6": {
    "options": [
      "take",
      "leave",
      "think"
    ]
  },
  "en-v2x-u4-l3-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “I think the film was very interesting.”"
  },
  "en-v2x-u4-l4-e1": {
    "options": [
      "Yes, please. Could you tell me when the room is ready?",
      "Yes, please. Could you tell me where the restaurant is?",
      "No, thank you. I will keep my bags with me."
    ],
    "explanation": "O enunciado exige uma resposta coerente com: “Você aceita deixar as malas e quer saber quando o quarto ficará pronto.”. A opção “Yes, please. Could you tell me when the room is ready?” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "en-v2x-u4-l4-e2": {
    "word_bank": [
      "There",
      "a",
      "with",
      "my",
      "problem",
      "is",
      "reservation."
    ],
    "explanation": "Uma forma correta é “There is a problem with my reservation.” Relatar um pequeno imprevisto e propor uma alternativa."
  },
  "en-v2x-u4-l4-e3": {
    "accepted_answers": [
      "Could we change to the next available time?",
      "Could we switch to the next available time?",
      "Could we move it to the next available time?"
    ],
    "answer_key": {
      "accepted": [
        "Could we change to the next available time?",
        "Could we switch to the next available time?",
        "Could we move it to the next available time?"
      ]
    },
    "explanation": "Resposta esperada: “Could we change to the next available time?” Relatar um pequeno imprevisto e propor uma alternativa."
  },
  "en-v2x-u4-l4-e4": {
    "accepted_answers": [
      "O quarto.",
      "O quarto de hóspedes."
    ],
    "answer_key": {
      "accepted": [
        "O quarto.",
        "O quarto de hóspedes."
      ]
    },
    "explanation": "O áudio diz: “The receptionist says the room is not ready yet.”"
  },
  "en-v2x-u4-l4-e6": {
    "options": [
      "with",
      "between",
      "at"
    ]
  },
  "en-v2x-u4-l4-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “There is a problem with my reservation.”"
  },
  "es-v1-u1-l1-e1": {
    "explanation": "O enunciado exige uma resposta coerente com: “Você está bem e quer perguntar como a colega está.”. A opção “Estoy bien, gracias. ¿Y tú?” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "es-v1-u1-l1-e2": {
    "word_bank": [
      "Buenos",
      "días.",
      "estás?",
      "¿Cómo"
    ],
    "explanation": "Uma forma correta é “Buenos días. ¿Cómo estás?” Cumprimentar, perguntar como alguém está e despedir-se."
  },
  "es-v1-u1-l1-e3": {
    "accepted_answers": [
      "Hasta mañana. Que tengas una buena tarde.",
      "Hasta mañana. Que pases una buena tarde."
    ],
    "answer_key": {
      "accepted": [
        "Hasta mañana. Que tengas una buena tarde.",
        "Hasta mañana. Que pases una buena tarde."
      ]
    },
    "explanation": "Resposta esperada: “Hasta mañana. Que tengas una buena tarde.” Cumprimentar, perguntar como alguém está e despedir-se."
  },
  "es-v1-u1-l1-e4": {
    "accepted_answers": [
      "Bom dia."
    ],
    "answer_key": {
      "accepted": [
        "Bom dia."
      ]
    },
    "explanation": "O áudio diz: “Buenos días. ¿Cómo estás hoy?”"
  },
  "es-v1-u1-l1-e6": {
    "options": [
      "Buenas",
      "Hasta",
      "Buenos"
    ]
  },
  "es-v1-u1-l1-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “Buenos días. ¿Cómo estás?”"
  },
  "es-v1-u1-l2-e1": {
    "options": [
      "¿Cómo te llamas? Mucho gusto.",
      "Me llamo Diego. Mucho gusto.",
      "Me llamo Daniel. Mucho gusto."
    ],
    "explanation": "O enunciado exige uma resposta coerente com: “Você se chama Diego e quer se apresentar.”. A opção “Me llamo Diego. Mucho gusto.” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "es-v1-u1-l2-e2": {
    "word_bank": [
      "llamo",
      "Me",
      "Camila.",
      "Mucho",
      "gusto."
    ],
    "explanation": "Uma forma correta é “Me llamo Camila. Mucho gusto.” Apresentar-se e perguntar o nome com formas naturais em espanhol."
  },
  "es-v1-u1-l2-e3": {
    "accepted_answers": [
      "¿Cómo te llamas?",
      "¿Cuál es tu nombre?"
    ],
    "answer_key": {
      "accepted": [
        "¿Cómo te llamas?",
        "¿Cuál es tu nombre?"
      ]
    },
    "explanation": "Resposta esperada: “¿Cómo te llamas?” Apresentar-se e perguntar o nome com formas naturais em espanhol."
  },
  "es-v1-u1-l2-e4": {
    "prompt": "Qual nome a pessoa informa ao se apresentar?",
    "explanation": "A pessoa se apresenta usando o nome Elena; a resposta pedida é o nome, não todas as informações da apresentação.",
    "accepted_answers": [
      "Ela se chama Elena.",
      "Elena."
    ],
    "answer_key": {
      "accepted": [
        "Ela se chama Elena.",
        "Elena."
      ]
    }
  },
  "es-v1-u1-l2-e6": {
    "options": [
      "gusta",
      "llamo",
      "duele"
    ]
  },
  "es-v1-u1-l2-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “Me llamo Camila. Mucho gusto.”"
  },
  "es-v1-u1-l3-e1": {
    "options": [
      "Soy de Chile y vivo en Recife.",
      "Soy de Brasil y vivo en Madrid.",
      "Soy de Brasil y vivo en Recife."
    ],
    "explanation": "O enunciado exige uma resposta coerente com: “Você é do Brasil e mora em Recife.”. A opção “Soy de Brasil y vivo en Recife.” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "es-v1-u1-l3-e2": {
    "word_bank": [
      "Soy",
      "de",
      "vivo",
      "Brasil,",
      "en",
      "pero",
      "Salvador."
    ],
    "explanation": "Uma forma correta é “Soy de Brasil, pero vivo en Salvador.” Perguntar de onde alguém é e responder com país ou cidade."
  },
  "es-v1-u1-l3-e3": {
    "explanation": "Resposta esperada: “¿De dónde eres?” Perguntar de onde alguém é e responder com país ou cidade."
  },
  "es-v1-u1-l3-e4": {
    "explanation": "O áudio diz: “La estudiante es de Brasil y vive en Recife.”",
    "accepted_answers": [
      "Em Recife.",
      "Recife."
    ],
    "answer_key": {
      "accepted": [
        "Em Recife.",
        "Recife."
      ]
    }
  },
  "es-v1-u1-l3-e6": {
    "options": [
      "a",
      "con",
      "de"
    ]
  },
  "es-v1-u1-l3-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “Soy de Brasil, pero vivo en Salvador.”"
  },
  "es-v1-u1-l4-e1": {
    "explanation": "O enunciado exige uma resposta coerente com: “Você não precisa de mais nada.”. A opção “No, gracias. Eso es todo.” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "es-v1-u1-l4-e2": {
    "word_bank": [
      "gracias.",
      "por",
      "agua,",
      "vaso",
      "Un",
      "favor.",
      "de",
      "Muchas"
    ],
    "explanation": "Uma forma correta é “Un vaso de agua, por favor. Muchas gracias.” Usar “por favor”, “gracias” e “de nada” em pedidos simples."
  },
  "es-v1-u1-l4-e3": {
    "accepted_answers": [
      "Disculpe, ¿puede ayudarme?",
      "Perdone, ¿me puede ayudar?",
      "Disculpe, ¿podría ayudarme?"
    ],
    "answer_key": {
      "accepted": [
        "Disculpe, ¿puede ayudarme?",
        "Perdone, ¿me puede ayudar?",
        "Disculpe, ¿podría ayudarme?"
      ]
    },
    "explanation": "Resposta esperada: “Disculpe, ¿puede ayudarme?” Usar “por favor”, “gracias” e “de nada” em pedidos simples."
  },
  "es-v1-u1-l4-e4": {
    "explanation": "O áudio diz: “La persona pide una botella de agua, por favor.”",
    "accepted_answers": [
      "Uma garrafa de água.",
      "Água."
    ],
    "answer_key": {
      "accepted": [
        "Uma garrafa de água.",
        "Água."
      ]
    }
  },
  "es-v1-u1-l4-e6": {
    "options": [
      "por",
      "en",
      "de"
    ]
  },
  "es-v1-u1-l4-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “Un vaso de agua, por favor. Muchas gracias.”"
  },
  "es-v1-u2-l1-e1": {
    "options": [
      "Un café con leche y una tostada, por favor.",
      "Un zumo de naranja y una tostada, por favor.",
      "Un zumo de naranja y una ensalada, por favor."
    ],
    "explanation": "O enunciado exige uma resposta coerente com: “Peça um suco de laranja e uma torrada.”. A opção “Un zumo de naranja y una tostada, por favor.” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "es-v1-u2-l1-e2": {
    "word_bank": [
      "con",
      "Quisiera",
      "una",
      "y",
      "café",
      "tostada.",
      "leche",
      "un"
    ],
    "explanation": "Uma forma correta é “Quisiera un café con leche y una tostada.” Fazer um pedido simples em um café espanhol."
  },
  "es-v1-u2-l1-e3": {
    "accepted_answers": [
      "¿Me trae la cuenta, por favor?",
      "¿Podría traerme la cuenta, por favor?",
      "¿Me puede traer la cuenta, por favor?"
    ],
    "answer_key": {
      "accepted": [
        "¿Me trae la cuenta, por favor?",
        "¿Podría traerme la cuenta, por favor?",
        "¿Me puede traer la cuenta, por favor?"
      ]
    },
    "explanation": "Resposta esperada: “¿Me trae la cuenta, por favor?” Fazer um pedido simples em um café espanhol."
  },
  "es-v1-u2-l1-e4": {
    "accepted_answers": [
      "Dois euros e cinquenta.",
      "2 euros e 50 cêntimos.",
      "2,50 euros."
    ],
    "answer_key": {
      "accepted": [
        "Dois euros e cinquenta.",
        "2 euros e 50 cêntimos.",
        "2,50 euros."
      ]
    },
    "explanation": "O áudio diz: “El café con leche cuesta dos euros con cincuenta.”"
  },
  "es-v1-u2-l1-e6": {
    "options": [
      "dolor",
      "zumo",
      "andén"
    ]
  },
  "es-v1-u2-l1-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “Quisiera un café con leche y una tostada.”"
  },
  "es-v1-u2-l2-e1": {
    "options": [
      "No, no me gusta. ¿Tiene cebolla?",
      "Sí, me gustan. ¿Tiene aceitunas?",
      "Sí, me gusta. ¿Tiene cebolla?"
    ],
    "explanation": "O enunciado exige uma resposta coerente com: “Você gosta da tortilla e quer perguntar se ela tem cebola.”. A opção “Sí, me gusta. ¿Tiene cebolla?” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "es-v1-u2-l2-e2": {
    "word_bank": [
      "gustan",
      "no",
      "las",
      "Me",
      "aceitunas.",
      "me",
      "las",
      "pero",
      "gustan",
      "verduras,"
    ],
    "explanation": "Uma forma correta é “Me gustan las verduras, pero no me gustan las aceitunas.” Expressar gostos e escolher uma refeição."
  },
  "es-v1-u2-l2-e3": {
    "accepted_answers": [
      "Prefiero una ensalada sin cebolla.",
      "Me quedo con una ensalada sin cebolla."
    ],
    "answer_key": {
      "accepted": [
        "Prefiero una ensalada sin cebolla.",
        "Me quedo con una ensalada sin cebolla."
      ]
    },
    "explanation": "Resposta esperada: “Prefiero una ensalada sin cebolla.” Expressar gostos e escolher uma refeição."
  },
  "es-v1-u2-l2-e4": {
    "accepted_answers": [
      "De azeitonas.",
      "Azeitonas."
    ],
    "answer_key": {
      "accepted": [
        "De azeitonas.",
        "Azeitonas."
      ]
    },
    "explanation": "O áudio diz: “A la persona le gustan las manzanas, pero no las aceitunas.”"
  },
  "es-v1-u2-l2-e6": {
    "options": [
      "gusto",
      "gusta",
      "gustan"
    ]
  },
  "es-v1-u2-l2-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “Me gustan las verduras, pero no me gustan las aceitunas.”"
  },
  "es-v1-u2-l3-e1": {
    "options": [
      "Sigue recto y gira a la izquierda.",
      "Gira a la izquierda y vuelve a la plaza.",
      "Sigue recto y gira a la derecha."
    ],
    "explanation": "O enunciado exige uma resposta coerente com: “A estação fica seguindo em frente e virando à esquerda; explique o caminho.”. A opção “Sigue recto y gira a la izquierda.” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "es-v1-u2-l3-e2": {
    "word_bank": [
      "estación",
      "cerca",
      "está",
      "de",
      "la",
      "La",
      "plaza."
    ],
    "explanation": "Uma forma correta é “La estación está cerca de la plaza.” Perguntar por um lugar e compreender direções simples."
  },
  "es-v1-u2-l3-e3": {
    "accepted_answers": [
      "¿Cómo llego al mercado?",
      "¿Cómo puedo llegar al mercado?"
    ],
    "answer_key": {
      "accepted": [
        "¿Cómo llego al mercado?",
        "¿Cómo puedo llegar al mercado?"
      ]
    },
    "explanation": "Resposta esperada: “¿Cómo llego al mercado?” Perguntar por um lugar e compreender direções simples."
  },
  "es-v1-u2-l3-e4": {
    "accepted_answers": [
      "O número seis.",
      "O ônibus número seis."
    ],
    "answer_key": {
      "accepted": [
        "O número seis.",
        "O ônibus número seis."
      ]
    },
    "explanation": "O áudio diz: “El autobús número seis para frente al museo.”"
  },
  "es-v1-u2-l3-e6": {
    "options": [
      "cerca",
      "tarde",
      "dulce"
    ]
  },
  "es-v1-u2-l3-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “La estación está cerca de la plaza.”"
  },
  "es-v1-u2-l4-e1": {
    "prompt": "Você procura uma camisa de tamanho médio. O vendedor pergunta “¿Qué talla buscas?”. Como responde?",
    "options": [
      "Busco una camisa de talla grande, por favor.",
      "Busco una camisa de talla mediana, por favor.",
      "Busco un pantalón de talla mediana, por favor."
    ],
    "accepted_answers": [
      "Busco una camisa de talla mediana, por favor."
    ],
    "answer_key": {
      "accepted": [
        "Busco una camisa de talla mediana, por favor."
      ]
    },
    "explanation": "“Camisa” é a peça solicitada e “talla mediana” informa o tamanho médio; as demais alternativas trocam a peça ou o tamanho."
  },
  "es-v1-u2-l4-e2": {
    "word_bank": [
      "camisa?",
      "cuesta",
      "esta",
      "¿Cuánto"
    ],
    "explanation": "Uma forma correta é “¿Cuánto cuesta esta camisa?” Perguntar preço e fazer um pedido de ajuda compreensível."
  },
  "es-v1-u2-l4-e3": {
    "accepted_answers": [
      "Necesito ayuda para encontrar una farmacia.",
      "Necesito ayuda para localizar una farmacia."
    ],
    "answer_key": {
      "accepted": [
        "Necesito ayuda para encontrar una farmacia.",
        "Necesito ayuda para localizar una farmacia."
      ]
    },
    "explanation": "Resposta esperada: “Necesito ayuda para encontrar una farmacia.” Perguntar preço e fazer um pedido de ajuda compreensível."
  },
  "es-v1-u2-l4-e4": {
    "explanation": "O áudio diz: “La camisa azul cuesta veinte euros.”",
    "accepted_answers": [
      "Vinte euros.",
      "20 euros."
    ],
    "answer_key": {
      "accepted": [
        "Vinte euros.",
        "20 euros."
      ]
    }
  },
  "es-v1-u2-l4-e6": {
    "options": [
      "cuesto",
      "cuesta",
      "cuestan"
    ]
  },
  "es-v1-u2-l4-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “¿Cuánto cuesta esta camisa?”"
  },
  "ko-v1-u1-l1-e1": {
    "options": [
      "안녕하세요. 반갑습니다.",
      "감사합니다. 반갑습니다.",
      "안녕히 가세요. 반갑습니다."
    ],
    "explanation": "O enunciado exige uma resposta coerente com: “Você está conhecendo a pessoa pela primeira vez e quer cumprimentá-la com educação.”. A opção “안녕하세요. 반갑습니다.” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "ko-v1-u1-l1-e2": {
    "word_bank": [
      "안녕하세요.",
      "반가워요.",
      "만나서"
    ],
    "explanation": "Uma forma correta é “안녕하세요. 만나서 반가워요.” Reconhecer 안녕하세요 e 안녕히 가세요 em uma conversa curta."
  },
  "ko-v1-u1-l1-e3": {
    "accepted_answers": [
      "오늘 고마웠어요. 다음에 또 만나요."
    ],
    "answer_key": {
      "accepted": [
        "오늘 고마웠어요. 다음에 또 만나요."
      ]
    },
    "explanation": "“오늘 고마웠어요” agradece pelo encontro de hoje; “다음에 또 만나요” indica que se verão novamente. Revisar o registro de cortesia com um especialista."
  },
  "ko-v1-u1-l1-e4": {
    "accepted_answers": [
      "Até logo.",
      "Tchau.",
      "Adeus."
    ],
    "answer_key": {
      "accepted": [
        "Até logo.",
        "Tchau.",
        "Adeus."
      ]
    },
    "explanation": "A despedida “안녕히 가세요” é dirigida a quem está indo embora. “Até logo” ou “tchau” são respostas naturais em português para esta pergunta."
  },
  "ko-v1-u1-l1-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “안녕하세요. 만나서 반가워요.”"
  },
  "ko-v1-u1-l2-e1": {
    "instruction": "Escolha a romanização aproximada da sílaba coreana.",
    "prompt": "Como se lê a sílaba 가?",
    "options": [
      "da",
      "ga",
      "na"
    ],
    "accepted_answers": [
      "ga"
    ],
    "answer_key": {
      "accepted": [
        "ga"
      ]
    },
    "explanation": "가 é composta da consoante ㄱ (g/k) e da vogal ㅏ (a). A romanização usual da sílaba é “ga”.",
    "dialogue_context": []
  },
  "ko-v1-u1-l2-e2": {
    "instruction": "Organize as sílabas em Hangul na sequência ga–na–da.",
    "prompt": "Monte a sequência de sílabas na ordem ga, na, da.",
    "word_bank": [
      "가",
      "다",
      "나"
    ],
    "accepted_answers": [
      "가 나 다"
    ],
    "answer_key": {
      "accepted": [
        "가 나 다"
      ]
    },
    "explanation": "가 = ga, 나 = na e 다 = da. Reconhecer cada bloco silábico é o objetivo da atividade."
  },
  "ko-v1-u1-l2-e3": {
    "accepted_answers": [
      "가를 읽고 나를 읽으세요.",
      "가를 읽은 다음 나를 읽으세요."
    ],
    "answer_key": {
      "accepted": [
        "가를 읽고 나를 읽으세요.",
        "가를 읽은 다음 나를 읽으세요."
      ]
    },
    "explanation": "“읽으세요” é um pedido educado para ler; “읽고”/“읽은 다음” conecta a sequência: primeiro 가, depois 나."
  },
  "ko-v1-u1-l2-e4": {
    "accepted_answers": [
      "A sílaba ga.",
      "Ga."
    ],
    "answer_key": {
      "accepted": [
        "A sílaba ga.",
        "Ga."
      ]
    },
    "explanation": "O áudio diz: “가, 나, 다. 세 음절을 차례로 읽어 보세요.”"
  },
  "ko-v1-u1-l2-e6": {
    "options": [
      "책",
      "나",
      "물"
    ]
  },
  "ko-v1-u1-l2-e7": {
    "instruction": "Leia as sílabas em voz alta. Caso não haja reconhecimento de fala, digite-as.",
    "prompt": "Pronuncie e digite, se necessário: “가, 나, 다.”",
    "accepted_answers": [
      "가, 나, 다.",
      "가 나 다"
    ],
    "answer_key": {
      "accepted": [
        "가, 나, 다.",
        "가 나 다"
      ]
    },
    "explanation": "As três sílabas são 가 (ga), 나 (na) e 다 (da). A transcrição não avalia a qualidade da pronúncia.",
    "audio_text": "가, 나, 다."
  },
  "ko-v1-u1-l3-e1": {
    "options": [
      "브라질에 가요.",
      "한국에서 왔어요.",
      "브라질에서 왔어요."
    ],
    "explanation": "O enunciado exige uma resposta coerente com: “Você veio do Brasil.”. A opção “브라질에서 왔어요.” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "ko-v1-u1-l3-e2": {
    "word_bank": [
      "아나예요.",
      "왔어요.",
      "브라질에서",
      "저는"
    ],
    "explanation": "Uma forma correta é “저는 아나예요. 브라질에서 왔어요.” Apresentar-se e informar a origem usando frases educadas."
  },
  "ko-v1-u1-l3-e3": {
    "accepted_answers": [
      "제 이름은 페드로예요.",
      "저는 페드로라고 해요."
    ],
    "answer_key": {
      "accepted": [
        "제 이름은 페드로예요.",
        "저는 페드로라고 해요."
      ]
    },
    "explanation": "Resposta esperada: “제 이름은 페드로예요.” Apresentar-se e informar a origem usando frases educadas."
  },
  "ko-v1-u1-l3-e4": {
    "accepted_answers": [
      "Brasil.",
      "Do Brasil."
    ],
    "answer_key": {
      "accepted": [
        "Brasil.",
        "Do Brasil."
      ]
    },
    "explanation": "O áudio diz: “저는 브라질에서 왔어요. 제 이름은 마리아예요.”"
  },
  "ko-v1-u1-l3-e6": {
    "options": [
      "읽어요",
      "마셔요",
      "왔어요"
    ]
  },
  "ko-v1-u1-l3-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “저는 아나예요. 브라질에서 왔어요.”"
  },
  "ko-v1-u1-l4-e1": {
    "explanation": "O enunciado exige uma resposta coerente com: “Alguém oferece ajuda e você aceita agradecendo.”. A opção “네, 감사합니다.” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "ko-v1-u1-l4-e2": {
    "word_bank": [
      "주세요.",
      "기다려",
      "잠시"
    ],
    "explanation": "Uma forma correta é “잠시 기다려 주세요.” Agradecer e pedir algo usando formas comuns de cortesia."
  },
  "ko-v1-u1-l4-e3": {
    "accepted_answers": [
      "괜찮아요. 감사합니다.",
      "네, 괜찮아요. 감사합니다."
    ],
    "answer_key": {
      "accepted": [
        "괜찮아요. 감사합니다.",
        "네, 괜찮아요. 감사합니다."
      ]
    },
    "explanation": "Resposta esperada: “괜찮아요. 감사합니다.” Agradecer e pedir algo usando formas comuns de cortesia."
  },
  "ko-v1-u1-l4-e4": {
    "accepted_answers": [
      "Obrigado.",
      "Obrigada.",
      "Obrigado(a)."
    ],
    "answer_key": {
      "accepted": [
        "Obrigado.",
        "Obrigada.",
        "Obrigado(a)."
      ]
    },
    "explanation": "“감사합니다” é uma forma educada de agradecer. Em português, aceita-se “obrigado” ou “obrigada”."
  },
  "ko-v1-u1-l4-e6": {
    "options": [
      "주세요",
      "아파요",
      "가세요"
    ]
  },
  "ko-v1-u1-l4-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “잠시 기다려 주세요.”"
  },
  "ko-v1-u2-l1-e1": {
    "options": [
      "물 두 잔 주세요.",
      "물 한 잔 주세요.",
      "커피 한 잔 주세요."
    ],
    "explanation": "O enunciado exige uma resposta coerente com: “Peça um copo de água, por favor.”. A opção “물 한 잔 주세요.” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "ko-v1-u2-l1-e2": {
    "word_bank": [
      "잔",
      "주세요.",
      "한",
      "물"
    ],
    "explanation": "Uma forma correta é “물 한 잔 주세요.” Pedir uma bebida e reconhecer os contadores de copos."
  },
  "ko-v1-u2-l1-e3": {
    "accepted_answers": [
      "커피 한 잔 주세요.",
      "커피 한 잔 부탁드려요."
    ],
    "answer_key": {
      "accepted": [
        "커피 한 잔 주세요.",
        "커피 한 잔 부탁드려요."
      ]
    },
    "explanation": "“한 잔” marca uma xícara ou copo; “주세요” é usado em pedidos educados. A frase pede exatamente uma porção de café."
  },
  "ko-v1-u2-l1-e4": {
    "accepted_answers": [
      "Café e água.",
      "Um café e uma água."
    ],
    "answer_key": {
      "accepted": [
        "Café e água.",
        "Um café e uma água."
      ]
    },
    "explanation": "O áudio diz: “손님이 커피 한 잔과 물 한 잔을 주문해요.”"
  },
  "ko-v1-u2-l1-e6": {
    "options": [
      "읽어요",
      "주세요",
      "아파요"
    ]
  },
  "ko-v1-u2-l1-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “물 한 잔 주세요.”"
  },
  "ko-v1-u2-l2-e1": {
    "options": [
      "김밥을 주세요.",
      "김밥을 싫어해요.",
      "김밥을 좋아해요."
    ],
    "explanation": "O enunciado exige uma resposta coerente com: “Você gosta de gimbap.”. A opção “김밥을 좋아해요.” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "ko-v1-u2-l2-e2": {
    "word_bank": [
      "사과를",
      "저는",
      "좋아해요."
    ],
    "explanation": "Uma forma correta é “저는 사과를 좋아해요.” Reconhecer alimentos e usar 좋아해요 para expressar gosto."
  },
  "ko-v1-u2-l2-e3": {
    "accepted_answers": [
      "김밥 한 줄 주세요."
    ],
    "answer_key": {
      "accepted": [
        "김밥 한 줄 주세요."
      ]
    },
    "explanation": "“한 줄” é o contador usual para um rolo de gimbap; “주세요” torna o pedido educado."
  },
  "ko-v1-u2-l2-e4": {
    "accepted_answers": [
      "Maçã e gimbap.",
      "Maçãs e gimbap."
    ],
    "answer_key": {
      "accepted": [
        "Maçã e gimbap.",
        "Maçãs e gimbap."
      ]
    },
    "explanation": "O áudio diz: “저는 사과와 김밥을 좋아해요.”"
  },
  "ko-v1-u2-l2-e6": {
    "options": [
      "가세요",
      "주세요",
      "좋아해요"
    ]
  },
  "ko-v1-u2-l2-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “저는 사과를 좋아해요.”"
  },
  "ko-v1-u2-l3-e1": {
    "explanation": "O enunciado exige uma resposta coerente com: “Para chegar à estação, siga em frente e depois vire à esquerda.”. A opção “쭉 가다가 왼쪽으로 도세요.” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "ko-v1-u2-l3-e2": {
    "explanation": "Uma forma correta é “지하철역이 어디예요?” Perguntar a localização de uma estação e entender esquerda/direita."
  },
  "ko-v1-u2-l3-e3": {
    "accepted_answers": [
      "오른쪽으로 도세요.",
      "오른쪽으로 돌아 주세요."
    ],
    "answer_key": {
      "accepted": [
        "오른쪽으로 도세요.",
        "오른쪽으로 돌아 주세요."
      ]
    },
    "explanation": "“오른쪽” indica direita e “돌다/도세요” indica virar. “가세요” sozinho significa ir, não necessariamente fazer uma curva."
  },
  "ko-v1-u2-l3-e4": {
    "accepted_answers": [
      "À direita.",
      "Do lado direito."
    ],
    "answer_key": {
      "accepted": [
        "À direita.",
        "Do lado direito."
      ]
    },
    "explanation": "O áudio diz: “은행은 지하철역 오른쪽에 있어요.”"
  },
  "ko-v1-u2-l3-e6": {
    "options": [
      "어디",
      "무엇",
      "누구"
    ]
  },
  "ko-v1-u2-l3-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “지하철역이 어디예요?”"
  },
  "ko-v1-u2-l4-e1": {
    "options": [
      "아침에 집에서 공부해요.",
      "아침에 학교에 가요.",
      "저녁에 학교에 가요."
    ],
    "explanation": "O enunciado exige uma resposta coerente com: “Você vai para a escola pela manhã.”. A opção “아침에 학교에 가요.” atende a essa condição; confira as mudanças de destino, quantidade, ação ou intenção nas outras alternativas."
  },
  "ko-v1-u2-l4-e2": {
    "word_bank": [
      "가요.",
      "학교에",
      "아침에",
      "저는"
    ],
    "explanation": "Uma forma correta é “저는 아침에 학교에 가요.” Descrever uma rotina com tempo e ação em frases curtas."
  },
  "ko-v1-u2-l4-e3": {
    "accepted_answers": [
      "저는 밤에 집에서 공부해요.",
      "밤에는 집에서 공부해요."
    ],
    "answer_key": {
      "accepted": [
        "저는 밤에 집에서 공부해요.",
        "밤에는 집에서 공부해요."
      ]
    },
    "explanation": "Resposta esperada: “저는 밤에 집에서 공부해요.” Descrever uma rotina com tempo e ação em frases curtas."
  },
  "ko-v1-u2-l4-e4": {
    "accepted_answers": [
      "De manhã.",
      "Pela manhã."
    ],
    "answer_key": {
      "accepted": [
        "De manhã.",
        "Pela manhã."
      ]
    },
    "explanation": "O áudio diz: “저는 아침에 일어나고 학교에 가요.”"
  },
  "ko-v1-u2-l4-e6": {
    "options": [
      "먹어요",
      "가요",
      "마셔요"
    ]
  },
  "ko-v1-u2-l4-e7": {
    "explanation": "Fale a frase com calma e confira sua estrutura: “저는 아침에 학교에 가요.”"
  }
};

export const courses = [english, spanish, korean].map((course) => ({
  ...course,
  units: course.units.map((unit) => ({
    ...unit,
    lessons: unit.lessons.map((item) => ({ ...item, ...lessonCorrections[item.id] })),
  })),
}));
