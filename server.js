const http = require('http');
const Koa = require('koa');
const Router = require('koa-router');
const koaBody = require('koa-body').default;
const cors = require('@koa/cors');
// const uuid = require('uuid');
const WS = require('ws');

const app = new Koa();
const router = new Router();

app.use(cors());
app.use(koaBody({
  text: true,
  urlencoded: true,
  multipart: true,
  json: true,
}));

/* Создаем пустой объект для хранения соединений клиентов по их именам */
const clients = {};

/*
*  GET
*/
router.get('/', (ctx, next) => {
  // const params = new URLSearchParams(ctx.request.querystring);
  // const { method, id } = { method: params.get("method"), id: params.get("id") };

  /* всё остальное для GET */
  ctx.status = 200;
  ctx.body = { status: true, };
});

/*
*  POST
*/
router.post('/', (ctx, next) => {
  const { login } = ctx.request.body;
  const params = new URLSearchParams(ctx.request.querystring);
  const { method } = { method: params.get("method") };

  /* если метод logining */
  if (method === 'logining') {

    /* если логин есть, то статус ошибки */
    if (clients[login]) {
      ctx.status = 200;
      ctx.body = { status: false, error: 'this login is logining' };
      return;
    }

    /* если логина нету, то статус ок, и сохранение логина */
    if (!clients[login]) {
      clients[login] = { name: login, ws: '' };

      ctx.status = 200;
      ctx.body = { status: true };
      return;
    }
  }

  /* всё остальное для POST */
  ctx.status = 400;
  ctx.body = { POST: 'not fount', };
});


/*
*  функция для получения текущей даты
*/
function getCurrentDate() {
  const currentDate = new Date();

  // Получение компонентов даты и времени
  const hours = String(currentDate.getHours()).padStart(2, '0');
  const minutes = String(currentDate.getMinutes()).padStart(2, '0');
  const day = String(currentDate.getDate()).padStart(2, '0');
  const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Месяцы нумеруются с 0 (январь) до 11 (декабрь)
  const year = currentDate.getFullYear();

  // Сборка строки в нужном формате
  const formattedDate = `${hours}:${minutes} ${day}.${month}.${year}`;

  return formattedDate;
}

/*
*  функция считывает всех клиентов,
*  и отправляет его всем присоединённым клиентам
*/
function sendClientsUsers(clients) {
  const arr = []; /* список имён */

  for (const key in clients) {
    if (clients.hasOwnProperty(key)) {
      if (clients[key].ws.readyState === WS.OPEN) { arr.push(key); }
    }
  }

  for (let i = 0; i < arr.length; i += 1) {
    if (clients[arr[i]].ws.readyState === WS.OPEN) {
      clients[arr[i]].ws.send(JSON.stringify({ chat: [ {names: arr, type: 'user'} ] } ));
    }
  }
}

app.use(router.routes());

const port = process.env.PORT || 7070; /* порт сервера */
const server = http.createServer(app.callback());
const wsServer = new WS.Server({ server, });

/* массив для сообщений чата, с двумя примерами сообщений */
const chat = [
  {name: 'Витя', text: 'арбуз зелёный', date: '11:22 11.11.23', type: 'message'},
  {name: 'Миша', text: 'арбуз красный', date: '11:22 11.11.23', type: 'message'},
];

wsServer.on('connection', (ws, req) => {
  console.log('connection ws');
  /* получаем имя из параметров url */
  const { searchParams } = new URL(req.url, 'http://example.com'); // Второй параметр в данном случае не важен
  const username = searchParams.get('login');
  console.log(username);

  /*
  *  если соединение устонавливает не авторизованный пользователь,
  *  то соединение закрывается
  */
  if (!clients[username]) { ws.close(); }

  /* Сохраняем соединение клиента в объекте clients */
  clients[username].ws = ws;

  /* прослушиваем сообщения на WS */
  ws.on('message', (messageBuffer) => {
    /* получает тип и текст сообщения */
    const { message, type } = JSON.parse(messageBuffer.toString());

    /* обработка сообщений с типом  message*/
    if (type === 'message') {
      /* дополняем сообщение нужными данными */
      const newMessage = { name: username, text: message, date: getCurrentDate(), type: 'message'}

      /* отправляем сообщение в массив сообщений */
      chat.push(newMessage);

      /* преобразуем сообщение в формат JSON */
      const eventData = JSON.stringify({ chat: [newMessage] });

      /*
      *  отправляем сообщение всем клиентам WebSocket кто имеет статус OPEN
      */
      // Array.from(wsServer.clients)
      // .filter(client => client.readyState === WS.OPEN)
      // .forEach(client => client.send(eventData));

      /*
      *  отправляем сообщение всем клиентам из залогиненных со статусом OPEN
      */
      for (const key in clients) {
        if (clients.hasOwnProperty(key)) {
          if (clients[key].ws.readyState === WS.OPEN) {
            clients[key].ws.send(eventData);
          }
        }
      }
    }
  });

  /* отправка сообщения с массивом сообщений из чата */
  ws.send(JSON.stringify({ chat }));

  /* отправка пользователей всем присоединёным пользователям */
  sendClientsUsers(clients);

  /* 
  *  прослушивание закрытия соединения на WS
  *  если соединение закрывается, то пользователь удаляется
  */
  ws.on('close', function () {
    delete clients[username];
    sendClientsUsers(clients);
  });
});

/* запуск сервера */
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});