const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

let checkInterval = null; // 定时器变量
let currentPanel = null; // 当前 Webview 面板
let lastCheckedCode = null; // 保存上一次检测的代码
let lastKnownCode = null; // 缓存最近一次有效的代码
let inWebview4 = false; // 标识是否在webview4中

// Dynamic import for OpenAI
async function loadOpenAI() {
  const { default: OpenAI } = await import('openai');
  return OpenAI;
}

async function getOpenAIInstance() {
  const OpenAI = await loadOpenAI();
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Detect errors in code
async function detectErrors(codeSnippet) {
  try {
    const openai = await getOpenAIInstance();
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are an assistant that only detects if there are any errors in the code, without providing any detailed suggestion.' },
        { role: 'user', content: `Does the following code contain any errors? Reply with "Yes" or "No" only:\n\n${codeSnippet}` },
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

async function getAISuggestion(codeSnippet) {
  try {
    const openai = await getOpenAIInstance();
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { 
          role: 'system', 
          content: `You are a helpful assistant providing well-structured and concise code improvement suggestions. Format your response clearly as:
          Problem: [Description of the issue]
          /n Solution: [Detailed solution or improvement] NOTE: Add Blank line between Suggestion part, Solution Part and Example Code part.` 
        },
        { 
          role: 'user', 
          content: `Analyze the following code and provide your suggestions in the format mentioned above:\n\nCode:\n${codeSnippet}` 
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const suggestion = response.choices[0].message.content.trim();
    console.log('AI Suggestion:', suggestion); // 打印 AI 返回的建议
    return suggestion;
  } catch (error) {
    console.error('Error getting AI suggestion:', error);
    return 'Failed to get suggestions from AI.';
  }
}

// Show Webview
async function showWebview(context, webviewName, aiSuggestion = null) {
  // 根据 webviewName 确定是否在 webview4
  if (webviewName === 'webview4') {
    inWebview4 = true;
    console.log('Entered webview4.');
  } else {
    // 只要不是webview4就停止检测并标记不在webview4
    if (inWebview4) {
      console.log(`Leaving webview4 to ${webviewName}, stopping periodic check.`);
      inWebview4 = false;
      stopPeriodicCheck();
    }
  }

  if (!currentPanel) {
    currentPanel = vscode.window.createWebviewPanel(
      'aiSuggestion',
      'AI Suggestion',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'resources'))],
      }
    );

    currentPanel.onDidDispose(() => {
      currentPanel = null;
      stopPeriodicCheck();
      inWebview4 = false; // 关闭面板时视为离开webview4
    });
  }

  const htmlFilePath = path.join(context.extensionPath, 'resources', `${webviewName}.html`);
  let htmlContent = fs.readFileSync(htmlFilePath, 'utf8');

  const backPath = currentPanel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'resources', 'back.png')));
  const globalPath = currentPanel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'resources', 'global.png')));
  const illustrationPath = currentPanel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'resources', 'webview2.png')));
  const detectResultPath = currentPanel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'resources', 'webview1.png')));

  htmlContent = htmlContent
    .replace('src="back.png"', `src="${backPath}"`)
    .replace('src="global.png"', `src="${globalPath}"`)
    .replace('src="webview2.png"', `src="${illustrationPath}"`)
    .replace('src="webview1.png"', `src="${detectResultPath}"`);

    if (aiSuggestion && webviewName === 'webview3') {
      console.log('Formatted AI Suggestion before inserting into Webview:', aiSuggestion); // 打印 AI 建议
      const formattedSuggestion = aiSuggestion.replace(/\/n/g, '<br>');
      htmlContent = htmlContent.replace('<!-- AI Suggestion will be dynamically inserted here -->', formattedSuggestion);
  }

  currentPanel.webview.html = htmlContent;

  let shouldStop = false;

  currentPanel.webview.onDidReceiveMessage(async (message) => {
      console.log('Received message:', message);
  
      if (message.command === 'back from webview1') {
          shouldStop = true;
          await showWebview(context, 'webview4');
          console.log('Navigated back to webview4');
          return;
      }
  
      if (message.command === 'back from webview2') {
          shouldStop = true;
          await showWebview(context, 'webview');
          console.log('Navigated back to webview');
          return;
      }

      if (message.command === 'Ignore'){
        await showWebview(context, 'webview4');
      }

      if (message.command === 'back from webview3'){
        await showWebview(context, 'webview');
      }

      if (message.command === 'closePlugin') {
        console.log('Closing plugin...');

        // 销毁当前 Webview 面板
        if (currentPanel) {
            currentPanel.dispose();
            currentPanel = null;
        }

        // 停止周期性检测（如果有）
        stopPeriodicCheck();
        console.log('Plugin successfully closed.');
        return;
    }

  
      if (message.command === 'yes') {
          console.log('Navigating to webview2...');
          await showWebview(context, 'webview2');
  
          // Generate a random wait time between 10 to 15 seconds
          const randomWaitTime = Math.floor(Math.random() * (15000 - 5000 + 1)) + 5000;
          console.log(`Waiting for ${randomWaitTime / 1000} seconds before navigating to webview3...`);
  
          // Send the random wait time to webview2 for progress bar synchronization
          currentPanel.webview.postMessage({ command: 'setProgressTime', time: randomWaitTime });
  
          // Handle AI suggestion logic
          const aiSuggestionPromise = new Promise(async (resolve) => {
              try {
                  if (!lastCheckedCode) {
                      console.error('No previously checked code available.');
                      vscode.window.showErrorMessage('No code available for suggestions. Please run the detection first.');
                      resolve(null);
                      return;
                  }
                  console.log('Requesting AI suggestion...');
                  const aiSuggestion = await getAISuggestion(lastCheckedCode);
                  resolve(aiSuggestion);
              } catch (error) {
                  console.error('Error during AI suggestion retrieval:', error);
                  resolve(null);
              }
          });
  
          // Timer for the random wait time
          const timerPromise = new Promise((resolve) => {
              setTimeout(() => {
                  resolve('timeout');
              }, randomWaitTime);
          });
  
          // Wait for either the AI suggestion or the timer to complete
          const result = await Promise.race([aiSuggestionPromise, timerPromise]);
  
          // Check if navigation should stop
          if (shouldStop) {
              console.log('Navigation to webview3 was stopped.');
              shouldStop = false; // Reset the flag for future navigation
              return;
          }
  
          // Handle AI suggestion or timeout result
          if (result && result !== 'timeout') {
            console.log('AI Suggestion received. Navigating to webview3...');
        
            // 按固定字符数拆分建议
            const suggestionLength = 200; // 每页字符数
            const suggestionPages = [];
            for (let i = 0; i < result.length; i += suggestionLength) {
                suggestionPages.push(result.slice(i, i + suggestionLength));
            }
        
            // 发送分页内容和页数信息到 Webview
            currentPanel.webview.postMessage({
                command: 'updateSuggestion',
                suggestionPages: suggestionPages,
                totalPages: suggestionPages.length,
            });
        
            // 跳转到 webview3
            await showWebview(context, 'webview3');
        } else if (result === 'timeout') {
            console.log('Random wait time elapsed. Navigating to webview3...');
            await showWebview(context, 'webview3', 'AI is still processing. This is a placeholder suggestion.');
        } else {
            console.error('Failed to retrieve AI suggestions.');
            vscode.window.showErrorMessage('Failed to retrieve AI suggestions.');
        }      
      } else if (message.command === 'close') {
          currentPanel.dispose();
          currentPanel = null;
          console.log('Webview closed.');
      }
  });
  
  return currentPanel;
}

async function startPeriodicCheck(context) {
  if (!inWebview4) {
    console.log('Not in webview4, skipping periodic check start.');
    return;
  }

  if (checkInterval !== null) {
      console.log('Periodic check is already running. Skipping restart.');
      return;
  }

  console.log('Starting periodic check...');
  const editor = vscode.window.activeTextEditor;
  if (editor) {
      lastKnownCode = editor.document.getText(); // 缓存代码
  }

  const codeToCheck = editor ? editor.document.getText() : lastKnownCode;
  if (codeToCheck && inWebview4) {
      const hasErrors = await detectErrors(codeToCheck);
      if (hasErrors && inWebview4) {
          console.log('Errors detected immediately. Showing webview...');
          lastCheckedCode = codeToCheck;
          await showWebview(context, 'webview');
      }
  }

  checkInterval = setInterval(async () => {
      if (!inWebview4) {
        console.log('Not in webview4 during interval, skipping this cycle.');
        return;
      }

      console.log('Periodic check triggered...');
      const editor = vscode.window.activeTextEditor;
      if (editor) {
          lastKnownCode = editor.document.getText();
      }

      const codeToCheck = editor ? editor.document.getText() : lastKnownCode;

      if (!codeToCheck) {
          console.log('No code to check. Skipping this cycle.');
          return;
      }

      if (!inWebview4) {
        console.log('Not in webview4, skipping detection this cycle.');
        return;
      }

      const hasErrors = await detectErrors(codeToCheck);
      if (hasErrors && inWebview4) {
          console.log('Errors detected during periodic check. Showing webview...');
          lastCheckedCode = codeToCheck;
          stopPeriodicCheck();
          await showWebview(context, 'webview');
      }
  }, 10000); // 每10秒检测一次
}

function stopPeriodicCheck() {
  if (checkInterval !== null) {
      console.log('Stopping periodic check...');
      clearInterval(checkInterval);
      checkInterval = null; 
  } else {
      console.log('No periodic check to stop.');
  }
}

async function showWebview4(context) {
  console.log('Navigating to webview4...');
  stopPeriodicCheck(); // 停止旧的检测
  console.log('Old periodic check stopped. Showing webview4 now...');
  await showWebview(context, 'webview4');
  // 进入webview4后再启动定时检测
  if (inWebview4) {
    startPeriodicCheck(context);
  }
}

// Activate the extension
function activate(context) {
  console.log('Extension "programming-grammarly" is now active!');

  let checkCodeCommand = vscode.commands.registerCommand('programming-grammarly.checkCode', async function () {
    showWebview4(context);
  });

  context.subscriptions.push(checkCodeCommand);
}

function deactivate() {
  stopPeriodicCheck();
}

module.exports = {
  activate,
  deactivate,
};
