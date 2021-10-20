const { DynamoDBDocument} = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const { Client } = require('@opensearch-project/opensearch');

// Update an operator
export const updatePhone = async (event) => {

  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
  var error = false;
  var result = {};

  // Configure DynamoDB
  const tableName = "phones-"+process.env.NODE_ENV;
  const dynamoClient = new DynamoDBClient({
    region: process.env.DYNAMODB_REGION,
    endpoint: process.env.DYNAMODB_ENDPOINT,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  });
  const docClient = DynamoDBDocument.from(dynamoClient, {marshallOptions:{removeUndefinedValues:true}});

  // Configure OpenSearch
  var osClient = new Client({
    node: "https://" + process.env.OPENSEARCH_USER + ":" + process.env.OPENSEARCH_PASSWORD + "@" + process.env.OPENSEARCH_ENDPOINT
  });

  var data = JSON.parse(event.body);
  var id = event.pathParameters.id;

  console.log(id);
  console.log(data);

  try {
    let params = {
      TableName: tableName,
      Key: {
        PK: "PHONE#"+id,
        SK: "DATA"
      },
      UpdateExpression: "set #b = :b, #m = :m, #e = :e",
      ExpressionAttributeValues: {
        ":b": data.name,
        ":m": data.model,
        ":e": data.enabled,
        ":id": "PHONE#"+id
      },
      ExpressionAttributeNames: {
        "#b": "name",
        "#m": "webUrl",
        "#e": "enabled",
      },
      ReturnValues: "UPDATED_NEW",
      ConditionExpression: "PK=:id",
      RemoveUndefinedValues: "TRUE"
    };
    var operatorUpdate = await docClient.update(params);
    result = operatorUpdate;

    await osClient.update({
      index: 'phones',
      id: id,
      body: {
        doc: {
          'name': data.name,
          'model': data.model,
          'enabled': data.enabled
        }
      }
    });
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
        message: message,
        error: error
      },
      null,
      2
    ),
  };
};
