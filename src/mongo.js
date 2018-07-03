const { MongoClient } = require('mongodb');
const assert = require('assert');

require('dotenv').config();

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}${process.env.DB_HOST}/test?retryWrites=true`;

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

const updateRating = async (account) => {
  // Update youtube profile info in the database
  try {
    const client = await MongoClient.connect(uri, { useNewUrlParser: true });
    const db = client.db(process.env.DB_NAME);
    const col = db.collection(process.env.DB_COLLECTION);
    const {
      _id,
      twitterFollowersCorrected,
      youtubeSubscribersCorrected,
      tgGroupSubscribersCorrected,
      tgChannelSubscribersCorrected,
      tgRating,
      totalSubscribersCorrected,
    } = account || {};
    col.updateOne(
      { _id }, {
        $set: {
          twitter_followers_corrected: twitterFollowersCorrected,
          tg_group_subscribers_corrected: tgGroupSubscribersCorrected,
          tg_channel_subscribers_corrected: tgChannelSubscribersCorrected,
          youtube_subscribers_corrected: youtubeSubscribersCorrected,
          total_subscribers_corrected: totalSubscribersCorrected,
          tg_rating: tgRating,
          rating_updated: Date.now(),
        },
      }, (err, result) => {
        assert.equal(err, null);
        assert.equal(1, result.result.n);
      },
    );
    client.close();
  } catch (e) {
    console.error(e);
  }
};

module.exports = {
  fetchStats,
  updateRating,
};
