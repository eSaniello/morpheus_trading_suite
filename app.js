const FTXRest = require('ftx-api-rest');
const TelegramBot = require('node-telegram-bot-api');
const CONFIG = require('./config/config');
const HELPER = require('./services/helper.service');
const FTX = require('./services/ftx.service');
const express = require("express")
const dotenv = require('dotenv');
const fs = require('fs');
const app = express()
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
dotenv.config();

// To parse the incoming requests with JSON payloads
app.use(express.urlencoded({ extended: true }))
// handle content type text/plain and text/json
app.use(express.text())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.json()) // To parse the incoming requests with JSON payloads

const token = `${process.env.TELEGRAM_API_SECRET}`;
// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });
bot.on("polling_error", (msg) => console.log(msg));
bot.on('message', async (msg) => {
    // get ID from the one who chats
    const chatId = msg.chat.id;
    let text = msg.text ? msg.text : '';
})

// default route
app.get("/", (req, res) => {
    res.status(200).send('Stop gambling ser.').end();
})


// Alert structure
// {
//     'pair': 'BTC-PERP',
//     'alert': 'FZVO BG',
//     'time': '01-07-2022 18:27'
// }
let alerts = []

app.post("/hook", async (req, res) => {
    if (req.body.chatId) {
        const order = req.body;

        alerts.push({ "pair": order.pair, "alert": order.alert, "time": order.time })
        bot.sendMessage(order.chatId, `✅ Alert received: pair: ${order.pair}, alert: ${order.alert}, time: ${order.time}`)
        bot.sendMessage(order.chatId, `List of alerts: ${JSON.stringify(alerts)}`)
    }
    res.status(200).end()
})

// socket shenanigans
io.on('connection', (socket) => {
    console.log('a user connected');
});

const PORT = 80;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`))


// // secret code in the alert to automatically take the trades
// if (order.secret === 'meow') {
//     // make the connection with the user credentials
//     const API_CONNECTION = new FTXRest({
//         key: `${process.env.FTX_API_KEY}`,
//         secret: `${process.env.FTX_API_SECRET}`
//     });

//     if (order.type.toLowerCase() === 'buy' || order.type.toLowerCase() === 'sell') {
//         // create the order
//         let side = order.type.toLowerCase();
//         // extract the correct pair from the string. 
//         // THIS WILL ONLY WORK FOR PERPS!
//         let pair = `${order.ticker.toLowerCase().slice(0, order.ticker.length - 4)}-perp`;

//         let accountInfo = await FTX.getBalance(API_CONNECTION);
//         let entry = await FTX.getPrice(API_CONNECTION, pair);
//         let risk = Number(order.risk);
//         let tp = Number(order.tp);
//         let sl = Number(order.sl);
//         let account_size = accountInfo.collateral;
//         let pos_size = 0;
//         if (side == 'buy')
//             pos_size = (account_size * (risk * 0.01)) / (entry - sl); //buy
//         else if (side == 'sell')
//             pos_size = (account_size * (risk * 0.01)) / (sl - entry); //sell

//         if (pos_size != 0) {
//             // entry
//             API_CONNECTION.request({
//                 method: 'POST',
//                 path: '/orders',
//                 data: {
//                     market: pair,
//                     size: pos_size,
//                     side: side,
//                     type: 'market',
//                     price: null
//                 }
//             }).then(async () => {
//                 // stoploss
//                 API_CONNECTION.request({
//                     method: 'POST',
//                     path: '/conditional_orders',
//                     data: {
//                         market: pair,
//                         side: side == 'buy' ? 'sell' : 'buy',
//                         type: 'stop',
//                         size: pos_size,
//                         triggerPrice: sl,
//                         orderPrice: sl,
//                         retryUntilFilled: true
//                     }
//                 }).then(async () => {
//                     // takeprofit
//                     API_CONNECTION.request({
//                         method: 'POST',
//                         path: '/conditional_orders',
//                         data: {
//                             market: pair,
//                             side: side == 'buy' ? 'sell' : 'buy',
//                             type: 'takeProfit',
//                             size: pos_size,
//                             triggerPrice: tp,
//                             orderPrice: tp,
//                             retryUntilFilled: true
//                         }
//                     }).then(async () => {
//                         bot.sendMessage(order.chatId, `✅ ${side.toUpperCase()} $${(pos_size).toFixed(5)} ${pair} @ $${entry} with SL @ $${sl} and TP @ $${tp}`);

//                         // pick random gif
//                         let gifs = [];
//                         fs.readdirSync('./assets/').forEach(file => {
//                             gifs.push(file);
//                         });

//                         let num = Math.floor(Math.random() * gifs.length + 1);

//                         bot.sendAnimation(chatId, './assets/' + gifs[num - 1]);
//                     }).catch(res => bot.sendMessage(chatId, `❌ ${res}`));
//                 }).catch(res => bot.sendMessage(chatId, `❌ ${res}`));
//             }).catch(res => bot.sendMessage(chatId, `❌ ${res}`));
//         } else {
//             bot.sendMessage(chatId, `❌ Error calculating position size ser`);
//         }
//     }
// } 