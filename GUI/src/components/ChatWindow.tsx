import React, { useState, useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";

import userAvatar from "../assets/user.png";
import aiAvatar from "../assets/ai.png";

const ChatWindow: React.FC = () => {
    const [messages, setMessages] = useState<{ sender: string; text: string; avatar: string }[]>([]);
    const [input, setInput] = useState("");

    const vscodeApiRef = useRef<any>(null);

    useEffect(() => {
        vscodeApiRef.current = (window as any).acquireVsCodeApi();

        const handleMessage = (event: MessageEvent) => {
            const { command, text } = event.data || {};

            if (command === "injectUserCode") {
                console.log("[前端] 收到 injectUserCode:", text);
                sendMessage(text);
            } else if (text) {
                console.log("[前端] 收到扩展回复事件:", text);
                // ❷ AI 消息使用 aiAvatar
                const aiMessage = {
                    sender: "ai",
                    text,
                    avatar: aiAvatar
                };
                setMessages((prev) => [...prev, aiMessage]);
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    // 发送消息
    const sendMessage = (msg?: string) => {
        const textToSend = (msg !== undefined) ? msg : input;
        if (!textToSend.trim()) return;

        // ❸ 用户消息使用 userAvatar
        const userMessage = {
            sender: "user",
            text: textToSend,
            avatar: userAvatar
        };
        setMessages((prev) => [...prev, userMessage]);

        setInput("");

        vscodeApiRef.current?.postMessage({
            command: "sendMessage",
            text: textToSend
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
