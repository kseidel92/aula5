const fs = require("fs");

var permanentBlockeds = ["WBTCBTC"];
const valorMinimoMoeda = 0.00000333;
const valorMaximoMoeda = 0.01;
const intervalMaior = "3d";
const limiteMaior = 4;

async function storeData(data, path) {
  try {
    fs.writeFileSync(path, JSON.stringify(data));
  } catch (err) {
    console.error(err);
  }
}

function setAverage(candles) {
  for (let i = 0; i < candles.length; i++) {
    let avg = (parseFloat(candles[i].close) + parseFloat(candles[i].open)) / 2;
    candles[i].avg = avg;
  }
  return candles;
}

function getBlockeds(coinList, client) {
  function createEachCoin(coin) {
    return new Promise(async (resolve) => {
      let candlesMaiores = await client
        .candles({
          symbol: coin,
          interval: intervalMaior,
          limit: limiteMaior,
        })
        .catch((erro) => {
          console.log("erro" + erro);
          return [];
        });

      let candles = setAverage(candlesMaiores);

      if (candles[candles.length - 1].avg < candles[0].avg) {
        resolve({
          coin,
          blocked: true,
        });
      } else {
        let symbol = await client
          .dailyStats({
            symbol: coin,
          })
          .catch((erro) => {
            console.log("erro" + erro);
            return [];
          });

        let media1 =
          (parseFloat(symbol.lowPrice) + parseFloat(symbol.highPrice)) / 2;

        if (parseFloat(symbol.lastPrice) > media1) {
          resolve({
            coin,
            blocked: true,
          });
        } else {
          resolve({
            coin,
            blocked: false,
          });
        }
      }
    });
  }
  const promiseAll = [...coinList.map((coin) => createEachCoin(coin))];
  return Promise.all(promiseAll);
}

module.exports = {
  async blockSome(client) {
    console.log("iniciando blocker service...");

    let tickets = await client.exchangeInfo().catch((erro) => {
      console.log("erro" + erro);
    });

    let prices = await client.prices();

    let symbols = tickets["symbols"];
    let symbolList = symbols.filter(
      (s) => s.quoteAsset === "BTC" && s.status === "TRADING"
    );

    var coinList = symbolList.map(function (el) {
      return el.symbol;
    });

    coinList = coinList.filter((c) => parseFloat(prices[c]) > valorMinimoMoeda);
    coinList = coinList.filter((c) => parseFloat(prices[c]) < valorMaximoMoeda);

    console.log("totale...", coinList.length);

    getBlockeds(coinList, client).then(async (promises) => {
      let blockeds = promises.filter((p) => p.blocked);

      var blockList = blockeds.map(function (el) {
        return el.coin;
      });

      blockList = blockList.concat(permanentBlockeds);
      console.log("lengthh FINISH FINALY ", blockList.length);

      await storeData({ data: blockList }, "./blockeds.txt");
    });
  },
};
