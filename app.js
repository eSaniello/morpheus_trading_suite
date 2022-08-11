const FTXRest = require('ftx-api-rest');
const TelegramBot = require('node-telegram-bot-api');
const CONFIG = require('./config/config');
const HELPER = require('./services/helper.service');
const FTX = require('./services/ftx.service');
const CCXT = require('ccxt');
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


// Connect to FTX API
// make the connection with the user credentials
const API_CONNECTION = new FTXRest({
    key: `${process.env.FTX_API_KEY}`,
    secret: `${process.env.FTX_API_SECRET}`
});

ftx_keys = {
    'apiKey': `${process.env.FTX_API_KEY}`,
    'secret': `${process.env.FTX_API_SECRET}`,
}
ccxt_ftx = new CCXT.ftx(ftx_keys)

const token = `${process.env.TELEGRAM_API_SECRET}`;
// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });
bot.on("polling_error", (msg) => console.log(msg));

// Listen to any message
bot.on('message', async (msg) => {
    // get ID from the one who chats
    const chatId = msg.chat.id;
    let text = msg.text ? msg.text : '';

    if (HELPER.checkText(text, 'info')) {
        bot.sendMessage(chatId, `Hello ${msg.from.first_name} 👋,
What can I 😎 do for you?
/info - Info about the bot
/balance - Get account balance
/open - Get open orders
/long - Open a long market order with a percentage size of account and stoploss [eg. /long btc 2 52000]
/short - Open a short market order with a percentage size of account and stoploss [eg. /short btc 2 55000]
/long_chase - Chase the best bid with a limit buy order along with a percentage size of account and stoploss [eg. /long_chase btc 2 55000]
/short_chase - Chase the best ask with a limit sell order along with a percentage size of account and stoploss [eg. /short_chase btc 2 55000]
/close - Close all open orders using a market order [for specific pair /close eth]
/alert - Forward TV alerts to this chat/chatroom`);
    }

    // Market order
    if (HELPER.checkText(text, 'long') || HELPER.checkText(text, 'short')) {
        text = text.replace('long', 'buy');
        text = text.replace('short', 'sell');

        let order = text.split(' ');
        // only exec when there's a pair given
        if (order[1]) {
            // create the order
            let side = order[0].replace('/', '').replace(CONFIG.BOTNAME, '');
            let pair = HELPER.convertString(order[1]);

            let accountInfo = await FTX.getBalance(API_CONNECTION);
            let entry = await FTX.getPrice(API_CONNECTION, pair);
            let risk = order[2];
            let sl = order[3];
            let account_size = accountInfo.collateral;
            let pos_size = 0;
            if (side == 'buy')
                pos_size = (account_size * (risk * 0.01)) / (entry - sl); //buy
            else if (side == 'sell')
                pos_size = (account_size * (risk * 0.01)) / (sl - entry); //sell

            if (pos_size != 0) {
                API_CONNECTION.request({
                    method: 'POST',
                    path: '/orders',
                    data: {
                        market: pair,
                        size: pos_size,
                        side: side,
                        type: 'market',
                        price: null
                    }
                }).then(async () => {
                    bot.sendMessage(chatId, `Market Order: ${side.toUpperCase()} $${(pos_size).toFixed(2)} ${pair} @ $${entry}`);

                    // pick random gif
                    let gifs = [];
                    fs.readdirSync('./assets/').forEach(file => {
                        gifs.push(file);
                    });

                    let num = Math.floor(Math.random() * gifs.length + 1);

                    bot.sendAnimation(chatId, './assets/' + gifs[num - 1]);
                }).catch(res => bot.sendMessage(chatId, `❌ ${res}`));
            } else {
                bot.sendMessage(chatId, `❌ Error calculating position size ser`);
            }
        } else {
            bot.sendMessage(chatId, 'Niffo niffoooo, gib more info 😒');
        }
    }

    // Limit chasing
    if (HELPER.checkText(text, 'long_chase') || HELPER.checkText(text, 'short_chase')) {
        text = text.replace('long_chase', 'buy');
        text = text.replace('short_chase', 'sell');

        let order = text.split(' ');
        // only exec when there's a pair given
        if (order[1]) {
            // create the order
            let side = order[0].replace('/', '').replace(CONFIG.BOTNAME, '');
            let pair = HELPER.convertString(order[1]);

            let accountInfo = await FTX.getBalance(API_CONNECTION);
            let entry = await FTX.getPrice(API_CONNECTION, pair);
            let risk = order[2];
            let sl = order[3];
            let account_size = accountInfo.collateral;
            let pos_size = 0;
            if (side == 'buy')
                pos_size = (account_size * (risk * 0.01)) / (entry - sl); //buy
            else if (side == 'sell')
                pos_size = (account_size * (risk * 0.01)) / (sl - entry); //sell

            if (pos_size != 0) {
                // Start limit chasing
                console.log('Starting limit chasing')
                let amount = pos_size

                // init empty order and prices, preparing for the loop
                let _order = null
                let bid = 0
                let ask = 1e10

                while (true) {
                    ticker_data = await ccxt_ftx.fetchTicker(pair)
                    let new_bid = ticker_data.bid
                    let new_ask = ticker_data.ask

                    if (side == 'buy') {
                        if (bid != new_bid) {
                            bid = new_bid

                            // place order if not already placed
                            if (_order == null) {
                                _order = await ccxt_ftx.createOrder(pair, 'limit', side, amount, new_bid, { 'postOnly': true })
                                bot.sendMessage(chatId, `Limit Order: ${side.toUpperCase()} $${(pos_size).toFixed(2)} ${pair} @ $${new_bid}`);
                                console.log(`Buy ${amount} ${pair} @ ${new_bid}`)
                            }
                            // if an order already exists then cancel it
                            else {
                                // refresh order details and track how much we got filled
                                updated_orders = await ccxt_ftx.fetch_orders()
                                updated_orders.forEach(updated_order => {
                                    if (updated_order.id == _order.id) {
                                        _order = updated_order
                                    }
                                })
                                // If we got filled then limit chasing is complete
                                if (_order.filled != 0) {
                                    console.log(`Limit chase Filled ${amount} ${pair} @ ${new_bid}`)

                                    bot.sendMessage(chatId, `Filled! Limit Chase Completed: ${side.toUpperCase()} $${(pos_size).toFixed(2)} ${pair} @ $${new_bid}`);

                                    // pick random gif
                                    let gifs = [];
                                    fs.readdirSync('./assets/').forEach(file => {
                                        gifs.push(file);
                                    });

                                    let num = Math.floor(Math.random() * gifs.length + 1);

                                    bot.sendAnimation(chatId, './assets/' + gifs[num - 1]);
                                    break;
                                }
                                // If we did not get filled then cancel the order and put in a new one
                                else {
                                    // cancel prev order
                                    if (_order.status == 'open') {
                                        await ccxt_ftx.cancelOrder(_order.id)
                                        console.log(`Cancel Buy ${amount} ${pair} @ ${new_bid}`)
                                        bot.sendMessage(chatId, `Bid moved, Cancel Order: ${side.toUpperCase()} $${(pos_size).toFixed(2)} ${pair} @ $${new_bid}`);
                                    }
                                    _order = null

                                    // Set new order
                                    _order = await ccxt_ftx.createOrder(pair, 'limit', side, amount, new_bid, { 'postOnly': true })
                                    bot.sendMessage(chatId, `New Limit order: ${side.toUpperCase()} $${(pos_size).toFixed(2)} ${pair} @ $${new_bid}`);
                                    console.log(`Buy ${amount} ${pair} @ ${new_bid}`)
                                }
                            }
                        }
                    }
                    else if (side == 'sell') {
                        if (ask != new_ask) {
                            ask = new_ask

                            // place order if not already placed
                            if (_order == null) {
                                _order = await ccxt_ftx.createOrder(pair, 'limit', side, amount, new_ask, { 'postOnly': true })
                                bot.sendMessage(chatId, `Limit Order: ${side.toUpperCase()} $${(pos_size).toFixed(2)} ${pair} @ $${new_ask}`);
                                console.log(`Sell ${amount} ${pair} @ ${new_ask}`)
                            }
                            // if an order already exists then cancel it
                            else {
                                // refresh order details and track how much we got filled
                                updated_orders = await ccxt_ftx.fetch_orders()
                                updated_orders.forEach(updated_order => {
                                    if (updated_order.id == _order.id) {
                                        _order = updated_order
                                    }
                                })
                                // If we got filled then limit chasing is complete
                                if (_order.filled != 0) {
                                    console.log(`Limit chase Filled ${amount} ${pair} @ ${new_ask}`)

                                    bot.sendMessage(chatId, `Filled! Limit Chase Completed: ${side.toUpperCase()} $${(pos_size).toFixed(2)} ${pair} @ $${new_ask}`);

                                    // pick random gif
                                    let gifs = [];
                                    fs.readdirSync('./assets/').forEach(file => {
                                        gifs.push(file);
                                    });

                                    let num = Math.floor(Math.random() * gifs.length + 1);

                                    bot.sendAnimation(chatId, './assets/' + gifs[num - 1]);
                                    break;
                                }
                                // If we did not get filled then cancel the order and put in a new one
                                else {
                                    // cancel prev order
                                    if (_order.status == 'open') {
                                        await ccxt_ftx.cancelOrder(_order.id)
                                        console.log(`Cancel Buy ${amount} ${pair} @ ${new_ask}`)
                                        bot.sendMessage(chatId, `Ask moved, Cancel Order: ${side.toUpperCase()} $${(pos_size).toFixed(2)} ${pair} @ $${new_ask}`);
                                    }
                                    _order = null

                                    // Set new order
                                    _order = await ccxt_ftx.createOrder(pair, 'limit', side, amount, new_ask, { 'postOnly': true })
                                    bot.sendMessage(chatId, `New Limit order: ${side.toUpperCase()} $${(pos_size).toFixed(2)} ${pair} @ $${new_ask}`);
                                    console.log(`Buy ${amount} ${pair} @ ${new_ask}`)
                                }
                            }
                        }
                    }
                }
            }
        } else {
            bot.sendMessage(chatId, `❌ Error calculating position size ser`);
        }
    } else {
        bot.sendMessage(chatId, 'Niffo niffoooo, gib more info 😒');
    }


    if (HELPER.checkText(text, 'balance')) {
        let accountInfo = await FTX.getBalance(API_CONNECTION);
        bot.sendMessage(chatId, `
::Balance::
Collateral: $${(accountInfo.collateral).toFixed(2)}
Account Value: $${(accountInfo.totalAccountValue).toFixed(2)}
Margin Fraction: ${(accountInfo.marginFraction * 100).toFixed(2)}%
TotalPositionSize: $${(accountInfo.totalPositionSize).toFixed(2)}
Leverage: ${accountInfo.leverage}`);
    }

    if (HELPER.checkText(text, 'open')) {
        let orders = await FTX.openOrders(API_CONNECTION);
        if (orders.length > 0) {
            bot.sendMessage(chatId, `::Open Orders::`);
            orders.forEach(async order => {
                let price = await FTX.getPrice(API_CONNECTION, order.future);
                bot.sendMessage(chatId, `
${order.side.toUpperCase()} ${order.future}
Funding Rate: ${await FTX.fundingRate(API_CONNECTION, order.future)}
Side: ${order.side}
Entry: $${order.entryPrice.toFixed(2)}
Size: ${order.size}
Liq Price: $${order.estimatedLiquidationPrice.toFixed(2)}
Realized PnL: $${order.realizedPnl.toFixed(2)}
Recent PnL: $${order.recentPnl.toFixed(2)}
Unrealized PnL: $${order.unrealizedPnl.toFixed(2)}
MarkPrice: $${price}
                    `);
            });
        } else {
            bot.sendMessage(chatId, 'No open orders');
        }
    }

    if (HELPER.checkText(text, 'close')) {
        let args = text.split(' ');
        let orders = await FTX.openOrders(API_CONNECTION);
        if (orders.length > 0) {
            bot.sendMessage(chatId, `::Closing Orders::`);
            if (args[1]) {
                orders = orders.filter(position => position.future.toLowerCase().includes(args[1].toLowerCase()))
                console.log(orders);
                if (orders.length === 0) bot.sendMessage(chatId, `❌ Can't find ${args[1]}`);
            }

            orders.forEach(async order => {
                let price = await FTX.getPrice(API_CONNECTION, order.future);
                bot.sendMessage(chatId, `
Closing ${order.side.toUpperCase()} ${order.future}
Funding Rate: ${await FTX.fundingRate(API_CONNECTION, order.future)}
AvgPrice: $${order.recentAverageOpenPrice.toFixed(2)}
Size: ${order.size}
Liq Price: $${order.estimatedLiquidationPrice.toFixed(2)}
PnL: $${order.realizedPnl.toFixed(2)}
MarkPrice: $${price}
                    `);
            });
        } else {
            bot.sendMessage(chatId, `No open orders`);
        }

        // only exec when there's a pair given
        if (args[1]) {
            FTX.closeOrders(API_CONNECTION, args[1]);
        } else {
            FTX.closeOrders(API_CONNECTION);
        }
    }

    if (HELPER.checkText(text, 'alert')) {
        bot.sendMessage(chatId, `So, you want Tradingview alerts right? 👀 He's what you need to do:
- Set the condition of your indicator
- Options = Once per bar close
- Webhook URL = http://server_url/hook
- Give it any alert name
- Message should be = {"chatId":${chatId},"type":"BUY or SELL","pair":"{{ticker}}","alert":"ALERT NAME","time":"{{time}}","sl":"{{plot("SL")}}"}`)
    }
});

let risk_per_trade = 1
let order = {}
// Listener (handler) for callback data from /label command
bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const decision = callbackQuery.data;

    if (decision == 'no') {
        bot.sendMessage(message.chat.id, `You decided not to take the trade. :(`);
        order = {}
    } else if (decision == 'market') {
        // make the connection with the user credentials
        const API_CONNECTION = new FTXRest({
            key: `${process.env.FTX_API_KEY}`,
            secret: `${process.env.FTX_API_SECRET}`
        });

        if (Object.keys(order).length > 0) {
            if (order.type.toLowerCase() === 'buy' || order.type.toLowerCase() === 'sell') {
                // create the order
                let side = order.type.toLowerCase();

                // extract the correct pair from the string. 
                // THIS WILL ONLY WORK FOR PERPS!
                let pair = `${order.pair.toLowerCase().slice(0, order.pair.length - 4)}-perp`;

                let accountInfo = await FTX.getBalance(API_CONNECTION);
                let entry = await FTX.getPrice(API_CONNECTION, pair);
                let risk = risk_per_trade
                let sl = Number(order.sl);
                let account_size = accountInfo.collateral;
                let pos_size = 0;

                if (side == 'buy')
                    pos_size = (account_size * (risk * 0.01)) / (entry - sl)  //buy
                else if (side == 'sell')
                    pos_size = (account_size * (risk * 0.01)) / (sl - entry) //sell

                console.log(`
                Account Size: ${account_size} \n
                Entry: ${entry} \n
                SL: ${sl} \n
                Risk: ${risk} \n
                Pos Size: ${pos_size} \n`)

                if (pos_size != 0) {
                    // entry
                    API_CONNECTION.request({
                        method: 'POST',
                        path: '/orders',
                        data: {
                            market: pair,
                            size: pos_size,
                            side: side,
                            type: 'market',
                            price: null
                        }
                    }).then(async () => {
                        bot.sendMessage(message.chat.id, `You decided to take the trade. LFG! \n \n ${side.toUpperCase()} $${(pos_size).toFixed(2)} ${pair} @ $${entry}`);

                        // pick random gif
                        let gifs = [];
                        fs.readdirSync('./assets/').forEach(file => {
                            gifs.push(file);
                        });

                        let num = Math.floor(Math.random() * gifs.length + 1);

                        bot.sendAnimation(message.chat.id, './assets/' + gifs[num - 1]);

                        order = {}
                    }).catch(res => bot.sendMessage(message.chat.id, `❌ ${res}`));
                } else {
                    bot.sendMessage(message.chat.id, `❌ Error calculating position size ser`);
                    order = {}
                }
            }
        }
    } else if (decision == 'chase') {
        // make the connection with the user credentials
        const API_CONNECTION = new FTXRest({
            key: `${process.env.FTX_API_KEY}`,
            secret: `${process.env.FTX_API_SECRET}`
        });

        if (Object.keys(order).length > 0) {
            if (order.type.toLowerCase() === 'buy' || order.type.toLowerCase() === 'sell') {
                // create the order
                let side = order.type.toLowerCase();

                // extract the correct pair from the string. 
                // THIS WILL ONLY WORK FOR PERPS!
                let pair = `${order.pair.toUpperCase().slice(0, order.pair.length - 4)}-PERP`;

                let accountInfo = await FTX.getBalance(API_CONNECTION);
                let entry = await FTX.getPrice(API_CONNECTION, pair);
                let risk = risk_per_trade
                let sl = Number(order.sl);
                let account_size = accountInfo.collateral;
                let pos_size = 0;

                if (side == 'buy')
                    pos_size = (account_size * (risk * 0.01)) / (entry - sl); //buy
                else if (side == 'sell')
                    pos_size = (account_size * (risk * 0.01)) / (sl - entry); //sell

                if (pos_size != 0) {
                    // Start limit chasing
                    console.log('Starting limit chasing')
                    let amount = pos_size

                    // init empty order and prices, preparing for the loop
                    let _order = null
                    let bid = 0
                    let ask = 1e10

                    while (true) {
                        ticker_data = await ccxt_ftx.fetchTicker(pair)
                        let new_bid = ticker_data.bid
                        let new_ask = ticker_data.ask

                        if (side == 'buy') {
                            if (bid != new_bid) {
                                bid = new_bid

                                // place order if not already placed
                                if (_order == null) {
                                    _order = await ccxt_ftx.createOrder(pair, 'limit', side, amount, new_bid, { 'postOnly': true })
                                    bot.sendMessage(message.chat.id, `Limit Order: ${side.toUpperCase()} $${(pos_size).toFixed(2)} ${pair} @ $${new_bid}`);
                                    console.log(`Buy ${amount} ${pair} @ ${new_bid}`)
                                }
                                // if an order already exists then cancel it
                                else {
                                    // refresh order details and track how much we got filled
                                    updated_orders = await ccxt_ftx.fetch_orders()
                                    updated_orders.forEach(updated_order => {
                                        if (updated_order.id == _order.id) {
                                            _order = updated_order
                                        }
                                    })
                                    // If we got filled then limit chasing is complete
                                    if (_order.filled != 0) {
                                        console.log(`Limit chase Filled ${amount} ${pair} @ ${new_bid}`)

                                        bot.sendMessage(message.chat.id, `Filled! Limit Chase Completed: ${side.toUpperCase()} $${(pos_size).toFixed(2)} ${pair} @ $${new_bid}`);

                                        // pick random gif
                                        let gifs = [];
                                        fs.readdirSync('./assets/').forEach(file => {
                                            gifs.push(file);
                                        });

                                        let num = Math.floor(Math.random() * gifs.length + 1);

                                        bot.sendAnimation(message.chat.id, './assets/' + gifs[num - 1]);
                                        break;
                                    }
                                    // If we did not get filled then cancel the order and put in a new one
                                    else {
                                        // cancel prev order
                                        if (_order.status == 'open') {
                                            await ccxt_ftx.cancelOrder(_order.id)
                                            console.log(`Cancel Buy ${amount} ${pair} @ ${new_bid}`)
                                            bot.sendMessage(message.chat.id, `Bid moved, Cancel Order: ${side.toUpperCase()} $${(pos_size).toFixed(2)} ${pair} @ $${new_bid}`);
                                        }
                                        _order = null

                                        // Set new order
                                        _order = await ccxt_ftx.createOrder(pair, 'limit', side, amount, new_bid, { 'postOnly': true })
                                        bot.sendMessage(message.chat.id, `New Limit order: ${side.toUpperCase()} $${(pos_size).toFixed(2)} ${pair} @ $${new_bid}`);
                                        console.log(`Buy ${amount} ${pair} @ ${new_bid}`)
                                    }
                                }
                            }
                        }
                        else if (side == 'sell') {
                            if (ask != new_ask) {
                                ask = new_ask

                                // place order if not already placed
                                if (_order == null) {
                                    _order = await ccxt_ftx.createOrder(pair, 'limit', side, amount, new_ask, { 'postOnly': true })
                                    bot.sendMessage(message.chat.id, `Limit Order: ${side.toUpperCase()} $${(pos_size).toFixed(2)} ${pair} @ $${new_ask}`);
                                    console.log(`Sell ${amount} ${pair} @ ${new_ask}`)
                                }
                                // if an order already exists then cancel it
                                else {
                                    // refresh order details and track how much we got filled
                                    updated_orders = await ccxt_ftx.fetch_orders()
                                    updated_orders.forEach(updated_order => {
                                        if (updated_order.id == _order.id) {
                                            _order = updated_order
                                        }
                                    })
                                    // If we got filled then limit chasing is complete
                                    if (_order.filled != 0) {
                                        console.log(`Limit chase Filled ${amount} ${pair} @ ${new_ask}`)

                                        bot.sendMessage(message.chat.id, `Filled! Limit Chase Completed: ${side.toUpperCase()} $${(pos_size).toFixed(2)} ${pair} @ $${new_ask}`);

                                        // pick random gif
                                        let gifs = [];
                                        fs.readdirSync('./assets/').forEach(file => {
                                            gifs.push(file);
                                        });

                                        let num = Math.floor(Math.random() * gifs.length + 1);

                                        bot.sendAnimation(message.chat.id, './assets/' + gifs[num - 1]);
                                        break;
                                    }
                                    // If we did not get filled then cancel the order and put in a new one
                                    else {
                                        // cancel prev order
                                        if (_order.status == 'open') {
                                            await ccxt_ftx.cancelOrder(_order.id)
                                            console.log(`Cancel Buy ${amount} ${pair} @ ${new_ask}`)
                                            bot.sendMessage(message.chat.id, `Ask moved, Cancel Order: ${side.toUpperCase()} $${(pos_size).toFixed(2)} ${pair} @ $${new_ask}`);
                                        }
                                        _order = null

                                        // Set new order
                                        _order = await ccxt_ftx.createOrder(pair, 'limit', side, amount, new_ask, { 'postOnly': true })
                                        bot.sendMessage(message.chat.id, `New Limit order: ${side.toUpperCase()} $${(pos_size).toFixed(2)} ${pair} @ $${new_ask}`);
                                        console.log(`Buy ${amount} ${pair} @ ${new_ask}`)
                                    }
                                }
                            }
                        }
                    }
                } else {
                    bot.sendMessage(message.chat.id, `❌ Error calculating position size ser`);
                    order = {}
                }
            }
        }
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
//     { "pair": "BTCPERP", "alert": "ALERT 1", "time": "2022-07-07T01:23:02Z", "sl": "22000", "type": "BUY" },
// ]
// let messages = []

app.post("/hook", async (req, res) => {
    if (req.body.chatId) {
        const _order = req.body;
        order = _order

        // telegram buttons
        const reply_options = {
            reply_markup: {
                one_time_keyboard: true,
                inline_keyboard: [
                    [
                        {
                            text: 'Market order',
                            callback_data: 'market'
                        },
                        {
                            text: 'Limit chase',
                            callback_data: 'chase'
                        }, {
                            text: 'Vibes are off',
                            callback_data: 'no'
                        },
                    ]
                ],
            },
            parse_mode: 'HTML'
        }
        bot.sendMessage(_order.chatId, `${_order.type} signal for ${_order.pair} \nAlgo: ${_order.alert} \nSL: ${_order.sl}`, reply_options)
        // .then(msg => {
        //     // if there are multiple alerts, then replace the last one with the new one
        //     messages.forEach(m => {
        //         if (m.pair == _order.pair && _order.time > m.time) {
        //             bot.deleteMessage(_order.chatId, m.msg_id)
        //             messages = messages.filter(alert => alert.pair != _order.pair)
        //         }
        //     });

        //     messages.push({ "pair": _order.pair, "msg_id": msg.message_id, "time": _order.time })
        // });
    }
    res.status(200).end()
})

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