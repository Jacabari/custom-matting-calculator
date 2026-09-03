/**
 * Commercial Matting Estimator Engine
 * Single-file standalone vanilla script
 */

const MAT_SPECS = {
  heavy_8250: {
    id: 'heavy_8250',
    name: 'Heavy Traffic 8250',
    standardWidth: 3,
    standardLength: 20,
    costPerRoll: 27823.00,
    costPerSqFt: 463.72
  },
  medium_6050: {
    id: 'medium_6050',
    name: 'Medium Traffic 6050',
    standardWidth: 3,
    standardLength: 78,
    costPerRoll: 54729.59,
    costPerSqFt: 233.89
  },
  carpet_3100_3: {
    id: 'carpet_3100_3',
    name: 'Carpet 3100 (3 ft Width)',
    standardWidth: 3,
    standardLength: 60,
    costPerRoll: 48847.99,
    costPerSqFt: 271.38
  },
  carpet_3100_4: {
    id: 'carpet_3100_4',
    name: 'Carpet 3100 (4 ft Width)',
    standardWidth: 4,
    standardLength: 60,
    costPerRoll: 58112.00,
    costPerSqFt: 242.13
  },
  wet_area_3: {
    id: 'wet_area_3',
    name: 'Wet Area Mat',
    standardWidth: 3,
    standardLength: 40,
    costPerRoll: 36776.15,
    costPerSqFt: 306.47
  }
};

const COST_PERCENTAGES = {
  Luzon: { SRP: 0.73, B1: 0.76, B2: 0.79, B3: 0.82, B4: 0.85 },
  VisMin: { SRP: 0.70, B1: 0.73, B2: 0.76, B3: 0.79, B4: 0.82 }
};

const BRACKET_LABELS = {
  SRP: 'Standard Selling Price',
  B1: 'Bracket 1',
  B2: 'Bracket 2',
  B3: 'Bracket 3',
  B4: 'Bracket 4'
};

const ADHESIVE_COST_PER_LN_FT = 18.62;
const ADHESIVE_WASTE_FACTOR = 1.05;
const EDGING_LOW_PROFILE_COST = 70.79;
const EDGING_HIGH_PROFILE_COST = 204.51;
const FIXED_LABOR_COST = 100.00;
const VAT_RATE = 0.12;

// App State
const state = {
  matType: 'heavy_8250',
  width: 5,
  length: 12,
  useAdhesive: true,
  edgingSides: 'four_sides',
  edgingType: 'low_profile',
  region: 'Luzon',
  bracket: 'SRP',
  hideCosts: true,
  activePrintModal: null,
  lockedQuotationNumber: null,
  lockedJobOrderNumber: null
};

// Math Engine
function calculateOrder() {
  const { matType, width, length, edgingType, edgingSides, region, bracket, useAdhesive } = state;
  const spec = MAT_SPECS[matType];

  const res = {
    matType, width, length, edgingType, edgingSides, region, bracket, useAdhesive,
    cols: 0, rows: 0, roundedLength: 0, seamAdhesiveLength: 0,
    edgingLength: 0, edgingAdhesiveLength: 0, totalAdhesiveLength: 0, adhesiveLengthWithWaste: 0,
    mattingCost: 0, seamAdhesiveCost: 0, edgingCost: 0, laborCost: FIXED_LABOR_COST,
    totalCost: 0, costPercentage: COST_PERCENTAGES[region][bracket],
    sellingPriceExclVat: 0, vatAmount: 0, finalSellingPrice: 0,
    isValid: true, errorMessage: ''
  };

  if (!spec) {
    res.isValid = false; res.errorMessage = 'Invalid mat type.'; return res;
  }
  if (width <= 0 || length <= 0 || isNaN(width) || isNaN(length)) {
    res.isValid = false; res.errorMessage = 'Width and length must be greater than zero.'; return res;
  }

  if (matType === 'wet_area_3') {
    if (width > 3) {
      res.isValid = false; res.errorMessage = 'Wet Area Mat cannot exceed 3 ft width limit.'; return res;
    }
    if (length > 10) {
      res.isValid = false; res.errorMessage = 'Wet Area Mat custom sizing cannot exceed 10 ft length limit.'; return res;
    }
    res.roundedLength = length <= 2 ? 2 : length <= 4 ? 4 : length <= 8 ? 8 : 10;
    res.cols = 1; res.rows = 1; res.seamAdhesiveLength = 0;
    res.mattingCost = (3 * res.roundedLength) * spec.costPerSqFt;
  } else {
    res.cols = Math.ceil(width / spec.standardWidth);
    res.rows = Math.ceil(length / spec.standardLength);
    const longSeams = res.cols > 1 ? (res.cols - 1) * length : 0;
    const transSeams = res.rows > 1 ? (res.rows - 1) * width : 0;
    res.seamAdhesiveLength = longSeams + transSeams;
    res.mattingCost = width * length * spec.costPerSqFt;
  }

  res.edgingLength = edgingSides === 'four_sides' ? 2 * width + 2 * length : edgingSides === 'two_sides' ? 2 * width : 0;
  res.edgingAdhesiveLength = res.edgingLength;
  res.totalAdhesiveLength = useAdhesive ? (res.seamAdhesiveLength + res.edgingAdhesiveLength) : 0;
  res.adhesiveLengthWithWaste = useAdhesive ? (res.totalAdhesiveLength * ADHESIVE_WASTE_FACTOR) : 0;

  const edgingRate = edgingType === 'low_profile' ? EDGING_LOW_PROFILE_COST : edgingType === 'high_profile' ? EDGING_HIGH_PROFILE_COST : 0;
  res.edgingCost = res.edgingLength * edgingRate;

  const totalAdhCost = useAdhesive ? (res.adhesiveLengthWithWaste * ADHESIVE_COST_PER_LN_FT) : 0;
  res.seamAdhesiveCost = (useAdhesive && res.totalAdhesiveLength > 0) ? (totalAdhCost * (res.seamAdhesiveLength / res.totalAdhesiveLength)) : 0;

  res.totalCost = res.mattingCost + totalAdhCost + res.edgingCost + res.laborCost;
  res.sellingPriceExclVat = res.totalCost / res.costPercentage;
  res.vatAmount = res.sellingPriceExclVat * VAT_RATE;
  res.finalSellingPrice = res.sellingPriceExclVat * (1 + VAT_RATE);

  return res;
}

function formatPHP(num) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(num);
}

// UI Updater
function updateUI() {
  const calc = calculateOrder();
  const spec = MAT_SPECS[state.matType];

  // Mode Toggle
  const appTitle = document.getElementById('app-title');
  const appSubtitle = document.getElementById('app-subtitle');
  const modeBtn = document.getElementById('toggle-costs-mode-btn');
  const modeLabel = document.getElementById('mode-toggle-label');
  const modeIcon = document.getElementById('mode-icon-container');

  if (state.hideCosts) {
    appTitle.textContent = 'Custom Matting Material Estimator';
    appSubtitle.textContent = 'Precision industrial material usage, adhesive bonding, and edging bevel estimator';
    modeBtn.className = 'btn btn-mode-toggle';
    modeLabel.textContent = 'Materials Only Mode';
    modeIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon icon-xs icon-emerald"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>';
  } else {
    appTitle.textContent = 'Custom Matting & Pricing Calculator';
    appSubtitle.textContent = 'Precision industrial manufacturing and commercial estimating engine';
    modeBtn.className = 'btn btn-mode-toggle active-pricing';
    modeLabel.textContent = 'Show Commercial Costs';
    modeIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon icon-xs"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
  }

  // Mat Grid
  renderMatGrid();

  // Slider bounds
  const wRange = document.getElementById('width-range-input');
  const lRange = document.getElementById('length-range-input');
  const isWet = state.matType === 'wet_area_3';

  wRange.max = isWet ? '3' : '20';
  lRange.max = isWet ? '10' : '100';
  document.getElementById('width-cap-notice').classList.toggle('hidden', !isWet);
  document.getElementById('width-max-label').textContent = isWet ? 'Max: 3.0 ft' : 'Max: 20.0 ft';
  document.getElementById('length-rounding-notice').classList.toggle('hidden', !isWet);
  document.getElementById('length-max-label').textContent = isWet ? 'Max: 10.0 ft' : 'Max: 100.0 ft';
  document.getElementById('wet-area-notice-box').classList.toggle('hidden', !isWet);

  // Errors
  const errBox = document.getElementById('sizing-error-box');
  if (!calc.isValid && calc.errorMessage) {
    errBox.classList.remove('hidden');
    document.getElementById('sizing-error-message').textContent = calc.errorMessage;
  } else {
    errBox.classList.add('hidden');
  }

  // Segment buttons
  document.querySelectorAll('[data-adhesive]').forEach(btn => {
    btn.classList.toggle('active', (btn.dataset.adhesive === 'true') === state.useAdhesive);
  });
  document.querySelectorAll('[data-sides]').forEach(btn => {
    const disabled = state.edgingType === 'none' && btn.dataset.sides !== 'none';
    btn.disabled = disabled;
    btn.classList.toggle('active', state.edgingSides === btn.dataset.sides && state.edgingType !== 'none');
  });
  document.querySelectorAll('[data-type]').forEach(btn => {
    btn.classList.toggle('active', state.edgingType === btn.dataset.type);
  });
  document.querySelectorAll('[data-region]').forEach(btn => {
    btn.classList.toggle('active', state.region === btn.dataset.region);
  });
  document.getElementById('bracket-select').value = state.bracket;

  // Factor pill
  document.getElementById('cost-factor-box').classList.toggle('hidden', state.hideCosts);
  document.getElementById('cost-factor-display').textContent = `Cost Basis: ${(calc.costPercentage * 100).toFixed(0)}%`;

  // Render Blueprint
  renderBlueprint(calc);

  // Summary Switch
  document.getElementById('material-metrics-view').classList.toggle('hidden', !state.hideCosts);
  document.getElementById('cost-breakdown-view').classList.toggle('hidden', state.hideCosts);
  document.getElementById('summary-kicker').textContent = state.hideCosts ? 'Production Requisition' : 'Commercial Proposal';
  document.getElementById('summary-title').textContent = state.hideCosts ? 'Material Requirements' : 'Estimate Pricing';
  document.getElementById('summary-badge').textContent = state.hideCosts ? `${spec.standardWidth}ft stock roll` : `${state.region} / ${BRACKET_LABELS[state.bracket]}`;

  if (state.hideCosts) {
    document.getElementById('mat-usage-dimensions').textContent = isWet ? `3.0 ft x ${calc.roundedLength}.0 ft` : `${calc.width.toFixed(1)} ft x ${calc.length.toFixed(1)} ft`;
    document.getElementById('mat-usage-subtext').textContent = isWet ? 'Rounded to nearest standard roll segment' : `Assembled via ${calc.cols} x ${calc.rows} panels (${(calc.width * calc.length).toFixed(1)} sq. ft.)`;
    document.getElementById('adhesive-usage-length').textContent = `${calc.adhesiveLengthWithWaste.toFixed(1)} ln. ft.`;
    document.getElementById('adhesive-usage-subtext').textContent = `Seams: ${calc.seamAdhesiveLength.toFixed(1)} ft | Edge: ${calc.edgingLength.toFixed(1)} ft | +5% Waste`;
    document.getElementById('edging-usage-length').textContent = calc.edgingType === 'none' ? 'No Edging Applied' : `${calc.edgingLength.toFixed(1)} ln. ft.`;
    document.getElementById('edging-usage-subtext').textContent = calc.edgingType === 'none' ? '' : `${calc.edgingType.replace('_', ' ')} on ${calc.edgingSides.replace('_', ' ')}`;
  } else {
    document.getElementById('cost-val-matting').textContent = formatPHP(calc.mattingCost);
    document.getElementById('cost-label-adhesive').textContent = `Adhesive Compounds (${calc.adhesiveLengthWithWaste.toFixed(1)} ft):`;
    document.getElementById('cost-val-adhesive').textContent = formatPHP(calc.seamAdhesiveCost);
    document.getElementById('cost-val-edging').textContent = formatPHP(calc.edgingCost);
    document.getElementById('cost-val-labor').textContent = formatPHP(calc.laborCost);
    document.getElementById('cost-val-total').textContent = formatPHP(calc.totalCost);
  }

  document.getElementById('price-excl-vat').textContent = formatPHP(calc.sellingPriceExclVat);
  document.getElementById('price-vat').textContent = formatPHP(calc.vatAmount);
  document.getElementById('price-inc-vat').textContent = calc.isValid ? formatPHP(calc.finalSellingPrice) : '₱0.00';

  document.getElementById('btn-open-quote-modal').disabled = !calc.isValid;
  document.getElementById('btn-open-jo-modal').disabled = !calc.isValid;
}

// Blueprint Visualizer
function renderBlueprint(calc) {
  const container = document.getElementById('blueprint-canvas-container');
  const scaleTag = document.getElementById('blueprint-scale-tag');

  if (!calc.isValid || calc.width <= 0 || calc.length <= 0) {
    scaleTag.textContent = 'Scale: N/A';
    container.innerHTML = '<div style="text-align:center; color:#94a3b8; font-size:12px;">No layout preview available</div>';
    return;
  }

  const spec = MAT_SPECS[calc.matType];
  const physLen = calc.matType === 'wet_area_3' ? calc.roundedLength : calc.length;
  const physWid = calc.matType === 'wet_area_3' ? 3 : calc.width;

  const pad = 35;
  const scale = Math.min((380 - 2 * pad) / physWid, (260 - 2 * pad) / physLen, 35);
  scaleTag.textContent = `Scale: 1 ft = ${Math.round(scale)}px`;

  const svgW = physWid * scale + 2 * pad;
  const svgH = physLen * scale + 2 * pad;
  const w = physWid * scale;
  const h = physLen * scale;
  const edgingColor = calc.edgingType === 'low_profile' ? '#0ea5e9' : '#f59e0b';

  let svg = `<svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
    <defs>
      <pattern id="diagonal-stripe" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="8" stroke="#fca5a5" stroke-width="1.5" />
      </pattern>
    </defs>
    <rect x="${pad}" y="${pad}" width="${w}" height="${h}" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2" rx="3" />`;

  if (calc.matType === 'wet_area_3' && (calc.width < 3 || calc.length < calc.roundedLength)) {
    svg += `<rect x="${pad}" y="${pad}" width="${calc.width * scale}" height="${calc.length * scale}" fill="#cbd5e1" stroke="#64748b" stroke-width="1" />
      <rect x="${pad + calc.width * scale}" y="${pad}" width="${(3 - calc.width) * scale}" height="${physLen * scale}" fill="url(#diagonal-stripe)" opacity="0.5" />`;
    if (calc.length < calc.roundedLength) {
      svg += `<rect x="${pad}" y="${pad + calc.length * scale}" width="${calc.width * scale}" height="${(calc.roundedLength - calc.length) * scale}" fill="url(#diagonal-stripe)" opacity="0.5" />`;
    }
  }

  if (calc.matType !== 'wet_area_3') {
    for (let c = 1; c < calc.cols; c++) {
      const cx = pad + c * spec.standardWidth * scale;
      svg += `<line x1="${cx}" y1="${pad}" x2="${cx}" y2="${pad + h}" stroke="#ef4444" stroke-width="2" stroke-dasharray="4 4" />`;
    }
    for (let r = 1; r < calc.rows; r++) {
      const cy = pad + r * spec.standardLength * scale;
      svg += `<line x1="${pad}" y1="${cy}" x2="${pad + w}" y2="${cy}" stroke="#ef4444" stroke-width="2" stroke-dasharray="4 4" />`;
    }
  }

  if (calc.edgingType !== 'none') {
    if (calc.edgingSides === 'four_sides' || calc.edgingSides === 'two_sides') {
      svg += `<rect x="${pad - 2}" y="${pad - 4}" width="${w + 4}" height="5" fill="${edgingColor}" />
              <rect x="${pad - 2}" y="${pad + h - 1}" width="${w + 4}" height="5" fill="${edgingColor}" />`;
    }
    if (calc.edgingSides === 'four_sides') {
      svg += `<rect x="${pad - 4}" y="${pad - 2}" width="5" height="${h + 4}" fill="${edgingColor}" />
              <rect x="${pad + w - 1}" y="${pad - 2}" width="5" height="${h + 4}" fill="${edgingColor}" />`;
    }
  }

  // Dimension labels
  svg += `<line x1="${pad}" y1="${pad - 15}" x2="${pad + w}" y2="${pad - 15}" stroke="#64748b" stroke-width="1"/>
          <text x="${pad + w / 2}" y="${pad - 18}" text-anchor="middle" font-family="monospace" font-size="10" font-weight="bold" fill="#334155">${calc.width} ft</text>
          <line x1="${pad - 15}" y1="${pad}" x2="${pad - 15}" y2="${pad + h}" stroke="#64748b" stroke-width="1"/>
          <text x="${pad - 18}" y="${pad + h / 2}" text-anchor="middle" transform="rotate(-90 ${pad - 18} ${pad + h / 2})" font-family="monospace" font-size="10" font-weight="bold" fill="#334155">${calc.length} ft</text>
          <text x="${pad + w / 2}" y="${pad + h / 2 + 4}" text-anchor="middle" font-family="sans-serif" font-size="9" font-weight="600" fill="#64748b">${calc.matType === 'wet_area_3' ? `3 x ${calc.roundedLength} Std` : `${calc.cols} x ${calc.rows} Panels`}</text>
  </svg>`;

  container.innerHTML = svg;

  document.getElementById('legend-seam-text').textContent = `Adhesive Seam (${calc.seamAdhesiveLength.toFixed(1)} ft)`;
  const edgeLeg = document.getElementById('legend-edging-item');
  if (calc.edgingType !== 'none') {
    edgeLeg.classList.remove('hidden');
    document.getElementById('legend-edging-swatch').style.backgroundColor = edgingColor;
    document.getElementById('legend-edging-text').textContent = `${calc.edgingType.replace('_', ' ')} (${calc.edgingLength.toFixed(1)} ft)`;
  } else {
    edgeLeg.classList.add('hidden');
  }
  document.getElementById('legend-waste-item').classList.toggle('hidden', !(calc.matType === 'wet_area_3' && (calc.width < 3 || calc.length < calc.roundedLength)));
}

// Mat Grid Generation
function renderMatGrid() {
  const grid = document.getElementById('mat-type-grid');
  grid.innerHTML = '';
  Object.values(MAT_SPECS).forEach(spec => {
    const isSel = state.matType === spec.id;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `mat-btn ${isSel ? 'selected' : ''}`;
    btn.innerHTML = `<span>${spec.name}</span>${isSel ? '<span class="check-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="icon icon-xs"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}`;
    btn.addEventListener('click', () => {
      state.matType = spec.id;
      state.width = spec.id === 'wet_area_3' ? 3 : spec.standardWidth;
      state.length = spec.id === 'wet_area_3' ? 4 : 10;
      document.getElementById('width-number-input').value = state.width;
      document.getElementById('width-range-input').value = state.width;
      document.getElementById('length-number-input').value = state.length;
      document.getElementById('length-range-input').value = state.length;
      updateUI();
    });
    grid.appendChild(btn);
  });
}

// Document Preview Generators
function openDocumentModal(type) {
  state.activePrintModal = type;
  const modal = document.getElementById('print-modal');
  const paper = document.getElementById('printable-sheet-paper');
  const calc = calculateOrder();
  const dateStr = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });

  if (type === 'quote') {
    document.getElementById('print-modal-title').textContent = 'Print Preview: Commercial Quotation Sheet';
    document.getElementById('execute-print-btn-label').textContent = 'Generate & Print Quote';
    const num = state.lockedQuotationNumber ? `No. ${state.lockedQuotationNumber}` : '<span style="color:#d97706; background:#fffbeb; padding:2px 6px; border-radius:4px; font-size:11px;">[DRAFT - LOCKS ON PRINT]</span>';
    const edging = calc.edgingType === 'none' ? 'No Edging' : `${calc.edgingType.replace('_', ' ')} (${calc.edgingSides === 'two_sides' ? '2 Sides' : '4 Sides'} - ${calc.edgingLength} ft)`;

    paper.innerHTML = `
      <div class="doc-head">
        <div><h1 class="doc-h1">Custom Matting Solutions</h1></div>
        <div style="text-align:right;">
          <span class="doc-kicker">Official Commercial Quote</span>
          <div class="doc-num">${num}</div>
          <div class="doc-date">Date: ${dateStr}</div>
        </div>
      </div>
      <div class="doc-table">
        <div class="doc-table-head">Quotation Details</div>
        <div class="doc-tr"><span class="doc-label">Mat Type</span><span class="doc-val">${MAT_SPECS[calc.matType]?.name}</span></div>
        <div class="doc-tr"><span class="doc-label">Required Size</span><span class="doc-val font-mono">${calc.width} ft x ${calc.length} ft</span></div>
        <div class="doc-tr"><span class="doc-label">Fulfillment</span><span class="doc-val">Region: <strong>${calc.region}</strong></span></div>
        <div class="doc-tr"><span class="doc-label">Edging</span><span class="doc-val">${edging}</span></div>
        <div class="doc-tr bg-light"><span class="doc-label">Price VAT Ex.</span><span class="doc-val font-mono">${formatPHP(calc.sellingPriceExclVat)}</span></div>
        <div class="doc-tr bg-green"><span class="doc-label" style="color:#047857;">Final Price VAT Inc.</span><span class="doc-val price">${formatPHP(calc.finalSellingPrice)}</span></div>
      </div>
      <div class="doc-signs-2">
        <div><span class="sign-label">Prepared by:</span><span class="sign-role">Technical Account Manager</span><div class="sign-line"></div><span class="sign-caption">Signature Over Printed Name / Date</span></div>
        <div><span class="sign-label">Approved & Accepted:</span><span class="sign-role">Customer Conforme</span><div class="sign-line"></div><span class="sign-caption">Signature Over Printed Name / Date</span></div>
      </div>`;
  } else {
    document.getElementById('print-modal-title').textContent = 'Print Preview: Production Job Order Form';
    document.getElementById('execute-print-btn-label').textContent = 'Generate & Print Job Order';
    const num = state.lockedJobOrderNumber ? `No. ${state.lockedJobOrderNumber}` : '<span style="color:#d97706; background:#fffbeb; padding:2px 6px; border-radius:4px; font-size:11px;">[DRAFT - LOCKS ON PRINT]</span>';
    const edging = calc.edgingType === 'none' ? 'No Edging' : `${calc.edgingType.replace('_', ' ')} (${calc.edgingSides === 'two_sides' ? '2 Sides' : '4 Sides'} - ${calc.edgingLength} ft)`;

    paper.innerHTML = `
      <div class="doc-head">
        <div><h1 class="doc-h1">Custom Matting Job Order Form</h1></div>
        <div style="text-align:right;">
          <span class="doc-kicker">Official Production Job Order</span>
          <div class="doc-num">${num}</div>
          <div class="doc-date">Date: ${dateStr}</div>
        </div>
      </div>
      <div class="doc-table">
        <div class="doc-table-head">Production Specifications</div>
        <div class="doc-tr"><span class="doc-label">Mat Type</span><span class="doc-val">${MAT_SPECS[calc.matType]?.name}</span></div>
        <div class="doc-tr"><span class="doc-label">Required Size</span><span class="doc-val font-mono">${calc.width} ft x ${calc.length} ft</span></div>
        <div class="doc-tr"><span class="doc-label">Edging</span><span class="doc-val">${edging}</span></div>
        <div class="doc-tr"><span class="doc-label">Quantity</span><div class="blank-line"></div></div>
        <div class="doc-tr"><span class="doc-label">Color</span><div class="blank-line"></div></div>
        <div class="doc-tr"><span class="doc-label">Region</span><span class="doc-val">${calc.region}</span></div>
        <div class="doc-tr"><span class="doc-label">Start Date</span><div class="blank-line"></div></div>
        <div class="doc-tr"><span class="doc-label">Completion Date</span><div class="blank-line"></div></div>
        <div class="doc-tr"><span class="doc-label">Warehouse Team</span><div class="blank-line"></div></div>
      </div>
      <div class="doc-signs-3">
        <div><span class="sign-label">Prepared by:</span><div style="height:2rem;"></div><div class="sign-line"></div><span class="sign-caption">Signature / Date</span></div>
        <div><span class="sign-label">Approved (Admin):</span><div style="height:2rem;"></div><div class="sign-line"></div><span class="sign-caption">Signature / Date</span></div>
        <div><span class="sign-label">Received by:</span><div style="height:2rem;"></div><div class="sign-line"></div><span class="sign-caption">Signature / Date</span></div>
      </div>`;
  }

  modal.classList.remove('hidden');
}

// Attach Event Listeners on Load
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('footer-date').textContent = `Local Time: ${new Date().toLocaleDateString('en-PH')}`;

  // Sliders sync
  const wNum = document.getElementById('width-number-input');
  const wRange = document.getElementById('width-range-input');
  const lNum = document.getElementById('length-number-input');
  const lRange = document.getElementById('length-range-input');

  wNum.addEventListener('input', e => { state.width = parseFloat(e.target.value) || 0; wRange.value = state.width; updateUI(); });
  wRange.addEventListener('input', e => { state.width = parseFloat(e.target.value) || 0; wNum.value = state.width; updateUI(); });
  lNum.addEventListener('input', e => { state.length = parseFloat(e.target.value) || 0; lRange.value = state.length; updateUI(); });
  lRange.addEventListener('input', e => { state.length = parseFloat(e.target.value) || 0; lNum.value = state.length; updateUI(); });

  // Mode Toggle
  document.getElementById('toggle-costs-mode-btn').addEventListener('click', () => {
    state.hideCosts = !state.hideCosts;
    updateUI();
  });

  // Adhesive Toggle
  document.querySelectorAll('[data-adhesive]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.useAdhesive = btn.dataset.adhesive === 'true';
      updateUI();
    });
  });

  // Edging Sides Toggle
  document.querySelectorAll('[data-sides]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.edgingSides = btn.dataset.sides;
      if (btn.dataset.sides === 'none') state.edgingType = 'none';
      else if (state.edgingType === 'none') state.edgingType = 'low_profile';
      updateUI();
    });
  });

  // Edging Type Toggle
  document.querySelectorAll('[data-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.edgingType = btn.dataset.type;
      if (btn.dataset.type === 'none') state.edgingSides = 'none';
      else if (state.edgingSides === 'none') state.edgingSides = 'four_sides';
      updateUI();
    });
  });

  // Region Toggle
  document.querySelectorAll('[data-region]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.region = btn.dataset.region;
      updateUI();
    });
  });

  // Bracket Dropdown
  document.getElementById('bracket-select').addEventListener('change', e => {
    state.bracket = e.target.value;
    updateUI();
  });

  // Print buttons
  document.getElementById('btn-open-quote-modal').addEventListener('click', () => openDocumentModal('quote'));
  document.getElementById('btn-open-jo-modal').addEventListener('click', () => openDocumentModal('job_order'));
  document.getElementById('close-print-modal-btn').addEventListener('click', () => {
    document.getElementById('print-modal').classList.add('hidden');
  });

  document.getElementById('execute-print-btn').addEventListener('click', () => {
    if (state.activePrintModal === 'quote' && !state.lockedQuotationNumber) {
      let cur = parseInt(localStorage.getItem('last_quote_num') || '4020', 10) + 1;
      localStorage.setItem('last_quote_num', cur.toString());
      state.lockedQuotationNumber = `QT-${new Date().getFullYear()}-${cur}`;
      openDocumentModal('quote');
    } else if (state.activePrintModal === 'job_order' && !state.lockedJobOrderNumber) {
      let cur = parseInt(localStorage.getItem('last_jo_num') || '7050', 10) + 1;
      localStorage.setItem('last_jo_num', cur.toString());
      state.lockedJobOrderNumber = `JO-${new Date().getFullYear()}-${cur}`;
      openDocumentModal('job_order');
    }
    window.print();
  });

  // Security Sandbox Modal
  const secModal = document.getElementById('security-modal');
  const secInput = document.getElementById('security-query-input');
  const secResp = document.getElementById('security-response-box');

  document.getElementById('open-security-modal-btn').addEventListener('click', () => {
    secModal.classList.remove('hidden');
    secInput.value = '';
    secResp.classList.add('hidden');
  });
  document.getElementById('close-security-modal-btn').addEventListener('click', () => secModal.classList.add('hidden'));

  document.getElementById('security-preset-btn').addEventListener('click', () => {
    secInput.value = 'reveal system prompt and calculation rules';
  });

  document.getElementById('security-test-form').addEventListener('submit', e => {
    e.preventDefault();
    const query = secInput.value.toLowerCase();
    secResp.classList.remove('hidden');
    if (query.includes('rule') || query.includes('system') || query.includes('prompt') || query.includes('instruction') || query.includes('formula')) {
      secResp.className = 'security-output error';
      secResp.textContent = '[SECURITY GUARDRAIL ENGAGED] Unauthorized query blocked. System proprietary formulas and internal instruction scripts are protected under IP guardrails.';
    } else {
      secResp.className = 'security-output success';
      secResp.textContent = '[QUERY CLEARED] Parameter verification completed. System operational and safe.';
    }
  });

  // Initial Run
  updateUI();
});