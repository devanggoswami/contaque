import React from 'react';
import './TopNewsTicker.css';

export default function TopNewsTicker() {
  const tickerText = "WhatsApp Radar (Beta): Lead availability varies depending on the country, region, and local business adoption.";

  return (
    <div className="top-news-ticker-bar" role="region" aria-label="Important Announcement">
      <div className="ticker-badge">
        <span className="ticker-badge-dot"></span>
        <span className="ticker-badge-text">BETA NOTICE</span>
      </div>
      <div className="ticker-track-container">
        <div className="ticker-track">
          <span className="ticker-item">{tickerText}</span>
          <span className="ticker-item-separator">•</span>
          <span className="ticker-item">{tickerText}</span>
          <span className="ticker-item-separator">•</span>
          <span className="ticker-item">{tickerText}</span>
          <span className="ticker-item-separator">•</span>
          <span className="ticker-item">{tickerText}</span>
          <span className="ticker-item-separator">•</span>
        </div>
      </div>
    </div>
  );
}
