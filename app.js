const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");
require("dotenv").config();
const readline = require("readline-sync");


const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

async function check_hotel(name) {
  return "yes available";
}


const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction: `
  You are a chatbot for Stay Heaven website, which is a hotel booking platform. Your task it to greet the user and call the "check_hotel" function if the user queries to book a hotel.
  `,

  tools: [
    {
      functionDeclarations: [
        {
          name: "check_hotel",
          description: "tells whether hotel is available or not",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string"
              }
            }
          }
        }
      ]
    }
  ],
});

const generationConfig = {
  temperature: 2,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

let history = [];

async function run(userInput) {
  history.push({ role: "user", parts: [{ text: userInput }] });

  const chatSession = model.startChat({
    generationConfig,
    history: history,
  });

  const result = await chatSession.sendMessage(userInput);

  if (result.response?.candidates?.length > 0) {
    const candidate = result.response.candidates[0];
    console.log(candidate.content.parts[0].text)
    history.push({ role: "model", parts: [{ text: candidate.content.parts[0].text}] });

    for (const part of candidate.content.parts) {
      if (part.functionCall) {
        const { name: functionName, args } = part.functionCall;
        console.log(functionName,args);
        try {
          let response;
          if (functionName === "login") {
            response = await login();
          } else if (functionName === "check_hotel") {
            response = await check_hotel(args.name);
          } else if (functionName === "getdate") {
            response = await getdate();
          } else if (functionName === "book_hotel") {
            const { name, "checkin date": checkinDate, "checkout date": checkoutDate, "guest number": guestNumber, "guest details": guestDetails, rooms } = args;
            response = await book_hotel(name, checkinDate, checkoutDate, guestNumber, guestDetails, rooms);
          } else {
            response = "Unknown function call.";
          }
          

          console.log(response);
          const functionResponseParts = [
            {
              functionResponse: {
                name: functionName,
                response: {name: functionName, content: response},
              },
            },
          ];
          history.push({ role: "function", parts: functionResponseParts });

          try {
            const updatedChatSession = model.startChat({
              generationConfig,
              history,
            });
            const updatedResult = await updatedChatSession.sendMessage(response);
            history.push({ role: "model", parts: [{ text: updatedResult.response.candidates[0].content.parts[0].text || "No response content available" }] });
          } catch (error) {
            console.log("mai ERRRR HU", error);
          }

        } catch (error) {
          console.error(`Error in function ${functionName}:`, error.message);
        }
      }
    }
  }
}


async function main() {
  while (true) {
    const userInput = readline.question("Enter your message: ");
    await run(userInput);
  }
}

main();
