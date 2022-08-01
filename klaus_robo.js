const fs = require("fs");

const priceLimit = 0.913;
const priceStop = 0.911;
const priceTarget = 1.07;
const qtdRemove = 3;
const shortInterval = "2h";
const mediumInterval = "1d";
const shortLimit = 20;
const mediumLimit = 4;
const coinMinValue = 0.00000333;
const minimoParaAtivar = 0.007;
const blockeds = ["WBTCBTC", "TRBBTC"];
const minVolume = 33000;

async function loadData(path) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch (err) {
    console.error(err);
    return false;
  }
}

async function storeData(data, path) {
  try {
    fs.writeFileSync(path, JSON.stringify(data));
  } catch (err) {
    console.error(err);
  }
}

function EMACalc(mArray, mRange) {
  var k = 2 / (parseInt(mRange) + 1);
  let emaArray = [];
  emaArray.push(parseFloat(mArray[0].close));

  for (var i = 1; i < mArray.length; i++) {
    let valor1 = parseFloat(mArray[i].close) * k;
    let valor2 = parseFloat(emaArray[i - 1]) * (1 - k);
    let valor3 = valor1 + valor2;
    emaArray.push(valor3);
  }
  return emaArray;
}

function checkIfPriceIsBelow(candles, price) {
  candles = setAverage(candles);
  let sum = 0;

  let arrayValues = candles.map((a) => a.avg);
  arrayValues.sort(function (a, b) {
    return a - b;
  });
  arrayValues.splice(0, qtdRemove);
  arrayValues.splice(arrayValues.length - qtdRemove, qtdRemove);

  for (let i = 0; i < arrayValues.length; i++) {
    let candle = arrayValues[i];
    sum = sum + candle;
  }

  let resist = sum / arrayValues.length;

  if (price < resist) {
    return true;
  } else {
    return false;
  }
}

function setAverage(candles) {
  for (let i = 0; i < candles.length; i++) {
    let avg = (parseFloat(candles[i].close) + parseFloat(candles[i].open)) / 2;
    candles[i].avg = avg;
  }
  return candles;
}

function isRising(candles) {
  candles = setAverage(candles);

  if (candles[candles.length - 1].avg > candles[0].avg) {
    return true;
  }

  return false;
}

function checkIfIsRedCandle(candleObj) {
  let close = parseFloat(candleObj.close);
  let open = parseFloat(candleObj.open);

  if (close < open) {
    return true;
  }
  return false;
}

function verificaBaixa(symbol, mediumPrice) {
  let media1 = (parseFloat(symbol.lowPrice) + parseFloat(mediumPrice)) / 2;
  let media2 = (media1 + parseFloat(symbol.lowPrice)) / 2;
  let media3 = (media2 + parseFloat(symbol.lowPrice)) / 2;

  if (parseFloat(symbol.lastPrice) < media3) {
    return true;
  }
  return false;
}

async function createOrder(buyCoin, quantity, client, binanceInfo, prices) {
  let coinInfo = binanceInfo.symbols.find((s) => s.symbol === buyCoin.symbol);

  let minPrice = coinInfo.filters.find(
    (filtro) => filtro.filterType === "PRICE_FILTER"
  ).minPrice;

  let minQty = coinInfo.filters.find(
    (filtro) => filtro.filterType === "LOT_SIZE"
  ).minQty;

  let floatValue = minPrice.toString().split(".")[1].split("1")[0];
  let priceSize = floatValue.length + 1;
  let floatSize = minQty.toString().split(".")[1].split("1")[0];
  let qtdSize = floatSize.length + 1;
  quantity = quantity.toFixed(qtdSize);
  quantity = Math.round(quantity, qtdSize);

  let coinPrice = prices[buyCoin.symbol];

  console.log("VOLUMEEEEE ", buyCoin.volume);

  let savingOrder = {
    order: {
      symbol: buyCoin.symbol,
      side: "BUY",
      quantity,
      type: "MARKET",
    },
    aditionalInfos: {
      coinPrice,
    },
  };

  storeData(savingOrder, "orders/MARKET-" + buyCoin.symbol + ".json");

  let stopPrice = coinPrice * priceLimit.toFixed(priceSize);
  let sellPrice = coinPrice * priceStop.toFixed(priceSize);
  let sellPriceOco = coinPrice * priceTarget.toFixed(priceSize);

  let ocoOrderObj = {
    symbol: buyCoin.symbol,
    side: "SELL",
    quantity: quantity,
    price: sellPriceOco,
    stopPrice: stopPrice,
    stopLimitPrice: sellPrice,
  };

  storeData(ocoOrderObj, "orders/OCO-" + buyCoin.symbol + ".json");
}

function createCoins(client, infos, prices, cacheBlockeds) {
  let symbols = infos["symbols"];
  let symbolList = symbols.filter(
    (s) => s.quoteAsset === "BTC" && s.status === "TRADING"
  );

  var coinList = symbolList.map(function (el) {
    return el.symbol;
  });
  coinList = coinList.filter((c) => parseFloat(prices[c]) > coinMinValue);
  coinList = coinList.filter((c) => blockeds.indexOf(c) === -1);
  coinList = coinList.filter((c) => cacheBlockeds.indexOf(c) === -1);
  console.log("coinList TOTALE", coinList);

  function createEachCoin(coin) {
    return new Promise(async (resolve) => {
      let lowCandles = await client
        .candles({
          symbol: coin,
          interval: "1h",
          limit: 2,
        })
        .catch((erro) => {
          console.log("erro" + erro);
          return [];
        });

      let symbol = await client
        .dailyStats({
          symbol: coin,
        })
        .catch((erro) => {
          console.log("erro" + erro);
          return [];
        });

      if (
        !checkIfIsRedCandle(lowCandles[lowCandles.length - 1]) &&
        verificaBaixa(symbol, lowCandles[lowCandles.length - 2].high)
      ) {
        let emaCandles = await client
          .candles({
            symbol: coin,
            interval: "4h",
            limit: 25,
          })
          .catch((erro) => {
            console.log("erro" + erro);
            return [];
          });

        let emaArray = EMACalc(emaCandles, 25);
        let ema25Price = emaArray[emaArray.length - 1];

        if (
          symbol.lastPrice < ema25Price &&
          parseFloat(symbol.volume) > minVolume
        ) {
          const mediumCandles = await client
            .candles({
              symbol: coin,
              interval: mediumInterval,
              limit: mediumLimit,
            })
            .catch((erro) => {
              console.log("erro" + erro);
              return [];
            });

          if (isRising(mediumCandles)) {
            let shortCandles = await client
              .candles({
                symbol: coin,
                interval: shortInterval,
                limit: shortLimit,
              })
              .catch((erro) => {
                console.log("erro" + erro);
                return [];
              });

            if (checkIfPriceIsBelow(shortCandles, symbol.lastPrice)) {
              let quantity = minimoParaAtivar / (symbol.lastPrice * 0.99);

              createOrder(symbol, quantity, client, infos, prices);
              resolve({ coin, comprou: true });
            } else {
              resolve({ coin, comprou: false });
            }
          } else {
            resolve({ coin, comprou: false });
          }
        } else {
          resolve({ coin, comprou: false });
        }
      } else {
        resolve({ coin, comprou: false });
      }
    });
  }
  const promiseAll = [...coinList.map((coin) => createEachCoin(coin))];
  return Promise.all(promiseAll);
}

module.exports = {
  async getCoins(client, binanceInfo) {
    try {
      let prices = await client.prices();
      var cacheBlockeds = await loadData("./blockeds.txt");
      cacheBlockeds = JSON.parse(cacheBlockeds);

      let coinsBlockeds = cacheBlockeds.data;
      createCoins(client, binanceInfo, prices, coinsBlockeds)
        .then((promises) => {
          let compradas = promises.filter((p) => p.comprou);
          let naoCompradas = promises.filter((p) => !p.comprou);
          let curtas = promises.filter((p) => p.engolfoCurto);
          let longas = promises.filter((p) => p.engolfoLongo);

          compradas.forEach(({ coin, comprou, order }) =>
            console.log(
              "moeda: " + coin + " comprou: " + comprou + " order: " + order
            )
          );
          console.log("\n");
          let dataNow = new Date();
          console.log("ultima verificação: " + dataNow.toISOString());
          console.log("nao compradas: " + naoCompradas.length);
          console.log("compradas: " + compradas.length);
          console.log("passaram da verificacao curto prazo: " + curtas.length);
          console.log("passaram da verificacao longo prazo: " + longas.length);
          console.log("\n");
        })
        .catch((err) => {
          console.log(err);
          console.log("\n");
          console.log("\n");
        });
    } catch (err) {
      console.error(err);
    }
  },
};
