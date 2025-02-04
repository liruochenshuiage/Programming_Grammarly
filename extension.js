const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

let currentPanel = null;
let lastChangeTime = Date.now();
let changeCount = 0;

// 监听代码变化
vscode.workspace.onDidChangeTextDocument((event) => {
    changeCount += event.contentChanges.length;
    lastChangeTime = Date.now();
});

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
 * **通用 AI 查询方法**
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function getAISuggestion(prompt) {
    try {
        const openai = await getOpenAIInstance();
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 500,
            temperature: 0.7,
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('Error getting AI suggestion:', error);
        return '⚠️ AI 请求失败，请检查 API 配置或网络状态！';
    }
}

/**
 * **AI 代码错误检测**
 * - 询问 AI 代码是否有错误
 * @param {string} code
 * @returns {Promise<boolean>}
 */
async function detectCodeErrors(code) {
    const prompt = `
    Analyze the following code for syntax and logical errors.
    If there are any issues, respond in a polite and encouraging manner.
    If no issues are found, just respond: "Everything looks good! Keep coding. 💪"

    Code:
    ${code}
    `;

    console.log("📤 Sending AI code check request:\n", prompt);
    console.log("🟡 Sending request to AI...");
    
    const response = await getAISuggestion(prompt);
    
    console.log("🔵 AI Response:", response);

    // **如果 AI 认为代码是正确的，就返回 false**
    if (response.trim().toLowerCase().includes("everything looks good")) {
        return false; // ✅ 确保返回 boolean 值
    }

    return true; // ✅ 代码有问题，返回 true
}



/**
 * **AI 详细代码分析**
 * - 让 AI 提供详细的代码改进建议
 * @param {string} code
 * @returns {Promise<string>}
 */
async function analyzeCodeWithAI(code) {
    const prompt = `
    Analyze the following code and provide:
    - Syntax errors
    - Logical errors
    - Best practice suggestions
    
    Code:
    ${code}
    `;

    console.log("📡 发送代码分析请求到 AI...");
    const response = await getAISuggestion(prompt);
    console.log("🔵 AI 返回的代码分析:", response);

    return response;
}


/**
 * 展示 Webview
 */
async function showWebview(context) {
    if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.Beside);
        return;
    }

    currentPanel = vscode.window.createWebviewPanel(
        'aiChat',
        'AI Chat',
        vscode.ViewColumn.Beside,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    currentPanel.onDidDispose(() => {
        currentPanel = null;
    });

    // **确保监听器只绑定一次**
    currentPanel.webview.onDidReceiveMessage(async (message) => {
        console.log("📩 WebView received message:", message);
    
        if (message.command === "sendMessage") {
            console.log("💬 User input:", message.text);
    
            if (message.text.toLowerCase() === "yes") {
                console.log("🔎 User requested code analysis");
    
                let editor = vscode.window.activeTextEditor;
    
                // **尝试获取一个可用的代码编辑器**
                if (!editor) {
                    console.log("⚠️ No active text editor, searching for a visible one...");
                    const visibleEditors = vscode.window.visibleTextEditors;
                    for (const e of visibleEditors) {
                        if (e.document.uri.scheme === "file") { 
                            editor = e;
                            break;
                        }
                    }
                }
    
                if (!editor) {
                    console.log("❌ No available text editor, cannot analyze!");
                    currentPanel.webview.postMessage({ text: "⚠️ Please open a code file before running analysis." });
                    return;
                }
    
                const code = editor.document.getText();
                console.log("📜 Code to analyze:", code);
    
                // **确保 AI 正确分析代码**
                const analysis = await analyzeCodeWithAI(code);
                console.log("🤖 AI Code Analysis Result:", analysis);
    
                if (currentPanel) {
                    currentPanel.webview.postMessage({ text: `🔍 AI Code Analysis:\n${analysis}` });
                    console.log("✅ AI code analysis sent to WebView.");
                }
            } else if (message.text.toLowerCase() === "no") {
                console.log("✅ User chose to ignore this analysis.");
                currentPanel.webview.postMessage({ text: "✅ You chose to ignore this analysis." });
            } else {
                // 让 AI 处理普通聊天请求
                const aiResponse = await getAISuggestion(message.text);
                console.log("🤖 AI Response:", aiResponse);
    
                if (currentPanel) {
                    currentPanel.webview.postMessage({ text: aiResponse });
                    console.log("✅ AI response sent to WebView.");
                }
            }
        }
    });
    

    const reactAppPath = path.join(context.extensionPath, 'GUI', 'build', 'index.html');
    if (!fs.existsSync(reactAppPath)) {
        console.error('React build/index.html 文件不存在！请先构建前端。');
        return;
    }

    let htmlContent = fs.readFileSync(reactAppPath, 'utf8');
    const baseUri = currentPanel.webview.asWebviewUri(vscode.Uri.file(
        path.join(context.extensionPath, 'GUI', 'build'))
    );
    const publicUri = currentPanel.webview.asWebviewUri(vscode.Uri.file(
        path.join(context.extensionPath, 'public'))
    );

    htmlContent = htmlContent
        .replace(/"\/static\//g, `"${baseUri}/static/`)
        .replace(/"\/favicon.ico/g, `"${baseUri}/favicon.ico`)
        .replace(/"\.\/bg\.png"/g, `"${publicUri}/bg.png"`);

    currentPanel.webview.options = {
        enableScripts: true,
        localResourceRoots: [
            vscode.Uri.file(path.join(context.extensionPath, 'GUI', 'build')),
            vscode.Uri.file(path.join(context.extensionPath, 'public'))
        ]
    };

    currentPanel.webview.html = htmlContent;
}


setInterval(async () => {
    if (!vscode.window.activeTextEditor) return;

    console.log("🔄 Running automatic code check...");

    const code = vscode.window.activeTextEditor.document.getText();
    const hasError = await detectCodeErrors(code);

    if (hasError && currentPanel) {
        console.log("⚠️ AI detected potential issues, notifying WebView...");
        currentPanel.webview.postMessage({
            text: "⚠️ I found some potential issues in your code. Would you like to review them? (Reply 'Yes' or 'No')"
        });
    } else {
        console.log("✅ Code check complete, no issues found.");
    }
}, 20000);

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
 */
function activate(context) {
    console.log('Extension "programming-grammarly" is now active!');

    context.subscriptions.push(
        vscode.commands.registerCommand('programming-grammarly.openChat', () => {
            console.log('Opening AI Chat...');
            showWebview(context);
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

    context.subscriptions.push(
        vscode.commands.registerCommand('programming-grammarly.checkCode', async () => {
            if (vscode.window.activeTextEditor) {
                const code = vscode.window.activeTextEditor.document.getText();
                const analysis = await analyzeCodeWithAI(code);
                vscode.window.showInformationMessage("AI 分析完成，请查看 WebView。");
                if (currentPanel) {
                    currentPanel.webview.postMessage({ text: `🔍 AI 代码分析:\n${analysis}` });
                }
            }
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
