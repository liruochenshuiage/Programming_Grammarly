import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm"; // GitHub 风格 Markdown
import rehypeRaw from "rehype-raw"; // 允许解析 HTML
import rehypeHighlight from "rehype-highlight"; // 代码高亮

interface Message {
  sender: string;
  text: string;  // AI 返回的markdown文本
  avatar: string;
}

interface MessageBubbleProps {
  messages: Message[];
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ messages }) => {
  return (
    <div>
      {messages.map((msg, index) => (
        <div key={index} className={`message-wrapper ${msg.sender}`}>
          {msg.sender === "ai" && (
            <img src={msg.avatar} alt="AI" className="avatar" />
          )}

          <div className={`message ${msg.sender}`}>
            {msg.sender === "ai" ? (
              // ✅ 适用于 AI 消息的 Markdown 渲染
              <ReactMarkdown
                className="markdown-body"  // ✅ 这里加上 className，方便 CSS 选择
                remarkPlugins={[remarkGfm]} // ✅ GitHub风味 Markdown
                rehypePlugins={[rehypeRaw, rehypeHighlight]} // ✅ 允许 HTML + 代码高亮
              >
                {msg.text}
              </ReactMarkdown>
            ) : (
              // 用户消息：普通文本
              msg.text
            )}
          </div>

          {msg.sender === "user" && (
            <img src={msg.avatar} alt="User" className="avatar" />
          )}
        </div>
      ))}
    </div>
  );
};

export default MessageBubble;
