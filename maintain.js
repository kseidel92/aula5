const fs = require ('fs');

let priceLimit = 0.993;
let priceStop = 0.991;
let priceTarget = 1.013;

const storeData = (data, path) => {
  try {
    fs.writeFileSync (path, JSON.stringify (data));
  } catch (err) {
    console.error (err);
  }
};

async function loadData (path) {
  try {
    return fs.readFileSync (path, 'utf8');
  } catch (err) {
    console.error (err);
    return false;
  }
}

function arred(d,casas) { 
  var aux = Math.pow(10,casas)
  return Math.floor(d * aux)/aux
}

async function keepMaintaining (client, jsonOrder) {
  jsonOrder = JSON.parse (jsonOrder);
  let ocoId = jsonOrder.orderListId;
  let boughtPrice = jsonOrder.boughtPrice;
  console.log ('BUSCANDO SYMBOLE  ' + jsonOrder.symbol);

  let symbol = await client.dailyStats ({symbol: jsonOrder.symbol});

  console.log ('BUSCOU SYMBOL ' + JSON.stringify (symbol));

  let currentPrice = symbol.lastPrice;
  let step = parseInt (jsonOrder.step);

  if (currentPrice > boughtPrice * 1.005) {
    console.log (
      '==== ACTION MAINTAINING =) RAISING UP UP == SYMBOL ' +
        jsonOrder.symbol +
        '\n'
    );
    console.log (
      '==== ACTION MAINTAINING =) RAISING UP UP == step ' +
        jsonOrder.step +
        '\n'
    );

    await client
      .cancelOrderOco ({
        symbol: jsonOrder.symbol,
        orderListId: ocoId,
      })
      .catch (erro => {
        console.log ('erro' + erro);
        console.log ('provavelmente ja vendeu');

      });

    console.log (
      '=========== ACTION MAINTAINING =) PREV OCO CANCELED E REFAZENDO =========' +
        '\n'
    );

    if (step === 0) {
      let sellPriceOco = currentPrice * priceTarget;
      let stopPrice = currentPrice * priceLimit;
      let sellPrice = currentPrice * priceStop;
      let fixer = jsonOrder.fixer;


      sellPriceOco = sellPriceOco.toFixed (fixer);
      stopPrice = stopPrice.toFixed(fixer);
      sellPrice = sellPrice.toFixed(fixer);

      let quantityH = arred(jsonOrder.quantity, jsonOrder.qtdSize);
      
      if (quantityH > 100) {
        quantityH = Math.floor(quantityH)
      }

      let ocoOrderObj = {
        symbol: jsonOrder.symbol,
        side: 'SELL',
        quantity: quantityH,
        price: sellPriceOco,
        stopPrice: stopPrice,
        stopLimitPrice: sellPrice,
      };

      await client
        .orderOco (ocoOrderObj)
        .then (result => {
          let orderId = result.orderListId;
          let jsonFile = ocoOrderObj;
          jsonFile.fixer = fixer;
          jsonFile.step = 0;
          jsonFile.orderListId = orderId;
          jsonFile.boughtPrice = currentPrice;
          storeData (jsonFile, '../oco_files/OCO.txt');
        })
        .catch (erro => {
          console.log ('erro' + erro);


        });
    }

  } else {
    console.log ('NAO SUBIU O TANTO PRA MAINTAIN AINDA');
  }
}

module.exports = {
  async keep (client) {
    console.log ('iniciand manutencao ');
    let path = '../oco_files/OCO.txt';
    fs.stat (path, async function (err, stats) {
      if (err) {
        console.log ('NAO TEM FILE OCO ');
      } else {
        let jsonRead = await loadData (path);
        console.log ('TEM FILE OCO ' + jsonRead);
        await keepMaintaining (client, jsonRead);
      }
      console.log ('ENDD');
    });
  },
};
