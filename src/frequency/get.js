const { DynamoDBDocument } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");

// List all the frequencies
export const getFrequencies = async (event) => {

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
  var frequencies = [];

  try {
    // Set parameters
    let params = {
      TableName: tableName,
      KeyConditionExpression: "PK = :PK",
      ExpressionAttributeValues: {
        ":PK": "FREQUENCIES"
      },
      ExpressionAttributeNames: {
        "#name": "name"
      },
      ProjectionExpression:"#name,enabled,frequency,SK,generation"
    };
    // Do query
    let freq = await docClient.query(params);
    frequencies = freq.Items;
    for (var frequency of frequencies) {
      frequency.id = frequency.SK.replace("FREQUENCY#","");
      delete frequency.SK;
      // Get the generation name
      var generation = {};
      var genParams = {
        TableName: tableName,
        Key: {
          "PK": "GENERATIONS",
          "SK": "GENERATION#" + frequency.generation
        }
      };
      try {
        let gen = await docClient.get(genParams);
        if (gen.Item) {
          gen.Item.id = gen.Item.SK.replace("GENERATION#","");
          delete gen.Item.SK;
          delete gen.Item.PK;
          generation = gen.Item;
          frequency.genName = generation.name;
        }
        else {
          message="Generation(s) not found";
          frequency.genName = "DELETED";
        }

      } catch (e) {
        console.log(e);
      }
    }
  } catch (e) {
    console.log(e);
    error = true;
    message = e;
    status = 500;
  }
  // Return the data
  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(
      {
        frequencies: frequencies,
        message: message,
        error: error
      },
      null,
      2
    ),
  };
};

// Get specific frequency
export const getFrequency = async (event) => {

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

  var frequency = {};
  var id = event.pathParameters.id;
  if (id ==""|| !id) {
    error = true;
    status = 500;
    message ="ID Cannot be empty";
  }

  if (!error) {
    var params = {
      TableName: tableName,
      Key: {
        "PK": "FREQUENCIES",
        "SK": "FREQUENCY#" + event.pathParameters.id
      }
    };
    try {
      let freq = await docClient.get(params);
      if (freq.Item) {
        freq.Item.id = freq.Item.SK.replace("FREQUENCY#","");
        delete freq.Item.SK;
        delete freq.Item.PK;
      }
      else {
        message="Frequency not found";
        status = 404;
      }
      frequency = freq.Item;
    } catch (e) {
      console.log(e);
      error = true;
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
        frequency: frequency,
        message: message,
        error: error
      },
      null,
      2
    ),
  };
};
