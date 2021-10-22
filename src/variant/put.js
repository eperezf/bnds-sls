const { DynamoDBDocument} = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
//const { Client } = require('@opensearch-project/opensearch');

// Update a variant
export const updateVariant = async (event) => {

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
  //var osClient = new Client({
  //  node: "https://" + process.env.OPENSEARCH_USER + ":" + process.env.OPENSEARCH_PASSWORD + "@" + process.env.OPENSEARCH_ENDPOINT
  //});

  var data = JSON.parse(event.body);
  var phoneId = event.pathParameters.phoneId;
  var variantId = event.pathParameters.variantId;

  try {
    let params = {
      TableName: tableName,
      Key: {
        PK: "PHONE#"+phoneId,
        SK: "VARIANT#"+variantId
      },
      UpdateExpression: "set #n = :n, #u = :u, #e = :e, #t = :t, #f = :f",
      ExpressionAttributeValues: {
        ":n": data.name,
        ":e": data.enabled,
        ":t": data.technologies,
        ":f": data.frequencies,
        ":id": "VARIANT#"+variantId
      },
      ExpressionAttributeNames: {
        "#n": "name",
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
    /*
    await osClient.update({
      index: 'variants',
      id: id,
      body: {
        doc: {
          'brand': data.brand,
          'model': data.model,
          'enabled': data.enabled
        }
      }
    });
    */

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
