'use strict';
const { DynamoDBDocument, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const nanoid = require ('nanoid');

// Update an operator
module.exports.updateOperator = async (event) => {

  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
  var error = false;
  var result = {};

  // Configure DynamoDB
  const tableName = "operators-"+process.env.NODE_ENV;
  const dynamoClient = new DynamoDBClient({
    region: process.env.DYNAMODB_REGION,
    endpoint: process.env.DYNAMODB_ENDPOINT,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  });
  const docClient = DynamoDBDocument.from(dynamoClient, {marshallOptions:{removeUndefinedValues:true}});
  var data = JSON.parse(event.body);
  var id = event.pathParameters.id;

  console.log(id);
  console.log(data);

  try {
    let params = {
      TableName: tableName,
      Key: {
        PK: "OPERATORS",
        SK: "OPERATOR#"+id
      },
      UpdateExpression: "set #n = :n, #u = :u, #e = :e, #t = :t, #f = :f",
      ExpressionAttributeValues: {
        ":n": data.name,
        ":u": data.webUrl,
        ":e": data.enabled,
        ":t": data.technologies,
        ":f": data.frequencies,
        ":id": "OPERATOR#"+id
      },
      ExpressionAttributeNames: {
        "#n": "name",
        "#u": "webUrl",
        "#e": "enabled",
        "#t": "technologies",
        "#f": "frequencies",
      },
      ReturnValues: "UPDATED_NEW",
      ConditionExpression: "SK=:id",
      RemoveUndefinedValues: "TRUE"
    };
    var operatorUpdate = await docClient.update(params);
    result = operatorUpdate;
  } catch (e) {
    console.log(e);
    message = e;
    status = 500;
    error = true;
  }

  // Return the data
  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(
      {
        result : result,
        message: message
      },
      null,
      2
    ),
  };
};
