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

// 检测错误的函数
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

// 获取AI建议的函数
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
    console.log("API Response:", response);
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return 'Failed to get response from OpenAI';
  }
}

// 扩展的激活函数
function activate(context) {
  console.log('Extension "programming-grammarly" is now active!');

  // 注册 helloWorld 命令
  let helloCommand = vscode.commands.registerCommand('programming-grammarly.helloWorld', function () {
    vscode.window.showInformationMessage('Hello World from Programming Grammarly!');
  });

  // 注册 checkCode 命令
  let checkCodeCommand = vscode.commands.registerCommand('programming-grammarly.checkCode', async function () {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const code = editor.document.getText();
      
      // 先检测是否有错误
      const hasErrors = await detectErrors(code);
      if (hasErrors) {
        // 如果检测到错误，询问用户是否查看建议
        const choice = await vscode.window.showInformationMessage(
          '发现代码错误，是否查看AI的建议？',
          '是', '否'
        );
        if (choice === '是') {
          // 如果用户选择查看建议，则调用 AI 提供详细建议
          getAIResponse(code).then((aiSuggestion) => {
            vscode.window.showInformationMessage(`AI Suggestion: ${aiSuggestion}`);
          });
        }
      } else {
        vscode.window.showInformationMessage('代码没有发现明显错误');
      }
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