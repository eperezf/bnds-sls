const { DynamoDBDocument } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const nanoid = require('nanoid');

// Create a generation
export const createGeneration = async (event) => {

  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
  var error = false;

  // Configure DynamoDB
  const tableName = "settings-"+process.env.NODE_ENV;
  const dynamoClient = new DynamoDBClient({
    region: process.env.DYNAMODB_REGION,
    endpoint: process.env.DYNAMODB_ENDPOINT,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  });
  const docClient = DynamoDBDocument.from(dynamoClient);
  console.log(event);
  var data = JSON.parse(event.body);
  let params = {
    TableName: tableName,
    Item: {
      PK: "GENERATIONS",
      SK: "GENERATION#"+nanoid(6),
      name: data.name,
      enabled: data.enabled
    }
  };
  var genData = {};
  try {
    genData = await docClient.put(params);
  } catch (e) {
    console.log(e);
    error = true;
    status = 500;
    message = e;
  }

  // Return the data
  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(
      {
        result: genData,
        message: message,
        error: error
      },
      null,
      2
    ),
  };
};
