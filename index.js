import axios from "axios";
import { GoogleGenAI, Type } from "@google/genai";
import { exec } from "child_process";
import util from "util";
import dotenv from "dotenv";
dotenv.config();
import readlineSync from "readline-sync";
import os from "os";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const plateform = os.platform();
const execute = util.promisify(exec);
const ai = new GoogleGenAI({});

//tool jo command ko execute krega
async function executecommand({ command }) {
  try {
    const { stdout, stderr } = await execute(command);
    //agar command execution me koi err aya wo stderr me jayega
    if (stderr) {
      return `error:${stderr}`;
    }

    return `sucess:${stdout}`;
  } catch (error) {
    //command hi galat thi
    return `error ${error}`;
  }
}

const commandexecuter = {
  name: "executecommand",
  description:
    "it take any shell/terminal command and execute it. it will help us to create read ,update, and write and delete any file or folder",
  parameters: {
    type: Type.OBJECT,
    properties: {
      command: {
        type: Type.STRING,
        description:
          "it will  be the shell /terminal command,:ex:create a calculator ,touch calculator/index.js etc",
      },
    },
    required: ["command"],
  },
};

const History = [];

async function buildwebsite() {
 
  while (true) {
    // ⏳ Add a 1.5 second delay between API calls to avoid rate limits
    await sleep(1500);
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: History,
      config: {
        systemInstruction: `you are a website builder ,which will build frontend part of website requested by user you will use terminal/shell command ,you will give shell/terminal command one by one and our tool will execute it ,give command according to the operating system we are using ,my current operating system is:${plateform}
        kindly use best practise for commands,it should use multiline  write alsoeffeciently.
        
        what is your job:
        first analyse user query ,
        take necessry action after analyses of query by giving proper command acording to user operating system 
        step by step 
        1:first you have to create a folder for website which we have to create ,ex:mkdir calculator
        2:give terminal/shell command to create html file ,ex:touch calculator/index.html
     
        3:give terminal/shell command to write on  html file
    
        4:fix the error if they are present at any step by writing update or delet`,

        tools: [
          {
            functionDeclarations: [commandexecuter],
          },
        ],
      },
    });

    if (result.functionCalls && result.functionCalls.length > 0) {
      const modelPart = result.candidates[0].content.parts[0];

      const functionCall = result.functionCalls[0];

      const { name, args } = functionCall;

      const toolResponse = await executecommand(args);

      const functionResponsePart = {
        name: functionCall.name,
        response: {
          result: toolResponse,
        },
      };

      // Send the function response back to the model.
      History.push({
        role: "model",
        parts: [modelPart],
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
      History.push({
        role: "model",
        parts: [{ text: result.text }],
      });
      break;
    }
  }
}

while (true) {
  const query = readlineSync.question("ask me anything:");

  if (query == "exit") {
    break;
  }
  History.push({
    role: "user",
    parts: [{ text: query }],
  });
  await buildwebsite();
}
