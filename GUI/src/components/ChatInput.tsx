import React, { useState } from "react";

interface ChatInputProps {
    /** 父组件传入的回调，用来发送消息 */
    onSendMessage: (message: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage }) => {
    const [input, setInput] = useState("");

    /**
     * 触发发送
     */
    const handleSend = () => {
        if (input.trim()) {
            // 调用父组件提供的回调
            onSendMessage(input.trim());
            // 发送后清空输入框
            setInput("");
        }
    };

    return (
        <div className="chat-input">
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                    // 按 Enter 键发送
                    if (e.key === "Enter") {
                        e.preventDefault();
                        handleSend();
                    }
                }}
                placeholder="Type a message..."
            />
            <button onClick={handleSend}>Send</button>
        </div>
    );
};

export default ChatInput;
