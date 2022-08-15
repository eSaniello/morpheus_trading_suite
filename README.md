# FTX DegenTrader
I stole Mitchel's [ftx-telegram-trader](https://github.com/pawiromitchel/ftx-telegram-trader) and modified it to my own needs for scalping BTC. Thanks sir [@pawiromitchel](https://github.com/pawiromitchel) :)

## Bot Commands
- /info - Info about the bot
- /balance - Get account balance
- /open - Get open orders
- /long - Create a buy / long market order with a percentage size of account and stoploss [eg. /long btc 2 52000]
- /long - Create a sell / short market order with a percentage size of account and stoploss [eg. /short 2 btc 55000]
- /close - Close all open orders [for specific pair /close eth]
- /alert - Forward TV alerts to this chat/chatroom

## New features
### Limit chase orders
- /long_chase - Chase the best bid with a limit order until it gets filled along with a percentage size of account and stoploss [eg. /long_chase btc 2 52000]
- /long_chase - Chase the best ask with a limit order until it gets filled along with a percentage size of account and stoploss [eg. /short_chase 2 btc 55000]

### Semi automatic trading
Each alert will now give u 3 buttons

![image](https://user-images.githubusercontent.com/36887478/184653300-39403d91-dfcf-4971-98c7-2f77cbaf7bba.png)

- Market order - This will place a market order and will risk 1% of your account using the specified stoploss
- Limit chase - This will place a limit chase order and will risk 1% of your account using the specified stoploss
- Vibes are off - This will cancel the trade and do nothing. It's simpy to tell the bot that you don't want to take this trade
