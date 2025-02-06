const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

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
        console.error('❌ Error getting AI suggestion:', error);
        return '⚠️ AI request failed. Please check your API key or network connection.';
    }
}

function detectNewFunction(newCode, oldCode) {
    // **匹配 Python 和 JavaScript/TypeScript 的函数**
    const functionRegex = /(?:def|function)\s+([\w\d_]+)\s*\(.*\)\s*[:{]/g;

    const newFunctions = [...newCode.matchAll(functionRegex)].map(match => match[1]);
    const oldFunctions = [...oldCode.matchAll(functionRegex)].map(match => match[1]);

    console.log(`🆕 检测到新函数: (${newFunctions.length})`, newFunctions);
    console.log(`📜 旧代码函数: (${oldFunctions.length})`, oldFunctions);

    return newFunctions.filter(fn => !oldFunctions.includes(fn));
}


async function generateUnitTest(fullCode, newFunctions) {
    if (newFunctions.length === 0) {
        console.log("✅ No new functions detected.");
        return "No new functions detected, so no test is generated.";
    }

    console.log("📡 发送测试生成请求到 AI...");
    const functionList = newFunctions.join("\n");
    const prompt = `
        I have written some new functions in my code. 
        Please generate unit tests for the following functions using Jest (for JavaScript) or unittest (for Python).
        Ensure the test covers edge cases.

        Code:
        ${fullCode}

        Functions:
        ${functionList}
    `;

    const response = await getAISuggestion(prompt);
    console.log("🔵 AI 生成的测试代码:", response);

    return response;  // ✅ 确保返回测试代码
}



module.exports = {
    detectNewFunction,
    generateUnitTest
};

