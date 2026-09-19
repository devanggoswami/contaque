import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mail, RefreshCw, Send, Search, User, Clock, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import './Inbox.css';

function Inbox() {
  const { authFetch } = useAuth();
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const fetchThreads = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/inbox/threads`);
      const data = await res.json();
      setThreads(data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }, [authFetch]);

  const fetchMessages = async (threadId) => {
    try {
      const res = await authFetch(`${API_URL}/api/inbox/threads/${threadId}`);
      const data = await res.json();
      setMessages(data);
      scrollToBottom();
      
      // Update local thread read state
      setThreads(threads.map(t => t.id === threadId ? { ...t, is_unread: false } : t));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000); // 2 min timeout
      const res = await authFetch(`${API_URL}/api/inbox/sync`, { method: 'POST', signal: controller.signal });
      clearTimeout(timeout);
      const data = await res.json();
      if (data.error) {
        alert('Sync error: ' + data.error);
      } else {
        alert(data.message || 'Sync complete!');
        await fetchThreads();
        if (activeThread) await fetchMessages(activeThread.id);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        alert('Sync timed out. The server may still be syncing in the background. Try refreshing in a minute.');
      } else {
        alert('Error syncing emails: ' + err.message);
      }
    }
    setSyncing(false);
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !activeThread || sending) return;
    setSending(true);
    
    try {
      const res = await authFetch(`${API_URL}/api/inbox/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_id: activeThread.id,
          text: replyText
        })
      });
      const data = await res.json();
      if (res.ok) {
        setReplyText('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        await fetchMessages(activeThread.id);
      } else {
        alert(data.error || 'Failed to send reply');
      }
    } catch (err) {
      alert('Error sending reply');
    }
    setSending(false);
  };

  useEffect(() => {
    fetchThreads();
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const selectThread = (thread) => {
    setActiveThread(thread);
    fetchMessages(thread.id);
  };

  const handleTextareaChange = (e) => {
    setReplyText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const filteredThreads = threads.filter(t => {
    const q = searchQuery.toLowerCase();
    return (
      (t.lead_name && t.lead_name.toLowerCase().includes(q)) ||
      (t.lead_email && t.lead_email.toLowerCase().includes(q)) ||
      (t.latest_subject && t.latest_subject.toLowerCase().includes(q)) ||
      (t.snippet && t.snippet.toLowerCase().includes(q))
    );
  });

  return (
    <div className="inbox-wrapper animate-slide-up">
      <div className="inbox-header-compact">
        <div>
          <h1>Inbox <span className="beta-badge">BETA</span></h1>
          <p>Read replies from your leads and answer them directly.</p>
        </div>
        <button className="btn-sync" onClick={handleSync} disabled={syncing}>
          <RefreshCw size={15} className={syncing ? 'spinning' : ''} />
          <span>{syncing ? 'Syncing via IMAP...' : 'Sync Now'}</span>
        </button>
      </div>

      <div className="inbox-layout-card">
        {/* Left Sidebar - Threads List */}
        <div className={`inbox-sidebar ${activeThread ? 'mobile-hidden' : ''}`}>
          <div className="search-bar-wrap">
            <Search size={15} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search conversations..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="btn-clear-search" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>
          
          <div className="thread-list">
            {loading ? (
              <div className="loading-state">
                <RefreshCw size={18} className="spinning" /> Loading emails...
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="empty-state">
                <Mail size={28} />
                <p>{searchQuery ? 'No matching conversations' : 'No conversations found.'}</p>
                <span>{searchQuery ? 'Try another search term' : 'Click "Sync Now" to fetch latest emails.'}</span>
              </div>
            ) : (
              filteredThreads.map(thread => (
                <div 
                  key={thread.id} 
                  className={`thread-item ${activeThread?.id === thread.id ? 'active' : ''} ${thread.is_unread ? 'unread' : ''}`}
                  onClick={() => selectThread(thread)}
                >
                  <div className="thread-avatar">
                    {(thread.lead_name || thread.lead_email).charAt(0).toUpperCase()}
                    {thread.is_unread && <span className="unread-dot"></span>}
                  </div>
                  <div className="thread-content">
                    <div className="thread-top">
                      <h4>{thread.lead_name || thread.lead_email.split('@')[0]}</h4>
                      <span className="thread-time">
                        {new Date(thread.last_message_date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                      </span>
                    </div>
                    <div className="thread-subject">{thread.latest_subject || 'No Subject'}</div>
                    <div className="thread-snippet">{thread.snippet}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Pane - Conversation View */}
        <div className={`inbox-main ${!activeThread ? 'mobile-hidden' : ''}`}>
          {activeThread ? (
            <div className="conversation-view">
              <div className="conversation-header-row">
                <button className="btn-back mobile-only" onClick={() => setActiveThread(null)}>
                  <ArrowLeft size={16} />
                </button>
                <div className="conversation-avatar-badge">
                  {(activeThread.lead_name || activeThread.lead_email).charAt(0).toUpperCase()}
                </div>
                <div className="conversation-title-box">
                  <h2>{activeThread.lead_name || activeThread.lead_email}</h2>
                  <span className="conversation-subtitle">{activeThread.lead_email}</span>
                </div>
              </div>

              {/* Messages Container (Takes 90%+ of vertical space) */}
              <div className="messages-container">
                {messages.map(msg => (
                  <div key={msg.id} className={`message-bubble-wrapper ${msg.direction === 'OUTBOUND' ? 'outbound' : 'inbound'}`}>
                    <div className="message-bubble">
                      <div className="message-meta">
                        <span className="message-sender">
                          {msg.direction === 'OUTBOUND' ? 'You' : (msg.sender_name || activeThread.lead_name || activeThread.lead_email)}
                        </span>
                        <span className="message-time">{new Date(msg.date).toLocaleString()}</span>
                      </div>
                      <div className="message-body" dangerouslySetInnerHTML={{ __html: msg.body_html || msg.body_text }} />
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Compact Floating Reply Bar (Takes minimal 50px space) */}
              <div className="compact-reply-composer">
                <div className="reply-composer-inner">
                  <textarea 
                    ref={textareaRef}
                    rows={1}
                    placeholder={`Reply to ${activeThread.lead_email}... (Press Enter to send, Shift+Enter for new line)`}
                    value={replyText}
                    onChange={handleTextareaChange}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                  />
                  <button 
                    className="btn-send-compact" 
                    onClick={handleSendReply} 
                    disabled={sending || !replyText.trim()}
                    title="Send (Enter)"
                  >
                    {sending ? (
                      <RefreshCw size={15} className="spinning" />
                    ) : (
                      <>
                        <span>Send</span>
                        <Send size={14} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="no-selection">
              <div className="no-selection-icon">
                <Mail size={40} />
              </div>
              <h2>Select a Conversation</h2>
              <p>Choose an email thread from the left to read messages and reply instantly.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Inbox;
