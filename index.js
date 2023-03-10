import bodyParser from 'body-parser';
import cors from 'cors';
import express from "express";
import fs from "fs";
import fetch from 'node-fetch';
import path from "path";
import Twit from 'twit';
import * as dotenv from 'dotenv';
import { accessTokenSignature, requestTokenSignature } from "./signature.js";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
dotenv.config()
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

var app = express();
app.use(express.static(`${__dirname}/front/build`));
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }))

const parseOAuthRequestToken = (responseText) =>
  responseText.split("&").reduce((prev, el) => {
    const [key, value] = el.split("=");
    return { ...prev, [key]: value };
  }, {});


app.post('/api/request-token', async function (req, res) {
  // const { callbackUrl } = req.body;
  const apiUrl = "https://api.twitter.com/oauth/request_token";
  const method = "POST"
  const oauthSignature = requestTokenSignature({ apiUrl, method });
  // https://corsanywhere.herokuapp.com/
  const response = await fetch(apiUrl, {
    method,
    headers: {
      Authorization: `OAuth ${oauthSignature}`,
      "X-Requested-With": "XMLHttpRequest"
    }
  });
  const responseText = await response.text();
  const token = parseOAuthRequestToken(responseText);
  res.send(token);
})

app.post('/api/access-token', async function (req, res) {
  const { oauthToken, oauthVerifier } = req.body;
  const apiUrl = "https://api.twitter.com/oauth/access_token";
  const method = "POST"

  const oauthSignature = accessTokenSignature({ method, apiUrl, oauthToken, oauthVerifier });
  const response = await fetch(apiUrl, {
    method,
    headers: {
      Authorization: `OAuth ${oauthSignature}`,
      "X-Requested-With": "XMLHttpRequest"
    }
  });
  const responseText = await response.text();
  const token = parseOAuthRequestToken(responseText);
  res.send(token);
})

const twitter = (url, data, access_token, access_token_secret) => {
  return new Promise((resolve, reject) => {
    const T = new Twit({
      consumer_key: process.env.CONSUMER_KEY, consumer_secret: process.env.CONSUMER_SECRET, access_token, access_token_secret,
    });

    T.get(url, data, function (err, data, response) {
      if (err) {
        resolve(false)
        console.log(err);
      } else {
        resolve(data);
      }
    });
  })
}
app.post('/api/verify-credentials', async function (req, res) {
  const { access_token, access_token_secret } = req.body;
  const data = { tweet_mode: "extended" };
  const url = 'account/verify_credentials';
  try {
    const response = await twitter(url, data, access_token, access_token_secret)
    res.send({ screen_name: response.screen_name, success: true })
  } catch (error) {
    res.send({ screen_name: "", error })
  }
})
app.post('/api/check-followers', async function (req, res) {
  const { screen_name, access_token, access_token_secret } = req.body;
  const data = { screen_name };
  const url = 'friends/ids';
  try {
    const response = await twitter(url, data, access_token, access_token_secret)
    if (response) {
      const followingElonMusk = response.ids.includes(1483172593804857349);
      res.send({ followed: followingElonMusk, success: true })
    } else {
      res.send({ followed: false, error: "twitter error" })
    }
  } catch (error) {
    res.send({ followed: false, error })
  }
})

app.post('/api/check-user', async function (req, res) {
  const { address } = req.body;
  if (!address) res.send({ exists: false, error: "Empty address" })
  try {
    const content = fs.readFileSync("users.csv", 'utf-8')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(item => {
        if (!item) return false;
        item = item.split(",");
        if (item.length != 2) return false;
        if (address.toLowerCase() == item[0].toLowerCase()) return item[1];
        return false;
      }).filter(item => item);
    if (content?.length > 0) {
      res.send({ exists: true, name: content[0] });
      return;
    } else {
      res.send({ exists: false })
    }
  } catch (error) {
    res.send({ exists: false, error: error.message })
    return;
  }
})

app.post('/api/save-user', async function (req, res) {
  const { address, twitter_name } = req.body;
  fs.appendFileSync("users.csv", `${address},${twitter_name}\n`)
  res.send({ success: true })
})

app.post("/api/users", (req, res) => {
  const { username, password } = req.body;
  if (username == 'admin' && password == 'wcnftcosmos') {
    const file = `${__dirname}/users.csv`;
    if (fs.existsSync(file)) {
      res.download(file);
    } else {
      res.send('<script>alert("No data"); window.location.href = "/"; </script>');
    }
  } else {
    res.send('<script>alert("Invalid user name or password"); window.location.href = "/users"; </script>');
  }
});
app.use("*", (req, res) => {
  res.sendFile(path.join(__dirname, "front/build", "index.html"));
});

var server = app.listen(process.env.PORT || 8000, function () {
  var host = server.address().address
  var port = server.address().port

  console.log("listening at http://%s:%s", host, port)
})