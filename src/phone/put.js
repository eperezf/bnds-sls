const { DynamoDBDocument} = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const { Client } = require('@opensearch-project/opensearch');
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

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

  // Configure S3
  const S3client = new S3Client();

  var data = JSON.parse(event.body);
  var id = event.pathParameters.id;
  if (!data.review) {
    data.review = "";
  }
  try {
    let params = {
      TableName: tableName,
      Key: {
        PK: "PHONE#"+id,
        SK: "DATA"
      },
      UpdateExpression: "set #b = :b, #m = :m, #r = :r, #e = :e",
      ExpressionAttributeValues: {
        ":b": data.brand,
        ":m": data.model,
        ":r": data.review,
        ":e": data.enabled,
        ":id": "PHONE#"+id
      },
      ExpressionAttributeNames: {
        "#b": "brand",
        "#m": "model",
        "#r": "review",
        "#e": "enabled",
      },
      ReturnValues: "UPDATED_NEW",
      ConditionExpression: "PK=:id",
      RemoveUndefinedValues: "TRUE"
    };
    var operatorUpdate = await docClient.update(params);
    result = operatorUpdate;

    await osClient.update({
      index: process.env.OPENSEARCH_PHONE_INDEX,
      id: id,
      body: {
        doc: {
          'brand': data.brand,
          'model': data.model,
          'fullName': data.brand + " " + data.model,
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

  // Try update the variants
  try {
    await osClient.update_by_query({
      index: process.env.OPENSEARCH_VARIANT_INDEX,
      body: {
        "query": {
          "term": {
            "phone.keyword": id
          }
        },
        "script": {
          "params": {
            "brand": data.brand,
            "model": data.model
          },
          "source": `
            ctx._source.brand = params.brand;
            ctx._source.model = params.model;
            ctx._source.fullName = params.brand + ' ' + params.model + ' ' + ctx._source.variant;
          `
        }
      }
    });
  } catch (e) {
    console.log(e);
    message = e;
    error = true;
    status = 500;
  }

  // Try to create signed URL for S3
  try {
    // Create the S3 command
    const command = new PutObjectCommand({
      Bucket:process.env.AWS_S3_BUCKET_NAME,
      Key:"phones/"+id+".png",
      ACL: 'public-read'
    });
    // Get the signed URL
    const url = await getSignedUrl(S3client, command, {expiresIn: 600});
    result.uploadUrl=url;
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
        result : result,
        message: message,
        error: error
      },
      null,
      2
    ),
  };
};
