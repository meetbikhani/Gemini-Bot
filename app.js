const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();
const readline = require("readline-sync");

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

async function check_hotel(name) {
  return `Yes, the hotel '${name}' is available.`;
}

async function get_date() {
  // in dd/mm/yyyy format
  const currentDate = new Date().toLocaleDateString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return currentDate;
}

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-pro",
  systemInstruction: `
    You are a chatbot for the Stay Heaven website, which is a hotel booking platform. 
    Your task is to greet the user and call the "check_hotel" function if the user queries about booking a hotel and pass hotel name as argument.
    ask for check-in and check-out dates and validate them. 
    Check-in must not be greater than the check-out date, and both should not be equal. 
    Then call the "get_date" function to get the current date and ensure check-in and check-out dates are valid.
    Also, take the number of guests, guest names, and phone number.
  `,
  tools: [
    {
      functionDeclarations: [
        {
          name: "check_hotel",
          description: "Tells whether a hotel is available or not.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
            required: ["name"],
          },
        },
        {
          name: "get_date",
          description: "Tells the current date.",
        },
      ],
    },
  ],
});

const generationConfig = {
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

let history = [];

async function run(userInput, isUserInput = true) {
  if (isUserInput) {
    history.push({ role: "user", parts: [{ text: userInput }] });
  }

  const chatSession = model.startChat({
    generationConfig,
    history: history,
  });

  try {
    const result = await chatSession.sendMessage(userInput);

    if (result.response?.candidates?.length > 0) {
      const candidate = result.response.candidates[0];
      if (candidate.content?.parts[0]?.text) {
        console.log(candidate.content.parts[0]?.text);

        // Add AI response to history
        history.push({
          role: "model",
          parts: [{ text: candidate.content.parts[0]?.text }],
        });
      }

      for (const part of candidate.content.parts) {
        if (part.functionCall) {
          const { name: functionName, args } = part.functionCall;
          console.log(`Function called: ${functionName}`, args);

          try {
            let response;

            if (functionName === "check_hotel") {
              response = await check_hotel(args.name);
            } else if (functionName === "get_date") {
              response = await get_date();
            } else {
              response = "Unknown function call.";
            }

            // Correct history push for function response
            history.push({
              role: "function",
              parts: [
                {
                  functionResponse: {
                    name: functionName,
                    response: response,
                  },
                },
              ],
            });

            // Let the model continue processing with the response
            await run(response, false);
          } catch (error) {
            console.error(`Error in function ${functionName}:`, error.message);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error during API call:", error.message);
  }
}

async function main() {
  while (true) {
    const userInput = readline.question("Enter your message: ");
    await run(userInput, true);
  }
}

main();
