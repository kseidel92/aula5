const Binance = require("binance-api-node").default;
const fs = require("fs");
var blocker = require("./blocker");

const client = Binance({
  apiKey: "",
  apiSecret: "",
  getTime: () => Date.now(),
});

var cron = require("cron");
var robot = require("./klaus_robo");
var tik = null;

var cors = require("cors");
var express = require("express");
var apiRoutes = express.Router();
var app = express();
var http = require("http");
var bodyParser = require("body-parser");
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

async function loadData(path) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch (err) {
    console.error(err);
    return false;
  }
}

setInterval(function () {
  try {
    http.get("http://herokuappname.herokuapp.com/api/");
  } catch (err) {
    console.error(err);
  }
}, 300000);

async function storeData(data, path) {
  try {
    fs.writeFileSync(path, JSON.stringify(data));
  } catch (err) {
    console.error(err);
  }
}

async function getTik(client) {
  let tickets = await client.exchangeInfo().catch((erro) => {
    console.log("erro" + erro);
  });

  if (tik == null && tickets !== {}) {
    tik = tickets;
  }
}

getTik(client);

var job = new cron.CronJob({
  cronTime: "*/20 * * * * *",
  onTick: async function () {
    try {
      let stater = await loadData("./jobstate.txt");
      console.log("stater ", stater);
      let intState = parseInt(stater) + 1;
      console.log("intState ", intState);
      if (intState < 109) {
        robot.getCoins(client, tik);
      }

      if (intState == 113) {
        await storeData(intState, "./jobstate.txt");
        await blocker.blockSome(client);
      }

      if (intState == 115) {
        intState = 1;
      }

      await storeData(intState, "./jobstate.txt");
      console.log("tetestte");
    } catch (err) {
      console.error(err);
    }
  },
  start: false,
  timeZone: "America/Sao_Paulo",
});

job.start();

var port = process.env.PORT || 3000;

app.use("/api", apiRoutes);

app.listen(port, function () {
  console.log("Listening on " + port);
});
