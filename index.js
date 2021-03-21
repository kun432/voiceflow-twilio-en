'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const { default: RuntimeClientFactory, TraceType } = require("@voiceflow/runtime-client-js");
const {randomBytes} = require('crypto')
const config = require("./config.json");

function generateId(length) {
  return randomBytes(length).reduce((p, i) => p + (i % 32).toString(32), '')
}

// create config from env variables
const vfconfig = {
  versionID: process.env.VF_VERSION_ID,
  apiKey: process.env.VF_API_KEY,
};

// mock database
const mockDatabase = {};
const db = {
    read: async (userID) => mockDatabase[userID],
    insert: async (userID, state) => mockDatabase[userID] = state,
    delete: async (userID) => delete mockDatabase[userID]
};

const runtimeClientFactory = new RuntimeClientFactory(config);
const app = express();
app.use(bodyParser.json());

// register a webhook handler with middleware
// about the middleware, please refer to doc
app.post('/voice', async (req, res) => {

  console.log("===== REQ ===== \n" + JSON.stringify(req.body, null, 2));

  let { userId } = req.body;
  const { userInput } = req.body;

  if (!userId) {
    userId = generateId(32);
  }
  console.log('userId: ' + userId)

  const state = await db.read(userId);
  const client = runtimeClientFactory.createClient(state); 
  const context = await client.sendText(userInput)

  console.log("===== CONTEXT from VF ===== \n" + JSON.stringify(context.getTrace(), null, 2));

  let isEnd;
  if (context.isEnding()) {
    db.delete(userId);
    isEnd = 1;
  } else {
      await db.insert(userId, context.toJSON().state);
  }

  const message = context.getTrace()
    .filter(({ type }) => type === TraceType.SPEAK)
    .map(({ payload }) => payload.message)
    .join("");
  
  const response = { userId: userId, message: message, isEnd: isEnd };

  console.log("===== RES ===== \n" + JSON.stringify(response, null, 2));
  res.send(response);
});

// listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
