const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const vscode = require('vscode');

// dynamic import
async function loadOpenAI() {
  const { default: OpenAI } = await import('openai');
  return OpenAI;
}

async function getOpenAIInstance() {
  const OpenAI = await loadOpenAI();
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY  // 读取环境变量中的 API Key
  });
}



async function getAIResponse(codeSnippet) {
  try {
    const openai = await getOpenAIInstance();
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that checks code for errors.' },
        { role: 'user', content: `Check the following code for errors:\n\n${codeSnippet}` }
      ],
      max_tokens: 100,
      temperature: 0.7,
    });
    console.log("API Response:", response);
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return 'Failed to get response from OpenAI';
  }
}




function activate(context) {
  console.log('Extension "programming-grammarly" is now active!');


  let helloCommand = vscode.commands.registerCommand('programming-grammarly.helloWorld', function () {
    vscode.window.showInformationMessage('Hello World from Programming Grammarly!');
  });


  let checkCodeCommand = vscode.commands.registerCommand('programming-grammarly.checkCode', function () {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const code = editor.document.getText();
      getAIResponse(code).then((aiSuggestion) => {
        vscode.window.showInformationMessage(`AI Suggestion: ${aiSuggestion}`);
      });
    } else {
      vscode.window.showInformationMessage('No active editor found.');
    }
  });


  context.subscriptions.push(helloCommand);
  context.subscriptions.push(checkCodeCommand);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
