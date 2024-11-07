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
    apiKey: process.env.OPENAI_API_KEY
  });
}

// detect error
async function detectErrors(codeSnippet) {
  try {
    const openai = await getOpenAIInstance();
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are an assistant that only detects if there are any errors in the code, without providing any detailed suggestion.' },
        { role: 'user', content: `Does the following code contain any errors? Reply with "Yes" or "No" only:\n\n${codeSnippet}` }
      ],
      max_tokens: 5,
      temperature: 0.5,
    });
    const answer = response.choices[0].message.content.trim();
    return answer.toLowerCase() === 'yes';
  } catch (error) {
    console.error('Error detecting code errors:', error);
    return false;
  }
}

// get AI response
async function getAIResponse(codeSnippet) {
  try {
    const openai = await getOpenAIInstance();
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that checks code for errors and provides suggestions.' },
        { role: 'user', content: `Check the following code for errors and provide suggestions:\n\n${codeSnippet}` }
      ],
      max_tokens: 100,
      temperature: 0.7,
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return 'Failed to get response from OpenAI';
  }
}

// show error and AI response in Webview
async function showSuggestionInWebview(context, codeSnippet) {
  const hasErrors = await detectErrors(codeSnippet);

  // Create and show a new webview panel
  const panel = vscode.window.createWebviewPanel(
    'aiSuggestion', // Identifies the type of the webview. Used internally
    'AI Suggestion', // Title of the panel displayed to the user
    vscode.ViewColumn.Beside, // Show the new webview beside the current editor
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  // Custom HTML content for the Webview
  panel.webview.html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          height: 100vh;
          background-color: #333;
          display: flex;
          align-items: flex-end;
          justify-content: flex-start;
        }
        .container {
          max-width: 300px;
          padding: 20px;
          background: #1e1e1e;
          color: #ffffff;
          border-radius: 12px;
          box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.5);
          margin: 20px;
          text-align: center;
        }
        h3 {
          color: #4CAF50;
          font-size: 18px;
          margin-bottom: 15px;
        }
        p {
          font-size: 14px;
          margin-bottom: 20px;
        }
        .button {
          background-color: #4CAF50;
          color: white;
          border: none;
          padding: 5px 15px;
          border-radius: 5px;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h3>AI Suggestion</h3>
        <p>${hasErrors ? "There are errors in your code. Do you want to see AI suggestions?" : "There is no error in your code."}</p>
        ${hasErrors ? `<button class="button" onclick="showSuggestion()">Show suggestion</button>` : ""}
      </div>
      <script>
        const vscode = acquireVsCodeApi();
        function showSuggestion() {
          vscode.postMessage({ command: 'showSuggestion' });
        }
      </script>
    </body>
    </html>
  `;

  // Handle messages from the Webview
  panel.webview.onDidReceiveMessage(async (message) => {
    if (message.command === 'showSuggestion') {
      const aiSuggestion = await getAIResponse(codeSnippet);
      panel.webview.html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              height: 100vh;
              background-color: #333;
              display: flex;
              align-items: flex-end;
              justify-content: flex-start;
            }
            .container {
              max-width: 300px;
              padding: 20px;
              background: #1e1e1e;
              color: #ffffff;
              border-radius: 12px;
              box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.5);
              margin: 20px;
              text-align: center;
            }
            h3 {
              color: #4CAF50;
              font-size: 18px;
              margin-bottom: 15px;
            }
            p {
              font-size: 14px;
              margin-bottom: 20px;
            }
            .button {
              background-color: #4CAF50;
              color: white;
              border: none;
              padding: 5px 15px;
              border-radius: 5px;
              cursor: pointer;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h3>AI Suggestion</h3>
            <p>${aiSuggestion}</p>
            <button class="button" onclick="closePopup()">Close</button>
          </div>
          <script>
            const vscode = acquireVsCodeApi();
            function closePopup() {
              vscode.postMessage({ command: 'close' });
            }
          </script>
        </body>
        </html>
      `;
    }
  });
}

// activate extension
function activate(context) {
  console.log('Extension "programming-grammarly" is now active!');

  let checkCodeCommand = vscode.commands.registerCommand('programming-grammarly.checkCode', async function () {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const code = editor.document.getText();
      await showSuggestionInWebview(context, code); // 显示 Webview 并进行错误检测和 AI 建议
    } else {
      vscode.window.showInformationMessage('No active editor found.');
    }
  });

  context.subscriptions.push(checkCodeCommand);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};