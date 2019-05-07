import * as express from 'express';
import axios from 'axios';
import { path, map, pick, omit } from 'ramda';
import { MongoClient } from 'mongodb';

import * as config from '../config';

const router = express.Router();
const app = express();

const cachedTimeouts = {
  balance: null,
  transactions: null,
};

router.get('/balance/:walletAddress', (req, res) => {
  MongoClient.connect(config.db.mongoUrl, (err, client) => {
    const db = client.db(config.db.name);
    const balanceCollection = db.collection('balance');

    if (
      cachedTimeouts.balance &&
      new Date().getTime() - cachedTimeouts.balance <
        config.server.cacheTimeoutInMs
    ) {
      balanceCollection.find({}).toArray((err, records) => {
        client.close();
        res.json(omit(['_id'], records[0]));
      });
    } else {
      axios
        .get(
          `https://bch-chain.api.btc.com/v3/address/${
            req.params.walletAddress
          }`,
        )
        .then(data => {
          const result = {
            balance: path(['data', 'data', 'balance'], data) / 100000000,
          };

          balanceCollection.deleteMany({}, () => {
            balanceCollection.insertOne(result, () => {
              client.close();
              cachedTimeouts.balance = new Date().getTime();
              res.json(omit(['_id'], result));
            });
          });
        });
    }
  });
});

router.get('/transactions/:walletAddress', (req, res) => {
  MongoClient.connect(config.db.mongoUrl, (err, client) => {
    const db = client.db(config.db.name);
    const transactionsCollection = db.collection('transactions');

    if (
      cachedTimeouts.transactions &&
      new Date().getTime() - cachedTimeouts.transactions <
        config.server.cacheTimeoutInMs
    ) {
      transactionsCollection.find({}).toArray((err, records) => {
        client.close();
        res.json(map(item => omit(['_id'], item), records));
      });
    } else {
      axios
        .get(
          `https://bch-chain.api.btc.com/v3/address/${
            req.params.walletAddress
          }/tx`,
        )
        .then(data => {
          const result = map(
            item => ({
              balance_diff: item.balance_diff / 100000000,
              ...pick(['hash', 'created_at'], item),
            }),
            path(['data', 'data', 'list'], data),
          );

          transactionsCollection.deleteMany({}, () => {
            transactionsCollection.insertMany(result, () => {
              client.close();
              cachedTimeouts.transactions = new Date().getTime();
              res.json(map(item => omit(['_id'], item), result));
            });
          });
        });
    }
  });
});

app.use(config.server.routePrefix, router);

app.listen(config.server.port, () =>
  console.log(`Server listening on port ${config.server.port}!`),
);
