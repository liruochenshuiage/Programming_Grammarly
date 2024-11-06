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

//  show error and AI response
async function showBottomRightMessageWithSuggestion(codeSnippet) {
  const hasErrors = await detectErrors(codeSnippet);

  if (hasErrors) {
    const choice = await vscode.window.showInformationMessage(
      'There are some errors in your code, do you want see AI suggestion?',
      'Show suggestion', 'ignore'
    );

    if (choice === 'Show suggestion') {
      const aiSuggestion = await getAIResponse(codeSnippet);
      vscode.window.showInformationMessage(`AI Suggestion: ${aiSuggestion}`);
    }
  } else {
    vscode.window.showInformationMessage('There is no error in your code');
  }
}

// active extend 
function activate(context) {
  console.log('Extension "programming-grammarly" is now active!');

  let checkCodeCommand = vscode.commands.registerCommand('programming-grammarly.checkCode', async function () {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const code = editor.document.getText();
      await showBottomRightMessageWithSuggestion(code); // 使用右下角提示框显示错误和 AI 建议
    } else {
      vscode.window.showInformationMessage('未找到活动的编辑器。');
    }
  });

  context.subscriptions.push(checkCodeCommand);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};