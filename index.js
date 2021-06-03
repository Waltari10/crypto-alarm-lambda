require("dotenv").config();
const sgMail = require("@sendgrid/mail");
const https = require("https");

const options = {
  method: "GET",
  hostname: "pro-api.coinmarketcap.com",
  path: "/v1/cryptocurrency/quotes/latest",
  headers: {
    "X-CMC_PRO_API_KEY": process.env.CMC_API_KEY,
    "content-type": "application/json",
    Accept: "application/json",
  },
  json: true,
  gzip: true,
};

const fetchCryptos = (ids) => {
  return new Promise((resolve, reject) => {
    https
      .get({ ...options, path: options.path + "?id=" + ids }, (res) => {
        const data = [];
        res.on("data", (chunk) => {
          data.push(chunk);
        });
        res.on("end", () => {
          const res = JSON.parse(Buffer.concat(data).toString());
          resolve(res);
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
    id: 2010,
  },
  {
    name: "Polka Dot",
    shortName: "DOT",
    highTreshhold: 45,
    lowThreshold: 17.85,
    id: 6636,
  },
  {
    name: "Bitcoin",
    shortName: "BTC",
    highTreshhold: 60000,
    lowThreshold: 34500,
    id: 1,
  },
  {
    name: "Ethereum",
    shortName: "ETH",
    highTreshhold: 3700,
    lowThreshold: 2000,
    id: 1027,
  },
  {
    name: "XRP",
    shortName: "XRP",
    highTreshhold: 1.6,
    lowThreshold: 0.6,
    id: 52,
  },
  {
    name: "Stellar",
    shortName: "XLM",
    highTreshhold: 0.69,
    lowThreshold: 0.37,
    id: 512,
  },
  {
    name: "Tron",
    shortName: "TRX",
    highTreshhold: 0.15,
    lowThreshold: 0.07,
    id: 1958,
  },
  {
    name: "Ankr",
    shortName: "ANKR",
    highTreshhold: 0.16,
    lowThreshold: 0.07,
    id: 3783,
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
  return fetchCryptos(cryptos.map((crypto) => crypto.id).join(","));
};

const filterByCryptosOverPriceRange = (cryptosWithPrices) => {
  return cryptosWithPrices.filter(
    (crypto) => crypto.quote.USD.price > crypto.highTreshhold
  );
};

const filterByCryptosUnderPriceRange = (cryptosWithPrices) => {
  return cryptosWithPrices.filter(
    (crypto) => crypto.quote.USD.price < crypto.lowThreshold
  );
};

const enrichCryptosWithLimits = (cryptos, prices) => {
  return cryptos.map((crypto) => {
    if (prices && prices.data && prices.data[crypto.id]) {
      return {
        ...crypto,
        ...prices.data[crypto.id],
      };
    } else {
      return crypto;
    }
  });
};

const alarmLogic = async () => {
  let prices = [];
  try {
    prices = await fetchPrices();
  } catch (err) {
    sendEmail("Failed to fetch crypto prices catch error!", "-");
    console.error("Fetching prices failed!", err);
    return;
  }

  let enrichedCryptos = enrichCryptosWithLimits(cryptos, prices);

  enrichedCryptos = enrichedCryptos.filter(
    (crypto) =>
      crypto && crypto.quote && crypto.quote.USD.price && crypto.quote.USD.price
  );

  if (!enrichedCryptos || (enrichedCryptos && enrichedCryptos.length === 0)) {
    sendEmail("Failed to fetch any crypto prices!", "-");
    return;
  }

  const highAlarms = filterByCryptosOverPriceRange(enrichedCryptos) || [];
  const lowAlarms = filterByCryptosUnderPriceRange(enrichedCryptos) || [];

  if (highAlarms.length === 0 && lowAlarms.length === 0) {
    sendEmail(
      "Nothing to report :) ",
      "Fetched this many cryptos succesfully... " + enrichedCryptos.length
    );
  }

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
