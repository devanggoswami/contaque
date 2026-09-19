import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Database as DbIcon, CheckCircle2, Clock, XCircle, Eye, 
  Download, X, FileText, FileSpreadsheet, Search, RefreshCw, 
  Filter, Copy, Check, ExternalLink, Phone, Globe, MapPin, 
  ChevronRight, Sparkles, AlertCircle, ArrowUpDown, Trash2,
  MessageCircle, MessageSquare, Mail, Share2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import './Database.css';

// Brand Button Colors for PDF (Vibrant, Modern & Recognizable Button Badges)
const PDF_SOCIAL_BUTTON_STYLES = {
  IG:  { bg: [225, 48, 108], border: [195, 35, 90], text: [255, 255, 255] },
  FB:  { bg: [24, 119, 242], border: [16, 95, 205], text: [255, 255, 255] },
  WA:  { bg: [37, 211, 102], border: [28, 175, 82], text: [255, 255, 255] },
  LI:  { bg: [10, 102, 194], border: [8, 80, 160], text: [255, 255, 255] },
  X:   { bg: [20, 23, 26], border: [10, 12, 15], text: [255, 255, 255] },
  YT:  { bg: [220, 38, 38], border: [180, 25, 25], text: [255, 255, 255] },
  TT:  { bg: [1, 1, 1], border: [35, 35, 35], text: [255, 255, 255] },
  TG:  { bg: [34, 158, 217], border: [20, 130, 185], text: [255, 255, 255] },
  PIN: { bg: [189, 8, 28], border: [150, 5, 20], text: [255, 255, 255] }
};

// Helper to draw individual button pills and attach individual clickable links per platform
const drawPdfSocialBadges = (doc, cell, rawLead) => {
  if (!rawLead) return;

  const platforms = [];

  // Instagram
  const ig = rawLead.instagram || (rawLead.source_link?.includes('instagram.com') ? rawLead.source_link : null);
  if (ig) {
    platforms.push({ label: 'IG', url: ig.startsWith('http') ? ig : `https://${ig}` });
  }

  // Facebook
  const fb = rawLead.facebook || (rawLead.source_link?.includes('facebook.com') ? rawLead.source_link : null);
  if (fb) {
    platforms.push({ label: 'FB', url: fb.startsWith('http') ? fb : `https://${fb}` });
  }

  // WhatsApp (explicit whatsapp or mobile / phone digits)
  const rawWa = rawLead.whatsapp || rawLead.mobile || rawLead.phone;
  const waDigits = rawWa ? String(rawWa).replace(/\D/g, '') : '';
  if (rawLead.whatsapp || waDigits.length >= 7) {
    const waUrl = (rawLead.whatsapp && rawLead.whatsapp.startsWith('http'))
      ? rawLead.whatsapp
      : `https://wa.me/${waDigits}`;
    platforms.push({ label: 'WA', url: waUrl });
  }

  // LinkedIn
  const li = rawLead.linkedin || (rawLead.source_link?.includes('linkedin.com') ? rawLead.source_link : null);
  if (li) {
    platforms.push({ label: 'LI', url: li.startsWith('http') ? li : `https://${li}` });
  }

  // Twitter / X
  const tw = rawLead.twitter || ((rawLead.source_link?.includes('twitter.com') || rawLead.source_link?.includes('x.com')) ? rawLead.source_link : null);
  if (tw) {
    platforms.push({ label: 'X', url: tw.startsWith('http') ? tw : `https://${tw}` });
  }

  // YouTube
  const yt = rawLead.youtube || (rawLead.source_link?.includes('youtube.com') ? rawLead.source_link : null);
  if (yt) {
    platforms.push({ label: 'YT', url: yt.startsWith('http') ? yt : `https://${yt}` });
  }

  // TikTok
  const tt = rawLead.tiktok || (rawLead.source_link?.includes('tiktok.com') ? rawLead.source_link : null);
  if (tt) {
    platforms.push({ label: 'TT', url: tt.startsWith('http') ? tt : `https://${tt}` });
  }

  // Telegram
  const tg = rawLead.telegram || ((rawLead.source_link?.includes('t.me') || rawLead.source_link?.includes('telegram.me')) ? rawLead.source_link : null);
  if (tg) {
    platforms.push({ label: 'TG', url: tg.startsWith('http') ? tg : `https://${tg}` });
  }

  // Pinterest
  const pin = rawLead.pinterest || (rawLead.source_link?.includes('pinterest.com') ? rawLead.source_link : null);
  if (pin) {
    platforms.push({ label: 'PIN', url: pin.startsWith('http') ? pin : `https://${pin}` });
  }

  if (platforms.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(150, 145, 135);
    doc.text('-', cell.x + cell.width / 2, cell.y + cell.height / 2 + 2, { align: 'center' });
    return;
  }

  const btnH = 10.5;
  const gapX = 2.5;
  const gapY = 2.5;
  const padX = 4;
  const maxX = cell.x + cell.width - padX;

  const btnWMap = { PIN: 19, X: 13.5 };
  const defaultBtnW = 16.5;

  // Calculate required lines to vertically center button badges inside the cell
  let testX = cell.x + padX;
  let rowCount = 1;
  for (const p of platforms) {
    const w = btnWMap[p.label] || defaultBtnW;
    if (testX + w > maxX && testX > cell.x + padX) {
      rowCount++;
      testX = cell.x + padX;
    }
    testX += w + gapX;
  }
  const totalH = rowCount * btnH + (rowCount - 1) * gapY;
  let curY = cell.y + Math.max(3, (cell.height - totalH) / 2);
  let curX = cell.x + padX;

  platforms.forEach((p) => {
    const btnW = btnWMap[p.label] || defaultBtnW;
    if (curX + btnW > maxX && curX > cell.x + padX) {
      curX = cell.x + padX;
      curY += btnH + gapY;
    }

    const style = PDF_SOCIAL_BUTTON_STYLES[p.label] || { bg: [90, 90, 90], border: [60, 60, 60], text: [255, 255, 255] };

    // Draw rounded button pill
    doc.setFillColor(style.bg[0], style.bg[1], style.bg[2]);
    doc.setDrawColor(style.border[0], style.border[1], style.border[2]);
    doc.setLineWidth(0.4);
    doc.roundedRect(curX, curY, btnW, btnH, 2.2, 2.2, 'FD');

    // Draw button text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(style.text[0], style.text[1], style.text[2]);
    doc.text(p.label, curX + btnW / 2, curY + btnH / 2 + 1.8, { align: 'center' });

    // Attach individual clickable link for this exact button bounding box
    if (p.url) {
      doc.link(curX, curY, btnW, btnH, { url: p.url });
    }

    curX += btnW + gapX;
  });
};

function Database() {
  const { authFetch } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Top Tab Navigation: 'RECORDS' (Default) | 'EXPORTER' (Get Data)
  const [dbTab, setDbTab] = useState('RECORDS');
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [autoPoll, setAutoPoll] = useState(true);

  // Modal State
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobLeads, setJobLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [modalFilter, setModalFilter] = useState('ALL'); // 'ALL' | 'PHONE' | 'WEBSITE'
  const [copiedId, setCopiedId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Bulk Selection State in Records
  const [selectedJobIds, setSelectedJobIds] = useState([]);
  const [exportingBulk, setExportingBulk] = useState(false);

  // Targeted Data Exporter (Get Data) State
  const [getDataType, setGetDataType] = useState('emails'); // 'emails' | 'whatsapp' | 'phones' | 'socials' | 'all'
  const [exportJobIds, setExportJobIds] = useState([]);
  const [exportJobSearch, setExportJobSearch] = useState('');
  const [extractedLeads, setExtractedLeads] = useState([]);
  const [loadingExtracted, setLoadingExtracted] = useState(false);

  // Lock background scroll when modal is open and handle ESC key
  useEffect(() => {
    if (selectedJob) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') setSelectedJob(null);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = 'unset';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [selectedJob]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const fetchJobs = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const res = await authFetch(`${API_URL}/api/jobs`);
      if (!res.ok) throw new Error("Failed to load scraping history");
      const data = await res.json();
      setJobs(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      if (manual) setTimeout(() => setIsRefreshing(false), 400);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const fetchExtractedLeads = useCallback(async (jobIds, type) => {
    if (!jobIds || jobIds.length === 0) {
      setExtractedLeads([]);
      return;
    }
    setLoadingExtracted(true);
    try {
      const res = await authFetch(`${API_URL}/api/leads/by-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobIds, dataType: type })
      });
      const data = await res.json();
      setExtractedLeads(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error fetching leads for export:", e);
      showToast("Error extracting targeted leads");
    } finally {
      setLoadingExtracted(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (dbTab === 'EXPORTER') {
      fetchExtractedLeads(exportJobIds, getDataType);
    }
  }, [dbTab, exportJobIds, getDataType, fetchExtractedLeads]);

  // Dynamic Polling
  useEffect(() => {
    if (!autoPoll) return;
    const hasRunning = jobs.some(j => j.status === 'IN_PROGRESS');
    const intervalTime = hasRunning ? 3000 : 8000;
    
    const interval = setInterval(() => {
      fetchJobs(false);
    }, intervalTime);

    return () => clearInterval(interval);
  }, [autoPoll, jobs, fetchJobs]);

  const viewLeads = async (job) => {
    setSelectedJob(job);
    setLeadsLoading(true);
    setJobLeads([]);
    setModalSearch('');
    setModalFilter('ALL');
    
    try {
      const res = await authFetch(`${API_URL}/api/jobs/${job.id}/leads`);
      if (!res.ok) throw new Error("Failed to load leads");
      const data = await res.json();
      setJobLeads(data);
    } catch (err) {
      console.error(err);
      showToast("Failed to load leads from database");
    } finally {
      setLeadsLoading(false);
    }
  };

  const deleteJob = async (e, jobId) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete Job #${jobId} and its verified leads?`)) return;
    try {
      const res = await authFetch(`${API_URL}/api/jobs/${jobId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast(`Job #${jobId} deleted successfully`);
        if (selectedJob && selectedJob.id === jobId) {
          setSelectedJob(null);
        }
        fetchJobs(false);
      } else {
        showToast("Failed to delete job");
      }
    } catch (err) {
      console.error("Delete error:", err);
      showToast("Error deleting job");
    }
  };

  const copyToClipboard = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered Jobs
  const filteredJobs = useMemo(() => {
    const q = (searchQuery || '').toLowerCase();
    return jobs.filter(job => {
      if (!job) return false;
      const kw = (job.keyword || '').toLowerCase();
      const loc = (job.location || '').toLowerCase();
      const jid = (job.id ?? '').toString();
      const matchesSearch = !q || kw.includes(q) || loc.includes(q) || jid.includes(q);

      const matchesSource = sourceFilter === 'ALL' || job.source === sourceFilter;
      const matchesStatus = statusFilter === 'ALL' || job.status === statusFilter;

      return matchesSearch && matchesSource && matchesStatus;
    });
  }, [jobs, searchQuery, sourceFilter, statusFilter]);

  // Filtered Leads in Modal
  const filteredModalLeads = useMemo(() => {
    return jobLeads.filter(lead => {
      const q = modalSearch.toLowerCase();
      const matchesQuery = 
        (lead.name && lead.name.toLowerCase().includes(q)) ||
        (lead.address && lead.address.toLowerCase().includes(q)) ||
        (lead.phone && lead.phone.toLowerCase().includes(q)) ||
        (lead.website && lead.website.toLowerCase().includes(q));

      if (!matchesQuery) return false;

      if (modalFilter === 'PHONE') return !!lead.phone && lead.phone !== 'None';
      if (modalFilter === 'WEBSITE') return !!lead.website && lead.website !== 'None';
      if (modalFilter === 'WHATSAPP') return !!lead.whatsapp || (!!lead.mobile && lead.mobile !== 'None');
      if (modalFilter === 'MAX') return !!formatMaxNumber(lead.max_messenger || lead.phone || lead.mobile, lead.address || selectedJob?.location);

      return true;
    });
  }, [jobLeads, modalSearch, modalFilter]);

  // Robust Text Sanitizer to eliminate crashed / mojibake characters and unwanted domain slugs
  const sanitizeText = (text) => {
    if (!text) return '';
    let str = String(text);
    // Remove control characters & non-printable bytes
    str = str.replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F\uFFFD\uFEFF]/g, '');
    // Remove corrupted high-byte garbage sequences (e.g. þÿþÛ þÈţ þ› etc.)
    str = str.replace(/[\u00FE\u00FF\u00FD\u00DE\u00DF\u00C0-\u00C6\u00D0-\u00D6\u00D8-\u00DF\u00E0-\u00E6\u00F0-\u00F6\u00F8-\u00FD]{2,}/g, ' ');
    // Remove specific Yahoo artifact sequences
    str = str.replace(/Ø<[A-Za-z0-9\s&þ®ð›·]+/gi, ' ');
    str = str.replace(/[þÿ·ð®]+/gi, ' ');
    str = str.replace(/Â|â€¢|â€“|â€”|â€™|â€œ|â€/g, ' ');
    // Normalize spaces
    str = str.replace(/\s+/g, ' ').trim();
    return str;
  };

  const cleanBusinessName = (name) => {
    if (!name) return 'Business Contact';
    let str = sanitizeText(name);
    // Strip site domain prefixes like Facebookhttps://secure.facebook.com...
    str = str.replace(/^(?:Facebook|LinkedIn|Instagram|Twitter|YouTube|TikTok|Pinterest|Crunchbase|GitHub)?(?:https?:\/\/[^\s]+)?/i, '');
    // Remove arrow navigation titles
    const arrowIdx = str.lastIndexOf('›');
    if (arrowIdx > -1) str = str.substring(arrowIdx + 1).trim();
    // Remove duplicated lowercase slug prefix concatenated with uppercase name
    const match = str.match(/^([a-z0-9_-]{4,20})([A-Z].*)$/);
    if (match && match[2] && match[2].length > 3) {
      str = match[2];
    }
    // Remove handles like (@handle)
    str = str.replace(/\s*\(@[a-zA-Z0-9._-]+\)/gi, '');
    // Strip Call/WhatsApp prefixes
    str = str.replace(/^(?:Call\s*\/?\s*WhatsApp\s*[:\-]?\s*[+0-9\s-]+\s*)/i, '');
    // Strip on WhatsApp suffixes
    str = str.replace(/\s+on\s+WhatsApp.*/i, '');
    // Remove trailing site suffixes and metadata noise
    str = str.replace(/[•·|\-–—]\s*(?:Instagram|LinkedIn|Facebook|Twitter|YouTube|TikTok|Pinterest|Crunchbase|GitHub|Yellow Pages|Yelp|WhatsApp).*/gi, '');
    str = str.replace(/Photos and videos.*/gi, '').replace(/Posts.*/gi, '').replace(/Followers.*/gi, '').trim();
    str = str.split(' | ')[0].split(' - ')[0].trim();
    return str || 'Business Contact';
  };

  const cleanAddress = (addr, defaultLoc) => {
    if (!addr) return defaultLoc || 'Location';
    let str = sanitizeText(addr);
    // Filter out social metric/follower snippets from leaking into address
    if (str.includes('Followers') || str.includes('Following') || str.includes('Posts') || str.includes('Photos and videos') || str.length > 200) {
      return defaultLoc || 'Location';
    }
    // Remove social media post metadata prefixes like "Jun 4, 2026 · ...", "Posts ..."
    str = str.replace(/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\s*[·•-]?\s*/i, '');
    str = str.replace(/^Posts\s+/i, '');
    if (str.length < 3) return defaultLoc || 'Location';
    return str.substring(0, 160);
  };

  const formatMaxNumber = (phoneOrMobile, addressOrLoc = '') => {
    if (!phoneOrMobile || phoneOrMobile === 'None' || phoneOrMobile === '-') return null;
    const str = String(phoneOrMobile).trim();
    const digits = str.replace(/\D/g, '');
    const addr = String(addressOrLoc || '').toLowerCase();
    const isRussianContext = addr.includes('russia') || addr.includes('moskva') || addr.includes('moscow') || addr.includes('petersburg') || addr.includes('belarus') || addr.includes('kazakhstan') || addr.includes('россия') || addr.includes('москва');
    
    if (digits.length >= 10 && (digits.startsWith('7') || digits.startsWith('8') || isRussianContext)) {
      let raw = digits;
      if (raw.startsWith('8') && raw.length === 11) {
        raw = '7' + raw.substring(1);
      } else if (!raw.startsWith('7') && raw.length === 10) {
        raw = '7' + raw;
      }
      if (raw.startsWith('7') && raw.length === 11) {
        return `+7 (${raw.substring(1, 4)}) ${raw.substring(4, 7)}-${raw.substring(7, 9)}-${raw.substring(9, 11)}`;
      }
    }
    return null;
  };

  const openMaxChat = (maxNum, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (maxNum) {
      navigator.clipboard.writeText(maxNum);
      showToast(`Copied ${maxNum} • Opening MAX Web Messenger (web.max.ru)...`);
    }
    window.open('https://web.max.ru/', '_blank', 'noopener,noreferrer');
  };

  const exportExcel = (leadsToExport = jobLeads, jobInfo = selectedJob) => {
    if (leadsToExport.length === 0) return;
    try {
      const sanitizedRows = leadsToExport.map((lead, idx) => {
        const maxNum = formatMaxNumber(lead.max_messenger || lead.phone || lead.mobile, lead.address || jobInfo.location);
        return {
          'No.': idx + 1,
          'Business / Contact Name': cleanBusinessName(lead.name),
          'Category': sanitizeText(lead.category || jobInfo.keyword),
          'Email Address': sanitizeText(lead.emails || '-'),
          'Phone Number': sanitizeText(lead.phone || '-'),
          'MAX Messenger (RU)': sanitizeText(maxNum || '-'),
          'MAX Web Chat Link': maxNum ? 'https://web.max.ru/' : '-',
          'Mobile / WhatsApp': sanitizeText(lead.whatsapp ? lead.whatsapp.replace(/.*wa\.me\//i, '+') : (lead.mobile || '-')),
          'Direct WhatsApp Link': sanitizeText(lead.whatsapp || (lead.mobile ? `https://wa.me/${lead.mobile.replace(/\D/g, '')}` : '-')),
          'Website / Domain': sanitizeText(lead.website || '-'),
        'Instagram': sanitizeText(lead.instagram || '-'),
        'LinkedIn': sanitizeText(lead.linkedin || '-'),
        'Facebook': sanitizeText(lead.facebook || '-'),
        'Twitter / X': sanitizeText(lead.twitter || '-'),
        'YouTube': sanitizeText(lead.youtube || '-'),
        'TikTok': sanitizeText(lead.tiktok || '-'),
        'Pinterest': sanitizeText(lead.pinterest || '-'),
        'Telegram': sanitizeText(lead.telegram || '-'),
        'City / Address': cleanAddress(lead.address, jobInfo.location),
        'Source Link': sanitizeText(lead.source_link || '-')
      };
    });

      // Create Worksheet
      const worksheet = XLSX.utils.json_to_sheet(sanitizedRows, { origin: 'A6' });

      // Add Corporate Title & Watermark Header Rows
      XLSX.utils.sheet_add_aoa(worksheet, [
        ['CONTAQUES INTELLIGENCE REPORT', '', '', '', '', '', ''],
        ['POWERED BY KLYROVA INFOTECH', '', '', '', '', '', ''],
        [`Query: ${jobInfo.keyword}`, `Location: ${jobInfo.location}`, `Source: ${jobInfo.source.toUpperCase()}`, `Total Leads: ${leadsToExport.length}`, `Export Date: ${new Date().toLocaleString()}`, '', ''],
        ['', '', '', '', '', '', '']
      ], { origin: 'A1' });

      // Add Help Me & Support Section at the bottom
      const endRowIndex = sanitizedRows.length + 8;
      XLSX.utils.sheet_add_aoa(worksheet, [
        ['', '', '', '', '', '', ''],
        ['HELP & SUPPORT • KLYROVA INFOTECH', '', '', '', '', '', ''],
        ['Need custom scraper development, B2B data pipelines, or technical help?', '', '', '', '', '', ''],
        ['Official Instagram Support Link:', 'https://www.instagram.com/klyrova_inc/', 'Click link to chat with Klyrova Infotech team', '', '', '', '']
      ], { origin: `A${endRowIndex}` });

      // Set Column Widths to prevent content truncation/crashing
      worksheet['!cols'] = [
        { wch: 6 },   // No.
        { wch: 32 },  // Name
        { wch: 20 },  // Category
        { wch: 28 },  // Email
        { wch: 20 },  // Phone
        { wch: 20 },  // Mobile
        { wch: 38 },  // Website
        { wch: 30 },  // IG
        { wch: 30 },  // IN
        { wch: 30 },  // FB
        { wch: 30 },  // Twitter/X
        { wch: 30 },  // YouTube
        { wch: 30 },  // TikTok
        { wch: 30 },  // Pinterest
        { wch: 30 },  // Telegram
        { wch: 48 },  // Address
        { wch: 45 }   // Source Link
      ];

      // Convert text URLs to clickable Excel hyperlinks
      for (let R = 6; R < sanitizedRows.length + 6; ++R) {
        // Columns: D=3(Email), G=6(Web), H=7(IG), I=8(IN), J=9(FB), K=10(TW), L=11(YT), M=12(TT), N=13(PIN), O=14(TG), Q=16(Source)
        [3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16].forEach(C => {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = worksheet[cellAddress];
          if (cell && cell.v && cell.v !== '-') {
            let url = String(cell.v).trim();
            if (C === 3) {
              url = url.split(',')[0].trim();
              if (!url.startsWith('mailto:')) url = `mailto:${url}`;
            } else {
              if (!url.startsWith('http')) url = `https://${url}`;
            }
            cell.l = { Target: url };
          }
        });
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Verified Leads");

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `leads_job_${jobInfo.id}_${jobInfo.keyword.replace(/\s+/g, '_')}_Klyrova.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Excel generated with Klyrova Infotech watermark & Help link!");
    } catch (e) {
      console.error(e);
      showToast("Error generating Excel file.");
    }
  };

  const formatDisplayUrl = (url) => {
    if (!url || url === '-') return '-';
    try {
      let clean = url.replace(/^https?:\/\/(www\.)?/i, '');
      clean = clean.split('?')[0].split('#')[0];
      if (clean.length > 32) {
        clean = clean.substring(0, 30) + '...';
      }
      return clean.replace(/\/$/, '') || '-';
    } catch {
      return String(url).substring(0, 30);
    }
  };

  const formatSourceLabel = (url) => {
    if (!url || url === '-') return '-';
    if (url.includes('maps.google.com') || url.includes('google.com/maps')) {
      return 'Google Maps Profile';
    }
    if (url.includes('facebook.com')) {
      return 'Facebook Profile';
    }
    if (url.includes('instagram.com')) {
      return 'Instagram Profile';
    }
    if (url.includes('linkedin.com')) {
      return 'LinkedIn Profile';
    }
    if (url.includes('yellowpages.com') || url.includes('yell.com')) {
      return 'YellowPages Listing';
    }
    return formatDisplayUrl(url);
  };

  const exportPDF = (leadsToExport = jobLeads, jobInfo = selectedJob) => {
    if (leadsToExport.length === 0) return;
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const tableColumn = ["#", "Business Name", "Category", "Contact (Email/Mobile)", "Social Links", "Website / Domain", "Address", "Source Link"];
      const tableRows = leadsToExport.map((lead, idx) => {
        let contactStr = sanitizeText(lead.emails || '-');
        let phoneStr = sanitizeText(lead.mobile || lead.phone);
        if (phoneStr && phoneStr !== '-') {
          contactStr += '\n' + phoneStr;
        }

        return [
          idx + 1,
          cleanBusinessName(lead.name),
          sanitizeText(lead.category || jobInfo?.keyword || 'GENERAL').substring(0, 20),
          contactStr,
          '', // Leave empty so custom button badges render cleanly without overlapping text
          formatDisplayUrl(lead.website),
          cleanAddress(lead.address, jobInfo?.location),
          formatSourceLabel(lead.source_link)
        ];
      });

      const supportUrl = 'https://www.instagram.com/klyrova_inc/';

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 68,
        margin: { top: 68, bottom: 44, left: 16, right: 16 },
        theme: 'grid',
        tableLineColor: [180, 190, 205],
        tableLineWidth: 0.8,
        styles: { 
          fontSize: 7.5, 
          cellPadding: 4.5, 
          overflow: 'linebreak',
          font: 'helvetica',
          textColor: [31, 29, 25],
          lineColor: [218, 223, 233],
          lineWidth: 0.6,
          valign: 'middle'
        },
        columnStyles: {
          0: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 130, fontStyle: 'bold', textColor: [31, 29, 25] },
          2: { cellWidth: 65, textColor: [80, 75, 65] },
          3: { cellWidth: 105, textColor: [50, 45, 40] },
          4: { cellWidth: 86, minCellHeight: 22 },
          5: { cellWidth: 115, textColor: [120, 80, 40] },
          6: { cellWidth: 170, textColor: [40, 35, 30] },
          7: { cellWidth: 115, textColor: [120, 80, 40], fontSize: 7 }
        },
        headStyles: { 
          fillColor: [222, 215, 200], 
          textColor: [49, 46, 39], 
          fontSize: 8, 
          fontStyle: 'bold',
          lineColor: [200, 190, 175],
          lineWidth: 0.8,
          halign: 'left',
          valign: 'middle'
        },
        alternateRowStyles: { 
          fillColor: [248, 246, 240] 
        },
        didDrawCell: (data) => {
          if (data.section === 'body') {
            const rawLead = leadsToExport[data.row.index];
            if (!rawLead) return;

            // Render individual styled button badges with dedicated clickable links (Index 4)
            if (data.column.index === 4) {
              drawPdfSocialBadges(doc, data.cell, rawLead);
            }

            // Make Website column (Index 5) active clickable hyperlink
            if (data.column.index === 5 && rawLead.website && rawLead.website !== '-') {
              const url = rawLead.website.startsWith('http') ? rawLead.website : `https://${rawLead.website}`;
              doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
            }

            // Make Source Reference column (Index 7) active clickable hyperlink
            if (data.column.index === 7 && rawLead.source_link && rawLead.source_link !== '-') {
              const url = rawLead.source_link.startsWith('http') ? rawLead.source_link : `https://${rawLead.source_link}`;
              doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
            }
          }
        },
        didDrawPage: (data) => {
          // 1. Subtle Diagonal Watermark on Every Page
          doc.saveGraphicsState();
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(46);
          doc.setTextColor(235, 230, 220); // faint beige
          doc.text('KLYROVA INFOTECH', pageWidth / 2, pageHeight / 2, { align: 'center', angle: 26 });
          doc.restoreGraphicsState();

          // 2. Top Header Banner Bar with Outline & Rounded Card
          doc.setFillColor(210, 200, 180); // beige banner
          doc.roundedRect(24, 12, pageWidth - 48, 46, 4, 4, 'F');
          
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.setTextColor(49, 46, 39); // dark text
          doc.text('CONTAQUES INTELLIGENCE  •  POWERED BY KLYROVA INFOTECH', 38, 29);
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.2);
          doc.setTextColor(80, 75, 65); // dark grey-brown
          doc.text(`Query: ${jobInfo?.keyword || 'ALL'}   |   Location: ${jobInfo?.location || 'GLOBAL'}   |   Engine: ${(jobInfo?.source || 'WEB').toUpperCase()}   |   Verified Leads: ${leadsToExport.length}`, 38, 46);

          // Top Right Tag
          doc.setFillColor(180, 170, 150); // darker beige tag
          doc.roundedRect(pageWidth - 145, 18, 110, 32, 4, 4, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(25, 20, 15);
          doc.text('VERIFIED REPORT', pageWidth - 90, 37, { align: 'center' });

          // 3. Bottom Footer with Page Info & Clickable "Help Me" Button on EVERY Page
          const footerY = pageHeight - 16;
          
          // Divider
          doc.setDrawColor(218, 222, 230);
          doc.setLineWidth(0.8);
          doc.line(24, pageHeight - 32, pageWidth - 24, pageHeight - 32);

          // Left Footer (Compact to prevent collision)
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(130, 125, 115);
          doc.text('CONFIDENTIAL REPORT • KLYROVA INFOTECH', 26, footerY);

          // Center Clickable "Help Me" Button Box (No raw emoji to prevent glyph glitch)
          const helpBoxWidth = 280;
          const helpBoxX = (pageWidth - helpBoxWidth) / 2;
          const helpBoxY = pageHeight - 34;
          
          doc.setFillColor(235, 230, 220); // beige button
          doc.roundedRect(helpBoxX, helpBoxY, helpBoxWidth, 20, 3, 3, 'F');
          doc.setDrawColor(199, 210, 254);
          doc.roundedRect(helpBoxX, helpBoxY, helpBoxWidth, 20, 3, 3, 'D');

          doc.setTextColor(60, 50, 40);
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'bold');
          doc.text('Need Custom Scrapers or Support? Click: @klyrova_inc', pageWidth / 2, footerY - 5, { align: 'center' });
          
          // Interactive Hyperlink Area for Help Me Button
          doc.link(helpBoxX, helpBoxY, helpBoxWidth, 20, { url: supportUrl });

          // Right Page Number
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(130, 125, 115);
          doc.text(`Page ${data.pageNumber}`, pageWidth - 26, footerY);
        }
      });

      doc.save(`leads_job_${jobInfo?.id || 'export'}_${(jobInfo?.keyword || 'leads').replace(/\s+/g, '_')}_Klyrova.pdf`);
      showToast("PDF generated with Klyrova Infotech layout!");
    } catch (e) {
      console.error(e);
      showToast("Error generating PDF file.");
    }
  };

  const handleBulkExport = async (format) => {
    if (selectedJobIds.length === 0) return;
    setExportingBulk(true);
    showToast(`Fetching leads for ${selectedJobIds.length} jobs...`);
    
    try {
      const promises = selectedJobIds.map(id => authFetch(`${API_URL}/api/jobs/${id}/leads`).then(res => res.json()));
      const results = await Promise.all(promises);
      const allLeads = results.flat();
      
      if (allLeads.length === 0) {
        showToast("No leads found in the selected jobs.");
        setExportingBulk(false);
        return;
      }
      
      const mixedJob = {
        id: 'BULK',
        keyword: 'Multiple Selected Jobs',
        location: 'Multiple Locations',
        source: 'MIXED'
      };

      if (format === 'excel') {
        exportExcel(allLeads, mixedJob);
      } else {
        exportPDF(allLeads, mixedJob);
      }
    } catch (err) {
      console.error(err);
      showToast("Error exporting bulk data");
    } finally {
      setExportingBulk(false);
    }
  };

  const handleTargetedExport = (format) => {
    if (extractedLeads.length === 0) {
      showToast("No leads available to export. Please select at least one job.");
      return;
    }

    const typeLabel = getDataType === 'emails' ? 'Emails' :
                      getDataType === 'whatsapp' ? 'WhatsApp' :
                      getDataType === 'socials' ? 'Socials' :
                      getDataType === 'phones' ? 'Phones' : 'All_Master_Data';
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `Contaques_${typeLabel}_${timestamp}_Klyrova`;

    if (format === 'excel' || format === 'csv') {
      let exportRows = [];

      if (getDataType === 'whatsapp') {
        exportRows = extractedLeads.map((l, idx) => {
          const rawWa = l.whatsapp || l.mobile;
          const waDigits = rawWa ? String(rawWa).replace(/\D/g, '') : '';
          const waLink = waDigits ? `https://wa.me/${waDigits}` : '-';
          return {
            'No.': idx + 1,
            'Business Name': cleanBusinessName(l.name),
            'Category': sanitizeText(l.category || l.job_keyword || '-'),
            'Verified WhatsApp / Mobile': sanitizeText(rawWa ? (rawWa.startsWith('+') ? rawWa : `+${waDigits}`) : '-'),
            'Direct WhatsApp Chat Link': waLink,
            'Landline / Phone': sanitizeText(l.phone || '-'),
            'Verified Email': sanitizeText(l.emails || '-'),
            'Website': sanitizeText(l.website || '-'),
            'City / Address': cleanAddress(l.address, l.job_location),
            'Location': sanitizeText(l.job_location || '-'),
            'Source Link': sanitizeText(l.source_link || '-')
          };
        });
      } else if (getDataType === 'emails') {
        exportRows = extractedLeads.map((l, idx) => ({
          'No.': idx + 1,
          'Business Name': cleanBusinessName(l.name),
          'Category': sanitizeText(l.category || l.job_keyword || '-'),
          'Verified Email': sanitizeText(l.emails || '-'),
          'Website': sanitizeText(l.website || '-'),
          'Phone Number': sanitizeText(l.phone || '-'),
          'Mobile / WhatsApp': sanitizeText(l.whatsapp || l.mobile || '-'),
          'City / Address': cleanAddress(l.address, l.job_location),
          'Location': sanitizeText(l.job_location || '-'),
          'Source Link': sanitizeText(l.source_link || '-')
        }));
      } else if (getDataType === 'max') {
        exportRows = extractedLeads.map((l, idx) => {
          const maxNum = formatMaxNumber(l.max_messenger || l.phone || l.mobile, l.address || l.job_location);
          return {
            'No.': idx + 1,
            'Business Name': cleanBusinessName(l.name),
            'Category': sanitizeText(l.category || l.job_keyword || '-'),
            'MAX Messenger Phone (RU)': maxNum || sanitizeText(l.phone || l.mobile || '-'),
            'MAX Web Chat Link': maxNum ? 'https://web.max.ru/' : '-',
            'Phone / Landline': sanitizeText(l.phone || '-'),
            'Website': sanitizeText(l.website || '-'),
            'Verified Email': sanitizeText(l.emails || '-'),
            'City / Address': cleanAddress(l.address, l.job_location),
            'Location': sanitizeText(l.job_location || '-'),
            'Source Link': sanitizeText(l.source_link || '-')
          };
        });
      } else if (getDataType === 'phones') {
        exportRows = extractedLeads.map((l, idx) => {
          const rawWa = l.whatsapp || l.mobile;
          const waDigits = rawWa ? String(rawWa).replace(/\D/g, '') : '';
          const waLink = waDigits ? `https://wa.me/${waDigits}` : '-';
          return {
            'No.': idx + 1,
            'Business Name': cleanBusinessName(l.name),
            'Category': sanitizeText(l.category || l.job_keyword || '-'),
            'Phone Number': sanitizeText(l.phone || '-'),
            'Mobile / WhatsApp': sanitizeText(rawWa || '-'),
            'Direct WhatsApp Chat Link': waLink,
            'Website': sanitizeText(l.website || '-'),
            'Verified Email': sanitizeText(l.emails || '-'),
            'City / Address': cleanAddress(l.address, l.job_location),
            'Location': sanitizeText(l.job_location || '-'),
            'Source Link': sanitizeText(l.source_link || '-')
          };
        });
      } else if (getDataType === 'socials') {
        exportRows = extractedLeads.map((l, idx) => ({
          'No.': idx + 1,
          'Business Name': cleanBusinessName(l.name),
          'Category': sanitizeText(l.category || l.job_keyword || '-'),
          'Instagram': sanitizeText(l.instagram || '-'),
          'Facebook': sanitizeText(l.facebook || '-'),
          'LinkedIn': sanitizeText(l.linkedin || '-'),
          'Twitter / X': sanitizeText(l.twitter || '-'),
          'YouTube': sanitizeText(l.youtube || '-'),
          'TikTok': sanitizeText(l.tiktok || '-'),
          'Pinterest': sanitizeText(l.pinterest || '-'),
          'Telegram': sanitizeText(l.telegram || '-'),
          'Website': sanitizeText(l.website || '-'),
          'Phone Number': sanitizeText(l.phone || l.mobile || '-'),
          'Verified Email': sanitizeText(l.emails || '-'),
          'City / Address': cleanAddress(l.address, l.job_location),
          'Location': sanitizeText(l.job_location || '-'),
          'Source Link': sanitizeText(l.source_link || '-')
        }));
      } else {
        // all
        exportRows = extractedLeads.map((l, idx) => {
          const rawWa = l.whatsapp || l.mobile;
          const waDigits = rawWa ? String(rawWa).replace(/\D/g, '') : '';
          const waLink = waDigits ? `https://wa.me/${waDigits}` : '-';
          return {
            'No.': idx + 1,
            'Business Name': cleanBusinessName(l.name),
            'Category': sanitizeText(l.category || l.job_keyword || '-'),
            'Verified Email': sanitizeText(l.emails || '-'),
            'Phone Number': sanitizeText(l.phone || '-'),
            'Mobile / WhatsApp': sanitizeText(rawWa || '-'),
            'Direct WhatsApp Chat Link': waLink,
            'Website': sanitizeText(l.website || '-'),
            'Instagram': sanitizeText(l.instagram || '-'),
            'Facebook': sanitizeText(l.facebook || '-'),
            'LinkedIn': sanitizeText(l.linkedin || '-'),
            'Twitter / X': sanitizeText(l.twitter || '-'),
            'YouTube': sanitizeText(l.youtube || '-'),
            'TikTok': sanitizeText(l.tiktok || '-'),
            'Pinterest': sanitizeText(l.pinterest || '-'),
            'Telegram': sanitizeText(l.telegram || '-'),
            'City / Address': cleanAddress(l.address, l.job_location),
            'Location': sanitizeText(l.job_location || '-'),
            'Source Link': sanitizeText(l.source_link || '-')
          };
        });
      }

      if (format === 'excel') {
        const worksheet = XLSX.utils.json_to_sheet(exportRows, { origin: 'A6' });

        XLSX.utils.sheet_add_aoa(worksheet, [
          ['CONTAQUES INTELLIGENCE REPORT - TARGETED DATA EXPORTER', '', '', '', '', '', ''],
          ['POWERED BY KLYROVA INFOTECH', '', '', '', '', '', ''],
          [`Dataset: ${typeLabel.toUpperCase()}`, `Total Verified Leads: ${extractedLeads.length}`, `Selected Jobs: ${exportJobIds.length}`, `Export Date: ${new Date().toLocaleString()}`, '', '', ''],
          ['', '', '', '', '', '', '']
        ], { origin: 'A1' });

        const endRowIndex = exportRows.length + 8;
        XLSX.utils.sheet_add_aoa(worksheet, [
          ['', '', '', '', '', '', ''],
          ['HELP & SUPPORT • KLYROVA INFOTECH', '', '', '', '', '', ''],
          ['Need custom scraper development, B2B data pipelines, or technical help?', '', '', '', '', '', ''],
          ['Official Instagram Support Link:', 'https://www.instagram.com/klyrova_inc/', 'Click link to chat with Klyrova Infotech team', '', '', '', '']
        ], { origin: `A${endRowIndex}` });

        worksheet['!cols'] = Array(20).fill({ wch: 26 });
        worksheet['!cols'][0] = { wch: 6 };
        worksheet['!cols'][1] = { wch: 32 };

        for (let R = 6; R < exportRows.length + 6; ++R) {
          for (let C = 2; C < 20; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = worksheet[cellAddress];
            if (cell && cell.v && cell.v !== '-') {
              let val = String(cell.v).trim();
              if (val.includes('@') && !val.startsWith('http') && !val.includes('/')) {
                cell.l = { Target: `mailto:${val.split(',')[0].trim()}` };
              } else if (val.startsWith('http://') || val.startsWith('https://')) {
                cell.l = { Target: val };
              } else if (val.startsWith('wa.me/')) {
                cell.l = { Target: `https://${val}` };
              }
            }
          }
        }

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `${typeLabel} Data`);
        XLSX.writeFile(workbook, `${filename}.xlsx`);
        showToast(`Downloaded ${extractedLeads.length} leads as Excel (.xlsx)!`);
      } else {
        const ws = XLSX.utils.json_to_sheet(exportRows);
        const csvContent = '\uFEFF' + XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `${filename}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`Downloaded ${extractedLeads.length} leads as CSV (.csv)!`);
      }
    } else if (format === 'pdf') {
      try {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const supportUrl = 'https://www.instagram.com/klyrova_inc/';

        let tableColumn = [];
        let tableRows = [];
        let colStyles = {};

        if (getDataType === 'whatsapp') {
          tableColumn = ["#", "Business Name", "Category", "Verified WhatsApp", "WhatsApp Link", "Landline / Phone", "Website", "Location"];
          tableRows = extractedLeads.map((lead, idx) => {
            const rawWa = lead.whatsapp || lead.mobile;
            const waDigits = rawWa ? String(rawWa).replace(/\D/g, '') : '';
            const waLink = waDigits ? `https://wa.me/${waDigits}` : '-';
            return [
              idx + 1,
              cleanBusinessName(lead.name),
              sanitizeText(lead.category || lead.job_keyword).substring(0, 20),
              rawWa || '-',
              waLink !== '-' ? `wa.me/${waDigits}` : '-',
              sanitizeText(lead.phone || '-'),
              formatDisplayUrl(lead.website),
              cleanAddress(lead.address, lead.job_location)
            ];
          });
          colStyles = {
            0: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: 140, fontStyle: 'bold', textColor: [31, 29, 25] },
            2: { cellWidth: 70, textColor: [80, 75, 65] },
            3: { cellWidth: 105, textColor: [22, 163, 74], fontStyle: 'bold' },
            4: { cellWidth: 110, textColor: [21, 128, 61], fontStyle: 'bold' },
            5: { cellWidth: 95, textColor: [60, 55, 50] },
            6: { cellWidth: 115, textColor: [120, 80, 40] },
            7: { cellWidth: 140, textColor: [40, 35, 30] }
          };
        } else if (getDataType === 'max') {
          tableColumn = ["#", "Business Name", "Category", "MAX Phone (RU)", "MAX Web Chat", "Landline / Phone", "Website", "Location"];
          tableRows = extractedLeads.map((lead, idx) => {
            const maxNum = formatMaxNumber(lead.max_messenger || lead.phone || lead.mobile, lead.address || lead.job_location);
            return [
              idx + 1,
              cleanBusinessName(lead.name),
              sanitizeText(lead.category || lead.job_keyword).substring(0, 20),
              maxNum || '-',
              'web.max.ru',
              sanitizeText(lead.phone || '-'),
              formatDisplayUrl(lead.website),
              cleanAddress(lead.address, lead.job_location)
            ];
          });
          colStyles = {
            0: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: 140, fontStyle: 'bold', textColor: [31, 29, 25] },
            2: { cellWidth: 70, textColor: [80, 75, 65] },
            3: { cellWidth: 110, textColor: [219, 39, 119], fontStyle: 'bold' },
            4: { cellWidth: 100, textColor: [190, 24, 93], fontStyle: 'bold' },
            5: { cellWidth: 95, textColor: [60, 55, 50] },
            6: { cellWidth: 115, textColor: [120, 80, 40] },
            7: { cellWidth: 145, textColor: [40, 35, 30] }
          };
        } else if (getDataType === 'emails') {
          tableColumn = ["#", "Business Name", "Category", "Verified Email", "Website / Domain", "Phone / Mobile", "Address / Location", "Source Link"];
          tableRows = extractedLeads.map((lead, idx) => [
            idx + 1,
            cleanBusinessName(lead.name),
            sanitizeText(lead.category || lead.job_keyword).substring(0, 20),
            sanitizeText(lead.emails || '-'),
            formatDisplayUrl(lead.website),
            sanitizeText(lead.phone || lead.mobile || '-'),
            cleanAddress(lead.address, lead.job_location),
            formatSourceLabel(lead.source_link)
          ]);
          colStyles = {
            0: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: 140, fontStyle: 'bold', textColor: [31, 29, 25] },
            2: { cellWidth: 70, textColor: [80, 75, 65] },
            3: { cellWidth: 155, textColor: [79, 70, 229], fontStyle: 'bold' },
            4: { cellWidth: 115, textColor: [120, 80, 40] },
            5: { cellWidth: 95, textColor: [50, 45, 40] },
            6: { cellWidth: 130, textColor: [40, 35, 30] },
            7: { cellWidth: 70, textColor: [120, 80, 40], fontSize: 7 }
          };
        } else if (getDataType === 'phones') {
          tableColumn = ["#", "Business Name", "Category", "Phone Number", "Mobile / WhatsApp", "Address / Location", "Website", "Source"];
          tableRows = extractedLeads.map((lead, idx) => [
            idx + 1,
            cleanBusinessName(lead.name),
            sanitizeText(lead.category || lead.job_keyword).substring(0, 20),
            sanitizeText(lead.phone || '-'),
            sanitizeText(lead.mobile || lead.whatsapp || '-'),
            cleanAddress(lead.address, lead.job_location),
            formatDisplayUrl(lead.website),
            formatSourceLabel(lead.source_link)
          ]);
          colStyles = {
            0: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: 145, fontStyle: 'bold', textColor: [31, 29, 25] },
            2: { cellWidth: 75, textColor: [80, 75, 65] },
            3: { cellWidth: 110, textColor: [22, 163, 74], fontStyle: 'bold' },
            4: { cellWidth: 110, textColor: [21, 128, 61], fontStyle: 'bold' },
            5: { cellWidth: 165, textColor: [40, 35, 30] },
            6: { cellWidth: 100, textColor: [120, 80, 40] },
            7: { cellWidth: 70, textColor: [120, 80, 40], fontSize: 7 }
          };
        } else if (getDataType === 'socials') {
          tableColumn = ["#", "Business Name", "Category", "Social Handles / Links", "Website / Domain", "Phone / Contact", "Location", "Source"];
          tableRows = extractedLeads.map((lead, idx) => {
            return [
              idx + 1,
              cleanBusinessName(lead.name),
              sanitizeText(lead.category || lead.job_keyword).substring(0, 20),
              '', // Drawn as buttons in didDrawCell
              formatDisplayUrl(lead.website),
              sanitizeText(lead.phone || lead.mobile || '-'),
              cleanAddress(lead.address, lead.job_location),
              formatSourceLabel(lead.source_link)
            ];
          });
          colStyles = {
            0: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: 140, fontStyle: 'bold', textColor: [31, 29, 25] },
            2: { cellWidth: 70, textColor: [80, 75, 65] },
            3: { cellWidth: 130, minCellHeight: 22 },
            4: { cellWidth: 120, textColor: [120, 80, 40] },
            5: { cellWidth: 95, textColor: [50, 45, 40] },
            6: { cellWidth: 130, textColor: [40, 35, 30] },
            7: { cellWidth: 80, textColor: [120, 80, 40], fontSize: 7 }
          };
        } else {
          tableColumn = ["#", "Business Name", "Category", "Contact (Email / Phone)", "WhatsApp Link", "Socials", "Website", "Location"];
          tableRows = extractedLeads.map((lead, idx) => {
            let contactStr = sanitizeText(lead.emails || '-');
            let phoneStr = sanitizeText(lead.phone || lead.mobile);
            if (phoneStr && phoneStr !== '-') contactStr += '\n' + phoneStr;

            const rawWa = lead.whatsapp || lead.mobile;
            const waDigits = rawWa ? String(rawWa).replace(/\D/g, '') : '';
            const waLink = waDigits ? `wa.me/${waDigits}` : '-';

            return [
              idx + 1,
              cleanBusinessName(lead.name),
            sanitizeText(lead.category || lead.job_keyword).substring(0, 18),
              contactStr,
              waLink,
              '', // Drawn as buttons in didDrawCell
              formatDisplayUrl(lead.website),
              cleanAddress(lead.address, lead.job_location)
            ];
          });
          colStyles = {
            0: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: 130, fontStyle: 'bold', textColor: [31, 29, 25] },
            2: { cellWidth: 65, textColor: [80, 75, 65] },
            3: { cellWidth: 110, textColor: [50, 45, 40] },
            4: { cellWidth: 90, textColor: [21, 128, 61], fontStyle: 'bold' },
            5: { cellWidth: 86, minCellHeight: 22 },
            6: { cellWidth: 115, textColor: [120, 80, 40] },
            7: { cellWidth: 165, textColor: [40, 35, 30] }
          };
        }

        autoTable(doc, {
          head: [tableColumn],
          body: tableRows,
          startY: 68,
          margin: { top: 68, bottom: 44, left: 16, right: 16 },
          theme: 'grid',
          tableLineColor: [180, 190, 205],
          tableLineWidth: 0.8,
          styles: { 
            fontSize: 7.5, 
            cellPadding: 4.5, 
            overflow: 'linebreak', 
            font: 'helvetica',
            textColor: [31, 29, 25],
            lineColor: [218, 223, 233],
            lineWidth: 0.6,
            valign: 'middle'
          },
          columnStyles: colStyles,
          headStyles: { 
            fillColor: [222, 215, 200], 
            textColor: [49, 46, 39], 
            fontSize: 8, 
            fontStyle: 'bold',
            lineColor: [200, 190, 175],
            lineWidth: 0.8,
            halign: 'left',
            valign: 'middle'
          },
          alternateRowStyles: { 
            fillColor: [248, 246, 240] 
          },
          didDrawCell: (data) => {
            if (data.section === 'body') {
              const rawLead = extractedLeads[data.row.index];
              if (!rawLead) return;

              if (getDataType === 'socials') {
                if (data.column.index === 3) {
                  drawPdfSocialBadges(doc, data.cell, rawLead);
                }
                if (data.column.index === 4 && rawLead.website && rawLead.website !== '-') {
                  const url = rawLead.website.startsWith('http') ? rawLead.website : `https://${rawLead.website}`;
                  doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
                }
                if (data.column.index === 7 && rawLead.source_link && rawLead.source_link !== '-') {
                  const url = rawLead.source_link.startsWith('http') ? rawLead.source_link : `https://${rawLead.source_link}`;
                  doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
                }
              } else {
                if (data.column.index === 4) {
                  const rawWa = rawLead.whatsapp || rawLead.mobile || rawLead.phone;
                  const waDigits = rawWa ? String(rawWa).replace(/\D/g, '') : '';
                  if (waDigits.length >= 7) {
                    const waUrl = (rawLead.whatsapp && rawLead.whatsapp.startsWith('http')) ? rawLead.whatsapp : `https://wa.me/${waDigits}`;
                    doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: waUrl });
                  }
                }
                if (data.column.index === 5) {
                  drawPdfSocialBadges(doc, data.cell, rawLead);
                }
                if (data.column.index === 6 && rawLead.website && rawLead.website !== '-') {
                  const url = rawLead.website.startsWith('http') ? rawLead.website : `https://${rawLead.website}`;
                  doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
                }
              }
            }
          },
          didDrawPage: (data) => {
            // 1. Watermark
            doc.saveGraphicsState();
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(44);
            doc.setTextColor(235, 230, 220);
            doc.text('KLYROVA INFOTECH', pageWidth / 2, pageHeight / 2, { align: 'center', angle: 26 });
            doc.restoreGraphicsState();

            // 2. Banner
            doc.setFillColor(210, 200, 180);
            doc.roundedRect(24, 12, pageWidth - 48, 46, 4, 4, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(49, 46, 39);
            doc.text('CONTAQUES INTELLIGENCE  •  TARGETED DATA EXPORTER', 38, 29);
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.2);
            doc.setTextColor(80, 75, 65);
            doc.text(`Dataset: ${typeLabel.toUpperCase()}   |   Total Verified Leads: ${extractedLeads.length}   |   Jobs Selected: ${exportJobIds.length}   |   Export Date: ${new Date().toLocaleDateString()}`, 38, 46);

            doc.setFillColor(180, 170, 150);
            doc.roundedRect(pageWidth - 145, 18, 110, 32, 4, 4, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(25, 20, 15);
            doc.text('VERIFIED REPORT', pageWidth - 90, 37, { align: 'center' });

            // 3. Footer
            const footerY = pageHeight - 16;
            doc.setDrawColor(218, 222, 230);
            doc.setLineWidth(0.8);
            doc.line(24, pageHeight - 32, pageWidth - 24, pageHeight - 32);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(130, 125, 115);
            doc.text('CONFIDENTIAL REPORT • KLYROVA INFOTECH', 26, footerY);

            const helpBoxWidth = 280;
            const helpBoxX = (pageWidth - helpBoxWidth) / 2;
            const helpBoxY = pageHeight - 34;
            
            doc.setFillColor(235, 230, 220);
            doc.roundedRect(helpBoxX, helpBoxY, helpBoxWidth, 20, 3, 3, 'F');
            doc.setDrawColor(199, 210, 254);
            doc.roundedRect(helpBoxX, helpBoxY, helpBoxWidth, 20, 3, 3, 'D');

            doc.setTextColor(60, 50, 40);
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            doc.text('Need Custom Scrapers or Support? Click: @klyrova_inc', pageWidth / 2, footerY - 5, { align: 'center' });
            doc.link(helpBoxX, helpBoxY, helpBoxWidth, 20, { url: supportUrl });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(130, 125, 115);
            doc.text(`Page ${data.pageNumber}`, pageWidth - 26, footerY);
          }
        });

        doc.save(`${filename}.pdf`);
        showToast(`Downloaded ${extractedLeads.length} leads as Klyrova Executive PDF!`);
      } catch (err) {
        console.error("PDF Export error:", err);
        showToast("Error generating executive PDF file.");
      }
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedJobIds(filteredJobs.map(j => j.id));
    } else {
      setSelectedJobIds([]);
    }
  };

  const handleSelectJob = (e, id) => {
    e.stopPropagation();
    if (e.target.checked) {
      setSelectedJobIds(prev => [...prev, id]);
    } else {
      setSelectedJobIds(prev => prev.filter(jId => jId !== id));
    }
  };

  const getSourceBadge = (source) => {
    switch (source) {
      case 'maps': return <span className="src-pill maps">Google Data</span>;
      case 'dorking': return <span className="src-pill dorking">Business Index</span>;
      case 'yellowpages': return <span className="src-pill yellowpages">Yellow Pages</span>;
      case 'yandex': return <span className="src-pill yandex">Yandex</span>;
      case 'whatsapp': return <span className="src-pill whatsapp">WhatsApp Radar</span>;
      default: return <span className="src-pill">{source}</span>;
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'COMPLETED':
        return (
          <div className="status-pill-badge success">
            <CheckCircle2 size={13} />
            <span>COMPLETED</span>
          </div>
        );
      case 'IN_PROGRESS':
        return (
          <div className="status-pill-badge warning">
            <Clock size={13} className="spin-slow" />
            <span>SCRAPING</span>
          </div>
        );
      case 'FAILED':
        return (
          <div className="status-pill-badge danger">
            <XCircle size={13} />
            <span>FAILED</span>
          </div>
        );
      default:
        return <span className="status-pill-badge">{status}</span>;
    }
  };

  // Render side-by-side clickable text badge pills (IG, FB, LI, X, WA, YT, TT, PIN, TG)
  const renderSocialBadges = (lead) => {
    const ig = lead.instagram || (lead.source_link?.includes('instagram.com') ? lead.source_link : null);
    const fb = lead.facebook || (lead.source_link?.includes('facebook.com') ? lead.source_link : null);
    const li = lead.linkedin || (lead.source_link?.includes('linkedin.com') ? lead.source_link : null);
    const tw = lead.twitter || ((lead.source_link?.includes('twitter.com') || lead.source_link?.includes('x.com')) ? lead.source_link : null);
    const yt = lead.youtube || (lead.source_link?.includes('youtube.com') ? lead.source_link : null);
    const tt = lead.tiktok || (lead.source_link?.includes('tiktok.com') ? lead.source_link : null);
    const pin = lead.pinterest || (lead.source_link?.includes('pinterest.com') ? lead.source_link : null);
    const tg = lead.telegram || ((lead.source_link?.includes('t.me') || lead.source_link?.includes('telegram.me')) ? lead.source_link : null);
    const wa = lead.whatsapp || lead.mobile;

    const hasAny = ig || fb || li || tw || yt || tt || pin || tg || wa;
    if (!hasAny) return <span className="empty-val">—</span>;

    const waLink = lead.whatsapp 
      ? (lead.whatsapp.startsWith('http') ? lead.whatsapp : `https://wa.me/${lead.whatsapp.replace(/\D/g, '')}`)
      : (lead.mobile ? `https://wa.me/${lead.mobile.replace(/\D/g, '')}` : null);

    return (
      <div className="social-badges-row">
        {ig && (
          <a href={ig.startsWith('http') ? ig : `https://${ig}`} target="_blank" rel="noreferrer" className="soc-badge soc-ig" title={`Instagram: ${ig}`}>
            IG
          </a>
        )}
        {fb && (
          <a href={fb.startsWith('http') ? fb : `https://${fb}`} target="_blank" rel="noreferrer" className="soc-badge soc-fb" title={`Facebook: ${fb}`}>
            FB
          </a>
        )}
        {li && (
          <a href={li.startsWith('http') ? li : `https://${li}`} target="_blank" rel="noreferrer" className="soc-badge soc-li" title={`LinkedIn: ${li}`}>
            LI
          </a>
        )}
        {tw && (
          <a href={tw.startsWith('http') ? tw : `https://${tw}`} target="_blank" rel="noreferrer" className="soc-badge soc-tw" title={`Twitter / X: ${tw}`}>
            X
          </a>
        )}
        {waLink && (
          <a href={waLink} target="_blank" rel="noreferrer" className="soc-badge soc-wa" title={`WhatsApp: ${lead.phone || lead.mobile || lead.whatsapp}`}>
            WA
          </a>
        )}
        {yt && (
          <a href={yt.startsWith('http') ? yt : `https://${yt}`} target="_blank" rel="noreferrer" className="soc-badge soc-yt" title={`YouTube: ${yt}`}>
            YT
          </a>
        )}
        {tt && (
          <a href={tt.startsWith('http') ? tt : `https://${tt}`} target="_blank" rel="noreferrer" className="soc-badge soc-tt" title={`TikTok: ${tt}`}>
            TT
          </a>
        )}
        {pin && (
          <a href={pin.startsWith('http') ? pin : `https://${pin}`} target="_blank" rel="noreferrer" className="soc-badge soc-pin" title={`Pinterest: ${pin}`}>
            PIN
          </a>
        )}
        {tg && (
          <a href={tg.startsWith('http') ? tg : `https://${tg}`} target="_blank" rel="noreferrer" className="soc-badge soc-tg" title={`Telegram: ${tg}`}>
            TG
          </a>
        )}
      </div>
    );
  };

  // Lead contact stats in modal
  const leadsWithPhone = jobLeads.filter(l => l.phone && l.phone.length > 4).length;
  const leadsWithWeb = jobLeads.filter(l => l.website && l.website.length > 5).length;
  const leadsWithWhatsApp = jobLeads.filter(l => l.whatsapp || (l.mobile && l.mobile.length > 5)).length;
  const leadsWithMax = jobLeads.filter(l => !!formatMaxNumber(l.max_messenger || l.phone || l.mobile, l.address || selectedJob?.location)).length;

  return (
    <div className="page-content animate-slide-up">
      {/* Toast */}
      {toastMessage && (
        <div className="toast-container">
          <div className="toast-card success">
            <Sparkles size={16} />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="database-header">
        <div>
          <div className="db-title-row">
            <DbIcon size={24} className="db-title-icon" />
            <h1>Scraped Contacts Database</h1>
          </div>
          <p className="db-subtitle">Centralized storage for local contacts, businesses, and phone directories</p>
        </div>

        <div className="database-actions">
          {selectedJobIds.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginRight: '16px', flexWrap: 'wrap' }}>
              <button 
                className="btn-primary" 
                onClick={() => {
                  setExportJobIds([...selectedJobIds]);
                  setDbTab('EXPORTER');
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Open selected jobs in Targeted Data Exporter"
              >
                <Download size={15} /> 
                <span>Open in Data Exporter ({selectedJobIds.length})</span>
              </button>
              <button className="btn-secondary" onClick={() => handleBulkExport('excel')} disabled={exportingBulk}>
                <FileSpreadsheet size={15} /> {exportingBulk ? 'Exporting...' : `Export Excel (${selectedJobIds.length})`}
              </button>
              <button className="btn-secondary" onClick={() => handleBulkExport('pdf')} disabled={exportingBulk}>
                <FileText size={15} /> {exportingBulk ? 'Exporting...' : `Export PDF (${selectedJobIds.length})`}
              </button>
            </div>
          )}

          <button 
            className={`auto-poll-btn ${autoPoll ? 'active' : ''}`}
            onClick={() => setAutoPoll(!autoPoll)}
            title="Auto-refresh when jobs are running"
          >
            <span className={`poll-indicator ${autoPoll ? 'live' : ''}`}></span>
            <span>{autoPoll ? 'Live Sync' : 'Paused'}</span>
          </button>

          <button 
            className={`refresh-btn-secondary ${isRefreshing ? 'spinning' : ''}`} 
            onClick={() => fetchJobs(true)}
          >
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Top Level Navigation Tabs: Scraping Records vs Targeted Data Exporter */}
      <div className="db-tabs-container">
        <button 
          className={`db-tab-btn ${dbTab === 'RECORDS' ? 'active' : ''}`}
          onClick={() => setDbTab('RECORDS')}
        >
          <DbIcon size={16} />
          <span>Scraping Records</span>
          <span className="tab-pill-highlight">{jobs.length}</span>
        </button>
        <button 
          className={`db-tab-btn ${dbTab === 'EXPORTER' ? 'active' : ''}`}
          onClick={() => {
            setDbTab('EXPORTER');
            if (exportJobIds.length === 0) {
              if (selectedJobIds.length > 0) {
                setExportJobIds([...selectedJobIds]);
              } else if (jobs.length > 0) {
                setExportJobIds(jobs.map(j => j.id));
              }
            }
          }}
        >
          <Download size={16} />
          <span>Targeted Data Exporter</span>
          <span className="tab-pill-highlight live">GET DATA</span>
        </button>
      </div>

      {/* TAB 1: SCRAPING RECORDS */}
      {dbTab === 'RECORDS' && (
        <>
          {/* Filter & Search Bar */}
          <div className="filter-controls-bar">
            <div className="search-box-wrapper">
              <Search size={17} className="search-icon-inside" />
              <input 
                type="text"
                className="filter-search-input"
                placeholder="Search by keyword, city, or Job ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="filter-chips-group">
              <div className="source-filter-pills">
                {['ALL', 'maps', 'dorking', 'yellowpages', 'yandex', 'whatsapp'].map((src) => (
                  <button
                    key={src}
                    className={`source-chip ${sourceFilter === src ? 'active' : ''}`}
                    onClick={() => setSourceFilter(src)}
                  >
                    {src === 'ALL' ? 'All Engines' :
                     src === 'maps' ? 'Google Data' :
                     src === 'dorking' ? 'Business Index' :
                     src === 'yellowpages' ? 'Yellow Pages' : 
                     src === 'yandex' ? 'Yandex' : 'WhatsApp Radar'}
                  </button>
                ))}
              </div>

              <select 
                className="status-dropdown-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="COMPLETED">Completed</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
          </div>

          {/* Database Jobs Table */}
          <div className="table-surface-card">
            {loading && jobs.length === 0 ? (
              <div className="loading-state-box">
                <div className="loading-spinner"></div>
                <p>Accessing PostgreSQL database tables...</p>
              </div>
            ) : error ? (
              <div className="error-state-box">
                <AlertCircle size={24} />
                <p>{error}</p>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="empty-state-box">
                <DbIcon size={44} />
                <h3>No matching scraper jobs found</h3>
                <p>Try adjusting your search filters or start a new scraping job.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="table-responsive desktop-jobs-view">
                  <table className="modern-jobs-table">
                    <thead>
                      <tr>
                        <th width="40">
                          <input 
                            type="checkbox" 
                            onChange={handleSelectAll} 
                            checked={filteredJobs.length > 0 && selectedJobIds.length === filteredJobs.length}
                          />
                        </th>
                        <th width="70">Job ID</th>
                        <th>Source Engine</th>
                        <th>Target Keyword & Location</th>
                        <th width="200">Progress Yield</th>
                        <th>Status</th>
                        <th>Timestamp</th>
                        <th width="120" className="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredJobs.map((job) => {
                        const target = job.target_count || job.requested_count || job.fetched_count || 1;
                        const fetched = job.fetched_count || 0;
                        const pct = target > 0 ? Math.min(100, Math.round((fetched / target) * 100)) : 100;
                        const isRunning = job.status === 'IN_PROGRESS';
                        return (
                          <tr key={job.id} className={isRunning ? 'row-running' : ''}>
                            <td>
                              <input 
                                type="checkbox" 
                                checked={selectedJobIds.includes(job.id)}
                                onChange={(e) => handleSelectJob(e, job.id)}
                                onClick={e => e.stopPropagation()}
                              />
                            </td>
                            <td>
                              <span className="job-id-tag">#{job.id}</span>
                            </td>
                            <td>{getSourceBadge(job.source)}</td>
                            <td>
                              <div className="query-col-data">
                                <strong className="query-term">{job.keyword}</strong>
                                <span className="query-loc">
                                  <MapPin size={11} />
                                  <span>{job.location}</span>
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="table-progress-box">
                                <div className="progress-text-row">
                                  <span className="count-bold">{fetched}</span>
                                  <span className="count-total">/ {target} leads</span>
                                  <span className="pct-badge">{pct}%</span>
                                </div>
                                <div className="table-bar-track">
                                  <div 
                                    className={`table-bar-fill ${isRunning ? 'shimmer-bar' : ''}`}
                                    style={{ width: `${pct}%` }}
                                  ></div>
                                </div>
                              </div>
                            </td>
                            <td>{getStatusBadge(job.status)}</td>
                            <td>
                              <span className="date-tag">
                                {new Date(job.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </td>
                            <td className="text-right">
                              <div className="table-actions-cell">
                                <button 
                                  className="inspect-leads-btn" 
                                  onClick={() => viewLeads(job)}
                                  disabled={job.fetched_count === 0}
                                  title="Inspect Extracted Contacts"
                                >
                                  <Eye size={15} />
                                  <span>View ({job.fetched_count})</span>
                                </button>
                                <button 
                                  className="delete-job-btn" 
                                  onClick={(e) => deleteJob(e, job.id)}
                                  title="Delete Job and Data"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View for Scraper Jobs */}
                <div className="mobile-jobs-cards-list">
                  {filteredJobs.map((job) => {
                    const target = job.target_count || job.requested_count || job.fetched_count || 1;
                    const fetched = job.fetched_count || 0;
                    const pct = target > 0 ? Math.min(100, Math.round((fetched / target) * 100)) : 100;
                    const isRunning = job.status === 'IN_PROGRESS';
                    const isSelected = selectedJobIds.includes(job.id);
                    return (
                      <div 
                        key={job.id} 
                        className={`mobile-job-card ${isRunning ? 'running' : ''} ${isSelected ? 'selected' : ''}`}
                        onClick={() => job.fetched_count > 0 && viewLeads(job)}
                      >
                        {/* Top Row: Select, Job ID, Source Badge, Status */}
                        <div className="mobile-job-card-header">
                          <div className="mobile-job-left-head">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={(e) => handleSelectJob(e, job.id)}
                              onClick={e => e.stopPropagation()}
                              className="mobile-job-checkbox"
                            />
                            <span className="job-id-tag">#{job.id}</span>
                            {getSourceBadge(job.source)}
                          </div>
                          <div className="mobile-job-status-box">
                            {getStatusBadge(job.status)}
                          </div>
                        </div>

                        {/* Middle: Keyword & Location */}
                        <div className="mobile-job-body">
                          <h4 className="mobile-job-title">{job.keyword}</h4>
                          <div className="mobile-job-loc-row">
                            <MapPin size={13} className="loc-pin-icon" />
                            <span>{job.location}</span>
                            <span className="dot-sep">•</span>
                            <span className="mobile-job-date">
                              {new Date(job.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar & Lead Count */}
                        <div className="mobile-job-progress-wrapper">
                          <div className="mobile-progress-label">
                            <span>Extracted Contacts</span>
                            <strong>{fetched} / {target} ({pct}%)</strong>
                          </div>
                          <div className="table-bar-track">
                            <div 
                              className={`table-bar-fill ${isRunning ? 'shimmer-bar' : ''}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {/* Bottom Actions Row */}
                        <div className="mobile-job-card-footer" onClick={e => e.stopPropagation()}>
                          <button 
                            className="mobile-view-leads-btn" 
                            onClick={() => viewLeads(job)}
                            disabled={job.fetched_count === 0}
                          >
                            <Eye size={14} />
                            <span>Inspect Leads ({job.fetched_count})</span>
                          </button>
                          <button 
                            className="mobile-delete-job-btn" 
                            onClick={(e) => deleteJob(e, job.id)}
                            title="Delete Job"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* TAB 2: TARGETED DATA EXPORTER (GET DATA) */}
      {dbTab === 'EXPORTER' && (
        <div className="get-data-container animate-fade-in" style={{ marginTop: '20px' }}>
          {/* Master Control Card */}
          <div className="card get-data-master-card">
            <div className="get-data-header-row">
              <div>
                <h2>Targeted Data Exporter</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Filter and export tailored contact datasets across your scraped jobs (Emails, WhatsApp, Phone Numbers, or Social Profiles).
                </p>
              </div>
            </div>

            {/* Step 1: Dropdown */}
            <div className="form-group" style={{ marginTop: '20px' }}>
              <label className="section-label-bold">
                <Filter size={15} /> 1. Select Export Data Type
              </label>
              <select 
                className="form-select get-data-select-input"
                value={getDataType}
                onChange={e => setGetDataType(e.target.value)}
              >
                <option value="emails">📧 Emails Only (Business Name + Verified Email + Website + Phone + Location)</option>
                <option value="whatsapp">💬 WhatsApp Only (Business Name + Verified WhatsApp + Direct wa.me Link + Phone + Website + Location)</option>
                <option value="max">🇷🇺 MAX Messenger (Russia & CIS - Business Name + MAX Available Number + Direct Chat Link + Website + Location)</option>
                <option value="phones">📞 Phone Numbers (Business Name + Phone/Mobile + Address + Website + Location)</option>
                <option value="socials">🌐 Social Profiles (Business Name + Instagram/LinkedIn/FB/Twitter/YouTube/TikTok + Website + Phone + Location)</option>
                <option value="all">📦 Full Master Bundle (All Contact Fields Combined)</option>
              </select>
            </div>

            {/* Step 2: Jobs Multi-Select */}
            <div className="form-group" style={{ marginTop: '20px' }}>
              <div className="jobs-header-bar">
                <label className="section-label-bold" style={{ margin: 0 }}>
                  <Search size={15} /> 2. Select Source Jobs ({exportJobIds.length} of {jobs.length} selected)
                </label>
                <button 
                  type="button" 
                  className="btn-select-toggle"
                  onClick={() => {
                    if (exportJobIds.length === jobs.length) setExportJobIds([]);
                    else setExportJobIds(jobs.map(j => j.id));
                  }}
                >
                  {exportJobIds.length === jobs.length && jobs.length > 0 ? '✕ Deselect All' : `✓ Select All (${jobs.length})`}
                </button>
              </div>

              <div className="job-search-input-wrap">
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Search jobs by keyword, city, or Job ID..."
                  value={exportJobSearch}
                  onChange={e => setExportJobSearch(e.target.value)}
                  style={{ marginBottom: '8px' }}
                />
              </div>

              {/* Scrollable list of jobs */}
              <div className="clean-jobs-list-container">
                {jobs.filter(j => 
                  j.keyword.toLowerCase().includes(exportJobSearch.toLowerCase()) ||
                  j.location.toLowerCase().includes(exportJobSearch.toLowerCase()) ||
                  j.id.toString().includes(exportJobSearch)
                ).map(j => {
                  const isChecked = exportJobIds.includes(j.id);
                  return (
                    <label key={j.id} className={`clean-job-item ${isChecked ? 'selected' : ''}`}>
                      <div className="job-item-left">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) setExportJobIds([...exportJobIds, j.id]);
                            else setExportJobIds(exportJobIds.filter(id => id !== j.id));
                          }}
                        />
                        <span className="job-item-id">#{j.id}</span>
                        <strong className="job-item-name">{j.keyword}</strong>
                        <span className="job-item-loc">📍 {j.location}</span>
                      </div>
                      <span className="job-item-badge">{j.fetched_count || 0} leads</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Export Action Toolbar */}
            <div className="export-toolbar-card">
              <div className="toolbar-status-badge">
                <span className="dot-live"></span>
                <span>
                  {loadingExtracted ? 'Extracting leads from database...' : <strong>{extractedLeads.length} matching leads ready</strong>}
                </span>
              </div>

              <div className="toolbar-buttons-flex">
                <button 
                  className="btn-export excel"
                  onClick={() => handleTargetedExport('excel')}
                  disabled={extractedLeads.length === 0 || loadingExtracted}
                >
                  <FileSpreadsheet size={16} /> Export Excel (.xlsx)
                </button>
                <button 
                  className="btn-export csv"
                  onClick={() => handleTargetedExport('csv')}
                  disabled={extractedLeads.length === 0 || loadingExtracted}
                >
                  <Download size={16} /> Export CSV (.csv)
                </button>
                <button 
                  className="btn-export pdf"
                  onClick={() => handleTargetedExport('pdf')}
                  disabled={extractedLeads.length === 0 || loadingExtracted}
                >
                  <FileText size={16} /> Export PDF (.pdf)
                </button>
              </div>
            </div>
          </div>

          {/* Step 4: Live Preview Table */}
          <div className="preview-card-wrap" style={{ marginTop: '24px' }}>
            <div className="preview-header-row">
              <h3>
                {loadingExtracted ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RefreshCw size={15} className="spinning" /> Loading extracted data...
                  </span>
                ) : (
                  <span>
                    Live Preview (Showing {Math.min(extractedLeads.length, 10)} of {extractedLeads.length} records)
                  </span>
                )}
              </h3>
              <span className="tab-pill-highlight live" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                {getDataType}
              </span>
            </div>

            <div className="table-responsive">
              <table className="modern-jobs-table">
                <thead>
                  {getDataType === 'whatsapp' ? (
                    <tr>
                      <th width="40">#</th>
                      <th>Business Name</th>
                      <th>Verified WhatsApp</th>
                      <th>Direct Chat</th>
                      <th>Phone</th>
                      <th>Website</th>
                      <th>Category</th>
                      <th>Location</th>
                    </tr>
                  ) : getDataType === 'max' ? (
                    <tr>
                      <th width="40">#</th>
                      <th>Business Name</th>
                      <th>MAX Phone (RU)</th>
                      <th>MAX Chat Action</th>
                      <th>Phone</th>
                      <th>Website</th>
                      <th>Category</th>
                      <th>Location</th>
                    </tr>
                  ) : getDataType === 'emails' ? (
                    <tr>
                      <th width="40">#</th>
                      <th>Business Name</th>
                      <th>Verified Email</th>
                      <th>Website</th>
                      <th>Phone</th>
                      <th>Category</th>
                      <th>Location</th>
                    </tr>
                  ) : getDataType === 'phones' ? (
                    <tr>
                      <th width="40">#</th>
                      <th>Business Name</th>
                      <th>Phone Number</th>
                      <th>Mobile / WhatsApp</th>
                      <th>Address</th>
                      <th>Website</th>
                      <th>Category</th>
                      <th>Location</th>
                    </tr>
                  ) : getDataType === 'socials' ? (
                    <tr>
                      <th width="40">#</th>
                      <th>Business Name</th>
                      <th>Social Profiles</th>
                      <th>Website</th>
                      <th>Phone</th>
                      <th>Category</th>
                      <th>Location</th>
                    </tr>
                  ) : (
                    <tr>
                      <th width="40">#</th>
                      <th>Business Name</th>
                      <th>Verified Email</th>
                      <th>Phone / WhatsApp</th>
                      <th>Social Badges</th>
                      <th>Website</th>
                      <th>Category</th>
                      <th>Location</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {extractedLeads.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                        {exportJobIds.length === 0 
                          ? "Select one or more jobs above to preview and export data."
                          : `No leads with ${getDataType} found in the selected jobs.`}
                      </td>
                    </tr>
                  ) : (
                    extractedLeads.slice(0, 10).map((lead, idx) => {
                      const rawWa = lead.whatsapp || lead.mobile;
                      const waDigits = rawWa ? String(rawWa).replace(/\D/g, '') : '';
                      const waLink = waDigits ? `https://wa.me/${waDigits}` : null;

                      return (
                        <tr key={lead.id || idx}>
                          <td>{idx + 1}</td>
                          <td><strong>{cleanBusinessName(lead.name)}</strong></td>

                          {getDataType === 'whatsapp' ? (
                            <>
                              <td style={{ color: '#15803d', fontWeight: 700 }}>
                                {rawWa ? (rawWa.startsWith('+') ? rawWa : `+${waDigits}`) : '-'}
                              </td>
                              <td>
                                {waLink ? (
                                  <a 
                                    href={waLink} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="preview-wa-chat-btn"
                                    title={`Chat on WhatsApp with ${rawWa}`}
                                  >
                                    <MessageCircle size={12} />
                                    <span>Chat</span>
                                  </a>
                                ) : '-'}
                              </td>
                              <td>{lead.phone || '-'}</td>
                              <td>
                                {lead.website && lead.website !== '-' ? (
                                  <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
                                    {formatDisplayUrl(lead.website)}
                                  </a>
                                ) : '-'}
                              </td>
                              <td>{lead.category || lead.job_keyword || '-'}</td>
                              <td>{lead.job_location || lead.address || '-'}</td>
                            </>
                          ) : getDataType === 'max' ? (
                            <>
                              <td style={{ color: '#db2777', fontWeight: 700 }}>
                                {formatMaxNumber(lead.max_messenger || lead.phone || lead.mobile, lead.address || lead.job_location) || '-'}
                              </td>
                              <td>
                                {(() => {
                                  const maxNum = formatMaxNumber(lead.max_messenger || lead.phone || lead.mobile, lead.address || lead.job_location);
                                  return maxNum ? (
                                    <button 
                                      type="button"
                                      className="preview-max-chat-btn"
                                      onClick={(e) => openMaxChat(maxNum, e)}
                                      title={`Copy ${maxNum} & open MAX Web Messenger (web.max.ru)`}
                                    >
                                      <MessageSquare size={12} />
                                      <span>Chat on MAX</span>
                                    </button>
                                  ) : '-';
                                })()}
                              </td>
                              <td>{lead.phone || '-'}</td>
                              <td>
                                {lead.website && lead.website !== '-' ? (
                                  <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
                                    {formatDisplayUrl(lead.website)}
                                  </a>
                                ) : '-'}
                              </td>
                              <td>{lead.category || lead.job_keyword || '-'}</td>
                              <td>{lead.job_location || lead.address || '-'}</td>
                            </>
                          ) : getDataType === 'emails' ? (
                            <>
                              <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{lead.emails || '-'}</td>
                              <td>
                                {lead.website && lead.website !== '-' ? (
                                  <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)' }}>
                                    {formatDisplayUrl(lead.website)}
                                  </a>
                                ) : '-'}
                              </td>
                              <td>{lead.phone || lead.mobile || '-'}</td>
                              <td>{lead.category || lead.job_keyword || '-'}</td>
                              <td>{lead.job_location || lead.address || '-'}</td>
                            </>
                          ) : getDataType === 'phones' ? (
                            <>
                              <td style={{ fontWeight: 700, color: '#16a34a' }}>{lead.phone || '-'}</td>
                              <td style={{ color: '#15803d' }}>{lead.mobile || lead.whatsapp || '-'}</td>
                              <td>{cleanAddress(lead.address, lead.job_location)}</td>
                              <td>
                                {lead.website && lead.website !== '-' ? (
                                  <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer">
                                    {formatDisplayUrl(lead.website)}
                                  </a>
                                ) : '-'}
                              </td>
                              <td>{lead.category || lead.job_keyword || '-'}</td>
                              <td>{lead.job_location || '-'}</td>
                            </>
                          ) : getDataType === 'socials' ? (
                            <>
                              <td>{renderSocialBadges(lead)}</td>
                              <td>
                                {lead.website && lead.website !== '-' ? (
                                  <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer">
                                    {formatDisplayUrl(lead.website)}
                                  </a>
                                ) : '-'}
                              </td>
                              <td>{lead.phone || lead.mobile || '-'}</td>
                              <td>{lead.category || lead.job_keyword || '-'}</td>
                              <td>{lead.job_location || lead.address || '-'}</td>
                            </>
                          ) : (
                            <>
                              <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{lead.emails || '-'}</td>
                              <td style={{ color: '#16a34a' }}>{lead.phone || lead.mobile || '-'}</td>
                              <td>{renderSocialBadges(lead)}</td>
                              <td>
                                {lead.website && lead.website !== '-' ? (
                                  <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer">
                                    {formatDisplayUrl(lead.website)}
                                  </a>
                                ) : '-'}
                              </td>
                              <td>{lead.category || lead.job_keyword || '-'}</td>
                              <td>{lead.job_location || '-'}</td>
                            </>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              {extractedLeads.length > 10 && (
                <div style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-card-subtle)', borderTop: '1px solid var(--border-color)' }}>
                  Showing first 10 of <strong>{extractedLeads.length}</strong> records. All {extractedLeads.length} records will be included when exporting.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rich Modal / Lead Inspection Drawer attached to document.body */}
      {selectedJob && createPortal(
        <div className="modal-overlay animate-fade-in" onClick={() => setSelectedJob(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-modern">
              <div className="modal-header-info">
                <div className="modal-badge-row">
                  <span className="modal-job-id">Job #{selectedJob.id}</span>
                  {getSourceBadge(selectedJob.source)}
                </div>
                <h2>{selectedJob.keyword} <span className="modal-loc">in {selectedJob.location}</span></h2>
              </div>

              <div className="modal-header-actions">
                <button 
                  className="export-btn excel-export" 
                  onClick={() => exportExcel(jobLeads, selectedJob)} 
                  disabled={jobLeads.length === 0}
                >
                  <FileSpreadsheet size={15} />
                  <span>Excel (.xlsx)</span>
                </button>
                <button 
                  className="export-btn pdf-export" 
                  onClick={() => exportPDF(jobLeads, selectedJob)} 
                  disabled={jobLeads.length === 0}
                >
                  <FileText size={15} />
                  <span>PDF Report</span>
                </button>
                <button className="modal-close-btn" onClick={() => setSelectedJob(null)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Telemetry Strip */}
            <div className="modal-stats-strip">
              <div className="strip-stat">
                <span className="strip-label">Total Leads</span>
                <strong className="strip-val">{jobLeads.length}</strong>
              </div>
              <div className="strip-stat">
                <span className="strip-label">With Phone</span>
                <strong className="strip-val highlight-green">{leadsWithPhone} ({jobLeads.length ? Math.round((leadsWithPhone/jobLeads.length)*100) : 0}%)</strong>
              </div>
              <div className="strip-stat">
                <span className="strip-label">With WhatsApp</span>
                <strong className="strip-val highlight-wa">{leadsWithWhatsApp} ({jobLeads.length ? Math.round((leadsWithWhatsApp/jobLeads.length)*100) : 0}%)</strong>
              </div>
              {leadsWithMax > 0 && (
                <div className="strip-stat">
                  <span className="strip-label">With MAX (RU)</span>
                  <strong className="strip-val highlight-max">{leadsWithMax} ({jobLeads.length ? Math.round((leadsWithMax/jobLeads.length)*100) : 0}%)</strong>
                </div>
              )}
              <div className="strip-stat">
                <span className="strip-label">With Website</span>
                <strong className="strip-val highlight-blue">{leadsWithWeb} ({jobLeads.length ? Math.round((leadsWithWeb/jobLeads.length)*100) : 0}%)</strong>
              </div>
            </div>

            {/* Modal Filter Bar */}
            <div className="modal-search-bar">
              <div className="modal-search-box">
                <Search size={15} />
                <input 
                  type="text"
                  placeholder="Search extracted names, phones, websites..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                />
              </div>

              <div className="modal-filter-pills">
                <button 
                  className={`m-pill ${modalFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setModalFilter('ALL')}
                >
                  All ({jobLeads.length})
                </button>
                <button 
                  className={`m-pill ${modalFilter === 'WHATSAPP' ? 'active' : ''}`}
                  onClick={() => setModalFilter('WHATSAPP')}
                >
                  💬 WhatsApp Only ({leadsWithWhatsApp})
                </button>
                {leadsWithMax > 0 && (
                  <button 
                    className={`m-pill ${modalFilter === 'MAX' ? 'active' : ''}`}
                    onClick={() => setModalFilter('MAX')}
                  >
                    🇷🇺 MAX Messenger ({leadsWithMax})
                  </button>
                )}
                <button 
                  className={`m-pill ${modalFilter === 'PHONE' ? 'active' : ''}`}
                  onClick={() => setModalFilter('PHONE')}
                >
                  📞 Phone Only ({leadsWithPhone})
                </button>
                <button 
                  className={`m-pill ${modalFilter === 'WEBSITE' ? 'active' : ''}`}
                  onClick={() => setModalFilter('WEBSITE')}
                >
                  🌐 Website Only ({leadsWithWeb})
                </button>
              </div>
            </div>

            {/* Modal Table / Mobile Cards */}
            <div className="modal-body-scrollable">
              {leadsLoading ? (
                <div className="modal-loading-box">
                  <div className="loading-spinner"></div>
                  <p>Fetching contacts from database...</p>
                </div>
              ) : filteredModalLeads.length === 0 ? (
                <div className="modal-empty-box">
                  <p>No leads matching current search filter.</p>
                </div>
              ) : (
                <>
                  {/* Desktop Leads Table */}
                  <table className="leads-detail-table desktop-leads-view">
                    <thead>
                      <tr>
                        <th width="40">#</th>
                        <th>Business / Contact Name</th>
                        <th>Phone Number</th>
                        <th>MAX Messenger (RU)</th>
                        <th>Email Address</th>
                        <th>Website / Profile</th>
                        <th>Socials</th>
                        <th>Address / Location</th>
                        <th width="80" className="text-center">Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredModalLeads.map((lead, idx) => {
                        const cleanName = cleanBusinessName(lead.name);
                        const cleanAddr = cleanAddress(lead.address, selectedJob.location);
                        const displayWeb = lead.website && lead.website !== 'None' 
                          ? lead.website 
                          : (selectedJob?.source === 'dorking' ? (lead.instagram || lead.linkedin || lead.facebook || lead.twitter || lead.source_link) : null);
                        return (
                          <tr key={lead.id || idx}>
                            <td className="row-num">{idx + 1}</td>
                            <td>
                              <strong className="lead-biz-name">{cleanName}</strong>
                              <span className="lead-biz-cat">{lead.category || selectedJob.keyword}</span>
                            </td>
                            <td>
                              {lead.phone && lead.phone !== 'None' ? (
                                <div className="contact-cell">
                                  <span className="phone-text">{lead.phone}</span>
                                  <button 
                                    className="copy-icon-btn" 
                                    onClick={() => copyToClipboard(lead.phone, `phone_${idx}`)}
                                    title="Copy Phone Number"
                                  >
                                    {copiedId === `phone_${idx}` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                                  </button>
                                  {(lead.whatsapp || lead.mobile) && (
                                    <a
                                      href={lead.whatsapp || `https://wa.me/${(lead.mobile || lead.phone).replace(/\D/g, '')}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="wa-chat-pill-btn"
                                      title="Chat on WhatsApp"
                                    >
                                      Chat
                                    </a>
                                  )}
                                </div>
                              ) : <span className="empty-val">-</span>}
                            </td>
                            <td>
                              {(() => {
                                const maxNum = formatMaxNumber(lead.max_messenger || lead.phone || lead.mobile, lead.address || selectedJob?.location);
                                if (!maxNum) return <span className="empty-val">—</span>;
                                return (
                                  <div className="contact-cell max-contact-cell">
                                    <span className="max-phone-text" title="Registered Russian MAX Messenger Number">{maxNum}</span>
                                    <button 
                                      className="copy-icon-btn" 
                                      onClick={() => copyToClipboard(maxNum, `max_t_${idx}`)}
                                      title="Copy MAX Number"
                                    >
                                      {copiedId === `max_t_${idx}` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                                    </button>
                                    <button
                                      type="button"
                                      className="max-chat-pill-btn"
                                      onClick={(e) => openMaxChat(maxNum, e)}
                                      title={`Copy ${maxNum} & open MAX Web Messenger (web.max.ru)`}
                                    >
                                      <MessageSquare size={11} />
                                      <span>MAX Chat</span>
                                    </button>
                                  </div>
                                );
                              })()}
                            </td>
                            <td>
                              {lead.emails && lead.emails !== 'None' ? (
                                <div className="contact-cell">
                                  <span className="email-text">{lead.emails}</span>
                                  <button 
                                    className="copy-icon-btn" 
                                    onClick={() => copyToClipboard(lead.emails, `email_${idx}`)}
                                    title="Copy Email"
                                  >
                                    {copiedId === `email_${idx}` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                                  </button>
                                </div>
                              ) : <span className="empty-val">-</span>}
                            </td>
                            <td>
                              {displayWeb ? (
                                <div className="contact-cell">
                                  <a 
                                    href={displayWeb.startsWith('http') ? displayWeb : `https://${displayWeb}`} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="web-link"
                                  >
                                    {formatDisplayUrl(displayWeb)}
                                  </a>
                                  <button 
                                    className="copy-icon-btn" 
                                    onClick={() => copyToClipboard(displayWeb, `web_${idx}`)}
                                    title="Copy Website / Profile URL"
                                  >
                                    {copiedId === `web_${idx}` ? <Check size={12} className="check-green" /> : <Copy size={12} />}
                                  </button>
                                </div>
                              ) : (
                                <span className="missing-data">—</span>
                              )}
                            </td>
                            <td>
                              {renderSocialBadges(lead)}
                            </td>
                            <td>
                              <span className="lead-address-text" title={cleanAddr}>
                                {cleanAddr}
                              </span>
                            </td>
                            <td className="text-center">
                              {lead.source_link ? (
                                <a 
                                  href={lead.source_link} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="source-external-btn"
                                  title="Open original listing"
                                >
                                  <ExternalLink size={14} />
                                </a>
                              ) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Mobile Leads Cards in Drawer */}
                  <div className="mobile-leads-cards-list">
                    {filteredModalLeads.map((lead, idx) => {
                      const cleanName = cleanBusinessName(lead.name);
                      const cleanAddr = cleanAddress(lead.address, selectedJob.location);
                      const displayWeb = lead.website && lead.website !== 'None' 
                        ? lead.website 
                        : (selectedJob?.source === 'dorking' ? (lead.instagram || lead.linkedin || lead.facebook || lead.twitter || lead.source_link) : null);
                      return (
                        <div key={lead.id || idx} className="mobile-lead-item-card">
                          <div className="mobile-lead-card-head">
                            <div>
                              <strong className="mobile-lead-name">{cleanName}</strong>
                              <span className="mobile-lead-cat">{lead.category || selectedJob.keyword}</span>
                            </div>
                            <span className="mobile-lead-index">#{idx + 1}</span>
                          </div>

                          {/* Phone Row */}
                          {lead.phone && lead.phone !== 'None' && (
                            <div className="mobile-lead-data-row">
                              <span className="m-data-lbl">📞 Phone:</span>
                              <div className="m-data-val">
                                <strong>{lead.phone}</strong>
                                <button 
                                  className="copy-icon-btn" 
                                  onClick={() => copyToClipboard(lead.phone, `phone_${idx}`)}
                                >
                                  {copiedId === `phone_${idx}` ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                                </button>
                                {(lead.whatsapp || lead.mobile) && (
                                  <a
                                    href={lead.whatsapp || `https://wa.me/${(lead.mobile || lead.phone).replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="wa-chat-pill-btn"
                                    title="Chat on WhatsApp"
                                  >
                                    Chat
                                  </a>
                                )}
                              </div>
                            </div>
                          )}

                          {/* MAX Messenger (RU) Row */}
                          {(() => {
                            const maxNum = formatMaxNumber(lead.max_messenger || lead.phone || lead.mobile, lead.address || selectedJob?.location);
                            if (!maxNum) return null;
                            return (
                              <div className="mobile-lead-data-row">
                                <span className="m-data-lbl">💬 MAX (RU):</span>
                                <div className="m-data-val">
                                  <strong style={{ color: '#db2777' }}>{maxNum}</strong>
                                  <button 
                                    className="copy-icon-btn" 
                                    onClick={() => copyToClipboard(maxNum, `max_m_${idx}`)}
                                    title="Copy MAX Number"
                                  >
                                    {copiedId === `max_m_${idx}` ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                                  </button>
                                  <button
                                    type="button"
                                    className="max-chat-pill-btn"
                                    onClick={(e) => openMaxChat(maxNum, e)}
                                    title={`Copy ${maxNum} & open MAX Web Messenger (web.max.ru)`}
                                  >
                                    <MessageSquare size={11} />
                                    <span>MAX Chat</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Email Row */}
                          {lead.emails && lead.emails !== 'None' && (
                            <div className="mobile-lead-data-row">
                              <span className="m-data-lbl">✉️ Email:</span>
                              <div className="m-data-val">
                                <span className="email-highlight">{lead.emails}</span>
                                <button 
                                  className="copy-icon-btn" 
                                  onClick={() => copyToClipboard(lead.emails, `email_${idx}`)}
                                >
                                  {copiedId === `email_${idx}` ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Website Row */}
                          {displayWeb && (
                            <div className="mobile-lead-data-row">
                              <span className="m-data-lbl">🌐 Website:</span>
                              <div className="m-data-val">
                                <a 
                                  href={displayWeb.startsWith('http') ? displayWeb : `https://${displayWeb}`} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="web-link"
                                >
                                  {formatDisplayUrl(displayWeb)}
                                </a>
                              </div>
                            </div>
                          )}

                          {/* Address */}
                          {cleanAddr && (
                            <div className="mobile-lead-address">
                              <MapPin size={12} className="loc-pin-icon" />
                              <span>{cleanAddr}</span>
                            </div>
                          )}

                          {/* Social Badges & Source Link */}
                          <div className="mobile-lead-card-footer">
                            {renderSocialBadges(lead)}
                            {lead.source_link && (
                              <a href={lead.source_link} target="_blank" rel="noreferrer" className="mobile-source-link-btn">
                                <span>Source Link</span>
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default Database;
