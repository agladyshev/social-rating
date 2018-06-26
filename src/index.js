const request = require('request-promise-native');
const cron = require('node-cron');
const { MongoClient } = require('mongodb');
// const assert = require('assert');

require('dotenv').config();

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}${process.env.DB_HOST}/test?retryWrites=true`;
const uriTwitter = process.env.TWITTER_URI || 'http://localhost:3001';
const uriYoutube = process.env.YOUTUBE_URI || 'http://localhost:3002';
const uriTelegram = process.env.TELEGRAM_URI || 'http://localhost:3003';

// Mongo calls

const fetchStats = async () => {
  // Collect a list of influencers from DB with existing social stats
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

cron.schedule('59 * * * *', () => {
  // Update social statistics every hour
  const services = {
    twitter: request(uriTwitter),
    youtube: request(uriYoutube),
    telegram: request(uriTelegram),
  };
  Promise.all(Object.values(services))
    // Start parallel async tasks to update stats
    // Proceed when all tasks done
    .then((statuses) => {
      // Log if any of services fails
      const failedServices = statuses.reduce((failed, status, index) => {
        if (status !== 'OK') {
          failed.push(Object.keys(services)[index]);
        }
        return failed;
      });
      if (!failedServices.length) {
        failedServices.forEach(service => console.log(`${service} service failed`));
      } else {
      // If all services return OK, calculate social rating
        calculateRating();
      }
    })
    .catch(err => console.log(err));
});
