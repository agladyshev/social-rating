require("dotenv").config();
const request = require("request-promise-native");
const cron = require("node-cron");
const mongo = require("./mongo");
const express = require("express");

const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;

const uriTwitter = process.env.TWITTER_URI || "http://localhost:3001";
const uriYoutube = process.env.YOUTUBE_URI || "http://localhost:3002";
const uriTelegram = process.env.TELEGRAM_URI || "http://localhost:3003";

const calculateRating = async accounts => {
  const updatedAccounts = accounts.map(account => {
    const updatedAccount = account;
    const {
      youtube_videos_status,
      youtube_videos_recent,
      youtube_likes_recent,
      youtube_comments_recent,
      youtube_favorites_recent,
      youtube_dislikes_recent,
      youtube_views_recent,
      youtube_subscribers,
      twitter_status,
      twitter_favorites_recent,
      twitter_retweets_recent,
      tweets_recent,
      twitter_followers,
      tg_channel_status,
      tg_channel_subscribers,
      tg_channel_err,
      tg_group_status,
      tg_group_posts_per_day,
      tg_group_subscribers
    } = updatedAccount || {};
    if (youtube_videos_status === "OK" && youtube_videos_recent) {
      updatedAccount.youtubeRecentEngagement =
        (parseInt(youtube_likes_recent, 10) +
          parseInt(youtube_comments_recent, 10) +
          parseInt(youtube_favorites_recent, 10) +
          parseInt(youtube_dislikes_recent, 10)) /
        parseInt(youtube_views_recent, 10);
      updatedAccount.youtubeSubscribersCorrected = Math.round(
        parseInt(youtube_subscribers, 10) *
          (1 +
            process.env.YOUTUBE_MULTI * updatedAccount.youtubeRecentEngagement)
      );
    }
    if (twitter_status === "OK" && tweets_recent && twitter_followers) {
      updatedAccount.twitterRecentEngagement =
        (parseInt(twitter_favorites_recent, 10) +
          parseInt(twitter_retweets_recent, 10)) /
        (parseInt(tweets_recent, 10) * parseInt(twitter_followers, 10));
      updatedAccount.twitterFollowersCorrected = Math.round(
        parseInt(twitter_followers, 10) *
          (1 +
            process.env.TWITTER_MULTI * updatedAccount.twitterRecentEngagement)
      );
    }
    if (
      tg_channel_status === "OK" &&
      tg_channel_subscribers &&
      tg_channel_err !== "N/A"
    ) {
      updatedAccount.tgChannelSubscribersCorrected = Math.round(
        parseInt(tg_channel_subscribers, 10) *
          (1 + parseFloat(tg_channel_err) / 100)
      );
    }
    if (
      tg_group_status === "OK" &&
      tg_group_subscribers &&
      tg_group_posts_per_day
    ) {
      updatedAccount.tgGroupSubscribersCorrected =
        parseInt(tg_group_subscribers, 10) +
        process.env.GROUP_MULTI * parseInt(tg_group_posts_per_day, 10);
    }
    updatedAccount.tgRating =
      (updatedAccount.tgChannelSubscribersCorrected ||
        parseInt(tg_channel_subscribers, 10) ||
        0) +
      (updatedAccount.tgGroupSubscribersCorrected ||
        parseInt(tg_group_subscribers, 10) ||
        0);
    updatedAccount.totalSubscribersCorrected =
      (updatedAccount.youtubeSubscribersCorrected ||
        parseInt(youtube_subscribers, 10) ||
        0) +
      (updatedAccount.twitterFollowersCorrected ||
        parseInt(twitter_followers, 10) ||
        0) +
      updatedAccount.tgRating;
    return updatedAccount;
  });
  return updatedAccounts;
};

// Cron tasks

const updateRating = function() {
  const services = {
    twitter: request(uriTwitter),
    youtube: request(uriYoutube),
    telegram: request(uriTelegram)
  };
  return (
    Promise.all(Object.values(services))
      // Start parallel async tasks to update stats
      // Proceed when all tasks done
      .then(statuses => {
        // Log if any of services fails
        const failedServices = statuses.reduce((failed, status, index) => {
          if (status !== "OK") {
            failed.push(Object.keys(services)[index]);
          }
          return failed;
        });
        if (!failedServices.length) {
          failedServices.forEach(service =>
            console.log(`${service} service failed`)
          );
        }
      })
      .then(() => mongo.fetchStats())
      .then(accounts => calculateRating(accounts))
      .then(accounts => accounts.map(mongo.updateRating))
      .catch(err => console.log(err))
  );
};

cron.schedule("59 * * * *", () => {
  // Update social statistics every hour
  updateRating();
});

app.get("/", function(req, res, next) {
  updateRating()
    .then(result => res.status(200).send("success"))
    .catch(err => res.status(500).send(err));
});

app.listen(port, () => console.log(`Listening`));
