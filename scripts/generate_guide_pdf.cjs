const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable');

function buildUserGuidePDF() {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 16;
  const contentWidth = pageWidth - (marginX * 2);

  let currentY = 18;

  // Helper: Check page break
  function ensureSpace(neededHeight) {
    if (currentY + neededHeight > pageHeight - 18) {
      doc.addPage();
      currentY = 20;
      drawHeaderBanner();
    }
  }

  // Running Header Banner (on page 2+)
  function drawHeaderBanner() {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('CONTAQUE  |  COMPLETE USER GUIDE & LEAD ENGINE MANUAL', marginX, 12);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginX, 14, pageWidth - marginX, 14);
  }

  // --------------------------------------------------------------------------
  // COVER / DOCUMENT HEADER
  // --------------------------------------------------------------------------
  // Top Badge
  doc.setFillColor(238, 242, 255); // Indigo-50
  doc.roundedRect(marginX, currentY, 52, 6.5, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(79, 70, 229); // Indigo-600
  doc.text('OFFICIAL PRODUCT MANUAL', marginX + 3.5, currentY + 4.5);
  currentY += 11;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text('ContaQue — Complete User Guide', marginX, currentY);
  currentY += 7;

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105); // Slate-600
  const subText = 'Mastering the 5 Specialized Lead Engines, Database Pipeline & Bulk Email Outreach';
  doc.text(subText, marginX, currentY);
  currentY += 5;

  // Decorative Rule
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 8;

  // Intro Callout Box
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, currentY, contentWidth, 18, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Core Architecture Principle:', marginX + 4, currentY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const introMsg = 'ContaQue has 5 specialized lead-generation engines. Each engine works with a different type of data source, so choosing the right engine depends on where the businesses/contacts you need are most likely to be listed.';
  const splitIntro = doc.splitTextToSize(introMsg, contentWidth - 8);
  doc.text(splitIntro, marginX + 4, currentY + 10.5);
  currentY += 23;

  // --------------------------------------------------------------------------
  // SECTION 1: UNDERSTAND THE LEAD ENGINES FIRST
  // --------------------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Understand the Lead Engines First', marginX, currentY);
  currentY += 7;

  // Function to render an Engine Card
  function drawEngineCard(num, name, tagColor, bestFor, desc, example, whenToUse, customSection = null) {
    ensureSpace(45 + (customSection ? 22 : 0));

    // Card background
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    const cardStartY = currentY;

    // Header strip
    doc.setFillColor(tagColor[0], tagColor[1], tagColor[2]);
    doc.rect(marginX, currentY, 3, 10, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`${num}. ${name}`, marginX + 5, currentY + 4.5);

    // Best for tag
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(tagColor[0], tagColor[1], tagColor[2]);
    doc.text(`Best for: ${bestFor}`, marginX + 5, currentY + 9);
    currentY += 13;

    // Description
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    const splitDesc = doc.splitTextToSize(desc, contentWidth - 8);
    doc.text(splitDesc, marginX + 4, currentY);
    currentY += (splitDesc.length * 4.2) + 2;

    // Custom Subsection (e.g. for Business Index URL search)
    if (customSection) {
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(marginX + 4, currentY, contentWidth - 8, 16, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(customSection.title, marginX + 7, currentY + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const splitCustom = doc.splitTextToSize(customSection.text, contentWidth - 14);
      doc.text(splitCustom, marginX + 7, currentY + 8.5);
      currentY += 19;
    }

    // Example Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(marginX + 4, currentY, contentWidth - 8, 11, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('CONCRETE EXAMPLE:', marginX + 7, currentY + 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(example.req, marginX + 7, currentY + 8.2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(` -> Use: ${example.use}`, marginX + 58, currentY + 8.2);
    currentY += 14;

    // When to use callout
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(tagColor[0], tagColor[1], tagColor[2]);
    doc.text('WHEN TO USE:', marginX + 4, currentY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const splitWhen = doc.splitTextToSize(whenToUse, contentWidth - 32);
    doc.text(splitWhen, marginX + 30, currentY);
    currentY += (splitWhen.length * 4) + 6;

    // Card border
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, cardStartY, contentWidth, currentY - cardStartY - 2, 2, 2, 'D');
    currentY += 4;
  }

  // Engine 1: Google Business Data
  drawEngineCard(
    1,
    'Google Business Data',
    [37, 99, 235], // Blue
    'Local & Google-listed businesses',
    'Finds businesses that are actively listed on Google Business / Google Maps. Ideal for local shops, agencies, dental/medical clinics, restaurants, hotels, contractors, salons, gyms, real-estate firms, and professional services with a physical or verified Google listing.',
    { req: '"Dental Clinics in New York"', use: 'Google Business Data' },
    'Use this engine whenever your target business is likely to have a Google Business listing.'
  );

  // Engine 2: Business Index
  drawEngineCard(
    2,
    'Business Index',
    [124, 58, 237], // Purple
    'Businesses with a digital / social presence',
    'Broader than Google Business Data. Designed to find businesses with an active digital footprint across platforms such as LinkedIn, Instagram, Facebook, YouTube, and indexed web sources. Useful when target businesses do not rely primarily on Google Maps.',
    { req: '"European Real Estate Companies"', use: 'Business Index' },
    'Use when targets have an online/social presence, without strictly needing a Google Maps listing.',
    {
      title: 'Custom Website URL Search:',
      text: 'Business Index also allows you to target a specific website URL. If you know a directory or index where your targets are listed, input that URL to extract available data directly.'
    }
  );

  // Engine 3: Yellow Pages
  drawEngineCard(
    3,
    'Yellow Pages',
    [217, 119, 6], // Amber
    'Yellow Pages directory data',
    'Specifically built for businesses listed in traditional Yellow Pages-style business directories (e.g. yellowpages.com, yell.com). A dedicated directory-specific source for contractors, tradesmen, and service providers.',
    { req: '"Plumbers in California"', use: 'Yellow Pages' },
    'Use when your target businesses are heavily cataloged in traditional directory listings.'
  );

  // Engine 4: Yandex
  drawEngineCard(
    4,
    'Yandex',
    [220, 38, 38], // Red
    'Russia-focused business discovery & MAX Messenger',
    'A dedicated search and business discovery ecosystem tailored for businesses in Russia and CIS regions. A major advantage is extracting MAX Messenger/chat-ready contact numbers where available alongside standard phone numbers.',
    { req: '"Real Estate Brokers in Moscow"', use: 'Yandex' },
    'Use whenever your target market is Russia/CIS and you want data from the Yandex ecosystem.'
  );

  // Engine 5: WhatsApp Radar
  drawEngineCard(
    5,
    'WhatsApp Radar',
    [5, 150, 105], // Emerald
    'Businesses with WhatsApp click-to-chat numbers',
    'A specialized radar engine for uncovering businesses where WhatsApp contact numbers (wa.me/ direct chat links) are publicly indexed. Built specifically for outreach strategies that prioritize WhatsApp direct messaging.',
    { req: '"Restaurants in Dubai with WhatsApp"', use: 'WhatsApp Radar' },
    'Use when WhatsApp-ready contact information is the primary channel for your cold outreach.'
  );

  // --------------------------------------------------------------------------
  // SECTION 2: HOW DO I CHOOSE THE RIGHT ENGINE?
  // --------------------------------------------------------------------------
  ensureSpace(60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('2. How Do I Choose the Right Engine?', marginX, currentY);
  currentY += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Always ask: Where are my target businesses most naturally listed?', marginX, currentY);
  currentY += 5;

  // Comparison Table via jspdf-autotable
  autoTable.default(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [['Your Requirement / Target Profile', 'Recommended Engine', 'Primary Source']],
    body: [
      ['Local businesses / Google Maps businesses', 'Google Business Data', 'Google Places API'],
      ['Businesses with LinkedIn, Instagram, Facebook presence', 'Business Index', 'Social Platforms'],
      ['Specific website directory you want to extract from', 'Business Index', 'Custom Domain'],
      ['Yellow Pages directory businesses & local trades', 'Yellow Pages', 'Yellow Pages / Yell'],
      ['Russia-focused businesses / Yandex ecosystem', 'Yandex', 'Yandex + MAX'],
      ['Businesses where WhatsApp direct chat numbers are needed', 'WhatsApp Radar', 'wa.me Radar Index']
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    bodyStyles: {
      textColor: [51, 65, 85],
      fontSize: 8,
      cellPadding: 2.5
    },
    columnStyles: {
      0: { cellWidth: 85 },
      1: { cellWidth: 50, fontStyle: 'bold', textColor: [37, 99, 235] },
      2: { cellWidth: 43 }
    }
  });

  currentY = doc.lastAutoTable.finalY + 7;

  // Simple Rules Box
  ensureSpace(28);
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(marginX, currentY, contentWidth, 23, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Simple Decision Rules:', marginX + 4, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const rules = [
    '• Google listing -> Google Business Data',
    '• Social / online presence -> Business Index',
    '• Specific directory -> Yellow Pages',
    '• Russia / Yandex ecosystem -> Yandex',
    '• WhatsApp contacts -> WhatsApp Radar'
  ];
  let rY = currentY + 9;
  rules.forEach(r => {
    doc.text(r, marginX + 4, rY);
    rY += 3.8;
  });
  currentY += 28;

  // --------------------------------------------------------------------------
  // SECTION 3: AFTER YOU GENERATE LEADS — WHAT NEXT?
  // --------------------------------------------------------------------------
  ensureSpace(45);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('3. After You Generate Leads — What Next?', marginX, currentY);
  currentY += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const nextDesc = 'Generating leads is only the first step. Once your leads are extracted, they are automatically stored in your permanent Database. You do not need to immediately contact them — you can build your pipeline over time.';
  const splitNext = doc.splitTextToSize(nextDesc, contentWidth);
  doc.text(splitNext, marginX, currentY);
  currentY += (splitNext.length * 4) + 4;

  // 3-Step Pipeline Visual
  const colWidth = (contentWidth - 8) / 3;
  const pipeline = [
    { step: 'STEP 1', title: 'Lead Generation', desc: 'Select engine, keyword & location to discover verified contacts.' },
    { step: 'STEP 2', title: 'Lead Database', desc: 'Manage, search, deduplicate, filter by email, and export to Excel/PDF.' },
    { step: 'STEP 3', title: 'Outreach Campaign', desc: 'Pick target leads and send personalized bulk emails via your Gmail.' }
  ];

  pipeline.forEach((p, idx) => {
    const pX = marginX + (idx * (colWidth + 4));
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(pX, currentY, colWidth, 22, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(79, 70, 229);
    doc.text(p.step, pX + 3.5, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(p.title, pX + 3.5, currentY + 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const pDesc = doc.splitTextToSize(p.desc, colWidth - 7);
    doc.text(pDesc, pX + 3.5, currentY + 13.5);
  });
  currentY += 28;

  // --------------------------------------------------------------------------
  // SECTION 4: BULK EMAIL OUTREACH
  // --------------------------------------------------------------------------
  ensureSpace(65);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('4. Bulk Email Outreach System', marginX, currentY);
  currentY += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('ContaQue includes a dedicated, non-spam cold email engine. The basic workflow is:', marginX, currentY);
  currentY += 5;

  // Workflow Pill
  doc.setFillColor(238, 242, 255);
  doc.roundedRect(marginX, currentY, contentWidth, 7, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(67, 56, 202);
  doc.text('Connect Gmail Account  ->  Select Leads from Database  ->  Create Campaign  ->  Send Automatically', marginX + 4, currentY + 4.5);
  currentY += 11;

  // Steps
  const emailSteps = [
    {
      num: 'Step 1',
      title: 'Add your Gmail account (via Google App Password)',
      body: 'Connect your Gmail account using your Gmail Address + a 16-digit Google App Password (requires 2-Step Verification enabled in Google Account). Contaque uses direct secure SMTP binding without OAuth token expirations.'
    },
    {
      num: 'Step 2',
      title: 'Select your leads from the Database',
      body: 'You never have to copy-paste email addresses. Simply filter your Database for leads with verified emails, choose the target list, and pass them directly into a new Outreach Campaign.'
    },
    {
      num: 'Step 3',
      title: 'Create and launch your Campaign',
      body: 'Configure campaign name, email subject, personalized email body, target recipients, and select the sending Gmail account. Contaque sends with automated spacing and tracks delivery status in real-time.'
    }
  ];

  emailSteps.forEach(s => {
    ensureSpace(18);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginX, currentY, contentWidth, 16, 1.5, 1.5, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(37, 99, 235);
    doc.text(s.num + ':', marginX + 3.5, currentY + 4.5);

    doc.setTextColor(15, 23, 42);
    doc.text(s.title, marginX + 18, currentY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const splitBody = doc.splitTextToSize(s.body, contentWidth - 7);
    doc.text(splitBody, marginX + 3.5, currentY + 9);

    currentY += 19;
  });

  // --------------------------------------------------------------------------
  // SECTION 5: LEAD GENERATION VS EMAIL OUTREACH
  // --------------------------------------------------------------------------
  ensureSpace(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('5. Lead Generation vs. Email Outreach', marginX, currentY);
  currentY += 6;

  // Comparison Grid
  const halfCol = (contentWidth - 4) / 2;

  // Left: Lead Generation
  doc.setFillColor(240, 253, 250); // Teal-50
  doc.setDrawColor(204, 251, 241);
  doc.roundedRect(marginX, currentY, halfCol, 22, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 118, 110);
  doc.text('Lead Generation (Find & Store)', marginX + 4, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(19, 78, 74);
  doc.text('Find businesses and contact information across 5 engines.', marginX + 4, currentY + 9.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Formula: Engines -> Database', marginX + 4, currentY + 16);

  // Right: Email Outreach
  doc.setFillColor(238, 242, 255); // Indigo-50
  doc.setDrawColor(224, 231, 255);
  doc.roundedRect(marginX + halfCol + 4, currentY, halfCol, 22, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(67, 56, 202);
  doc.text('Email Outreach (Contact & Convert)', marginX + halfCol + 8, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(49, 46, 129);
  doc.text('Deliver cold outreach emails to targeted leads safely.', marginX + halfCol + 8, currentY + 9.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Formula: Database -> Campaign -> Gmail', marginX + halfCol + 8, currentY + 16);

  currentY += 28;

  // Summary Banner
  ensureSpace(14);
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.roundedRect(marginX, currentY, contentWidth, 11, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Remember the Flow:  FIND  ->  STORE  ->  SELECT  ->  OUTREACH', marginX + 35, currentY + 7);

  // --------------------------------------------------------------------------
  // FOOTER & PAGE NUMBERING ON ALL PAGES
  // --------------------------------------------------------------------------
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // Slate-400

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.text('ContaQue (c) Klyrova Inc.  |  https://contaque.com', marginX, pageHeight - 7.5);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - marginX - 16, pageHeight - 7.5);
  }

  // Save to public directory
  const outPath = path.resolve(__dirname, '../public/ContaQue_User_Guide.pdf');
  const buffer = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync(outPath, buffer);
  console.log(`✓ User Guide PDF generated successfully (${totalPages} pages) at: ${outPath}`);
}

buildUserGuidePDF();
