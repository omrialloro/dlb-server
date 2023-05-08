/**
 * Required External Modules
 */

const express = require("express");
const router = express.Router();
require("dotenv").config();

const cors = require("cors");
const helmet = require("helmet");
const fs = require("fs");
const AWS = require("aws-sdk");
const serverlessExpress = require("@vendia/serverless-express");

var spawn = require("child_process").spawn;
const makePngs = require("./PngUtils.js").makePngs;
const makeThumbnail = require("./PngUtils.js").makeThumbnail;
const GIFEncoder = require("./GIFEncoder");
const { Parser } = require("./Parser");

// const { messagesRouter } = require("./messages/messages.router");

const { checkJwt } = require("./authz/check-jwt");
AWS.config.update({ region: "eu-central-1" });

// const dynamodb = new AWS.DynamoDB.DocumentClient();
var dynamodb = new AWS.DynamoDB({ apiVersion: "2012-08-10" });
var documentClient = new AWS.DynamoDB.DocumentClient();

const dynamodbTableName = "animations";

const s3 = new AWS.S3();

const app = express();

var morgan = require("morgan");
const { log } = require("console");
app.use(morgan("dev"));

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.use(express.json({ limit: "25mb" }));
app.use(helmet());
app.use(cors(/*{ origin: clientOrigins }*/));
app.use(express.json());

// apiRouter.use("/messages", messagesRouter);

app.use(function (err, req, res, next) {
  console.log(err);
  res.status(500).send(err.message);
});

const serverPort = process.env.PORT || 4000;

app.listen(serverPort, () => {
  console.log(`API Server listening on port ${serverPort}`);
});

// var server = https.createServer(options, app).listen(serverPort, function(){
//   console.log("Express server listening on port " + serverPort);
// });

app.use(require("./auth"));
app.get("/check", checkJwt, function (req, res) {
  res.send("ok");
});

app.get("/animationsList", checkJwt, function (req, res) {
  console.log("FFF");
  const type = req.params.type;
  const isRow = type === "row";
  var params = {
    IndexName: "userID-index",
    ExpressionAttributeValues: {
      ":u": { S: req.user.email },
      ":d": { BOOL: false },
      ":s": { BOOL: true },
      ...(isRow
        ? {
            ":t": { S: "row" },
          }
        : undefined),
    },
    KeyConditionExpression: "userID = :u",
    ProjectionExpression: "animationId,animationName",
    FilterExpression:
      "isDeleted = :d and saved=:s" + (isRow ? "and formatType=:t" : ""),
    TableName: dynamodbTableName,
  };

  dynamodb.query(params, function (err, data) {
    if (err) {
      console.log("Error", err);
      return res.status(500).send(err);
    }
    let names = data["Items"].map((x) => x["animationName"]["S"]);
    let ids = data["Items"].map((x) => x["animationId"]["S"]);
    let animationsList = { ids: ids, names: names };
    return res.send(JSON.stringify(animationsList));
  });
});

app.post("/saveStoredAnimations", checkJwt, async (request, response) => {
  var data = JSON.stringify(request.body);
  var data_str = JSON.parse(data);
  // TODO: USE userid FROM JWT
  var userID = data_str["userID"];
  var data = JSON.stringify(data_str["data"]);

  await s3
    .putObject({
      Bucket: "dlb-thumbnails",
      Key: `storedAnimations/${userID}.json`,
      Body: data,
      ContentType: "application/json",
    })
    .promise();

  return response.send("ok");
});

app.get("/loadStoredAnimations/:userID", checkJwt, function (req, res) {
  const userID = req.params.userID;
  var params = {
    Bucket: "dlb-thumbnails",
    Key: `storedAnimations/${userID}.json`,
  };
  s3.getObject(params, function (err, data) {
    if (err) {
    } else {
      var data = JSON.parse(data.Body);
      res.send(JSON.stringify(data));
    }
  });
});

app.post("/saveAnimation", checkJwt, async (req, res) => {
  var data = JSON.stringify(req.body);
  var data_str = JSON.parse(data);
  var userID = req.user.email;
  console.log(userID);
  var isDeleted = data_str["isDeleted"];
  var formatType = data_str["formatType"];
  var IsSaved = data_str["saved"];
  var name = data_str["name"];
  var frames = JSON.stringify(data_str["data"]);
  var animationId = String(Date.now());

  if (!IsSaved) {
    animationId = name;
  }

  var params = {
    TableName: dynamodbTableName,
    Item: {
      animationName: { S: name },
      userName: { S: userID },
      userID: { S: userID },
      animationId: { S: animationId },
      isDeleted: { BOOL: isDeleted },
      formatType: { S: formatType },
      saved: { BOOL: IsSaved },
      date: { S: String(Date.now()) },
    },
  };
  await dynamodb
    .putItem(params, function (err, data) {
      if (err) {
        console.log("Error", err);
      } else {
        console.log("Success");
      }
    })
    .promise();

  await s3
    .putObject({
      Bucket: "dlb-thumbnails",
      Key: `frames/${animationId}.json`,
      Body: frames,
      ContentType: "application/json",
    })
    .promise();

  const thumbnailBuffer = makeThumbnail(data_str["ThumbnailFrame"]);
  await s3
    .putObject({
      Bucket: "dlb-thumbnails",
      Key: `${animationId}.png`,
      Body: thumbnailBuffer,
      ContentType: "image/png",
    })
    .promise();
  return res.send();
});

app.get("/loadAnimation/:filename", checkJwt, function (req, res) {
  // app.get('/loadAnimation/:filename', function (req, res) {

  const filename = req.params.filename;
  var params = { Bucket: "dlb-thumbnails", Key: `frames/${filename}.json` };

  s3.getObject(params, function (err, data) {
    if (err) {
      res.send(JSON.stringify({ data: -1, id: -1 }));
    } else {
      var animation = { data: JSON.parse(data.Body), id: filename };
      res.send(JSON.stringify(animation));
    }
  });
});

app.post("/markAsDeleted", checkJwt, (request, response) => {
  var data_str = JSON.stringify(request.body);
  var data = JSON.parse(data_str);

  const markAsDeleted = async (id) => {
    const params = {
      TableName: dynamodbTableName,
      Key: {
        animationId: id,
      },
      UpdateExpression: "set isDeleted = :r",
      ExpressionAttributeValues: {
        ":r": true,
      },
    };

    await documentClient.update(params).promise();
  };
  for (let i = 0; i < data.length; i++) {
    markAsDeleted(data[i]);
  }
});

app.post("/deleteStoredAnimation", checkJwt, (request, response) => {
  console.log(request.body);
  let animationId = String(request.body["animationId"]);
  console.log(animationId);
  var fileItem = {
    Key: {
      animationId: { S: animationId },
    },
    TableName: dynamodbTableName,
  };
  dynamodb.deleteItem(fileItem, function (err, data) {
    if (err) {
      console.log(err, err.stack);
    } else {
      console.log(data);
    }
  });

  s3.deleteObject({
    Bucket: "dlb-thumbnails",
    Key: `frames/${animationId}.json`,
  }).promise();

  // var data_str = JSON.stringify(request.body)
});

// app.post("/gif", checkJwt, async (req, res) => {
//   const { frames, delay } = req.body;
//   const num_pixels = frames[0].length;
//   const pixel_size = 10;
//   const margin = 1;
//   const size_frame = pixel_size * num_pixels + 2 * margin * (num_pixels + 1);

//   const encoder = new GIFEncoder(size_frame, size_frame);

//   encoder.start();
//   encoder.setRepeat(0); // 0 for repeat, -1 for no-repeat
//   encoder.setDelay(delay); // frame delay in ms
//   encoder.setQuality(20); //

//   for (let i = 0; i < frames.length; i++) {
//     encoder.addFrame(Parser(frames[i]));
//   }

//   const gifData = encoder.out.getData();

//   res.writeHead(200, {
//     "Content-Type": "image/gif",
//     "Content-Disposition": 'attachment; filename="mygif.gif"',
//     // "Access-Control-Allow-Origin": "*", // allow requests from any origin
//     // "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
//   });
//   res.end(Buffer.from(gifData));

//   encoder.finish();
// });

// app.post("/gif", checkJwt, async (req, res) => {
//   try {
//     const { frames, delay } = req.body;
//     const num_pixels = frames[0].length;
//     const pixel_size = 10;
//     const margin = 1;
//     const size_frame = pixel_size * num_pixels + 2 * margin * (num_pixels + 1);

//     const encoder = new GIFEncoder(size_frame, size_frame);

//     encoder.start();
//     encoder.setRepeat(0); // 0 for repeat, -1 for no-repeat
//     encoder.setDelay(delay); // frame delay in ms
//     encoder.setQuality(20); //

//     for (let i = 0; i < frames.length; i++) {
//       encoder.addFrame(Parser(frames[i]));
//     }

//     const gifData = encoder.out.getData();

//     res.writeHead(200, {
//       "Content-Type": "image/gif",
//       "Content-Disposition": 'attachment; filename="mygif.gif"',
//     });
//     res.end(Buffer.from(gifData));

//     encoder.finish();
//   } catch (error) {
//     console.error(error);
//     res.status(500).send({ error: "Internal Server Error" });
//   }
// });

app.post("/gif", checkJwt, async (req, res) => {
  var data = JSON.stringify(req.body);

  const { frames, delay } = req.body;
  const num_pixels = frames[0].length;
  const pixel_size = 10;
  const margin = 1;
  const size_frame = pixel_size * num_pixels + 2 * margin * (num_pixels + 1);

  const encoder = new GIFEncoder(size_frame, size_frame);

  // encoder.start();
  // encoder.setRepeat(0); // 0 for repeat, -1 for no-repeat
  // encoder.setDelay(delay); // frame delay in ms
  // encoder.setQuality(20); //

  // for (let i = 0; i < frames.length; i++) {
  //   encoder.addFrame(Parser(frames[i]));
  // }

  // const gifData = encoder.out.getData();

  var animationId = String(Date.now());
  console.log(
    `https://dlb-thumbnails.s3.eu-central-1.amazonaws.com/frames/${animationId}.json`
  );

  console.log("DDDD");

  await s3
    .putObject({
      Bucket: "dlb-thumbnails",
      Key: `frames/${animationId}.json`,
      Body: data,
      ContentType: "application/json",
    })
    .promise();
  return res.send();
});

exports.handler = serverlessExpress({ app });
