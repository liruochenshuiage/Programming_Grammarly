const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

let currentPanel = null; // 缓存当前的 WebviewPanel

/**
 * 动态加载 OpenAI 依赖
 */
async function loadOpenAI() {
    const { default: OpenAI } = await import('openai');
    return OpenAI;
}

/**
 * 获取 OpenAI 实例
 */
async function getOpenAIInstance() {
    const OpenAI = await loadOpenAI();
    return new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });
}

/**
 * 调用 OpenAI，获取 AI 建议
 * @param {string} codeSnippet - 需要分析的代码或文本
 */
async function getAISuggestion(codeSnippet) {
    try {
        const openai = await getOpenAIInstance();
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful assistant providing structured code improvement suggestions.'
                },
                {
                    role: 'user',
                    content: `Analyze this code and suggest improvements:\n\n${codeSnippet}`
                }
            ],
            max_tokens: 500,
            temperature: 0.7,
        });

        const suggestion = response.choices[0].message.content.trim();
        return suggestion;
    } catch (error) {
        console.error('Error getting AI suggestion:', error);
        return '⚠️ AI 请求失败，请检查 API 配置或网络状态！';
    }
}

/**
 * 展示（或创建）Webview，并与前端进行消息通信
 * @param {vscode.ExtensionContext} context
 */
async function showWebview(context) {
    // 如果面板已经存在，则让它显示到前台即可
    if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.Beside);
        return;
    }

    // 否则，创建一个新的 WebviewPanel
    currentPanel = vscode.window.createWebviewPanel(
        'aiChat',
        'AI Chat',
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            retainContextWhenHidden: true, // 让 Webview 不会因为隐藏就丢失状态
        }
    );

    // 当用户关闭面板时重置
    currentPanel.onDidDispose(() => {
        currentPanel = null;
    });

    // 注册从 Webview 发来的消息监听器
    currentPanel.webview.onDidReceiveMessage(async (message) => {
        if (message.command === 'sendMessage') {
            console.log('收到 WebView 消息:', message.text);

            // 调用 OpenAI，获取回复
            const aiResponse = await getAISuggestion(message.text);
            console.log('AI 回复:', aiResponse);

            // 发消息给 WebView
            if (currentPanel) {
                currentPanel.webview.postMessage({ text: aiResponse });
            }
        }
    });

    // 读取你的 React 构建产物 (build/index.html)
    const reactAppPath = path.join(context.extensionPath, 'GUI', 'build', 'index.html');
    if (!fs.existsSync(reactAppPath)) {
        console.error('React build/index.html 文件不存在！请先构建前端。');
        return;
    }

    // 读取 HTML 文件内容
    let htmlContent = fs.readFileSync(reactAppPath, 'utf8');

    // 计算静态资源访问路径（替换绝对路径为 VSCode 可识别的 webview URI）
    const baseUri = currentPanel.webview.asWebviewUri(
        vscode.Uri.file(path.join(context.extensionPath, 'GUI', 'build'))
    );
    const publicUri = currentPanel.webview.asWebviewUri(
        vscode.Uri.file(path.join(context.extensionPath, 'public'))
    );

    // 修正前端资源引用
    htmlContent = htmlContent
        .replace(/"\/static\//g, `"${baseUri}/static/`) // 替换JS、CSS等静态资源
        .replace(/"\/favicon.ico/g, `"${baseUri}/favicon.ico`) // 替换favicon
        .replace(/"\.\/bg\.png"/g, `"${publicUri}/bg.png"`);    // 替换背景图

    // 允许 Webview 加载本地资源
    currentPanel.webview.options = {
        enableScripts: true,
        localResourceRoots: [
            vscode.Uri.file(path.join(context.extensionPath, 'GUI', 'build')),
            vscode.Uri.file(path.join(context.extensionPath, 'public'))
        ]
    };

    // 最后，将修正后的 HTML 赋值给 Webview
    currentPanel.webview.html = htmlContent;
}

/**
 * 发送“光标选中的区域”到 Webview
 * 如果没选中，就提示用户
 */
async function sendSelectedRange(context) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage("No active editor found.");
        return;
    }

    const { document, selection } = editor;
    const selectedText = document.getText(selection).trim();

    if (!selectedText) {
        vscode.window.showInformationMessage("Please select some text first.");
        return;
    }

    // 确保 Webview 打开
    await showWebview(context);

    // 在前端自动当作“用户输入”
    if (currentPanel) {
        currentPanel.webview.postMessage({
            command: 'injectUserCode',
            text: selectedText
        });
        //vscode.window.showInformationMessage("Selected text injected to Webview as user input!");
    }
}

/**
 * 发送“当前文件”到 Webview，但不直接调用 AI
 * 让前端当作用户输入，再由前端触发 AI 请求
 */
async function sendCurrentFile(context) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage("No active editor found.");
        return;
    }

    const fullText = editor.document.getText();
    if (!fullText.trim()) {
        vscode.window.showInformationMessage("Current file is empty.");
        return;
    }

    // 确保 Webview 已经打开
    await showWebview(context);

    if (currentPanel) {
        // 发一条特殊指令给前端，让前端自己决定怎么处理
        currentPanel.webview.postMessage({
            command: 'injectUserCode',
            text: fullText
        });
        //vscode.window.showInformationMessage("File code injected to Webview as user input!");
    }
}


/**
 * 插件被激活时会调用此方法
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Extension "programming-grammarly" is now active!');

    // 命令1：打开 AI Chat 面板
    context.subscriptions.push(
        vscode.commands.registerCommand('programming-grammarly.openChat', () => {
            console.log('Opening AI Chat...');
            showWebview(context);
        })
    );

    // 命令2：检查代码
    context.subscriptions.push(
        vscode.commands.registerCommand('programming-grammarly.checkCode', () => {
            // 你原有的逻辑...
            vscode.window.showInformationMessage("Check Code with AI (not implemented yet).");
        })
    );

    // 命令3：发送当前方法
    context.subscriptions.push(
        vscode.commands.registerCommand('programming-grammarly.sendSelectedRange', async () => {
            await sendSelectedRange(context);
        })
    );

    // 命令4：发送当前文件
    context.subscriptions.push(
        vscode.commands.registerCommand('programming-grammarly.sendCurrentFile', async () => {
            await sendCurrentFile(context);
        })
    );    
}

/**
 * 插件被停用时会调用此方法
 */
function deactivate() {
    if (currentPanel) {
        currentPanel.dispose();
        currentPanel = null;
    }
}

module.exports = {
    activate,
    deactivate,
};
