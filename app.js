import axios from "axios";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();
import readlineSync from "readline-sync";
import { type } from "os";

const ai = new GoogleGenAI({});
//tools the server have

async function getcoin({ coin }) {
  let res = await axios.get(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=inr&ids=${coin}`,
  );
  let result = res.data;
  //   console.log(result);
  return result;
}

async function getweather({ city }) {
  let res = await axios.get(
    `http://api.weatherapi.com/v1/current.json?key=4ef22692ba054e65b3831925263001&q=${city}&aqi=no`,
  );
  let result = res.data;
  return result;
}

async function getleet({ username }) {
  let res = await axios.get(
    `https://leetcode-api-faisalshohag.vercel.app/${username}`,
  );

  let result = res.data;
  return result;
}
//agent ko batana hai ki hamre pass tools hain
const cryptoinfo = {
  name: "getcoin",
  description: " we can give the live info about cryptocurrency ",
  parameters: {
    type: Type.OBJECT,
    properties: {
      coin: {
        type: Type.STRING,
        description:
          "it will  be the name of cryptocurrency like bitcoin ethreum",
      },
      //   curr: {
      //     type: Type.STRING,
      //     description:
      //       "it will  be the name of real currency  like inr ,if the user not provide it by default it will be inr",
      //   },
    },
    required: ["coin"],
  },
};
//tool2
const weatherinfo = {
  name: "getweather",
  description: " we can give the live info about city weather ",
  parameters: {
    type: Type.OBJECT,
    properties: {
      city: {
        type: Type.STRING,
        description:
          "it will  be the name of city forwhich the weather is to be fetched",
      },
    },
    required: ["city"],
  },
};

const leetinfo = {
  name: "getleet",
  description:
    " we can give the info about user leetcode profile based on username ",
  parameters: {
    type: Type.OBJECT,
    properties: {
      username: {
        type: Type.STRING,
        description:
          "it will  be the name of user  for which the profile is to be fetched",
      },
    },
    required: ["username"],
  },
};

const tools = [
  {
    functionDeclarations: [cryptoinfo, weatherinfo, leetinfo],
  },
];

const toolFunctions = {
  getcoin: getcoin,
  getweather: getweather,
  getleet: getleet,
};

const History = [];

async function runagent() {
  while (true) {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: History,
      config: { tools },
    });
    //kya koi function call karna hai
    if (result.functionCalls && result.functionCalls.length > 0) {
      const functionCall = result.functionCalls[0];

      const { name, args } = functionCall;

      if (!toolFunctions[name]) {
        throw new Error(`Unknown function call: ${name}`);
      }

      // Call the function and get the response.
      const toolResponse = await toolFunctions[name](args);

      const functionResponsePart = {
        name: functionCall.name,
        response: {
          result: toolResponse,
        },
      };

      // Send the function response back to the model.
      History.push({
        role: "model",
        parts: [
          {
            functionCall: functionCall,
          },
        ],
      });
      History.push({
        role: "user",
        parts: [
          {
            functionResponse: functionResponsePart,
          },
        ],
      });
    }
    //agar function nhi call karna hai to wahi answer hoga
    else {
      console.log(result.text);
      break;
    }
  }
}

while (true) {
  const query = readlineSync.question("ask me anything:");

  if (query == "exit") {
    break;
  } else {
    History.push({
      role: "user",
      parts: [{ text: query }],
    });
    await runagent();
  }
}
