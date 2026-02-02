import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";
const ai = new GoogleGenAI({});

// TOOLS FOR CODE REVIWER

//tool1 which will list the files location
async function listFiles({ directory }) {
  const files = [];
  const extensions = [".js", ".jsx", ".ts", ".tsx", ".html", ".css"];

  function scan(dir) {
    const items = fs.readdirSync(dir); //apne child folder file ko point karega

    //path ka location dene ke liye
    for (const item of items) {
      const fullPath = path.join(dir, item);

      //skip nodemoduoles dist build
      if (
        fullPath.includes("node_modules") ||
        fullPath.includes("dist") ||
        fullPath.includes("build")
      )
        continue;

      const stat = fs.statSync(fullPath);
      //check directory hai ya file hai
      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (stat.isFile()) {
        const ext = path.extname(item);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  scan(directory);
  console.log(`found :${files.length} files`);
  return { files };
}

//TOOL 2 TO READ FILE AT LOCATION GIVEN
async function readFile({ file_path }) {
  try {
    const content = fs.readFileSync(file_path, "utf-8");
    console.log(`reading:${file_path}`);
    return { content };
  } catch (error) {
    console.error(`Error reading file: ${error.message}`);
    throw error;
  }
}

//tool 3 to write in file
async function writeFile({ file_path, content }) {
  try {
    fs.writeFileSync(file_path, content, "utf-8");
    console.log(`fixed:${file_path}`);
    return { success: true };
  } catch (error) {
    console.error(`Error writing file: ${error.message}`);
    throw error;
  }
}

//TOOL REGISTRY
// TOOL REGISTRY

const listFilesTool = {
  name: "listFiles",
  description:
    "Lists all code files (.js, .jsx, .ts, .tsx, .html, .css) in a directory recursively, skipping node_modules, dist, and build.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      directory: {
        type: Type.STRING,
        description:
          "The path of the directory to scan for files, e.g., './src' or '.'",
      },
    },
    required: ["directory"],
  },
};

const readFileTool = {
  name: "readFile",
  description: "Reads the content of a specific file from the given file path.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      file_path: {
        type: Type.STRING,
        description: "The full path of the file to be read.",
      },
    },
    required: ["file_path"],
  },
};

const writeFileTool = {
  name: "writeFile",
  description:
    "Writes or overwrites content into a file at the specified path. Used for fixing or updating code.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      file_path: {
        type: Type.STRING,
        description: "The path where the content should be written.",
      },
      content: {
        type: Type.STRING,
        description: "The actual string content to write into the file.",
      },
    },
    required: ["file_path", "content"],
  },
};

// Array to pass into the model tools config
const tools = [
  { functionDeclarations: [listFilesTool, readFileTool, writeFileTool] },
];

const toolFunctions = {
  listFiles: listFiles,
  readFile: readFile,
  writeFile: writeFile,
};
//MAIN FUNCTION

export async function runAgent(directoryPath) {
  console.log(`reviewing:${directoryPath}\n`);
  const History = [
    {
      role: "user",
      parts: [
        { text: `Review and fix all javascript code in :${directoryPath}` },
      ],
    },
  ];

  while (true) {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: History,
      config: {
        systemInstruction: `You are a Senior Full-Stack Code Reviewer and Security Expert.
Your goal is to audit the provided directory, identify bugs, logical errors, and security vulnerabilities (like XSS, SQL Injection, or insecure dependencies), and fix them.
Your Workflow:
1. **Analyze Structure**: Use 'listFiles' to understand the project layout.
2. **Read & Audit**: Use 'readFile' to examine the code of suspicious or core files.
3. **Plan Fixes**: Identify what needs to be changed.
4. **Execute Fixes**: Use 'writeFile' to apply the corrected code or 'executecommand' for terminal-based tasks (like installing security patches or deleting temporary files).
5. **Verify**: Ensure the changes don't break the existing logic.

Rules:
- Be precise. Only modify code that has issues.
- When fixing security issues, explain briefly why it was a risk.
- Use 'executecommand' only for file system operations or environment fixes. 
- You must work step-by-step. Don't try to fix everything in one giant command.

First, start by listing the files in the directory to see what we are working with.

at last give a detailed summary of what u have done in the changes`,

        tools: [
          {
            functionDeclarations: [listFilesTool, readFileTool, writeFileTool],
          },
        ],
      },
    });
    if (result.functionCalls && result.functionCalls?.length > 0) {
      //execute all function calls
      for (const functionCall of result.functionCalls) {
        const { name, args } = functionCall;
        console.log(`${name}`);
        const toolResponse = await toolFunctions[name](args);

        //add function call to history
        History.push({
          role: "model",
          parts: [{ functionCall }],
        });

        //add function reponse to history

        History.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name,
                response: { result: toolResponse },
              },
            },
          ],
        });
      }
    } else {
      console.log(result.text);
      History.push({
        role: "model",
        parts: [{ text: result.text }],
      });
      break;
    }
  }
}

const directory = process.argv[2] || ".";
await runAgent(directory);

