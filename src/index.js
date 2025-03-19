/**
 * Required External Modules
 */
/**
 * Required External Modules
 */

const http = require("https");

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

const { FrameParser } = require("./FrameParser");

const { checkJwt } = require("./authz/check-jwt");
AWS.config.update({ region: "eu-central-1" });

var dynamodb = new AWS.DynamoDB({ apiVersion: "2012-08-10" });
var documentClient = new AWS.DynamoDB.DocumentClient();

const dynamodbTableName = "animations";

const s3 = new AWS.S3();

const app = express();
const multer = require("multer");
const storage = multer.diskStorage({
  destination: "uploads/", // Ensure this folder exists or create it
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname); // Unique filename
  },
});
const upload = multer({
  storage: multer.memoryStorage(), // Store file in memory before upload
  limits: { fileSize: 10 * 1024 * 1024 }, // Optional: Limit to 10MB
});
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

// async function itemExists(itemId) {
//   const params = {
//     TableName: dynamodbTableName,
//     Key: { animationId: { S: itemId } }, // Assuming 'animationId' is a string attribute
//   };

//   return new Promise((resolve, reject) => {
//     dynamodb.getItem(params, function (err, data) {
//       if (err) {
//         console.log("Error", err);
//         reject(err); // Reject the promise on error
//       } else {
//         console.log("Success");
//         resolve(data.Item || null); // Resolve with item data or null
//       }
//     });
//   });
// }

// itemExists("1675378164221")
//   .then((data) => {
//     if (data) {
//       console.log("Item exists:", data);
//     } else {
//       console.log("Item not found.");
//     }
//   })
//   .catch((err) => console.error("Failed to fetch item:", err));

app.get("/animationsList", checkJwt, function (req, res) {
  const type = req.query.type;
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
      "isDeleted = :d and saved=:s" + (isRow ? " and formatType=:t" : ""),
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
  markAsDeleted(data["animationId"]);
});

app.post("/deleteStoredAnimation", checkJwt, (request, response) => {
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
});

app.post("/gif", checkJwt, async (req, res) => {
  try {
    const { frames, delay, width, height, pixelConfig } = req.body;
    const num_pixels = frames[0].length;
    const pixel_size = 10;
    const margin = 0;
    const size_frame = pixel_size * num_pixels + margin * (num_pixels + 1);

    const l_x = frames[0].length;
    const l_y = frames[0][0].length;

    const width_ = width - (width % l_x);
    const height_ = height - (height % l_y);

    // const encoder = new GIFEncoder(size_frame, size_frame);

    const encoder = new GIFEncoder(width_, height_);

    encoder.start();
    encoder.setRepeat(0); // 0 for repeat, -1 for no-repeat
    encoder.setDelay(delay); // frame delay in ms
    encoder.setQuality(20); //
    console.log(encoder);

    const pixelData = {
      radius: pixelConfig.br,
      opacity: pixelConfig.op,
      pw: pixelConfig.pw,
      ph: pixelConfig.ph,
    };

    for (let i = 0; i < frames.length; i++) {
      try {
        // encoder.addFrame(Parser(frames[i], pixel_size, margin));
        encoder.addFrame(FrameParser(frames[i], width_, height_, pixelData));
      } catch (error) {
        console.log(error);
      }
    }

    const gifData = encoder.out.getData();
    var animationId = String(Date.now());

    await s3
      .putObject({
        Bucket: "dlb-thumbnails",
        Key: `gifs/ooo${animationId}.gif`,
        Body: Buffer.from(gifData),
        ContentType: "image/gif",
      })
      .promise();
  } catch (error) {
    res.status(500).send({ error: "Internal Server Error" });
  }
  console.log(animationId);
  return res.send(animationId);
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME; // Set in .env

app.use(express.json());

app.get("/downloadYoutubeMp3", (req, res) => {
  const videoId = req.query.id; // Get videoId from query parameters
  if (!videoId) {
    return res.status(400).json({ message: "Missing video ID" });
  }

  const options = {
    method: "GET",
    hostname: "youtube-mp36.p.rapidapi.com",
    port: null,
    path: `/dl?id=${videoId}`,
    headers: {
      "x-rapidapi-key": "a46c05b9eemsh7415a239bc76990p177dd9jsn494f53bee41a",
      "x-rapidapi-host": "youtube-mp36.p.rapidapi.com",
    },
  };

  const request = http.request(options, (response) => {
    const chunks = [];

    response.on("data", (chunk) => {
      chunks.push(chunk);
    });

    response.on("end", () => {
      const body = Buffer.concat(chunks).toString();
      res.json({ message: "Download link received", data: JSON.parse(body) });
    });
  });

  request.on("error", (error) => {
    console.error(error);
    res.status(500).json({ message: "Error fetching download link" });
  });

  request.end();
});

// app.post("/uploadFile", checkJwt, upload.single("file"), async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ error: "No file uploaded." });
//     }

//     const fileContent = req.file.buffer;
//     const fileName = `uploads/${Date.now()}_${req.file.originalname}`;

//     const params = {
//       Bucket: "music-for-animatin",
//       Key: fileName,
//       Body: fileContent,
//       ContentType: req.file.mimetype,
//     };

//     const result = await s3.upload(params).promise();

//     res.json({ fileUrl: result.Location });
//   } catch (error) {
//     console.error("S3 Upload Error:", error);
//     res.status(500).json({ error: "Failed to upload file to S3" });
//   }
// });

const { Readable } = require("stream");

// Configure AWS S3

app.post("/uploadFile", checkJwt, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    console.log("File received:", req.file.originalname);
    console.log("File Buffer Size:", req.file.buffer.length);

    // 🚀 Step 1: Save Locally in Lambda
    const tempFilePath = `/tmp/test_upload.mp3`;
    fs.writeFileSync(tempFilePath, req.file.buffer);
    console.log("Saved file locally in Lambda:", tempFilePath);

    // Read back the file and compare first 20 bytes
    const testRead = fs.readFileSync(tempFilePath);
    console.log(
      "First 20 Bytes FROM DISK:",
      testRead.slice(0, 20).toString("hex")
    );

    // 🚀 Step 2: Upload to S3
    const fileBuffer = Buffer.from(req.file.buffer);
    console.log(
      "First 20 Bytes BEFORE Upload:",
      fileBuffer.slice(0, 20).toString("hex")
    );

    const fileName = `uploads/${Date.now()}_${req.file.originalname}`;

    const params = {
      Bucket: "music-for-animatin",
      Key: fileName,
      Body: fileBuffer, // 🚀 Direct buffer upload
      ContentType: "audio/mpeg",
      ContentEncoding: "binary",
      ContentDisposition: "attachment",
      CacheControl: "no-cache",
    };

    console.log("Uploading to S3...");
    const result = await s3.upload(params).promise();
    console.log("Upload successful:", result.Location);

    res.json({ fileUrl: result.Location });
  } catch (error) {
    console.error("S3 Upload Error:", error);
    res.status(500).json({ error: "Failed to upload file to S3" });
  }
});

// app.post("/uploadFile", checkJwt, upload.single("file"), async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ error: "No file uploaded." });
//     }

//     // Ensure the file is an MP3 based on extension (more reliable in Lambda)

//     console.log("File received:", req.file.originalname);
//     console.log("File Buffer Size:", req.file.buffer.length);

//     // Convert Buffer to Stream
//     const fileStream = Readable.from(req.file.buffer);

//     const fileName = `uploads/${Date.now()}_${req.file.originalname}`;

//     const params = {
//       Bucket: "music-for-animatin",
//       Key: fileName,
//       Body: fileStream,
//       ContentType: req.file.mimetype,
//     };

//     console.log("Uploading to S3...");
//     const result = await s3.upload(params).promise();
//     console.log("Upload successful:", result.Location);

//     res.json({ fileUrl: result.Location });
//   } catch (error) {
//     console.error("S3 Upload Error:", error);
//     res.status(500).json({ error: "Failed to upload file to S3" });
//   }
// });

exports.handler = serverlessExpress({ app });
