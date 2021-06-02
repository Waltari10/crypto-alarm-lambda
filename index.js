require("dotenv").config();
const sgMail = require("@sendgrid/mail");
const https = require("https");

const options = {
  method: "GET",
  hostname: "rest.coinapi.io",
  path: "/v1/exchangerate/",
  headers: {
    "X-CoinAPI-Key": process.env.COIN_API_KEY,
    "content-type": "application/json",
  },
};

const getPath = (shortName) => options.path + shortName + "/USD";

const fetchCrypto = (crypto) => {
  return new Promise((resolve, reject) => {
    https
      .get({ ...options, path: getPath(crypto.shortName) }, (res) => {
        res.on("data", (d) => {
          resolve({ ...JSON.parse(d.toString()), ...crypto });
        });
      })
      .on("error", (e) => {
        console.error(e);
        reject(e);
      });
  });
};

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

let attempts = 5;

const sendEmail = async (subject, text) => {
  console.log("sending email with subject", subject);
  try {
    await sgMail.send({
      from: "valtteri.e.laine@gmail.com",
      to: "valtteri.e.laine@gmail.com",
      subject: subject,
      text: text,
    });

    console.log("Email sent at", new Date());
  } catch (err) {
    console.error("Failed to send email!", err);
    if (attempts > 0) {
      attempts--;
      sendEmail(subject, text);
    }
  }
};

const cryptos = [
  {
    name: "Cardano",
    shortName: "ADA",
    highTreshhold: 2.2,
    lowThreshold: 1.3,
  },
  {
    name: "Polka Dot",
    shortName: "DOT",
    highTreshhold: 45,
    lowThreshold: 17.85,
  },
  {
    name: "Bitcoin",
    shortName: "BTC",
    highTreshhold: 60000,
    lowThreshold: 34500,
  },
  {
    name: "Ethereum",
    shortName: "ETH",
    highTreshhold: 3700,
    lowThreshold: 2000,
  },
  {
    name: "XRP",
    shortName: "XRP",
    highTreshhold: 1.6,
    lowThreshold: 0.6,
  },
  {
    name: "Stellar",
    shortName: "XLM",
    highTreshhold: 0.69,
    lowThreshold: 0.37,
  },
  {
    name: "Tron",
    shortName: "TRX",
    highTreshhold: 0.15,
    lowThreshold: 0.07,
  },
];

const sendLowAlarmEmails = async (alarmingCryptos) => {
  await Promise.all(
    alarmingCryptos.map((crypto) =>
      sendEmail(
        "LOW CRYPTO ALARM! " + crypto.name,
        JSON.stringify(crypto, undefined, 2)
      )
    )
  );
};

const sendHighAlarmEmails = async (alarmingCryptos) => {
  await Promise.all(
    alarmingCryptos.map((crypto) =>
      sendEmail(
        "HIGH CRYPTO ALARM! " + crypto.name,
        JSON.stringify(crypto, undefined, 2)
      )
    )
  );
};

const fetchPrices = async () => {
  const promises = cryptos.map((crypto) => fetchCrypto(crypto));

  return Promise.all(promises);
};

const filterByCryptosOverPriceRange = (cryptosWithPrices) => {
  return cryptosWithPrices.filter(
    (crypto) => crypto.rate > crypto.highTreshhold
  );
};

const filterByCryptosUnderPriceRange = (cryptosWithPrices) => {
  return cryptosWithPrices.filter(
    (crypto) => crypto.rate < crypto.lowThreshold
  );
};

const alarmLogic = async () => {
  let cryptosWithPrices;
  try {
    cryptosWithPrices = await fetchPrices();
  } catch (err) {
    console.error("Fetching prices failed!", err);
  }

  if (!cryptosWithPrices) {
    return;
  }

  const highAlarms = filterByCryptosOverPriceRange(cryptosWithPrices) || [];
  const lowAlarms = filterByCryptosUnderPriceRange(cryptosWithPrices) || [];

  try {
    await sendHighAlarmEmails(highAlarms);
    await sendLowAlarmEmails(lowAlarms);
    console.log(
      "Sending emails succesful!",
      "high alarms: " + highAlarms.length,
      "low alarms: " + lowAlarms.length
    );
  } catch (err) {
    console.error("Sending emails failed!", err);
  }
};

exports.handler = () => {
  alarmLogic();
  const response = {
    statusCode: 200,
    body: JSON.stringify("Hello from Lambda!"),
  };
  return response;
};

alarmLogic();
