const { DynamoDBDocument } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const nanoid = require('nanoid');

export const createFrequency = async (event) => {

  // Parse and configure claims and data
  var status = 200;
  var error = false;
  var message = "ok";
  var result = {};

  // Configure DynamoDB
  const tableName = "settings-"+process.env.NODE_ENV;
  const dynamoClient = new DynamoDBClient({
    region: process.env.DYNAMODB_REGION,
    endpoint: process.env.DYNAMODB_ENDPOINT,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  });
  // Setup Dynamodb Client
  const docClient = DynamoDBDocument.from(dynamoClient);

  // Parse body
  let data = JSON.parse(event.body);
  console.log(data);
  // If some data is empty, reject it (shouldn't happen)
  if (data.generation == "" || !data.generation) {
    status = 500;
    error = true;
    message = "Missing parameters";
  }

  if(data.name == "" || !data.name){
    status = 500;
    error = true;
    message = "Missing parameters";
  }

  // If the generation does not exist, reject the creation
  var params = {
    TableName: tableName,
    Key: {
      "PK": "GENERATIONS",
      "SK": "GENERATION#" + data.generation
    }
  };
  try {
    let gen = await docClient.get(params);
    if (gen.Item) {
      gen.Item.id = gen.Item.SK.replace("GENERATION#","");
      delete gen.Item.SK;
      delete gen.Item.PK;
    }
    else {
      error = true;
      message="Generation not found";
      status = 404;
    }
  } catch (e) {
    error = true;
    status = 500;
    message = e;
    console.error(e);
  }

  if (!error){
    // Add the frequency to the db
    var frequency = {};
    try {
      let id = nanoid(6);
      let params = {
        TableName: tableName,
        Item: {
          PK: "FREQUENCIES",
          SK: "FREQUENCY#" + id,
          enabled: data.enabled,
          generation: data.generation,
          name: data.name
        }
      };
      frequency = await docClient.put(params);
      result = frequency;
    } catch (e) {
      console.error(e);
      message = "Error agregando frecuencia";
      error = e;
      status = 500;
    }
  }

  // Return the data
  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(
      {
        result: result,
        error: error,
        message: message
      },
      null,
      2
    ),
  };
};
