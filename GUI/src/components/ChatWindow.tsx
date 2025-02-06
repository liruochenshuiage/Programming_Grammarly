import React, { useState, useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";

import userAvatar from "../assets/user.png";
import aiAvatar from "../assets/ai.png";

const ChatWindow: React.FC = () => {
    const [messages, setMessages] = useState<{ sender: string; text: string; avatar: string }[]>([]);
    const [input, setInput] = useState("");
    const [pendingContext, setPendingContext] = useState<string | null>(null); // ✅ 追踪 "yes" 的上下文

    const vscodeApiRef = useRef<any>(null);
    const chatEndRef = useRef<HTMLDivElement>(null); // ✅ 用于滚动到底部

    useEffect(() => {
        vscodeApiRef.current = (window as any).acquireVsCodeApi();

        const handleMessage = (event: MessageEvent) => {
            const { command, text, context } = event.data || {};

            console.log("[前端] 收到 WebView 消息:", event.data);

            if (command === "injectUserCode") {
                sendMessage(text);
            } else if (command === "displayTest") {
                console.log("[前端] 显示测试代码:", text);
                addChatMessage(text);
            } else if (command === "askGenerateTest") {
                console.log("[前端] 询问用户是否生成测试:", text);
                addChatMessage(text);
                setPendingContext("test");  // ✅ 标记 "yes" 触发的是测试
            } else if (command === "askAnalyzeCode") {
                console.log("[前端] 询问用户是否进行代码分析:", text);
                addChatMessage(text);
                setPendingContext("analyze");  // ✅ 标记 "yes" 触发的是代码分析
            } else {
                addChatMessage(text);
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    // **✅ 自动滚动到底部**
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    // **统一处理 WebView 消息**
    const addChatMessage = (text: string) => {
        const aiMessage = {
            sender: "ai",
            text,
            avatar: aiAvatar
        };
        setMessages((prev) => [...prev, aiMessage]);
    };

    // **发送用户消息**
    const sendMessage = (msg?: string) => {
        const textToSend = msg !== undefined ? msg : input;
        if (!textToSend.trim()) return;

        const userMessage = {
            sender: "user",
            text: textToSend,
            avatar: userAvatar
        };
        setMessages((prev) => [...prev, userMessage]);

        setInput("");

        let contextToSend = pendingContext; // ✅ 取出 pendingContext
        setPendingContext(null); // ✅ 发送后清空状态

        vscodeApiRef.current?.postMessage({
            command: "sendMessage",
            text: textToSend,
            context: contextToSend // ✅ 发送时附带上下文
        });
    };

    return (
        <div className="chat-container">
            <div className="hotkey-reminder">
                <p>Cmd+Shift+L：Send Selected Range</p>
                <p>Cmd+Shift+R：Send Current File</p>
            </div>

            <div className="chat-messages">
                <MessageBubble messages={messages} />
                <div ref={chatEndRef} />  {/* ✅ 这里是自动滚动的目标点 */}
            </div>

            <div className="chat-input">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            sendMessage();
                        }
                    }}
                    placeholder="Type a message..."
                />
                <button onClick={() => sendMessage()}>
                    Send
                </button>
            </div>
        </div>
    );
};

export default ChatWindow;
