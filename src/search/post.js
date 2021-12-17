const { DynamoDBDocument } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const { Client } = require('@opensearch-project/opensearch');

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

  // Each query consumes 0.5 read capacity units. 1 scan consume 2 read capacity units. It's better to do 3 queries than 1 scan.
  // There is a way of doing 3 async functions at the same time with await but for now we will do it sequentally.

  // Get all the technologies
  var technologies = [];
  let params = {
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

  // Get all the generations
  var generations = [];
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

  // Get all the frequencies
  var frequencies = [];
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

  // Get the operator
  tableName = "operators-"+process.env.NODE_ENV;
  var operator = {};
  params = {
    TableName: tableName,
    Key: {
      "PK": "OPERATORS",
      "SK": "OPERATOR#" + data.operator
    }
  };
  try {
    let op = await docClient.get(params);
    op.Item.id = op.Item.SK.replace("OPERATOR#","");
    delete op.Item.SK;
    delete op.Item.PK;
    operator = op.Item;
  } catch (e) {
    error = true;
    status = 500;
    message = e;
    console.error(e);
  }

  // Get the phone (this one is a bit more tricky)
  var phones = [];
  // Configure OpenSearch
  var client = new Client({
    node: "https://" + process.env.OPENSEARCH_USER + ":" + process.env.OPENSEARCH_PASSWORD + "@" + process.env.OPENSEARCH_ENDPOINT
  });

  // Configure the query
  params = {
    index: process.env.OPENSEARCH_VARIANT_INDEX,
    body: {
      'query': {
        'bool': {
          'must': [
            {
              'match': {
                'fullName': {
                  'query': data.phone,
                  'analyzer': 'standard'
                }
              }
            },
            {
              term: {"enabled": true}
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
    for (var hit of response.body.hits.hits) {
      phones.push({name:hit._source.fullName, phoneId: hit._source.phone, variantId: hit._id});
    }
  } catch (e) {
    console.error(e);
    status = 500;
    error = true;
    message = e;
  }

  // Check if it's an exact match
  let exactMach = false;
  if (phones[0].name == data.phone) {
    exactMach = true;
  }

  // Search phone and variant in DynamoDB
  let phone = {};
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

  let variant = {};
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

  // Put everything in res
  let res = {};

  // Put phone data
  res.phone = {
    brand: phone.brand,
    model: phone.model,
    variant: variant.name,
    review: phone.review,
    image: phones[0].phoneId+".png",
    exactMach: exactMach
  };

  // Put operator data
  res.operator = {
    name: operator.name,
    url: operator.webUrl,
    image: operator.id+".png"
  };

  // Set technology array
  res.technologies = [];

  // Put technology data
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
    res.technologies.push(techvar);
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

    // Put frequencies on each generation
    var correspondingGen = res.generations.find(o => o.id === freq.generation);
    correspondingGen.frequencies.push(freq);


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

  console.log(res.generations);

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
