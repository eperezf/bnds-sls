const { DynamoDBDocument } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");

// Update a frequency
export const updateFrequency = async (event) => {

  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
  var error = false;
  var result = {};

  // Configure DynamoDB
  const tableName = "settings-"+process.env.NODE_ENV;
  const dynamoClient = new DynamoDBClient({
    region: process.env.DYNAMODB_REGION,
    endpoint: process.env.DYNAMODB_ENDPOINT,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  });
  const docClient = DynamoDBDocument.from(dynamoClient, {marshallOptions:{removeUndefinedValues:true}});
  var data = JSON.parse(event.body);
  var id = event.pathParameters.id;
  try {
    let params = {
      TableName: tableName,
      Key: {
        PK: "FREQUENCIES",
        SK: "FREQUENCY#" + id
      },
      UpdateExpression: "set #enabled = :enabled, #name = :name, #generation = :generation",
      ExpressionAttributeValues: {
        ":enabled": data.enabled,
        ":name": data.name,
        ":generation": data.generation,
        ":id": "FREQUENCY#" + id
      },
      ExpressionAttributeNames: {
        "#enabled": "enabled",
        "#name": "name",
        "#generation": "generation"
      },
      ReturnValues: "UPDATED_NEW",
      ConditionExpression:"SK=:id",
      RemoveUndefinedValues: "TRUE"
    };
    var generationUpdate = await docClient.update(params);
    result = generationUpdate;
  } catch (e) {
    console.error(e);
    if (e.name == "ConditionalCheckFailedException") {
      message = "Frequency not found";
      status = 404;
      error = true;
    }
    else {
      message = e;
      status = 500;
      error = true;
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
        result : result,
        message: message,
        error: error
      },
      null,
      2
    ),
  };
};
