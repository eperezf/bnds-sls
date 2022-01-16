const { DynamoDBDocument } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const { Client } = require('@opensearch-project/opensearch');
const axios = require('axios').default;

export const compare = async (event) => {
  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
  var error = false;
  const data = JSON.parse(event.body);

  let tableName = "settings-"+process.env.NODE_ENV;
  const dynamoClient = new DynamoDBClient({
    region: process.env.DYNAMODB_REGION,
    endpoint: process.env.DYNAMODB_ENDPOINT,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  });
  const docClient = DynamoDBDocument.from(dynamoClient);

  // First check if the captcha is correct. If not, save resources.
  try {
    var captchaRes = await axios.post(`https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${data.token}`);
  } catch (e) {
    console.error(e);
    error = true;
    message = e;
    status = 500;
  }

  // Check that captcha result is OK, operator is a valid ID and phone has content.
  if (!captchaRes.data.success) {
    error = true;
    message = "Captcha error";
    status = 403;
  }

  if (data.operator.length!= 6) {
    error = true;
    message = "Invalid operator";
    status = 500;
  }

  if (data.phone == "") {
    error = true;
    message = "Empty phone";
    status = 500;
  }

  // Put everything in res
  var res = {};

  if (captchaRes.data.success && !error) {
    // Each query consumes 0.5 read capacity units. 1 scan consume 2 read capacity units. It's better to do 3 queries than 1 scan.
    // There is a way of doing 3 async functions at the same time with await but for now we will do it sequentally.

    // Declare "params" for all the queries and other variables
    var params = {};
    var phones = [];
    var operator = {};
    var phone = {};
    var variant = {};
    var technologies = [];
    var generations = [];
    var frequencies = [];
    var exactMach = false;

    if (!error) {
      // Get the operator
      tableName = "operators-"+process.env.NODE_ENV;
      params = {
        TableName: tableName,
        Key: {
          "PK": "OPERATORS",
          "SK": "OPERATOR#" + data.operator
        }
      };
      try {
        let op = await docClient.get(params);
        if (!op.Item) {
          throw "Operator not found";
        }
        op.Item.id = op.Item.SK.replace("OPERATOR#","");
        delete op.Item.SK;
        delete op.Item.PK;
        operator = op.Item;
        // Put operator data
        res.operator = {
          name: operator.name,
          url: operator.webUrl,
          image: operator.id+".png"
        };
      } catch (e) {
        error = true;
        status = 500;
        message = e;
        console.error(e);
      }
    }

    if (!error) {
      // Get the phone in OpenSearch
      // Configure OpenSearch
      var client = new Client({
        node: "https://" + process.env.OPENSEARCH_USER + ":" + process.env.OPENSEARCH_PASSWORD + "@" + process.env.OPENSEARCH_ENDPOINT
      });
      // Configure the query
      params = {
        index: process.env.OPENSEARCH_VARIANT_INDEX,
        body: {
          "query": {
            "bool": {
              "must": [
                {
                  "match": {
                    "fullName": {
                      "query": data.phone,
                      "analyzer": "pattern"
                    }
                  }
                },
                {
                  "term": {
                    "enabled": {
                      "value": true
                    }
                  }
                }
              ]
            }
          }
        },
        size:5
      };
      try {
        // Search for the document.
        var response = await client.search(params);
        if (response.body.hits.hits.length == 0) {
          throw "Phone not found";
        }
        // Push them to the array
        for (var hit of response.body.hits.hits) {
          phones.push({name:hit._source.fullName, phoneId: hit._source.phone, variantId: hit._id});
        }
        // Check if it's an exact match
        if (phones[0].name == data.phone) {
          exactMach = true;
        }
      } catch (e) {
        console.error(e);
        console.log("query: "+data.phone);
        status = 500;
        error = true;
        message = e;
      }
    }

    if (!error) {
      // Get phone in DynamoDB
      tableName = "phones-"+process.env.NODE_ENV;
      params = {
        TableName: tableName,
        Key: {
          "PK": "PHONE#"+phones[0].phoneId,
          "SK": "DATA"
        }
      };
      try {
        var result = await docClient.get(params);
        phone = result.Item;
      } catch (e) {
        console.error(e);
        status = 500;
        error = true;
        message = e;
      }
    }

    if (!error) {
      // Get variant in DynamoDB
      tableName = "phones-"+process.env.NODE_ENV;
      params = {
        TableName: tableName,
        Key: {
          "PK": "PHONE#"+phones[0].phoneId,
          "SK": "VARIANT#"+phones[0].variantId
        }
      };
      try {
        let result = await docClient.get(params);
        variant = result.Item;
      } catch (e) {
        console.error(e);
        status = 500;
        error = true;
        message = e;
      }
    }

    if (!error) {
      // Get all the technologies
      tableName = "settings-"+process.env.NODE_ENV;
      params = {
        TableName: tableName,
        KeyConditionExpression: "PK = :PK",
        ExpressionAttributeValues: {
          ":PK": "TECHNOLOGIES",
        },
        ExpressionAttributeNames: {
          "#name": "name"
        },
        ProjectionExpression:"#name,enabled,frequency,SK"
      };
      try {
        let gen = await docClient.query(params);
        technologies = gen.Items;
        // Delete the SK, change the PK
        for (var technology of technologies) {
          technology.id = technology.SK.replace("TECHNOLOGY#","");
          delete technology.SK;
        }
        // Delete the disabled ones
        technologies = technologies.filter(item => item.enabled !== false);
      } catch (e) {
        console.error(e);
        error = true;
        message = e;
        status = 500;
      }
    }

    if (!error) {
      // Get all the generations
      tableName = "settings-"+process.env.NODE_ENV;
      params = {
        TableName: tableName,
        KeyConditionExpression: "PK = :PK",
        ExpressionAttributeValues: {
          ":PK": "GENERATIONS",
        },
        ExpressionAttributeNames: {
          "#name": "name"
        },
        ProjectionExpression:"#name,enabled,frequency,SK"
      };
      try {
        let gen = await docClient.query(params);
        generations = gen.Items;
        for (var generation of generations) {
          generation.id = generation.SK.replace("GENERATION#","");
          delete generation.SK;
        }
        generations = generations.filter(item => item.enabled !== false);
      } catch (e) {
        console.error(e);
        error = true;
        message = e;
        status = 500;
      }
    }

    if (!error) {
      // Get all the frequencies
      tableName = "settings-"+process.env.NODE_ENV;
      params = {
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
      try {
        let freq = await docClient.query(params);
        frequencies = freq.Items;
        for (var frequency of frequencies) {
          frequency.id = frequency.SK.replace("FREQUENCY#","");
          delete frequency.SK;
        }
        frequencies = frequencies.filter(item => item.enabled !== false);
      } catch (e) {
        console.error(e);
        error = true;
        message = e;
        status = 500;
      }
    }

    if (!error) {
      // Put phone data
      res.phone = {
        brand: phone.brand,
        model: phone.model,
        phoneComment: phone.comment,
        variant: variant.name,
        review: phone.review,
        variantComment: variant.comment,
        image: phones[0].phoneId+".png",
        exactMach: exactMach
      };

      // Set technology array
      res.technologies = {};
      res.technologies.list = [];
      res.technologies.result = "success";

      // Put technology data and check for compatibility result
      let both = 0;
      let opOnly = 0;
      let none = 0;
      for (var tech of technologies) {
        let techvar = {
          name: tech.name
        };
        if (variant.technologies.includes(tech.id)) {
          techvar.phone = true;
        } else {
          techvar.phone = false;
        }
        if (operator.technologies.includes(tech.id)) {
          techvar.operator = true;
        } else {
          techvar.operator = false;
        }
        if (techvar.phone && techvar.operator) {
          both +=1;
        } else if (!techvar.phone && techvar.operator) {
          opOnly +=1;
        }  else {
          none +=1;
        }
        res.technologies.list.push(techvar);
      }
      if (both == 0) {
        res.technologies.result = "error";
      }
      if (opOnly > 0) {
        res.technologies.result = "partial";
      }
      if (opOnly == 0 && none == 0) {
        res.technologies.result = "success";
      }

      // Set generations (and frequencies) array
      res.generations = [];

      // Put generations
      for (var gen of generations) {
        res.generations.push({name: gen.name, result:'success', frequencies:[], id: gen.id});
      }

      // Sort the generations
      res.generations.sort((a,b) => (a.name>b.name?1:-1));

      // Put frequencies
      for (var freq of frequencies) {
        if (variant.frequencies.includes(freq.id)) {
          freq.phone = true;
        } else {
          freq.phone = false;
        }
        if (operator.frequencies.some(e => e.id === freq.id)){
          freq.operator = true;
        } else {
          freq.operator = false;
        }

        // Put frequencies on each generation only if the operator has it
        var correspondingGen = res.generations.find(o => o.id === freq.generation);
        if (freq.operator) {
          correspondingGen.frequencies.push(freq);
        }
      }

      // Check generations again for total/partial/no compatibility
      for (var ge of res.generations) {
        if (ge.frequencies.length == 0) {
          ge.result = 'nofreq';
        } else {
          // Check if all the phone frequencies are compatible.
          var phoneTotalSuccess = ge.frequencies.every(obj => obj.phone);
          // If not all are compatible, check if any are compatible
          if (!phoneTotalSuccess) {
            var phonePartialSuccess = ge.frequencies.some(obj => obj.phone);
            if (!phonePartialSuccess) {
              ge.result = 'error';
            } else {
              ge.result = 'partial';
            }
          }
        }
      }

      // Clean up IDs and other stuff
      for (var g of res.generations) {
        delete g.id;
        for (var f of g.frequencies) {
          delete f.enabled;
          delete f.id;
          delete f.generation;
        }
      }
    }
  }

  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(
      {
        response: res,
        message: message,
        error: error
      },
      null,
      2
    ),
  };

};
