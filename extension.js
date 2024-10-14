const vscode = require('vscode');
const { Configuration, OpenAIApi } = require('openai');

// 配置 OpenAI API
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,  // 使用环境变量获取 API 密钥
});
const openai = new OpenAIApi(configuration);

async function getAIResponse(codeSnippet) {
  try {
    const response = await openai.createCompletion({
      model: 'text-davinci-003',  
      prompt: `Check the following code for errors: \n\n${codeSnippet}`,
      max_tokens: 100,
      temperature: 0.7,
    });
    return response.data.choices[0].text;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return 'Failed to get response from OpenAI';
  }
}

async function provideErrorFeedback() {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const code = editor.document.getText();
    const aiSuggestion = await getAIResponse(code);
    vscode.window.showInformationMessage(`AI Suggestion: ${aiSuggestion}`);
  }
}

function activate(context) {
  const disposable = vscode.commands.registerCommand('programming-grammarly.checkCode', function () {
    provideErrorFeedback();
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};

