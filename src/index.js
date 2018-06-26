const request = require('request-promise-native');
const cron = require('node-cron');
const { MongoClient } = require('mongodb');
const assert = require('assert');

require('dotenv').config();

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}${process.env.DB_HOST}/test?retryWrites=true`;

// Mongo calls

const fetchStats = async () => {
  // Collect a list of influencers with twitter accounts
  let accounts;
  try {
    const client = await MongoClient.connect(uri, { useNewUrlParser: true });  
    const db = client.db(process.env.DB_NAME);
    const col = db.collection('influencers');
    accounts = await col.find(
      {
        $or: [{ twitter_updated: { $exists: true } },
          { youtube_updated: { $exists: true } },
          { tg_updated: { $exists: true } }],
      },
    ).toArray();
    client.close();
  } catch (e) {
    console.error(e);
  }
  return accounts;
};

// Logic

const calculateRating = async () => {
  fetchStats()
    .then(accounts => console.log(accounts));
  // console.log(influencers);
};

// Cron tasks

cron.schedule('* * * *', () => {
  const services = {
    twitter: request('http://localhost:3001'),
    youtube: request('http://localhost:3002'),
    telegram: request('http://localhost:3003')
  };
  Promise.all(Object.values(services))
    .then((statuses) => {
      const failedServices = statuses.reduce((failed, status, index) => {
        if (status !== 'OK') {
          failed.push(Object.keys(services)[index]);
        }
        return failed;
      });
      if (!failedServices.length) {
        failedServices.forEach(service => console.log(`${service} service failed`));
      } else {
        calculateRating();
      }
    })
    .catch(err => console.log(err));
});