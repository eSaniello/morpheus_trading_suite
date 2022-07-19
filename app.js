const FTXRest = require('ftx-api-rest');
const TelegramBot = require('node-telegram-bot-api');
const CONFIG = require('./config/config');
const HELPER = require('./services/helper.service');
const FTX = require('./services/ftx.service');
const cors = require('cors');
const express = require("express")
const dotenv = require('dotenv');
const fs = require('fs');
const app = express()
app.use(cors())
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

// Listen to any message
bot.on('message', async (msg) => {
    // get ID from the one who chats
    const chatId = msg.chat.id;
    let text = msg.text ? msg.text : '';
    console.log(msg)
})

// Listener (handler) for callback data from /label command
bot.on('callback_query', (callbackQuery) => {
    const message = callbackQuery.message;
    const decision = callbackQuery.data;

    if (decision == 'no') {
        // bot.deleteMessage(message.chat.id, message.message_id);
        bot.sendMessage(message.chat.id, `You decided not to take the trade. :(`);
    } else {
        bot.sendMessage(message.chat.id, `You decided to take the trade. LFG!`);
    }

    bot.editMessageReplyMarkup({
        reply_markup: {
            inline_keyboard: [[],]
        }
    }, {
        chat_id: message.chat.id,
        message_id: message.message_id
    });
});

// default route
app.get("/", (req, res) => {
    res.status(200).send('Stop gambling ser.').end();
})

// Alert structure
// [
//     { "pair": "BTCPERP", "alert": "ALERT 1", "time": "2022-07-07T01:23:02Z" },
//     { "pair": "BTCPERP", "alert": "ALERT 1", "time": "2022-07-07T01:24:02Z" },
//     { "pair": "BTCPERP", "alert": "ALERT 1", "time": "2022-07-07T01:25:04Z" },
//     { "pair": "BTCPERP", "alert": "ALERT 1", "time": "2022-07-07T01:26:03Z" }
// ]
// let alerts = []
// let min_treshold = 5

let messages = []

app.post("/hook", async (req, res) => {
    if (req.body.chatId) {
        const order = req.body;

        // // If list is empty then add the first one
        // if (alerts.length == 0)
        //     alerts.push({ "pair": order.pair, "alert": order.alert, "time": order.time })

        // // If the list already contains the pair then don't add it
        // if (!HELPER.containsPair(order, alerts))
        //     alerts.push({ "pair": order.pair, "alert": order.alert, "time": order.time })

        // telegram buttons
        const reply_options = {
            reply_markup: {
                one_time_keyboard: true,
                inline_keyboard: [
                    [
                        {
                            text: 'Take the trade',
                            callback_data: 'yes'
                        }, {
                            text: 'Vibes are off',
                            callback_data: 'no'
                        },
                    ]
                ],
            },
            parse_mode: 'HTML'
        }
        bot.sendMessage(order.chatId, `✅ Alert received: pair: ${order.pair}, alert: ${order.alert}, time: ${order.time}`, reply_options)
            .then(msg => {
                // if there are multiple alerts, then replace the last one with the new one
                messages.forEach(m => {
                    if (m.pair == order.pair && order.time > m.time) {
                        bot.deleteMessage(order.chatId, m.msg_id)
                        messages = messages.filter(alert => alert.pair != order.pair)
                    }
                });

                messages.push({ "pair": order.pair, "msg_id": msg.message_id, "time": order.time })
            });
    }
    res.status(200).end()
})

// // get all alerts
// app.get("/alerts", (req, res) => {
//     // if an alert in the list is older than specified minutes then remove it
//     alerts.forEach(alert => {
//         const date1 = new Date(alert.time);
//         const date2 = new Date();

//         const diff = date2.getTime() - date1.getTime();
//         let msec = diff;
//         const hh = Math.floor(msec / 1000 / 60 / 60);
//         msec -= hh * 1000 * 60 * 60;
//         const mm = Math.floor(msec / 1000 / 60);

//         if (mm > min_treshold)
//             alerts.pop(alert)
//     });

//     res.status(200).send(JSON.stringify(alerts)).end();
// })

const PORT = 80;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`))


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