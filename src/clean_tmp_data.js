const AWS = require("aws-sdk")
AWS.config.update({region:'eu-central-1'});

var dynamodb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
var documentClient = new AWS.DynamoDB.DocumentClient();

const dynamodbTableName = 'animations';

const s3 = new AWS.S3()